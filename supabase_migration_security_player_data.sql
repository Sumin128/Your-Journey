-- ============================================================
-- Your Journey – Security-Migration: profiles.player_data (v2)
-- (2026-08-27)
-- ============================================================
-- Eigenständige, idempotente Migration NUR für die
-- Sicherheitsarchitektur rund um profiles.player_data.
--
-- Fasst nur an:
--   - die Policy "profiles_update_own" auf public.profiles
--   - die Funktionen public.sync_player_data(jsonb),
--     public.earn_coins(text), public.purchase_item(text),
--     public.use_consumable_item(text)
--   - deren EXECUTE-Rechte
--
-- Fasst NICHT an: die Tabelle profiles selbst (keine Spalten-
-- Aenderung), die Select-Policy, den handle_new_user()-Trigger,
-- keine anderen Tabellen oder Funktionen, keine bestehenden Daten.
--
-- Kann gefahrlos mehrfach ausgefuehrt werden.
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen kompletten Inhalt einfuegen -> "Run".
-- ============================================================


-- ============================================================
-- WARUM v2 (Aenderung gegenueber der ersten Version dieser
-- Migration, die noch nicht in Supabase ausgefuehrt wurde):
--
-- Die erste Version liess player_data weiterhin als EIN Blob vom
-- Client kommen und pruefte nur, ob Muenzen/Erfolge/Items nicht zu
-- stark auf einmal wachsen ("Plausibilitaetspruefung", kein Schutz -
-- ein Angreifer haette den Betrag einfach auf viele kleine, unter
-- dem Limit bleibende Sync-Aufrufe verteilen koennen). Ausserdem
-- blockierte sie jedes Schrumpfen von Items, was zukuenftige
-- Verbrauchsitems (z. B. Feuerwerk) unmoeglich gemacht haette.
--
-- Jetzt: "wertvolle" Felder (coins, totalCoinsEarned,
-- goldenFeathers, items, consumables) sind ueber den allgemeinen
-- sync_player_data()-Weg GAR NICHT mehr veraenderbar - egal was der
-- Client schickt, es wird immer der zuletzt vom Server bestaetigte
-- Wert wiederhergestellt. Diese Felder aendern sich ausschliesslich
-- ueber eigene, atomare Funktionen (earn_coins, purchase_item,
-- use_consumable_item), die selbst den Betrag/Preis serverseitig
-- festlegen und niemals einen vom Client gelieferten Zahlenwert
-- uebernehmen. "Normale", nicht wertvolle Daten (Name, Avatar,
-- besuchte Tiere, Fortschrittszaehler, Sidebar-Design, ...) laufen
-- weiterhin unveraendert ueber sync_player_data().
-- ============================================================


-- 1) Direktes UPDATE auf profiles durch den Client sperren.
--    Ohne diese Policy (und ohne Ersatz-Policy) ist ein direktes
--    UPDATE auf profiles fuer den Client komplett gesperrt;
--    Schreibzugriff geht nur noch ueber die Funktionen unten.
drop policy if exists "profiles_update_own" on public.profiles;


