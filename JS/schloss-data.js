/* =====================================================
   SCHLOSS-DATA.JS
   "Mein Schloss": reiner Daten-Katalog (Kategorien, Räume, Möbel).
   Neues Möbelstück = neuer Eintrag hier, keine Logik-Änderung in
   JS/schloss.js nötig. Feature-Spezifikation: docs/mein-schloss.md

   Sprites: mit Gemini gemalt (siehe tools/gemini-mcp/), Stil-Referenz
   war der freigegebene Waldstuhl (images/schloss/moebel/stuhl_wald_a.png).
   ===================================================== */

const SCHLOSS_CATEGORIES = [
    { id: "sitzmoebel", name: "Sitzmöbel", icon: "🪑" },
    { id: "tische", name: "Tische", icon: "🍽️" },
    { id: "textilien", name: "Textilien", icon: "🧶" },
    { id: "licht", name: "Licht", icon: "💡" },
    { id: "pflanzen", name: "Pflanzen", icon: "🌿" },
    { id: "regale", name: "Regale", icon: "📚" },
    { id: "aufbewahrung", name: "Aufbewahrung", icon: "🧰" },
    { id: "deko", name: "Deko", icon: "🖼️" }
];

const SCHLOSS_ROOMS = [
    {
        id: "wohnzimmer",
        name: "Wohnzimmer",
        price: 0,
        backgrounds: {}
    }
];

/* =====================================================
   INNENAUSSTATTUNGS-STILE ("Themes")
   player.schloss.style wählt einen aus. Jeder Stil hat eine eigene
   "Raumhülle" (shell: Boden-/Wand-/Deckenfarbe, Lichtstimmung,
   Hintergrund/Nebel) und – später – einen eigenen Möbelsatz.

   NUR "wald" ist in diesem Durchgang vollständig. Die anderen drei
   sind bewusst als available:false markiert und haben noch KEINE
   shell/Möbel – sie dürfen im UI nicht so wirken, als wären sie
   fertig, und werden erst mit ihren eigenen Assets aktiv.
   Die shell-Werte werden von JS/schloss-3d.js gelesen (applyThemeShell()).
   ===================================================== */

const SCHLOSS_THEMES = [
    {
        id: "wald",
        name: "Waldschloss",
        icon: "🌲",
        available: true,
        shell: {
            floorBaseColor: "#b98c53",
            wallBaseColor: "#c3a982",
            ceilingColor: 0x6f573b,
            // Hintergrund + Nebel: warmes, HELLES Cremeweiss. Der schmale
            // Bereich, den die Kamera ueber der Wandkrone sieht, wirkt so
            // luftig-hell statt als dunkler Dachbalken.
            background: 0xf2e6cb,
            fogColor: 0xf2e6cb,
            ambient: { color: 0xffeccb, intensity: 0.6 },
            windowLight: { color: 0xfff3de, intensity: 1.25 },
            fireLight: { color: 0xff9c4a, intensity: 1.4 },
            windowSky: ["#fdeaba", "#ffd08a", "#e9a566"]
        }
    },
    { id: "wueste", name: "Wüstenschloss", icon: "🏜️", available: false, shell: null },
    { id: "rosa", name: "Rosa-Zauber", icon: "🌸", available: false, shell: null },
    { id: "feuer", name: "Feuerschloss", icon: "🔥", available: false, shell: null }
];

function getSchlossTheme(id) {
    return SCHLOSS_THEMES.find(function (theme) { return theme.id === id; }) || SCHLOSS_THEMES[0];
}

/* Möbel-Designs: sprite = gemaltes 2D-Bild (aktuell als aufrechter
   Cutout in der 3D-Szene gerendert). model = optionaler Pfad zu einem
   echten .glb-3D-Modell (images/schloss/models/); ist er gesetzt, lädt
   JS/schloss-3d.js dieses statt des Cutouts (GLTFLoader), sonst bleibt
   es beim Bild. So kann Möbel für Möbel auf echtes 3D umgestellt
   werden, ohne alles auf einmal. Anforderungen an die .glb-Dateien:
   siehe docs/mein-schloss.md, Abschnitt "3D-Möbelmodelle". */

