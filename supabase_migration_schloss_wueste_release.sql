-- ============================================================
-- Your Journey – Migration: Wüstenschloss-Design Preis + Level
-- (2026-09-09) – AUSGEFÜHRT ALS 20260909121253 wuestenschloss_preis_level
-- ============================================================
-- Baut auf:
--   supabase_migration_schloss_styles.sql   (schloss_styles, purchase_schloss_style,
--                                            sync_player_data, project_player_data,
--                                            claim_castle_starter_setup, Backfill, RLS)
--   supabase_migration_wueste_moebel.sql     (schloss_furniture Wüstenmöbel active=false)
--
-- Setzt für das Wüstenschloss-Design den finalen Freischalt-Level und
-- Münzpreis:
--   schloss_styles.wueste : required_level = 8, coin_price = 250
--
-- public_available BLEIBT false. Das Design erscheint dadurch NICHT im
-- öffentlichen "Raum gestalten"-Wähler und kann nicht gekauft werden
-- (purchase_schloss_style lehnt mit "Stil noch nicht verfügbar" ab, der
-- Client zeigt es nur über ?style=wueste in der 3D-Szene). Diese
-- Migration ist damit gefahrlos einspielbar, sobald buildDesertShell +
-- Texturen + Stilwechsel + Speicherung + Tests lokal abgenommen sind –
-- sie schaltet NICHTS öffentlich frei.
--
-- KEINE RPC-Änderung nötig:
--   * purchase_schloss_style  liest required_level + coin_price + public_available,
--     prüft Level + Münzen, sperrt per "for update" gegen Doppelklick,
--     ist im already-owned-Pfad idempotent (kein zweiter Münzabzug). Geprüft.
--   * sync_player_data        schützt/validiert schloss.ownedStyles +
--     schloss.starterSetupCompleted bereits (kein Client-Schreibzugriff).
--   * project_player_data     projiziert castle_style:<key>-Unlocks additiv.
--   * claim_guest_progress    kopiert schloss verbatim (kein Stilbezug).
--   * schloss_styles / schloss_starter_furniture: RLS an, 0 Policies
--     (server-only). Grants unverändert. Nichts anzupassen.
--
-- Bestehende Besitzer + Alt-Spielstände: unberührt. Wer 'wueste' schon
-- in ownedStyles hat (heute niemand – Design war nie kaufbar), behält es;
-- der already-owned-Pfad der RPC greift.
--
-- Idempotent: reines UPDATE mit festen Werten, beliebig oft ausführbar.
-- ============================================================


-- 1) Preis + Level für das Wüstenschloss-Design -----------------------
update public.schloss_styles
set required_level = 8,
    coin_price     = 250,
    updated_at     = now()
where style_key = 'wueste'
  and (required_level is distinct from 8 or coin_price is distinct from 250);


-- ============================================================
-- Live geprüft nach dem Ausführen:
--   select style_key, required_level, coin_price, public_available, starter_eligible
--   from public.schloss_styles order by sort;
--   -> wueste: required_level 8 | coin_price 250 | public_available FALSE
--
-- Angemeldete Kauf-/Fehlerpfade testen (in begin ... rollback, per
-- set_config('request.jwt.claims', ...) impersoniert):
--   * Level < 8            -> "Stufe 8 nötig (du hast N)"
--   * Level ok, Münzen < 250 -> "Nicht genug Münzen (brauchst 250, hast N)"
--   * Level ok, Münzen ok, public_available=false -> "Stil noch nicht verfügbar: wueste"
--     (bleibt so bis zur Release-Migration unten)
-- ============================================================


-- ============================================================
-- === WÜSTEN-RELEASE (SEPARAT, ERST WENN DIE WÜSTE ÖFFENTLICH GEHT) ===
-- NICHT Teil dieser Migration. Eigene Migration zum Launch:
--
--   -- Design öffentlich kaufbar machen
--   update public.schloss_styles set public_available = true, updated_at = now()
--   where style_key = 'wueste';
--
--   -- Wüstenmöbel aktiv schalten (Spiegel: JS/schloss-data.js active-Flag raus)
--   update public.schloss_furniture set active = true
--   where id in ('wuesten_hocker_a','mosaiktisch_a','oasenpflanze_a',
--                'wuesten_laterne_a','wuesten_kommode_a','kelim_teppich_a',
--                'wuesten_wandbild_a');
--
--   -- Client: SCHLOSS_STYLES.wueste.publicAvailable = true,
--   --         SCHLOSS_FURNITURE: active:false aus den 7 Einträgen entfernen.
--
-- Danach: angemeldeter Kauf über "Für 250 Münzen kaufen", sofort besessen
-- + auswählbar, Stilwechsel/Reload/Cloud-Sync prüfen.
-- ============================================================
