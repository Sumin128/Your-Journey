/* =====================================================
   MIRELONS JAGD - Spiellogik / Zustand
   Reine Zustandsmaschine, KEIN DOM-Zugriff. JS/jagd-ui.js liest den
   Zustand und zeichnet ihn, JS/jagd-ai.js trifft Entscheidungen über
   dieselben Funktionen wie ein Mensch (keine Sonderwege für den
   Computer). Siehe BERICHT.md für die Regel-Entscheidungen.

   Positions-Modell pro Figur (token.zone):
     "lager"    - noch nicht im Spiel
     "ring"     - auf den 48 gemeinsamen Ringfeldern, token.p = 0..47
                  (spielereigen relativ zum eigenen Startfeld;
                  globales Feld = (startIndex + p) % 48)
     "shortcut" - auf einer der 2 Abkürzungszellen, token.scFork +
                  token.scIdx (0 oder 1) identifizieren die Zelle
     "home"     - farbiger Zielweg, token.p = 48..51
                  (idx 0-3 = vier sichtbare Zielplätze)
   ===================================================== */

(function () {
    "use strict";

    var D = window.JagdData;

    function regionOf(playerId, state) {
        return state.players[playerId].region;
    }

    function startIndexOf(playerId, state) {
        return D.REGIONS.filter(function (r) { return r.id === regionOf(playerId, state); })[0].startIndex;
    }

    function globalCellOfToken(state, token) {
        if (token.zone !== "ring") { return null; }
        var start = startIndexOf(token.playerId, state);
        return (start + token.p) % 48;
    }

    function ringCell(id) { return D.RING[id]; }

    /* =====================================================
       SPIEL ERZEUGEN
       ===================================================== */

    // playerConfigs: [{ type: "human"|"ai", name }] - 2 bis 4 Einträge.
    function createGame(playerConfigs) {
        var order = (D.REGION_ORDER_BY_COUNT[playerConfigs.length] || D.REGION_ORDER_BY_COUNT[4]).slice();
        var colorByRegion = {};
        var regionByColor = {};
        Object.keys(D.PLAYER_COLORS).forEach(function (c) {
            colorByRegion[D.PLAYER_COLORS[c].region] = c;
            regionByColor[c] = D.PLAYER_COLORS[c].region;
        });

        // Spieler 1 darf seine Farbe wählen. Bei zwei Spielern sitzt der
        // Gegner wenn möglich gegenüber; weitere Spieler füllen freie Farben.
        var requestedFirst = regionByColor[playerConfigs[0] && playerConfigs[0].color];
        if (requestedFirst) {
            var allRegions = D.REGIONS.map(function (r) { return r.id; });
            var firstIndex = allRegions.indexOf(requestedFirst);
            order = [requestedFirst];
            if (playerConfigs.length === 2) {
                order.push(allRegions[(firstIndex + 2) % allRegions.length]);
            } else {
                allRegions.forEach(function (region) {
                    if (region !== requestedFirst && order.length < playerConfigs.length) { order.push(region); }
                });
            }
        }

        var state = {
            players: [],
            tokens: {},
            turnOrder: [],
            currentIndex: 0,
            diceValue: null,
            rolledThisTurn: false,
            reverseActive: false,
            reverseRoundsRemaining: 0,
            pendingForkChoice: null,   // { tokenId, forkId, forkChoiceSoFar }
            pendingEventCard: null,    // { eventId, tokenId }
            bonusMovePending: false,   // "Freie Jagd"
            winnerId: null,
            log: []
        };

        playerConfigs.forEach(function (cfg, i) {
            var region = order[i];
            var color = colorByRegion[region];
            var player = {
                id: i,
                name: cfg.name || (D.PLAYER_COLORS[color].name),
                type: cfg.type || "human",
                region: region,
                color: color,
                tokenIds: []
            };
            state.players.push(player);
            state.turnOrder.push(i);

            var tokenCount = Math.max(2, Math.min(4, Number(cfg.tokenCount) || 4));
            for (var t = 0; t < tokenCount; t++) {
                var tokenId = i + "_" + t;
                var isFirst = t === 0;
                state.tokens[tokenId] = {
                    id: tokenId,
                    playerId: i,
                    tokenIndex: t,
                    zone: isFirst ? "ring" : "lager",
                    p: isFirst ? 0 : null,
                    scFork: null,
                    scIdx: null,
                    goalPending: false,
                    frozenRounds: 0,
                    shieldTurns: 0,
                    magicBound: false
                };
                player.tokenIds.push(tokenId);
            }
        });

        return state;
    }

    function currentPlayer(state) {
        return state.players[state.turnOrder[state.currentIndex]];
    }

    function allTokensOf(state, playerId) {
        return state.players[playerId].tokenIds.map(function (id) { return state.tokens[id]; });
    }

    function tokensOnGlobalCell(state, globalId) {
        return Object.keys(state.tokens)
            .map(function (id) { return state.tokens[id]; })
            .filter(function (t) { return globalCellOfToken(state, t) === globalId; });
    }

    function isProtectedToken(state, token) {
        return token.zone !== "ring" || token.shieldTurns > 0;
    }

    /* =====================================================
       ZUG-BEGINN: Frost/Schild/Fessel-Countdown der ZIEHENDEN Person
       (jede Dauer ist in "eigenen Zügen dieser Figur" gemeint - wird
       deshalb beim Rundenstart DIESES Spielers herabgezählt, egal wie
       viele Gegner dazwischen an der Reihe waren).
       ===================================================== */

    function startTurn(state) {
        var player = currentPlayer(state);
        allTokensOf(state, player.id).forEach(function (t) {
            if (t.frozenRounds > 0) { t.frozenRounds -= 1; }
            if (t.shieldTurns > 0) { t.shieldTurns -= 1; }
            if (t.magicBound) { t.magicBound = false; } // genau 1 Runde
        });
        state.diceValue = null;
        state.rolledThisTurn = false;
        state.bonusMovePending = false;
    }

    /* =====================================================
       WÜRFELN
       rollDice() bestimmt NUR das Ergebnis. animateDice() (in
       jagd-ui.js) darf es nur darstellen, nie selbst bestimmen.
       ===================================================== */

    function rollDice() {
        return 1 + Math.floor(Math.random() * 6);
    }

    /* =====================================================
       ZIEHBARE FIGUREN für den aktuellen Wurf
       ===================================================== */

    function getMovableTokens(state, playerId, diceValue) {
        var player = state.players[playerId];
        var out = [];

        function blockedByOccupant(token, result) {
            if (!result || !result.path || !result.path.length) { return true; }
            if (result.zone === "home") {
                return allTokensOf(state, playerId).some(function (other) {
                    return other.id !== token.id && other.zone === "home" && other.p === result.p;
                });
            }
            if (result.zone !== "ring") { return false; }
            var finalGlobal = (startIndexOf(playerId, state) + result.p) % 48;
            return tokensOnGlobalCell(state, finalGlobal).some(function (other) {
                if (other.id === token.id) { return false; }
                if (other.playerId === playerId) { return true; }
                return other.shieldTurns > 0;
            });
        }

        allTokensOf(state, playerId).forEach(function (t) {
            if (t.frozenRounds > 0 || t.magicBound) { return; }
            if (t.zone === "lager") {
                var startOccupants = tokensOnGlobalCell(state, startIndexOf(playerId, state));
                var startBlocked = startOccupants.some(function (other) {
                    return other.playerId === playerId || other.shieldTurns > 0;
                });
                if ((diceValue === 1 || diceValue === 6) && !startBlocked) {
                    out.push({ tokenId: t.id, kind: "enter" });
                }
                return;
            }
            if (t.zone === "home") {
                var idx = t.p - 48;
                if (idx >= D.HOME_LENGTH - 1) { return; } // schon ganz hinten
            }
            var result = state.reverseActive && t.zone === "ring"
                ? computeBackward(state, t, diceValue)
                : computeMove(state, t, diceValue, {}, false);
            if (!blockedByOccupant(t, result)) {
                out.push({ tokenId: t.id, kind: "move" });
            }
        });

        return out;
    }

    /* =====================================================
       BEWEGUNG BERECHNEN (reine Funktion, keine Mutation von state
       außer über die explizit übergebene forkChoice-Map)
       ===================================================== */

    function computeMove(state, token, steps, forkChoiceMap, forced) {
        var region = { startIndex: startIndexOf(token.playerId, state) };
        var zone = token.zone, p = token.p, scFork = token.scFork, scIdx = token.scIdx;
        var path = [];
        var remaining = steps;

        // Ein Platztausch kann eine fast fertige Figur sichtbar über ihren
        // eigenen Zieleingang setzen. Der nächste normale Vorwärtsschritt
        // führt dann in den Zielweg, statt eine weitere Runde zu verlangen.
        if (zone === "ring" && token.goalPending && !forced && !state.reverseActive && remaining > 0) {
            zone = "home";
            p = 48;
            path.push({ zone: "home", idx: 0 });
            remaining--;
        }

        // Schon auf einer Gabel stehend und jetzt losziehend?
        if (zone === "ring" && !state.reverseActive && !forced) {
            var curGlobal = (region.startIndex + p) % 48;
            if (D.SHORTCUTS[curGlobal] && remaining > 0) {
                var already = forkChoiceMap && forkChoiceMap[curGlobal];
                if (!already) {
                    return { needsForkChoice: curGlobal, path: [], zone: zone, p: p, scFork: scFork, scIdx: scIdx };
                }
                if (already === "shortcut") {
                    zone = "shortcut"; scFork = curGlobal; scIdx = -1; p = null;
                }
            }
        }

        while (remaining > 0) {

            if (zone === "shortcut") {
                var sc = D.SHORTCUTS[scFork];
                if (scIdx + 1 < sc.cells.length) {
                    scIdx += 1;
                    path.push({ zone: "shortcut", id: sc.cells[scIdx].id });
                } else {
                    zone = "ring";
                    p = (sc.mergeId - region.startIndex + 48) % 48;
                    scFork = null; scIdx = null;
                    path.push({ zone: "ring", p: p, globalId: sc.mergeId });
                }
                remaining--;
                continue;
            }

            if (zone === "ring") {
                var maxRingP = forced ? 47 : 47; // erzwungene Bewegung geht unten separat in Home-Klemme
                var nextP = p + 1;
                if (nextP > maxRingP) {
                    if (forced) {
                        // Erzwungene Bewegung darf NIE in den Schlossweg führen.
                        remaining = 0;
                        break;
                    }
                    zone = "home"; p = 48;
                    path.push({ zone: "home", idx: 0 });
                    remaining--;
                    continue;
                }
                var globalId = (region.startIndex + nextP) % 48;
                var fork = D.SHORTCUTS[globalId];
                if (fork && !forced && !state.reverseActive && remaining - 1 > 0) {
                    var choice = forkChoiceMap && forkChoiceMap[globalId];
                    if (!choice) {
                        p = nextP;
                        path.push({ zone: "ring", p: p, globalId: globalId });
                        return { needsForkChoice: globalId, path: path, zone: zone, p: p, scFork: scFork, scIdx: scIdx, remainingAfterFork: remaining - 1 };
                    }
                    if (choice === "shortcut") {
                        zone = "shortcut"; scFork = globalId; scIdx = -1; p = null;
                        path.push({ zone: "ring", p: nextP, globalId: globalId });
                        remaining--;
                        continue;
                    }
                }
                p = nextP;
                path.push({ zone: "ring", p: p, globalId: globalId });
                remaining--;
                continue;
            }

            if (zone === "home") {
                var idx = p - 48;
                if (idx >= D.HOME_LENGTH - 1) { remaining = 0; break; } // Überschuss verfällt
                p += 1;
                path.push({ zone: "home", idx: p - 48 });
                remaining--;
                continue;
            }

            break; // "lager" darf hier nie ankommen
        }

        return { zone: zone, p: p, scFork: scFork, scIdx: scIdx, path: path, needsForkChoice: null };
    }

    // Rückwärts (Kehrtwende/Gegenwind): einfacher, eigener Pfad - nur auf
    // dem Ring, kein Zugang zu Abkürzungen, kein Wechsel in den Schlossweg,
    // stoppt am eigenen Startfeld (p=0), geht nicht ins Lager zurück.
    function computeBackward(state, token, steps) {
        var path = [];
        var p = token.p;
        for (var i = 0; i < steps; i++) {
            if (p <= 0) { break; }
            p -= 1;
            path.push({
                zone: "ring",
                p: p,
                globalId: (startIndexOf(token.playerId, state) + p) % 48
            });
        }
        return { zone: "ring", p: p, path: path };
    }

    /* =====================================================
       LANDUNG AUSWERTEN: Schutzschild-Blockade, Rauswurf, Aktionsfeld
       ===================================================== */

    function applyLanding(state, token, result, opts) {
        opts = opts || {};
        var log = [];

        if (result.zone === "home") {
            var occupiedHome = allTokensOf(state, token.playerId).some(function (other) {
                return other.id !== token.id && other.zone === "home" && other.p === result.p;
            });
            if (occupiedHome) {
                log.push("Der Zielplatz ist schon besetzt.");
                return { captured: [], event: null, blocked: true, log: log };
            }
        }

        if (result.zone !== "ring") {
            token.zone = result.zone; token.p = result.p;
            token.scFork = result.scFork; token.scIdx = result.scIdx;
            if (result.zone === "home") { token.goalPending = false; }
            return { captured: [], event: null, blocked: false, log: log };
        }

        var finalGlobal = (startIndexOf(token.playerId, state) + result.p) % 48;
        var occupants = tokensOnGlobalCell(state, finalGlobal).filter(function (t) { return t.id !== token.id; });
        var ownOccupant = occupants.filter(function (o) { return o.playerId === token.playerId; })[0];
        var shield = occupants.filter(function (o) { return o.shieldTurns > 0 && o.playerId !== token.playerId; })[0];

        if (ownOccupant || shield) {
            log.push(ownOccupant
                ? "Auf diesem Feld steht bereits deine eigene Figur."
                : "Das Schutzschild blockiert dieses Feld.");
            return { captured: [], event: null, blocked: true, log: log };
        }

        token.zone = "ring"; token.p = result.p;

        var captured = [];
        occupants.forEach(function (o) {
            if (o.playerId !== token.playerId) {
                o.zone = "lager"; o.p = null; o.scFork = null; o.scIdx = null;
                o.goalPending = false;
                captured.push(o.id);
                log.push(state.players[o.playerId].name + "s Figur " + (o.tokenIndex + 1) + " wird zurückgeschickt.");
            }
        });

        var cell = ringCell(finalGlobal);
        var event = null;
        if (!opts.forced && cell.type === "action") {
            event = D.randomEventId();
        }

        return { captured: captured, event: event, blocked: false, log: log };
    }

    /* =====================================================
       ZUG AUSFÜHREN (Würfelbewegung oder Figur einsetzen)
       ===================================================== */

    function enterToken(state, tokenId) {
        var token = state.tokens[tokenId];
        token.goalPending = false;
        var startId = startIndexOf(token.playerId, state);
        var outcome = applyLanding(state, token, { zone: "ring", p: 0, path: [{ zone: "ring", p: 0, globalId: startId }] });
        outcome.path = [{ zone: "ring", p: 0, globalId: startId }];
        return outcome;
    }

    // Gibt entweder { needsForkChoice, forkId } zurück (UI muss chooseFork
    // aufrufen) oder ein Ergebnisobjekt wie applyLanding.
    function moveToken(state, tokenId, steps, forkChoiceMap) {
        var token = state.tokens[tokenId];
        var result = state.reverseActive && token.zone === "ring"
            ? computeBackward(state, token, steps)
            : computeMove(state, token, steps, forkChoiceMap || {}, false);
        if (result.needsForkChoice) {
            return { needsForkChoice: result.needsForkChoice, partial: result };
        }
        var outcome = applyLanding(state, token, result);
        outcome.path = result.path;
        return outcome;
    }

    // Erzwungene Bewegung durch ein Ereignis (Rückenwind/Wirbelwind/...):
    // löst keine weiteren Aktionsfelder aus, kein Zugang zum Schlossweg,
    // keine Abkürzungswahl, kann aber unbeschützte Gegner rauswerfen.
    function forceMove(state, tokenId, steps) {
        var token = state.tokens[tokenId];
        if (token.zone !== "ring") { return { captured: [], event: null, blocked: false, log: [] }; }
        var result = computeMove(state, token, steps, {}, true);
        return applyLanding(state, token, result, { forced: true });
    }

    function forceBackward(state, tokenId, steps) {
        var token = state.tokens[tokenId];
        if (token.zone !== "ring") { return { captured: [], event: null, blocked: false, log: [] }; }
        var result = computeBackward(state, token, steps);
        return applyLanding(state, token, result, { forced: true });
    }

    /* =====================================================
       EREIGNISSE
       ===================================================== */

    function activeRingTokens(state, playerId) {
        return allTokensOf(state, playerId).filter(function (t) { return t.zone === "ring"; });
    }

    function allActiveRingTokens(state) {
        var out = [];
        state.players.forEach(function (p) { out = out.concat(activeRingTokens(state, p.id)); });
        return out;
    }

    function applyEvent(state, eventId, triggeringTokenId) {
        var token = state.tokens[triggeringTokenId];
        var playerId = token.playerId;
        var log = [];

        switch (eventId) {

            case "kehrtwende":
                state.reverseActive = true;
                state.reverseRoundsRemaining = state.players.length;
                log.push("Kehrtwende! Für eine Runde geht es rückwärts.");
                break;

            case "rueckenwind":
                allActiveRingTokens(state).forEach(function (t) { forceMove(state, t.id, 2); });
                log.push("Rückenwind schiebt alle zwei Felder vor.");
                break;

            case "gegenwind":
                allActiveRingTokens(state).forEach(function (t) { forceBackward(state, t.id, 2); });
                log.push("Gegenwind drückt alle zwei Felder zurück.");
                break;

            case "eiszauber": {
                var mine = activeRingTokens(state, playerId);
                var freezeCount = mine.length <= 1 ? Math.min(1, mine.length)
                    : mine.length === 2 ? 1
                        : (Math.random() < 0.5 ? 1 : 2);
                var pool = mine.slice();
                for (var i = 0; i < freezeCount && pool.length; i++) {
                    var pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
                    pick.frozenRounds = mine.length <= 1 ? 1 : (1 + Math.floor(Math.random() * 2));
                }
                log.push("Eiszauber friert " + freezeCount + " Figur(en) ein.");
                break;
            }

            case "schutzschild":
                // Auswahl übernimmt die UI (Mensch) bzw. die KI und ruft
                // applyShield(state, chosenTokenId) auf; hier nur geloggt.
                log.push("Schutzschild bereit - wähle eine Figur.");
                break;

            case "platztausch": {
                var candidates = allActiveRingTokens(state);
                if (candidates.length >= 2) {
                    var a = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
                    var b = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
                    var aGlobal = globalCellOfToken(state, a), bGlobal = globalCellOfToken(state, b);
                    var aStart = startIndexOf(a.playerId, state), bStart = startIndexOf(b.playerId, state);
                    var aOldP = a.p, bOldP = b.p;
                    var aNewP = (bGlobal - aStart + 48) % 48;
                    var bNewP = (aGlobal - bStart + 48) % 48;
                    // Nur ein echter Sprung über den eigenen Zieleingang
                    // zählt: aus dem letzten in das erste Streckenviertel.
                    a.goalPending = aOldP >= 36 && aNewP <= 11;
                    b.goalPending = bOldP >= 36 && bNewP <= 11;
                    a.p = aNewP;
                    b.p = bNewP;
                    log.push("Platztausch: zwei Figuren wechseln die Position.");
                }
                break;
            }

            case "verfolgungsjagd": {
                var mineActive = activeRingTokens(state, playerId);
                if (mineActive.length) {
                    var hindmost = mineActive.reduce(function (a, b) { return a.p <= b.p ? a : b; });
                    var myStart = startIndexOf(playerId, state);
                    var hindGlobal = (myStart + hindmost.p) % 48;
                    var others = allActiveRingTokens(state).filter(function (t) { return t.playerId !== playerId; });
                    var best = null, bestDist = 999;
                    others.forEach(function (o) {
                        var oGlobal = globalCellOfToken(state, o);
                        var dist = (oGlobal - hindGlobal + 48) % 48;
                        if (dist > 0 && dist < bestDist) { bestDist = dist; best = oGlobal; }
                    });
                    if (best !== null) {
                        hindmost.p = (((best - 1 + 48) % 48) - myStart + 48) % 48;
                        log.push("Verfolgungsjagd: deine hinterste Figur springt vor.");
                    }
                }
                break;
            }

            case "freiejagd":
                state.bonusMovePending = true;
                log.push("Freie Jagd! Noch eine Figur darf ziehen.");
                break;

            case "magischefessel": {
                var all = [];
                state.players.forEach(function (p) { all = all.concat(allTokensOf(state, p.id)); });
                var progressed = all.filter(function (t) { return t.zone === "ring" || t.zone === "home"; });
                if (progressed.length) {
                    var leader = progressed.reduce(function (a, b) {
                        var av = a.zone === "home" ? 48 + (a.p - 48) : a.p;
                        var bv = b.zone === "home" ? 48 + (b.p - 48) : b.p;
                        return av >= bv ? a : b;
                    });
                    leader.magicBound = true;
                    log.push("Magische Fessel bindet die führende Figur.");
                }
                break;
            }

            case "tamosabkuerzung": {
                if (token.zone === "ring") {
                    forceMove(state, token.id, 6);
                    log.push("Tamos geheimer Weg bringt die Figur 6 Felder vor.");
                }
                break;
            }

            case "wirbelwind":
                allActiveRingTokens(state).forEach(function (t) { forceMove(state, t.id, 3); });
                log.push("Wirbelwind wirbelt alle drei Felder weiter.");
                break;
        }

        return log;
    }

    function applyShield(state, tokenId) {
        var token = state.tokens[tokenId];
        token.shieldTurns = 2;
    }

    /* =====================================================
       RUNDE BEENDEN / GEWINNPRÜFUNG
       ===================================================== */

    function checkWin(state, playerId) {
        return allTokensOf(state, playerId).every(function (t) {
            return t.zone === "home";
        });
    }

    function endTurn(state) {
        if (state.reverseActive) {
            state.reverseRoundsRemaining -= 1;
            if (state.reverseRoundsRemaining <= 0) { state.reverseActive = false; }
        }
        state.currentIndex = (state.currentIndex + 1) % state.turnOrder.length;
        startTurn(state);
    }

    window.JagdEngine = {
        createGame: createGame,
        currentPlayer: currentPlayer,
        allTokensOf: allTokensOf,
        globalCellOfToken: globalCellOfToken,
        isProtectedToken: isProtectedToken,
        startTurn: startTurn,
        rollDice: rollDice,
        getMovableTokens: getMovableTokens,
        computeMove: computeMove,
        enterToken: enterToken,
        moveToken: moveToken,
        forceMove: forceMove,
        applyEvent: applyEvent,
        applyShield: applyShield,
        checkWin: checkWin,
        endTurn: endTurn,
        ringCell: ringCell
    };

})();
