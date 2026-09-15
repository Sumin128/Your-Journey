-- ============================================================
-- Your Journey / Mirelon – Migration: Private Raumcode-Multiplayer
-- (2026-09-16) – NOCH NICHT AUSGEFÜHRT
-- ============================================================
-- Trägt die Datenbankseite für private, eingeladene Online-Räume für
-- Mirelons Jagd und Miro nach ("Raum erstellen" / "Raum beitreten"
-- per Code). KEINE öffentliche Raumliste, KEINE Zufallssuche, KEIN
-- Chat, KEINE XP/Münzen/Erfolge/Bestenlistenpunkte für Online-Partien.
--
-- Sicherheitsmodell (bewusst für Version 1, siehe Bericht):
--   Der Gastgeber führt die einzige autoritative Spiel-Engine aus
--   (dieselbe JS/miro-engine.js bzw. JS/jagd-engine.js wie lokal).
--   Andere Spieler senden nur Aktionswünsche über einen privaten
--   Realtime-Kanal; der Gastgeber prüft sie mit der Engine und
--   schreibt erst danach den bestätigten Zustand über
--   submit_room_state() fort. NUR der Gastgeber darf schreiben
--   (in jeder schreibenden Funktion hart geprüft). state_version
--   verhindert doppelte/veraltete Schreibversuche. Ein manipulierter
--   Gastgeber-Client könnte diese Prüfung theoretisch umgehen und
--   sich selbst bevorteilen ("schummeln") - das ist eine bekannte,
--   akzeptierte Grenze dieser ersten Version (siehe Bericht/AGENTS-
--   Dokumentation), weil es sich um private, unbelohnte Partien unter
--   eingeladenen Mitspielern handelt. Die Schnittstellen sind so
--   geschnitten, dass eine echte serverseitige Regelprüfung (Edge
--   Function) später submit_room_state() ersetzen kann, ohne Lobby,
--   RPC-Namen oder Oberfläche neu bauen zu müssen.
--
-- Fasst an:
--   1. NEU  public.game_rooms
--   2. NEU  public.game_room_players
--   3. NEU  RPCs: create_game_room, join_game_room, set_player_ready,
--        host_set_seat, leave_game_room, start_game_room,
--        submit_room_state, load_room_state
--   4. Aufräum-Funktion expire_stale_game_rooms() (von einem externen
--      Scheduler/Cron aufzurufen - hier nur die Funktion, kein
--      pg_cron-Job, damit nichts automatisch anfängt zu laufen)
--
-- KEINE Änderung an: player_data, sync_player_data, earn_xp,
--   earn_coins, highscores oder sonstigen Fortschritts-/Belohnungs-
--   pfaden. Online-Räume sind davon vollständig getrennt.
--
-- Idempotent – kann mehrfach ausgeführt werden.
-- Anleitung: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- ============================================================


-- ============================================================
-- 1) game_rooms – ein privater Raum pro Partie
-- ============================================================
create table if not exists public.game_rooms (
    id              uuid primary key default gen_random_uuid(),
    room_code       text not null,
    game_type       text not null check (game_type in ('miro', 'mirelons_jagd')),
    host_id         uuid not null references auth.users(id) on delete cascade,
    status          text not null default 'waiting' check (status in ('waiting', 'playing', 'paused', 'finished')),
    max_players     int  not null check (max_players between 2 and 4),
    -- Für alle Mitspieler unbedenkliche Zusammenfassung (Zug, aktive
    -- Farbe, Kartenanzahlen, Spielbrett-Positionen o.ä.) - bei Miro
    -- ausdrücklich OHNE Handkarten. Bei Mirelons Jagd (keine geheime
    -- Information) darf das der komplette Spielzustand sein.
    public_info     jsonb not null default '{}'::jsonb,
    -- Vollständiger autoritativer Zustand inkl. ggf. geheimer Anteile
    -- (z. B. aller Miro-Handkarten). Wird NIE unredigiert an alle
    -- verteilt - siehe load_room_state() weiter unten.
    state           jsonb,
    state_version   bigint not null default 0,
    created_at      timestamptz not null default now(),
    last_active_at  timestamptz not null default now(),
    expires_at      timestamptz not null default (now() + interval '6 hours')
);

create unique index if not exists game_rooms_room_code_key on public.game_rooms (room_code);
create index if not exists game_rooms_host_id_idx on public.game_rooms (host_id);
create index if not exists game_rooms_status_expires_idx on public.game_rooms (status, expires_at);

