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
            floorBaseColor: "#a9793f",
            wallBaseColor: "#a9855f",
            ceilingColor: 0x40301f,
            // Hintergrund + Nebel bewusst = Deckenfarbe: bei sehr
            // hohem Hochformat kann die Kamera knapp über die Decke
            // hinausblicken - so verschmilzt dieser Rand mit ihr
            // statt als dunkler "Balken" aufzufallen.
            background: 0x40301f,
            fogColor: 0x40301f,
            ambient: { color: 0xffe3bd, intensity: 0.5 },
            windowLight: { color: 0xfff1d6, intensity: 0.85 },
            fireLight: { color: 0xff9c4a, intensity: 1.4 },
            windowSky: ["#ffe2a0", "#ffb877", "#dd8a4e"]
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
        colorable: false, colors: [], paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },
    {
        id: "tisch_wald_a", name: "Waldtisch", category: "tische",
        styles: ["wald"], price: 20, size: "medium", rooms: ["wohnzimmer"],
        footprint: { w: 1.1, d: 1.1 },
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
        // GLB (images/schloss/models/teppich_wald_a.glb) liegt bereit,
        // bleibt aber bewusst UNverdrahtet: das Einfärben (colorable
        // unten) arbeitet konturerhaltend auf der Sprite-Textur des
        // Cutouts - auf einem GLB-Mesh würde es nicht greifen. Der
        // flach liegende Teppich-Cutout sieht ohnehin gut aus; erst
        // wenn das GLB-Tinting steht, hier auf den Pfad umstellen.
        designs: [{ sprite: "images/schloss/moebel/teppich_wald_a.png", model: null }],
        // Einfärbbar: konturerhaltendes Canvas-Tinting, in der 3D-Szene
        // angeschlossen (Farbkreise beim Auswählen, siehe JS/schloss-3d.js).
        colorable: true, colors: ["#c8a06a", "#8fae6b", "#e0a53c", "#cf6b52"],
        paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },

    { id: "regal_wald_a", name: "Waldregal", category: "regale", styles: ["wald"], price: 25, size: "medium", rooms: ["wohnzimmer"], footprint: { w: 0.9, d: 0.5 }, designs: [{ sprite: "images/schloss/moebel/regal_wald_a.png", model: "images/schloss/models/regal_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "sofa_wald_a", name: "Waldsofa", category: "sitzmoebel", styles: ["wald"], price: 35, size: "large", rooms: ["wohnzimmer"], footprint: { w: 1.8, d: 0.9 }, designs: [{ sprite: "images/schloss/moebel/sofa_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "lampe_wald_a", name: "Waldlampe", category: "licht", styles: ["wald"], price: 12, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.5, d: 0.5 }, designs: [{ sprite: "images/schloss/moebel/lampe_wald_a.png", model: "images/schloss/models/lampe_wald_a.glb" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: { type: "level", level: 5 } },
    { id: "pflanze_wald_a", name: "Waldpflanze", category: "pflanzen", styles: ["wald"], price: 10, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.5, d: 0.5 }, designs: [{ sprite: "images/schloss/moebel/pflanze_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "rahmen_wald_a", name: "Bilderrahmen", category: "deko", styles: ["wald"], price: 18, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.5, d: 0.3 }, designs: [{ sprite: "images/schloss/moebel/rahmen_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: true, unlockedBy: null },

    // --- Phase 2: Schlossladen-Erweiterung (alle frei per Coins kaufbar) ---
    { id: "hocker_wald_a", name: "Waldhocker", category: "sitzmoebel", styles: ["wald"], price: 10, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.5, d: 0.5 }, designs: [{ sprite: "images/schloss/moebel/hocker_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "baenkchen_wald_a", name: "Waldsessel", category: "sitzmoebel", styles: ["wald"], price: 22, size: "medium", rooms: ["wohnzimmer"], footprint: { w: 0.9, d: 0.9 }, designs: [{ sprite: "images/schloss/moebel/baenkchen_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "beistelltisch_wald_a", name: "Beistelltisch", category: "tische", styles: ["wald"], price: 16, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.6, d: 0.6 }, designs: [{ sprite: "images/schloss/moebel/beistelltisch_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "kissen_wald_a", name: "Kuschelkissen", category: "textilien", styles: ["wald"], price: 8, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.5, d: 0.5 }, flatOnFloor: true, designs: [{ sprite: "images/schloss/moebel/kissen_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "vorhang_wald_a", name: "Waldvorhang", category: "textilien", styles: ["wald"], price: 14, size: "medium", rooms: ["wohnzimmer"], footprint: { w: 0.6, d: 0.3 }, designs: [{ sprite: "images/schloss/moebel/vorhang_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "spiegel_wald_a", name: "Waldspiegel", category: "deko", styles: ["wald"], price: 20, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.6, d: 0.2 }, designs: [{ sprite: "images/schloss/moebel/spiegel_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "uhr_wald_a", name: "Waldkuckucksuhr", category: "deko", styles: ["wald"], price: 18, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.6, d: 0.2 }, designs: [{ sprite: "images/schloss/moebel/uhr_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "kerze_wald_a", name: "Kerzenständer", category: "licht", styles: ["wald"], price: 6, size: "small", rooms: ["wohnzimmer"], footprint: { w: 0.35, d: 0.35 }, designs: [{ sprite: "images/schloss/moebel/kerze_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "truhe_wald_a", name: "Holztruhe", category: "aufbewahrung", styles: ["wald"], price: 28, size: "medium", rooms: ["wohnzimmer"], footprint: { w: 1.0, d: 0.6 }, designs: [{ sprite: "images/schloss/moebel/truhe_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "blumenkasten_wald_a", name: "Blumenkasten", category: "pflanzen", styles: ["wald"], price: 12, size: "small", rooms: ["wohnzimmer"], footprint: { w: 1.0, d: 0.4 }, designs: [{ sprite: "images/schloss/moebel/blumenkasten_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null }

];

function getSchlossFurniture(id) {
    return SCHLOSS_FURNITURE.find(function (item) { return item.id === id; }) || null;
}
