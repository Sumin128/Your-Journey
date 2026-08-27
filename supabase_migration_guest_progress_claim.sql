-- ============================================================
-- Your Journey – Migration: einmalige Gastfortschritt-Übernahme
-- (2026-08-28)
-- ============================================================
-- Eigenständige, idempotente Migration NUR für die neue,
-- bewusste "Gastfortschritt übernehmen?"-Funktion bei der
-- Registrierung.
--
-- Fasst nur an:
--   - eine neue Spalte public.profiles.guest_progress_claimed_at
--   - die neue Funktion public.claim_guest_progress(jsonb)
--   - deren EXECUTE-Rechte
--
-- Fasst NICHT an: alle anderen Spalten/Policies/Funktionen aus
-- supabase_schema.sql bzw. supabase_migration_security_player_data.sql
-- (sync_player_data, earn_coins, purchase_item, use_consumable_item
-- bleiben unverändert - siehe dortige Kommentare, warum diese
-- Funktionen bewusst NICHT für einen Massen-Import von Gastdaten
-- geeignet/gedacht sind).
--
-- Kann gefahrlos mehrfach ausgeführt werden.
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen kompletten Inhalt einfügen -> "Run". Setzt voraus, dass
-- supabase_migration_security_player_data.sql (sync_player_data() +
-- die UPDATE-Policy-Sperre) bereits ausgeführt wurde.
-- ============================================================


-- ============================================================
-- WARUM eine eigene Funktion statt sync_player_data():
-- sync_player_data() lässt coins/totalCoinsEarned/goldenFeathers/
-- items/consumables absichtlich NICHT vom Client verändern (siehe
-- supabase_migration_security_player_data.sql) - genau diese Felder
-- enthält aber ein zu übernehmender Gast-Spielstand. Ein Massen-
-- Import über sync_player_data() würde entweder blockiert (die
-- "wertvollen" Felder werden dort immer mit dem Server-Wert
-- überschrieben) oder - falls man das aufweichen würde - genau die
-- gerade erst geschlossene Sicherheitslücke wieder öffnen (beliebiger
-- Coins-Wert vom Client).
--
-- claim_guest_progress() übernimmt deshalb NICHT den kompletten
-- Client-Datensatz blind, sondern baut die wertvollen Felder aus
-- guest_data neu und geprüft zusammen (siehe Funktionskörper); nur
-- unkritische Felder (Name, Avatar, Erfolge, besuchte Tiere, ...)
-- werden unverändert aus guest_data übernommen. Zusätzlich streng
-- gegen Missbrauch abgesichert:
--   1) guest_data muss ein echtes JSON-Objekt sein.
--   2) Nur auf einem wirklich leeren/frischen Account (kein "coins"-
--      Schlüssel in player_data) - kein Import in einen Account mit
--      bereits vorhandenem Fortschritt, kein Überschreiben eines
--      vorhandenen Cloud-Standes. Die profiles-Zeile muss dafür
--      tatsächlich existieren (sonst Fehler statt scheinbarem
--      Erfolg).
--   3) Nur EINMAL pro Account, für immer: guest_progress_claimed_at
--      wird beim ersten Erfolg gesetzt und danach für jeden weiteren
--      Aufruf geprüft - unabhängig davon, was in player_data steht
--      (robuster als sich nur auf "player_data ist leer" zu
--      verlassen, das könnte sich sonst durch unglückliche
--      Gastdaten-Formen umgehen lassen).
--   4) coins/totalCoinsEarned: grosszügige, aber endliche
--      Plausibilitätsgrenze (max_claimable_coins) - kein Schutz gegen
--      jeden erdenklichen Missbrauch, aber eine günstige zusätzliche
--      Bremse gegen offensichtlich manipulierte Werte, ähnlich der
--      "erste Synchronisierung"-Vertrauensentscheidung, die
--      sync_player_data()/earn_coins() für brandneue Accounts
--      ohnehin schon treffen.
--   5) goldenFeathers wird NIE vom Client übernommen, sondern hier
--      genau wie in earn_coins() aus totalCoinsEarned berechnet.
--   6) items: nur bekannte Cursor-Item-Schlüssel (dieselbe Liste wie
--      player.items in JS/player.js), jeweils nur als echter
--      Boolean-Wert - jeder unbekannte oder falsch typisierte
--      Schlüssel wird ignoriert bzw. als false übernommen.
--   7) consumables: Verbrauchsitems existieren im Spiel noch gar
--      nicht (siehe use_consumable_item() in
--      supabase_migration_security_player_data.sql - vorbereitet,
--      aber noch nicht verdrahtet) - deshalb hier bewusst nicht vom
--      Client übernommen, sondern immer leer gesetzt. Sobald es
--      echte Verbrauchsitems gibt, kann das analog zu items() um
--      eine Whitelist mit Maximalmengen erweitert werden.
-- ============================================================

