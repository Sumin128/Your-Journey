/* =====================================================
   MIRELONS JAGD - Datenkatalog
   Reine Daten (Regionen, Ringfelder, Abkürzungen, Ereignisse,
   Asset-Platzhalter-Verweise). Keine Spiellogik, kein DOM-Zugriff.
   Siehe BERICHT.md für Erklärungen zu den Entscheidungen hier.
   ===================================================== */

(function () {
    "use strict";

    // Vier Gebiete, je 12 Ringfelder (48 insgesamt). startIndex = globale
    // ID des eigenen Startfelds (immer relIdx 0 seines Musters).
    var REGIONS = [
        { id: "wurzelwald", name: "Wurzelwald", startIndex: 0 },
        { id: "wueste", name: "Wüstendünen", startIndex: 12 },
        { id: "frost", name: "Frostberge", startIndex: 24 },
        { id: "rosen", name: "Rosenauen", startIndex: 36 }
    ];

    var PLAYER_COLORS = {
        gruen: { name: "Waldgrün", hex: "#2f6b3e", region: "wurzelwald" },
        orange: { name: "Wüstenorange", hex: "#d97a2e", region: "wueste" },
        blau: { name: "Eisblau", hex: "#3f7fb0", region: "frost" },
        rosa: { name: "Rosenrot", hex: "#c1476b", region: "rosen" }
    };

    // Je nach Spielerzahl werden Gebiete/Farben in dieser Reihenfolge
    // vergeben - bei 2 Spielern gegenüberliegende Ecken (bessere Abstände).
    var REGION_ORDER_BY_COUNT = {
        1: ["wurzelwald"],
        2: ["wurzelwald", "frost"],
        3: ["wurzelwald", "wueste", "frost"],
        4: ["wurzelwald", "wueste", "frost", "rosen"]
    };

    // Relatives 12er-Muster je Gebiet: 10 normale Felder (inkl. Start)
    // und 2 zufällige Aktionsfelder. Das ergibt acht
    // Aktionsfelder auf dem gesamten 48er-Ring; einzelne Aktionen besitzen
    // bewusst kein eigenes festes Feld.
    var RING_PATTERN = [
        { type: "normal", isStart: true },
        { type: "normal" },
        { type: "normal" },
        { type: "action" },
        { type: "normal" },
        { type: "normal" },
        { type: "normal" },
        { type: "normal" },
        { type: "action" },
        { type: "normal" },
        { type: "normal" },
        { type: "normal" }
    ];

    // 48 Ringfelder, global durchnummeriert (region-Index * 12 + relIdx).
    var RING = [];
    REGIONS.forEach(function (region, regionIndex) {
        RING_PATTERN.forEach(function (cell, relIdx) {
            var merged = {};
            Object.keys(cell).forEach(function (k) { merged[k] = cell[k]; });
            merged.id = regionIndex * 12 + relIdx;
            merged.region = region.id;
            merged.relIdx = relIdx;
            RING.push(merged);
        });
    });

    // Abkürzungen sind Zufallsereignisse der normalen Aktionsfelder und
    // deshalb keine zusätzlichen, fest eingezeichneten Wege oder Felder.
    var SHORTCUTS = {};

    var HOME_LENGTH = 4; // vier sichtbare Zielplätze, passend zu maximal vier Figuren

    var EVENTS = [
        { id: "kehrtwende", name: "Kehrtwende", icon: "🔄", text: "Alle Figuren laufen für eine ganze Runde rückwärts." },
        { id: "rueckenwind", name: "Rückenwind", icon: "💨", text: "Alle aktiven Figuren ziehen 2 Felder vor." },
        { id: "gegenwind", name: "Gegenwind", icon: "🌬️", text: "Alle aktiven Figuren ziehen 2 Felder zurück." },
        { id: "eiszauber", name: "Eiszauber", icon: "❄️", text: "Manche deiner Figuren frieren kurz ein." },
        { id: "schutzschild", name: "Schutzschild", icon: "🛡️", text: "Wähle eine Figur - sie ist zwei eigene Züge lang geschützt." },
        { id: "platztausch", name: "Platztausch", icon: "🔀", text: "Zwei zufällige Figuren tauschen ihren Platz." },
        { id: "verfolgungsjagd", name: "Verfolgungsjagd", icon: "🏃", text: "Deine hinterste Figur springt dicht hinter die nächste gegnerische." },
        { id: "freiejagd", name: "Freie Jagd", icon: "🎯", text: "Du darfst sofort eine zweite Figur ziehen." },
        { id: "magischefessel", name: "Magische Fessel", icon: "⛓️", text: "Die Figur in Führung pausiert eine Runde." },
        { id: "tamosabkuerzung", name: "Tamos Abkürzung", icon: "🦫", text: "Tamo zeigt deiner Figur einen geheimen Weg: 6 Felder vor!" },
        { id: "wirbelwind", name: "Wirbelwind", icon: "🌀", text: "Alle aktiven Figuren wirbeln 3 Felder vorwärts." }
    ];

    function getEvent(id) {
        for (var i = 0; i < EVENTS.length; i++) {
            if (EVENTS[i].id === id) { return EVENTS[i]; }
        }
        return null;
    }

    function randomEventId() {
        return EVENTS[Math.floor(Math.random() * EVENTS.length)].id;
    }

    // Zentraler Asset-Katalog. Die Regel-Engine kennt weiterhin keine Dateien.
    var ASSETS = {
        boardBackground: { placeholder: false, file: "images/mirelons-jagd/spielfeld-mirelons-jagd-v2.webp" },
        boardFields: { placeholder: false, file: null, renderedBy: "jagd-ui.js" },
        branoPortrait: { placeholder: true, file: "images/jagd/brano-portrait.png", dir: "images/jagd/" },
        gameCardJagd: { placeholder: false, file: "images/mirelons-jagd/spielfeld-mirelons-jagd-v2.webp" },
        gameCardMiro: { placeholder: true, file: "images/jagd/card-miro.png", dir: "images/jagd/" },
        gameCardTierversteck: { placeholder: true, file: "images/jagd/card-tierversteck.png", dir: "images/jagd/" },
        playerTokens: {
            placeholder: false,
            gruen: "images/mirelons-jagd/figur-fuchs-gruen.png",
            orange: "images/mirelons-jagd/figur-loewe-gold.png",
            blau: "images/mirelons-jagd/figur-eule-eisblau.png",
            rosa: "images/mirelons-jagd/figur-hase-rosenrot.png"
        },
        fieldTextures: { placeholder: true, dir: "images/jagd/felder/" },
        actionIcons: {
            placeholder: false,
            kehrtwende: "images/mirelons-jagd/aktion-kehrtwende.png",
            rueckenwind: "images/mirelons-jagd/aktion-rueckenwind.png",
            gegenwind: "images/mirelons-jagd/aktion-gegenwind.png",
            eiszauber: "images/mirelons-jagd/aktion-eiszauber.png",
            schutzschild: "images/mirelons-jagd/aktion-schutzschild.png",
            platztausch: "images/mirelons-jagd/aktion-platztausch.png",
            verfolgungsjagd: "images/mirelons-jagd/aktion-verfolgungsjagd.png",
            freiejagd: "images/mirelons-jagd/aktion-freie-jagd.png",
            magischefessel: "images/mirelons-jagd/aktion-magische-fessel.png",
            tamosabkuerzung: "images/mirelons-jagd/aktion-tamos-abkuerzung.png",
            wirbelwind: "images/mirelons-jagd/aktion-wirbelwind.png"
        },
        protectionEffect: { placeholder: true, dir: "images/jagd/effekte/" },
        frozenEffect: { placeholder: true, dir: "images/jagd/effekte/" },
        castleCenter: { placeholder: true, file: "images/jagd/schloss-mitte.png", dir: "images/jagd/" },
        diceModel: { placeholder: false, file: "images/mirelons-jagd/wuerfel.glb" },
        diceTextures: { placeholder: true, dir: "models/jagd/wuerfel-texturen/" }
    };

    window.JagdData = {
        REGIONS: REGIONS,
        PLAYER_COLORS: PLAYER_COLORS,
        REGION_ORDER_BY_COUNT: REGION_ORDER_BY_COUNT,
        RING: RING,
        SHORTCUTS: SHORTCUTS,
        HOME_LENGTH: HOME_LENGTH,
        EVENTS: EVENTS,
        getEvent: getEvent,
        randomEventId: randomEventId,
        ASSETS: ASSETS
    };

})();
