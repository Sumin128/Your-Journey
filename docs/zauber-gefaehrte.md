# Zauber-Gefährte – Feature- und Bildspezifikation

> **Source of Truth.** Vor jeder Änderung am Zauber-Gefährten und vor jeder Bildarbeit dazu
> diese Datei lesen. Bei Widerspruch hat diese Feature-Spezifikation Vorrang vor allgemeinen
> Projektannahmen. Ergänzt [`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md).

## Was es ist

Ein **schwebender Begleiter** – kein eigener Menüpunkt, keine eigene Seite. Er wird wie der
Bug-Melder per JavaScript auf jeder Seite erzeugt: ein kleines Baumkind sitzt in einer
Bildschirmecke, ein Tippen öffnet ein kompaktes Pflege-Panel.

Die erste Fassung (Gemini, eigene Seite `tamagotchi.html`) wurde verworfen und nie committet.

## Code

- Logik: [`JS/tamagotchi.js`](../JS/tamagotchi.js) – IIFE, `createPetCompanion()`-Muster wie
  [`JS/bugreport.js`](../JS/bugreport.js).
- Styling: [`CSS/tamagotchi.css`](../CSS/tamagotchi.css).
- Einbindung: `<link CSS/tamagotchi.css>` + `<script JS/tamagotchi.js>` auf jeder Seite mit
  Bug-Melder (14 Seiten), Script direkt nach `bugreport.js`.
- Spielstand: `player.tamagotchi` – **einzige Quelle** ist `defaultTamagotchi()` in
  [`JS/player.js`](../JS/player.js); `createDefaultPlayer()` und die Migration in `loadPlayer()`
  benutzen sie.

## Einordnung in Mirelon

**Rahmen.** Der Magische Baum von Mirelon lässt ein *Baumkind* entstehen – ein junges Waldtier,
das im Licht des Baumes geschlüpft ist. Das Kind kümmert sich darum, bis es groß ist.

**Kein Lore-Bruch.** Keine erfundenen Wesen. Keine Tierart, die eine benannte Mirelon-Figur
doppelt (kein zweiter Fuchs neben Faro, keine Eule neben der Eulenschule).

## Die fünf Baumkinder

| id | Name | Tier | Wesen (Sprechblasen) |
|---|---|---|---|
| `igel` | Mippe | Igelkind | zaghaft, kuschelig |
| `otter` | Fenn | Otterjunges | verspielt, wasserverliebt |
| `reh` | Taja | Rehkitz | sanft, schüchtern |
| `eichhorn` | Piri | Eichhörnchenkind | wuselig, schnell |
| `baer` | Bruno | Bärenjunges | tollpatschig, verfressen |

**Start:** immer `igel` (Mippe). **Erwerb der übrigen:** beim exotischen fahrenden Händler
**Bako** (`charaktere/Bako.png`) – siehe Abschnitt „Bako". Der Begleiter selbst verkauft nichts;
er zeigt nur das aktive Baumkind. Bei mehr als einem freigeschalteten Baumkind erscheint im
⚙-Menü „Baumkind wechseln".

**Migration alter (nicht veröffentlichter) Spielstände** – einmalig in `player.js`:
`lumi→igel`, `fox→otter`, `dragon→reh`, `owl→eichhorn`, `cat→baer`; unbekannt → `igel`.
Namen `Lumi/Flöckchen/Pyri/Kira/Mimi` → `Mippe/Fenn/Taja/Piri/Bruno`. `unlockedSpecies` mitziehen,
`igel` immer enthalten, Duplikate entfernen.

## Verhalten

- **Ecke:** Standard unten rechts, über dem Bug-Melder. **Verschiebbar** per Ziehen; Position
  in `player.tamagotchi.pos` gemerkt, bei zu kleinem Viewport auf Standard zurück.
- **Ausblenden:** `player.tamagotchi.hidden`; ausgeblendet bleibt ein schmaler Reiter am rechten
  Rand zum Wiedereinblenden.
- **Panel (Tippen aufs Baumkind):** Name + Stufe, XP-Balken, 5 Mini-Werte, Knöpfe Füttern /
  Trinken / Spielen / Schlafen / Bürsten, ⚙-Menü (Umbenennen, ggf. Wechseln, Ausblenden).
  Tippen bei offenem Panel = Streicheln. „Spielen" = Streicheln (kein Minispiel mehr).
- **Werte:** Sättigung, Erfrischung, Laune, Energie, Glanz. Sanfter Zeitverfall mit Untergrenzen
  (15–25 %), kein Sterben, keine Bestrafung. Beim Schlafen lädt Energie.
- **Stimmung:** Ist ein Wert niedrig, bewegt sich das Baumkind anders (Wackeln bei Hunger/Durst,
  Hängenlassen bei Müdigkeit/Schmutz) und trägt ein „!"-Zeichen. Beim Seitenaufruf sagt es dann
  einen Hinweis statt einer Begrüßung. **Keine** Sprechblasen im Sekundentakt.
- **XP & Stufen:** wenig XP pro Aktion (Füttern 3–12, Streicheln 2, Bürsten 4).
  XP pro Stufe: `100 + Stufe × 150` – bewusst lang, der Gefährte ist ein Langzeit-Ziel.

## Münz-Ökonomie

**Der Gefährte gibt keine Münzen aus – er kostet welche. Münzen verdient man in den
Lernspielen.** Kein Minispiel mehr am Gefährten.

- **Pflege (Abfluss):** Waldbeeren 1 · Honigwabe 3 · Sternenfrucht 8 · Quellwasser 1 ·
  Zaubertrank 5. Streicheln / Bürsten / Schlafen gratis.
  Angemeldet über `spend_coins(reason)`
  (`supabase_migration_tamagotchi_economy.sql`, feste Kosten pro `tamagotchi_feed_*` /
  `tamagotchi_drink_*`). Gast: `player.coins` lokal.
- **Stufen-Belohnung:** bei jedem Aufstieg entweder **10–30 Münzen** oder **1–5
  Feuerwerkskörper** (50/50). Angemeldet würfelt `claim_tamagotchi_levelup_reward()`
  serverseitig (Cooldown 60 s als Anti-Replay); Gast würfelt lokal.
- Die Gefährten-Stufe selbst liegt clientseitig in `player.tamagotchi` und ist nicht
  serverseitig verifizierbar. Cooldown + kleine Belohnung + die Tatsache, dass Pflege unterm
  Strich mehr kostet als die Belohnung einbringt, halten den Missbrauchsanreiz gering.
  `ponytail:` bewusster Kompromiss.

## Panel-Icons (offen)

Die Bedienleiste nutzt derzeit Emojis (🍎💧💖⚡✨ / 🍓🥛🎾💤🧼). Ziel: kleine PNG-Icons wie
im Rest von Mirelon, in `Icons/tamagotchi/`:
`hunger, thirst, happiness, energy, cleanliness, feed, drink, play, sleep, clean` (je ~48 px,
warmer Pixel-Look). Sobald sie da sind, in `tamagotchi.js` (`VITALS`-Array + `renderPanel`)
verdrahten.

## Bako – exotischer fahrender Händler

- Seite: [`bakos_basar.html`](../bakos_basar.html), Logik [`JS/bako.js`](../JS/bako.js),
  Styling [`CSS/bako.css`](../CSS/bako.css). Charakterbild `charaktere/Bako_händler.png`.
- Sidebar: „Kuros Laden" ist jetzt die aufklappbare Gruppe **„Läden"** mit **Kuros Laden**
  + **Bakos Basar** (auf allen 14 Seiten, Icon `Icons/Sidebar/shop.png`).
- Verkauft:
  - **Baumkinder** – `baumkindOtter` 25, `baumkindReh` 45, `baumkindEichhorn` 70,
    `baumkindBaer` 100. Landen in `player.items` (boolean). Der Widget-Katalog liest die
    Freischaltungen aus `player.items` (`unlockedList()` in `tamagotchi.js`).
  - **Feuerwerk-Paket** `feuerwerk5` – 30 Münzen → +5 auf `player.consumables.feuerwerk`.
- Angemeldet: `purchase_item()` / `purchase_consumable_bundle()` RPC
  (`supabase_migration_bako_shop.sql`). Gast: lokal.
- **Feuerwerk zünden:** Inventar (`sidebar.js`) → Kategorie „Items" → „Feuerwerk ×N · Zünden".
  Verbrauch angemeldet über `use_consumable_item('feuerwerk')`, dann `MirelonFireworks.play()`.
- Später: Merchandise / kosmetische Items – gleiche Wege.
- **Offen:** Baumkind-Karten zeigen noch Emojis; auf `<art>_happy.png` umstellen, sobald die
  Sprites da sind. `Bako_händler.png` (~2 MB) könnte verkleinert werden.

## Bildspezifikation

**Stand:** Alle 5 Baumkinder haben ihr vollständiges Sprite-Set
(`images/tamagotchi/<id>_{happy,eating,drinking,sleeping,playing}.png`) – aus den
Roh-PNGs geschnitten. Widget und Bako-Basar nutzen sie.

**Verbindlicher Stil** – identisch zu [`docs/wer-ist-es.md`](wer-ist-es.md): warmer, hochwertiger
Retro-Pixel-Art-Stil, 16-/32-Bit-Fantasy-Look, deutlich erkennbare Pixel, warme Farben, klare
Konturen, kindgerecht aber nicht babyhaft. **Nicht** fotorealistisch, **kein** weiches 3D,
**kein** Disney-/Pixar-Look, **keine** Glubschaugen, **keine** Feenflügel/Glitzer.

**Sprite-Set je Baumkind** – freigestellt (transparentes PNG), frontal/leicht gedreht,
Ganzkörper sitzend, gleiche Kameradistanz und Größe über alle Baumkinder. Dateiname
`<id>_<zustand>.png` in `images/tamagotchi/`:

| Zustand | wofür |
|---|---|
| `happy` | wach, zufrieden (Standard) |
| `eating` | frisst |
| `drinking` | trinkt |
| `sleeping` | schläft zusammengerollt |
| `playing` | springt/spielt |

Optional (später, verbessert die Stimmungsanzeige): `hungry`, `sad`, `tired`. Ohne diese greift
die CSS-Bewegung.

Dezenter warmer Lichtschein erlaubt, kein Glitzerstaub.

Ein **Bühnen-Hintergrund** wird für den Widget-Ansatz **nicht** gebraucht (kein `room_bg.jpg`).

### Gemini-Bildprompt (Basis, je Baumkind anpassen)

> Warm, high-quality retro pixel-art in a lovingly crafted 16-/32-bit fantasy-game style.
> Clearly visible pixels, warm cosy colours, friendly and child-appropriate but not babyish.
> Clear outlines, good contrast, detailed but calm. NOT photorealistic, NO soft 3D render,
> NO painted or blurry edges, NO Disney/Pixar look, NO oversized glossy eyes, NO fairy wings,
> NO glitter dust. Single character, full body, sitting, facing the camera, centered,
> transparent background. Subtle warm magical glow around the animal, nothing more.
> Character: **a young <TIER> cub** (baby proportions, soft fur/spines), <AUSDRUCK>.

| Baumkind | `<TIER>` | Zustands-`<AUSDRUCK>` (Beispiele) |
|---|---|---|
| Mippe | hedgehog | happy: content smile · eating: nibbling a berry · sleeping: curled into a ball · playing: mid-hop |
| Fenn | otter | happy: cheeky grin · drinking: lapping water · playing: rolling on its back |
| Taja | fawn / young deer | happy: shy gentle look · eating: chewing a leaf · sleeping: legs folded, head down |
| Piri | red squirrel | happy: alert, tail up · eating: holding a nut · playing: darting, tail streaming |
| Bruno | bear cub | happy: goofy open-mouth smile · eating: both paws on food · sleeping: sprawled on back |

### Ablauf für die Bilder (verbindlich)

1. **Eine** Testkarte erzeugen: `igel_happy` (Mippe).
2. Gegen die bestehenden Mirelon-Karten und diese Stilregeln prüfen lassen, Nutzerfreigabe abwarten.
3. Erst nach Freigabe die restlichen Sprites erzeugen und in `images/tamagotchi/` ablegen.
4. Verworfene Ergebnisse nicht als Stilreferenz oder Asset verwenden.

### Testkarten-Protokoll

- _(noch keine Einträge)_
