# Asset-Audit Mirelon (rein dokumentierend)

**Stand:** 2026-09-08 · **Regel:** nichts gelöscht, verschoben, umbenannt,
committet oder gepusht. Dieser Bericht ist nur eine Entscheidungsgrundlage.

## Methode

- Vollständige Datei-/Größenaufnahme von `images/`, `Icons/`, `avatare/`,
  `charaktere/`, `Sounds/`, `Fonts/`, `JS/`, `CSS/`, `tools/` und
  Projektstamm.
- Referenz-Abgleich: alle `src=`/`href=`/`url(...)`-Zeichenketten **und**
  dynamisch zusammengebaute Pfade in `*.html`, `*.css`, `*.js`
  (z. B. `"images/badges/" + shape + "_" + color + ".png"`,
  `path: "images/memory/deck1/"`, `sprites: { happy: "images/tamagotchi/…"`).
- Gegenprobe mit `git grep` über alle versionierten Dateien.
- `git log` je Kandidat, um Herkunft/letzte Nutzung einzuordnen.

**Vorsicht:** Wo eine Datei über einen zusammengesetzten Pfad geladen
werden *könnte* und ich es nicht eindeutig ausschließen kann, steht sie in
Abschnitt 3 mit Risiko *mittel*, nicht als „sicher ungenutzt".

**Größenordnung:** Arbeitskopie `images/` 193 MB, `tools/` 118 MB (davon
94 MB `tools/gemini-mcp/node_modules/`, 25 MB `tools/__screenshots__/`),
`charaktere/` 34 MB, `.git/` 227 MB. Die größten *versionierten* Einzel-
posten sind `images/Alte_designs/` (68 MB) und viele 2–4 MB große Roh-PNGs
im `images/`-Stamm.

---

## 1. Aktiv benötigt

Wird von der laufenden Anwendung geladen **oder** für Entwicklung/Deployment
gebraucht. Nicht anfassen.

### Laufzeit – Seiten, Code, Style

| Bereich | Details |
|---|---|
| `*.html` (18 Seiten) | alle aktiv, per `tools/check-pages.mjs` geprüft |
| `JS/` | **41 von 42** aktiv. Einzige Ausnahme: `JS/gallery-likes.js` → Abschnitt 3 |
| `CSS/` | alle 20 aktiv: Seiten binden `style.css` + `CSS/components/index.css` ein, `index.css` `@import`-iert die 11 `components/*.css` + `level-up.css`; `baerental/bako/puzzle/schloss/tamagotchi/tamo.css` je seitenspezifisch |
| `Fonts/` | alle 5 `*.woff2` via `CSS/components/fonts.css` (Fredoka, Nunito, Fraunces global; Work Sans + JetBrains Mono nur Luis-Puzzle). Die `OFL.txt` je Ordner sind Pflicht-Lizenzdateien und bleiben **neben** der Schrift |

### Laufzeit – Bilder/Ton, die eindeutig geladen werden

