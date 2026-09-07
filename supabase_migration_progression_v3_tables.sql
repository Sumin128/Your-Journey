-- ============================================================
-- Your Journey / Mirelon – Migration: Fortschritt v3 (relationale Tabellen)
-- (2026-09-07)   ADDITIV · REVERSIBEL · KEINE DATENLÖSCHUNG
-- ============================================================
-- Baut auf supabase_migration_progression_v2.sql auf.
--
-- Ziel dieses Durchgangs: die Fortschritts-Architektur aus
-- profiles.player_data (JSON) in echte Tabellen ÜBERFÜHREN, OHNE die
-- JSON-Struktur zu entfernen, umzubenennen oder zurückzusetzen.
--
--   * profiles.player_data bleibt in Phase 1 die MASSGEBLICHE Quelle.
--   * Die neuen Tabellen sind zunächst eine gepflegte PROJEKTION des
--     JSON (Trigger auf profiles). Der bestehende Client liest weiter
--     player_data und funktioniert unverändert.
--   * game_levels / game_xp_rules werden ab sofort von earn_xp()
--     GELESEN und sind damit für ANGEMELDETE Nutzer die serverseitig
--     MASSGEBLICHE Quelle der Level-/XP-Werte.
--   * JS/level-data.js bleibt eine bewusst gepflegte SPIEGELUNG - bis
--     zu einer späteren gemeinsamen Konfigurationslösung. Diese
--     Spiegelung ist NICHT nur Anzeige: der lokale Gastmodus rechnet
--     Level/XP weiterhin selbst aus JS/level-data.js. Die Werte stehen
--     also noch NICHT für sämtliche Clients an nur einer Stelle -
--     Server (Config-Tabellen) und Gast-Client (JS) müssen bis dahin
--     bei jeder Änderung parallel gepflegt werden.
--
-- ------------------------------------------------------------
-- WAS DIESE MIGRATION ÄNDERT
--   + 6 neue Tabellen (game_levels, game_xp_rules, player_progression,
--     player_unlocks, player_inventory, player_reward_claims), alle mit
--     RLS an, explizit von PUBLIC/anon/authenticated entzogenen Rechten
--     und exakt zugeschnittenen SELECT-Grants.
--   + project_player_data() + Trigger auf profiles (JSON -> Tabellen).
--   + idempotenter, fehlertoleranter Backfill für bestehende Profile.
--   + earn_xp() v3: liest Level-/XP-Werte aus den Config-Tabellen
--     (externer Vertrag unverändert -> Client bleibt gleich).
--   + Härtung: anon verliert den (funktionslosen, weil auth-
--     pflichtigen) EXECUTE-Grant auf earn_coins(text) und
--     claim_guest_progress(jsonb).
--
-- WAS DIESE MIGRATION NICHT ANTASTET
--   - profiles.player_data (Struktur, Inhalt, Namen) - bleibt Quelle.
--   - claim_guest_progress(): der FUNKTIONSKÖRPER bleibt EXAKT wie in
--     supabase_migration_guest_progress_claim.sql. Es wird KEIN
--     erspielter Gastfortschritt (XP, Level, Schloss-Freischaltung,
--     Möbel, Schlossdaten) verändert oder gelöscht; die Übernahme-
--     logik bleibt unverändert. Eine sichere Gast-Übernahme (Feld-
--     Validierung / Reset) ist eine EIGENE spätere Produktentscheidung.
--     GEÄNDERT wird nur der EXECUTE-Grant: anon verliert den (erst
--     nach Anmeldung relevanten, also funktionslosen) Zugriff.
--   - reward_cooldowns und andere interne Hilfstabellen - werden NICHT
--     öffentlich geöffnet (kein neuer Grant, keine neue Policy).
--   - earn_xp()-Aufrufvertrag (Parameter, JSON-Antwort, JSON-
--     Schreibpfad) - identisch; serverseitig wandert nur die
--     Datenquelle von Inline-VALUES in die Config-Tabellen. Der
--     Gast-Client (JS/level-data.js) bleibt davon unberührt.
--
-- Reversibel: siehe ROLLBACK-Block am Dateiende.
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen KOMPLETTEN Inhalt in EINEM Rutsch ausführen (Reihenfolge
-- wichtig: earn_xp() wird ganz zuletzt ersetzt, nachdem die
-- Config-Tabellen befüllt und geprüft sind).
-- ============================================================

