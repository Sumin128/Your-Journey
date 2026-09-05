/* =====================================================
   SCHLOSS-DATA.JS
   "Mein Schloss": reiner Daten-Katalog (Kategorien, Räume, Möbel).
   Neues Möbelstück = neuer Eintrag hier, keine Logik-Änderung in
   JS/schloss.js nötig. Feature-Spezifikation: docs/mein-schloss.md

   PHASE-1-HINWEIS: alle sprite-Pfade sind Platzhalter (kleine
   Emoji-Kacheln, siehe schlossPlaceholderSprite() unten) - echte,
   mit Gemini gemalte Möbelbilder kommen erst in Schritt 5/6 der
   Umsetzung, nachdem ein erstes Test-Möbel gezeigt/freigegeben wurde.
   ===================================================== */

function schlossPlaceholderSprite(emoji, bgColor) {

    return "data:image/svg+xml;utf8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<rect width="100" height="100" rx="16" fill="' + (bgColor || "#e8ded0") + '"/>' +
        '<text x="50" y="64" font-size="46" text-anchor="middle">' + emoji + '</text>' +
        '</svg>'
    );

}

const SCHLOSS_CATEGORIES = [
    { id: "sitzmoebel", name: "Sitzmöbel", icon: "🪑" },
    { id: "tische", name: "Tische", icon: "🍽️" },
    { id: "textilien", name: "Textilien", icon: "🧶" },
    { id: "licht", name: "Licht", icon: "💡" },
    { id: "pflanzen", name: "Pflanzen", icon: "🌿" },
    { id: "regale", name: "Regale", icon: "📚" },
    { id: "deko", name: "Deko", icon: "🖼️" }
];

const SCHLOSS_ROOMS = [
    {
        id: "wohnzimmer",
        name: "Wohnzimmer",
        price: 0,
        // Kein Bild in Phase 1 (echter Raum-Hintergrund kommt mit den
        // übrigen Gemini-Assets, Schritt 5/6) - JS/schloss.js nutzt
        // stattdessen einen warmen CSS-Verlauf als Platzhalter.
        backgrounds: {}
    }
];

const SCHLOSS_FURNITURE = [

    {
        id: "stuhl_wald_a", name: "Waldstuhl", category: "sitzmoebel",
        styles: ["wald"], price: 15, size: "small", rooms: ["wohnzimmer"],
        designs: [{ sprite: schlossPlaceholderSprite("🪑") }],
        colorable: false, colors: [], paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },
    {
        id: "tisch_wald_a", name: "Waldtisch", category: "tische",
        styles: ["wald"], price: 20, size: "medium", rooms: ["wohnzimmer"],
        designs: [{ sprite: schlossPlaceholderSprite("🛋️") }],
        colorable: false, colors: [], paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },
    {
        id: "teppich_wald_a", name: "Waldteppich", category: "textilien",
        styles: ["wald"], price: 15, size: "large", rooms: ["wohnzimmer"],
        // "emoji" nur für den Platzhalter-Sprite gebraucht (siehe
        // schlossPlaceholderSprite() oben) - JS/schloss.js nutzt es,
        // um bei Farbwahl den Platzhalter live neu einzufärben. Fällt
        // mit den echten Gemini-Möbelbildern in Schritt 5/6 wieder weg.
        designs: [{ sprite: schlossPlaceholderSprite("🟫"), emoji: "🟫" }],
        // Farb-Technikprobe (Phase 1, siehe Architekturplan Abschnitt A)
        colorable: true, colors: ["#c8a06a", "#8fae6b", "#e0a53c", "#cf6b52"],
        paintable: false, hasContent: false,
        unlockedBy: { type: "level", level: 3 }
    },

    { id: "regal_wald_a", name: "Waldregal", category: "regale", styles: ["wald"], price: 25, size: "medium", rooms: ["wohnzimmer"], designs: [{ sprite: schlossPlaceholderSprite("📚") }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "sofa_wald_a", name: "Waldsofa", category: "sitzmoebel", styles: ["wald"], price: 35, size: "large", rooms: ["wohnzimmer"], designs: [{ sprite: schlossPlaceholderSprite("🛏️") }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "lampe_wald_a", name: "Waldlampe", category: "licht", styles: ["wald"], price: 12, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: schlossPlaceholderSprite("💡") }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: { type: "level", level: 5 } },
    { id: "pflanze_wald_a", name: "Waldpflanze", category: "pflanzen", styles: ["wald"], price: 10, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: schlossPlaceholderSprite("🌿") }], colorable: false, colors: [], paintable: false, hasContent: false, unlockedBy: null },
    { id: "rahmen_wald_a", name: "Bilderrahmen", category: "deko", styles: ["wald"], price: 18, size: "small", rooms: ["wohnzimmer"], designs: [{ sprite: schlossPlaceholderSprite("🖼️") }], colorable: false, colors: [], paintable: false, hasContent: true, unlockedBy: null }

];

function getSchlossFurniture(id) {
    return SCHLOSS_FURNITURE.find(function (item) { return item.id === id; }) || null;
}