| Pfad | Fundstelle |
|---|---|
| `images/badges/<schild\|herz\|stern\|baum>_<waldgruen\|himmelblau\|beerenrosa\|sonnengold>.png` (16) | `JS/sidebar.js`, `JS/einstellungen.js`, `JS/index.js` – dynamischer Pfad + `?v=2` |
| `images/tamagotchi/<igel\|otter\|reh\|eichhorn\|baer>_<happy\|eating\|drinking\|sleeping\|playing\|clean>.png` (30) | `JS/tamagotchi.js` `PET_SPECIES[*].sprites`, `shop_seite.html` Hotspots |
| `images/bear_quiz/*.png` (36) | `JS/animals.js` (Bären-Namensquiz Bärental) |
| `images/memory/deck1/*` (6) + `images/memory/deck2/*` (12) | `JS/memory.js` `MEMORY_DIFFICULTIES[*].path` + `*_IDS` |
| `images/faro/faehrten/*.jpg` (6), `images/faro/schatten/*.png` (8), `images/faro/memory/back.jpg` | `JS/faro-tracks.js`, `JS/faro-schatten.js`, `CSS/style.css` |
| `images/schloss/moebel/*.png` (20) + `images/schloss/models/*.glb` (10) + `images/schloss/textures/*storybook.png` (8) | `JS/schloss-data.js` (`designs[].sprite/model`), `JS/schloss-3d.js` (`textureLoader.load("images/schloss/textures/" + file)`, `waldzimmer-shell.glb`). Feature ist per Level 3 gesperrt, wird aber ausgeliefert |
| `images/chameleon_luis_{brown,green,zuckerwatte,blue,red,orange}.png` (6) | `JS/player.js` Sidebar-Themebild-Map (Z. 2322–2327), `JS/malen.js` |
| `avatare/avatar1..9.PNG` (9) | `JS/data.js` `characters`-Liste (Avatarauswahl Onboarding + Einstellungen) |
| `images/muenze.png`, `images/magischer_baum_von_mirelon_logo.png`, `images/magischer_baum_von_mirelon%20-favicon.png` | Sidebar/Hydration-Logo, Favicon aller Seiten, Münz-Icon überall |
| `images/startseite_v4.jpg` | `index.html` Kartenbild |
| `images/Kuro_close.png`, `images/branos.png`, `images/tessa_hase.png` | Malstube-Stempel (`JS/malen.js`), `kuros_nest.html`, `eulenschule.html`, `baerental.html` |
| `images/luis_chameleon.png`, `images/kuros_nest_final.png`, `images/faros_fuchsbau3.png`, `images/hasenschule.png`, `images/baerenthal.png`, `images/luis_huette.png` | `JS/puzzle-image-picker.js`, `galerie.html`, `CSS/style.css` |
| `images/faro1.png`, `images/kuro_shop_1.png` | `galerie.html`, `shop_seite.html` |
| `Icons/Sidebar/*` (die von `JS/sidebar.js` referenzierten), `Icons/Cursor/*` (8), `Icons/bug_reporter.png`, `Icons/faro/faros_radio96x96.png` | `JS/sidebar.js`, `CSS` Cursor-Regeln, `JS/bugreport.js`, `fuchs.html` |
| `Sounds/correct_answer.mp3`, `Sounds/wrong_answer.mp3`, `Sounds/47313572-ui-pop-sound-316482.mp3`, `Sounds/Fuchsbau_quiz/*.mp3` (8), `Sounds/radio_flute/flute_song.mp3` | `JS/sounds.js`, `JS/puzzle.js`, `JS/data.js` (Geräusche-Quiz), `JS/fuchs.js` |

### Entwicklung / Deployment

| Pfad | Zweck |
|---|---|
| `tools/check-pages.mjs`, `tools/screenshots.mjs`, `tools/serve.mjs` | npm-Skripte + `.github/workflows/checks.yml` |
| `tools/gemini-mcp/*.mjs`, `*.py`, `package.json`, `package-lock.json`, `.gitignore`, `README.md` | Asset-Erzeugung (Gemini, Badge-Compositor). Kein Laufzeitcode, aber Quell-Werkzeug – siehe auch Abschnitt 2 |
| `package.json`, `package-lock.json`, `node_modules/` (Projektstamm) | nur `playwright` für `npm run shots`; `.gitignore` schließt `node_modules/` aus |
| `vercel.json`, `.github/`, `.gitattributes`, `.gitignore` | Deploy + CI + Repo-Regeln |
| `supabase_*.sql` (10 Dateien) + `supabase_schema.sql` | DB-Migrationen/Schema. Historie ist bewusst additiv; nichts davon löschen, auch wenn `progression_v2` von `progression_v3_tables` abgelöst wird (v3 ist freigegeben, aber noch nicht eingespielt) |
| `docs/*.md` | Spezifikationen (`mein-schloss.md`, `zauber-gefaehrte.md`, `wer-ist-es.md`), Ideen, Sicherheits-To-dos |
| `AGENTS.md`, `PROJECT_CONTEXT.md`, `Roadmap.txt` | Projektkontext |

