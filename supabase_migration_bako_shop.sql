-- ============================================================
-- Mirelon – Bako-Basar: Baumkinder & Verbrauchs-Feuerwerk
-- ============================================================
-- Eigenstaendige, idempotente Migration. Baut NUR auf der
-- bestehenden Sicherheitsarchitektur aus
-- supabase_migration_security_player_data.sql auf und fasst an:
--
--   - public.purchase_item(text)          -> 4 Baumkinder ergaenzt
--   - public.purchase_consumable_bundle(text)  -> NEU (Feuerwerk-Paket)
--
-- NICHT angefasst:
--   - use_consumable_item(text) ist bereits vorhanden und behandelt
--     'feuerwerk' schon korrekt (Bestand pruefen, 1 abziehen) -> keine
--     Aenderung noetig.
--   - sync_player_data(): 'items' und 'consumables' sind dort bereits
--     als geschuetzte Felder gelistet -> vom Client aus NICHT
--     veraenderbar, nur ueber die Funktionen hier.
--
-- Kann gefahrlos mehrfach ausgefuehrt werden.
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen kompletten Inhalt einfuegen -> "Run".
-- ============================================================


-- ============================================================
-- 1) purchase_item(item_key): unveraenderte Logik, nur die
--    Preistabelle bekommt die vier Baumkinder dazu. Baumkinder
--    sind - wie die Cursor - dauerhafte, nicht verbrauchbare
--    Freischaltungen und landen deshalb in player_data.items als
--    { "baumkindOtter": true, ... }.
--
--    Die Preise muessen zu JS/shop.js (bzw. der Bako-Seite) passen;
--    massgeblich ist immer dieser serverseitige Wert.
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
        -- Baumkinder (Bako-Basar)
        when 'baumkindOtter' then 25
        when 'baumkindReh' then 45
        when 'baumkindEichhorn' then 70
        when 'baumkindBaer' then 100
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
-- 2) purchase_consumable_bundle(bundle_key): NEU. Atomarer Kauf
--    eines Verbrauchs-Pakets. Genau wie purchase_item, nur dass
--    statt eines boolean-Items eine Stueckzahl auf
--    player_data.consumables.<key> aufaddiert wird.
--
--    Der Client liefert nur den Paket-Schluessel; Preis, Ziel-Item
--    und Menge stehen serverseitig fest. Nicht idempotent im Sinne
--    von "einmal" - jeder erfolgreiche Aufruf kostet Muenzen und
--    legt Vorrat nach (wie ein echter Nachkauf). Der Client muss
--    daher Doppelklicks selbst verhindern (Button deaktivieren, bis
--    die Antwort da ist).
-- ============================================================
create or replace function public.purchase_consumable_bundle(bundle_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    price int;
    target_key text;
    add_qty int;
    current_data jsonb;
    current_coins numeric;
    current_qty numeric;
    new_coins numeric;
    new_qty numeric;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    -- Paket -> (Preis, Ziel-Verbrauchsitem, Menge)
    case bundle_key
        when 'feuerwerk5' then
            price := 30; target_key := 'feuerwerk'; add_qty := 5;
        else
            price := null;
    end case;

    if price is null then
        raise exception 'Unbekanntes Paket: %', bundle_key;
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

    if current_coins < price then
        raise exception 'Nicht genug Münzen (brauchst %, hast %)', price, current_coins;
    end if;

    current_qty := coalesce((current_data->'consumables'->>target_key)::numeric, 0);
    new_coins := current_coins - price;
    new_qty := current_qty + add_qty;

    update public.profiles
    set player_data = (current_data - 'feathers')
            || jsonb_build_object('coins', new_coins)
            || jsonb_build_object(
                'consumables',
                coalesce(current_data->'consumables', '{}'::jsonb) || jsonb_build_object(target_key, new_qty)
            ),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object(
        'coins', new_coins,
        'bundle_key', bundle_key,
        'item_key', target_key,
        'quantity', new_qty
    );
end;
$$;


-- 3) EXECUTE-Rechte (wie die anderen Funktionen: nur angemeldete
--    Nutzer, nicht "anon" / nicht "public").
revoke all on function public.purchase_item(text) from public, anon;
grant execute on function public.purchase_item(text) to authenticated;

revoke all on function public.purchase_consumable_bundle(text) from public, anon;
grant execute on function public.purchase_consumable_bundle(text) to authenticated;
