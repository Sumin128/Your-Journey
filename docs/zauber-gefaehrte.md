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
  Tippen bei offenem Panel = Streicheln.
- **Werte:** Sättigung, Erfrischung, Laune, Energie, Glanz. Sanfter Zeitverfall mit Untergrenzen
  (15–25 %), kein Sterben, keine Bestrafung. Beim Schlafen lädt Energie.
- **Stimmung:** Ist ein Wert niedrig, bewegt sich das Baumkind anders (Wackeln bei Hunger/Durst,
  Hängenlassen bei Müdigkeit/Schmutz) und trägt ein „!"-Zeichen. Beim Seitenaufruf sagt es dann
  einen Hinweis statt einer Begrüßung. **Keine** Sprechblasen im Sekundentakt.
- **XP & Stufen:** je Aktion etwas XP, `Stufe × 100` XP pro Stufe. Titel: Nestling,
  Waldentdecker, Sternenfreund, Zauberhüter, Meister-Gefährte, Himmelswächter, Mirelon-Legende.

## Münz-Ökonomie

- Level-up: +10 Münzen über `mirelon:earn-coins`.
- Minispiel **Beeren-Fangen**: **max. 3 Münzen pro Runde** (`Math.min(3, Math.floor(score/50))`,
  min. 1). Einzige Münzquelle des Begleiters. `ponytail:` einfacher Deckel ohne Tageslimit.
- Verbrauchsgüter als Münzsenke: Honigwabe (2), Sternenfrucht (5), Zaubertrank (3). Waldbeeren
  und Quellwasser gratis. Käufe über `spendCoins()`, keine erfundenen Werte.
- Für angemeldete Konten greift ohnehin die serverseitige Prüfung (`sync_player_data()`).

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

**Verbindlicher Stil** – identisch zu [`docs/wer-ist-es.md`](wer-ist-es.md): warmer, hochwertiger
Retro-Pixel-Art-Stil, 16-/32-Bit-Fantasy-Look, deutlich erkennbare Pixel, warme Farben, klare
Konturen, kindgerecht aber nicht babyhaft. **Nicht** fotorealistisch, **kein** weiches 3D,
**kein** Disney-/Pixar-Look, **keine** Glubschaugen, **keine** Feenflügel/Glitzer. Die aktuellen
Platzhalter (`pet_happy.png` usw.) verletzen diesen Stil und werden **ersetzt**.

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