---

## 2. Als Quelle behalten, aber später ordentlich archivieren

Kein Müll. Gehört nicht in den Laufzeit-/Deploy-Ordner, aber muss als
Originalmaterial erhalten bleiben (am besten außerhalb des ausgelieferten
`images/`-Baums, z. B. `assets-source/` bzw. `third_party/`).

| Pfad | Größe | Was es ist | Warum nicht Laufzeit |
|---|---|---|---|
| `charaktere/KayKit_Adventurers_2.0_FREE.zip` | ~ | gekauftes/„free" 3D-Charakterpaket (KayKit) | Rohpaket inkl. Lizenz; wird nicht direkt geladen. **Nie als Müll behandeln.** Aktuell nur lokal, nicht versioniert |
| `charaktere/KayKit_Character_Animations_1.1.zip` | ~ | KayKit-Animationspaket | dito |
| `images/Alte_designs/` (26 Dateien) | **68 MB** | Konzept-/Iterationskunst: `startseite*`, `neue_startseite_v1..5`, `luna_adventure*`, `Baumvorlagen*`, `branos_concept.png`, `konzepte.png`, `first_stand.png`, `Codex-Bild …`, `a.jpg`, `platzhalter.png`, `faro.png`, `chameleon_luis_brown.png` (Dublette) | reine Design-Historie, seit „Initial commit" nie referenziert |
| `images/magischer_baum_von_mirelon.png` | 2,9 MB | großes Original des Mirelon-Baums | Laufzeit nutzt nur `_logo` + `-favicon` |
| `images/magischer_baum_von_mirelon_baum.png` | 1,7 MB | Variante desselben Motivs | nicht referenziert |
| `logo1.PNG` | 604 KB | frühes Projektlogo | nicht referenziert |
| `Kuro.png` | 116 KB | großes Kuro-Porträt | Laufzeit nutzt `images/Kuro_close.png` |
| `images/Kuro_ausmalbild.png` | 1,7 MB | Ausmalvorlage Kuro | derzeit nicht eingebunden (evtl. später Malstube-Vorlage) |
| `images/memory/bilder1.png`, `bilder2.png`, `memory_karten_all.png` | ~ | Kontaktbögen/Quellen der Memory-Decks | Spiel lädt die Einzelkarten aus `deck1/` + `deck2/` |
| `tools/gemini-mcp/` (Skripte) | klein | `gen.mjs`, `gen_badge_swatches.mjs`, `compose_badges.py`, `normalize_badge.py`, `cutout.py`, `icon-finish.py` | Quell-Werkzeuge für Assetgenerierung; kein Laufzeitcode. `normalize_badge.py` ist durch `compose_badges.py` faktisch abgelöst, aber als allgemeines Freistell-Tool ok |
| `images/badges/neu/` (lokal, `.gitignore`) | ~15 MB | Badge-Werkbank: `mat_*.png` (gemalte Gouache-Rohfelder), `_kontaktuebersicht.png`, `_mit_zahl.png` | Rohmaterial des Badge-Compositors. Sollte in `assets-source/badges/` wandern, nicht einfach gelöscht werden |

---

## 3. Kandidaten zum Archivieren oder Entfernen

Erst nach gemeinsamer Prüfung entscheiden. Spalte „Risiko" = Wahrschein-
lichkeit, dass die Datei doch noch gebraucht wird.

