-- ============================================================
-- Your Journey – Migration: erste Wüstenschloss-Möbel
-- (2026-09-09) – ENTWURF, NOCH NICHT AUSGEFÜHRT
-- ============================================================
-- Baut auf:
--   supabase_migration_schloss_shop.sql            (schloss_furniture, purchase_schloss_furniture)
--   supabase_migration_schloss_styles.sql          (schloss_styles, schloss_starter_furniture, FKs)
--
-- Fügt hinzu:
--   1. 7 neue Zeilen in public.schloss_furniture (die Wüstenmöbel),
--      zunächst mit active = FALSE -> purchase_schloss_furniture() lehnt
--      sie noch ab, Tamos Werkstatt zeigt sie nicht. Zum Wüsten-Launch
--      per Folge-Migration auf true (+ Client-Katalog: active-Flag raus).
--      Client-Katalog: SCHLOSS_FURNITURE in JS/schloss-data.js
--      (collection: "wueste", active: false) – von Hand synchron halten.
--   2. Starterpool-Zeilen für den Raumstil 'wueste' in
--      public.schloss_starter_furniture (1 Sitz + 4 Deko). Der Starter-RPC
--      filtert ohnehin auf schloss_furniture.active -> greift erst nach dem
--      Aktivieren; bis dahin ist der Wüsten-Raumstil auch nicht wählbar.
--
-- WICHTIG – Datenmodell:
--   "collection" (Wald/Wüste/…) ist eine reine KATALOG-/SHOP-Eigenschaft
--   im Client. Die DB (schloss_furniture) kennt keine Kollektion; Besitz
--   und Kauf sind völlig stilunabhängig. Kein RPC gleicht den aktiven
--   Raumstil gegen eine Möbelkollektion ab. Jedes besessene Möbel ist in
--   jedem Raumdesign nutzbar.
--
-- NICHT Teil dieser Migration (bewusst):
--   - schloss_styles.public_available für 'wueste' bleibt FALSE, kein coin_price.
--
-- Die universellen Wald-Möbel (kerze/rahmen/stehleuchter/wandleuchte_wald_a)
-- brauchen KEINE DB-Änderung – sie behalten collection "wald" im Client und
-- sind wie alle Möbel überall nutzbar.
--
-- Idempotent.
-- ============================================================


-- 1) Wüstenmöbel in den Möbelkatalog (noch INAKTIV) -------------------
insert into public.schloss_furniture (id, price, active) values
    ('wuesten_hocker_a',    14, false),
    ('mosaiktisch_a',       20, false),
    ('oasenpflanze_a',      12, false),
    ('wuesten_laterne_a',   16, false),
    ('wuesten_kommode_a',   26, false),
    ('kelim_teppich_a',     16, false),
    ('wuesten_wandbild_a',  22, false)
on conflict (id) do update set
    price = excluded.price;
    -- active bewusst NICHT im do-update: ein späteres manuelles Aktivieren
    -- (Wüsten-Launch) wird durch erneutes Ausführen nicht zurückgesetzt.


-- 2) Wüsten-Starterpool ------------------------------------------------
--    slot 'seat' = Sitzmöbel, 'decor' = Boden-/Dekostück.
--    NICHT dabei: wuesten_laterne_a (Sonderlicht), wuesten_wandbild_a (Wanddeko).
--    FK auf schloss_furniture.id -> muss nach Block 1 laufen.
insert into public.schloss_starter_furniture (style_key, slot, furniture_id, sort) values
    ('wueste', 'seat',  'wuesten_hocker_a',   10),
    ('wueste', 'decor', 'mosaiktisch_a',      10),
    ('wueste', 'decor', 'oasenpflanze_a',     20),
    ('wueste', 'decor', 'kelim_teppich_a',    30),
    ('wueste', 'decor', 'wuesten_kommode_a',  40)
on conflict (style_key, furniture_id) do update set
    slot = excluded.slot,
    sort = excluded.sort;


-- ============================================================
-- Nach dem Ausführen prüfen:
--   select id, price, active from public.schloss_furniture
--     where id like 'wuesten\_%' or id in ('mosaiktisch_a','oasenpflanze_a','kelim_teppich_a');
--     -> alle active = false
--   select * from public.schloss_starter_furniture where style_key = 'wueste' order by slot, sort;
--   select style_key, public_available, coin_price from public.schloss_styles;  -- wueste weiterhin false / null
--
-- WÜSTEN-LAUNCH später (eigene Migration):
--   update public.schloss_furniture set active = true
--     where id in ('wuesten_hocker_a','mosaiktisch_a','oasenpflanze_a',
--                  'wuesten_laterne_a','wuesten_kommode_a','kelim_teppich_a','wuesten_wandbild_a');
--   + Client: active-Flag aus den 7 SCHLOSS_FURNITURE-Einträgen entfernen
--   + buildDesertShell integriert, schloss_styles: wueste coin_price + public_available=true
-- ============================================================