-- ============================================================
-- 2) sync_player_data(): fuer "normale", nicht wertvolle
--    Spielerdaten (Name, Avatar, besuchte Tiere/Orte, Sidebar-
--    Design, Fortschrittszaehler, ...). coins, totalCoinsEarned,
--    goldenFeathers, items und consumables werden IMMER mit dem
--    zuletzt gespeicherten Server-Wert ueberschrieben (oder ganz
--    entfernt, falls der Server noch keinen kennt) - unabhaengig
--    davon, was new_data dafuer enthaelt. Erfolge (achievements)
--    duerfen weiterhin nicht entfernt und nicht in grosser Zahl auf
--    einmal hinzugefuegt werden.
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
    protected_keys constant text[] := array['coins', 'totalCoinsEarned', 'goldenFeathers', 'items', 'consumables'];
    protected_key text;
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
-- 3) earn_coins(reason): einzige Route, um Münzen gutzuschreiben.
--    Der Client liefert NUR einen Grund (welche Aktion war es),
--    NIEMALS einen Betrag - der Betrag steht fest in der case-
--    Anweisung unten und muss zu den Beträgen in JS/player.js,
--    JS/quiz.js, JS/fuchs.js, JS/eulenschule.js passen (dort nur
--    noch für die optimistische, lokale Sofort-Anzeige verwendet -
--    massgeblich ist immer dieser serverseitige Wert). "for update"
--    sperrt die Zeile fuer die Dauer des Aufrufs gegen gleichzeitige
--    Aufrufe (verhindert verlorene Updates bei zwei Aufrufen kurz
--    hintereinander).
--
--    Faengt zusaetzlich noch vorhandene player_data.feathers aus der
--    Zeit vor der Muenzen-Umbenennung als Startwert ab, falls eine
--    Zeile seit der Umstellung noch nie synchronisiert wurde.
-- ============================================================
create or replace function public.earn_coins(reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    reward int;
    current_data jsonb;
    current_coins numeric;
    current_total numeric;
    current_golden numeric;
    new_coins numeric;
    new_total numeric;
    new_golden numeric;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    reward := case reason
        when 'quiz_correct' then 1
        when 'fox_correct' then 1
        when 'memory_normal' then 1
        when 'memory_schwer' then 5
        when 'memory_extraschwer' then 10
        when 'word_leicht' then 2
        when 'word_mittel' then 3
        when 'word_schwer' then 5
        else null
    end;

    if reward is null then
        raise exception 'Unbekannter Belohnungsgrund: %', reason;
    end if;

    select player_data into current_data
    from public.profiles
    where id = auth.uid()
    for update;

    if current_data is null then
        current_data := '{}'::jsonb;
    end if;

    current_coins := coalesce(
        (current_data->>'coins')::numeric,
        (current_data->>'feathers')::numeric,
        0
    );
    current_total := coalesce(
        (current_data->>'totalCoinsEarned')::numeric,
        (current_data->>'totalFeathersEarned')::numeric,
        0
    );
    current_golden := coalesce((current_data->>'goldenFeathers')::numeric, 0);

    new_coins := current_coins + reward;
    new_total := current_total + reward;
    new_golden := greatest(current_golden, floor(new_total / 100));

    update public.profiles
    set player_data = (current_data - 'feathers' - 'totalFeathersEarned') || jsonb_build_object(
            'coins', new_coins,
            'totalCoinsEarned', new_total,
            'goldenFeathers', new_golden
        ),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object(
        'coins', new_coins,
        'totalCoinsEarned', new_total,
        'goldenFeathers', new_golden
    );
end;
$$;


-- ============================================================
-- 4) purchase_item(item_key): atomarer Kauf - Preis nachschlagen,
--    Guthaben pruefen, Muenzen abziehen, Item gutschreiben, alles
--    in einer einzigen Transaktion (Postgres-Funktionen laufen
--    implizit atomar). Preise stehen serverseitig fest, der Client
--    liefert nur den Item-Schluessel. Bereits gekaufte Items werden
--    idempotent behandelt (kein doppelter Abzug bei Doppelklick).
-- ============================================================
create or replace function public.purchase_item(item_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    price int;
    current_data jsonb;
    current_coins numeric;
    already_owned boolean;
    new_coins numeric;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    price := case item_key
        when 'foxCursor' then 30
        when 'bearCursor' then 40
        when 'unicornCursor' then 200
        when 'kuroCursor' then 90
        when 'hasenCursor' then 100
        when 'goldenFeatherCursor' then 300
        when 'blackGoldenFeatherCursor' then 300
        when 'luisCursor' then 500
        else null
    end;

    if price is null then
        raise exception 'Unbekanntes Item: %', item_key;
    end if;

    select player_data into current_data
    from public.profiles
    where id = auth.uid()
    for update;

    if current_data is null then
        current_data := '{}'::jsonb;
    end if;

    already_owned := coalesce((current_data->'items'->>item_key)::boolean, false);
    current_coins := coalesce(
        (current_data->>'coins')::numeric,
        (current_data->>'feathers')::numeric,
        0
    );

    if already_owned then
        -- Idempotent: kein Fehler, einfach den aktuellen Stand
        -- zurückgeben (z. B. bei Doppelklick auf "Kaufen").
        return jsonb_build_object('coins', current_coins, 'item_key', item_key, 'already_owned', true);
    end if;

    if current_coins < price then
        raise exception 'Nicht genug Münzen (brauchst %, hast %)', price, current_coins;
    end if;

    new_coins := current_coins - price;

    update public.profiles
    set player_data = (current_data - 'feathers')
            || jsonb_build_object('coins', new_coins)
            || jsonb_build_object(
                'items',
                coalesce(current_data->'items', '{}'::jsonb) || jsonb_build_object(item_key, true)
            ),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object('coins', new_coins, 'item_key', item_key, 'already_owned', false);
end;
$$;


-- ============================================================
-- 5) use_consumable_item(item_key): fuer zukuenftige
--    Verbrauchsitems (z. B. Feuerwerk) - noch nicht im Spiel
--    verdrahtet (siehe Bericht), aber bereit: Bestand pruefen, 1
--    abziehen, Erfolg zurückgeben. Der Client soll den visuellen
--    Effekt erst NACH einer erfolgreichen Antwort dieser Funktion
--    auslösen, nicht vorher. Getrennt von "items" (das sind
--    dauerhafte, nicht verbrauchbare Freischaltungen wie Cursor) -
--    "consumables" ist ein Objekt aus Stückzahlen
--    (z. B. {"feuerwerk": 3}).
-- ============================================================
create or replace function public.use_consumable_item(item_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_data jsonb;
    current_qty numeric;
    new_qty numeric;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select player_data into current_data
    from public.profiles
    where id = auth.uid()
    for update;

    if current_data is null then
        current_data := '{}'::jsonb;
    end if;

    current_qty := coalesce((current_data->'consumables'->>item_key)::numeric, 0);

    if current_qty < 1 then
        raise exception 'Kein Vorrat von % mehr vorhanden', item_key;
    end if;

    new_qty := current_qty - 1;

    update public.profiles
    set player_data = current_data || jsonb_build_object(
            'consumables',
            coalesce(current_data->'consumables', '{}'::jsonb) || jsonb_build_object(item_key, new_qty)
        ),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object('item_key', item_key, 'remaining', new_qty, 'used', true);
end;
$$;


-- 6) EXECUTE-Rechte: nur angemeldete Nutzer duerfen diese
--    Funktionen aufrufen (nicht "anon", nicht die oeffentliche
--    "public"-Pseudo-Rolle).
revoke all on function public.sync_player_data(jsonb) from public;
grant execute on function public.sync_player_data(jsonb) to authenticated;

revoke all on function public.earn_coins(text) from public;
grant execute on function public.earn_coins(text) to authenticated;

revoke all on function public.purchase_item(text) from public;
grant execute on function public.purchase_item(text) to authenticated;

revoke all on function public.use_consumable_item(text) from public;
grant execute on function public.use_consumable_item(text) to authenticated;
