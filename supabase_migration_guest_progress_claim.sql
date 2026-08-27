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
-- claim_guest_progress() erlaubt deshalb einmalig einen vollständigen
-- Datensatz vom Client, ist dafür aber streng gegen Missbrauch
-- abgesichert:
--   1) Nur auf einem wirklich leeren/frischen Account (kein "coins"-
--      Schlüssel in player_data) - kein Import in einen Account mit
--      bereits vorhandenem Fortschritt, kein Überschreiben eines
--      vorhandenen Cloud-Standes.
--   2) Nur EINMAL pro Account, für immer: guest_progress_claimed_at
--      wird beim ersten Erfolg gesetzt und danach für jeden weiteren
--      Aufruf geprüft - unabhängig davon, was in player_data steht
--      (robuster als sich nur auf "player_data ist leer" zu
--      verlassen, das könnte sich sonst durch unglückliche
--      Gastdaten-Formen umgehen lassen).
--   3) Eine grosszügige, aber endliche Plausibilitätsgrenze für
--      Münzen (siehe max_claimable_coins) - kein Schutz gegen jeden
--      erdenklichen Missbrauch, aber eine günstige zusätzliche
--      Bremse gegen offensichtlich manipulierte Werte, ähnlich der
--      "erste Synchronisierung"-Vertrauensentscheidung, die
--      sync_player_data()/earn_coins() für brandneue Accounts
--      ohnehin schon treffen.
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
    -- Grosszügig genug für einen Spieler, der wirklich lange als Gast
    -- gespielt hat, aber endlich - verhindert den offensichtlichsten
    -- Missbrauch (lokal auf eine riesige Zahl gesetzte Gast-Münzen vor
    -- der Registrierung).
    max_claimable_coins constant numeric := 5000;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select player_data, guest_progress_claimed_at
    into current_data, current_claimed_at
    from public.profiles
    where id = auth.uid()
    for update;

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

    update public.profiles
    set player_data = guest_data,
        guest_progress_claimed_at = now(),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object('claimed', true);
end;
$$;

revoke all on function public.claim_guest_progress(jsonb) from public;
grant execute on function public.claim_guest_progress(jsonb) to authenticated;