-- Direktzugriff aus dem Client komplett sperren (wie schon bei
-- public.schloss_styles): kein anon/authenticated SELECT/INSERT/
-- UPDATE/DELETE, RLS aktiv ohne Policy. Jeder Zugriff läuft
-- ausschließlich über die SECURITY-DEFINER-Funktionen unten.
revoke all on public.game_rooms from public, anon, authenticated;
alter table public.game_rooms enable row level security;
drop policy if exists "game_rooms_no_direct_access" on public.game_rooms;


-- ============================================================
-- 2) game_room_players – Sitzplätze eines Raums
-- ============================================================
create table if not exists public.game_room_players (
    id           uuid primary key default gen_random_uuid(),
    room_id      uuid not null references public.game_rooms(id) on delete cascade,
    -- NULL = Computerplatz (kein Konto).
    user_id      uuid references auth.users(id) on delete cascade,
    seat         int  not null check (seat between 0 and 3),
    color        text,
    player_name  text not null,
    is_ai        boolean not null default false,
    ready        boolean not null default false,
    connected    boolean not null default true,
    joined_at    timestamptz not null default now(),
    unique (room_id, seat)
);

-- Verhindert doppelten Beitritt desselben Kontos zum selben Raum.
-- Ein partieller Unique-Index statt eines Tabellen-Constraints, weil
-- mehrere Computerplätze (user_id ist NULL) im selben Raum erlaubt
-- sein müssen - Postgres würde NULLs in einem normalen UNIQUE-
-- Constraint zwar ohnehin nicht als Duplikat werten, der partielle
-- Index macht die Absicht aber ausdrücklich.
create unique index if not exists game_room_players_room_user_key
    on public.game_room_players (room_id, user_id)
    where user_id is not null;

create index if not exists game_room_players_room_id_idx on public.game_room_players (room_id);
create index if not exists game_room_players_user_id_idx on public.game_room_players (user_id);

revoke all on public.game_room_players from public, anon, authenticated;
alter table public.game_room_players enable row level security;
drop policy if exists "game_room_players_no_direct_access" on public.game_room_players;


-- ============================================================
-- Hilfsfunktion: eindeutigen, gut lesbaren Raumcode erzeugen.
-- Vermeidet 0/O und 1/I (leicht verwechselbar). Nicht direkt
-- ausführbar (kein GRANT) - nur intern von create_game_room() genutzt.
-- ============================================================
create or replace function public.generate_room_code()
returns text
language plpgsql
as $$
declare
    alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code text;
    attempt int := 0;
begin
    loop
        code := '';
        for i in 1..6 loop
            code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
        end loop;
        exit when not exists (select 1 from public.game_rooms where room_code = code);
        attempt := attempt + 1;
        if attempt > 20 then
            raise exception 'Konnte keinen eindeutigen Raumcode erzeugen';
        end if;
    end loop;
    return code;
end;
$$;

revoke all on function public.generate_room_code() from public, anon, authenticated;


