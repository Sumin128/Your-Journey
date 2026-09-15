/* =====================================================
   MIRO-MULTIPLAYER-ADAPTER
   Verbindet JS/multiplayer-room.js (Raum/Lobby/Transport) mit
   JS/miro-engine.js (Spielregeln) und JS/miro-ui.js (Darstellung).
   Miros Handkarten sind geheim - deshalb ist dieser Adapter der
   einzige Ort, an dem festgelegt wird, WAS über den gemeinsamen
   Realtime-Kanal gehen darf (nie fremde Handkarten) und was jeder
   Client nur für sich selbst über load_room_state() abruft.

   Sicherheitsmodell (siehe Migration/Bericht): NUR der Gastgeber
   führt miro-engine.js aus und schreibt den Zustand fort. Alle
   anderen schicken nur Aktionswünsche.
   ===================================================== */

(function () {
    "use strict";

    var E = window.MiroEngine;
    var session = null;
    var processedEventIds = [];

    function isHost() { return session && session.isHost(); }

    /* =====================================================
       ZUSTAND FÜR DEN GEMEINSAMEN KANAL REDIGIEREN
       Ersetzt jede Hand durch ihre Kartenzahl (Platzhalter-Objekte,
       genug für renderOpponents(), das nur .hand.length braucht).
       Wird NUR in public_info gespeichert bzw. für die Rekonstruktion
       bei Gästen benutzt - state (mit echten Händen) bleibt in der
       Datenbank und geht nie unredigiert über den Kanal.
       ===================================================== */
    function redactForEveryone(fullState) {
        var copy = E.snapshot(fullState); // JSON-Klon ohne _random
        copy.players = copy.players.map(function (p) {
            var redacted = {};
            Object.keys(p).forEach(function (k) { redacted[k] = p[k]; });
            redacted.handCount = (p.hand || []).length;
            redacted.hand = new Array(redacted.handCount).fill(0).map(function (_, i) { return { id: "hidden-" + i, hidden: true }; });
            return redacted;
        });
        // Der Ziehstapel ist auch lokal nie einsehbar (nur die Anzahl) -
        // die volle, geordnete Kartenliste darf erst recht nie an alle
        // Mitspieler gehen (sonst wüsste jeder die komplette Zugreihenfolge).
        copy.drawPileCount = (copy.drawPile || []).length;
        copy.drawPile = [];
        // Schatzfund zeigt die zwei gezogenen Karten nur der wählenden
        // Person - für alle anderen bleibt nur sichtbar, DASS gerade
        // gewählt wird, nicht welche Karten zur Wahl stehen.
        if (copy.pending && copy.pending.type === "treasure") {
            copy.pending = { type: "treasure", actorId: copy.pending.actorId, cardCount: (copy.pending.cards || []).length };
        }
        return copy;
    }

    // Baut aus public_info (fremde Hände nur als Platzhalter) + der
    // eigenen, per RPC redigiert geladenen Hand einen für miro-ui.js
    // normal renderbaren Zustand zusammen.
    function reconstruct(publicInfo, mySeat, myHand, myPendingCards) {
        var state = JSON.parse(JSON.stringify(publicInfo));
        if (typeof mySeat === "number" && state.players[mySeat] && Array.isArray(myHand)) {
            state.players[mySeat].hand = myHand;
        }
        if (state.pending && state.pending.type === "treasure" && Array.isArray(myPendingCards)) {
            state.pending.cards = myPendingCards;
        }
        return state;
    }

    function seatOf(userId) {
        var row = session.getState().players.filter(function (p) { return p.user_id === userId; })[0];
        return row ? row.seat : null;
    }

    /* =====================================================
       GASTGEBER: eigene/AI-Züge nach jeder Aktion verteilen
       ===================================================== */
    function hostSync() {
        var full = window.MiroUI.getState();
        if (!full) { return; }
        var publicInfo = redactForEveryone(full);
        session.submitState(publicInfo, E.snapshot(full)).then(function (version) {
            session.sendGameEvent({ type: "state_update", version: version });
        }).catch(function (err) {
            // version_conflict o.ä. - im Zweifel eigenen Stand neu bekannt geben,
            // statt eine Diskrepanz stehen zu lassen.
            console.warn("[Miro online] Zustand konnte nicht gespeichert werden:", err.message);
        });
    }

    // Gastgeber: Aktionswunsch eines Gastes prüfen und ausführen -
    // genau dieselbe Engine wie bei einem lokalen Zug, nur dass Sitz-
    // platz und Zug von außen kommen statt von einem eigenen Klick.
    function handleActionRequest(payload) {
        if (!isHost()) { return; }
        if (processedEventIds.indexOf(payload.eventId) !== -1) { return; }
        processedEventIds.push(payload.eventId);
        if (processedEventIds.length > 50) { processedEventIds.shift(); }

        var actualSeat = seatOf(payload.userId);
        if (actualSeat === null || actualSeat !== payload.seat) { return; } // Sitzplatz vorgetäuscht - ignorieren

        // Startwürfeln läuft VOR dem eigentlichen Zug (currentPlayerId ist
        // dann noch null) - eigener Zweig statt der Zug-Prüfung unten.
        if (payload.action.type === "startdice_roll") {
            window.MiroUI.hostRollStartDiceForSeat(actualSeat);
            return;
        }

        var state = window.MiroUI.getState();
        if (!state || state.currentPlayerId !== actualSeat) { return; } // nicht an der Reihe

        try {
            var a = payload.action;
            if (a.type === "draw") { E.drawForTurn(state, actualSeat); }
            else if (a.type === "play") { E.playCard(state, actualSeat, a.cardId); }
            else if (a.type === "pass") { E.finishChain(state, actualSeat); }
            else if (a.type === "color") { E.chooseColor(state, actualSeat, a.color); }
            else if (a.type === "trade") { E.resolveTrade(state, actualSeat, a.targetId, a.giveCardId, a.color); }
            else if (a.type === "treasure") { E.resolveTreasure(state, actualSeat, a.keepCardId); }
            else { return; }
            window.MiroUI.render(a.type);
            hostSync();
        } catch (err) {
            // ungültiger Zug (z. B. Doppelklick/veralteter Stand) - der
            // anfragende Client bekommt beim nächsten state_update ohnehin
            // wieder den echten, bestätigten Zustand.
        }
    }

    // Alle Clients (Gast wie Gastgeber): bestätigten Zustand übernehmen.
    // Der Gastgeber hat ihn schon lokal - trotzdem harmlos, weil
    // idempotent (derselbe Zustand wird nur neu gezeichnet).
    function applyConfirmedState() {
        session.refresh().then(function (snap) {
            var state = reconstruct(snap.publicInfo, snap.mySeat, snap.myHand, snap.myPendingCards);
            window.MiroUI.setState(state);
            window.MiroUI.render();
        });
    }

    /* =====================================================
       PARTIESTART: Karten mischen (Gastgeber), danach läuft das
       Startwürfeln für ALLE Geräte genauso interaktiv ab wie lokal
       (siehe JS/miro-ui.js runStartDiceTurn()/hostRollStartDiceForSeat()/
       applyStartDiceResult()) - nur dass ein neuer Würfelwert
       ausschließlich vom Gastgeber erzeugt und per Broadcast verteilt
       wird. Der Anfangszustand (Phase "coin", gemischte Hände) wird
       zusätzlich sofort synchronisiert, damit Gäste den Tisch schon
       während des Würfelns sehen.
       ===================================================== */
    function hostStartGame() {
        var roomState = session.getState();
        var configs = roomState.players.slice().sort(function (a, b) { return a.seat - b.seat; }).map(function (p) {
            return { type: p.is_ai ? "ai" : "human", name: p.player_name };
        });
        var state = E.createGame(configs, { seed: Date.now() });
        window.MiroUI.startCoinPhaseState(state);
        hostSync();
    }

    function guestJoinRunningGame() {
        var roomState = session.getState();
        var reconstructed = reconstruct(roomState.publicInfo, roomState.mySeat, roomState.myHand, roomState.myPendingCards);
        if (reconstructed.phase === "coin") { window.MiroUI.startCoinPhaseState(reconstructed); }
        else { window.MiroUI.startWithState(reconstructed); }
    }

    /* =====================================================
       ÖFFENTLICHE SCHNITTSTELLE für JS/miro-ui.js (window.MiroOnline)
       ===================================================== */
    function attach(existingSession) {
        session = existingSession;

        window.MiroOnline = {
            active: true,
            session: session,
            isHost: isHost,
            mySeat: session.getState().mySeat,
            requestAction: function (action) {
                session.sendGameEvent({
                    type: "action_request",
                    seat: window.MiroOnline.mySeat,
                    userId: window.MultiplayerTransport.myUserId(),
                    eventId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random(),
                    action: action
                });
            },
            hostSync: hostSync,
            // Gastgeber-only: verteilt einen soeben erzeugten, autoritativen
            // Würfelwert an alle anderen Geräte (siehe hostRollStartDiceForSeat
            // in JS/miro-ui.js). Rein ephemer/nicht persistiert - ein Gast, der
            // genau währenddessen die Verbindung verliert, sieht beim
            // Wiederverbinden einfach das fertige Spiel (wie ein Beitritt nach
            // Partiestart), kein zusätzlicher Aufwand für diesen Randfall.
            hostBroadcastStartDice: function (seat, value) {
                session.sendGameEvent({ type: "startdice_result", seat: seat, value: value });
            }
        };

        session.on("game_event", function (payload) {
            if (!payload) { return; }
            if (payload.type === "action_request") { handleActionRequest(payload); return; }
            if (payload.type === "state_update") { applyConfirmedState(); return; }
            if (payload.type === "startdice_result") { window.MiroUI.applyStartDiceResult(payload.seat, payload.value); return; }
        });

        session.on("snapshot", function (st) {
            window.MiroOnline.mySeat = st.mySeat;
            if (st.status === "paused") {
                window.MultiplayerLobbyUI.setBanner("⏸️ Verbindung zu einem Mitspieler unterbrochen – wir warten auf die Rückkehr.");
            } else {
                window.MultiplayerLobbyUI.setBanner("");
            }
        });
        session.on("host_disconnected", function (absent) {
            window.MultiplayerLobbyUI.setBanner(absent ? "⏳ Der Gastgeber hat die Verbindung verloren – wir warten auf die Rückkehr." : "");
        });

        if (isHost()) { hostStartGame(); } else { guestJoinRunningGame(); }
    }

    window.MiroMultiplayerAdapter = { attach: attach };

})();
