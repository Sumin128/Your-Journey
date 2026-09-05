-- ============================================================
-- Your Journey – Migration: "Mein Schloss" + Mirelon-Levelsystem (v1)
-- (2026-09-04)
-- ============================================================
-- Eigenständige, idempotente Migration ZUSÄTZLICH zu
-- supabase_migration_security_player_data.sql (muss vorher schon
-- ausgeführt worden sein - diese Migration setzt public.profiles,
-- public.reward_cooldowns und die dortigen Funktionen voraus).
--
-- Fasst an:
--   - public.sync_player_data(jsonb): wird komplett neu erstellt
--     (create or replace), da sich sowohl die protected_keys-Liste
--     als auch die Behandlung von "schloss" ändert. purchase_item()
--     und use_consumable_item() bleiben unverändert - "konfetti" als
--     neues Verbrauchsitem braucht KEINE SQL-Änderung, da
--     use_consumable_item() schon jeden beliebigen item_key generisch
--     verarbeitet (kein hartkodierter Katalog dort).
--   - NEU: public.earn_xp(text) - einzige Route, um XP gutzuschreiben
--     und Level-Aufstiege inkl. deren Belohnungen zu vergeben.
--
-- Kann gefahrlos mehrfach ausgeführt werden.
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen kompletten Inhalt einfügen -> "Run".
-- ============================================================


-- ============================================================
-- Datenmodell-Hintergrund (siehe docs/mein-schloss.md):
--
-- player_data.schloss = { style, activeRoom, unlockedRooms,
--   ownedFurniture, rooms: {...}, customFurniture: {...} }
--   -> "unlockedRooms"/"ownedFurniture" sind wirtschaftlich wertvoll
--      (Möbel/Räume, die später Coins kosten) und werden GEZIELT auf
--      Pfadebene geschützt - der Rest von "schloss" (Layout, Design,
--      Farbe, eigene Texturnamen) ist nicht wertvoll und läuft ganz
--      normal über sync_player_data() mit, wie sidebarTheme heute
--      schon.
--
-- player_data.progression = { xp, level, unlockedFeatures,
--   claimedLevelRewards } -> hängt komplett von serverseitig
--   vergebenen XP ab, deshalb als GANZES in protected_keys
--   aufgenommen (wie "items"/"consumables" heute schon).
--
-- player_data.pendingStoryEvents ist ABSICHTLICH NICHT geschützt
-- (rein Präsentationszustand: "wurde ein Story-Panel schon gezeigt?")
-- und braucht deshalb KEINE Änderung an sync_player_data() - läuft
-- einfach normal mit durch, wie jedes andere unkritische Feld.
-- ============================================================