-- ============================================================
-- 3) create_game_room: neuen privaten Raum anlegen, Gastgeber setzt
--    sich selbst auf Sitzplatz 0.
-- ============================================================
create or replace function public.create_game_room(
    p_game_type text,
    p_max_players int,
    p_player_name text,
    p_color text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_room_id uuid;
    v_code text;
    v_name text;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;
    if p_game_type not in ('miro', 'mirelons_jagd') then
        raise exception 'Unbekannter Spieltyp: %', p_game_type;
    end if;
    if p_max_players not between 2 and 4 then
        raise exception 'Spielerzahl muss zwischen 2 und 4 liegen';
    end if;

    v_name := coalesce(nullif(btrim(p_player_name), ''), 'Gastgeber');
    v_code := public.generate_room_code();

    insert into public.game_rooms (room_code, game_type, host_id, max_players)
    values (v_code, p_game_type, auth.uid(), p_max_players)
    returning id into v_room_id;

    insert into public.game_room_players (room_id, user_id, seat, color, player_name, is_ai, ready)
    values (v_room_id, auth.uid(), 0, p_color, v_name, false, false);

    return jsonb_build_object('room_id', v_room_id, 'room_code', v_code);
end;
$$;

revoke all on function public.create_game_room(text, int, text, text) from public, anon;
grant execute on function public.create_game_room(text, int, text, text) to authenticated;


-- ============================================================
-- 4) join_game_room: per Code beitreten, ersten freien Sitzplatz
--    belegen. Kein Beitritt möglich, wenn Raum voll, schon gestartet
--    oder das eigene Konto schon drin sitzt.
-- ============================================================
create or replace function public.join_game_room(
    p_room_code text,
    p_player_name text,
    p_color text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_room record;
    v_seat int;
    v_taken_seats int[];
    v_name text;
    v_existing_seat int;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select id, max_players, status into v_room
    from public.game_rooms
    where room_code = upper(btrim(p_room_code))
    for update;

    if v_room.id is null then
        raise exception 'room_not_found';
    end if;
    if v_room.status = 'finished' then
        raise exception 'room_already_started';
    end if;

    -- Wiederverbindung: dasselbe Konto sitzt schon hier (z. B. nach
    -- Verbindungsabbruch) - einfach den bestehenden Platz zurückgeben,
    -- statt einen Fehler zu werfen oder doppelt beizutreten.
    select seat into v_existing_seat
    from public.game_room_players where room_id = v_room.id and user_id = auth.uid();
    if v_existing_seat is not null then
        update public.game_room_players set connected = true
        where room_id = v_room.id and user_id = auth.uid();
        return jsonb_build_object('room_id', v_room.id, 'seat', v_existing_seat);
    end if;

    if v_room.status <> 'waiting' then
        raise exception 'room_already_started';
    end if;

    select coalesce(array_agg(seat), array[]::int[]) into v_taken_seats
    from public.game_room_players where room_id = v_room.id;

    v_seat := null;
    for i in 0..(v_room.max_players - 1) loop
        if not (i = any(v_taken_seats)) then
            v_seat := i;
            exit;
        end if;
    end loop;

    if v_seat is null then
        raise exception 'room_full';
    end if;

    v_name := coalesce(nullif(btrim(p_player_name), ''), 'Spieler ' || (v_seat + 1));

    insert into public.game_room_players (room_id, user_id, seat, color, player_name, is_ai, ready)
    values (v_room.id, auth.uid(), v_seat, p_color, v_name, false, false);

    return jsonb_build_object('room_id', v_room.id, 'seat', v_seat);
end;
$$;

revoke all on function public.join_game_room(text, text, text) from public, anon;
grant execute on function public.join_game_room(text, text, text) to authenticated;


-- ============================================================
-- 5) set_player_ready: eigenen Bereitschaftsstatus setzen.
-- ============================================================
create or replace function public.set_player_ready(p_room_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    update public.game_room_players
    set ready = p_ready
    where room_id = p_room_id and user_id = auth.uid();

    if not found then
        raise exception 'Du sitzt nicht in diesem Raum';
    end if;

    update public.game_rooms set last_active_at = now() where id = p_room_id;
end;
$$;

revoke all on function public.set_player_ready(uuid, boolean) from public, anon;
grant execute on function public.set_player_ready(uuid, boolean) to authenticated;


-- ============================================================
-- 6) host_set_seat: Gastgeber setzt einen freien Sitzplatz auf
--    Computer oder räumt ihn wieder frei. Nur vor Spielbeginn, nur
--    für unbesetzte oder KI-Plätze (kein Hinauswurf echter Spieler).
-- ============================================================
create or replace function public.host_set_seat(p_room_id uuid, p_seat int, p_is_ai boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_room record;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select id, host_id, status, max_players into v_room
    from public.game_rooms where id = p_room_id for update;

    if v_room.id is null or v_room.host_id <> auth.uid() then
        raise exception 'Nur der Gastgeber darf das ändern';
    end if;
    if v_room.status <> 'waiting' then
        raise exception 'Die Partie läuft schon';
    end if;
    if p_seat < 0 or p_seat >= v_room.max_players then
        raise exception 'Ungültiger Sitzplatz';
    end if;

    if p_is_ai then
        if exists (
            select 1 from public.game_room_players
            where room_id = p_room_id and seat = p_seat and is_ai = false
        ) then
            raise exception 'Auf diesem Platz sitzt schon ein Mensch';
        end if;
        insert into public.game_room_players (room_id, user_id, seat, player_name, is_ai, ready)
        values (p_room_id, null, p_seat, 'Computer ' || (p_seat + 1), true, true)
        on conflict (room_id, seat) do update set is_ai = true, ready = true, player_name = excluded.player_name
        where public.game_room_players.is_ai = true;
    else
        delete from public.game_room_players
        where room_id = p_room_id and seat = p_seat and is_ai = true;
    end if;
end;
$$;

revoke all on function public.host_set_seat(uuid, int, boolean) from public, anon;
grant execute on function public.host_set_seat(uuid, int, boolean) to authenticated;


-- ============================================================
-- 7) leave_game_room: Sitzplatz freiwillig aufgeben. Vor Spielbeginn
--    wird der Platz vollständig frei; während einer laufenden Partie
--    bleibt der Platz reserviert und wird nur als getrennt markiert
--    (sonst würden Sitzplatz-Indizes mitten im Spielzustand kaputt-
--    gehen) - siehe Bericht "Verbindungsabbruch".
-- ============================================================
create or replace function public.leave_game_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select status into v_status from public.game_rooms where id = p_room_id;
    if v_status is null then
        raise exception 'room_not_found';
    end if;

    if v_status = 'waiting' then
        delete from public.game_room_players where room_id = p_room_id and user_id = auth.uid();
    else
        update public.game_room_players set connected = false
        where room_id = p_room_id and user_id = auth.uid();
        update public.game_rooms set status = 'paused', last_active_at = now()
        where id = p_room_id and status = 'playing';
    end if;