begin;

-- ============================================================
-- 1) KONFIG: game_levels  (eine Zeile je Level)
--    Nicht sensibel (XP-Grenzen + Belohnungsliste). Für angemeldete
--    Nutzer serverseitig massgeblich (earn_xp liest hier). Der lokale
--    Gastmodus rechnet weiter mit JS/level-data.js - die Werte müssen
--    also vorerst an BEIDEN Stellen gepflegt werden. Nur-Lese-Katalog;
--    Schreibzugriff nur über Migrationen / Dashboard.
-- ============================================================
create table if not exists public.game_levels (
    level        smallint    primary key check (level between 1 and 999),
    total_xp     integer     not null    check (total_xp >= 0),
    rewards      jsonb       not null    default '[]'::jsonb
                             check (jsonb_typeof(rewards) = 'array'),
    story_event  text,
    updated_at   timestamptz not null default now()
);

comment on table public.game_levels is
    'Serverseitig massgebliche Quelle für XP-Grenzen + Level-Belohnungen (gelesen von earn_xp) für ANGEMELDETE Nutzer. JS/level-data.js MIRELON_LEVELS ist eine bewusst gepflegte Spiegelung, die der lokale Gastmodus weiterhin zum Rechnen braucht - beide bis zu einer gemeinsamen Konfig-Lösung parallel pflegen. Nur-Lese-Katalog (kein Client-Schreibzugriff).';

alter table public.game_levels enable row level security;

-- Erst ALLE impliziten Rechte entziehen (auch die von Supabase per
-- default privileges an anon/authenticated vergebenen), dann exakt das
-- vergeben, was der Browser braucht: reines SELECT.
revoke all on public.game_levels from public, anon, authenticated;
grant select on public.game_levels to anon, authenticated;

drop policy if exists game_levels_read on public.game_levels;
create policy game_levels_read on public.game_levels
    for select to anon, authenticated using (true);

-- Seed = aktueller Stand (progression_v2). on conflict do nothing ->
-- vorhandene / später von Hand angepasste Zeilen werden NICHT ueberschrieben.
insert into public.game_levels (level, total_xp, rewards, story_event) values
 ( 1,     0, '[]'::jsonb, null),
 ( 2,   100, '[{"type":"coins","amount":25}]'::jsonb, null),
 ( 3,   300, '[{"type":"featureUnlock","key":"castle"},{"type":"furniture","ids":["stuhl_wald_a","tisch_wald_a","teppich_wald_a"]},{"type":"coins","amount":20}]'::jsonb, 'castle_unlock'),
 ( 4,   550, '[{"type":"consumable","key":"konfetti","amount":2}]'::jsonb, null),
 ( 5,   850, '[{"type":"furniture","ids":["lampe_wald_a"]}]'::jsonb, null),
 ( 6,  1200, '[{"type":"coins","amount":40}]'::jsonb, null),
 ( 7,  1600, '[{"type":"consumable","key":"feuerwerk","amount":1}]'::jsonb, null),
 ( 8,  2050, '[{"type":"furniture","ids":["regal_wald_a"]}]'::jsonb, null),
 ( 9,  2550, '[{"type":"coins","amount":50}]'::jsonb, null),
 (10,  3100, '[{"type":"coins","amount":60}]'::jsonb, null),
 (11,  3700, '[{"type":"coins","amount":40}]'::jsonb, null),
 (12,  4350, '[{"type":"consumable","key":"konfetti","amount":1}]'::jsonb, null),
 (13,  5050, '[{"type":"coins","amount":50}]'::jsonb, null),
 (14,  5800, '[{"type":"consumable","key":"feuerwerk","amount":1}]'::jsonb, null),
 (15,  6600, '[{"type":"coins","amount":60}]'::jsonb, null),
 (16,  7450, '[{"type":"consumable","key":"konfetti","amount":2}]'::jsonb, null),
 (17,  8350, '[{"type":"coins","amount":70}]'::jsonb, null),
 (18,  9300, '[{"type":"consumable","key":"feuerwerk","amount":1}]'::jsonb, null),
 (19, 10300, '[{"type":"coins","amount":80}]'::jsonb, null),
 (20, 11350, '[{"type":"coins","amount":100},{"type":"consumable","key":"konfetti","amount":2},{"type":"consumable","key":"feuerwerk","amount":1}]'::jsonb, null)
