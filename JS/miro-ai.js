(function () {
    "use strict";

    var E = window.MiroEngine;

    function preferredColor(player) {
        var counts = {};
        player.hand.forEach(function (card) { if (card.color) { counts[card.color] = (counts[card.color] || 0) + 1; } });
        return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); })[0] || "gruen";
    }

    function chooseCard(state, playerId) {
        var cards = E.playableCards(state, playerId);
        if (!cards.length) { return null; }
        var score = { trade: 90, draw3: 80, draw2: 70, fog: 55, skip: 50, reverse: 40, treasure: 35, wish: 20 };
        return cards.slice().sort(function (a, b) {
            var av = a.kind === "number" ? a.value : (score[a.action] || 0);
            var bv = b.kind === "number" ? b.value : (score[b.action] || 0);
            return bv - av || a.id.localeCompare(b.id);
        })[0];
    }

    function chooseTrade(state, actorId) {
        var actor = state.players[actorId];
        var targets = state.players.filter(function (p) { return p.id !== actorId && p.hand.length; });
        targets.sort(function (a, b) { return b.hand.length - a.hand.length || a.id - b.id; });
        var give = actor.hand.slice().sort(function (a, b) {
            var av = a.kind === "number" ? a.value : 20;
            var bv = b.kind === "number" ? b.value : 20;
            return av - bv || a.id.localeCompare(b.id);
        })[0];
        return { targetId: targets[0] && targets[0].id, giveCardId: give && give.id, color: preferredColor(actor) };
    }

    function takeTurn(state) {
        var player = state.players[state.currentPlayerId];
        if (!player || player.type !== "ai") { return { type: "none" }; }
        if (state.phase === "choose-color") { return { type: "color", color: preferredColor(player) }; }
        if (state.phase === "trade") { return Object.assign({ type: "trade" }, chooseTrade(state, player.id)); }
        if (state.phase === "treasure") {
            var cards = state.pending.cards.slice().sort(function (a, b) {
                return (b.kind === "action" ? 20 : b.value) - (a.kind === "action" ? 20 : a.value);
            });
            return { type: "treasure", keepCardId: cards[0].id };
        }
        var card = chooseCard(state, player.id);
        if (card) { return { type: "play", cardId: card.id }; }
        if (state.phase === "chain") { return { type: "end-chain" }; }
        return { type: "draw" };
    }

    window.MiroAI = { takeTurn: takeTurn, preferredColor: preferredColor };
})();
