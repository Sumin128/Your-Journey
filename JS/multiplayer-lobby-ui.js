/* =====================================================
   MULTIPLAYER-LOBBY-UI
   EINE gemeinsame Warteraum-Oberfläche für Miro und Mirelons Jagd
   (Raum erstellen/beitreten, Sitzplätze, Bereitschaft, Start,
   Verbindungsbanner) - kennt keine Spielregeln. Arbeitet auf dem
   festen Markup in baerental.html (#bear-online-lobby) und einer
   JS/multiplayer-room.js-Session. Beim erfolgreichen Start ruft sie
   den vom jeweiligen Adapter übergebenen onGameStart(session)-Callback.
   ===================================================== */

(function () {
    "use strict";

    var COLORS = [
        { key: "gruen", name: "Waldgrün" },
        { key: "orange", name: "Wüstenorange" },
        { key: "blau", name: "Eisblau" },
        { key: "rosa", name: "Rosenrot" }
    ];

    function els() {
        return {
            root: document.getElementById("bear-online-lobby"),
            choice: document.getElementById("mp-online-choice"),
            createBtn: document.getElementById("mp-create-room"),
            joinInput: document.getElementById("mp-join-code"),
            joinBtn: document.getElementById("mp-join-room"),
            error: document.getElementById("mp-online-error"),
            back: document.getElementById("mp-online-back"),
            room: document.getElementById("mp-lobby-room"),
            codeValue: document.getElementById("mp-room-code-value"),
            copyBtn: document.getElementById("mp-copy-code"),
            seatList: document.getElementById("mp-seat-list"),
            readyBtn: document.getElementById("mp-ready-toggle"),
            startBtn: document.getElementById("mp-start-game"),
            status: document.getElementById("mp-lobby-status"),
            leaveBtn: document.getElementById("mp-leave-lobby"),
            banner: document.getElementById("mp-banner")
        };
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }

    function setBanner(text) {
        var e = els();
        if (!text) { e.banner.hidden = true; e.banner.textContent = ""; return; }
        e.banner.hidden = false;
        e.banner.textContent = text;
    }

    // config: { gameType, defaultMaxPlayers, playerName, onGameStart(session),
    //           onBack() }
    function open(config) {
        var e = els();
        var session = null;
        var myColor = null;
        e.root.hidden = false;
        e.choice.hidden = false;
        e.room.hidden = true;
        e.error.hidden = true;
        setBanner("");

        e.back.onclick = function () {
            e.root.hidden = true;
            if (typeof config.onBack === "function") { config.onBack(); }
        };

        e.createBtn.onclick = async function () {
            if (!window.MultiplayerTransport.isAvailable()) {
                showError("Nur angemeldete Spieler können einen Raum erstellen.");
                return;
            }
            try {
                setStatus("Raum wird erstellt …");
                session = window.MultiplayerRoom.createSession(config.gameType);
                wireSession(session, true);
                await session.create({ maxPlayers: config.defaultMaxPlayers || 4, playerName: config.playerName, color: myColor });
                enterRoom(session, true);
            } catch (err) { showError(friendlyError(err)); }
        };

        e.joinBtn.onclick = async function () {
            if (!window.MultiplayerTransport.isAvailable()) {
                showError("Nur angemeldete Spieler können einem Raum beitreten.");
                return;
            }
            var code = (e.joinInput.value || "").trim();
            if (!code) { showError("Bitte gib einen Raumcode ein."); return; }
            try {
                setStatus("Trete Raum bei …");
                session = window.MultiplayerRoom.createSession(config.gameType);
                wireSession(session, false);
                await session.join({ roomCode: code, playerName: config.playerName, color: myColor });
                enterRoom(session, false);
            } catch (err) { showError(friendlyError(err)); }
        };

        e.leaveBtn.onclick = async function () {
            if (session) { await session.leave(); }
            e.root.hidden = true;
            if (typeof config.onBack === "function") { config.onBack(); }
        };

        e.copyBtn.onclick = function () {
            var code = e.codeValue.textContent;
            if (navigator.clipboard && code) {
                navigator.clipboard.writeText(code).then(function () {
                    setStatus("Code kopiert!");
                }).catch(function () { /* Zwischenablage evtl. blockiert - kein Absturz */ });
            }
        };

        e.readyBtn.onclick = async function () {
            if (!session) { return; }
            var mine = session.mySeatInfo();
            await session.setReady(!(mine && mine.ready));
        };

        e.startBtn.onclick = async function () {
            if (!session) { return; }
            try { await session.startGame(); }
            catch (err) { showError(friendlyError(err)); }
        };

        function showError(text) { e.error.hidden = false; e.error.textContent = text; }
        function setStatus(text) { e.status.textContent = text; }

        function enterRoom(sess, isHost) {
            e.choice.hidden = true;
            e.room.hidden = false;
            e.codeValue.textContent = sess.getState().roomCode;
        }

        function wireSession(sess, isHost) {
            sess.on("snapshot", function (st) { renderRoom(sess, st); });
            sess.on("presence", function () { renderRoom(sess, sess.getState()); });
            sess.on("connection", function (status) {
                if (status === "reconnecting") { setBanner("🔌 Verbindung wird wiederhergestellt …"); }
                else { setBanner(""); }
            });
            sess.on("host_disconnected", function (absent) {
                setBanner(absent ? "⏳ Der Gastgeber hat die Verbindung verloren – wir warten auf die Rückkehr." : "");
            });
            sess.on("snapshot", function (st) {
                if (st.status === "playing" && typeof config.onGameStart === "function" && !sess._handedOff) {
                    sess._handedOff = true;
                    e.root.hidden = true;
                    config.onGameStart(sess);
                }
            });
        }

        function renderRoom(sess, st) {
            e.seatList.innerHTML = "";
            var isHost = sess.isHost();
            for (var seat = 0; seat < st.maxPlayers; seat++) {
                var player = st.players.filter(function (p) { return p.seat === seat; })[0];
                var row = document.createElement("div");
                row.className = "mp-seat" + (player ? "" : " is-open");
                if (player) {
                    row.innerHTML =
                        "<strong>" + escapeHtml(player.player_name) + "</strong>" +
                        (player.is_ai ? '<span class="mp-tag">🤖 Computer</span>' :
                            '<span class="mp-tag ' + (player.ready ? "is-ready" : "") + '">' + (player.ready ? "✅ Bereit" : "… wartet") + "</span>") +
                        (player.user_id === st.hostId ? '<span class="mp-tag mp-host-tag">👑 Gastgeber</span>' : "") +
                        (!player.is_ai && !sess.isUserPresent(player.user_id) ? '<span class="mp-tag mp-offline-tag">🔌 getrennt</span>' : "");
                } else {
                    row.innerHTML = "<span>Frei</span>";
                    if (isHost && st.status === "waiting") {
                        var aiBtn = document.createElement("button");
                        aiBtn.type = "button"; aiBtn.className = "mp-seat-ai-btn"; aiBtn.textContent = "🤖 Computer setzen";
                        aiBtn.addEventListener("click", (function (s) { return function () { sess.hostSetSeat(s, true); }; })(seat));
                        row.appendChild(aiBtn);
                    }
                }
                if (isHost && player && player.is_ai && st.status === "waiting") {
                    var freeBtn = document.createElement("button");
                    freeBtn.type = "button"; freeBtn.className = "mp-seat-ai-btn"; freeBtn.textContent = "Platz freigeben";
                    freeBtn.addEventListener("click", (function (s) { return function () { sess.hostSetSeat(s, false); }; })(seat));
                    row.appendChild(freeBtn);
                }
                e.seatList.appendChild(row);
            }

            var mine = sess.mySeatInfo();
            e.readyBtn.hidden = Boolean(mine && mine.is_ai) || st.status !== "waiting";
            e.readyBtn.textContent = mine && mine.ready ? "❌ Nicht mehr bereit" : "✅ Bereit";
            e.startBtn.hidden = !isHost || st.status !== "waiting";

            var allReady = st.players.every(function (p) { return p.ready; });
            var enoughSeats = st.players.length >= 2;
            e.startBtn.disabled = !(allReady && enoughSeats);

            if (st.status === "finished") { setStatus("🏁 Partie beendet."); }
            else if (st.status === "paused") { setStatus("⏸️ Partie pausiert – wir warten auf die Rückkehr eines Spielers."); }
            else if (st.status === "playing") { setStatus("🎮 Partie läuft schon – du wirst gleich verbunden …"); }
            else if (isHost) { setStatus(allReady && enoughSeats ? "Alle bereit – du kannst starten!" : "Warte, bis alle bereit sind …"); }
            else { setStatus("Warten auf den Gastgeber …"); }
        }

        function friendlyError(err) {
            var msg = (err && err.message) || "";
            var map = {
                room_not_found: "Diesen Raumcode gibt es nicht. Bitte prüfen und erneut versuchen.",
                room_full: "Dieser Raum ist schon voll.",
                room_already_started: "Diese Partie hat schon begonnen.",
                already_joined: "Du bist diesem Raum schon beigetreten.",
                not_logged_in: "Bitte melde dich zuerst an."
            };
            return map[msg] || "Das hat gerade nicht geklappt. Versuch's noch einmal.";
        }
    }

    window.MultiplayerLobbyUI = { open: open, setBanner: setBanner };

})();