end;
$$;

revoke all on function public.leave_game_room(uuid) from public, anon;
grant execute on function public.leave_game_room(uuid) to authenticated;


-- ============================================================
-- 8) start_game_room: nur der Gastgeber, nur wenn alle menschlichen
--    Mitspieler (außer ihm selbst - er startet ja gerade) bereit
--    sind und mindestens 2 Plätze besetzt sind. Setzt nur den Status;
--    den eigentlichen Anfangszustand (gemischtes Deck, verteilte
--    Karten bzw. Spielbrett-Start) erzeugt der Gastgeber-Client mit
--    derselben Engine wie lokal und schreibt ihn direkt danach über
--    submit_room_state() (Version 0 -> 1).
-- ============================================================
create or replace function public.start_game_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_room record;
    v_seats int;
    v_not_ready int;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select id, host_id, status into v_room from public.game_rooms where id = p_room_id for update;
    if v_room.id is null or v_room.host_id <> auth.uid() then
        raise exception 'Nur der Gastgeber darf starten';
    end if;
    if v_room.status <> 'waiting' then
        raise exception 'Die Partie läuft schon';
    end if;

    select count(*) into v_seats from public.game_room_players where room_id = p_room_id;
    if v_seats < 2 then
        raise exception 'Mindestens 2 Plätze müssen besetzt sein';
    end if;

    select count(*) into v_not_ready
    from public.game_room_players
    where room_id = p_room_id and ready = false;
    if v_not_ready > 0 then
        raise exception 'Noch nicht alle Mitspieler sind bereit';
    end if;

    update public.game_rooms
    set status = 'playing', last_active_at = now(), expires_at = now() + interval '6 hours'
    where id = p_room_id;
end;
$$;

revoke all on function public.start_game_room(uuid) from public, anon;
grant execute on function public.start_game_room(uuid) to authenticated;