| Pfad | Größe | Begründung | Fundstelle der Prüfung | Risiko |
|---|---|---|---|---|
| `JS/gallery-likes.js` | 4 KB | in **keiner** HTML als `<script>` eingebunden; `galerie.html` lädt es nicht. Like-Feature wurde offenbar nicht ausgerollt bzw. zurückgenommen | `git grep gallery-likes` → nur Eigenreferenz; Skriptliste in `galerie.html` | niedrig |
| `images/animal_book/` (`animal_book_closed/open/open_left/open_right.png`, 4) | 9,4 MB | „Tierbuch"-Feature nie gebaut; seit „Initial commit" nie referenziert | `git grep animal_book` → 0 Treffer in Code | niedrig |
| `images/scrolls/` (`scroll_closed.png`, `scroll_open.png`, `baerenthal_1.png`, 3) | 4,2 MB | keinerlei Referenz in HTML/CSS/JS | `git grep "scrolls/"` → 0 Codetreffer | niedrig |
| `Icons/icons8-*.png` (~17: adler, bambus, bones, delfin, eisbär, erdwurm, haselnuss, huhn, kaninchen, katze, känguru, löwe, marienkäfer 48/96, tiger, zahnrad, zebra) | 76 KB | alte Tierquiz-Icons, abgelöst durch die Fotos in `images/bear_quiz/`; keine Referenz mehr | `git grep "icons8-"` → 0 Codetreffer | niedrig |
| `Sounds/mirelon-sounds/` (`confetti_pop.wav`, `feather_collect.wav`, `firework_pop.wav`, `rocket_fly.wav`, `rocket_ignite.wav`, `sparkle.wav`, 6) | 160 KB | nie verdrahtet; `JS/fireworks.js` und `JS/confetti.js` sind reine Canvas-Effekte ohne Ton | `git grep mirelon-sounds` / `.wav` → nur `JS/puzzle.js` (anderer Pfad) | **mittel** – evtl. bewusst für spätere Effekt-Vertonung abgelegt |
| `Sounds/Fuchsbau_quiz/quiz2/thunder.mp3` | klein | einzelne Datei in sonst leerem `quiz2/`, keine Referenz | `git grep "thunder"` / `"quiz2"` → 0 | niedrig |
| `Icons/faro/faros_radio48x48.png` | klein | `fuchs.html` nutzt die 96×96-Variante | `git grep faros_radio` | niedrig |
| `Icons/Sidebar/baer-1.png`, `rabe-1.png` | klein | abgelöst durch `baer-2.png` / `rabe-2.png` (die `sidebar.js` referenziert) | `JS/sidebar.js` Z. 138/141 | niedrig |
| `Icons/Sidebar/start.png`, `Icons/Sidebar/anmeldung.png` | klein | `sidebar.js` nutzt `startkarte.png`; kein Login-Icon mehr in der Sidebar | `git grep` → 0 | niedrig |
| `images/inventar.png` | 2,4 MB | Inventar-Button nutzt `Icons/Sidebar/inventar.png`; die große Stamm-Datei wird nirgends geladen | präziser `grep "images/inventar"` → 0 | **mittel** – prüfen, ob irgendein Lightbox/„groß anzeigen" darauf zeigt |
| `images/sidebar.jpg` | 2,2 MB | Sidebar-Hintergrund ist heute ein CSS-Verlauf (`#sidebar` in `style.css`) | `git grep "sidebar.jpg"` → 0 | niedrig |
| `images/chameleon_luis_grey.png` | 2,6 MB | nicht in der Theme→Bild-Map (`player.js` nutzt brown/green/zuckerwatte/blue/red/orange) | `JS/player.js` Z. 2322–2327 | **mittel** – falls „grau/Standard"-Theme geplant war |
| `images/chameleon_luis_zuckerwatte3.png` | 2,9 MB | Iterations-Dublette; Theme lädt `chameleon_luis_zuckerwatte.png` | `JS/player.js` | niedrig |
| `images/holzmünze.png` | 328 KB | abgelöst durch `images/muenze.png`; keine Referenz | `git grep "holzm"` → 0 | niedrig |
| `Katze_quiz.jpg` (Projektstamm) | 1,3 MB | altes Quizbild, keine Referenz; liegt zudem unschön im Stamm | `git grep "Katze_quiz"` → 0 | niedrig |
| `charaktere/Bako.png` | 2,2 MB | `bakos_basar.html` nutzt `Bako_händler.png`; diese Variante nicht | `git grep "charaktere/Bako.png"` → 0 | **mittel** – Händlerfigur, evtl. Reservevariante |
| `images/fehler/wo_ist_der.png` | 2,8 MB | einzige Datei im Ordner `fehler/`, keinerlei Referenz; Feature unklar | `git grep "wo_ist_der"` / `"fehler/"` → 0 | **mittel** – Zweck nicht rekonstruierbar |
| `tools/__screenshots__/` (32 PNG) | 25 MB | Ausgabe von `npm run shots`, bereits `.gitignore`; jederzeit neu erzeugbar | `.gitignore` | niedrig (lokal, nicht im Repo) |
| `Claude outputs/mcp.json`, `_preview/` (leer) | ~0 | lokale Restdateien, bereits `.gitignore` bzw. leer | – | niedrig (lokal) |

