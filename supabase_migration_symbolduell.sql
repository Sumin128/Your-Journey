-- Mirelons Symbolduell: serverseitig erlaubte XP-Belohnung.
-- Der Browser meldet nur diese Aktivitaetskennung; die 25 XP legt der
-- Server fest. Mehrfachvergabe derselben Partie verhindert p_round_id.
-- Live ausgefuehrt: 20260913191752 symbolduell_xp_rule

insert into public.game_xp_rules
    (activity, xp_leicht, xp_normal, xp_schwer, repeat_rule, cooldown_seconds,
     counts_towards_daily_cap, active, updated_at)
values
    ('symbolduell_gewonnen', 25, 25, 25, 'per_round', 64800, true, true, now())
on conflict (activity) do update set
    xp_leicht                = excluded.xp_leicht,
    xp_normal                = excluded.xp_normal,
    xp_schwer                = excluded.xp_schwer,
    repeat_rule              = excluded.repeat_rule,
    cooldown_seconds         = excluded.cooldown_seconds,
    counts_towards_daily_cap = excluded.counts_towards_daily_cap,
    active                   = excluded.active,
    updated_at               = now();