-- ============================================================
-- 1) sync_player_data(): neu erstellt, um a) "progression" als
--    ganzen geschützten Key aufzunehmen und b) die zwei wertvollen
--    schloss-Unterfelder gezielt zurückzusetzen, plus c) eine
--    leichte, nur beim Speichern laufende Prüfung, dass jede eigene
--    Möbelvariante (customFurniture) tatsächlich zu einer besessenen
--    Basis gehört (Verteidigung in der Tiefe - customFurniture selbst
--    ist nicht wirtschaftlich wertvoll, aber soll trotzdem nicht auf
--    einer nie freigeschalteten Basis "hängen" können).
-- ============================================================
create or replace function public.sync_player_data(new_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    old_data jsonb;
    old_achievement_count int;
    new_achievement_count int;
    max_new_achievements constant int := 10;
    protected_keys constant text[] := array['coins', 'totalCoinsEarned', 'goldenFeathers', 'items', 'consumables', 'progression'];
    protected_key text;
    owned_furniture jsonb;
    custom_key text;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select player_data into old_data
    from public.profiles
    where id = auth.uid()
    for update;

    if old_data is null then
        old_data := '{}'::jsonb;
    end if;

    foreach protected_key in array protected_keys loop
        if old_data ? protected_key then
            new_data := jsonb_set(new_data, array[protected_key], old_data->protected_key, true);
        else
            new_data := new_data - protected_key;
        end if;
    end loop;

    -- "schloss" selbst läuft normal mit (Layout/Design/Farbe sind
    -- nicht wertvoll) - nur die zwei wirtschaftlich wertvollen
    -- Unterfelder werden gezielt auf den zuletzt bestätigten
    -- Server-Stand zurückgesetzt, unabhängig davon, was der Client
    -- dafür schickt. jsonb_set erzeugt fehlende Zwischenobjekte
    -- (hier "schloss") automatisch, auch bei einem allerersten Sync.
    new_data := jsonb_set(
        new_data,
        '{schloss,ownedFurniture}',
        coalesce(old_data #> '{schloss,ownedFurniture}', '[]'::jsonb),
        true
    );
    new_data := jsonb_set(
        new_data,
        '{schloss,unlockedRooms}',
        coalesce(old_data #> '{schloss,unlockedRooms}', '["wohnzimmer"]'::jsonb),
        true
    );

    -- Verteidigung in der Tiefe: jede selbst bemalte Möbelvariante,
    -- deren baseFurnitureId NICHT in der soeben zurückgesetzten
    -- ownedFurniture-Liste steht, wird beim Sync stillschweigend
    -- entfernt. Kein wirtschaftlicher Schaden möglich (customFurniture
    -- ist nicht geschützt), aber verhindert, dass dauerhaft eine
    -- Variante zu einer nie besessenen Basis gespeichert bleibt.
    owned_furniture := new_data #> '{schloss,ownedFurniture}';

    if new_data #> '{schloss,customFurniture}' is not null then
        for custom_key in
            select jsonb_object_keys(new_data #> '{schloss,customFurniture}')
        loop
            if not (owned_furniture ? (new_data #>> array['schloss', 'customFurniture', custom_key, 'baseFurnitureId'])) then
                new_data := new_data #- array['schloss', 'customFurniture', custom_key];
            end if;
        end loop;
    end if;

    old_achievement_count := coalesce(jsonb_array_length(old_data->'achievements'), 0);
    new_achievement_count := coalesce(jsonb_array_length(new_data->'achievements'), 0);

    if new_achievement_count < old_achievement_count then
        raise exception 'Erfolge dürfen nicht entfernt werden';
    end if;

    if new_achievement_count > old_achievement_count + max_new_achievements then
        raise exception 'Zu viele neue Erfolge auf einmal (max % pro Sync)', max_new_achievements;
    end if;

    update public.profiles
    set player_data = new_data,
        updated_at = now()
    where id = auth.uid();
end;
$$;


-- ============================================================
-- 2) earn_xp(p_reason): einzige Route, um XP gutzuschreiben. Der
--    Client liefert NUR einen Grund (welche gültige Aktivität wurde
--    abgeschlossen), NIEMALS einen XP-Betrag - exakt dieselbe
--    Philosophie wie earn_coins() oben in
--    supabase_migration_security_player_data.sql (dort Zeile für
--    Zeile das Anti-Replay-Muster übernommen: reward_cooldowns wird
--    hier mit dem Namensraum 'xp_<reason>' wiederverwendet, damit XP-
--    Cooldowns nie mit Coin-Cooldowns derselben Aktivität kollidieren).
--
--    Level-Schwellen und Level-Belohnungen stehen fest in den beiden
--    VALUES-Tabellen unten - sie spiegeln JS/level-data.js
--    (MIRELON_LEVELS), der Client-Katalog dient dort nur der Anzeige/
--    Vorschau und ist nie sicherheitsrelevant. Ändert sich die
--    Progression (Schwellen/Belohnungen), müssen beide Stellen von
--    Hand synchron gehalten werden.
--
--    claimedLevelRewards ist die ALLEINIGE Quelle dafür, ob eine
--    Level-Belohnung schon vergeben wurde - das ist unabhängig von
--    player_data.pendingStoryEvents (das rein die Anzeige des
--    Story-Panels steuert, siehe docs/mein-schloss.md). Ein erneut
--    angezeigtes Story-Event kann dadurch NIE erneut eine Belohnung
--    auslösen.
-- ============================================================
create or replace function public.earn_xp(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    xp_amount int;
    cooldown_seconds int;
    current_data jsonb;
    current_xp numeric;
    current_level int;
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
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    -- Feste XP-Beträge je Aktivität (Erstentwurf, siehe Architekturplan
    -- "Mein Schloss" - später anhand echter Spielgeschwindigkeit
    -- anpassbar, reine Werteänderung, keine Strukturänderung).
    xp_amount := case p_reason
        when 'quiz_richtig' then 8
        when 'faro_spiel_gewonnen' then 15
        when 'malstube_bild_gespeichert' then 12
        when 'baumkind_gepflegt' then 5
        when 'puzzle_geloest' then 20
        else null
    end;

    if xp_amount is null then
        raise exception 'Unbekannter XP-Grund: %', p_reason;
    end if;

    -- Mindestabstand je Grund - wo dieselbe Aktivität schon einen
    -- Coin-Cooldown hat (siehe earn_coins), denselben Rhythmus
    -- übernehmen; "baumkind_gepflegt" hat dort keinen Cooldown, ist
    -- aber leicht wiederholbar -> eigener, moderater XP-Cooldown.
    cooldown_seconds := case p_reason
        when 'quiz_richtig' then 1
        when 'faro_spiel_gewonnen' then 3
        when 'malstube_bild_gespeichert' then 5
        when 'baumkind_gepflegt' then 3600
        when 'puzzle_geloest' then 3
        else 3
    end;

    -- Atomarer Anti-Replay-Gate, exakt wie in earn_coins() - eigener
    -- Reason-Namensraum ('xp_'-Präfix) in derselben reward_cooldowns-
    -- Tabelle, damit XP- und Coin-Cooldowns sich nie gegenseitig
    -- stören. WICHTIG: der XP-Betrag (xp_amount) bleibt eine
    -- eigenständige Variable - hier wird NICHTS in ihn hineingemischt,
    -- nur FOUND geprüft (siehe Architekturplan-Warnung zum
    -- Pseudocode-Erstentwurf).
    insert into public.reward_cooldowns as rc (user_id, reason, last_claimed_at)
    values (auth.uid(), 'xp_' || p_reason, now())
    on conflict (user_id, reason) do update
        set last_claimed_at = excluded.last_claimed_at
        where rc.last_claimed_at <= now() - (cooldown_seconds || ' seconds')::interval;

    if not found then
        raise exception 'Zu schnell hintereinander - bitte % Sekunde(n) warten', cooldown_seconds;
    end if;

    select player_data into current_data
    from public.profiles
    where id = auth.uid()
    for update;

    if current_data is null then
        current_data := '{}'::jsonb;
    end if;

    current_xp := coalesce((current_data #>> '{progression,xp}')::numeric, 0);
    current_level := coalesce((current_data #>> '{progression,level}')::int, 1);
    unlocked_features := coalesce(current_data #> '{progression,unlockedFeatures}', '[]'::jsonb);
    claimed_rewards := coalesce(current_data #> '{progression,claimedLevelRewards}', '[]'::jsonb);
    owned_furniture := coalesce(current_data #> '{schloss,ownedFurniture}', '[]'::jsonb);
    consumables := coalesce(current_data->'consumables', '{}'::jsonb);
    coins := coalesce((current_data->>'coins')::numeric, 0);
    total_coins := coalesce((current_data->>'totalCoinsEarned')::numeric, 0);
    golden := coalesce((current_data->>'goldenFeathers')::numeric, 0);

    new_xp := current_xp + xp_amount;

    -- Höchstes Level ermitteln, dessen Schwelle erreicht ist.
    -- Spiegelt MIRELON_LEVELS aus JS/level-data.js (Erstentwurf).
    select level into new_level from (values
        (1, 0), (2, 120), (3, 300), (4, 550), (5, 850),
        (6, 1200), (7, 1600), (8, 2050), (9, 2550), (10, 3100)
    ) as levels(level, xp_required)
    where xp_required <= new_xp
    order by level desc
    limit 1;

    -- Belohnungen für jedes neu erreichte, noch nicht abgeholte Level
    -- vergeben. Die "> current_level"-Filterung ist nur eine
    -- Optimierung (nicht die Sicherheit) - maßgeblich für "exactly
    -- once" ist ausschließlich die claimed_rewards-Prüfung innerhalb
    -- der Schleife, damit auch ein Sprung über mehrere Level in einem
    -- Aufruf (oder ein erneuter Aufruf nach einem Fehler) korrekt
    -- bleibt und nichts doppelt vergeben wird.
    for level_row in
        select * from (values
            (2, '[{"type":"coins","amount":30}]'::jsonb, null::text),
            (3, '[{"type":"featureUnlock","key":"castle"},{"type":"furniture","ids":["stuhl_wald_a","tisch_wald_a","teppich_wald_a"]},{"type":"coins","amount":20}]'::jsonb, 'castle_unlock'),
            (4, '[{"type":"coins","amount":40}]'::jsonb, null),
            (5, '[{"type":"furniture","ids":["lampe_wald_a"]}]'::jsonb, null),
            (6, '[{"type":"coins","amount":50}]'::jsonb, null),
            (7, '[{"type":"consumable","key":"konfetti","amount":3}]'::jsonb, null),
            (8, '[{"type":"furniture","ids":["regal_wald_a"]}]'::jsonb, null),
            (9, '[{"type":"coins","amount":60}]'::jsonb, null),
            (10, '[{"type":"cosmetic","key":"sidebar_glanz_gold"}]'::jsonb, null)
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
                -- 'cosmetic'/'decoration'/'roomUnlock': für Phase 1 nur
                -- im Rückgabewert (granted) an den Client gemeldet,
                -- keine eigene Serverwirkung nötig, solange kein
                -- solcher Reward-Typ wirtschaftlich geschützte Daten
                -- ändert. Sobald das der Fall ist, hier einen eigenen
                -- elsif-Zweig ergänzen.

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
                'claimedLevelRewards', claimed_rewards
            )
        ),
        updated_at = now()
    where id = auth.uid();

    -- Vollständige, maßgebliche Antwort - der Client übernimmt all
    -- diese Werte unverändert (keine eigene Berechnung), auch die
    -- Felder, die nicht direkt "progression" sind (coins/consumables/
    -- ownedFurniture), da earn_xp() bei einem Level-Aufstieg auch
    -- diese mit verändern kann.
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
        'ownedFurniture', owned_furniture
    );
end;
$$;


-- 3) EXECUTE-Rechte: nur angemeldete Nutzer. "anon" ausdrücklich mit
--    aufgeführt, nicht nur "public" - siehe
--    supabase_migration_tighten_consumable_grants.sql: in diesem
--    Projekt hatte "anon" bei mind. einer Funktion einen eigenen,
--    von PUBLIC unabhängigen Grant, ein reines "revoke ... from
--    public" hätte das nicht mit entfernt. Bei der Erstanwendung
--    dieser Migration (2026-09-04) hatte "anon" tatsächlich noch
--    Ausführungsrecht auf earn_xp/sync_player_data - deshalb hier
--    zusätzlich per Sicherheitsnachtrag ("lockdown_anon_xp_sync")
--    explizit entfernt und verifiziert (authenticated: ja, anon: nein).
revoke all on function public.earn_xp(text) from public, anon;
grant execute on function public.earn_xp(text) to authenticated;

-- sync_player_data() wurde neu erstellt (create or replace) - die
-- bestehende EXECUTE-Grant-Anweisung aus
-- supabase_migration_security_player_data.sql bleibt gültig, wird
-- hier aber zur Sicherheit wiederholt (schadet nicht, falls diese
-- Migration je isoliert betrachtet wird).
revoke all on function public.sync_player_data(jsonb) from public, anon;
grant execute on function public.sync_player_data(jsonb) to authenticated;
