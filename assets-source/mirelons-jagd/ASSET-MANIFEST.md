# Mirelons Jagd – Asset-Paket

## Feste Spielvorgaben

- Eigenständiges Brettspiel mit 48 Feldern auf einem geschlossenen Rundweg.
- Vier Regionen: Wurzelwald (oben links), Wüstendünen (oben rechts), Frostberge (unten rechts), Rosenauen (unten links).
- Vier Spielerfarben mit je vier Figuren: Grün/Fuchs, Gold/Löwe, Eisblau/Eule, Rosenrot/Hase.
- Standardpartie: vier Figuren je Spieler. Vor dem Spiel später wählbar: zwei, drei oder vier Figuren.
- Die Felder, Zielwege, Ereignisbelegung und Spiellogik werden präzise im Code über die dekorative Brettgrafik gelegt.

## Produktionsdateien

- `spielfeld-gemini-gpt-master.png`: finale hochauflösende Brettgrundlage; Gemini-Komposition, anschließend gezielt mit GPT korrigiert.
- `spielfiguren-4er-sheet.png`: Originalbogen der vier Spielfiguren.
- `aktionssymbole-11er-sheet.png`: Originalbogen der elf Ereignissymbole.
- `wuerfel-reference.png`: freigestellte Referenz für die Tripo-3D-Erzeugung.
- `spielfeld-mirelons-jagd-v2-master.png`: aktuelles Brett mit freigestellten Ecklagern, breitem Rundkurs und vier sichtbaren Zielwegen zum Schloss.
- Die 48 Lauf- und 16 möglichen Zielfelder werden datengetrieben durch `jagd-ui.js` gerendert. Die ältere `spielfeld-felder-overlay.svg` ist nur noch Referenz und wird nicht geladen.
- `qa-sprites.jpg`: Kontrollbogen der einzeln ausgeschnittenen Web-Sprites.

## Spielfertige Dateien

Unter `images/mirelons-jagd/`:

- `spielfeld-mirelons-jagd.webp` – 1254 × 1254, opake Bretttextur.
- `spielfeld-felder-overlay.svg` – 48 klar getrennte Rundwegfelder: Elfenbein = normal, Violett/Gold = Aktion, Türkis = Rast/Schutz, Spielerfarbe = Start.
- Vier Figuren-Sprites – je 512 × 512 PNG mit echtem Alpha.
- Elf Ereignis-Sprites – je 512 × 512 PNG mit echtem Alpha.
- `wuerfel.glb` – deterministischer spielfertiger Würfel: 57 KB, 1.770 Vertices, 2.068 Dreiecke, korrekte Gegenseiten 1/6, 2/5 und 3/4.

## Qualitätsprüfung

- Alle 15 Einzel-Sprites besitzen echten Alpha-Kanal (`0–255`).
- Alle vier Bildecken sind vollständig transparent.
- Kein Motiv berührt den Bildrand; Sicherheitsabstand mindestens 26 px.
- Figuren sind vollständig inklusive Sockel ausgeschnitten.
- Ereignissymbole sind einzeln, klar lesbar und ohne fremde Bestandteile ausgeschnitten.
- Brett ist vollständig, quadratisch, ohne Text oder Markenfiguren und hat keine eingebrannten Spielfeld-Unterteilungen.
- Kamera-Ziel: leicht geneigte Draufsicht. Alle 48 Felder bleiben sichtbar; Figuren werden als aufrechte, zur Kamera ausgerichtete Spielsteine gezeigt.

## Tripo-Prüfung

- Verbraucht: 150 Credits (ein erster Versuch + vier verbesserte Kandidaten).
- Alle Tripo-Dateien bleiben als Produktionsmaterial unter `tripo-wuerfel/` und `tripo-wuerfel-kandidaten/` erhalten.
- Kein Tripo-Modell wurde als spielbestimmender Würfel übernommen: Kandidaten 2/4 hatten sichtbare Fehlgeometrie; Kandidaten 1/3 sahen frontal gut aus, hatten auf Rückseiten aber falsche doppelte Punktzahlen bzw. Texturartefakte.
- Der Hauptwürfel wird deshalb reproduzierbar durch `build_wuerfel_glb.py` erzeugt. Damit stimmen sichtbare Seite und Spielwert garantiert überein.