on conflict (level) do nothing;


-- ============================================================
-- 2) KONFIG: game_xp_rules  (erlaubte XP-Aktivitäten)
--    Ebenfalls Nur-Lese-Katalog (keine Nutzerdaten). Für angemeldete
--    Nutzer serverseitig massgeblich (earn_xp liest hier); der lokale
--    Gastmodus nutzt weiter die Spiegelung in JS/level-data.js.
-- ============================================================
create table if not exists public.game_xp_rules (
    activity                 text        primary key,
    xp_leicht                integer     check (xp_leicht >= 0),
    xp_normal                integer     not null check (xp_normal >= 0),
    xp_schwer                integer     check (xp_schwer >= 0),
    -- 'per_round'           : dedup über (Aktivität + Stufe + p_round_id), cooldown_seconds
    -- 'per_calendar_day'    : dedup über (Aktivität + Kalendertag), 1x/Tag
    -- 'per_reason_cooldown' : dedup nur über Aktivität, cooldown_seconds (z. B. Baumkind 1x/h)
    repeat_rule              text        not null default 'per_round'
                             check (repeat_rule in ('per_round','per_calendar_day','per_reason_cooldown')),
    cooldown_seconds         integer     not null default 64800 check (cooldown_seconds >= 0),
    counts_towards_daily_cap boolean     not null default true,
    active                   boolean     not null default true,
    updated_at               timestamptz not null default now()
);

comment on table public.game_xp_rules is
    'Katalog erlaubter XP-Aktivitäten + XP je Schwierigkeit + Wiederholungsregel. Für angemeldete Nutzer serverseitig massgeblich (earn_xp). Der Browser schickt NUR die Aktivitätskennung + Schwierigkeit, nie einen Betrag. Der lokale Gastmodus rechnet weiter mit der Spiegelung in JS/level-data.js - bis zu einer gemeinsamen Konfig-Lösung beide parallel pflegen. Nur-Lese-Katalog.';

alter table public.game_xp_rules enable row level security;

revoke all on public.game_xp_rules from public, anon, authenticated;
grant select on public.game_xp_rules to anon, authenticated;

drop policy if exists game_xp_rules_read on public.game_xp_rules;
create policy game_xp_rules_read on public.game_xp_rules
    for select to anon, authenticated using (true);

insert into public.game_xp_rules
    (activity, xp_leicht, xp_normal, xp_schwer, repeat_rule, cooldown_seconds) values
 ('quiz_richtig',              10, 20,   30, 'per_round',            64800),
 ('faro_spiel_gewonnen',       10, 20,   30, 'per_round',            64800),
 ('puzzle_geloest',            15, 25,   40, 'per_round',            64800),
 ('tagesaufgabe',            null, 25,   50, 'per_calendar_day',     86400),
 ('baumkind_gepflegt',          5, 10, null, 'per_reason_cooldown',   3600),
 ('malstube_bild_gespeichert',null, 10, null, 'per_calendar_day',    86400)
on conflict (activity) do nothing;


-- ============================================================
-- 3) SPIELER-PROJEKTIONSTABELLEN
--    In Phase 1 eine gepflegte Kopie aus player_data (Trigger, s.u.).
--    RLS: jeder sieht NUR seine eigene Zeile. KEINE Client-Schreib-
--    rechte (auch kein Grant) - Schreiben passiert ausschließlich in
--    project_player_data()/earn_xp() (SECURITY DEFINER, umgeht RLS).
-- ============================================================
create table if not exists public.player_progression (
    user_id     uuid        primary key references auth.users(id) on delete cascade,
    total_xp    bigint      not null default 0 check (total_xp >= 0),
    level       smallint    not null default 1,
    day_date    date,
    day_xp      integer     not null default 0 check (day_xp >= 0),
    updated_at  timestamptz not null default now()
);

create table if not exists public.player_unlocks (
    user_id     uuid        not null references auth.users(id) on delete cascade,
    feature     text        not null,
    unlocked_at timestamptz not null default now(),
    primary key (user_id, feature)
);