alter table public.profiles
    add column if not exists guest_progress_claimed_at timestamptz;

create or replace function public.claim_guest_progress(guest_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_data jsonb;
    current_claimed_at timestamptz;
    guest_coins numeric;
    guest_total numeric;
    computed_golden_feathers numeric;
    sanitized_items jsonb := '{}'::jsonb;
    sanitized_data jsonb;
    item_key text;
    -- Dieselbe Liste wie player.items in JS/player.js - nur diese
    -- Schlüssel duerfen ueberhaupt in items landen, alles andere vom
    -- Client wird ignoriert.
    allowed_item_keys constant text[] := array[
        'foxCursor', 'bearCursor', 'unicornCursor', 'kuroCursor',
        'hasenCursor', 'goldenFeatherCursor', 'blackGoldenFeatherCursor',
        'luisCursor'
    ];
    -- Grosszügig genug für einen Spieler, der wirklich lange als Gast
    -- gespielt hat, aber endlich - verhindert den offensichtlichsten
    -- Missbrauch (lokal auf eine riesige Zahl gesetzte Gast-Münzen vor
    -- der Registrierung).
    max_claimable_coins constant numeric := 5000;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    if guest_data is null or jsonb_typeof(guest_data) is distinct from 'object' then
        raise exception 'guest_data muss ein JSON-Objekt sein';
    end if;

    select player_data, guest_progress_claimed_at
    into current_data, current_claimed_at
    from public.profiles
    where id = auth.uid()
    for update;

    if not found then
        raise exception 'Profil nicht gefunden';
    end if;

    if current_claimed_at is not null then
        raise exception 'Gastfortschritt wurde für dieses Konto bereits übernommen';
    end if;

    if current_data is null then
        current_data := '{}'::jsonb;
    end if;

    -- Dieselbe Definition von "frisch/leer", die auch
    -- sync_player_data()/earn_coins() für die Erstsynchronisierung
    -- nutzen (kein "coins"-Schlüssel) - ein Account mit bereits
    -- eigenem Fortschritt bekommt hier keinen Gast-Import mehr.
    if current_data ? 'coins' then
        raise exception 'Dieser Account hat bereits eigenen Fortschritt - Gastfortschritt kann nicht mehr übernommen werden';
    end if;

    -- ---- coins / totalCoinsEarned: geprüft und begrenzt ----

    guest_coins := coalesce(
        (guest_data->>'coins')::numeric,
        (guest_data->>'feathers')::numeric,
        0
    );
    guest_total := coalesce(
        (guest_data->>'totalCoinsEarned')::numeric,
        (guest_data->>'totalFeathersEarned')::numeric,
        guest_coins
    );

    if guest_coins < 0 or guest_total < 0 then
        raise exception 'Ungültige Münzen im Gast-Spielstand';
    end if;

    if guest_coins > max_claimable_coins or guest_total > max_claimable_coins then
        raise exception 'Gast-Spielstand enthält unplausibel viele Münzen (max %)', max_claimable_coins;
    end if;

    -- ---- goldenFeathers: nie vom Client, immer serverseitig berechnet ----

    computed_golden_feathers := floor(guest_total / 100);

    -- ---- items: nur bekannte Schlüssel, nur echte Booleans ----

    foreach item_key in array allowed_item_keys loop

        if jsonb_typeof(guest_data->'items'->item_key) = 'boolean' then
            sanitized_items := sanitized_items || jsonb_build_object(item_key, guest_data->'items'->item_key);
        else
            sanitized_items := sanitized_items || jsonb_build_object(item_key, false);
        end if;

    end loop;

    -- ---- Zusammensetzen: unkritische Felder aus guest_data
    -- übernehmen (alte Federn-Schlüssel entfernt), wertvolle Felder
    -- werden mit den oben geprüften/berechneten Werten überschrieben -
    -- consumables bewusst immer leer (siehe Kommentar oben). ----

    sanitized_data := (guest_data - 'feathers' - 'totalFeathersEarned') || jsonb_build_object(
        'coins', guest_coins,
        'totalCoinsEarned', guest_total,
        'goldenFeathers', computed_golden_feathers,
        'items', sanitized_items,
        'consumables', '{}'::jsonb
    );

    update public.profiles
    set player_data = sanitized_data,
        guest_progress_claimed_at = now(),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object('claimed', true);
end;
$$;

revoke all on function public.claim_guest_progress(jsonb) from public;
grant execute on function public.claim_guest_progress(jsonb) to authenticated;
