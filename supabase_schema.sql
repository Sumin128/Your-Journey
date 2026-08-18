-- ============================================================
-- Your Journey – Datenbank-Schema für Supabase
-- ============================================================
-- Anleitung: Im Supabase-Dashboard links auf "SQL Editor" klicken,
-- "New query", diesen kompletten Inhalt einfügen, "Run" klicken.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- ============================================================

-- Eine Zeile pro Spieler, verknüpft mit dem Auth-Account (auth.users).
-- Absichtlich minimal: keine echten Namen, keine Adresse – nur das,
-- was für den Spielfortschritt gebraucht wird.
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    player_name text default 'Abenteurer',
    feathers integer not null default 0,
    achievements jsonb not null default '[]'::jsonb,
    inventory jsonb not null default '[]'::jsonb,
    avatar text,
    cursor_skin text default 'default',
    parental_consent boolean not null default false,
    updated_at timestamptz not null default now()
);

-- Row Level Security aktivieren: ohne explizite Regel darf niemand
-- irgendetwas lesen oder schreiben.
alter table public.profiles enable row level security;

-- Jeder eingeloggte Nutzer darf NUR seine eigene Zeile lesen.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = id);

-- Jeder eingeloggte Nutzer darf NUR seine eigene Zeile ändern.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id);

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
