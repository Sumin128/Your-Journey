# Wer ist es? – Karten- und Bildspezifikation

> **Source of Truth.** Vor jeder Änderung am Tierkarten-/Ratespiel und vor jeder Bildarbeit diese Datei lesen. Bei Widerspruch hat diese Feature-Spezifikation Vorrang vor allgemeinen Projektannahmen.

## Stand: fertig

Das Spiel „Wer ist es?" ist **fertig und aktiv** im Bärental:

- 35 Tierkarten (`images/bear_quiz/*.png`), painterly Porträt-Stil mit Pergamentrahmen + Namensband.
- Merkmalsmatrix in [`JS/animals.js`](../JS/animals.js): `glasses, scarf, headwear, bow, mask, earrings, eyeColor`. Bild und Matrix stimmen 1:1 überein.
- Spiellogik in [`JS/baerental.js`](../JS/baerental.js): Fragen, Kartenfilterung, Raten. Ein Kartenset, kein Moduswechsel.

Bestehende Logik und Kartendaten **nicht ohne ausdrückliche Freigabe umbauen.**

## Verworfen: Tier-Superhelden-Version

Die geplante zweite Kartenserie (Tiere als Superhelden: Maske, Cape, Helm, Emblem, Kraft-Aura …) wurde **gestrichen**. Entfernt: `JS/superhero-cards.js`, `images/bear_quiz_superheroes/`, der Menü-Eintrag im Bärental, die `superheroQuestions`/`superheroCards`-Pfade in `baerental.js`. Falls das Thema je zurückkommt: neue, sauber balancierte 35er-Matrix zuerst festlegen und freigeben lassen, dann erst Bilder – **eine** Testkarte, prüfen, freigeben, dann der Rest.

## Historischer Mirelon-Kartenstil – bindend

Das Referenzbild ist bindend. Exakt übernehmen: Kartenformat, goldener Rahmen, Pixel-Art-Stil, Perspektive, Kameradistanz, Hintergrund, Beleuchtung, Detailgrad sowie Position und Größe des Charakters. **Nicht** die individuellen Merkmale des Referenztiers übernehmen. Tierart, Augenfarbe und Accessoires stammen ausschließlich aus der Matrix.

### Karte

- Klares Hochkant-Rechteck; Tier mittig.
- Vollständig sichtbarer goldener, rechteckiger Retro-Pixel-Art-Rahmen in warmem Gold; hochwertig, aber nicht überladen.
- Auf allen Karten derselbe Rahmenstil; nichts ragt darüber hinaus.
- Ruhiger warmer Innenhintergrund.
- Kein Text, Name, Nummer, Logo oder zusätzliche Symbole.

### Stil

- Warmer, hochwertiger Retro-Pixel-Art-Stil: liebevoller 16-/32-Bit-Fantasyspiel-Look mit moderner hochwertiger Pixel-Art-Qualität.
- Deutlich erkennbare Pixel, warme Farben, gemütliche Fantasy-Atmosphäre, freundlich, kindgerecht aber nicht babyhaft.
- Klare Konturen, gute Kontraste, detailliert aber ruhig.
- Nicht fotorealistisch; kein weiches 3D-Rendering; keine gemalten oder verschwommenen Konturen.
- Wie aus einem hochwertigen Retro-Fantasy-Adventure.

### Einheitliche Komposition aller 35 Karten

- Frontal oder nur leicht gedreht; Gesicht vollständig sichtbar; beide Augen vollständig sichtbar.
- Kopf und Oberkörper sichtbar, mittig und ungefähr gleich groß.
- Gleiche Kameradistanz, Perspektive, Rahmen, Hintergrundart und Beleuchtung.
- Natürliche Körperformen dürfen variieren; das Set muss sofort zusammengehörig wirken.

## Merkmalsregeln

- **Augenfarbe:** eindeutig und kräftig; beide Augen sichtbar.
- **Brille JA:** normale Brille mit transparenten, farblosen Gläsern; die Augenfarbe bleibt sichtbar. Keine Sonnen- oder getönte Brille.
- **Brille NEIN:** keinerlei Brillenart.
- **Kopfbedeckung JA:** deutlicher Hut, Mütze, Kappe oder Ähnliches; Gesicht und Augen frei.
- **Kopfbedeckung NEIN:** nichts auf dem Kopf; auch keine Krone oder Schleife als Ersatz.
- **Maske JA:** klare Gesichtsmaske; Augen und Augenfarbe sichtbar.
- **Maske NEIN:** keine Gesichtsbedeckung.
- **Ohrring JA:** mindestens ein klar sichtbarer Ohrring.
- **Ohrring NEIN:** keinerlei Ohrschmuck.
- **Schal/Halstuch JA:** klar sichtbar; Gesicht frei.
- **Schal/Halstuch NEIN:** kein ähnliches Halsaccessoire.
- **Hörner/Geweih JA:** ausschließlich natürliche, anatomisch passende Hörner oder Geweihe.
- **Hörner/Geweih NEIN:** keine hornähnliche Dekoration.
- **Oberfläche natürlich:** Säugetiere Fell, Vögel Federn, Reptilien Schuppen/Haut, Amphibien Haut.

### Keine erfundenen Merkmale