create table if not exists public.player_inventory (
    user_id     uuid        not null references auth.users(id) on delete cascade,
    item_key    text        not null,
    quantity    integer     not null default 0 check (quantity >= 0),
    updated_at  timestamptz not null default now(),
    primary key (user_id, item_key)
);

create table if not exists public.player_reward_claims (
    user_id     uuid        not null references auth.users(id) on delete cascade,
    -- 'level_reward'   : claim_key = Levelnummer als Text
    -- 'daily_creative' : claim_key = 'xpr_malstube_<datum>'
    -- 'daily_task'     : claim_key = 'xpr_tagesaufgabe_<...>'
    -- 'game_variant'   : claim_key = 'xpr_<grund>_<stufe>_<runde>'
    claim_type  text        not null check (claim_type in ('level_reward','daily_creative','daily_task','game_variant')),
    claim_key   text        not null,
    claimed_at  timestamptz not null default now(),
    primary key (user_id, claim_type, claim_key)
);

comment on table public.player_progression   is 'Phase 1: Projektion aus player_data.progression (Trigger). Später massgeblich.';
comment on table public.player_unlocks        is 'Phase 1: Projektion aus player_data.progression.unlockedFeatures (nur additiv - Freischaltungen sind dauerhaft).';
comment on table public.player_inventory      is 'Phase 1: Projektion der Verbrauchsgegenstände aus player_data.consumables (feuerwerk, konfetti, ...). Später erweiterbar um Möbelbesitz (andere item_keys).';
comment on table public.player_reward_claims  is 'Eindeutige Nachweise gegen Doppelbelohnung (Level, tägliche Kreativ-XP, Tagesaufgaben, bereits belohnte Spielvarianten).';

-- RLS + explizite Rechte je Spielertabelle:
--   * ALLE Rechte von public/anon/authenticated entziehen
--   * nur SELECT für authenticated zurückgeben
--   * SELECT-Policy ausdrücklich "to authenticated", Zeile == eigener User
--   * KEINE insert/update/delete-Policy -> Client kann nicht schreiben
do $$
declare t text;
begin
    foreach t in array array[
        'player_progression','player_unlocks','player_inventory','player_reward_claims'
    ] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('revoke all on public.%I from public, anon, authenticated', t);
        execute format('grant select on public.%I to authenticated', t);
        execute format('drop policy if exists %I_select_own on public.%I', t, t);
        execute format(
            'create policy %I_select_own on public.%I for select to authenticated using (auth.uid() = user_id)',
            t, t);
    end loop;
end $$;