-- ============================================================
-- 9) submit_room_state: NUR der Gastgeber darf den gemeinsamen
--    Zustand fortschreiben - state_version verhindert doppelte oder
--    veraltete Schreibversuche (der Aufrufer muss die von ihm zuletzt
--    bekannte Version mitschicken; weicht sie ab, schlägt die
--    Funktion fehl und der Client muss den Zustand neu laden statt
--    blind zu überschreiben).
-- ============================================================
create or replace function public.submit_room_state(
    p_room_id uuid,
    p_expected_version bigint,
    p_public_info jsonb,
    p_state jsonb default null,
    p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_room record;
    v_new_version bigint;
    v_new_status text;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select id, host_id, status, state_version into v_room
    from public.game_rooms where id = p_room_id for update;

    if v_room.id is null or v_room.host_id <> auth.uid() then
        raise exception 'Nur der Gastgeber darf den Zustand schreiben';
    end if;
    if v_room.state_version <> p_expected_version then
        raise exception 'version_conflict';
    end if;
    if p_status is not null and p_status not in ('waiting', 'playing', 'paused', 'finished') then
        raise exception 'Ungültiger Status: %', p_status;
    end if;

    v_new_version := v_room.state_version + 1;
    v_new_status := coalesce(p_status, v_room.status);

    update public.game_rooms
    set public_info = p_public_info,
        state = coalesce(p_state, state),
        state_version = v_new_version,
        status = v_new_status,
        last_active_at = now(),
        expires_at = now() + interval '6 hours'
    where id = p_room_id;

    return jsonb_build_object('state_version', v_new_version);
end;
$$;

revoke all on function public.submit_room_state(uuid, bigint, jsonb, jsonb, text) from public, anon;
grant execute on function public.submit_room_state(uuid, bigint, jsonb, jsonb, text) to authenticated;


-- ============================================================
-- 10) load_room_state: für Erstladen und Wiederverbindung. Gibt den
--     Raum, alle Sitzplätze und public_info an jedes Mitglied zurück.
--     WICHTIG (Handkarten-Schutz bei Miro): die volle state-Spalte
--     wird NIE roh zurückgegeben. Nur die eigene Hand des Aufrufers
--     wird - falls im Zustand vorhanden - als eigenes Feld my_hand
--     herausgelöst. Bei Mirelons Jagd gibt es keine geheime
--     Information, dort ist public_info bereits der volle Zustand.
-- ============================================================
create or replace function public.load_room_state(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_room record;
    v_my_seat int;
    v_my_hand jsonb;
    v_my_pending_cards jsonb;
    v_players jsonb;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    select id, room_code, game_type, host_id, status, max_players, public_info, state, state_version
    into v_room
    from public.game_rooms where id = p_room_id;

    if v_room.id is null then
        raise exception 'room_not_found';
    end if;

    select seat into v_my_seat
    from public.game_room_players
    where room_id = p_room_id and user_id = auth.uid();

    if v_my_seat is null then
        raise exception 'Du bist kein Mitglied dieses Raums';
    end if;

    -- Eigene Hand herauslösen (nur Miro nutzt das players[].hand-Layout
    -- mit geheimer Information; existiert der Pfad nicht, bleibt
    -- my_hand einfach null).
    if v_room.game_type = 'miro' and v_room.state is not null then
        v_my_hand := v_room.state #> array['players', v_my_seat::text, 'hand'];
        -- Schatzfund: die zwei gezogenen Karten nur herausreichen, wenn
        -- ich selbst gerade wähle - sonst bleibt es bei der Anzahl
        -- (siehe miro-multiplayer-adapter.js redactForEveryone()).
        if (v_room.state #>> array['pending', 'type']) = 'treasure'
           and (v_room.state #>> array['pending', 'actorId'])::int = v_my_seat then
            v_my_pending_cards := v_room.state #> array['pending', 'cards'];
        end if;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'seat', seat, 'user_id', user_id, 'color', color, 'player_name', player_name,
        'is_ai', is_ai, 'ready', ready, 'connected', connected
    ) order by seat), '[]'::jsonb)
    into v_players
    from public.game_room_players where room_id = p_room_id;

    return jsonb_build_object(
        'room_id', v_room.id,
        'room_code', v_room.room_code,
        'game_type', v_room.game_type,
        'host_id', v_room.host_id,
        'status', v_room.status,
        'max_players', v_room.max_players,
        'public_info', v_room.public_info,
        'state_version', v_room.state_version,
        'my_seat', v_my_seat,
        'my_hand', v_my_hand,
        'my_pending_cards', v_my_pending_cards,
        'players', v_players
    );
end;
$$;

revoke all on function public.load_room_state(uuid) from public, anon;
grant execute on function public.load_room_state(uuid) to authenticated;


-- ============================================================
-- 11) expire_stale_game_rooms: räumt abgelaufene/beendete Räume auf.
--     Kein automatischer Job hier (kein pg_cron) - bewusst nur die
--     Funktion, damit nichts von dieser Migration selbst anfängt zu
--     laufen. Simon/Codex können sie später an einen Scheduler
--     hängen oder von Hand aufrufen.
-- ============================================================
create or replace function public.expire_stale_game_rooms()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    delete from public.game_rooms
    where expires_at < now()
       or (status = 'finished' and last_active_at < now() - interval '1 day');
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

-- Bewusst kein GRANT an authenticated/anon - nur für Wartung von
-- Hand oder durch einen künftigen Scheduler mit Service-Role.
revoke all on function public.expire_stale_game_rooms() from public, anon, authenticated;


-- ============================================================
-- Ende. Nach dem Ausführen prüfen:
--   select proname from pg_proc where pronamespace = 'public'::regnamespace
--     and proname in ('create_game_room','join_game_room','set_player_ready',
--     'host_set_seat','leave_game_room','start_game_room','submit_room_state',
--     'load_room_state','expire_stale_game_rooms','generate_room_code');
--   select has_table_privilege('authenticated','public.game_rooms','SELECT'); -- false
--   select has_table_privilege('authenticated','public.game_room_players','SELECT'); -- false
-- ============================================================
