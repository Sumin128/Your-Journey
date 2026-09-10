-- ============================================================
-- Your Journey – Migration: Schloss-Stile – Kaufrhythmus
-- (2026-09-10) – NOCH NICHT AUSGEFÜHRT
-- ============================================================
-- Baut auf: supabase_migration_schloss_styles.sql
--   (public.schloss_styles, purchase_schloss_style, claim_castle_starter_setup)
--
-- Fachlicher Hintergrund:
--   Stufe 3  -> erstes Schloss-Design gratis (Starter-Wahl, beliebig).
--   Danach   -> je Design 250 Münzen, ein weiteres alle 4 Stufen.
--
-- Zwei Anpassungen am reinen Daten-Katalog schloss_styles:
--   1. 'wald'  bekommt coin_price = 250. Bisher NULL -> purchase_schloss_style
--      lehnte den Nachkauf ab. Wer beim Starter 'wueste' wählt, konnte 'wald'
--      nie zurückholen.
--   2. 'wueste' rückt von required_level 8 auf 7 (= 3 + 4), damit der
--      Kaufrhythmus "alle 4 Stufen" stimmt.
--
-- Kein Eingriff in Funktionen, Trigger, RLS. Nur zwei UPDATE-Zeilen.
-- Idempotent – mehrfaches Ausführen ändert nach dem ersten Lauf nichts.
-- Client-Spiegel: JS/schloss-data.js (SCHLOSS_STYLES) ist bereits angepasst.
-- Anleitung: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- ============================================================

update public.schloss_styles
set coin_price = 250, updated_at = now()
where style_key = 'wald' and coin_price is distinct from 250;

update public.schloss_styles
set required_level = 7, updated_at = now()
where style_key = 'wueste' and required_level is distinct from 7;

-- Kontrolle (nur als DB-Owner):
--   select style_key, required_level, coin_price, public_available, starter_eligible, sort
--   from public.schloss_styles order by sort;
--   -> wald:   3 / 250 / true / true
--   -> wueste: 7 / 250 / true / true
-- ============================================================
