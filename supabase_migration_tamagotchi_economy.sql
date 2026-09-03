-- ============================================================
-- Mirelon – Zauber-Gefährte: Münz-Abfluss + Stufen-Belohnung
-- ============================================================
-- Eigenstaendige, idempotente Migration. Baut auf der bestehenden
-- Sicherheitsarchitektur auf (supabase_migration_security_player_data.sql,
-- reward_cooldowns-Tabelle).
--
-- Hintergrund: Der Gefaehrte war bisher ein rein clientseitiger
-- Muenz-Abfluss - fuer angemeldete Konten wurde der Abzug beim naechsten
-- sync_player_data() wieder ueberschrieben (coins ist geschuetzt), die
-- Anzeige "flackerte" also nur. Jetzt laeuft Fuettern/Trinken ueber
-- spend_coins(), die Stufen-Belohnung ueber
-- claim_tamagotchi_levelup_reward() - beide serverseitig maessgeblich.
--
-- Anleitung: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- diesen kompletten Inhalt einfuegen -> "Run". Mehrfach ausfuehrbar.
-- ============================================================


-- ============================================================
-- 1) spend_coins(p_reason): einzige Route, um Muenzen fuer die
--    Gefaehrten-Pflege abzuziehen. Der Client liefert NUR den Grund,
--    NIE einen Betrag - die Kosten stehen unten fest und muessen zu
--    JS/tamagotchi.js (FOOD/DRINK) passen. Kein Cooldown noetig: ein
--    Abzug kann nicht zum Vorteil ausgenutzt werden, und der eigene
--    Kontostand begrenzt ihn ohnehin.
-- ============================================================
create or replace function public.spend_coins(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    cost int;
    current_data jsonb;
    current_coins numeric;
    new_coins numeric;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    cost := case p_reason
        when 'tamagotchi_feed_beeren' then 1
        when 'tamagotchi_feed_honig'  then 3
        when 'tamagotchi_feed_stern'  then 8
        when 'tamagotchi_drink_wasser' then 1
        when 'tamagotchi_drink_trank'  then 5
        else null
    end;

    if cost is null then
        raise exception 'Unbekannter Ausgabegrund: %', p_reason;
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

    if current_coins < cost then
        raise exception 'Nicht genug Münzen (brauchst %, hast %)', cost, current_coins;
    end if;

    new_coins := current_coins - cost;

    update public.profiles
    set player_data = (current_data - 'feathers') || jsonb_build_object('coins', new_coins),
        updated_at = now()
    where id = auth.uid();

    return jsonb_build_object('coins', new_coins, 'spent', cost);
end;
$$;


-- ============================================================
-- 2) claim_tamagotchi_levelup_reward(): wird vom Client bei jedem
--    Stufenaufstieg des Gefaehrten aufgerufen. Wuerfelt serverseitig:
--    entweder 10-30 Muenzen oder 1-5 Feuerwerkskoerper.
--
--    Anti-Replay ueber reward_cooldowns (Grund 'tamagotchi_levelup',
--    Mindestabstand 60 s). Eine echte Stufe dauert mit der langsameren
--    XP-Kurve deutlich laenger als 60 s - der Cooldown deckelt nur das
--    stumpfe Nachbehaupten. Die Gefaehrten-Stufe selbst liegt
--    clientseitig in player.tamagotchi.level; sie laesst sich nicht
--    serverseitig verifizieren. Der Cooldown + die kleine Belohnung
--    halten den Missbrauchsanreiz gering (Pflege kostet unterm Strich
--    mehr, als die Belohnung einbringt).
-- ============================================================
create or replace function public.claim_tamagotchi_levelup_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    cooldown_seconds constant int := 60;
    current_data jsonb;
    give_coins boolean;
    coin_amount int;
    fw_amount int;
    current_coins numeric;
    current_total numeric;
    current_golden numeric;
    current_fw numeric;
begin
    if auth.uid() is null then
        raise exception 'Nicht angemeldet';
    end if;

    insert into public.reward_cooldowns as rc (user_id, reason, last_claimed_at)
    values (auth.uid(), 'tamagotchi_levelup', now())
    on conflict (user_id, reason) do update
        set last_claimed_at = excluded.last_claimed_at
        where rc.last_claimed_at <= now() - (cooldown_seconds || ' seconds')::interval;

    if not found then
        raise exception 'Zu schnell hintereinander';
    end if;

    select player_data into current_data
    from public.profiles
    where id = auth.uid()
    for update;

    if current_data is null then
        current_data := '{}'::jsonb;
    end if;

    give_coins := random() < 0.5;

    if give_coins then
        coin_amount := 10 + floor(random() * 21)::int;   -- 10..30

        current_coins := coalesce((current_data->>'coins')::numeric, (current_data->>'feathers')::numeric, 0);
        current_total := coalesce((current_data->>'totalCoinsEarned')::numeric, (current_data->>'totalFeathersEarned')::numeric, 0);
        current_golden := coalesce((current_data->>'goldenFeathers')::numeric, 0);

        current_coins := current_coins + coin_amount;
        current_total := current_total + coin_amount;
        current_golden := greatest(current_golden, floor(current_total / 100));

        update public.profiles
        set player_data = (current_data - 'feathers' - 'totalFeathersEarned') || jsonb_build_object(
                'coins', current_coins,
                'totalCoinsEarned', current_total,
                'goldenFeathers', current_golden
            ),
            updated_at = now()
        where id = auth.uid();

        return jsonb_build_object('kind', 'coins', 'amount', coin_amount,
            'coins', current_coins, 'totalCoinsEarned', current_total, 'goldenFeathers', current_golden);
    else
        fw_amount := 1 + floor(random() * 5)::int;        -- 1..5

        current_fw := coalesce((current_data->'consumables'->>'feuerwerk')::numeric, 0) + fw_amount;

        update public.profiles
        set player_data = current_data || jsonb_build_object(
                'consumables',
                coalesce(current_data->'consumables', '{}'::jsonb) || jsonb_build_object('feuerwerk', current_fw)
            ),
            updated_at = now()
        where id = auth.uid();

        return jsonb_build_object('kind', 'feuerwerk', 'amount', fw_amount, 'feuerwerk', current_fw);
    end if;
end;
$$;


-- 3) EXECUTE-Rechte
revoke all on function public.spend_coins(text) from public, anon;
grant execute on function public.spend_coins(text) to authenticated;

revoke all on function public.claim_tamagotchi_levelup_reward() from public, anon;
grant execute on function public.claim_tamagotchi_levelup_reward() to authenticated;