-- ============================================================
-- 4) PROJEKTION player_data -> Tabellen  (+ Trigger auf profiles)
--    Deckt ALLE Schreibpfade ab (earn_xp, sync_player_data,
--    purchase_*, claim_*), weil sie alle über profiles.player_data
--    laufen. Kein Umbau der einzelnen RPCs nötig.
--
--    Robust: verträgt alten/kaputten JSON-Inhalt ohne Abbruch
--    (defensive Auswertung von Zahlen/Datum/Arrays). Der Trigger
--    fängt zusätzlich jeden Projektionsfehler ab, damit ein
--    Projektionsproblem NIEMALS einen echten profiles-Schreibvorgang
--    blockiert.
-- ============================================================
create or replace function public.project_player_data(p_user uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_data jsonb := case when jsonb_typeof(p_data) = 'object' then p_data else '{}'::jsonb end;
    v_prog jsonb;
    v_consumables jsonb;
    v_features jsonb;
    v_claimed jsonb;

    -- Bekannte Verbrauchsgegenstände. Nur diese Keys werden in
    -- player_inventory auf 0 zurückgesetzt, wenn sie aus der JSON
    -- verschwinden. Künftiges Möbelinventar (andere item_keys) wird
    -- NIE angefasst.
    -- ponytail: feste Liste; eine 'category'-Spalte lohnt sich erst,
    -- wenn das Möbelinventar wirklich dazukommt. NEUE Verbrauchsart
    -- hier ergänzen, sonst bleibt ein auf 0 gesunkener Bestand stehen.
    v_known_consumables constant text[] := array['feuerwerk','konfetti'];

    v_xp bigint;
    v_level int;
    v_day_date date;
    v_day_xp int;
    v_feat text;
    v_kv record;
    v_lvl text;
begin
    v_prog := case when jsonb_typeof(v_data->'progression') = 'object'
                   then v_data->'progression' else '{}'::jsonb end;
    v_consumables := case when jsonb_typeof(v_data->'consumables') = 'object'
                          then v_data->'consumables' else '{}'::jsonb end;
    v_features    := case when jsonb_typeof(v_prog->'unlockedFeatures') = 'array'
                          then v_prog->'unlockedFeatures' else '[]'::jsonb end;
    v_claimed     := case when jsonb_typeof(v_prog->'claimedLevelRewards') = 'array'
                          then v_prog->'claimedLevelRewards' else '[]'::jsonb end;

    -- --- defensive Zahlen/Datums-Auswertung (kein Abbruch bei Alt-Müll) ---
    v_xp := greatest(0, floor(coalesce(
        (case when (v_prog->>'xp') ~ '^-?\d+(\.\d+)?$' then (v_prog->>'xp')::numeric end), 0)))::bigint;

    v_level := greatest(1, least(999, coalesce(
        (case when (v_prog->>'level') ~ '^\d+$' then (v_prog->>'level')::int end), 1)));

    -- Format-Regex fängt Grobes ab; ein format-gültiges, aber
    -- unmögliches Datum (2026-13-40) würde beim Cast noch werfen ->
    -- lokaler Handler setzt dann sicher NULL statt das Profil zu killen.
    begin
        v_day_date := case when (v_prog->>'dayDate') ~ '^\d{4}-\d{2}-\d{2}$'
                           then (v_prog->>'dayDate')::date end;
    exception when others then
        v_day_date := null;
    end;

    v_day_xp := greatest(0, coalesce(
        (case when (v_prog->>'dayXp') ~ '^-?\d+(\.\d+)?$'
              then floor((v_prog->>'dayXp')::numeric)::int end), 0));

    -- player_progression
    insert into public.player_progression (user_id, total_xp, level, day_date, day_xp, updated_at)
    values (p_user, v_xp, v_level::smallint, v_day_date, v_day_xp, now())
    on conflict (user_id) do update set
        total_xp   = excluded.total_xp,
        level      = excluded.level,
        day_date   = excluded.day_date,
        day_xp     = excluded.day_xp,
        updated_at = now();

    -- player_unlocks: NUR hinzufügen (Freischaltungen sind dauerhaft)
    for v_feat in select value from jsonb_array_elements_text(v_features) loop
        if v_feat is not null and btrim(v_feat) <> '' then
            insert into public.player_unlocks (user_id, feature)
            values (p_user, v_feat)
            on conflict (user_id, feature) do nothing;
        end if;
    end loop;

    -- player_inventory (a): alles, was AKTUELL in consumables steht,
    -- exakt übernehmen (Wahrheit ist player_data).
    for v_kv in select key, value from jsonb_each_text(v_consumables) loop
        insert into public.player_inventory (user_id, item_key, quantity, updated_at)
        values (
            p_user, v_kv.key,
            greatest(0, floor(coalesce(
                (case when v_kv.value ~ '^-?\d+(\.\d+)?$' then v_kv.value::numeric end), 0)))::int,
            now()
        )
        on conflict (user_id, item_key) do update set
            quantity   = excluded.quantity,
            updated_at = now();
    end loop;

    -- player_inventory (b): bekannte Verbrauchsgegenstände, die NICHT
    -- (mehr) in der JSON stehen -> auf 0. Kein falscher Restbestand.
    -- Andere item_keys (künftiges Möbelinventar) bleiben unberührt.
    update public.player_inventory
    set quantity = 0, updated_at = now()
    where user_id = p_user
      and item_key = any (v_known_consumables)
      and not (v_consumables ? item_key)
      and quantity <> 0;

    -- player_reward_claims: Level-Belohnungen aus claimedLevelRewards
    for v_lvl in select value from jsonb_array_elements_text(v_claimed) loop
        if v_lvl ~ '^\d+$' then
            insert into public.player_reward_claims (user_id, claim_type, claim_key)
            values (p_user, 'level_reward', v_lvl)
            on conflict (user_id, claim_type, claim_key) do nothing;
        end if;
    end loop;
end;
$$;

revoke all on function public.project_player_data(uuid, jsonb) from public, anon, authenticated;

create or replace function public.trg_project_player_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' or new.player_data is distinct from old.player_data then
        begin
            perform public.project_player_data(new.id, new.player_data);
        exception when others then
            -- Projektion darf den echten profiles-Schreibvorgang NIE
            -- blockieren (earn_xp, sync_player_data, purchase_* ...).
            raise warning 'project_player_data fehlgeschlagen für %: %', new.id, sqlerrm;
        end;
    end if;
    return new;
end;
$$;

-- Ebenfalls SECURITY DEFINER: der Trigger ruft sie über den Owner
-- auf, ein direkter Aufruf von aussen ist nicht nötig.
revoke all on function public.trg_project_player_data() from public, anon, authenticated;

drop trigger if exists project_player_data_trg on public.profiles;
create trigger project_player_data_trg
    after insert or update of player_data on public.profiles
    for each row execute function public.trg_project_player_data();


-- ============================================================
-- 5) BACKFILL  (idempotent · fehlertolerant je Profil)
--    Ein einzelnes kaputtes Profil bricht die Migration NICHT ab -
--    es wird übersprungen und als warning protokolliert.
-- ============================================================
do $$
declare
    r record;
    v_fail int := 0;
    v_ok   int := 0;
