-- ============================================================
-- Your Journey – Migration: Schloss-Stile + Starterpaket
-- (2026-09-09) – AUSGEFÜHRT am 2026-09-09
--   Supabase-Migrationen:
--     20260909064247  schloss_styles_starterpaket
--     20260909064544  player_reward_claims_allow_castle_starter  (Abschnitt 0 unten)
-- ============================================================
-- Baut auf:
--   supabase_migration_security_player_data.sql   (profiles, sync_player_data, ...)
--   supabase_migration_schloss.sql                (Schloss-Datenmodell)
--   supabase_migration_schloss_shop.sql           (schloss_furniture, purchase_schloss_furniture)
--   supabase_migration_progression_v3_tables.sql  (game_levels, player_unlocks, project_player_data, ...)
--
-- Fasst an:
--   1. NEU  public.schloss_styles            – NUR serverseitig lesbarer Stil-Katalog
--   2. NEU  public.schloss_starter_furniture – gepflegte Starter-Möbelliste je Stil
--        (NUR serverseitig lesbar), mit Foreign Keys auf schloss_styles + schloss_furniture.
--   3. ERSETZT public.sync_player_data(jsonb) – schützt schloss.ownedStyles +
--        schloss.starterSetupCompleted zusätzlich zu ownedFurniture/unlockedRooms
--        und erzwingt, dass schloss.style ein besessener Stil ist.
--   4. ERSETZT public.project_player_data(uuid, jsonb) – spiegelt schloss.ownedStyles
--        additiv in public.player_unlocks (feature = 'castle_style:<key>').
--   5. NEU  public.claim_castle_starter_setup(text)   – einmalige Stilwahl + genau
--        zwei passende Gratis-Möbel, idempotent, prüft die Schlossfreischaltung
--        serverseitig, bricht ohne zwei garantierte Geschenke komplett ab.
--   6. NEU  public.purchase_schloss_style(text)       – späterer Münzkauf weiterer
--        Stile (Level/Preis/Besitz serverseitig geprüft). Aktuell nicht nutzbar,
--        solange kein Stil einen coin_price hat (bewusst).
--
-- KEINE Änderung an: purchase_schloss_furniture, earn_xp, earn_coins,
--   claim_guest_progress, purchase_item, use_consumable_item.
--
-- Grundsatz „echte Stil-Wahl": ownedStyles enthält NICHT automatisch 'wald'.
--   Der beim Starter gewählte Stil ist der einzige Besitzstil. Wald ist nur
--   noch technischer Fallback für kaputte/fehlende Daten, kein Geschenk.
--
-- Robustheit: alle neuen RPCs/Backfill prüfen jsonb-Typ vor jedem Cast
--   (Maßstab: die Guards in project_player_data). Kaputte Alt-Werte
--   blockieren weder Trigger noch Migration.
--
-- Idempotent – kann mehrfach ausgeführt werden.
-- Anleitung: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- ============================================================


-- ============================================================
-- 0) player_reward_claims: claim_type 'castle_starter' zulassen.
--    claim_castle_starter_setup() schreibt eine Audit-/Idempotenz-Zeile
--    (claim_type='castle_starter'); die bestehende CHECK-Constraint kannte
--    den Wert nicht -> der RPC schlug fuer jeden angemeldeten Spieler fehl.
--    (Als eigene Supabase-Migration nachgezogen; hier fuer Repo-Vollstaendigkeit.)
-- ============================================================
alter table public.player_reward_claims
    drop constraint if exists player_reward_claims_claim_type_check;
alter table public.player_reward_claims
    add constraint player_reward_claims_claim_type_check
    check (claim_type = any (array[
        'level_reward', 'daily_creative', 'daily_task', 'game_variant', 'castle_starter'
    ]));


-- ============================================================
-- 1) schloss_styles – NUR serverseitiger Stil-Katalog
--    (Whitelist für alle Stil-Funktionen. Der Client nutzt die
--     Spiegelliste SCHLOSS_STYLES in JS/schloss-data.js für die UI –
--     die Tabelle wird NICHT vom Client gelesen. Damit kann ein noch
--     nicht freigegebener Stil auch per direkter Katalogabfrage nicht
--     sichtbar werden.)
--
--    public_available = true  -> Stil darf öffentlich als Karte
--       erscheinen UND (mit gesetztem coin_price) gekauft werden.
--    coin_price = NULL        -> noch KEIN bewusst festgelegter Preis;
--       der Kauf ist damit serverseitig gesperrt.
--    starter_eligible = true  -> kommt für die kostenlose Erst-Stilwahl
--       in Frage (zusätzlich muss public_available true sein).
-- ============================================================
create table if not exists public.schloss_styles (
    style_key        text primary key,
    name             text not null,
    required_level   int  not null default 3 check (required_level >= 1),
    coin_price       int           check (coin_price is null or coin_price >= 0),
    starter_eligible boolean not null default false,
    public_available boolean not null default false,
    sort             int  not null default 100,
    updated_at       timestamptz not null default now()
);

