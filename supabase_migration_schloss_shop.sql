-- ============================================================
-- Your Journey – Migration: Schlossladen (Phase 2 von "Mein Schloss")
-- (2026-09-05)
-- ============================================================
-- Eigenständige, idempotente Migration ZUSÄTZLICH zu
-- supabase_migration_security_player_data.sql UND
-- supabase_migration_schloss.sql (müssen vorher schon angewendet
-- worden sein).
--
-- Fasst an:
--   - neue Tabelle public.schloss_furniture (serverseitige Preis-/
--     Existenz-Quelle für kaufbares Möbel)
--   - neue Funktion public.purchase_schloss_furniture(text)
--
-- WARUM eine echte Tabelle statt einer case-Anweisung wie bei
-- purchase_item(): der Möbel-Katalog ist explizit auf "hunderte
-- Gegenstände" ausgelegt (siehe Architekturplan) - eine hundert
-- Zeilen lange case-Anweisung wäre genau die Art Duplikation, die
-- vermieden werden soll. Neues Möbel im Shop = eine INSERT-Zeile,
-- keine neue Funktions-Migration.
--
-- WICHTIG: nicht jedes Möbelstück aus JS/schloss-data.js steht hier -
-- die drei Level-3-Startpaket-Möbel (stuhl_wald_a/tisch_wald_a/
-- teppich_wald_a) und das Level-5-Möbel (lampe_wald_a) sind
-- ABSICHTLICH NICHT in dieser Tabelle: sie kommen ausschließlich über
-- earn_xp()-Level-Belohnungen (siehe supabase_migration_schloss.sql).
-- purchase_schloss_furniture() lehnt einen Kaufversuch für eine nicht
-- gelistete ID ab - das schützt nebenbei auch davor, dass ein
-- Level-Belohnungs-Möbel über den Shop "erkauft" statt "verdient"
-- werden könnte.
--
-- Kann gefahrlos mehrfach ausgeführt werden.
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen kompletten Inhalt einfügen -> "Run".
-- ============================================================


-- ============================================================
-- 1) schloss_furniture: serverseitige Preis-/Existenz-Quelle.
--    RLS aktiv, aber mit einer öffentlichen Lese-Policy (der Shop im
--    Client muss Preise anzeigen können, auch bevor gekauft wird) -
--    Schreibzugriff bleibt clientseitig komplett gesperrt (keine
--    INSERT/UPDATE/DELETE-Policy), Änderungen laufen nur über eine
--    künftige Migration wie diese hier.
-- ============================================================
create table if not exists public.schloss_furniture (
    id text primary key,
    price int not null check (price >= 0),
    active boolean not null default true
);

alter table public.schloss_furniture enable row level security;

drop policy if exists "schloss_furniture_read_all" on public.schloss_furniture;
create policy "schloss_furniture_read_all" on public.schloss_furniture
    for select
    using (true);

insert into public.schloss_furniture (id, price) values
    ('regal_wald_a', 25),
    ('sofa_wald_a', 35),
    ('pflanze_wald_a', 10),
    ('rahmen_wald_a', 18),
    ('hocker_wald_a', 10),
    ('baenkchen_wald_a', 22),
    ('beistelltisch_wald_a', 16),
    ('kissen_wald_a', 8),
    ('vorhang_wald_a', 14),
    ('spiegel_wald_a', 20),
    ('uhr_wald_a', 18),
    ('kerze_wald_a', 6),
    ('truhe_wald_a', 28),
    ('blumenkasten_wald_a', 12)
on conflict (id) do update set price = excluded.price;


-- ============================================================
-- 2) purchase_schloss_furniture(p_furniture_id): atomarer Kauf,
--    exakt nach dem Muster von purchase_item() in
--    supabase_migration_security_player_data.sql - Preis
--    nachschlagen, Guthaben prüfen, "for update" sperren, Coins
--    abziehen, Möbel-ID zu schloss.ownedFurniture ergänzen.
--    Bereits besessene Möbel werden idempotent behandelt (kein
--    doppelter Abzug bei Doppelklick).
-- ============================================================
create or replace function public.purchase_schloss_furniture(p_furniture_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    price int;
    is_active boolean;
    current_data jsonb;
    current_coins numeric;
    owned_furniture jsonb;
    already_owned boolean;
    new_coins numeric;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select sf.price, sf.active into price, is_active
    from public.schloss_furniture sf
    where sf.id = p_furniture_id;

    if price is null or is_active is not true then
        raise exception 'Unbekanntes oder nicht erhältliches Möbelstück: %', p_furniture_id;
    end if;

    select player_data into current_data
    from public.profiles
    where id = auth.uid()
    for update;

    if current_data is null then
        current_data := '{}'::jsonb;
    end if;

    owned_furniture := coalesce(current_data #> '{schloss,ownedFurniture}', '[]'::jsonb);
    already_owned := owned_furniture ? p_furniture_id;
    current_coins := coalesce((current_data->>'coins')::numeric, 0);

    if already_owned then
        -- Idempotent: kein Fehler, einfach den aktuellen Stand
        -- zurückgeben (z. B. bei Doppelklick auf "Kaufen").
        return jsonb_build_object(
            'coins', current_coins, 'furnitureId', p_furniture_id,
            'already_owned', true, 'ownedFurniture', owned_furniture
        );
    end if;

    if current_coins < price then
        raise exception 'Nicht genug Münzen (brauchst %, hast %)', price, current_coins;
    end if;

    new_coins := current_coins - price;
    owned_furniture := owned_furniture || to_jsonb(p_furniture_id);

    update public.profiles
    set player_data = jsonb_set(
            jsonb_set(current_data, '{coins}', to_jsonb(new_coins), true),
            '{schloss,ownedFurniture}', owned_furniture, true
        ),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object(
        'coins', new_coins, 'furnitureId', p_furniture_id,
        'already_owned', false, 'ownedFurniture', owned_furniture
    );
end;
$$;


-- 3) EXECUTE-Rechte: nur angemeldete Nutzer (anon ausdrücklich mit
--    aufgeführt, siehe Warnung in supabase_migration_schloss.sql).
revoke all on function public.purchase_schloss_furniture(text) from public, anon;
grant execute on function public.purchase_schloss_furniture(text) to authenticated;