begin
    for r in select id, player_data from public.profiles loop
        begin
            perform public.project_player_data(r.id, r.player_data);
            v_ok := v_ok + 1;
        exception when others then
            v_fail := v_fail + 1;
            raise warning 'Backfill übersprang Profil %: %', r.id, sqlerrm;
        end;
    end loop;

    raise notice 'Backfill Profile: % ok, % übersprungen', v_ok, v_fail;

    -- game_variant / daily_creative / daily_task Claims aus den
    -- vorhandenen reward_cooldowns 'xpr_*'-Zeilen übernehmen.
    begin
        insert into public.player_reward_claims (user_id, claim_type, claim_key, claimed_at)
        select rc.user_id,
               case
                   when rc.reason like 'xpr\_malstube\_%'     escape '\' then 'daily_creative'
                   when rc.reason like 'xpr\_tagesaufgabe\_%' escape '\' then 'daily_task'
                   else 'game_variant'
               end,
               rc.reason,
               rc.last_claimed_at
        from public.reward_cooldowns rc
        where rc.reason like 'xpr\_%' escape '\'
        on conflict (user_id, claim_type, claim_key) do nothing;
    exception when others then
        raise warning 'reward_cooldowns -> player_reward_claims Backfill übersprungen: %', sqlerrm;
    end;
end $$;


-- ============================================================
-- 6) HÄRTUNG: anon von den auth-pflichtigen RPCs abziehen
--    Beide Funktionen beginnen mit 'if auth.uid() is null then raise' -
--    der anon-EXECUTE-Grant ist also funktionslos, wird aber von den
--    Supabase-Security-Advisors zu Recht als unnötige öffentliche RPC
--    angemeckert. NUR der Grant ändert sich:
--
--    * earn_coins(text): serverseitige Münzgutschriften gibt es nur
--      mit Konto (Gäste erspielen weiterhin lokale Münzen).
--    * claim_guest_progress(jsonb): die Übernahme eines Gastspielstands
--      passiert erst NACH der Anmeldung. Der FUNKTIONSKÖRPER und die
--      Übernahmelogik bleiben exakt wie in
--      supabase_migration_guest_progress_claim.sql - kein Gastfortschritt
--      wird verändert oder gelöscht.
-- ============================================================
revoke all on function public.earn_coins(text) from public, anon;
grant execute on function public.earn_coins(text) to authenticated;

revoke all on function public.claim_guest_progress(jsonb) from public, anon;
grant execute on function public.claim_guest_progress(jsonb) to authenticated;


