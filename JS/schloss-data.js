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
        // Kein eigener Raum-Hintergrund in Phase 1 - JS/schloss.js
        // nutzt stattdessen einen warmen CSS-Verlauf als Platzhalter.
        backgrounds: {}
    }
];

const SCHLOSS_FURNITURE = [

    {
        id: "stuhl_wald_a", name: "Waldstuhl", category: "sitzmoebel",
        styles: ["wald"], price: 15, size: "small", rooms: ["wohnzimmer"],
        designs: [{ sprite: "images/schloss/moebel/stuhl_wald_a.png" }],
        colorable: false, colors: [], paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },
    {
        id: "tisch_wald_a", name: "Waldtisch", category: "tische",
        styles: ["wald"], price: 20, size: "medium", rooms: ["wohnzimmer"],
        designs: [{ sprite: "images/schloss/moebel/tisch_wald_a.png" }],
        colorable: false, colors: [], paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },
    {
        id: "teppich_wald_a", name: "Waldteppich", category: "textilien",
        styles: ["wald"], price: 15, size: "large", rooms: ["wohnzimmer"],
        designs: [{ sprite: "images/schloss/moebel/teppich_wald_a.png" }],
        // Farb-Technikprobe (Phase 1, siehe Architekturplan Abschnitt A):
        // echtes Canvas-Tinting (multiply + destination-in), siehe
        // tintedSpriteUrl() in JS/schloss.js - kein Platzhalter-Trick
        // mehr nötig, jetzt am echten gemalten Sprite bewiesen.
        colorable: true, colors: ["#c8a06a", "#8fae6b", "#e0a53c", "#cf6b52"],
        paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },

    { id: "regal_wald_a", name: "Waldregal", category: "regale", styles: ["wald"], price: 25, size: "medium", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/regal_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "sofa_wald_a", name: "Waldsofa", category: "sitzmoebel", styles: ["wald"], price: 35, size: "large", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/sofa_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "lampe_wald_a", name: "Waldlampe", category: "licht", styles: ["wald"], price: 12, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/lampe_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: { type: "level", level: 5 } },
    { id: "pflanze_wald_a", name: "Waldpflanze", category: "pflanzen", styles: ["wald"], price: 10, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/pflanze_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "rahmen_wald_a", name: "Bilderrahmen", category: "deko", styles: ["wald"], price: 18, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/rahmen_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: true, unlockedBy: null },

    // --- Phase 2: Schlossladen-Erweiterung (alle frei per Coins kaufbar) ---
    { id: "hocker_wald_a", name: "Waldhocker", category: "sitzmoebel", styles: ["wald"], price: 10, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/hocker_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "baenkchen_wald_a", name: "Waldsessel", category: "sitzmoebel", styles: ["wald"], price: 22, size: "medium", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/baenkchen_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "beistelltisch_wald_a", name: "Beistelltisch", category: "tische", styles: ["wald"], price: 16, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/beistelltisch_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "kissen_wald_a", name: "Kuschelkissen", category: "textilien", styles: ["wald"], price: 8, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/kissen_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "vorhang_wald_a", name: "Waldvorhang", category: "textilien", styles: ["wald"], price: 14, size: "medium", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/vorhang_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "spiegel_wald_a", name: "Waldspiegel", category: "deko", styles: ["wald"], price: 20, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/spiegel_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "uhr_wald_a", name: "Waldkuckucksuhr", category: "deko", styles: ["wald"], price: 18, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/uhr_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "kerze_wald_a", name: "Kerzenständer", category: "licht", styles: ["wald"], price: 6, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/kerze_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "truhe_wald_a", name: "Holztruhe", category: "aufbewahrung", styles: ["wald"], price: 28, size: "medium", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/truhe_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "blumenkasten_wald_a", name: "Blumenkasten", category: "pflanzen", styles: ["wald"], price: 12, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: "images/schloss/moebel/blumenkasten_wald_a.png" }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null }

];

function getSchlossFurniture(id) {
    return SCHLOSS_FURNITURE.find(function (item) { return item.id === id; }) || null;
}
