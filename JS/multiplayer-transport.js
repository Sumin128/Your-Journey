/* =====================================================
   MULTIPLAYER-TRANSPORT
   Dünne, spielunabhängige Schicht über Supabase: RPC-Aufrufe für
   Räume/Lobby/Zustand + ein privater Realtime-Kanal pro Raum
   (Broadcast für Spielereignisse, Presence NUR für verbunden/
   getrennt + Bereitschaft - siehe Prompt). Kennt weder Miro noch
   Mirelons Jagd - das übernehmen die spielbezogenen Adapter.

   Voraussetzung: JS/auth.js ist bereits geladen (supabaseClient,
   currentSession). Ohne eingeloggtes Konto liefert isAvailable()
   false - Online-Räume sind Version-1-Anmeldepflicht.
   ===================================================== */

(function () {
    "use strict";

    function loggedIn() {
        return typeof supabaseClient !== "undefined" && supabaseClient &&
            typeof currentSession !== "undefined" && Boolean(currentSession);
    }

    function myUserId() {
        return loggedIn() ? currentSession.user.id : null;
    }

    async function rpc(name, args) {
        if (!loggedIn()) {
            throw new Error("not_logged_in");
        }
        var res = await supabaseClient.rpc(name, args);
        if (res.error) {
            // Supabase reicht den RAISE EXCEPTION-Text im message-Feld durch.
            throw new Error(res.error.message || "rpc_failed");
        }
        return res.data;
    }

    /* =====================================================
       RAUM-RPCs
       ===================================================== */

    function createRoom(opts) {
        return rpc("create_game_room", {
            p_game_type: opts.gameType,
            p_max_players: opts.maxPlayers,
            p_player_name: opts.playerName,
            p_color: opts.color || null
        });
    }

    function joinRoom(opts) {
        return rpc("join_game_room", {
            p_room_code: String(opts.roomCode || "").trim().toUpperCase(),
            p_player_name: opts.playerName,
            p_color: opts.color || null
        });
    }

    function setReady(roomId, ready) {
        return rpc("set_player_ready", { p_room_id: roomId, p_ready: Boolean(ready) });
    }

    function hostSetSeat(roomId, seat, isAi) {
        return rpc("host_set_seat", { p_room_id: roomId, p_seat: seat, p_is_ai: Boolean(isAi) });
    }

    function leaveRoom(roomId) {
        return rpc("leave_game_room", { p_room_id: roomId });
    }

    function startGame(roomId) {
        return rpc("start_game_room", { p_room_id: roomId });
    }

    function submitState(roomId, expectedVersion, publicInfo, state, status) {
        return rpc("submit_room_state", {
            p_room_id: roomId,
            p_expected_version: expectedVersion,
            p_public_info: publicInfo,
            p_state: state || null,
            p_status: status || null
        });
    }

    function loadState(roomId) {
        return rpc("load_room_state", { p_room_id: roomId });
    }

    // Serverseitige Ereignis-ID-Eindeutigkeit (Anti-Replay) - siehe
    // record_room_event() in der Migration. Gibt true nur beim
    // allerersten Aufruf mit dieser (roomId, eventId)-Kombination
    // zurück; ein zweiter Aufruf (Netzwerk-Wiederholung, verspätete
    // Zustellung nach einem Reconnect) liefert false.
    function recordRoomEvent(roomId, eventId) {
        return rpc("record_room_event", { p_room_id: roomId, p_event_id: eventId });
    }

    /* =====================================================
       REALTIME-KANAL (ein privater Kanal pro Raum)
       Broadcast: Spielereignisse (Aktionswünsche, bestätigte
       Zustands-Updates, Lobby-Änderungen). Presence: NUR verbunden/
       getrennt + Bereitschaft - niemals Spieldaten wie Handkarten
       oder Zugziele.
       ===================================================== */

    function connectRoomChannel(roomId, handlers) {
        handlers = handlers || {};
        if (!loggedIn()) { throw new Error("not_logged_in"); }

        // private:true ist zwingend, damit dieser Kanal überhaupt den
        // RLS-Policies auf realtime.messages (siehe Migration Abschnitt
        // 14) unterliegt - ohne dieses Flag wäre "room:<uuid>" als
        // Kanalname allein KEINE Zugriffskontrolle, jeder angemeldete
        // Client könnte sonst jeden Raum mithören/senden.
        var channel = supabaseClient.channel("room:" + roomId, {
            config: {
                private: true,
                broadcast: { self: false, ack: false },
                presence: { key: myUserId() }
            }
        });

        channel.on("broadcast", { event: "game" }, function (msg) {
            if (typeof handlers.onBroadcast === "function") { handlers.onBroadcast(msg.payload); }
        });

        channel.on("presence", { event: "sync" }, function () {
            if (typeof handlers.onPresenceSync === "function") { handlers.onPresenceSync(channel.presenceState()); }
        });
        channel.on("presence", { event: "join" }, function (info) {
            if (typeof handlers.onPresenceJoin === "function") { handlers.onPresenceJoin(info); }
        });
        channel.on("presence", { event: "leave" }, function (info) {
            if (typeof handlers.onPresenceLeave === "function") { handlers.onPresenceLeave(info); }
        });

        var subscribed = false;
        var subscribePromise = new Promise(function (resolve) {
            channel.subscribe(function (status) {
                if (status === "SUBSCRIBED" && !subscribed) {
                    subscribed = true;
                    resolve(true);
                }
                if (typeof handlers.onStatus === "function") { handlers.onStatus(status); }
            });
        });

        return {
            ready: subscribePromise,
            // payload ist reine Spiellogik-Nutzlast des Adapters (Aktions-
            // wunsch oder bestätigtes Zustands-Update) - Handkarten anderer
            // Spieler dürfen hier NIE hinein (siehe Adapter-Dateien).
            broadcast: function (payload) {
                return channel.send({ type: "broadcast", event: "game", payload: payload });
            },
            // presenceData: nur {ready, connected}-artige Kleinigkeiten.
            track: function (presenceData) {
                return channel.track(presenceData || {});
            },
            presenceState: function () {
                return channel.presenceState();
            },
            disconnect: function () {
                return supabaseClient.removeChannel(channel);
            }
        };
    }

    window.MultiplayerTransport = {
        isAvailable: loggedIn,
        myUserId: myUserId,
        createRoom: createRoom,
        joinRoom: joinRoom,
        setReady: setReady,
        hostSetSeat: hostSetSeat,
        leaveRoom: leaveRoom,
        startGame: startGame,
        submitState: submitState,
        loadState: loadState,
        recordRoomEvent: recordRoomEvent,
        connectRoomChannel: connectRoomChannel
    };

})();
