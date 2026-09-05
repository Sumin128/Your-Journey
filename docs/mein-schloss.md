# Mein Schloss – Feature-Spezifikation

> **Source of Truth.** Vor jeder Änderung an "Mein Schloss" (Raumansicht, Möbel, Levelsystem-
> Freischaltung) diese Datei lesen. Bei Widerspruch hat diese Spezifikation Vorrang vor
> allgemeinen Projektannahmen. Ergänzt [`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md).

## Was es ist

Das bisher ungenutzte, verlassene Schloss auf der Startkarte (`images/startseite_v4.jpg`,
oben rechts) wird zum persönlichen, dekorierbaren Zuhause des Kindes: ein 3D-Wohnzimmer, in
dem gesammelte Möbel frei platziert, gezogen und gedreht werden können. Freigeschaltet wird
das Schloss durch echte Spielaktivität (Mirelon-Levelsystem, siehe unten), nicht durch
bloßes Anklicken.

Kein Aufbauspiel, keine Physik, kein Zeitdruck. Kein Ressourcenmanagement: Möbel wird einmal
besessen (gekauft oder verdient) und danach beliebig oft platziert.

## Code

- Seite: [`schloss.html`](../schloss.html)
- Raumansicht (3D, Three.js): [`JS/schloss-3d.js`](../JS/schloss-3d.js) – ES-Modul, lädt
  `three` + `three/addons/loaders/GLTFLoader.js` über eine Importmap (CDN, Version fest
  gepinnt, siehe Kopf von `schloss.html`). Rendert Raum, Licht, Kamera, platzierte Möbel;
  übernimmt Auswählen/Ziehen/Drehen/Entfernen und Speichern.
- Inventar/Laden/Kauf (2D-UI unterhalb der Szene): [`JS/schloss.js`](../JS/schloss.js) –
  liefert nur noch, *wonach* das Kind greifen kann, nicht mehr *wie/wo* es im Raum landet.
  Ein Klick auf ein Inventar-Möbelstück löst das Event `schloss:place-furniture` aus, das
  `schloss-3d.js` abhört.
- Katalog (Kategorien/Räume/Möbel): [`JS/schloss-data.js`](../JS/schloss-data.js) – reiner
  Daten-Katalog, neues Möbel = neuer Eintrag, keine Logik-Änderung nötig.
- Migration alter 2D-Spielstände: [`JS/schloss-migration.js`](../JS/schloss-migration.js).
- Styling: [`CSS/schloss.css`](../CSS/schloss.css).
- Levelsystem (allgemein, nicht Schloss-spezifisch): [`JS/level-data.js`](../JS/level-data.js)
  (`MIRELON_LEVELS`-Katalog + lokale Anwend-Logik für Gäste),
  [`JS/level-up.js`](../JS/level-up.js) + [`CSS/level-up.css`](../CSS/level-up.css)
  (Level-Up-Popup + Faro-Erzähl-Panel).
- Sicherheit: [`supabase_migration_schloss.sql`](../supabase_migration_schloss.sql)
  (`player.progression` geschützt, `schloss.ownedFurniture`/`unlockedRooms` gezielt
  geschützt, `earn_xp()`-RPC) und
  [`supabase_migration_schloss_shop.sql`](../supabase_migration_schloss_shop.sql)
  (`schloss_furniture`-Preistabelle + `purchase_schloss_furniture()`-RPC).
- Möbelbilder: [`images/schloss/moebel/`](../images/schloss/moebel/) – mit Gemini gemalt,
  Stil-Referenz war der zuerst freigegebene Waldstuhl. Zielordner für spätere echte
  `.glb`-Modelle: [`images/schloss/models/`](../images/schloss/models/) (noch leer).

## Datenmodell

```js
// player.progression – allgemeines Mirelon-Levelsystem, serverseitig
// vollständig geschützt (siehe earn_xp() in supabase_migration_schloss.sql)
progression: {
    version: 1,
    xp: 0,
    level: 1,
    unlockedFeatures: [],       // z. B. "castle" – einzige Quelle der Wahrheit
    claimedLevelRewards: []     // verhindert doppelte Level-Belohnungen
}

// Rein Anzeige/Ablauf, bewusst NICHT geschützt – steuert nur, ob ein
// bereits verdientes Story-Panel noch gezeigt werden muss
pendingStoryEvents: []          // z. B. "castle_unlock"

// player.schloss – nur ownedFurniture/unlockedRooms sind serverseitig
// geschützt (Pfad-Reset in sync_player_data()), der Rest (Layout,
// Design, Farbe) läuft normal mit
schloss: {
    version: 1,
    introSeen: false,
    style: "wald",
    activeRoom: "wohnzimmer",
    unlockedRooms: ["wohnzimmer"],
    ownedFurniture: [],          // startet leer, siehe "Freischalt-Ablauf"
    rooms: {
        wohnzimmer: {
            wallpaper: "default",
            floor: "default",
            placedItems: [ /* siehe unten */ ]
        }
    },
    customFurniture: {}          // vorbereitet für späteres Möbel-Bemalen (Phase 5)
}
```

**Platzierte Möbel-Instanz** (3D-Format seit 2026-09-05, siehe "2D → 3D-Umstellung"):

```js
{
    instanceId: "uuid",
    furnitureId: "stuhl_wald_a",  // Katalog-Referenz (JS/schloss-data.js)
    design: 0,                     // Index in furniture.designs[]
    color: null,                   // nur bei furniture.colorable gesetzt (Canvas-Tinting, siehe unten)
    customVariantId: null,         // vorbereitet für Phase 5 (Möbel-Bemalen)
    x: 0.4,                        // Meter, Raummitte = Ursprung
    z: -1.2,                       // Meter
    rotationY: 0,                  // Radiant, um die Hochachse
    scale: 1,                      // Datenfeld vorhanden, aktuell nicht per UI änderbar
    content: null                  // nur bei hasContent-Möbeln (Bilderrahmen) genutzt
}
```

## 2D → 3D-Umstellung (2026-09-05)

Die ursprüngliche Phase-1-Fassung war eine flache 2D-DOM-Fläche (`%`-Positionen, CSS-Filter-
Einfärbung, Kontextmenü). Auf expliziten Nutzerwunsch durch eine echte Three.js-Szene ersetzt:
warmer 3D-Raum mit Tiefe, Licht, Schatten, fester leicht schräger Kamera, frei
platzierbaren/drehbaren Möbeln.

- **Altes Format** `{x, y, flipped}` (normiert 0–1) → **neues Format** `{x, z, rotationY}`
  (Meter/Radiant). Migration einmalig beim ersten Laden, siehe `JS/schloss-migration.js` –
  `design`/`color`/`customVariantId`/`scale`/`content` bleiben dabei unverändert.
- Möbel werden aktuell als aufrechte, aus den vorhandenen 2D-Gemini-Bildern geschnittene
  "Pappaufsteller" gerendert (`createFurnitureCutout()` in `schloss-3d.js`) – Übergangslösung,
  bis echte `.glb`-Modelle existieren. `furniture.flatOnFloor: true` (Teppich, Kissen) legt ein
  Möbelstück stattdessen flach auf den Boden statt es aufrecht zu stellen.
- Farb-Einfärben (`instance.color`, Canvas-Tinting) war im 2D-Editor fertig und ist seit
  2026-09-05 auch in der 3D-Szene angeschlossen (Farbkreise erscheinen beim Auswählen eines
  `colorable`-Möbelstücks über den Dreh-/Entfernen-Buttons).
- Three.js läuft als ES-Modul über eine Importmap (CDN `cdn.jsdelivr.net`, Version fest
  gepinnt). **Später:** lokal unter `JS/vendor/` ausliefern statt dauerhaft von einem
  externen CDN abhängig zu sein.
- Raum: 8 × 6 m, 3,2 m hoch. Holzboden + Steinwände (prozedurale Canvas-Texturen), gemaltes
  Waldfenster, Kamin, Decke, warmes Umgebungs-/Fenster-/Kaminlicht mit Schatten (auf
  Mobilgeräten reduziert). Kamera fest, kein freies Navigieren.
- Klick wählt ein Möbelstück aus (goldener Ring am Boden), zwei Buttons drehen in 22,5°-
  Schritten, ein dritter entfernt es aus dem Raum (Besitz in `ownedFurniture` bleibt davon
  unberührt). Ziehen ist auf den Raum begrenzt, eine einfache Abstandsprüfung schiebt
  überlappende Möbel sanft auseinander statt hart zu blockieren.
- Gespeichert wird nur beim Loslassen (nicht bei jedem Zieh-Tick).

## Levelsystem & Freischalt-Ablauf

Das Schloss ist das erste Ziel eines **allgemeinen** Mirelon-Level-/XP-Systems (nicht
Schloss-spezifisch – schaltet künftig auch andere Dinge frei):

- 5 echte Mirelon-Aktivitäten geben XP: Quiz (Kuro), die 4 Faro-Spiele, Malstube-Speichern,
  Baumkind-Pflege, Puzzle gelöst. Serverseitig über `earn_xp(reason)` nach dem exakten Muster
  von `earn_coins(reason)` (Cooldown-Schutz über `reward_cooldowns`, Client nennt nur den
  Grund, nie einen Betrag).
- **Level 3** schaltet `unlockedFeatures: ["castle"]` frei, zusammen mit einem
  Level-3-Startpaket (`stuhl_wald_a`, `tisch_wald_a`, `teppich_wald_a` + 20 Coins) – exakt
  einmal vergeben (`claimedLevelRewards`).
- Sidebar (`JS/sidebar.js`) und Karten-Hotspot (`JS/index.js`, `index.html`) lesen
  **ausschließlich** `player.progression.unlockedFeatures` als einzige Quelle der Wahrheit –
  vor der Freischaltung zeigen beide ein 🔒-Symbol und öffnen bei Klick eine In-Welt-Nachricht
  (`showLockedFeatureMessage()`, Text in `sidebar.js`) statt zu navigieren.
- Level-3-Aufstieg löst ein Erzähl-Panel mit **Faro** aus (`JS/level-up.js`,
  `STORY_EVENTS.castle_unlock`) statt eines einfachen Toasts. `pendingStoryEvents` steuert
  nur, *ob* das Panel noch gezeigt werden muss – niemals, *ob* eine Belohnung vergeben wird
  (das entscheidet ausschließlich das serverseitige `claimedLevelRewards`).

## Innenausstattungs-Stile ("Themes")

`player.schloss.style` wählt einen Stil. Katalog: `SCHLOSS_THEMES` in
[`JS/schloss-data.js`](../JS/schloss-data.js). Vier geplante Stile:

| id | Name | Stand |
|---|---|---|
| `wald` | Waldschloss | **vollständig** (Raumhülle + 18 Möbel) |
| `wueste` | Wüstenschloss | Datenmodell vorbereitet, `available: false`, keine Assets |
| `rosa` | Rosa-Zauber | Datenmodell vorbereitet, `available: false`, keine Assets |
| `feuer` | Feuerschloss | Datenmodell vorbereitet, `available: false`, keine Assets |

Jeder Stil hat eine `shell` (Boden-/Wand-/Deckenfarbe, Lichtstimmung, Hintergrund/Nebel,
Fenster-Himmelsfarben) – `JS/schloss-3d.js` liest sie beim Init und färbt Raum + Licht
entsprechend. Nur `wald` hat aktuell eine `shell`; die anderen fallen bewusst auf die
Wald-Hülle zurück, damit die Szene nie "kaputt" aussieht, solange sie im UI (`🎨 Stil`-Tab
in der Einrichtungs-Schublade) als **gesperrt** ("bald") markiert sind. Ein Klick auf ein
gesperrtes Theme wechselt NICHT, sondern zeigt nur einen Hinweis-Toast. Ein Stil wird erst
mit eigener `shell` **und** eigenem Möbelsatz freigegeben.

Der Stilwechsel bei einem *verfügbaren* Theme wird gespeichert und beim nächsten Laden der
Seite angewendet (kein Live-Neuaufbau der Szene – für Phase 1 ausreichend, da ohnehin nur
`wald` verfügbar ist).

## 3D-Möbelmodelle (`.glb`)

Möbel werden aktuell als aufrechte 2D-Bild-Cutouts gerendert. Pro Möbel kann in
`SCHLOSS_FURNITURE[*].designs[*].model` ein Pfad zu einem echten `.glb`-Modell gesetzt werden
(`null` = weiterhin Cutout). `JS/schloss-3d.js` lädt es dann per `GLTFLoader` in die
Möbelgruppe; schlägt das Laden fehl, fällt es automatisch auf den Cutout zurück. So kann
Möbel für Möbel umgestellt werden.

**Erste fünf Modelle:** `stuhl_wald_a`, `tisch_wald_a`, `teppich_wald_a`, `lampe_wald_a`,
`regal_wald_a` (die `model`-Felder sind schon als `null` angelegt).

**Anforderungen an die `.glb`-Dateien** (für den 3D-Generator):

- **Format:** `.glb` (binäres glTF 2.0), eine Datei pro Möbel, inkl. eingebetteter Texturen.
- **Ablage/Benennung:** `images/schloss/models/<furnitureId>.glb`, also z. B.
  `images/schloss/models/stuhl_wald_a.glb`.
- **Maßstab:** in **Metern**, real-world. Die ungefähre Grundfläche pro Möbel steht als
  `footprint {w, d}` in `JS/schloss-data.js` – Richtwerte: Stuhl 0,7 × 0,7 m, Tisch
  1,1 × 1,1 m, Teppich 2,2 × 1,5 m (flach, sehr niedrig), Lampe 0,5 × 0,5 m (≈1,5 m hoch),
  Regal 0,9 × 0,5 m (≈1,6 m hoch).
- **Pivot / Ursprung:** auf **Boden-Mitte** des Möbels (X/Z zentriert, Y = 0 an der
  Standfläche). Der Code schiebt zur Sicherheit die Unterkante noch auf Y = 0, aber sauber
  authored ist besser.
- **Ausrichtung:** "Vorderseite" zeigt nach **+Z**, aufrecht (Y = oben). Der Teppich liegt
  flach in der XZ-Ebene.
- **Stil:** warm, gemalt/storybook, passend zu den vorhandenen Möbelbildern
  (`images/schloss/moebel/*.png` als Referenz) – **kein** Fotorealismus, **kein** harter
  Plastik-/Glanz-Look, freundliche runde Formen, mittlere Detailtiefe.
- **Polycount:** je Möbel möglichst **unter ~5 000 Dreiecke** (Kinder-Webseite, läuft auch
  auf schwächeren Tablets; mehrere Möbel gleichzeitig in der Szene).
- **Texturen:** max. **1024 × 1024**, eine (höchstens zwei) pro Möbel, als
  Basecolor/Albedo ausreichend – gern zusätzlich eine dezente Normal-/Roughness-Map, aber
  nicht zwingend.
- **Keine Animationen**, keine Kameras/Lichter im Modell (die Szene bringt eigenes Licht mit).
- **Materialien:** Standard-glTF-PBR (`KHR_materials_*`-Extensions sind ok, aber
  konservativ – `three@0.160` GLTFLoader-kompatibel).
- **Lizenz:** nur Assets, die für die Website genutzt und im öffentlichen GitHub-Repo liegen
  dürfen (CC0 / eigene Erzeugung / kommerziell-nutzbare Lizenz). Kurzer Herkunfts-/Lizenz-
  Vermerk hilfreich.

Nach Anlieferung: `model:`-Feld im jeweiligen Katalog-Eintrag auf den Pfad setzen, Version in
`schloss.html` hochzählen, per Playwright prüfen (Modell erscheint, Maßstab passt, Ziehen/
Drehen/Entfernen unverändert).

Farb-Einfärben (`instance.color`) wirkt aktuell nur auf Cutouts – für einfärbbare Möbel mit
echtem `.glb`-Modell (Teppich) muss das Tinting später auf einen Material-Farbwechsel
umgestellt werden.

## Schlossladen (Phase 2)

Möbel ohne `unlockedBy` (also `unlockedBy: null`) sind normal per Coins kaufbar, Tab
"🛍️ Laden" in `schloss.html`. Preise stehen serverseitig in der Tabelle
`public.schloss_furniture` (nicht in einer `case`-Anweisung wie bei `purchase_item()`, da der
Katalog auf viele Gegenstände skalieren soll – neues Shop-Möbel = eine `insert`-Zeile).
Level-Belohnungs-Möbel (`unlockedBy.type === "level"`, z. B. das Startpaket, `lampe_wald_a`
bei Level 5) tauchen im Shop **nicht** auf – ausschließlich über Level-Aufstieg erreichbar.

Kauf-Ablauf ist identisch zum Muster aus `JS/bako.js` `buyBaumkind()`: lokale Vorab-Prüfung →
`purchase_schloss_furniture(id)`-RPC (Login) bzw. lokaler Abzug (Gast) → serverseitigen Wert
übernehmen → `ownedFurniture` ergänzen → speichern.

## Aktueller Möbel-Katalog (18 Stück, Stil "wald")

| Kategorie | Möbel |
|---|---|
| Sitzmöbel | Waldstuhl*, Waldsofa, Waldhocker, Waldsessel |
| Tische | Waldtisch*, Beistelltisch |
| Textilien | Waldteppich* (flach, einfärbbar), Kuschelkissen (flach), Waldvorhang |
| Licht | Waldlampe (Level 5), Kerzenständer |
| Pflanzen | Waldpflanze, Blumenkasten |
| Regale | Waldregal |
| Aufbewahrung | Holztruhe |
| Deko | Bilderrahmen (Inhalt noch leer, siehe "Später"), Waldspiegel, Waldkuckucksuhr |

\* Level-3-Startpaket, nicht im Shop kaufbar.

## Später (nicht angefangen, nur vorbereitet)

- **Echte `.glb`-Möbelmodelle** – Integration ist fertig (`design.model`-Feld + GLTFLoader
  mit Cutout-Fallback, siehe Abschnitt "3D-Möbelmodelle"), es fehlen nur die Modelldateien.
- **Weitere Themes** (`wueste`, `rosa`, `feuer`) – brauchen je eine `shell` + eigenen
  Möbelsatz, siehe Abschnitt "Innenausstattungs-Stile".
- **Weitere Räume** (Phase 3) – Datenmodell (`unlockedRooms`, `SCHLOSS_ROOMS`) ist bereit,
  nur `wohnzimmer` existiert bisher.
- **Trophäenzimmer / Haustierecke / Bilderrahmen-Inhalt** (Phase 4) – Achievement-Katalog hat
  bereits stabile `id`-Felder (siehe `player.js`), `PET_SPECIES` in `tamagotchi.js` ist noch
  nicht als `window.MIRELON_PET_SPECIES` exponiert, `hasContent`-Möbel haben noch keinen
  Anschluss an die `drawings`-Tabelle.
- **Möbel-Bemalen** (Phase 5) – geplant über eine modularisierte Malstube
  (`JS/draw-engine.js`, noch nicht existent) statt eines zweiten Mal-Editors, mit
  Base/Mask/Details-Ebenen und einem neuen Storage-Bucket `castle-customizations`.
  `customVariantId`/`customFurniture` sind im Datenmodell schon vorbereitet.
- Malstube-Stempel um Sticker (Herzen, Blumen, …) erweitern – unabhängig vom Schloss,
  trivial, noch nicht gemacht.

## Bekannte offene Kleinigkeiten

- Frisch aus dem Inventar platzierte Möbel können bei wenigen, ungünstig gewählten
  Startpositionen leicht überlappen (die Abstandsprüfung greift erst beim Ziehen, nicht beim
  ersten Ablegen) – kosmetisch, Kind zieht das Möbel ohnehin frei an seinen Platz.
- Die öffentliche Registrierung dieses Supabase-Projekts lieferte bei einem Testversuch einen
  500er ("Error sending confirmation email") – unabhängig vom Schloss-Feature, aber noch nicht
  untersucht.
