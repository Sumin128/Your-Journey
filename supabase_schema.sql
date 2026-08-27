-- ============================================================
-- Your Journey – Datenbank-Schema für Supabase (v5)
-- ============================================================
-- Anleitung: Im Supabase-Dashboard links auf "SQL Editor" klicken,
-- "New query", diesen kompletten Inhalt einfügen, "Run" klicken.
-- Kann gefahrlos mehrfach ausgeführt werden (auch falls du schon
-- eine ältere Version dieses Skripts ausgeführt hattest - v2 räumt
-- die alten Einzel-Spalten auf und ersetzt sie durch eine einzige
-- player_data-Spalte, die zum kompletten player-Objekt aus
-- JS/player.js passt; v3/v4/v5 sperren das direkte UPDATE von
-- player_data und erzwingen stattdessen geprüfte, atomare Funktionen
-- inkl. Anti-Replay-Schutz für Münzen - siehe
-- supabase_migration_security_player_data.sql).
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
-- v4/v5: "wertvolle" Felder in player_data (coins, totalCoinsEarned,
-- goldenFeathers, items, consumables) sind ueber den allgemeinen
-- UPDATE-Weg gar nicht mehr veraenderbar, und earn_coins() hat eine
-- Anti-Replay-Pruefung (reward_cooldowns) gegen wiederholtes
-- Einloesen desselben Grundes - siehe
-- supabase_migration_security_player_data.sql fuer die vollstaendige
-- Begruendung und alle Funktionen (sync_player_data, earn_coins,
-- purchase_item, use_consumable_item). Dieser Abschnitt hier ist
-- identisch zu dieser Migration, nur als Teil des Gesamt-Schemas
-- dokumentiert.
-- ============================================================

create table if not exists public.reward_cooldowns (
    user_id uuid not null references auth.users (id) on delete cascade,
    reason text not null,
    last_claimed_at timestamptz not null default now(),
    primary key (user_id, reason)
);

alter table public.reward_cooldowns enable row level security;

drop policy if exists "profiles_update_own" on public.profiles;

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

create or replace function public.earn_coins(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    reward int;
    cooldown_seconds int;
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

    reward := case p_reason
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
        raise exception 'Unbekannter Belohnungsgrund: %', p_reason;
    end if;

    cooldown_seconds := case p_reason
        when 'quiz_correct' then 1
        when 'fox_correct' then 1
        when 'word_leicht' then 3
        when 'word_mittel' then 3
        when 'word_schwer' then 3
        when 'memory_normal' then 5
        when 'memory_schwer' then 5
        when 'memory_extraschwer' then 5
        else 3
    end;

    insert into public.reward_cooldowns as rc (user_id, reason, last_claimed_at)
    values (auth.uid(), p_reason, now())
    on conflict (user_id, reason) do update
        set last_claimed_at = excluded.last_claimed_at
        where rc.last_claimed_at <= now() - (cooldown_seconds || ' seconds')::interval;

    if not found then
        raise exception 'Zu schnell hintereinander - bitte % Sekunde(n) warten', cooldown_seconds;
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

revoke all on function public.sync_player_data(jsonb) from public;
grant execute on function public.sync_player_data(jsonb) to authenticated;

revoke all on function public.earn_coins(text) from public;
grant execute on function public.earn_coins(text) to authenticated;

revoke all on function public.purchase_item(text) from public;
grant execute on function public.purchase_item(text) to authenticated;

revoke all on function public.use_consumable_item(text) from public;
grant execute on function public.use_consumable_item(text) to authenticated;

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