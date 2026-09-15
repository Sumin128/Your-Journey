(function () {
    "use strict";

    var D = window.MiroData;

    function seededRandom(seed) {
        var value = (Number(seed) || Date.now()) >>> 0;
        return function () {
            value += 0x6D2B79F5;
            var t = value;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function shuffle(cards, random) {
        for (var i = cards.length - 1; i > 0; i--) {
            var j = Math.floor(random() * (i + 1));
            var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
        }
        return cards;
    }

    function cloneCard(card) { return Object.assign({}, card); }

    function createGame(configs, options) {
        options = options || {};
        if (!Array.isArray(configs) || configs.length < 2 || configs.length > 4) {
            throw new Error("Miro braucht 2 bis 4 Spieler.");
        }
        var random = seededRandom(options.seed);
        var state = {
            version: 1,
            revision: 0,
            phase: "coin",
            players: configs.map(function (cfg, i) {
                return { id: i, name: cfg.name || (cfg.type === "ai" ? "Miro-Magier" : "Spieler " + (i + 1)), type: cfg.type || "human", hand: [] };
            }),
            currentPlayerId: null,
            direction: 1,
            drawPile: shuffle(D.createDeck(configs.length), random),
            discardPile: [],
            activeColor: null,
            chainAvailable: false,
            pending: null,
            winnerId: null,
            log: [],
            seed: options.seed || Date.now(),
            _random: random
        };
        state.players.forEach(function (player) {
            for (var n = 0; n < 7; n++) { player.hand.push(state.drawPile.pop()); }
        });
        var starter = state.drawPile.pop();
        while (starter && starter.kind !== "number") {
            state.drawPile.unshift(starter);
            starter = state.drawPile.pop();
        }
        state.discardPile.push(starter);
        state.activeColor = starter.color;
        return state;
    }

    function startFromCoin(state, starterId) {
        requirePhase(state, "coin");
        if (!state.players[starterId]) { throw new Error("Ungültiger Startspieler."); }
        state.currentPlayerId = starterId;
        state.phase = "play";
        record(state, state.players[starterId].name + " beginnt die Partie.");
    }

    function chooseStarter(state) {
        requirePhase(state, "coin");
        return Math.floor(state._random() * state.players.length);
    }

    function requirePhase(state, phase) {
        if (state.winnerId !== null) { throw new Error("Die Partie ist bereits beendet."); }
        if (state.phase !== phase) { throw new Error("Diese Aktion ist jetzt nicht erlaubt."); }
    }

    function requireActor(state, actorId) {
        if (state.currentPlayerId !== actorId) { throw new Error("Du bist noch nicht dran."); }
    }

    function topCard(state) { return state.discardPile[state.discardPile.length - 1]; }

    function isPlayable(state, card) {
        if (card.kind === "wild" || card.action === "fog") { return true; }
        if (state.phase === "chain" && card.kind === "number") { return true; }
        var top = topCard(state);
        if (card.color === state.activeColor) { return true; }
        if (card.kind === "number" && top.kind === "number" && card.value === top.value) { return true; }
        return card.kind === "action" && top.kind === "action" && card.action === top.action;
    }

    function playReason(state, card) {
        if (!isPlayable(state, card)) { return ""; }
        if (card.kind === "wild" || card.action === "fog") { return "freie Zauberkarte"; }
        if (state.phase === "chain" && card.kind === "number") { return "Zauberkette"; }
        if (card.color === state.activeColor) { return "gleiche Farbe"; }
        var top = topCard(state);
        if (card.kind === "number" && top.kind === "number" && card.value === top.value) { return "gleiche Zahl"; }
        if (card.kind === "action" && top.kind === "action" && card.action === top.action) { return "gleiches Aktionssymbol"; }
        return "";
    }

    function playableCards(state, playerId) {
        var player = state.players[playerId];
        return player.hand.filter(function (card) {
            // Für den Kartentausch muss nach dem Ablegen noch eine Karte
            // zum Verschenken übrig sein. So kann die Wahlphase nie hängen.
            return isPlayable(state, card) && !(card.action === "trade" && player.hand.length < 2);
        });
    }

    function refillDrawPile(state) {
        if (state.drawPile.length || state.discardPile.length <= 1) { return; }
        var top = state.discardPile.pop();
        state.drawPile = shuffle(state.discardPile.splice(0), state._random);
        state.discardPile.push(top);
        record(state, "Der Ablagestapel wird neu gemischt.");
    }

    function drawOne(state) {
        refillDrawPile(state);
        return state.drawPile.length ? state.drawPile.pop() : null;
    }

    function drawCards(state, playerId, count) {
        var drawn = [];
        for (var i = 0; i < count; i++) {
            var card = drawOne(state);
            if (!card) { break; }
            state.players[playerId].hand.push(card);
            drawn.push(card);
        }
        return drawn;
    }

    function drawForTurn(state, actorId) {
        requireActor(state, actorId);
        requirePhase(state, "play");
        var drawn = drawCards(state, actorId, 1);
        if (!drawn.length) { finishTurn(state); return { drawn: [], turnEnded: true }; }
        record(state, state.players[actorId].name + " zieht eine Karte.");
        finishTurn(state);
        return { drawn: drawn, turnEnded: true };
    }

    function playCard(state, actorId, cardId) {
        requireActor(state, actorId);
        if (["play", "chain"].indexOf(state.phase) === -1) { throw new Error("Du kannst gerade keine Karte legen."); }
        var player = state.players[actorId];
        var index = player.hand.findIndex(function (card) { return card.id === cardId; });
        if (index < 0) { throw new Error("Diese Karte gehört dir nicht."); }
        var card = player.hand[index];
        if (!isPlayable(state, card)) { throw new Error("Diese Karte passt weder zu Farbe noch Symbol."); }
        if (card.action === "trade" && player.hand.length < 2) { throw new Error("Kartentausch kann nicht als letzte Karte gespielt werden."); }
        var previous = topCard(state);
        var reason = playReason(state, card);
        player.hand.splice(index, 1);
        state.discardPile.push(card);
        state.activeColor = card.color || state.activeColor;
        state.chainAvailable = card.kind === "number" && previous.kind === "number" && card.value === previous.value && card.color !== previous.color;
        record(state, player.name + " legt " + cardName(card) + (reason ? " – " + reason + "." : "."));

        if (card.action === "wish") {
            state.phase = "choose-color";
            state.pending = { type: "wish", actorId: actorId };
            return;
        }
        if (card.action === "trade") {
            state.phase = "trade";
            state.pending = { type: "trade", actorId: actorId };
            return;
        }
        if (card.action === "treasure") {
            var found = [];
            for (var t = 0; t < 2; t++) { var treasureCard = drawOne(state); if (treasureCard) { found.push(treasureCard); } }
            if (!found.length) { finishAfterCard(state, card); return; }
            state.phase = "treasure";
            state.pending = { type: "treasure", actorId: actorId, cards: found };
            return;
        }
        if (card.action === "fog") { resolveFog(state); }
        if (card.action === "reverse") { state.direction *= -1; record(state, "Die Spielrichtung wechselt."); }
        if (card.action === "draw2" || card.action === "draw3") {
            var victim = nextPlayerId(state, actorId, 1);
            var count = card.action === "draw2" ? 2 : 3;
            drawCards(state, victim, count);
            record(state, state.players[victim].name + " zieht " + count + " Karten und setzt aus.");
            finishAfterCard(state, card, 2);
            return;
        }
        if (card.action === "skip") {
            record(state, state.players[nextPlayerId(state, actorId, 1)].name + " setzt aus.");
            finishAfterCard(state, card, 2);
            return;
        }
        finishAfterCard(state, card);
    }

    function chooseColor(state, actorId, color) {
        requireActor(state, actorId);
        requirePhase(state, "choose-color");
        if (!D.COLORS[color]) { throw new Error("Unbekannte Farbe."); }
        state.activeColor = color;
        state.pending = null;
        record(state, state.players[actorId].name + " wünscht " + D.COLORS[color].name + ".");
        finishAfterCard(state, topCard(state));
    }

    function resolveTrade(state, actorId, targetId, giveCardId, color) {
        requireActor(state, actorId);
        requirePhase(state, "trade");
        var actor = state.players[actorId], target = state.players[targetId];
        if (!target || targetId === actorId) { throw new Error("Wähle einen anderen Spieler."); }
        if (!D.COLORS[color]) { throw new Error("Wähle eine gültige Farbe."); }
        var giveIndex = actor.hand.findIndex(function (card) { return card.id === giveCardId; });
        if (giveIndex < 0) { throw new Error("Wähle eine Karte aus deiner Hand."); }
        if (target.hand.length) {
            var takeIndex = Math.floor(state._random() * target.hand.length);
            var taken = target.hand.splice(takeIndex, 1)[0];
            var given = actor.hand.splice(giveIndex, 1)[0];
            target.hand.push(given); actor.hand.push(taken);
            record(state, actor.name + " und " + target.name + " tauschen je eine Karte.");
        }
        state.activeColor = color;
        state.pending = null;
        finishAfterCard(state, topCard(state));
    }

    function resolveTreasure(state, actorId, keepCardId) {
        requireActor(state, actorId);
        requirePhase(state, "treasure");
        var cards = state.pending.cards;
        var keep = cards.filter(function (c) { return c.id === keepCardId; })[0];
        if (!keep) { throw new Error("Wähle einen der beiden Schätze."); }
        state.players[actorId].hand.push(keep);
        cards.filter(function (c) { return c.id !== keepCardId; }).forEach(function (c) { state.drawPile.unshift(c); });
        record(state, state.players[actorId].name + " behält einen Schatz.");
        state.pending = null;
        finishAfterCard(state, topCard(state));
    }

    function resolveFog(state) {
        var gifts = [];
        state.players.forEach(function (player) {
            if (!player.hand.length) { gifts.push(null); return; }
            var index = Math.floor(state._random() * player.hand.length);
            gifts.push(player.hand.splice(index, 1)[0]);
        });
        gifts.forEach(function (card, giverId) {
            if (!card) { return; }
            var receiver = nextPlayerId(state, giverId, 1);
            state.players[receiver].hand.push(card);
        });
        record(state, "Der Nebel reicht zufällige Karten in Spielrichtung weiter.");
    }

    function finishChain(state, actorId) {
        requireActor(state, actorId);
        requirePhase(state, "chain");
        finishTurn(state);
    }

    function finishAfterCard(state, card, distance) {
        var player = state.players[state.currentPlayerId];
        if (!player.hand.length) { state.winnerId = player.id; state.phase = "finished"; record(state, player.name === "Du" ? "Du gewinnst Miro!" : player.name + " gewinnt Miro!"); return; }
        if (state.chainAvailable && card.kind === "number") {
            state.phase = "chain";
            state.chainAvailable = false;
            record(state, "Zauberkette: Eine weitere Zahlenkarte ist erlaubt.");
            return;
        }
        finishTurn(state, distance);
    }

    function finishTurn(state, distance) {
        state.currentPlayerId = nextPlayerId(state, state.currentPlayerId, distance || 1);
        state.phase = "play";
        state.pending = null;
        state.chainAvailable = false;
        state.revision++;
    }

    function nextPlayerId(state, fromId, distance) {
        var count = state.players.length;
        return (fromId + state.direction * (distance || 1) % count + count) % count;
    }

    function cardName(card) {
        if (card.kind === "number") { return D.COLORS[card.color].name + " " + card.value; }
        return D.ACTIONS[card.action].name;
    }

    function record(state, text) {
        state.log.unshift(text);
        if (state.log.length > 30) { state.log.length = 30; }
    }

    function snapshot(state) {
        var copy = JSON.parse(JSON.stringify(state, function (key, value) { return key === "_random" ? undefined : value; }));
        return copy;
    }

    window.MiroEngine = {
        createGame: createGame,
        chooseStarter: chooseStarter,
        startFromCoin: startFromCoin,
        topCard: topCard,
        isPlayable: isPlayable,
        playReason: playReason,
        playableCards: playableCards,
        drawForTurn: drawForTurn,
        playCard: playCard,
        chooseColor: chooseColor,
        resolveTrade: resolveTrade,
        resolveTreasure: resolveTreasure,
        finishChain: finishChain,
        nextPlayerId: nextPlayerId,
        snapshot: snapshot,
        cardName: cardName
    };
})();
