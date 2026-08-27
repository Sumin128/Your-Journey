-- ============================================================
-- Your Journey – Security-Migration: profiles.player_data
-- (2026-08-27)
-- ============================================================
-- Eigenständige, idempotente Migration NUR für die
-- Sicherheitslücke bei profiles.player_data (Münzen/Erfolge/
-- Inventar liessen sich per direktem UPDATE - z. B. ueber die im
-- Browser ohnehin global verfuegbare supabaseClient-Instanz - auf
-- einen beliebigen Wert setzen, ohne jede Pruefung).
--
-- Fasst nur an:
--   - die Policy "profiles_update_own" auf public.profiles
--   - die Funktion public.sync_player_data(jsonb)
--   - deren EXECUTE-Rechte
--
-- Fasst NICHT an: die Tabelle profiles selbst (keine Spalten-
-- Aenderung), die Select-Policy, den handle_new_user()-Trigger,
-- keine anderen Tabellen oder Funktionen, keine bestehenden Daten.
--
-- Kann gefahrlos mehrfach ausgefuehrt werden (jede Anweisung ist
-- idempotent: DROP ... IF EXISTS, CREATE OR REPLACE, REVOKE/GRANT
-- sind selbst wiederholbar ohne Fehler oder Seiteneffekt).
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen kompletten Inhalt einfuegen -> "Run".
-- ============================================================

-- 1) Direktes UPDATE auf profiles durch den Client sperren.
--    Vorher erlaubte diese Policy jedem eingeloggten Nutzer ein
--    UPDATE auf die eigene Zeile OHNE jede Pruefung des neuen
--    Inhalts (auth.uid() = id war die einzige Bedingung) - damit
--    liess sich player_data per REST/JS-Client auf einen beliebigen
--    JSON-Wert setzen. Ohne diese Policy (und ohne Ersatz-Policy)
--    ist ein direktes UPDATE auf profiles fuer den Client komplett
--    gesperrt; Schreibzugriff geht nur noch ueber die Funktion
--    unten.
drop policy if exists "profiles_update_own" on public.profiles;

-- 2) sync_player_data(): einzige noch erlaubte Schreib-Route fuer
--    player_data. Laeuft mit den Rechten des Funktionseigentuemers
--    (security definer), prueft den neuen Stand gegen den
--    gespeicherten alten Stand, bevor geschrieben wird:
--      - Münzen (coins) und totalCoinsEarned duerfen pro Aufruf nur
--        um einen plausiblen Betrag wachsen (max_coin_delta) und
--        nie negativ werden; totalCoinsEarned darf nie sinken.
--      - Erfolge (achievements) koennen nicht entfernt werden und
--        nicht in grosser Zahl auf einmal hinzukommen.
--      - Inventar-Items (items, auf true gesetzte Cursor-Freischalt-
--        ungen) koennen nicht entfernt werden und nicht in grosser
--        Zahl auf einmal hinzukommen.
--      - Bei der allerersten Synchronisierung (die Zeile hat noch
--        nie player_data mit einem "coins"-Feld gesehen, z. B.
--        direkt nach der Registrierung) greift die Pruefung noch
--        nicht - sonst wuerde ein Gast, der vor der Registrierung
--        schon legitim gespielt hat, seinen Stand verlieren.
--    Das ist kein vollstaendiges Anti-Cheat-System (kein echtes
--    serverseitiges Aktions-Log ueber die Zeit), verhindert aber
--    den offensichtlichen Missbrauch: einen riesigen Sprung bei
--    Münzen/Erfolgen/Inventar in einem einzigen Aufruf.
create or replace function public.sync_player_data(new_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    old_data jsonb;
    old_coins numeric;
    new_coins numeric;
    old_total numeric;
    new_total numeric;
    old_achievement_count int;
    new_achievement_count int;
    old_owned_items int;
    new_owned_items int;
    -- Grosszuegiger Puffer ueber der groessten einzelnen, echten
    -- Belohnung im Spiel (aktuell max. 10 Muenzen fuer ein
    -- schweres Memory-Spiel) - deckt mehrere schnelle Aktionen
    -- zwischen zwei Sync-Aufrufen ab, ohne normales Spielen zu
    -- blockieren, macht aber einen Sprung auf z. B. 999999 unmoeglich.
    max_coin_delta constant numeric := 500;
    max_new_achievements constant int := 10;
    max_new_items constant int := 3;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select player_data into old_data
    from public.profiles
    where id = auth.uid();

    if old_data is null then
        old_data := '{}'::jsonb;
    end if;

    -- Erstsynchronisierung: hier gibt es noch keinen "alten Stand",
    -- gegen den ein Sprung verdaechtig waere.
    if not (old_data ? 'coins') then

        update public.profiles
        set player_data = new_data,
            updated_at = now()
        where id = auth.uid();

        return;

    end if;

    old_coins := coalesce((old_data->>'coins')::numeric, 0);
    new_coins := coalesce((new_data->>'coins')::numeric, 0);
    old_total := coalesce((old_data->>'totalCoinsEarned')::numeric, 0);
    new_total := coalesce((new_data->>'totalCoinsEarned')::numeric, 0);

    if new_coins < 0 or new_total < 0 then
        raise exception 'Münzen dürfen nicht negativ sein';
    end if;

    if new_coins > old_coins + max_coin_delta then
        raise exception 'Münzen-Zuwachs zu groß (max % pro Sync)', max_coin_delta;
    end if;

    if new_total < old_total then
        raise exception 'totalCoinsEarned darf nicht sinken';
    end if;

    if new_total > old_total + max_coin_delta then
        raise exception 'totalCoinsEarned-Zuwachs zu groß (max % pro Sync)', max_coin_delta;
    end if;

    old_achievement_count := coalesce(jsonb_array_length(old_data->'achievements'), 0);
    new_achievement_count := coalesce(jsonb_array_length(new_data->'achievements'), 0);

    if new_achievement_count < old_achievement_count then
        raise exception 'Erfolge dürfen nicht entfernt werden';
    end if;

    if new_achievement_count > old_achievement_count + max_new_achievements then
        raise exception 'Zu viele neue Erfolge auf einmal (max % pro Sync)', max_new_achievements;
    end if;

    select count(*) into old_owned_items
    from jsonb_each(coalesce(old_data->'items', '{}'::jsonb))
    where value = 'true'::jsonb;

    select count(*) into new_owned_items
    from jsonb_each(coalesce(new_data->'items', '{}'::jsonb))
    where value = 'true'::jsonb;

    if new_owned_items < old_owned_items then
        raise exception 'Inventar-Items dürfen nicht entfernt werden';
    end if;

    if new_owned_items > old_owned_items + max_new_items then
        raise exception 'Zu viele neue Inventar-Items auf einmal (max % pro Sync)', max_new_items;
    end if;

    update public.profiles
    set player_data = new_data,
        updated_at = now()
    where id = auth.uid();
end;
$$;

-- 3) EXECUTE-Rechte: nur angemeldete Nutzer duerfen die Funktion
--    aufrufen (nicht "anon"/nicht angemeldete Besucher, nicht die
--    oeffentliche "public"-Pseudo-Rolle).
revoke all on function public.sync_player_data(jsonb) from public;
grant execute on function public.sync_player_data(jsonb) to authenticated;