-- Erst ALLE Standardrechte entziehen: kein Client (auch nicht authenticated)
-- darf lesen oder schreiben. Zugriff nur über die SECURITY-DEFINER-Funktionen
-- unten (laufen als Tabelleneigentümer, RLS/Grants gelten dort nicht).
revoke all on public.schloss_styles from public, anon, authenticated;
alter table public.schloss_styles enable row level security;
-- RLS aktiv + KEINE Policy => für jeden Client (anon/authenticated) gesperrt.
drop policy if exists "schloss_styles_read_all" on public.schloss_styles;

insert into public.schloss_styles
    (style_key, name, required_level, coin_price, starter_eligible, public_available, sort)
values
    -- Waldstil: fertig, Standard-Startwahl. Preis NULL.
    -- HINWEIS: Sobald ein Spieler beim Starter einen anderen Stil wählt,
    -- ist 'wald' NICHT mehr in ownedStyles. Damit 'wald' danach wieder
    -- erreichbar ist, braucht er beim Öffentlich-Schalten des zweiten
    -- Stils einen coin_price ODER einen kostenlosen Rückwechsel-Pfad
    -- (siehe Bericht, offener Punkt).
    ('wald',   'Waldschloss',   3, NULL, true,  true,  10),
    -- Wüstenstil: starter-fähig, aber NOCH NICHT public_available.
    -- Erst nach visueller Freigabe + Raumhülle-Integration + >= 2 aktiven
    -- Wüsten-Startermöbeln in schloss_starter_furniture auf true setzen
    -- und einen coin_price festlegen.
    ('wueste', 'Wüstenschloss', 3, NULL, true,  false, 20)
on conflict (style_key) do update set
    name             = excluded.name,
    required_level   = excluded.required_level,
    -- coin_price NUR setzen, wenn er noch NULL ist -> ein später bewusst
    -- vergebener Preis wird durch erneutes Ausführen dieser Migration
    -- nicht zurückgesetzt.
    coin_price       = coalesce(public.schloss_styles.coin_price, excluded.coin_price),
    starter_eligible = excluded.starter_eligible,
    sort             = excluded.sort,
    updated_at       = now();
-- public_available bewusst NICHT im do-update -> ein manuell freigegebener
-- Stil bleibt frei, auch wenn die Migration erneut läuft.


-- ============================================================
-- 2) schloss_starter_furniture – gepflegte Starterliste je Stil
--    NUR serverseitig gelesen (claim_castle_starter_setup). Der
--    Gast-Client nutzt die gespiegelte Liste STARTER_POOLS in
--    JS/schloss-data.js – beide von Hand synchron halten (wie
--    game_levels <-> MIRELON_LEVELS).
--    slot: 'seat' = Sitzmöbel, 'decor' = Einrichtungs-/Dekostück.
--    Es zählen nur IDs, die zusätzlich in schloss_furniture aktiv sind.
--    Diese Tabelle ist zugleich die „bewusst sichere, größere Liste"
--    aus der der Fallback zieht (slot-unabhängig).
-- ============================================================
create table if not exists public.schloss_starter_furniture (
    style_key    text not null,
    slot         text not null check (slot in ('seat', 'decor')),
    furniture_id text not null,
    sort         int  not null default 100,
    primary key (style_key, furniture_id)
);

-- Foreign Keys idempotent nachziehen (create table if not exists legt sie
-- bei einer bereits existierenden Tabelle sonst nicht an).
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'schloss_starter_furniture_style_fk'
    ) then
        alter table public.schloss_starter_furniture
            add constraint schloss_starter_furniture_style_fk
            foreign key (style_key) references public.schloss_styles (style_key)
            on update cascade on delete cascade;
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'schloss_starter_furniture_furniture_fk'
    ) then
        -- restrict: ein Möbelstück, das als Startermöbel gelistet ist, kann
        -- nicht versehentlich aus schloss_furniture gelöscht werden, ohne
        -- es vorher hier auszutragen.
        alter table public.schloss_starter_furniture
            add constraint schloss_starter_furniture_furniture_fk
            foreign key (furniture_id) references public.schloss_furniture (id)
            on update cascade on delete restrict;
    end if;
end $$;

-- Kein Client-Recht, keine Policy: die Tabelle ist ausschließlich
-- serverseitig (SECURITY DEFINER) lesbar.
revoke all on public.schloss_starter_furniture from public, anon, authenticated;
alter table public.schloss_starter_furniture enable row level security;