const SCHLOSS_FURNITURE = [

    {
        id: "stuhl_wald_a", name: "Waldstuhl", category: "sitzmoebel",
        styles: ["wald"], price: 15, size: "small", rooms: ["wohnzimmer"],
        footprint: { w: 0.7, d: 0.7 },
        designs: [{ sprite: "images/schloss/moebel/stuhl_wald_a.png", model: "images/schloss/models/stuhl_wald_a.glb" }],
        // seatSlots: echte, begrenzte Sitzplätze für seatDecor (Kissen).
        // Lokale Offsets zur Möbelgruppe (unrotiert), y = Sitzhöhe.
        seatSlots: [{ x: 0, y: 0.4, z: 0.05 }],
        colorable: false, colors: [], paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },
    // surface: Trägerfläche für surfaceDecor (Kerzen usw.). Nur FORM +
    // Feinwerte - die Maße/Höhe kommen aus der SICHTBAREN Modell-Oberseite
    // (JS/schloss-3d.js computeSurfaceZone), damit die Zone deckungsgleich
    // mit Tischplatte/Deckel ist und mit dem Möbel mitdreht.
    //   shape: "circle" (runde Platte) | "rect" (Deckel/Regal)
    //   inset: XZ-Rand einwärts (m)   drop: Höhe unter die Modell-Oberkante (m)
    {
        id: "tisch_wald_a", name: "Waldtisch", category: "tische",
        styles: ["wald"], price: 20, size: "medium", rooms: ["wohnzimmer"],
        footprint: { w: 1.1, d: 1.1 },
        surface: { shape: "circle", inset: 0.02 },
        designs: [{ sprite: "images/schloss/moebel/tisch_wald_a.png", model: "images/schloss/models/tisch_wald_a.glb" }],
        colorable: false, colors: [], paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },
    {
        id: "teppich_wald_a", name: "Waldteppich", category: "textilien",
        styles: ["wald"], price: 15, size: "large", rooms: ["wohnzimmer"],
        footprint: { w: 2.2, d: 1.5 },
        // Liegt flach auf dem Boden statt aufrecht zu stehen wie die
        // übrigen Cutout-Möbel (siehe flatOnFloor in JS/schloss-3d.js).
        flatOnFloor: true,
        // Boden-Dekoration: nimmt NICHT an der Möbel-zu-Möbel-Kollision
        // teil (Tisch/Stuhl dürfen auf dem Teppich stehen), bleibt aber
        // an die Raumgrenzen gebunden. Siehe JS/schloss-3d.js.
        placementType: "floorDecor",
        // GLB (images/schloss/models/teppich_wald_a.glb) liegt bereit,
        // bleibt aber bewusst UNverdrahtet: das Einfärben (colorable
        // unten) arbeitet konturerhaltend auf der Sprite-Textur des
        // Cutouts - auf einem GLB-Mesh würde es nicht greifen. Der
        // flach liegende Teppich-Cutout sieht ohnehin gut aus; erst
        // wenn das GLB-Tinting steht, hier auf den Pfad umstellen.
        // Sprite v2: echt rechteckig (gerade Kanten, 90°-Ecken, Aufsicht) -
        // die alte Version war perspektivisch gemalt und "kippte" flach
        // auf dem Boden. ?v=2 bricht den HTTP-Cache der ersetzten Datei.
        designs: [{ sprite: "images/schloss/moebel/teppich_wald_a.png?v=3", model: null }],
        // Einfärbbar: konturerhaltendes Canvas-Tinting, in der 3D-Szene
        // angeschlossen (Farbkreise beim Auswählen, siehe JS/schloss-3d.js).
        colorable: true, colors: ["#c8a06a", "#8fae6b", "#e0a53c", "#cf6b52"],
        paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },
    {
        id: "teppich_rund_wald_a", name: "Runder Waldteppich", category: "textilien",
        styles: ["wald"], price: 16, size: "large", rooms: ["wohnzimmer"],
        footprint: { w: 2.1, d: 2.1 },
        // Gleiche Boden-Deko-Mechanik wie der eckige Teppich: liegt flach,
        // nimmt NICHT an der Möbel-Kollision teil (Tisch/Stühle dürfen
        // darauf stehen), bleibt an die Raumgrenzen gebunden.
        flatOnFloor: true,
        placementType: "floorDecor",
        designs: [{ sprite: "images/schloss/moebel/teppich_rund_wald_a.png", model: null }],
        colorable: true, colors: ["#d8b271", "#9bb06a", "#e0a53c", "#cf6b52"],
        paintable: false, hasContent: false,
        unlockedBy: null
    },

    // regal: GLB 2026-09-08 komplett neu generiert (Tripo image_to_3d aus
    // dem Sprite, 9k faces, 1024/WEBP, Boden-Pivot, Basecolor waermer) -
    // die alte GLB rendete als merkmalsloser blasser Klotz. Jetzt sichtbare
    // Boeden + Buecher + Eicheln. ID/footprint/Preis unveraendert.
    // footprint 0.9x0.5 -> 1.1x0.9: die neue GLB ist raeumlich fuelliger als
    // der alte flache Cutout; grössere Grundfläche = Kollision/Wandabstand
    // passen zur sichtbaren Form (sonst ragt das Regal in die Wand). Ein
    // an die Wand geschobenes Alt-Regal rueckt beim Laden minimal nach vorn.
    { id: "regal_wald_a", name: "Waldregal", category: "regale", styles: ["wald"], price: 25, size: "medium", rooms: ["wohnzimmer"], footprint: { w: 1.1, d: 0.9 }, modelScale: 1.05, surface: { shape: "rect", inset: 0.1 }, designs: [{ sprite: "images/schloss/moebel/regal_wald_a.png", model: "images/schloss/models/regal_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "sofa_wald_a", name: "Waldsofa", category: "sitzmoebel", styles: ["wald"], price: 35, size: "large", rooms: ["wohnzimmer"], footprint: { w: 1.8, d: 0.9 }, modelRotationY: -1.5708, seatSlots: [{ x: -0.4, y: 0.34, z: 0.2 }, { x: 0.4, y: 0.34, z: 0.2 }], designs: [{ sprite: "images/schloss/moebel/sofa_wald_a.png", model: "images/schloss/models/sofa_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // Waldlampe: echtes GLB (Tripo image_to_3d aus bereinigtem Sprite -
    // der gemalte Glueh-Kranz wurde vor der Generation entfernt, sonst
    // zackige Schirm-Kante). Punktlicht + Leuchtkern + An/Aus-Schalter
    // (instance.lightOn) laufen unveraendert oben drauf.
    { id: "lampe_wald_a", name: "Waldlampe", category: "licht", styles: ["wald"], price: 12, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.42, d: 0.42 }, designs: [{ sprite: "images/schloss/moebel/lampe_wald_a.png", model: "images/schloss/models/lampe_wald_a.glb" }], light: { color: "#ffdca6", intensity: 6.5, distance: 3.8, height: 1.05 }, colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: { type: "level", level: 5 } },
    { id: "pflanze_wald_a", name: "Waldpflanze", category: "pflanzen", styles: ["wald"], price: 10, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.5, d: 0.5 }, modelScale: 1.35, designs: [{ sprite: "images/schloss/moebel/pflanze_wald_a.png", model: "images/schloss/models/pflanze_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // Wanddeko: hängt an einer Innenwand (placementType "wallDecor",
    // siehe JS/schloss-3d.js). Uhr/Gemälde/Spiegel bleiben vorerst 2D-
    // Cutout mit dünner dunkler Rückplatte (Tiefe + Schatten).
    { id: "rahmen_wald_a", name: "Bilderrahmen", category: "deko", styles: ["wald"], price: 18, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.55, d: 0.12 }, placementType: "wallDecor", designs: [{ sprite: "images/schloss/moebel/rahmen_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: true, unlockedBy: null },

    // --- Phase 2: Schlossladen-Erweiterung (alle frei per Coins kaufbar) ---
    // hocker: GLB aus Tripo image_to_3d (Sprite-Vorlage), auf 1024 +
    // Boden-Pivot konvertiert, Basecolor waermer nachgetoent (Honig-Eiche
    // naeher am Waldstuhl). ID/footprint unveraendert -> Platzierungen bleiben.
    { id: "hocker_wald_a", name: "Waldhocker", category: "sitzmoebel", styles: ["wald"], price: 10, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.5, d: 0.5 }, designs: [{ sprite: "images/schloss/moebel/hocker_wald_a.png", model: "images/schloss/models/hocker_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // baenkchen (Waldsessel): jetzt echtes GLB (Tripo image_to_3d aus dem
    // Sprite, 8k faces, 1024 + Boden-Pivot, Basecolor waermer). ID/footprint/
    // Preis unveraendert -> gespeicherte Platzierungen bleiben. seatSlots:
    // eine begrenzte Sitzflaeche -> Kuschelkissen rastet auch hier ein
    // (JS/schloss-3d.js dragSeatDecor), max. 1 Kissen.
    { id: "baenkchen_wald_a", name: "Waldsessel", category: "sitzmoebel", styles: ["wald"], price: 22, size: "medium", rooms: ["wohnzimmer"], footprint: { w: 0.9, d: 0.9 }, modelScale: 1.12, seatSlots: [{ x: 0, y: 0.32, z: -0.02 }], designs: [{ sprite: "images/schloss/moebel/baenkchen_wald_a.png", model: "images/schloss/models/baenkchen_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "beistelltisch_wald_a", name: "Beistelltisch", category: "tische", styles: ["wald"], price: 16, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.65, d: 0.65 }, surface: { shape: "circle", inset: 0.06 }, designs: [{ sprite: "images/schloss/moebel/beistelltisch_wald_a.png", model: "images/schloss/models/beistelltisch_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // kissen: leicht-3D GLB (Tripo, Basecolor waermer + Blattgruen kraeftiger
    // nachbearbeitet). Bleibt reines Bodenobjekt (kein surfaceDecor -> rastet
    // NICHT auf Sitzmoebeln ein). footprint 0.5 -> 0.7 + modelScale 1.35,
    // sonst war das Kissen im Raum ein unlesbar kleiner Klumpen.
    // kissen: seatDecor - Boden ODER echter Sitz-Slot auf Waldstuhl/Waldsofa
    // (JS/schloss-3d.js dragSeatDecor). Auf dem Sitz automatisch ausgerichtet
    // + verkleinert; kein Dreh-Button solange eingerastet.
    { id: "kissen_wald_a", name: "Kuschelkissen", category: "textilien", styles: ["wald"], price: 8, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.7, d: 0.7 }, modelScale: 1.35, placementType: "seatDecor", flatOnFloor: true, designs: [{ sprite: "images/schloss/moebel/kissen_wald_a.png", model: "images/schloss/models/kissen_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // Vorhang: wallDecor + coversOpening -> darf VOR dem Rückwand-Fenster
    // hängen (rastet auf die Fenstermitte ein), Öffnungs-Meidung aus.
    { id: "vorhang_wald_a", name: "Waldvorhang", category: "textilien", styles: ["wald"], price: 14, size: "medium", rooms: ["wohnzimmer"], footprint: { w: 1.35, d: 0.12 }, placementType: "wallDecor", coversOpening: true, designs: [{ sprite: "images/schloss/moebel/vorhang_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "spiegel_wald_a", name: "Waldspiegel", category: "deko", styles: ["wald"], price: 20, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.6, d: 0.12 }, placementType: "wallDecor", designs: [{ sprite: "images/schloss/moebel/spiegel_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // wandleuchte: im Code gebaut (design.builtin "wallSconce" ->
    // buildBuiltinFurniture in JS/schloss-3d.js), weil Generatoren fuer so
    // eine kleine Wandarmatur keine saubere Form liefern. wallDecor + light
    // (KEINE flame): die Engine haengt sie an Rueck-/links-/rechts-Wand,
    // richtet sie automatisch aus (kein Dreh-Button), Fenster/Tuer/Kamin
    // werden ausgespart, Punktlicht + Leuchtkern + 💡/🌙-Schalter; lightOn
    // wird gespeichert. light.forward/height sitzen auf der Glaskugel.
    { id: "wandleuchte_wald_a", name: "Wandleuchte", category: "licht", styles: ["wald"], price: 14, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.3, d: 0.28 }, placementType: "wallDecor", light: { color: "#ffdca6", intensity: 2.8, distance: 3.2, height: -0.03, forward: 0.19 }, designs: [{ sprite: "images/schloss/moebel/wandleuchte_wald_a.png", builtin: "wallSconce" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // Wanddeko-Bilder: hochwertige gemalte 2D-Kunst (bewusst KEIN GLB -
    // flache Wandobjekte). wallDecor: nur verschiebbar, kein Dreh-Button,
    // Auto-Ausrichtung zur Wand, Fenster/Tuer/Kamin ausgespart, Hoehe
    // frei; die duenne dunkle Rueckplatte (populateWithCutout) gibt Tiefe.
    { id: "uhr_wald_a", name: "Wanduhr", category: "deko", styles: ["wald"], price: 18, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.5, d: 0.1 }, placementType: "wallDecor", designs: [{ sprite: "images/schloss/moebel/uhr_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "gemaelde_wald_a", name: "Waldgemälde", category: "deko", styles: ["wald"], price: 22, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.62, d: 0.1 }, placementType: "wallDecor", designs: [{ sprite: "images/schloss/moebel/gemaelde_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "gemaelde_nacht_a", name: "Mondwald-Bild", category: "deko", styles: ["wald"], price: 22, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.6, d: 0.1 }, placementType: "wallDecor", designs: [{ sprite: "images/schloss/moebel/gemaelde_nacht_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // Wandbehang: gemaltes Stoff-Banner mit Mirelon-Baumwappen (Gemini,
    // Alpha-Kante direkt aus dem PNG, kein Chroma-Key). Wie die Bilder:
    // wallDecor, nur verschiebbar, kein Dreh-Button, Auto-Ausrichtung.
    { id: "banner_wald_a", name: "Wandbehang", category: "deko", styles: ["wald"], price: 20, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.55, d: 0.1 }, placementType: "wallDecor", designs: [{ sprite: "images/schloss/moebel/banner_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // Kerze: surfaceDecor - steht auf Tisch/Beistelltisch/Regal/Truhe
    // (deren surface-Zone), sonst Boden. flame + light -> An/Aus-Schalter,
    // flackerndes Punktlicht im gemeinsamen Licht-Budget.
    { id: "kerze_wald_a", name: "Kerzenständer", category: "licht", styles: ["wald"], price: 6, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.16, d: 0.16 }, placementType: "surfaceDecor", flame: true, light: { color: "#ffcf8a", intensity: 2.0, distance: 2.4, height: 0.34 }, designs: [{ sprite: "images/schloss/moebel/kerze_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // stehleuchter: NEUES Bodenmoebel (kein Ersatz). GLB aus Tripo
    // (Gemini-Konzept, gedrechselter Holz-Standleuchter mit dicker Kerze;
    // OHNE Flamme im Modell). flame + light -> die Engine setzt Flamme +
    // Leuchtkern + 🕯️/🌙-Schalter oben drauf; lightOn wird in der Instanz
    // gespeichert und liegt im gemeinsamen Licht-Budget wie die Waldlampe.
    { id: "stehleuchter_wald_a", name: "Stehleuchter", category: "licht", styles: ["wald"], price: 16, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.28, d: 0.28 }, flame: true, light: { color: "#ffcf8a", intensity: 3.2, distance: 3.6, height: 0.9 }, designs: [{ sprite: "images/schloss/moebel/stehleuchter_wald_a.png", model: "images/schloss/models/stehleuchter_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "truhe_wald_a", name: "Holztruhe", category: "aufbewahrung", styles: ["wald"], price: 28, size: "medium", rooms: ["wohnzimmer"], footprint: { w: 0.9, d: 0.6 }, surface: { shape: "rect", inset: 0.1, drop: 0.04 }, designs: [{ sprite: "images/schloss/moebel/truhe_wald_a.png", model: "images/schloss/models/truhe_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    // GLB: Tripo image_to_3d aus dem freigegebenen Sprite (detaillierte
    // Geometrie), Textur auf 1024 + Pivot auf Boden-Mitte konvertiert.
    // ID/footprint/Preis/placement unveraendert -> gespeicherte
    // Platzierungen bleiben; Sprite bleibt als Ladefehler-Fallback.
    { id: "blumenkasten_wald_a", name: "Blumenkasten", category: "pflanzen", styles: ["wald"], price: 12, size: "small", rooms: ["wohnzimmer"], footprint: { w: 1.0, d: 0.4 }, designs: [{ sprite: "images/schloss/moebel/blumenkasten_wald_a.png", model: "images/schloss/models/blumenkasten_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null }

];

function getSchlossFurniture(id) {
    return SCHLOSS_FURNITURE.find(function (item) { return item.id === id; }) || null;
}

// Sichtbarer Hinweis in der Konsole auf Möbel, die noch ein echtes
// 3D-Modell brauchen (aktuell nur die Waldlampe, siehe needs3DAsset).
SCHLOSS_FURNITURE.forEach(function (f) {
    if (f.needs3DAsset) {
        console.info("[Mein Schloss] TODO 3D-Asset – " + f.id + ": " + f.needs3DAsset);
    }
});
