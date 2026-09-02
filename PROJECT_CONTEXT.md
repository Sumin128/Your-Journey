# Mirelon – Projektkontext

> **Verbindlich vor jeder Änderung:** Zuerst diese Datei lesen. Für betroffene Features zusätzlich die passende Datei unter `docs/` lesen. Fehlt belastbarer Kontext, **nicht raten und nicht kreativ interpretieren**, sondern nachfragen. Feature-Spezifikationen haben Vorrang vor allgemeinen Annahmen.

## Arbeitsrahmen

- Mirelon ist kinderfreundlich: hell, freundlich, magisch und gut lesbar. Keine Horror- oder Blutästhetik.
- Bestehende Funktionen nicht unnötig neu erfinden; zuerst vorhandene Bausteine und Datenflüsse prüfen und erweitern, wenn das fachlich passt.
- Keine Commits oder Pushes ohne ausdrücklichen Auftrag.
- Bei Änderungen immer prüfen, ob Datenschutzerklärung, Impressum oder sonstige Nutzerinformationen angepasst werden müssen.
- Für das Kartenraten-Spiel ist [`docs/wer-ist-es.md`](docs/wer-ist-es.md) die verbindliche Spezifikation.

## Tatsächlich vorhandene Architektur

Mirelon ist derzeit eine statische Website ohne erkennbaren Build-Schritt:

- Die Seiten liegen als HTML-Dateien im Projektroot (unter anderem Startseite, Bärental, Eulenschule, Fuchs, Galerie, Shop, Einstellungen und Impressum).
- Styling liegt in `CSS/` (`style.css`, `baerental.css`, `puzzle.css`); Funktionslogik liegt in `JS/`.
- Bilder, Icons, Sounds, Schriftarten, Avatare und Figuren liegen in eigenen Asset-Ordnern (`images/`, `Icons/`, `Sounds/`, `Fonts/`, `avatare/`, `charaktere/`).
- `vercel.json` setzt Cache-Header für die statischen Seiten und Asset-Ordner.
- Die Startseite lädt Supabase JS aus einem CDN sowie unter anderem `JS/player.js`, `JS/auth.js`, `JS/sidebar.js`, `JS/bugreport.js`, `JS/sounds.js`, `JS/data.js`, `JS/index.js` und `JS/map-sparkles.js`.
- Der zentrale Browser-Spielstand liegt in `JS/player.js`. Ohne angemeldetes Konto wird der Gast-Spielstand in `localStorage` unter `player` gespeichert.
- `JS/auth.js` ergänzt optionalen Konto-Sync mit Supabase. Bei angemeldetem Konto wird nicht in den lokalen Gast-Speicherplatz geschrieben; Account-Daten werden aus der Cloud geladen bzw. serverseitig synchronisiert. Ein Gastfortschritt kann nur bewusst und einmalig übernommen werden; der lokale Gast-Spielstand wird dabei nicht gelöscht.
- Bärental enthält das Tierkarten-/Ratespiel: `JS/animals.js` enthält die Kartendaten, `JS/baerental.js` führt Fragen, Filterung und Rateablauf aus.
- Die SQL-Dateien `supabase_schema.sql`, `supabase_migration_security_player_data.sql` und `supabase_migration_guest_progress_claim.sql` dokumentieren die Datenbank- und Schutzlogik.

## Spielstände und Server-Schutz

- Gast- und Account-Spielstände strikt getrennt halten. Account-Daten dürfen nicht versehentlich in den Gast-Speicher geschrieben werden und umgekehrt.
- Für angemeldete Konten sind Münzen, wertvolle Items und Verbrauchsgegenstände serverseitig geschützt. Die vorgesehenen RPC-/SQL-Wege für Synchronisierung, Münzverdienst, Käufe, Verbrauch und Gastfortschritt-Übernahme respektieren; keine clientseitige Umgehung oder frei erfundene Werte einführen.
- Bei Änderungen an Spielstand, Shop, Belohnungen, Inventar oder Anmeldung die vorhandenen JavaScript- und SQL-Schutzpfade gemeinsam betrachten.

## Dokumentationsstruktur

- `PROJECT_CONTEXT.md`: Einstiegspunkt und projektweite, verifizierte Leitplanken.
- `docs/wer-ist-es.md`: Source of Truth für das Tierkarten-/Ratespiel und künftige Tier-Superhelden-Karten.
- `AGENTS.md`: knapper Wegweiser für Agenten und Tools; verweist verpflichtend auf diese Datei.

Diese Dokumentation beschreibt den geprüften aktuellen Stand. Bei späteren Änderungen nur Fakten ergänzen, die in Code, Konfiguration oder ausdrücklich freigegebener Spezifikation belegt sind.