insert into public.schloss_starter_furniture (style_key, slot, furniture_id, sort) values
    -- Wald – nur vorhandene, aktive Boden-/Deko-IDs, keine Wanddeko,
    -- keine Vorhänge, keine Sonderlicht-Möbel, NICHT die Level-3-
    -- Startpaket-IDs (stuhl/tisch/teppich_wald_a) – die besitzt ein
    -- frisch freigeschalteter Spieler bereits.
    ('wald', 'seat',  'hocker_wald_a',        10),
    ('wald', 'seat',  'baenkchen_wald_a',     20),
    ('wald', 'decor', 'beistelltisch_wald_a', 10),
    ('wald', 'decor', 'pflanze_wald_a',       20),
    ('wald', 'decor', 'truhe_wald_a',         30),
    ('wald', 'decor', 'teppich_rund_wald_a',  40),
    ('wald', 'decor', 'blumenkasten_wald_a',  50)
    -- Wüste: absichtlich LEER, bis die Wüsten-Startermöbel existieren.
    -- Dann hier ergänzen, z. B.:
    --   ('wueste','seat','wuesten_kissen_a',10),
    --   ('wueste','decor','wuesten_beistelltisch_a',10),
    --   ('wueste','decor','oasen_pflanze_a',20),
    --   ('wueste','decor','wuesten_mosaikteppich_a',30)
on conflict (style_key, furniture_id) do update set
    slot = excluded.slot,
    sort = excluded.sort;