-- ============================================================
-- 7) earn_xp() v3: Levelwerte + XP-Beträge aus den Config-Tabellen
--    lesen (statt inline). Externer Vertrag (Parameter, JSON-Antwort,
--    JSON-Schreibpfad) BLEIBT identisch -> Client unverändert.
--    Gilt nur für angemeldete Nutzer; der lokale Gastmodus rechnet
--    weiterhin selbst aus JS/level-data.js (unverändert).
--    Zusätzlich: game_variant/daily-Claim in player_reward_claims
--    protokollieren (Durchsetzung bleibt vorerst reward_cooldowns).
-- ============================================================
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
    r_rule public.game_xp_rules%rowtype;
    v_diff text;
    base_xp int;
    v_round text;
    dedup_key text;
    dedup_cooldown int;
    claim_type_val text;

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

    -- --- Regel + XP-Betrag aus game_xp_rules ---
    select * into r_rule
    from public.game_xp_rules
    where activity = p_reason and active;

    if not found then
        raise exception 'Unbekannter XP-Grund: %', p_reason;
    end if;

    base_xp := case v_diff
        when 'leicht' then r_rule.xp_leicht
        when 'schwer' then r_rule.xp_schwer
        else r_rule.xp_normal
    end;
    if base_xp is null then
        base_xp := r_rule.xp_normal;  -- Schwierigkeit für diese Aktivität nicht angeboten
    end if;

    today := ((now() at time zone 'Europe/Berlin')::date)::text;

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

    passthrough := jsonb_build_object(
        'xp', current_xp, 'level', current_level,
        'unlockedFeatures', unlocked_features,
        'claimedLevelRewards', claimed_rewards,
        'grantedRewards', '[]'::jsonb, 'storyEvent', null,
        'coins', coins, 'totalCoinsEarned', total_coins, 'goldenFeathers', golden,
        'consumables', consumables, 'ownedFurniture', owned_furniture,
        'dayDate', today, 'dayXp', day_xp
    );

    -- --- 1) Tageslimit ---
    remaining_today := day_cap - day_xp;
    if r_rule.counts_towards_daily_cap and remaining_today <= 0 then
        return passthrough || jsonb_build_object('capped', true, 'alreadyRewarded', false);
    end if;
    if not r_rule.counts_towards_daily_cap then
        remaining_today := base_xp;  -- nicht deckeln
    end if;

    -- --- 2) Wiederholungssperre ---
    if r_rule.repeat_rule = 'per_calendar_day' then
        dedup_key := 'xpr_' || p_reason || '_' || today;
        dedup_cooldown := 86400;
        claim_type_val := case when p_reason = 'malstube_bild_gespeichert' then 'daily_creative'
                               when p_reason = 'tagesaufgabe' then 'daily_task'
                               else 'daily_creative' end;
    elsif p_round_id is not null and btrim(p_round_id) <> '' then
        v_round := left(btrim(p_round_id), 120);
        dedup_key := 'xpr_' || p_reason || '_' || v_diff || '_' || v_round;
        dedup_cooldown := r_rule.cooldown_seconds;
        claim_type_val := 'game_variant';
    else
        dedup_key := 'xp_' || p_reason;
        dedup_cooldown := case r_rule.repeat_rule
            when 'per_reason_cooldown' then r_rule.cooldown_seconds
            else 4
        end;
        claim_type_val := 'game_variant';
    end if;

    insert into public.reward_cooldowns as rc (user_id, reason, last_claimed_at)
    values (auth.uid(), dedup_key, now())
    on conflict (user_id, reason) do update
        set last_claimed_at = excluded.last_claimed_at
        where rc.last_claimed_at <= now() - (dedup_cooldown || ' seconds')::interval;

    if not found then
        return passthrough || jsonb_build_object('capped', false, 'alreadyRewarded', true);
    end if;

    -- --- 3) Gutschrift ---
    grant_xp := least(base_xp, remaining_today);
    day_xp := day_xp + (case when r_rule.counts_towards_daily_cap then grant_xp else 0 end);
    new_xp := current_xp + grant_xp;

    -- Level aus game_levels
    select max(level) into new_level from public.game_levels where total_xp <= new_xp;
    new_level := coalesce(new_level, 1);

    -- Belohnungen aus game_levels
    for level_row in
        select level, rewards, story_event
        from public.game_levels
        where level > current_level and level <= new_level
          and jsonb_array_length(rewards) > 0
        order by level asc
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
    -- ^ feuert project_player_data_trg -> Projektionstabellen aktuell

    -- Nachweis der belohnten Runde/Variante (Durchsetzung: reward_cooldowns)
    insert into public.player_reward_claims (user_id, claim_type, claim_key)
    values (auth.uid(), claim_type_val, dedup_key)
    on conflict (user_id, claim_type, claim_key) do nothing;

    return jsonb_build_object(
        'xp', new_xp, 'level', new_level,
        'unlockedFeatures', unlocked_features,
        'claimedLevelRewards', claimed_rewards,
        'grantedRewards', granted, 'storyEvent', story_event,
        'coins', coins, 'totalCoinsEarned', total_coins, 'goldenFeathers', golden,
        'consumables', consumables, 'ownedFurniture', owned_furniture,
        'dayDate', today, 'dayXp', day_xp,
        'capped', (grant_xp < base_xp), 'alreadyRewarded', false
    );
