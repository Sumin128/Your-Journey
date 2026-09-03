-- ============================================================
-- Mirelon – EXECUTE-Rechte von use_consumable_item() angleichen
-- ============================================================
-- Kleine, idempotente Migration. use_consumable_item() hat intern
-- schon einen "Nicht angemeldet"-Guard; anon soll die Funktion aber
-- gar nicht erst aufrufen duerfen - so wie spend_coins(),
-- claim_tamagotchi_levelup_reward(), purchase_item() und
-- purchase_consumable_bundle().
--
-- Bereits auf dem Projekt angewendet (Migration
-- "tighten_use_consumable_item_grants").
-- ============================================================

revoke all on function public.use_consumable_item(text) from public, anon;
grant execute on function public.use_consumable_item(text) to authenticated;
