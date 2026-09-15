(function () {
    "use strict";

    var COLORS = {
        gruen: { name: "Waldgrün", short: "Wald", hex: "#38754b", icon: "🍃" },
        orange: { name: "Wüstenorange", short: "Wüste", hex: "#d48632", icon: "☀️" },
        blau: { name: "Eisblau", short: "Eis", hex: "#4c8db8", icon: "❄️" },
        rosa: { name: "Rosenrot", short: "Rosen", hex: "#bd526e", icon: "🌹" }
    };

    var ACTIONS = {
        draw2: { name: "+2 ziehen", icon: "images/miro/aktion-ziehen-2.png", colored: true },
        draw3: { name: "+3 ziehen", icon: "images/miro/aktion-ziehen-3.png", colored: true },
        skip: { name: "Aussetzen", icon: "images/miro/aktion-aussetzen.png", colored: true },
        reverse: { name: "Richtung wechseln", icon: "images/miro/aktion-richtungswechsel.png", colored: true, minPlayers: 3 },
        treasure: { name: "Schatzfund", icon: "images/miro/aktion-schatzfund.png", colored: true },
        fog: { name: "Nebelzauber", icon: "images/miro/aktion-nebelzauber.png", colored: true },
        wish: { name: "Farbe wünschen", icon: "images/miro/aktion-farbwunsch.png", colored: false },
        trade: { name: "Kartentausch", icon: "images/miro/aktion-kartentausch.png", colored: false }
    };

    function createDeck(playerCount) {
        var cards = [];
        var serial = 0;
        Object.keys(COLORS).forEach(function (color) {
            for (var copy = 0; copy < 2; copy++) {
                for (var value = 1; value <= 10; value++) {
                    cards.push({ id: "c" + serial++, kind: "number", color: color, value: value });
                }
            }
            ["draw2", "draw3", "skip", "treasure", "fog"].forEach(function (action) {
                cards.push({ id: "c" + serial++, kind: "action", color: color, action: action });
            });
            if (playerCount >= 3) {
                cards.push({ id: "c" + serial++, kind: "action", color: color, action: "reverse" });
            }
        });
        for (var i = 0; i < 4; i++) {
            cards.push({ id: "c" + serial++, kind: "wild", color: null, action: "wish" });
            cards.push({ id: "c" + serial++, kind: "wild", color: null, action: "trade" });
        }
        return cards;
    }

    window.MiroData = {
        COLORS: COLORS,
        ACTIONS: ACTIONS,
        createDeck: createDeck,
        cardBack: "images/miro/kartenrueckseite.png"
    };
})();
