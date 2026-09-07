-- ============================================================
-- Your Journey / Mirelon – Migration: Fortschrittssystem v2
-- (2026-09-07)
-- ============================================================
-- Baut auf supabase_migration_schloss.sql auf (earn_xp v1) und
-- ERSETZT dort earn_xp(). Ändert:
--   1) earn_xp(p_reason, p_difficulty, p_round_id): Schwierigkeits-
--      stufen (leicht/normal/schwer), 100-XP-Tageslimit (Kalendertag,
--      Zeitzone Europe/Berlin), Wiederholungssperre pro Runde/Variante,
--      Levelkurve 1–20, neue Level-Belohnungen 2–20.
--   2) Einmaliger, idempotenter Backfill: Level neu aus XP berechnen;
--      Nutzer, die durch die neue L2-Schwelle (120 -> 100) jetzt
--      Stufe 2 erreichen und die L2-Belohnung noch NICHT haben,
--      bekommen 25 Münzen exakt einmal. Bereits vergebene Belohnungen
--      (auch die alten 30 Münzen bei L2) bleiben unangetastet.
--
-- sync_player_data() und use_consumable_item() bleiben unverändert:
--   - progression ist weiterhin als GANZER protected_key geschützt;
--     die neuen Unterfelder dayDate/dayXp schreibt ausschliesslich
--     earn_xp().
--   - "konfetti" braucht keine SQL-Änderung: use_consumable_item()
--     verarbeitet jeden item_key generisch.
--
-- Kann gefahrlos mehrfach ausgeführt werden (der Backfill ist über
-- claimedLevelRewards ? '2' idempotent).
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen kompletten Inhalt einfügen -> "Run".
-- ============================================================


-- ============================================================
-- 1) earn_xp(): neue 3-Parameter-Signatur. Die alte 1-Parameter-
--    Version wird entfernt (sonst entstünde eine Überladung).
--    Aufrufe mit nur {p_reason} funktionieren weiter über die
--    DEFAULT-Werte.
-- ============================================================
drop function if exists public.earn_xp(text);