**Extrem wichtig:** Keine zusätzlichen Merkmale erfinden. Keine spontanen Brillen, Sonnenbrillen, Hüte, Mützen, Kronen, Schleifen, Masken, Ohrringe, Halsketten, Schals, Halstücher, Hörner oder Gesichtsbemalungen. **NEIN** bedeutet eindeutig nicht vorhanden. Die Matrix schlägt Ästhetik.

Kreative Bildprompts dürfen den verbindlichen Stil nicht zu einer Kurzform wie `cute child-friendly animal superhero` reduzieren. Bei Bildgenerierung müssen die bindenden Stilmerkmale ausdrücklich im Prompt erhalten bleiben.

## Anti-Fehler-Beispiel

Ein glatter moderner 3D-/Cartoon-Tierheld auf einem freien farbigen Hintergrund ist **falsch**. Keine Disney-/Pixar-artige Optik, kein freistehender Ganzkörperheld, kein fehlender Goldrahmen. Solche Gemini-Ergebnisse verwerfen und korrigieren; nicht als neue Stilbasis akzeptieren.

## Alte 35er-Matrix – historische/strukturelle Referenz

Diese Matrix ist **nicht** als neue Superheldenmatrix zu übernehmen. Sie dient nur als historische/strukturelle Referenz.

| # | Tier | Fell | Hörner/Geweih | Augen | Brille | Kopfbedeckung | Maske | Ohrring | Schal |
|---:|---|:---:|:---:|---|:---:|:---:|:---:|:---:|:---:|
| 1 | Bär | ✓ | – | Grün | ✓ | ✓ | – | – | ✓ |
| 2 | Panda | ✓ | – | Blau | ✓ | – | ✓ | ✓ | ✓ |
| 3 | Fuchs | ✓ | – | Blau | ✓ | ✓ | ✓ | – | ✓ |
| 4 | Katze | ✓ | – | Blau | ✓ | ✓ | ✓ | – | – |
| 5 | Hund | ✓ | – | Blau | – | – | – | ✓ | ✓ |
| 6 | Hase | ✓ | – | Blau | – | ✓ | – | ✓ | – |
| 7 | Wolf | ✓ | – | Braun | – | – | ✓ | ✓ | – |
| 8 | Löwe | ✓ | – | Braun | – | – | – | ✓ | ✓ |
| 9 | Otter | ✓ | – | Braun | ✓ | – | ✓ | ✓ | – |
| 10 | Alpaka | ✓ | – | Braun | ✓ | – | ✓ | ✓ | ✓ |
| 11 | Ziege | ✓ | ✓ | Blau | ✓ | ✓ | ✓ | – | – |
| 12 | Widder | ✓ | ✓ | Braun | – | ✓ | – | – | – |
| 13 | Hirsch | ✓ | ✓ | Braun | – | ✓ | – | – | ✓ |
| 14 | Rentier | ✓ | ✓ | Blau | ✓ | – | ✓ | ✓ | – |
| 15 | Steinbock | ✓ | ✓ | Braun | ✓ | – | ✓ | ✓ | ✓ |
| 16 | Büffel | ✓ | ✓ | Grün | – | – | ✓ | ✓ | – |
| 17 | Yak | ✓ | ✓ | Grün | – | – | – | – | – |
| 18 | Kuh | ✓ | ✓ | Grün | ✓ | ✓ | ✓ | ✓ | ✓ |
| 19 | Eule | – | – | Blau | – | – | – | ✓ | ✓ |
| 20 | Papagei | – | – | Grün | – | ✓ | ✓ | ✓ | – |
| 21 | Pinguin | – | – | Blau | ✓ | – | – | – | – |
| 22 | Ente | – | – | Grün | – | ✓ | ✓ | – | – |
| 23 | Adler | – | – | Blau | ✓ | ✓ | ✓ | ✓ | – |
| 24 | Flamingo | – | – | Blau | – | ✓ | – | ✓ | – |
| 25 | Krokodil | – | – | Braun | – | – | ✓ | – | – |
| 26 | Chamäleon | – | – | Grün | – | ✓ | – | – | ✓ |
| 27 | Schildkröte | – | – | Blau | ✓ | – | ✓ | – | ✓ |
| 28 | Schlange | – | – | Grün | ✓ | – | ✓ | ✓ | – |
| 29 | Leguan | – | – | Grün | ✓ | ✓ | – | ✓ | – |
| 30 | Axolotl | – | – | Braun | – | ✓ | ✓ | ✓ | ✓ |
| 31 | Frosch | – | – | Grün | – | – | ✓ | – | ✓ |
| 32 | Gecko | – | – | Braun | – | ✓ | ✓ | ✓ | – |
| 33 | Hahn | – | – | Braun | – | – | – | – | ✓ |
| 34 | Hai | – | – | Grün | ✓ | – | ✓ | – | ✓ |
| 35 | Oktopus | – | – | Grün | ✓ | ✓ | – | ✓ | ✓ |

### Lehre aus der alten Version

Die Verteilung war teilweise ungleich; einige Merkmale waren visuell oder logisch ungeeignet. Die neue Superheldenmatrix muss deshalb neu balanciert werden. Sie wird erst nach gemeinsamer Festlegung und Nutzerfreigabe erstellt und umgesetzt.
