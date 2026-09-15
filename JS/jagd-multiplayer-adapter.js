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

   Bekannte Vereinfachung (siehe Bericht): für die eigene Figurenwahl
   und den eigenen Würfelwurf ist jeder Sitzplatz interaktiv - eine
   Gabelentscheidung oder ein Schutzschild-Ziel, das während des Zugs
   einer ENTFERNTEN Person fällig würde, entscheidet der Gastgeber
   automatisch (Abkürzung/plausibelstes Ziel), statt dafür eine
   weitere Netzwerk-Rückfrage einzubauen. Für den Gastgeber selbst
   bleibt sein eigener Zug voll interaktiv wie lokal.
   ===================================================== */

(function () {
    "use strict";

    var E = window.JagdEngine;
    var AI = window.JagdAI;
    var session = null;
    var processedEventIds = [];

    function isHost() { return session && session.isHost(); }

    function seatOf(userId) {
        var row = session.getState().players.filter(function (p) { return p.user_id === userId; })[0];
        return row ? row.seat : null;
    }

    function hostSync() {
        var state = window.JagdUI.getState();
        if (!state) { return; }
        var publicInfo = JSON.parse(JSON.stringify(state)); // keine geheime Information bei Mirelons Jagd
        session.submitState(publicInfo, null).then(function (version) {
            session.sendGameEvent({ type: "state_update", version: version });
        }).catch(function (err) {
            console.warn("[Jagd online] Zustand konnte nicht gespeichert werden:", err.message);
        });
    }

    function headlessAdvance(state, rerollAllowed) {
        if (rerollAllowed) { state.rolledThisTurn = false; state.diceValue = null; }
        else if (state.bonusMovePending) { state.bonusMovePending = false; state.rolledThisTurn = false; state.diceValue = null; }
        else { E.endTurn(state); }
    }

    // Gastgeber: Aktionswunsch eines entfernten Sitzplatzes anwenden.
    function handleActionRequest(payload) {
        if (!isHost()) { return; }
        if (processedEventIds.indexOf(payload.eventId) !== -1) { return; }
        processedEventIds.push(payload.eventId);
        if (processedEventIds.length > 50) { processedEventIds.shift(); }

        var actualSeat = seatOf(payload.userId);
        if (actualSeat === null || actualSeat !== payload.seat) { return; } // Sitzplatz vorgetäuscht

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
                var outcome;
                if (payload.action.step === "enter") {
                    outcome = E.enterToken(state, tokenId);
                } else {
                    var forkChoiceMap = {};
                    var res;
                    var guard = 0;
                    do {
                        res = E.moveToken(state, tokenId, state.diceValue, forkChoiceMap);
                        if (res.needsForkChoice) { forkChoiceMap[res.needsForkChoice] = AI.chooseForkChoice(); }
                        guard++;
                    } while (res.needsForkChoice && guard < 4);
                    outcome = res;
                }
                if (outcome.event) {
                    E.applyEvent(state, outcome.event, tokenId);
                    if (outcome.event === "schutzschild") {
                        var shieldTarget = AI.chooseShieldTarget(state, actualSeat);
                        if (shieldTarget) { E.applyShield(state, shieldTarget); }
                    }
                }
                if (E.checkWin(state, actualSeat)) {
                    state.winnerId = actualSeat;
                } else {
                    headlessAdvance(state, state.diceValue === 6);
                }
                window.JagdUI.refresh();
                hostSync();
            }
        } catch (err) {
            // ungültiger/veralteter Zugversuch - der anfragende Client
            // bekommt beim nächsten state_update ohnehin den echten Stand.
        }
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
            hostSync: hostSync
        };

        session.on("game_event", function (payload) {
            if (!payload) { return; }
            if (payload.type === "action_request") { handleActionRequest(payload); return; }
            if (payload.type === "state_update") { applyConfirmedState(); return; }
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

        if (isHost()) { hostStartGame(); } else { guestJoinRunningGame(); }
    }

    window.JagdMultiplayerAdapter = { attach: attach };

})();
