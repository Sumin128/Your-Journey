/* =====================================================
   JAGD-MULTIPLAYER-ADAPTER
   Verbindet JS/multiplayer-room.js (Raum/Lobby/Transport) mit
   JS/jagd-engine.js (Spielregeln) und JS/jagd-ui.js (Darstellung).
   Mirelons Jagd hat KEINE geheime Information - anders als beim
   Miro-Adapter ist public_info hier einfach der volle Zustand, keine
   Redigierung nötig.

   Sicherheitsmodell (siehe Migration/Bericht): NUR der Gastgeber
   führt jagd-engine.js aus und schreibt den Zustand fort. Alle
   anderen schicken nur Aktionswünsche.

   Gabel- und Schutzschild-Entscheidungen: steht ein entfernter MENSCH
   vor einer solchen Wahl, entscheidet der Gastgeber NICHT automatisch
   (siehe Bericht Punkt 4) - er hält den Zug an, fragt genau dieses
   Gerät (fork_choice_request/shield_choice_request) und wartet auf
   dessen Antwort (fork_choice/shield_choice). Nur für KI-Sitzplätze
   entscheidet weiterhin JagdAI automatisch, genau wie lokal.
   ===================================================== */

(function () {
    "use strict";

    var E = window.JagdEngine;
    var AI = window.JagdAI;
    var session = null;
    var processedEventIds = [];
    var pendingRemoteForks = {};   // seat -> { tokenId, forkId, forkChoiceMap }
    var pendingRemoteShields = {}; // seat -> { tokenId }
    var syncChain = Promise.resolve(); // reiht hostSync()-Aufrufe strikt hintereinander (siehe hostSync())

    function isHost() { return session && session.isHost(); }

    function seatOf(userId) {
        var row = session.getState().players.filter(function (p) { return p.user_id === userId; })[0];
        return row ? row.seat : null;
    }

    // Voller kanonischer Zustand geht bei Mirelons Jagd sowohl in
    // public_info (keine geheime Information) ALS AUCH in die state-
    // Spalte - nur so kann load_room_state() dem Gastgeber nach einem
    // eigenen Reload/Reconnect etwas zum Wiederaufsetzen zurückgeben
    // (siehe hostResumeGame()). Aufrufe werden strikt hintereinander
    // ausgeführt, damit ein schneller zweiter Sync nicht mit einer
    // veralteten state_version auf den ersten, noch laufenden trifft.
    function hostSync() {
        syncChain = syncChain.then(function () {
            var state = window.JagdUI.getState();
            if (!state) { return; }
            var full = JSON.parse(JSON.stringify(state));
            return session.submitState(full, full).then(function (version) {
                session.sendGameEvent({ type: "state_update", version: version });
            });
        }).catch(function (err) {
            console.warn("[Jagd online] Zustand konnte nicht gespeichert werden:", err.message);
        });
    }

    function headlessAdvance(state, rerollAllowed) {
        if (rerollAllowed) { state.rolledThisTurn = false; state.diceValue = null; }
        else if (state.bonusMovePending) { state.bonusMovePending = false; state.rolledThisTurn = false; state.diceValue = null; }
        else { E.endTurn(state); }
    }

    // Gastgeber: Aktionswunsch eines entfernten Sitzplatzes prüfen und
    // ausführen. Serverseitige Ereignis-ID-Prüfung ZUERST (siehe
    // record_room_event() in der Migration) - das lokale
    // processedEventIds-Array ist nur eine schnelle Vorabkontrolle
    // innerhalb derselben Sitzung und schützt NICHT über einen
    // Gastgeber-Reload/-Reconnect hinweg.
    function handleActionRequest(payload) {
        if (!isHost()) { return; }
        if (processedEventIds.indexOf(payload.eventId) !== -1) { return; }
        processedEventIds.push(payload.eventId);
        if (processedEventIds.length > 50) { processedEventIds.shift(); }

        var actualSeat = seatOf(payload.userId);
        if (actualSeat === null || actualSeat !== payload.seat) { return; } // Sitzplatz vorgetäuscht

        session.recordEvent(payload.eventId).then(function (isNew) {
            if (isNew) { applyActionRequest(actualSeat, payload); }
            // sonst: schon einmal verarbeitet (Netzwerk-Wiederholung,
            // verspätete Zustellung nach Reconnect) - verwerfen.
        }).catch(function () { /* im Zweifel verwerfen statt doppelt anwenden */ });
    }

    function applyActionRequest(actualSeat, payload) {
        var state = window.JagdUI.getState();
        var player = E.currentPlayer(state);
        if (!state || player.id !== actualSeat) { return; } // nicht an der Reihe

        try {
            if (payload.action.step === "roll") {
                if (state.rolledThisTurn) { return; }
                var result = E.rollDice();
                state.diceValue = result;
                state.rolledThisTurn = true;
                var movable = E.getMovableTokens(state, actualSeat, result);
                if (!movable.length) { headlessAdvance(state, result === 6); }
                window.JagdUI.refresh();
                hostSync();
                return;
            }

            if (payload.action.step === "move" || payload.action.step === "enter") {
                var tokenId = payload.action.tokenId;
                var token = state.tokens[tokenId];
                if (!token || token.playerId !== actualSeat) { return; }
                if (payload.action.step === "enter") {
                    finishRemoteMove(actualSeat, tokenId, E.enterToken(state, tokenId));
                } else {
                    continueRemoteMove(actualSeat, tokenId, {});
                }
                return;
            }

            if (payload.action.step === "fork_choice") {
                var pendingFork = pendingRemoteForks[actualSeat];
                if (!pendingFork || pendingFork.tokenId !== payload.action.tokenId) { return; } // keine passende offene Frage - veraltet/gefälscht
                delete pendingRemoteForks[actualSeat];
                pendingFork.forkChoiceMap[pendingFork.forkId] = payload.action.choice;
                continueRemoteMove(actualSeat, pendingFork.tokenId, pendingFork.forkChoiceMap);
                return;
            }

            if (payload.action.step === "shield_choice") {
                var pendingShield = pendingRemoteShields[actualSeat];
                if (!pendingShield || pendingShield.tokenId !== payload.action.tokenId) { return; }
                delete pendingRemoteShields[actualSeat];
                var target = payload.action.targetTokenId;
                if (target && state.tokens[target] && state.tokens[target].playerId === actualSeat) {
                    E.applyShield(state, target);
                }
                concludeRemoteAction(actualSeat);
            }
        } catch (err) {
            // ungültiger/veralteter Zugversuch - der anfragende Client
            // bekommt beim nächsten state_update ohnehin den echten Stand.
        }
    }

    // Führt eine Figurenbewegung fort, bis entweder das Ergebnis feststeht
    // oder eine Gabel-Entscheidung fällig wird. Für KI-Sitzplätze
    // entscheidet JagdAI sofort weiter (wie lokal); für einen entfernten
    // MENSCHEN hält der Zug hier an und fragt dessen Gerät (siehe Bericht
    // Punkt 4 - der Gastgeber entscheidet das NICHT selbst).
    function continueRemoteMove(actualSeat, tokenId, forkChoiceMap) {
        var state = window.JagdUI.getState();
        var res = E.moveToken(state, tokenId, state.diceValue, forkChoiceMap);
        if (res.needsForkChoice) {
            var player = state.players[actualSeat];
            if (player.type === "ai") {
                forkChoiceMap[res.needsForkChoice] = AI.chooseForkChoice();
                continueRemoteMove(actualSeat, tokenId, forkChoiceMap);
                return;
            }
            pendingRemoteForks[actualSeat] = { tokenId: tokenId, forkId: res.needsForkChoice, forkChoiceMap: forkChoiceMap };
            window.JagdOnline.hostAskForkChoice(actualSeat, tokenId, res.needsForkChoice);
            return;
        }
        finishRemoteMove(actualSeat, tokenId, res);
    }

    // Wendet das Ergebnis einer abgeschlossenen Bewegung/eines Zugangs an
    // (Ereigniskarte inkl. ggf. Schutzschild-Ziel), dann Zugende/Sieg.
    function finishRemoteMove(actualSeat, tokenId, outcome) {
        var state = window.JagdUI.getState();
        if (outcome.event) {
            E.applyEvent(state, outcome.event, tokenId);
            if (outcome.event === "schutzschild") {
                var player = state.players[actualSeat];
                var mine = E.allTokensOf(state, actualSeat).filter(function (t) { return t.zone === "ring"; });
                if (player.type === "ai") {
                    var aiTarget = mine.length ? AI.chooseShieldTarget(state, actualSeat) : null;
                    if (aiTarget) { E.applyShield(state, aiTarget); }
                } else if (mine.length) {
                    pendingRemoteShields[actualSeat] = { tokenId: tokenId };
                    window.JagdOnline.hostAskShieldChoice(actualSeat, tokenId, player.color, mine);
                    return; // hält hier an, bis die Zielwahl des Menschen eintrifft
                }
                // sonst: keine eigene Figur zum Schützen - nichts zu tun.
            }
        }
        concludeRemoteAction(actualSeat);
    }

    function concludeRemoteAction(actualSeat) {
        var state = window.JagdUI.getState();
        if (E.checkWin(state, actualSeat)) { state.winnerId = actualSeat; }
        else { headlessAdvance(state, state.diceValue === 6); }
        window.JagdUI.refresh();
        hostSync();
    }

    function applyConfirmedState() {
        session.refresh().then(function (snap) {
            window.JagdUI.setState(snap.publicInfo);
            window.JagdUI.refresh();
            window.JagdUI.highlightIfMyTurn(snap.mySeat);
        });
    }

    function hostStartGame() {
        var roomState = session.getState();
        var configs = roomState.players.slice().sort(function (a, b) { return a.seat - b.seat; }).map(function (p) {
            return { type: p.is_ai ? "ai" : "human", name: p.player_name, color: p.color, tokenCount: 4 };
        });
        var state = E.createGame(configs);
        E.startTurn(state);
        window.JagdUI.startWithState(state);
        hostSync();
    }

    // Der GASTGEBER selbst verbindet sich neu (Reload, Browser-Crash,
    // kurzer Netzwerkabbruch). isHost() bleibt dabei true (host_id
    // ändert sich nicht) - ohne diese Unterscheidung würde attach()
    // hostStartGame() erneut aufrufen und die laufende Partie für ALLE
    // Mitspieler auf null zurücksetzen. Der volle kanonische Zustand
    // kommt aus host_state (siehe load_room_state() in der Migration) -
    // bei Mirelons Jagd inhaltlich identisch zu public_info, aber nur
    // host_state ist ausdrücklich für den echten Gastgeber bestimmt.
    function hostResumeGame() {
        var roomState = session.getState();
        if (!roomState.hostState) { hostStartGame(); return; } // kein gespeicherter Stand - sicherheitshalber neu erzeugen
        window.JagdUI.startWithState(roomState.hostState);
    }

    function guestJoinRunningGame() {
        var roomState = session.getState();
        window.JagdUI.startWithState(roomState.publicInfo);
        window.JagdUI.highlightIfMyTurn(roomState.mySeat);
    }

    function attach(existingSession) {
        session = existingSession;

        window.JagdOnline = {
            active: true,
            session: session,
            isHost: isHost,
            mySeat: session.getState().mySeat,
            requestAction: function (action) {
                session.sendGameEvent({
                    type: "action_request",
                    seat: window.JagdOnline.mySeat,
                    userId: window.MultiplayerTransport.myUserId(),
                    eventId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random(),
                    action: action
                });
            },
            hostSync: hostSync,
            // Gastgeber-only: fragt GENAU den betroffenen entfernten
            // Sitzplatz nach seiner Gabel- bzw. Schutzschild-Wahl (siehe
            // Bericht Punkt 4). Alle Geräte empfangen den Broadcast, aber
            // nur das mit passendem seat reagiert (siehe session.on unten).
            hostAskForkChoice: function (seat, tokenId, forkId) {
                session.sendGameEvent({ type: "fork_choice_request", seat: seat, tokenId: tokenId, forkId: forkId });
            },
            hostAskShieldChoice: function (seat, tokenId, color, mineTokens) {
                session.sendGameEvent({
                    type: "shield_choice_request",
                    seat: seat,
                    tokenId: tokenId,
                    color: color,
                    options: mineTokens.map(function (t) { return { id: t.id, tokenIndex: t.tokenIndex }; })
                });
            }
        };

        session.on("game_event", function (payload) {
            if (!payload) { return; }
            if (payload.type === "action_request") { handleActionRequest(payload); return; }
            if (payload.type === "state_update") { applyConfirmedState(); return; }
            if (payload.type === "fork_choice_request" && payload.seat === window.JagdOnline.mySeat) {
                window.JagdUI.showRemoteForkPrompt(payload);
                return;
            }
            if (payload.type === "shield_choice_request" && payload.seat === window.JagdOnline.mySeat) {
                window.JagdUI.showRemoteShieldPrompt(payload);
                return;
            }
        });

        session.on("snapshot", function (st) {
            window.JagdOnline.mySeat = st.mySeat;
            window.MultiplayerLobbyUI.setBanner(
                st.status === "paused" ? "⏸️ Verbindung zu einem Mitspieler unterbrochen – wir warten auf die Rückkehr." : ""
            );
        });
        session.on("host_disconnected", function (absent) {
            window.MultiplayerLobbyUI.setBanner(absent ? "⏳ Der Gastgeber hat die Verbindung verloren – wir warten auf die Rückkehr." : "");
        });

        var roomState = session.getState();
        if (isHost() && roomState.status === "waiting") { hostStartGame(); }
        else if (isHost()) { hostResumeGame(); }
        else { guestJoinRunningGame(); }
    }

    window.JagdMultiplayerAdapter = { attach: attach };

})();