end;
$$;

revoke all on function public.earn_xp(text, text, text) from public, anon;
grant execute on function public.earn_xp(text, text, text) to authenticated;


-- ============================================================
-- 8) SANITY-CHECK  (bricht die Transaktion ab, falls Config kaputt)
-- ============================================================
do $$
begin
    if (select count(*) from public.game_levels) < 20 then
        raise exception 'game_levels unvollständig (% Zeilen) - Abbruch', (select count(*) from public.game_levels);
    end if;

    if (select count(*) from public.game_xp_rules) < 6 then
        raise exception 'game_xp_rules unvollständig (% Zeilen) - Abbruch', (select count(*) from public.game_xp_rules);
    end if;

    if not exists (select 1 from public.game_levels where level = 1 and total_xp = 0) then
        raise exception 'game_levels Stufe 1 muss total_xp = 0 haben - Abbruch';
    end if;

    if not exists (select 1 from public.game_levels where level = 3 and total_xp = 300) then
        raise exception 'game_levels Stufe 3 falsch - Abbruch';
    end if;

    -- XP-Grenzen müssen mit steigendem Level STRENG aufsteigen, sonst
    -- wird ein Level nie erreicht bzw. mehrdeutig (earn_xp nutzt
    -- "max(level) where total_xp <= new_xp").
    if exists (
        select 1 from (
            select total_xp, lag(total_xp) over (order by level) as prev_xp
            from public.game_levels
        ) s
        where prev_xp is not null and total_xp <= prev_xp
    ) then
        raise exception 'game_levels.total_xp nicht streng aufsteigend nach level - Abbruch';
    end if;

    -- Levelnummern lückenlos ab 1 (keine übersprungene Stufe).
    if exists (
        select 1 from (
            select level, row_number() over (order by level) as rn
            from public.game_levels
        ) s
        where level <> rn
    ) then
        raise exception 'game_levels Levelnummern nicht lückenlos ab 1 - Abbruch';
    end if;
end $$;

commit;

-- ============================================================
-- ROLLBACK (falls nötig, separat und in dieser Reihenfolge ausführen):
--
--   1) earn_xp() v2 zurückholen:
--      supabase_migration_progression_v2.sql erneut einspielen
--      (ersetzt earn_xp() wieder durch die Inline-Variante).
--
--   2) Trigger + Projektionsfunktion entfernen:
--      drop trigger if exists project_player_data_trg on public.profiles;
--      drop function if exists public.trg_project_player_data();
--      drop function if exists public.project_player_data(uuid, jsonb);
--
--   3) Projektionstabellen entfernen (enthalten nur abgeleitete Daten -
--      die Wahrheit steht weiter in profiles.player_data):
--      drop table if exists public.player_reward_claims;
--      drop table if exists public.player_inventory;
--      drop table if exists public.player_unlocks;
--      drop table if exists public.player_progression;
--      drop table if exists public.game_xp_rules;
--      drop table if exists public.game_levels;
--
--   4) (optional) anon-EXECUTE wieder erlauben:
--      grant execute on function public.earn_coins(text) to anon;
--      grant execute on function public.claim_guest_progress(jsonb) to anon;
--
--   Der Funktionskörper von claim_guest_progress() wurde NICHT
--   verändert - nur der (funktionslose) anon-Grant, siehe 4).
-- ============================================================