### Sonderfall – nicht Asset, aber beim Audit aufgefallen

- **`.gitattributes` kannte `*.glb` nicht** → die 10 Möbelmodelle fielen
  unter `* text=auto eol=lf`. Binäre GLB können so bei Checkout/Commit
  über Plattformgrenzen beschädigt werden. **Erledigt (Schritt 1),
  siehe unten.**
- `README.md` ist ein 2-Zeilen-Stub („My first Website").
- `.git/` ist mit 227 MB deutlich größer als der Checkout, weil viele
  2–4 MB-PNGs über die Historie mehrfach neu committet wurden. Eine
  spätere `git lfs migrate` oder ein History-Prune ist eine **eigene**
  Entscheidung und nicht Teil dieses Audits.

---

## 4. Vorgeschlagene spätere Zielstruktur (noch nicht umsetzen)

Grundgedanke: die **Laufzeit-Ordner bleiben, wo sie sind** – jede
Verschiebung von `images/`, `Icons/`, `Sounds/`, `Fonts/`, `CSS/`, `JS/`
bräche hunderte relative Pfade und ist den Aufwand nicht wert. Bewegt
wird nur, was **nicht** ausgeliefert wird.

```
MIrelon/
├─ index.html … (18 Seiten)          # Laufzeit – unverändert
├─ CSS/  JS/  images/  Icons/  Sounds/  Fonts/   # Laufzeit – unverändert,
│                                               #   aber „tote" Unterordner
│                                               #   nach Abschnitt 3 geräumt
├─ vercel.json  .github/  .gitattributes
│
├─ db/                               # bisher im Projektstamm
│   ├─ supabase_schema.sql
│   └─ migrations/  supabase_migration_*.sql
│
├─ assets-source/                    # editierbare Originale, NICHT deployt
│   ├─ hero/            # magischer_baum_von_mirelon.png(+_baum), logo1.PNG,
│   │                   #   Kuro.png, Kuro_ausmalbild.png
│   ├─ konzept/         # heutiges images/Alte_designs/
│   ├─ badges/          # mat_*.png Gouache-Rohfelder + Kontaktübersichten
│   │                   #   (heute images/badges/neu/)
│   └─ memory-decks/    # bilder1.png, bilder2.png, memory_karten_all.png
│
├─ third_party/                      # fremde/gekaufte Pakete + Lizenzen
│   └─ kaykit/          # die beiden ZIPs, entpackte Quelle, LICENSE
│
├─ archive/                          # stillgelegt, Historie behalten
│   ├─ animal_book/     scrolls/     icons8/
│   ├─ mirelon-sounds/  fehler/
│   └─ sonstiges/       # sidebar.jpg, inventar.png, Katze_quiz.jpg,
│                       #   chameleon_luis_grey/…zuckerwatte3, holzmünze.png,
│                       #   Bako.png, gallery-likes.js …
│
├─ docs/   tools/
└─ .gitignore  (zusätzlich: assets-source/ und third_party/ ggf.
                aus dem Deploy ausschließen, aber versioniert lassen –
                oder in ein separates Repo/Release auslagern)
```

Migrationsreihenfolge, wenn wir soweit sind:
1. `.gitattributes` `*.glb binary` fixen (isoliert, sofort sinnvoll).
2. Abschnitt-3-Kandidaten einzeln bestätigen → nach `archive/` **verschieben**
   (nicht löschen), ein Commit „archive: …".
3. `assets-source/` + `third_party/` anlegen, Abschnitt-2-Material dorthin.
4. `db/` anlegen, SQL verschieben, Pfade in Doku nachziehen.
5. Prüfen, ob `assets-source/`/`third_party/` via `vercel.json`
   (`.vercelignore`) vom Deploy ausgenommen werden sollen.
6. Danach separat entscheiden: `git lfs` / History-Prune für die Alt-PNGs.

---

## Schritt 1 umgesetzt – GLB-Regel in `.gitattributes` (2026-09-08)

**Änderung:** in `.gitattributes` neu ergänzt (bestehende Regeln unberührt):

```gitattributes
# 3D-Modelle (Schloss-Moebel): immer binaer, nie EOL-/Text-Normalisierung
*.glb  binary
```

**Wirkung geprüft:** `git check-attr -a images/schloss/models/stuhl_wald_a.glb`
→ jetzt `binary: set`, `text: unset`, `diff: unset` (vorher `text: auto,
eol: lf`).

**Keine Byte-Änderung an bestehenden GLB nötig:** `git status` nach der
Regel meldet keine Änderung an `images/schloss/models/*.glb`; Arbeitskopie
und committeter Blob sind bit-identisch (SHA-1-Vergleich für `stuhl`,
`lampe`, `pflanze`, `waldzimmer-shell` – alle gleich). Git hatte die GLB
über die `text=auto`-Heuristik bereits binär gespeichert; die Regel macht
das nur explizit und schützt vor künftiger Fehlerkennung.

**Struktur-Check aller 10 GLB:** Magic `glTF`, Container-Version 2 – ok.

**Ladetest im Schloss** (`schloss.html`, `player.progression.unlockedFeatures
= ["castle"]`, je ein Möbel pro relevanter Gruppe über das echte
`schloss:place-furniture`-Ereignis platziert):

| Gruppe | Modell | HTTP | GLTF-Parsing | im Raum sichtbar |
|---|---|---|---|---|
| Möbel | `images/schloss/models/stuhl_wald_a.glb` | 200 | ok | ja (Waldstuhl) |
| Lampe | `images/schloss/models/lampe_wald_a.glb` | 200 | ok | ja (Stehlampe inkl. Lichtkegel) |
| Pflanze | `images/schloss/models/pflanze_wald_a.glb` | 200 | ok | ja (Topfpflanze) |

Keine Konsolenfehler, keine „Schloss-Möbelmodell nicht ladbar"-Warnung,
keine fehlgeschlagenen Requests.

`waldzimmer-shell.glb` wird zur Laufzeit **bewusst nicht** geladen
(`ROOM_SHELL_MODEL = ""` in `JS/schloss-3d.js`, prozeduraler Raum als
Fallback) – die Datei bleibt als Quelle liegen (Abschnitt 2). Integrität
trotzdem geprüft (SHA-1 + glTF-Header ok).

**Nicht verändert:** Laufzeitpfade, Möbelkatalog (`JS/schloss-data.js`),
Schlosslogik, Datenbank, sonstige Assets.

---

## Anhang – Schnellzahlen

| Kategorie | ca. Größe | Einsparung im Deploy möglich? |
|---|---|---|
| Abschnitt 3, sicher (niedrig) | ~14 MB versioniert + 25 MB lokal | ja |
| Abschnitt 3, mittel (prüfen) | ~13 MB | ja, nach Klärung |
| Abschnitt 2 → `assets-source/`/`third_party/` | ~75 MB versioniert + ~45 MB lokal (ZIPs) | ja, wenn vom Deploy ausgenommen |
| Rest `images/` (aktiv) | ~100 MB | nur via Bild-Kompression (eigenes Thema) |