-- ============================================================
-- 3) sync_player_data(): schützt zusätzlich schloss.ownedStyles +
--    schloss.starterSetupCompleted (Client darf beides NIE selbst
--    bestimmen) und erzwingt schloss.style ∈ ownedStyles.
--    ownedStyles wird NICHT auf ['wald'] gezwungen: fehlt es, wird es
--    aus dem zuletzt gespeicherten style abgeleitet. 'wald' erscheint
--    nur, wenn gar kein gültiger style vorhanden ist (kaputte Daten).
--    Alles andere unverändert gegenüber dem aktuellen Stand.
-- ============================================================
create or replace function public.sync_player_data(new_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    old_data jsonb; old_achievement_count int; new_achievement_count int;
    max_new_achievements constant int := 10;
    protected_keys constant text[] := array['coins', 'totalCoinsEarned', 'goldenFeathers', 'items', 'consumables', 'progression'];
    protected_key text; owned_furniture jsonb; custom_key text;
    old_owned_styles jsonb; old_style text; styles_fallback jsonb;
    owned_styles jsonb; current_style text;
begin
    if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
    select player_data into old_data from public.profiles where id = auth.uid() for update;
    if old_data is null then old_data := '{}'::jsonb; end if;

    foreach protected_key in array protected_keys loop
        if old_data ? protected_key then
            new_data := jsonb_set(new_data, array[protected_key], old_data->protected_key, true);
        else new_data := new_data - protected_key;
        end if;
    end loop;

    -- Wirtschaftlich wertvolle schloss-Unterfelder gezielt auf den zuletzt
    -- serverseitig bestätigten Stand zurücksetzen, egal was der Client sendet.
    new_data := jsonb_set(new_data, '{schloss,ownedFurniture}',
        coalesce(old_data #> '{schloss,ownedFurniture}', '[]'::jsonb), true);
    new_data := jsonb_set(new_data, '{schloss,unlockedRooms}',
        coalesce(old_data #> '{schloss,unlockedRooms}', '["wohnzimmer"]'::jsonb), true);

    -- ownedStyles: gespeicherten Stand übernehmen. Fehlt/kaputt -> aus dem
    -- gespeicherten style ableiten, sonst (nur dann) technischer 'wald'.
    -- Reine Gleichheitsvergleiche statt jsonb_array_length(): letzteres wirft
    -- bei Nicht-Arrays, und SQL garantiert kein Short-Circuit fuer das AND.
    if jsonb_typeof(old_data #> '{schloss,ownedStyles}') = 'array'
       and (old_data #> '{schloss,ownedStyles}') <> '[]'::jsonb then
        old_owned_styles := old_data #> '{schloss,ownedStyles}';
    else
        old_owned_styles := null;
    end if;
    if old_owned_styles is null then
        old_style := case when jsonb_typeof(old_data #> '{schloss,style}') = 'string'
                          then old_data #>> '{schloss,style}' end;
        styles_fallback := jsonb_build_array(coalesce(nullif(old_style, ''), 'wald'));
    else
        styles_fallback := old_owned_styles;
    end if;
    new_data := jsonb_set(new_data, '{schloss,ownedStyles}', styles_fallback, true);

    new_data := jsonb_set(new_data, '{schloss,starterSetupCompleted}',
        coalesce(
            case when (old_data #> '{schloss,starterSetupCompleted}') = 'true'::jsonb
                 then 'true'::jsonb
                 when (old_data #> '{schloss,starterSetupCompleted}') = 'false'::jsonb
                 then 'false'::jsonb end,
            'false'::jsonb),
        true);

    -- schloss.style darf der Client frei zwischen BESESSENEN Stilen wechseln
    -- (offline-tauglich, kostenlos). Ein nicht besessener/kaputter Stil wird
    -- auf den ersten besessenen zurückgesetzt.
    owned_styles  := new_data #> '{schloss,ownedStyles}';
    current_style := case when jsonb_typeof(new_data #> '{schloss,style}') = 'string'
                          then new_data #>> '{schloss,style}' end;
    if current_style is null or not (owned_styles ? current_style) then
        new_data := jsonb_set(new_data, '{schloss,style}',
            coalesce(owned_styles -> 0, '"wald"'::jsonb), true);
    end if;

    -- Verteidigung in der Tiefe: customFurniture ohne besessene Basis entfernen.
    owned_furniture := new_data #> '{schloss,ownedFurniture}';
    if new_data #> '{schloss,customFurniture}' is not null then
        for custom_key in select jsonb_object_keys(new_data #> '{schloss,customFurniture}') loop
            if not (owned_furniture ? (new_data #>> array['schloss', 'customFurniture', custom_key, 'baseFurnitureId'])) then
                new_data := new_data #- array['schloss', 'customFurniture', custom_key];
            end if;
        end loop;
    end if;

    old_achievement_count := coalesce(jsonb_array_length(old_data->'achievements'), 0);
    new_achievement_count := coalesce(jsonb_array_length(new_data->'achievements'), 0);
    if new_achievement_count < old_achievement_count then raise exception 'Erfolge dürfen nicht entfernt werden'; end if;
    if new_achievement_count > old_achievement_count + max_new_achievements then
        raise exception 'Zu viele neue Erfolge auf einmal (max % pro Sync)', max_new_achievements; end if;

    update public.profiles set player_data = new_data, updated_at = now() where id = auth.uid();
end; $$;

revoke all on function public.sync_player_data(jsonb) from public, anon;
grant execute on function public.sync_player_data(jsonb) to authenticated;


-- ============================================================
-- 4) project_player_data(): spiegelt zusätzlich schloss.ownedStyles
--    additiv nach player_unlocks (feature = 'castle_style:<key>').
--    Rest unverändert. Wird vom profiles-Trigger bei jedem
--    player_data-Wechsel aufgerufen; Fehler blockieren den echten
--    Schreibvorgang nie (siehe trg_project_player_data).
-- ============================================================
create or replace function public.project_player_data(p_user uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_data jsonb := case when jsonb_typeof(p_data) = 'object' then p_data else '{}'::jsonb end;
    v_prog jsonb; v_consumables jsonb; v_features jsonb; v_claimed jsonb; v_styles jsonb;
    v_known_consumables constant text[] := array['feuerwerk','konfetti'];
    v_xp bigint; v_level int; v_day_date date; v_day_xp int;
    v_feat text; v_kv record; v_lvl text; v_style text;
begin
    v_prog := case when jsonb_typeof(v_data->'progression') = 'object' then v_data->'progression' else '{}'::jsonb end;
    v_consumables := case when jsonb_typeof(v_data->'consumables') = 'object' then v_data->'consumables' else '{}'::jsonb end;
    v_features := case when jsonb_typeof(v_prog->'unlockedFeatures') = 'array' then v_prog->'unlockedFeatures' else '[]'::jsonb end;
    v_claimed  := case when jsonb_typeof(v_prog->'claimedLevelRewards') = 'array' then v_prog->'claimedLevelRewards' else '[]'::jsonb end;
    v_styles   := case when jsonb_typeof(v_data #> '{schloss,ownedStyles}') = 'array' then v_data #> '{schloss,ownedStyles}' else '[]'::jsonb end;

    v_xp := greatest(0, floor(coalesce(
        (case when (v_prog->>'xp') ~ '^-?\d+(\.\d+)?$' then (v_prog->>'xp')::numeric end), 0)))::bigint;
    v_level := greatest(1, least(999, coalesce(
        (case when (v_prog->>'level') ~ '^\d+$' then (v_prog->>'level')::int end), 1)));
    begin
        v_day_date := case when (v_prog->>'dayDate') ~ '^\d{4}-\d{2}-\d{2}$' then (v_prog->>'dayDate')::date end;
    exception when others then v_day_date := null;
    end;
    v_day_xp := greatest(0, coalesce(
        (case when (v_prog->>'dayXp') ~ '^-?\d+(\.\d+)?$' then floor((v_prog->>'dayXp')::numeric)::int end), 0));

    insert into public.player_progression (user_id, total_xp, level, day_date, day_xp, updated_at)
    values (p_user, v_xp, v_level::smallint, v_day_date, v_day_xp, now())
    on conflict (user_id) do update set
        total_xp = excluded.total_xp, level = excluded.level,
        day_date = excluded.day_date, day_xp = excluded.day_xp, updated_at = now();

    -- player_unlocks: Features (dauerhaft, nur hinzufügen)
    for v_feat in select value from jsonb_array_elements_text(v_features) loop
        if v_feat is not null and btrim(v_feat) <> '' then
            insert into public.player_unlocks (user_id, feature) values (p_user, v_feat)
            on conflict (user_id, feature) do nothing;
        end if;
    end loop;

    -- player_unlocks: besessene Schloss-Stile (dauerhaft, nur hinzufügen),
    -- Namensraum 'castle_style:' -> generische Freischaltung, keine neue Tabelle.
    for v_style in select value from jsonb_array_elements_text(v_styles) loop
        if v_style is not null and btrim(v_style) <> '' then
            insert into public.player_unlocks (user_id, feature)
            values (p_user, 'castle_style:' || v_style)
            on conflict (user_id, feature) do nothing;
        end if;
    end loop;

    for v_kv in select key, value from jsonb_each_text(v_consumables) loop
        insert into public.player_inventory (user_id, item_key, quantity, updated_at)
        values (p_user, v_kv.key,
            greatest(0, floor(coalesce(
                (case when v_kv.value ~ '^-?\d+(\.\d+)?$' then v_kv.value::numeric end), 0)))::int, now())
        on conflict (user_id, item_key) do update set
            quantity = excluded.quantity, updated_at = now();
    end loop;

    update public.player_inventory set quantity = 0, updated_at = now()
    where user_id = p_user and item_key = any (v_known_consumables)
      and not (v_consumables ? item_key) and quantity <> 0;

    for v_lvl in select value from jsonb_array_elements_text(v_claimed) loop
        if v_lvl ~ '^\d+$' then
            insert into public.player_reward_claims (user_id, claim_type, claim_key)
            values (p_user, 'level_reward', v_lvl)
            on conflict (user_id, claim_type, claim_key) do nothing;
        end if;
    end loop;
end; $$;


-- ============================================================
-- 5) claim_castle_starter_setup(p_style_key): EINMALIGE kostenlose
--    Erst-Stilwahl + genau zwei passende Gratis-Möbel.
--    - nur authentifiziert
--    - Profilzeile transaktional gesperrt
--    - Schlossfreischaltung SERVERSEITIG geprüft (Level >= 3 UND
--      progression.unlockedFeatures / player_unlocks enthält 'castle')
--    - läuft nur, solange schloss.starterSetupCompleted noch false ist
--    - Stil nur aus schloss_styles (starter_eligible AND public_available)
--    - ownedStyles = GENAU [p_style_key] (echte Wahl, kein Auto-Wald)
--    - Möbel AUSSCHLIESSLICH serverseitig aus schloss_starter_furniture,
--      gefiltert auf schloss_furniture.active, ohne Duplikat, ohne
--      bereits besessene; ein Sitz + ein Deko, dann slot-unabhängiger
--      Fallback aus derselben Liste.
--    - Sind KEINE zwei verschiedenen unbesessenen Möbel ermittelbar:
--      RAISE EXCEPTION -> komplette Transaktion zurück, starterSetup
--      bleibt false, KEINE Teilbelohnung.
--    - style / ownedStyles / ownedFurniture / starterSetupCompleted atomar.
--    - erneuter Aufruf: kein neuer Stil, keine neuen Möbel.
--    - keine Client-Möbel-IDs, keine Münzen, kein XP.
-- ============================================================
create or replace function public.claim_castle_starter_setup(p_style_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_data jsonb;
    already_done boolean;
    style_ok boolean;
    owned_styles jsonb;
    owned_furniture jsonb;
    v_level int;
    v_feats jsonb;
    v_castle_ok boolean;
    gift_seat text;
    gift_decor text;
    gifts jsonb := '[]'::jsonb;
    new_owned jsonb;
    v_id text;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select player_data into current_data
    from public.profiles
    where id = auth.uid()
    for update;

    if current_data is null then current_data := '{}'::jsonb; end if;

    -- --- robuste Auswertung der vorhandenen Werte ---
    owned_styles := case
        when jsonb_typeof(current_data #> '{schloss,ownedStyles}') = 'array'
        then current_data #> '{schloss,ownedStyles}' else '[]'::jsonb end;
    owned_furniture := case
        when jsonb_typeof(current_data #> '{schloss,ownedFurniture}') = 'array'
        then current_data #> '{schloss,ownedFurniture}' else '[]'::jsonb end;
    -- starterSetupCompleted-Flag ODER Audit-Zeile: beides zählt als „schon
    -- abgeschlossen" (die Audit-Zeile überlebt eine Flag-Beschädigung im JSON).
    already_done := coalesce((current_data #> '{schloss,starterSetupCompleted}') = 'true'::jsonb, false)
        or exists (
            select 1 from public.player_reward_claims
            where user_id = auth.uid()
              and claim_type = 'castle_starter' and claim_key = 'setup'
        );

    -- Idempotent: schon abgeschlossen -> nichts vergeben, aktuellen Stand melden.
    if already_done then
        return jsonb_build_object(
            'alreadyCompleted', true,
            'style', current_data #>> '{schloss,style}',
            'ownedStyles', owned_styles,
            'ownedFurniture', owned_furniture,
            'gifts', '[]'::jsonb
        );
    end if;

    -- --- Schlossfreischaltung serverseitig bestätigen (Client-Check reicht nicht) ---
    v_level := case when (current_data #>> '{progression,level}') ~ '^\d+$'
                    then (current_data #>> '{progression,level}')::int else 1 end;
    v_feats := current_data #> '{progression,unlockedFeatures}';
    v_castle_ok := (coalesce(jsonb_typeof(v_feats), '') = 'array'
                        and coalesce(v_feats ? 'castle', false))
                or exists (
                    select 1 from public.player_unlocks
                    where user_id = auth.uid() and feature = 'castle'
                );
    -- Level >= Schlossstufe (3) UND bestätigte Freischaltung.
    if v_level < 3 or not coalesce(v_castle_ok, false) then
        raise exception 'Schloss ist noch nicht freigeschaltet';
    end if;

    -- Stil-Whitelist: nur starter-fähige UND öffentlich freigegebene Stile.
    select true into style_ok
    from public.schloss_styles
    where style_key = p_style_key and starter_eligible and public_available;

    if not coalesce(style_ok, false) then
        raise exception 'Stil nicht für die Erstwahl verfügbar: %', p_style_key;
    end if;

    -- --- Zwei Geschenke serverseitig wählen ---
    -- 1) Sitzmöbel aus dem Stil-Pool, aktiv, noch nicht besessen.
    select furniture_id into gift_seat
    from public.schloss_starter_furniture sf
    join public.schloss_furniture f on f.id = sf.furniture_id and f.active
    where sf.style_key = p_style_key and sf.slot = 'seat'
      and not (owned_furniture ? sf.furniture_id)
    order by random()
    limit 1;

    -- 2) Dekostück, aktiv, noch nicht besessen, != gift_seat.
    select furniture_id into gift_decor
    from public.schloss_starter_furniture sf
    join public.schloss_furniture f on f.id = sf.furniture_id and f.active
    where sf.style_key = p_style_key and sf.slot = 'decor'
      and not (owned_furniture ? sf.furniture_id)
      and sf.furniture_id is distinct from gift_seat
    order by random()
    limit 1;

    -- Fallback: fehlt ein Slot, aus der GESAMTEN Stil-Liste (slot-unabhängig,
    -- alles hier ist bewusst sicheres Bodenmobiliar) nachziehen – ohne Duplikat.
    if gift_seat is null then
        select furniture_id into gift_seat
        from public.schloss_starter_furniture sf
        join public.schloss_furniture f on f.id = sf.furniture_id and f.active
        where sf.style_key = p_style_key
          and not (owned_furniture ? sf.furniture_id)
          and sf.furniture_id is distinct from gift_decor
        order by random() limit 1;
    end if;
    if gift_decor is null then
        select furniture_id into gift_decor
        from public.schloss_starter_furniture sf
        join public.schloss_furniture f on f.id = sf.furniture_id and f.active
        where sf.style_key = p_style_key
          and not (owned_furniture ? sf.furniture_id)
          and sf.furniture_id is distinct from gift_seat
        order by random() limit 1;
    end if;

    -- Garantie: ohne zwei verschiedene unbesessene Möbel wird NICHTS geschrieben.
    if gift_seat is null or gift_decor is null or gift_seat = gift_decor then
        raise exception 'Für den Stil % sind keine zwei freien Startmöbel verfügbar', p_style_key;
    end if;

    -- --- ownedFurniture + gifts zusammensetzen (Duplikate ausgeschlossen) ---
    new_owned := owned_furniture;
    foreach v_id in array array[gift_seat, gift_decor] loop
        if not (new_owned ? v_id) then
            new_owned := new_owned || to_jsonb(v_id);
            gifts := gifts || to_jsonb(v_id);
        end if;
    end loop;

    -- --- ownedStyles: echte Wahl -> GENAU der gewählte Stil. Kein Auto-Wald. ---
    owned_styles := jsonb_build_array(p_style_key);

    -- --- Atomar speichern ---
    update public.profiles
    set player_data = current_data || jsonb_build_object(
            'schloss', coalesce(
                case when jsonb_typeof(current_data->'schloss') = 'object'
                     then current_data->'schloss' end, '{}'::jsonb) || jsonb_build_object(
                'style', p_style_key,
                'ownedStyles', owned_styles,
                'ownedFurniture', new_owned,
                'starterSetupCompleted', true
            )
        ),
        updated_at = now()
    where id = auth.uid();
    -- ^ feuert trg_project_player_data -> player_unlocks (castle_style:<key>)

    -- Audit / zusätzliche Idempotenz-Spur (Durchsetzung bleibt der Flag oben).
    insert into public.player_reward_claims (user_id, claim_type, claim_key)
    values (auth.uid(), 'castle_starter', 'setup')
    on conflict (user_id, claim_type, claim_key) do nothing;

    return jsonb_build_object(
        'alreadyCompleted', false,
        'style', p_style_key,
        'ownedStyles', owned_styles,
        'ownedFurniture', new_owned,
        'gifts', gifts
    );
end; $$;

revoke all on function public.claim_castle_starter_setup(text) from public, anon;
grant execute on function public.claim_castle_starter_setup(text) to authenticated;


-- ============================================================
-- 6) purchase_schloss_style(p_style_key): späterer Münzkauf weiterer
--    Stile. Serverseitig: Whitelist, public_available, coin_price
--    gesetzt, Level erreicht, nicht schon besessen, genug Münzen.
--    Zieht Münzen + ergänzt ownedStyles atomar; setzt style auf den
--    neuen Stil. Idempotent (schon besessen -> kein Abzug).
--    Kein Auto-Wald: der gekaufte Stil wird an die vorhandene (robust
--    ausgewertete) ownedStyles-Liste angehängt.
--
--    HINWEIS: solange KEIN Stil einen coin_price hat, wirft diese
--    Funktion für jeden Aufruf „Preis noch nicht festgelegt" – das ist
--    beabsichtigt (keine Fantasiepreise). Muster von purchase_item /
--    purchase_schloss_furniture übernommen.
-- ============================================================
create or replace function public.purchase_schloss_style(p_style_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    st record;
    current_data jsonb;
    current_coins numeric;
    current_level int;
    owned_styles jsonb;
    new_coins numeric;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select style_key, required_level, coin_price, public_available
    into st
    from public.schloss_styles
    where style_key = p_style_key;

    if st.style_key is null then
        raise exception 'Unbekannter Stil: %', p_style_key;
    end if;
    if not st.public_available then
        raise exception 'Stil noch nicht verfügbar: %', p_style_key;
    end if;
    if st.coin_price is null then
        raise exception 'Für % ist noch kein Preis festgelegt', p_style_key;
    end if;

    select player_data into current_data
    from public.profiles where id = auth.uid() for update;
    if current_data is null then current_data := '{}'::jsonb; end if;

    -- robuste Auswertung ( <> '[]'::jsonb statt jsonb_array_length: wirft nie )
    owned_styles := case
        when jsonb_typeof(current_data #> '{schloss,ownedStyles}') = 'array'
             and (current_data #> '{schloss,ownedStyles}') <> '[]'::jsonb
        then current_data #> '{schloss,ownedStyles}'
        else jsonb_build_array(coalesce(nullif(
            case when jsonb_typeof(current_data #> '{schloss,style}') = 'string'
                 then current_data #>> '{schloss,style}' end, ''), 'wald'))
    end;
    current_coins := case when (current_data->>'coins') ~ '^-?\d+(\.\d+)?$'
                          then (current_data->>'coins')::numeric else 0 end;
    current_level := case when (current_data #>> '{progression,level}') ~ '^\d+$'
                          then (current_data #>> '{progression,level}')::int else 1 end;

    -- Idempotent: schon besessen -> nur aktivieren, kein Abzug.
    if owned_styles ? p_style_key then
        update public.profiles
        set player_data = current_data || jsonb_build_object(
                'schloss', coalesce(
                    case when jsonb_typeof(current_data->'schloss') = 'object'
                         then current_data->'schloss' end, '{}'::jsonb)
                    || jsonb_build_object('style', p_style_key)),
            updated_at = now()
        where id = auth.uid();
        return jsonb_build_object('alreadyOwned', true, 'coins', current_coins,
            'ownedStyles', owned_styles, 'style', p_style_key);
    end if;

    if current_level < st.required_level then
        raise exception 'Stufe % nötig (du hast %)', st.required_level, current_level;
    end if;
    if current_coins < st.coin_price then
        raise exception 'Nicht genug Münzen (brauchst %, hast %)', st.coin_price, current_coins;
    end if;

    new_coins := current_coins - st.coin_price;
    owned_styles := owned_styles || to_jsonb(p_style_key);

    update public.profiles
    set player_data = current_data || jsonb_build_object(
            'coins', new_coins,
            'schloss', coalesce(
                case when jsonb_typeof(current_data->'schloss') = 'object'
                     then current_data->'schloss' end, '{}'::jsonb) || jsonb_build_object(
                'style', p_style_key,
                'ownedStyles', owned_styles
            )
        ),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object('alreadyOwned', false, 'coins', new_coins,
        'ownedStyles', owned_styles, 'style', p_style_key);
end; $$;

revoke all on function public.purchase_schloss_style(text) from public, anon;
grant execute on function public.purchase_schloss_style(text) to authenticated;


-- ============================================================
-- 7) Backfill: bestehende Profile bekommen die neuen schloss-Felder,
--    ohne Vorhandenes zu verändern.
--    - ownedStyles wird aus dem AKTUELL gespeicherten style abgeleitet
--      (kein zusätzliches 'wald'), nur bei komplett fehlendem/kaputtem
--      style greift der technische 'wald'-Fallback.
--    - starterSetupCompleted:
--        * frische Spieler (ownedFurniture leer / nur das Level-3-Paket)
--          -> false: sie sehen den Starterablauf genau einmal.
--        * Bestandsspieler mit bereits genutztem Schloss (irgendein Möbel
--          über das Level-3-Paket hinaus) -> true: sie brauchen den
--          "Dein Schloss erwacht"-Moment nicht und hätten sonst evtl.
--          keine zwei freien Startermöbel -> säßen am Stil-Screen fest.
--    - Robuste jsonb-Typprüfung ( <@ / = statt jsonb_array_length ):
--      kaputte Einzelprofile brechen den Lauf nicht ab.
-- ============================================================
update public.profiles
set player_data = jsonb_set(
        jsonb_set(
            player_data,
            '{schloss,ownedStyles}',
            case
                when jsonb_typeof(player_data #> '{schloss,ownedStyles}') = 'array'
                     and (player_data #> '{schloss,ownedStyles}') <> '[]'::jsonb
                then player_data #> '{schloss,ownedStyles}'
                else jsonb_build_array(coalesce(nullif(
                    case when jsonb_typeof(player_data #> '{schloss,style}') = 'string'
                         then player_data #>> '{schloss,style}' end, ''), 'wald'))
            end,
            true
        ),
        '{schloss,starterSetupCompleted}',
        case
            -- schon gesetzt -> unangetastet lassen
            when (player_data #> '{schloss,starterSetupCompleted}') in ('true'::jsonb, 'false'::jsonb)
                 then player_data #> '{schloss,starterSetupCompleted}'
            -- Schloss bereits in Benutzung (Möbel über das Level-3-Paket
            -- hinaus) -> Starter überspringen. <@ wirft nie (auch nicht bei
            -- Nicht-Arrays), kein jsonb_array_length nötig.
            when not (coalesce(player_data #> '{schloss,ownedFurniture}', '[]'::jsonb)
                      <@ '["stuhl_wald_a","tisch_wald_a","teppich_wald_a"]'::jsonb)
                 then 'true'::jsonb
            else 'false'::jsonb
        end,
        true
    ),
    updated_at = now()
where jsonb_typeof(player_data) = 'object'
  and jsonb_typeof(player_data->'schloss') = 'object'
  and (
        -- ownedStyles fehlt / ist kein Array / ist leer.
        -- Reine Gleichheitsvergleiche: jsonb_array_length() wuerde bei
        -- Nicht-Arrays werfen und SQL garantiert kein OR-Short-Circuit.
        jsonb_typeof(player_data #> '{schloss,ownedStyles}') is distinct from 'array'
        or (player_data #> '{schloss,ownedStyles}') = '[]'::jsonb
        -- ODER starterSetupCompleted fehlt / ist kein echtes Boolean
        or coalesce(player_data #> '{schloss,starterSetupCompleted}', 'null'::jsonb)
             not in ('true'::jsonb, 'false'::jsonb)
      );


-- ============================================================
-- Ende. Nach dem Ausführen prüfen:
--   select * from public.schloss_styles order by sort;                 -- (nur als DB-Owner)
--   select * from public.schloss_starter_furniture order by style_key, slot, sort;
--   select conname from pg_constraint
--     where conrelid = 'public.schloss_starter_furniture'::regclass;   -- 2 FKs + PK
--   select has_table_privilege('authenticated','public.schloss_styles','SELECT');  -- false
--   select has_table_privilege('authenticated','public.schloss_starter_furniture','SELECT'); -- false
--   select proname from pg_proc where proname in
--     ('claim_castle_starter_setup','purchase_schloss_style');
-- ============================================================
