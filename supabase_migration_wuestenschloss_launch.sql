-- ============================================================
-- Your Journey – Wüstenschloss öffentlich freischalten
-- ============================================================
-- Atomarer, idempotenter Launch: Design und seine sieben Möbel werden
-- gemeinsam aktiviert. Preis und Freischaltlevel werden zur Sicherheit
-- ebenfalls auf die freigegebenen Werte gesetzt.

do $$
declare
    style_rows integer;
    furniture_rows integer;
begin
    update public.schloss_styles
    set required_level = 8,
        coin_price = 250,
        public_available = true,
        updated_at = now()
    where style_key = 'wueste';

    get diagnostics style_rows = row_count;
    if style_rows <> 1 then
        raise exception 'Wüstenschloss-Stil fehlt oder ist nicht eindeutig';
    end if;

    update public.schloss_furniture
    set active = true
    where id in (
        'wuesten_hocker_a',
        'mosaiktisch_a',
        'oasenpflanze_a',
        'wuesten_laterne_a',
        'wuesten_kommode_a',
        'kelim_teppich_a',
        'wuesten_wandbild_a'
    );

    get diagnostics furniture_rows = row_count;
    if furniture_rows <> 7 then
        raise exception 'Wüstenmöbel unvollständig: erwartet 7, gefunden %', furniture_rows;
    end if;
end $$;