create or replace function public.earn_xp(
    p_reason text,
    p_difficulty text default 'normal',
    p_round_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    day_cap constant int := 100;
    dedup_cooldown_default constant int := 64800;  -- 18 h: gleiche Runde+Stufe nicht sofort erneut
    v_diff text;
    base_xp int;
    v_round text;
    dedup_key text;
    dedup_cooldown int;

    current_data jsonb;
    current_xp numeric;
    current_level int;
    day_date text;
    day_xp int;
    today text;
    remaining_today int;
    grant_xp int;
    new_xp numeric;
    new_level int;

    unlocked_features jsonb;
    claimed_rewards jsonb;
    owned_furniture jsonb;
    consumables jsonb;
    coins numeric;
    total_coins numeric;
    golden numeric;
    level_row record;
    reward_item jsonb;
    granted jsonb := '[]'::jsonb;
    story_event text := null;

    passthrough jsonb;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    -- --- Schwierigkeit normalisieren ---
    v_diff := lower(coalesce(nullif(btrim(p_difficulty), ''), 'normal'));
    if v_diff not in ('leicht', 'normal', 'schwer') then
        v_diff := 'normal';
    end if;

    -- --- XP-Grundbetrag je (Grund, Stufe) - deckungsgleich mit
    --     JS/level-data.js (MIRELON_XP_REWARDS). ---
    base_xp := case
        when p_reason in ('quiz_richtig', 'faro_spiel_gewonnen') then
            case v_diff when 'leicht' then 10 when 'schwer' then 30 else 20 end
        when p_reason = 'puzzle_geloest' then
            case v_diff when 'leicht' then 15 when 'schwer' then 40 else 25 end
        when p_reason = 'tagesaufgabe' then
            case v_diff when 'schwer' then 50 else 25 end
        when p_reason = 'baumkind_gepflegt' then
            case v_diff when 'normal' then 10 else 5 end
        when p_reason = 'malstube_bild_gespeichert' then 10
        else null
    end;

    if base_xp is null then
        raise exception 'Unbekannter XP-Grund: %', p_reason;
    end if;

    today := ((now() at time zone 'Europe/Berlin')::date)::text;

    -- Spieler-Zeile sperren (atomarer Block bis zum UPDATE)
    select player_data into current_data
    from public.profiles
    where id = auth.uid()
    for update;

    if current_data is null then
        current_data := '{}'::jsonb;
    end if;

    current_xp := coalesce((current_data #>> '{progression,xp}')::numeric, 0);
    current_level := coalesce((current_data #>> '{progression,level}')::int, 1);
    day_date := current_data #>> '{progression,dayDate}';
    day_xp := coalesce((current_data #>> '{progression,dayXp}')::int, 0);
    unlocked_features := coalesce(current_data #> '{progression,unlockedFeatures}', '[]'::jsonb);
    claimed_rewards := coalesce(current_data #> '{progression,claimedLevelRewards}', '[]'::jsonb);
    owned_furniture := coalesce(current_data #> '{schloss,ownedFurniture}', '[]'::jsonb);
    consumables := coalesce(current_data->'consumables', '{}'::jsonb);
    coins := coalesce((current_data->>'coins')::numeric, 0);
    total_coins := coalesce((current_data->>'totalCoinsEarned')::numeric, 0);
    golden := coalesce((current_data->>'goldenFeathers')::numeric, 0);

    if day_date is distinct from today then
        day_xp := 0;
    end if;

    -- Gemeinsame "nichts verändert"-Antwort (Tageslimit / schon belohnt)
    passthrough := jsonb_build_object(
        'xp', current_xp,
        'level', current_level,
        'unlockedFeatures', unlocked_features,
        'claimedLevelRewards', claimed_rewards,
        'grantedRewards', '[]'::jsonb,
        'storyEvent', null,
        'coins', coins,
        'totalCoinsEarned', total_coins,
        'goldenFeathers', golden,
        'consumables', consumables,
        'ownedFurniture', owned_furniture,
        'dayDate', today,
        'dayXp', day_xp
    );

    -- --- 1) Tageslimit: über 100 -> gar nichts (kein Cooldown-
    --        Verbrauch, kein Write). Weiterspielen bleibt möglich. ---
    remaining_today := day_cap - day_xp;
    if remaining_today <= 0 then
        return passthrough || jsonb_build_object('capped', true, 'alreadyRewarded', false);
    end if;

    -- --- 2) Wiederholungssperre / Anti-Replay ---
    --   Mit p_round_id: gleicher (Grund + Stufe + Runde) 18 h gesperrt.
    --     Neue Runde-ID ODER höhere Schwierigkeit = neuer Key = wieder XP.
    --   Malstube: serverseitig auf den Kalendertag gezwungen (1x/Tag).
    --   Ohne p_round_id: kurzer bzw. je-Grund-Cooldown wie in v1.
    if p_reason = 'malstube_bild_gespeichert' then
        dedup_key := 'xpr_malstube_' || today;
        dedup_cooldown := 86400;
    elsif p_round_id is not null and btrim(p_round_id) <> '' then
        v_round := left(btrim(p_round_id), 120);
        dedup_key := 'xpr_' || p_reason || '_' || v_diff || '_' || v_round;
        dedup_cooldown := dedup_cooldown_default;
    else
        dedup_key := 'xp_' || p_reason;
        dedup_cooldown := case p_reason
            when 'baumkind_gepflegt' then 3600
            else 4
        end;
    end if;

    insert into public.reward_cooldowns as rc (user_id, reason, last_claimed_at)
    values (auth.uid(), dedup_key, now())
    on conflict (user_id, reason) do update
        set last_claimed_at = excluded.last_claimed_at
        where rc.last_claimed_at <= now() - (dedup_cooldown || ' seconds')::interval;

    if not found then
        -- diese Runde/Variante wurde schon belohnt (oder zu schnell
        -- hintereinander) -> freundlich, KEIN Fehler
        return passthrough || jsonb_build_object('capped', false, 'alreadyRewarded', true);
    end if;

    -- --- 3) Gutschrift (auf das Tagesrest-Kontingent gedeckelt) ---
    grant_xp := least(base_xp, remaining_today);
    day_xp := day_xp + grant_xp;
    new_xp := current_xp + grant_xp;

    -- Höchstes erreichtes Level (Kurve 1-20, spiegelt JS/level-data.js)
    select max(level) into new_level from (values
        (1, 0), (2, 100), (3, 300), (4, 550), (5, 850),
        (6, 1200), (7, 1600), (8, 2050), (9, 2550), (10, 3100),
        (11, 3700), (12, 4350), (13, 5050), (14, 5800), (15, 6600),
        (16, 7450), (17, 8350), (18, 9300), (19, 10300), (20, 11350)
    ) as levels(level, xp_required)
    where xp_required <= new_xp;
    new_level := coalesce(new_level, 1);

    -- Belohnungen für jedes neu erreichte, noch nicht abgeholte Level.
    -- "exactly once" -> allein die claimed_rewards-Prüfung in der Schleife.
    for level_row in
        select * from (values
            (2,  '[{"type":"coins","amount":25}]'::jsonb, null::text),
            (3,  '[{"type":"featureUnlock","key":"castle"},{"type":"furniture","ids":["stuhl_wald_a","tisch_wald_a","teppich_wald_a"]},{"type":"coins","amount":20}]'::jsonb, 'castle_unlock'),
            (4,  '[{"type":"consumable","key":"konfetti","amount":2}]'::jsonb, null),
            (5,  '[{"type":"furniture","ids":["lampe_wald_a"]}]'::jsonb, null),
            (6,  '[{"type":"coins","amount":40}]'::jsonb, null),
            (7,  '[{"type":"consumable","key":"feuerwerk","amount":1}]'::jsonb, null),
            (8,  '[{"type":"furniture","ids":["regal_wald_a"]}]'::jsonb, null),
            (9,  '[{"type":"coins","amount":50}]'::jsonb, null),
            (10, '[{"type":"coins","amount":60}]'::jsonb, null),
            -- 11-20: bewusst nur SICHERE Keys (Münzen + vorhandene
            -- Consumables). Grosse Meilensteine (Garten, neue
            -- Schlossräume/-stile) kommen erst als echte Belohnung,
            -- wenn die Inhalte fertig sind - dann hier eintragen.
            (11, '[{"type":"coins","amount":40}]'::jsonb, null),
            (12, '[{"type":"consumable","key":"konfetti","amount":1}]'::jsonb, null),
            (13, '[{"type":"coins","amount":50}]'::jsonb, null),
            (14, '[{"type":"consumable","key":"feuerwerk","amount":1}]'::jsonb, null),
            (15, '[{"type":"coins","amount":60}]'::jsonb, null),
            (16, '[{"type":"consumable","key":"konfetti","amount":2}]'::jsonb, null),
            (17, '[{"type":"coins","amount":70}]'::jsonb, null),
            (18, '[{"type":"consumable","key":"feuerwerk","amount":1}]'::jsonb, null),
            (19, '[{"type":"coins","amount":80}]'::jsonb, null),
            (20, '[{"type":"coins","amount":100},{"type":"consumable","key":"konfetti","amount":2},{"type":"consumable","key":"feuerwerk","amount":1}]'::jsonb, null)
        ) as lv(level, rewards, story_event)
        where lv.level > current_level and lv.level <= new_level
        order by lv.level asc
    loop
        if not (claimed_rewards ? level_row.level::text) then

            for reward_item in select * from jsonb_array_elements(level_row.rewards) loop

                if reward_item->>'type' = 'coins' then
                    coins := coins + (reward_item->>'amount')::numeric;
                    total_coins := total_coins + (reward_item->>'amount')::numeric;

                elsif reward_item->>'type' = 'featureUnlock' then
                    if not (unlocked_features ? (reward_item->>'key')) then
                        unlocked_features := unlocked_features || to_jsonb(reward_item->>'key');
                    end if;

                elsif reward_item->>'type' = 'furniture' then
                    owned_furniture := (
                        select coalesce(jsonb_agg(distinct elem), '[]'::jsonb)
                        from jsonb_array_elements(owned_furniture || (reward_item->'ids')) as elem
                    );

                elsif reward_item->>'type' = 'consumable' then
                    consumables := consumables || jsonb_build_object(
                        reward_item->>'key',
                        coalesce((consumables->>(reward_item->>'key'))::numeric, 0)
                            + coalesce((reward_item->>'amount')::numeric, 1)
                    );

                end if;

            end loop;

            claimed_rewards := claimed_rewards || to_jsonb(level_row.level::text);
            granted := granted || level_row.rewards;

            if level_row.story_event is not null then
                story_event := level_row.story_event;
            end if;

        end if;
    end loop;

    golden := greatest(golden, floor(total_coins / 100));

    update public.profiles
    set player_data = current_data || jsonb_build_object(
            'coins', coins,
            'totalCoinsEarned', total_coins,
            'goldenFeathers', golden,
            'consumables', consumables,
            'schloss', coalesce(current_data->'schloss', '{}'::jsonb)
                || jsonb_build_object('ownedFurniture', owned_furniture),
            'progression', jsonb_build_object(
                'version', 1,
                'xp', new_xp,
                'level', new_level,
                'unlockedFeatures', unlocked_features,
                'claimedLevelRewards', claimed_rewards,
                'dayDate', today,
                'dayXp', day_xp
            )
        ),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object(
        'xp', new_xp,
        'level', new_level,
        'unlockedFeatures', unlocked_features,
        'claimedLevelRewards', claimed_rewards,
        'grantedRewards', granted,
        'storyEvent', story_event,
        'coins', coins,
        'totalCoinsEarned', total_coins,
        'goldenFeathers', golden,
        'consumables', consumables,
        'ownedFurniture', owned_furniture,
        'dayDate', today,
        'dayXp', day_xp,
        'capped', (grant_xp < base_xp),
        'alreadyRewarded', false
    );
end;
$$;

revoke all on function public.earn_xp(text, text, text) from public, anon;
grant execute on function public.earn_xp(text, text, text) to authenticated;


-- ============================================================
-- 2) Einmaliger Backfill der Levelkurve (L2: 120 -> 100 XP)
--    Idempotent: die 25-Münzen-Gutschrift hängt allein an
--    "claimedLevelRewards enthält '2' noch nicht".
-- ============================================================
do $$
declare
    r record;
    xp numeric;
    lvl int;
    cr jsonb;
    give_l2 boolean;
begin
    for r in
        select id, player_data
        from public.profiles
        where player_data ? 'progression'
    loop
        xp := coalesce((r.player_data #>> '{progression,xp}')::numeric, 0);
        cr := coalesce(r.player_data #> '{progression,claimedLevelRewards}', '[]'::jsonb);

        select max(level) into lvl from (values
            (1, 0), (2, 100), (3, 300), (4, 550), (5, 850),
            (6, 1200), (7, 1600), (8, 2050), (9, 2550), (10, 3100),
            (11, 3700), (12, 4350), (13, 5050), (14, 5800), (15, 6600),
            (16, 7450), (17, 8350), (18, 9300), (19, 10300), (20, 11350)
        ) as levels(level, xp_required)
        where xp_required <= xp;
        lvl := coalesce(lvl, 1);

        give_l2 := (lvl >= 2) and not (cr ? '2');

        if give_l2 then
            update public.profiles
            set player_data = jsonb_set(
                    jsonb_set(
                        r.player_data,
                        '{coins}',
                        to_jsonb(coalesce((r.player_data->>'coins')::numeric, 0) + 25)
                    ),
                    '{totalCoinsEarned}',
                    to_jsonb(coalesce((r.player_data->>'totalCoinsEarned')::numeric, 0) + 25)
                )
                || jsonb_build_object(
                    'progression',
                    coalesce(r.player_data->'progression', '{}'::jsonb)
                        || jsonb_build_object(
                            'level', lvl,
                            'claimedLevelRewards', cr || '["2"]'::jsonb
                        )
                ),
                updated_at = now()
            where id = r.id;

        elsif lvl is distinct from coalesce((r.player_data #>> '{progression,level}')::int, 1) then
            update public.profiles
            set player_data = jsonb_set(r.player_data, '{progression,level}', to_jsonb(lvl)),
                updated_at = now()
            where id = r.id;
        end if;
    end loop;

    -- goldenFeathers ggf. an neuen totalCoinsEarned angleichen (nie senken)
    update public.profiles
    set player_data = jsonb_set(
        player_data, '{goldenFeathers}',
        to_jsonb(greatest(
            coalesce((player_data->>'goldenFeathers')::numeric, 0),
            floor(coalesce((player_data->>'totalCoinsEarned')::numeric, 0) / 100)
        ))
    )
    where player_data ? 'progression';
end;
$$;
