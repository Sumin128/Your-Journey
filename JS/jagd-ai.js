/* =====================================================
   MIRELONS JAGD - Computergegner
   Keine perfekte KI, sondern eine feste Zugpriorität (siehe Prompt).
   Nutzt AUSSCHLIESSLICH dieselben Engine-Funktionen wie ein Mensch
   (JagdEngine.moveToken/enterToken) - keine Sonderregeln für den
   Computer, nur eine Bewertung der möglichen Ergebnisse auf einer
   Wegwerf-Kopie des Zustands.
   ===================================================== */

(function () {
    "use strict";

    var E = window.JagdEngine;

    function cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    function isThreatened(state, token) {
        if (token.zone !== "ring" || E.isProtectedToken(state, token)) { return false; }
        var myGlobal = E.globalCellOfToken(state, token);
        var threatened = false;
        state.players.forEach(function (p) {
            if (p.id === token.playerId) { return; }
            E.allTokensOf(state, p.id).forEach(function (o) {
                if (o.zone !== "ring") { return; }
                var dist = (myGlobal - E.globalCellOfToken(state, o) + 48) % 48;
                if (dist >= 1 && dist <= 6) { threatened = true; }
            });
        });
        return threatened;
    }

    function nearestOpponentDistance(state, token) {
        var myGlobal = E.globalCellOfToken(state, token);
        var best = 48;
        state.players.forEach(function (p) {
            if (p.id === token.playerId) { return; }
            E.allTokensOf(state, p.id).forEach(function (o) {
                if (o.zone !== "ring") { return; }
                var dist = (E.globalCellOfToken(state, o) - myGlobal + 48) % 48;
                if (dist > 0 && dist < best) { best = dist; }
            });
        });
        return best;
    }

    // KI-Figuren nehmen an Gabelungen immer die Abkürzung (Priorität 5).
    function resolveWithForks(clone, tokenId, steps) {
        var forkChoice = {}, res, guard = 0;
        do {
            res = E.moveToken(clone, tokenId, steps, forkChoice);
            if (res.needsForkChoice) { forkChoice[res.needsForkChoice] = "shortcut"; }
            guard++;
        } while (res.needsForkChoice && guard < 4);
        return res;
    }

    function scoreAction(state, playerId, action, diceValue) {
        var clone = cloneState(state);
        var beforeToken = state.tokens[action.tokenId];
        var wasThreatened = isThreatened(state, beforeToken);

        var outcome = action.kind === "enter"
            ? E.enterToken(clone, action.tokenId)
            : resolveWithForks(clone, action.tokenId, diceValue);

        var after = clone.tokens[action.tokenId];
        var score = 0;

        if (after.zone === "home" && (after.p - 48) >= 1) { score += 10000; }              // 1
        score += (outcome.captured ? outcome.captured.length : 0) * 3000;                   // 2
        var nowSafe = after.zone !== "ring" || E.isProtectedToken(clone, after);
        if (wasThreatened && nowSafe) { score += 1500; }                                    // 3
        if (action.kind === "enter") { score += 400; }                                      // 4
        if ((outcome.path || []).some(function (s) { return s.zone === "shortcut"; })) { score += 250; } // 5
        if (outcome.event) { score += 200; }                                                // 6
        if (after.zone === "ring") { score += nearestOpponentDistance(clone, after) * 2; }   // 7

        return score + Math.random(); // 8: Zufalls-Tiebreak bei Gleichstand
    }

    function chooseAction(state, diceValue) {
        var player = E.currentPlayer(state);
        var actions = E.getMovableTokens(state, player.id, diceValue);
        if (!actions.length) { return null; }
        var best = null, bestScore = -Infinity;
        actions.forEach(function (a) {
            var s = scoreAction(state, player.id, a, diceValue);
            if (s > bestScore) { bestScore = s; best = a; }
        });
        return best;
    }

    function chooseForkChoice() {
        return "shortcut"; // Priorität 5: sinnvolle Abkürzung nutzen
    }

    function chooseShieldTarget(state, playerId) {
        var mine = E.allTokensOf(state, playerId).filter(function (t) { return t.zone === "ring"; });
        if (!mine.length) { return null; }
        mine.sort(function (a, b) { return b.p - a.p; }); // am weitesten fortgeschrittene zuerst
        return mine[0].id;
    }

    window.JagdAI = {
        chooseAction: chooseAction,
        chooseForkChoice: chooseForkChoice,
        chooseShieldTarget: chooseShieldTarget,
        THINK_DELAY_MS: 900 // 700-1200ms laut Vorgabe
    };

})();
