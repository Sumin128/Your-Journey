-- ============================================================
-- Your Journey – Datenbank-Schema für Supabase (v3)
-- ============================================================
-- Anleitung: Im Supabase-Dashboard links auf "SQL Editor" klicken,
-- "New query", diesen kompletten Inhalt einfügen, "Run" klicken.
-- Kann gefahrlos mehrfach ausgeführt werden (auch falls du schon
-- eine ältere Version dieses Skripts ausgeführt hattest - v2 räumt
-- die alten Einzel-Spalten auf und ersetzt sie durch eine einzige
-- player_data-Spalte, die zum kompletten player-Objekt aus
-- JS/player.js passt; v3 sperrt das direkte UPDATE von player_data
-- und erzwingt stattdessen die geprüfte sync_player_data()-Funktion,
-- siehe Kommentar dort).
-- ============================================================

-- Eine Zeile pro Spieler, verknüpft mit dem Auth-Account (auth.users).
-- Absichtlich minimal: keine echten Namen, keine Adresse - nur der
-- komplette Spielstand (Federn, Erfolge, Inventar, Avatar, ...) als
-- ein JSON-Objekt, plus die Einwilligungs-Markierung.
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    player_data jsonb not null default '{}'::jsonb,
    parental_consent boolean not null default false,
    updated_at timestamptz not null default now()
);

-- Migration, falls die alte v1-Version schon lief:
alter table public.profiles add column if not exists player_data jsonb not null default '{}'::jsonb;
alter table public.profiles drop column if exists player_name;
alter table public.profiles drop column if exists feathers;
alter table public.profiles drop column if exists achievements;
alter table public.profiles drop column if exists inventory;
alter table public.profiles drop column if exists avatar;
alter table public.profiles drop column if exists cursor_skin;

-- Row Level Security aktivieren: ohne explizite Regel darf niemand
-- irgendetwas lesen oder schreiben.
alter table public.profiles enable row level security;

-- Jeder eingeloggte Nutzer darf NUR seine eigene Zeile lesen.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = id);

-- ============================================================
-- v3: player_data nicht mehr direkt vom Client per UPDATE
-- beschreibbar (siehe Security-Review, 2026-08-27). Vorher konnte
-- jeder eingeloggte Nutzer per Browser-Konsole/REST-API
-- profiles.player_data auf einen beliebigen JSON-Wert setzen
-- (z. B. Münzen/Federn, Erfolge, Inventar frei erfinden) - die
-- alte "profiles_update_own"-Policy erlaubte ein UPDATE auf die
-- eigene Zeile ohne jede Prüfung des NEUEN Inhalts.
--
-- Jetzt: kein direktes UPDATE mehr möglich (keine UPDATE-Policy),
-- Schreibzugriff nur noch über die Funktion sync_player_data()
-- unten - läuft mit den Rechten des Funktionseigentümers (security
-- definer) und prüft den neuen Stand gegen den alten, bevor
-- geschrieben wird. Das ist kein vollständiges Anti-Cheat-System
-- (es gibt keine echte Aktions-Historie serverseitig), aber
-- verhindert den offensichtlichen Missbrauch: einen riesigen
-- Sprung bei Münzen/Erfolgen in einem einzigen Aufruf.
-- ============================================================

drop policy if exists "profiles_update_own" on public.profiles;

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

    -- Erstsynchronisierung (frisch registriert, die vom Trigger
    -- angelegte Zeile hat noch nie echte Spieldaten gesehen): hier
    -- gibt es noch keinen "alten Stand", gegen den ein Sprung
    -- verdaechtig waere - z. B. hat ein Gast vor der Registrierung
    -- vielleicht schon legitim mehrere hundert Muenzen gesammelt.
    -- Die Plausibilitaetspruefung greift erst ab dem naechsten Sync.
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

revoke all on function public.sync_player_data(jsonb) from public;
grant execute on function public.sync_player_data(jsonb) to authenticated;

-- Automatisch eine leere Profil-Zeile anlegen, sobald sich jemand
-- registriert (E-Mail + Passwort werden von Supabase Auth selbst
-- verwaltet, landen nie in dieser Tabelle).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, parental_consent)
    values (new.id, coalesce((new.raw_user_meta_data->>'parental_consent')::boolean, false));
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();