# Wer ist es? – verbindliche Karten- und Bildspezifikation

> **Source of Truth.** Vor jeder Änderung am Tierkarten-/Ratespiel und vor jeder Bildarbeit diese Datei lesen. Bei Widerspruch hat diese Feature-Spezifikation Vorrang vor allgemeinen Projektannahmen.

## Aktueller Codebezug

Das bestehende Karten-/Ratespiel befindet sich im Bärental. `JS/animals.js` enthält die Kartendaten; `JS/baerental.js` stellt Fragen, filtert Karten und steuert das Raten. Bestehende Logik und Daten nicht ohne ausdrückliche Freigabe umbauen.

## Status und verbindlicher Ablauf für die Tier-Superhelden-Version

Es gibt 35 Karten. Die Spiellogik basiert auf einer festen Merkmalsmatrix. Bild und Matrix müssen **1:1** übereinstimmen.

Für die neue Tier-Superhelden-Version darf die alte Matrix **nicht** einfach übernommen werden. Der Ablauf ist zwingend:

1. Zuerst eine neue, logisch und möglichst ausgewogen verteilte 35er-Superheldenmatrix erstellen.
2. Diese vollständige Matrix vom Nutzer freigeben lassen.
3. Erst danach Bilder erzeugen.
4. Genau **eine** Testkarte erzeugen, mit der Referenz vergleichen und Nutzerfreigabe abwarten.
5. Erst nach dieser Freigabe die restlichen 34 Karten erzeugen.

Wenn der Nutzer Gemini verlangt, Gemini im Browser für die Bilder verwenden.

Die neue Matrix muss so balanciert werden, dass Fragen sinnvolle Teilmengen eliminieren und Merkmalskombinationen ausreichend unterscheidbar sind. Denkbare Superheldenmerkmale sind Maske, Cape, Helm/Kopfbedeckung, Brille, Handschuhe, Brustsymbol/Emblem, Ohrring, natürliche Hörner/Geweih und klar definierte Kraft-Optik. Die konkreten Merkmale und ihre vollständige Verteilung müssen zuerst gemeinsam festgelegt und freigegeben werden.

## Freigegebene Superheldenmatrix

Diese Matrix wurde vom Nutzer am 31.08.2026 freigegeben. Sie ist für die Tier-Superhelden-Version verbindlich. Die sieben Superheldenmerkmale sind je 16 bis 18 Mal vorhanden; die Augenfarben sind mit 12× Blau, 12× Grün und 11× Braun verteilt. Natürliche Hörner oder Geweihe werden bei den passenden Tierarten anatomisch korrekt gezeigt, sind aber kein eigenes Superhelden-Fragemerkmal.

| # | Tier | Augen | Maske | Cape | Helm | Brille | Handschuhe | Emblem | Kraft-Aura |
|---:|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Bär | Blau | – | – | – | – | – | – | – |
| 2 | Panda | Grün | ✓ | – | – | – | – | ✓ | ✓ |
| 3 | Fuchs | Braun | – | ✓ | – | – | – | ✓ | – |
| 4 | Katze | Blau | ✓ | ✓ | – | – | – | – | ✓ |
| 5 | Hund | Grün | – | – | ✓ | – | – | ✓ | ✓ |
| 6 | Hase | Braun | ✓ | – | ✓ | – | – | – | – |
| 7 | Wolf | Blau | – | ✓ | ✓ | – | – | – | ✓ |
| 8 | Löwe | Grün | ✓ | ✓ | ✓ | – | – | ✓ | – |
| 9 | Otter | Braun | – | – | – | ✓ | – | ✓ | – |
| 10 | Alpaka | Blau | ✓ | – | – | ✓ | – | – | ✓ |
| 11 | Ziege | Grün | – | ✓ | – | ✓ | – | – | – |
| 12 | Widder | Braun | ✓ | ✓ | – | ✓ | – | ✓ | ✓ |
| 13 | Hirsch | Blau | – | – | ✓ | ✓ | – | – | – |
| 14 | Rentier | Grün | ✓ | – | ✓ | ✓ | – | ✓ | ✓ |
| 15 | Steinbock | Braun | – | ✓ | ✓ | ✓ | – | ✓ | – |
| 16 | Büffel | Blau | ✓ | ✓ | ✓ | ✓ | – | – | ✓ |
| 17 | Yak | Grün | – | – | – | – | ✓ | ✓ | – |
| 18 | Kuh | Braun | ✓ | – | – | – | ✓ | – | ✓ |
| 19 | Eule | Blau | – | ✓ | – | – | ✓ | – | – |
| 20 | Papagei | Grün | ✓ | ✓ | – | – | ✓ | ✓ | ✓ |
| 21 | Pinguin | Braun | – | – | ✓ | – | ✓ | – | ✓ |
| 22 | Ente | Blau | ✓ | – | ✓ | – | ✓ | ✓ | – |
| 23 | Adler | Grün | – | ✓ | ✓ | – | ✓ | ✓ | ✓ |
| 24 | Flamingo | Braun | ✓ | ✓ | ✓ | – | ✓ | – | – |
| 25 | Krokodil | Blau | – | – | – | ✓ | ✓ | – | – |
| 26 | Chamäleon | Grün | ✓ | – | – | ✓ | ✓ | ✓ | ✓ |
| 27 | Schildkröte | Braun | – | ✓ | – | ✓ | ✓ | ✓ | – |
| 28 | Schlange | Blau | ✓ | ✓ | – | ✓ | ✓ | – | ✓ |
| 29 | Leguan | Grün | – | – | ✓ | ✓ | ✓ | ✓ | – |
| 30 | Axolotl | Braun | ✓ | – | ✓ | ✓ | ✓ | – | ✓ |
| 31 | Frosch | Blau | – | ✓ | ✓ | ✓ | ✓ | – | – |
| 32 | Gecko | Grün | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 33 | Hahn | Braun | – | – | – | – | – | ✓ | – |
| 34 | Hai | Blau | ✓ | – | – | – | – | – | ✓ |
| 35 | Oktopus | Grün | – | ✓ | – | – | – | – | – |

### Umsetzungsreihenfolge nach der Freigabe

1. Eine Gemini-Testkarte für Karte 1 (Bär) erstellen.
2. Sie gegen die bestehenden Karten und die obigen Stilregeln prüfen lassen.
3. Erst nach einer weiteren Nutzerfreigabe die übrigen 34 Bilder erzeugen und das gesperrte Superhelden-Kartenset aktivieren.

### Testkarten-Protokoll

- **31.08.2026, Bär-Testkarte 1:** verworfen. Zwar waren Goldrahmen und klarer Pixel-Art-Ansatz vorhanden, der Bär war aber seitlich abgeschnitten, nicht mittig und nur mit einem sichtbaren Auge dargestellt. Das Ergebnis darf weder gespeichert noch als Stilreferenz oder Spielasset verwendet werden.
- **31.08.2026, Bär-Testkarte 2:** vom Nutzer für die weitere Produktion freigegeben. Die Karte zeigt den Bären mittig im Hochformat, mit sichtbarem Kopf und Oberkörper, beiden blauen Augen und vollständig sichtbarem Goldrahmen. Als `images/bear_quiz_superheroes/01-baer.jfif` abgelegt.

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
