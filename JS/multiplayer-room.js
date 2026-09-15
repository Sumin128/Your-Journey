/* =====================================================
   MULTIPLAYER-ROOM
   Spielunabhängige Lobby-/Raum-Zustandsmaschine über
   JS/multiplayer-transport.js. Kennt Sitzplätze, Bereitschaft,
   Gastgeber-Erkennung, Verbindungsstatus und reicht bestätigte
   Spielzustände weiter - kennt aber keine einzige Miro- oder
   Mirelons-Jagd-Regel. Das übernehmen die *-multiplayer-adapter.js.

   Nutzung (siehe Adapter für das volle Beispiel):
     var session = MultiplayerRoom.createSession("miro");
     session.on("snapshot", render);
     session.on("game_event", handleGameEvent);
     session.on("presence", updateConnectionBanners);
     await session.create({ maxPlayers: 4, playerName: "...", color: "gruen" });
   ===================================================== */

(function () {
    "use strict";

    var T = window.MultiplayerTransport;

    function createSession(gameType) {

        var state = {
            roomId: null, roomCode: null, gameType: gameType, status: null,
            maxPlayers: null, hostId: null, players: [], mySeat: null,
            stateVersion: 0, publicInfo: null, myHand: null, myPendingCards: null,
            // Nur gefüllt, wenn WIR der Gastgeber sind (siehe load_room_state()):
            // voller, unredigierter Zustand fürs eigene Wiederaufsetzen nach
            // einem Reload/Reconnect - kein Gast bekommt das je gesetzt.
            hostState: null,
            connectionStatus: "idle" // idle|connecting|connected|reconnecting|error
        };

        var channel = null;
        var listeners = {};
        var presenceByUser = {}; // user_id -> {ready, connected}
        var hostWasAbsent = false;

        function on(evt, fn) {
            (listeners[evt] = listeners[evt] || []).push(fn);
            return function off() {
                listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; });
            };
        }

        function emit(evt, data) {
            (listeners[evt] || []).forEach(function (fn) {
                try { fn(data); } catch (e) { /* ein Listener-Fehler darf die anderen nicht stoppen */ }
            });
        }

        function isHost() {
            return Boolean(state.hostId) && T.myUserId() === state.hostId;
        }

        function mySeatInfo() {
            return state.players.filter(function (p) { return p.seat === state.mySeat; })[0] || null;
        }

        async function refresh() {
            var snap = await T.loadState(state.roomId);
            state.roomCode = snap.room_code;
            state.status = snap.status;
            state.maxPlayers = snap.max_players;
            state.hostId = snap.host_id;
            state.players = snap.players;
            state.mySeat = snap.my_seat;
            state.stateVersion = snap.state_version;
            state.publicInfo = snap.public_info;
            state.myHand = snap.my_hand;
            state.myPendingCards = snap.my_pending_cards;
            state.hostState = snap.host_state;
            emit("snapshot", state);
            checkHostPresence();
            return state;
        }

        function connectChannel() {
            channel = T.connectRoomChannel(state.roomId, {
                onBroadcast: function (payload) {
                    if (!payload) { return; }
                    if (payload.type === "lobby_changed") { refresh(); return; }
                    // Alles andere (Aktionswünsche, bestätigte Zustands-
                    // Updates) kennt nur der jeweilige Spiel-Adapter.
                    emit("game_event", payload);
                },
                onPresenceSync: function (presenceState) {
                    presenceByUser = {};
                    Object.keys(presenceState).forEach(function (userId) {
                        var metas = presenceState[userId];
                        var last = metas[metas.length - 1] || {};
                        presenceByUser[userId] = { ready: Boolean(last.ready), connected: true };
                    });
                    emit("presence", presenceByUser);
                    checkHostPresence();
                    maybeAutoPause();
                },
                onStatus: function (status) {
                    state.connectionStatus = status === "SUBSCRIBED" ? "connected" : "reconnecting";
                    emit("connection", state.connectionStatus);
                }
            });
            return channel.ready.then(function () {
                channel.track({ ready: false });
            });
        }

        // Host abwesend? -> lokal an alle Clients melden (keine DB-Änderung,
        // niemand außer dem Gastgeber selbst darf submit_room_state
        // aufrufen - siehe Prompt "noch keine automatische
        // Gastgeberübertragung").
        function checkHostPresence() {
            if (!state.hostId) { return; }
            var hostPresent = Boolean(presenceByUser[state.hostId] && presenceByUser[state.hostId].connected);
            if (!hostPresent && !hostWasAbsent && !isHost()) {
                hostWasAbsent = true;
                emit("host_disconnected", true);
            } else if (hostPresent && hostWasAbsent) {
                hostWasAbsent = false;
                emit("host_disconnected", false);
            }
        }

        // Der Gastgeber pausiert die laufende Partie automatisch, sobald
        // ein menschlicher Mitspieler die Verbindung verliert, und setzt
        // sie fort, sobald wieder alle da sind.
        function maybeAutoPause() {
            if (!isHost() || state.status === "waiting" || state.status === "finished") { return; }
            var missingHuman = state.players.some(function (p) {
                return !p.is_ai && p.seat !== state.mySeat &&
                    !(presenceByUser[p.user_id] && presenceByUser[p.user_id].connected);
            });
            var targetStatus = missingHuman ? "paused" : "playing";
            if (targetStatus !== state.status) {
                T.submitState(state.roomId, state.stateVersion, state.publicInfo, null, targetStatus)
                    .then(function (res) { state.stateVersion = res.state_version; state.status = targetStatus; emit("snapshot", state); })
                    .catch(function () { /* nächster Presence-Wechsel versucht es erneut */ });
            }
        }

        async function create(opts) {
            var res = await T.createRoom({ gameType: gameType, maxPlayers: opts.maxPlayers, playerName: opts.playerName, color: opts.color });
            state.roomId = res.room_id;
            await refresh();
            await connectChannel();
            return state;
        }

        async function join(opts) {
            var res = await T.joinRoom({ roomCode: opts.roomCode, playerName: opts.playerName, color: opts.color });
            state.roomId = res.room_id;
            await refresh();
            await connectChannel();
            broadcastLobbyChanged();
            return state;
        }

        async function reconnect(roomId) {
            state.roomId = roomId;
            await refresh();
            await connectChannel();
            return state;
        }

        function broadcastLobbyChanged() {
            if (channel) { channel.broadcast({ type: "lobby_changed" }); }
        }

        async function setReady(ready) {
            await T.setReady(state.roomId, ready);
            if (channel) { channel.track({ ready: ready }); }
            broadcastLobbyChanged();
            await refresh();
        }

        async function hostSetSeat(seat, isAi) {
            await T.hostSetSeat(state.roomId, seat, isAi);
            broadcastLobbyChanged();
            await refresh();
        }

        async function startGame() {
            await T.startGame(state.roomId);
            broadcastLobbyChanged();
            await refresh();
        }

        // Vom jeweiligen Spiel-Adapter genutzt: NUR der Gastgeber darf
        // das wirklich schreiben (auch serverseitig erzwungen).
        async function submitState(publicInfo, gameState) {
            var res = await T.submitState(state.roomId, state.stateVersion, publicInfo, gameState || null);
            state.stateVersion = res.state_version;
            state.publicInfo = publicInfo;
            return res.state_version;
        }

        // Für Aktionswünsche (Gast -> Gastgeber) und bestätigte Updates
        // (Gastgeber -> alle). type darf nicht "lobby_changed" sein.
        function sendGameEvent(payload) {
            if (channel) { channel.broadcast(payload); }
        }

        // Serverseitige Ereignis-ID-Eindeutigkeit (siehe record_room_event()
        // in der Migration) - true nur beim allerersten Aufruf mit dieser
        // eventId für diesen Raum, sonst false (schon verarbeitet/verspätet).
        function recordEvent(eventId) {
            return T.recordRoomEvent(state.roomId, eventId);
        }

        async function leave() {
            broadcastLobbyChanged();
            try { await T.leaveRoom(state.roomId); } catch (e) { /* egal, wir trennen trotzdem */ }
            if (channel) { channel.disconnect(); channel = null; }
        }

        return {
            on: on,
            create: create,
            join: join,
            reconnect: reconnect,
            setReady: setReady,
            hostSetSeat: hostSetSeat,
            startGame: startGame,
            submitState: submitState,
            sendGameEvent: sendGameEvent,
            recordEvent: recordEvent,
            refresh: refresh,
            leave: leave,
            isHost: isHost,
            mySeatInfo: mySeatInfo,
            getState: function () { return state; },
            isUserPresent: function (userId) { return Boolean(presenceByUser[userId] && presenceByUser[userId].connected); }
        };
    }

    window.MultiplayerRoom = { createSession: createSession };

})();
