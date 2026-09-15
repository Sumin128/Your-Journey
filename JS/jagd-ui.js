/* =====================================================
   MIRELONS JAGD - Darstellung & Bedienung
   Liest/verändert AUSSCHLIESSLICH über JagdEngine/JagdAI. Reine
   DOM-Arbeit hier, keine Spielregeln. Platzhalter-Grafik (Emoji,
   CSS-Formen) - siehe BERICHT.md, Codex ersetzt später die Assets
   über JagdData.ASSETS, ohne dass diese Datei sich ändern muss.
   ===================================================== */

(function () {
    "use strict";

    var D = window.JagdData;
    var E = window.JagdEngine;
    var AI = window.JagdAI;

    var state = null;
    var tokenEls = {};
    var els = {};
    var pendingForkResolve = null;
    var piecesPerPlayer = 4;
    var preferredColor = "gruen";
    var rerollReady = false;

    var CELL_ICON = { action: "", rest: "" };

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        cacheStaticEls();
        wireLanding();
        wireModeSelect();
        wireGameControls();
        wireForkModal();
    }

    function cacheStaticEls() {
        els.landing = document.getElementById("jagd-landing");
        els.modeselect = document.getElementById("jagd-modeselect");
        els.mixedConfig = document.getElementById("jagd-mixed-config");
        els.game = document.getElementById("jagd-game");
        els.soundToggle = document.getElementById("jagd-sound-toggle");
        els.board = document.getElementById("jagd-board");
        els.turnBanner = document.getElementById("jagd-turn-banner");
        els.globalEffect = document.getElementById("jagd-global-effect");
        els.direction = document.getElementById("jagd-direction");
        els.diceBtn = document.getElementById("jagd-dice-btn");
        els.diceFace = document.getElementById("jagd-dice-face");
        els.playerStrip = document.getElementById("jagd-player-strip");
        els.homeRow = document.getElementById("jagd-home-row");
        els.log = document.getElementById("jagd-log");
        els.eventModal = document.getElementById("jagd-event-modal");
        els.forkModal = document.getElementById("jagd-fork-modal");
        els.winModal = document.getElementById("jagd-win-modal");
    }

    /* =====================================================
       LANDING (Branos Spielhalle - schlanke Vorschau-Startseite)
       ===================================================== */

    function wireLanding() {
        document.getElementById("jagd-card-start").addEventListener("click", function () {
            els.landing.hidden = true;
            els.modeselect.hidden = false;
        });
        document.getElementById("jagd-card-miro").addEventListener("click", function () {
            location.href = "../miro/index.html";
        });
        ["jagd-card-tierversteck"].forEach(function (id) {
            document.getElementById(id).addEventListener("click", function () { flashComingSoon(id); });
        });
    }

    function flashComingSoon(cardId) {
        var card = document.getElementById(cardId);
        card.classList.add("is-shaking");
        setTimeout(function () { card.classList.remove("is-shaking"); }, 400);
    }

    /* =====================================================
       MODUSAUSWAHL
       ===================================================== */

    var MIXED_SLOTS = ["human", "ai", "off", "off"];

    function wireModeSelect() {
        document.getElementById("jagd-back-landing").addEventListener("click", function () {
            els.modeselect.hidden = true;
            els.landing.hidden = false;
        });

        document.querySelectorAll("#jagd-mode-grid button[data-mode]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var mode = btn.dataset.mode;
                if (mode === "mixed") {
                    renderMixedConfig();
                    els.mixedConfig.hidden = false;
                    return;
                }
                els.mixedConfig.hidden = true;
                startFromMode(mode);
            });
        });

        renderMixedConfig();
        document.querySelectorAll("[data-pieces]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                piecesPerPlayer = Number(btn.dataset.pieces);
                document.querySelectorAll("[data-pieces]").forEach(function (choice) {
                    var active = Number(choice.dataset.pieces) === piecesPerPlayer;
                    choice.classList.toggle("is-active", active);
                    choice.setAttribute("aria-pressed", String(active));
                });
            });
        });
        document.querySelectorAll("[data-color]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                preferredColor = btn.dataset.color;
                document.querySelectorAll("[data-color]").forEach(function (choice) {
                    var active = choice.dataset.color === preferredColor;
                    choice.classList.toggle("is-active", active);
                    choice.setAttribute("aria-pressed", String(active));
                });
            });
        });
        document.getElementById("jagd-mixed-start").addEventListener("click", function () {
            var configs = MIXED_SLOTS
                .filter(function (s) { return s !== "off"; })
                .map(function (s) { return { type: s }; });
            if (configs.length) { configs[0].color = preferredColor; }
            if (configs.length < 2) {
                addSetupWarning("Mindestens 2 Spieler nötig.");
                return;
            }
            startGame(configs);
        });
    }

    function addSetupWarning(text) {
        var w = document.getElementById("jagd-mixed-warning");
        w.textContent = text;
        w.hidden = false;
    }

    function renderMixedConfig() {
        var wrap = document.getElementById("jagd-mixed-slots");
        wrap.innerHTML = "";
        var labels = { human: "🧑 Mensch", ai: "🤖 Computer", off: "— aus —" };
        MIXED_SLOTS.forEach(function (val, i) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "jagd-slot-toggle";
            btn.textContent = "Spieler " + (i + 1) + ": " + labels[val];
            btn.addEventListener("click", function () {
                var order = ["human", "ai", "off"];
                MIXED_SLOTS[i] = order[(order.indexOf(MIXED_SLOTS[i]) + 1) % order.length];
                renderMixedConfig();
            });
            wrap.appendChild(btn);
        });
    }

    function startFromMode(mode) {
        var byMode = {
            cpu1: [{ type: "human" }, { type: "ai" }],
            p2: [{ type: "human" }, { type: "human" }],
            p3: [{ type: "human" }, { type: "human" }, { type: "human" }],
            p4: [{ type: "human" }, { type: "human" }, { type: "human" }, { type: "human" }]
        };
        byMode[mode][0].color = preferredColor;
        startGame(byMode[mode]);
    }

    /* =====================================================
       SPIELAUFBAU
       ===================================================== */

    function startGame(playerConfigs) {
        playerConfigs = playerConfigs.map(function (cfg) {
            return { type: cfg.type, name: cfg.name, color: cfg.color, tokenCount: piecesPerPlayer };
        });
        state = E.createGame(playerConfigs);
        els.modeselect.hidden = true;
        els.game.hidden = false;
        buildBoardDom();
        buildTrays();
        renderAllTokens();
        E.startTurn(state);
        renderTurnUI();
    }

    function cellPosition(id) {
        // 48 gut lesbare Felder auf einem großen, kantigen Rundkurs.
        // Die vier Startfelder liegen exakt an den vier Ecken (0/12/24/36).
        var side = Math.floor(id / 12);
        var t = (id % 12) / 12;
        var near = 22.5;
        var far = 77.5;
        if (side === 0) { return { left: near + (far - near) * t, top: near }; }
        if (side === 1) { return { left: far, top: near + (far - near) * t }; }
        if (side === 2) { return { left: far - (far - near) * t, top: far }; }
        return { left: near, top: far - (far - near) * t };
    }

    function homePosition(color, index) {
        var outer = 22.2;
        var step = 5.15;
        if (color === "gruen") { return { left: outer + step * index, top: 50 }; }
        if (color === "orange") { return { left: 50, top: outer + step * index }; }
        if (color === "blau") { return { left: 100 - outer - step * index, top: 50 }; }
        return { left: 50, top: 100 - outer - step * index };
    }

    function regionTint(regionId) {
        return { wurzelwald: "gruen", wueste: "orange", frost: "blau", rosen: "rosa" }[regionId];
    }

    function buildBoardDom() {
        els.board.innerHTML = "";
        els.ringCells = {};
        els.shortcutCells = {};

        D.RING.forEach(function (cell) {
            var pos = cellPosition(cell.id);
            var div = document.createElement("div");
            div.className = "jagd-cell jagd-tint-" + regionTint(cell.region);
            if (cell.isStart) { div.classList.add("jagd-cell--start"); }
            if (cell.type === "action") { div.classList.add("jagd-cell--action"); }
            if (cell.type === "rest") { div.classList.add("jagd-cell--rest"); }
            if (cell.isFork) { div.classList.add("jagd-cell--fork"); }
            div.style.left = pos.left + "%";
            div.style.top = pos.top + "%";
            div.dataset.ring = cell.id;
            div.textContent = CELL_ICON[cell.type] || "";
            div.title = cell.isStart ? "Startfeld" : (cell.type === "action" ? "Aktionsfeld" : (cell.type === "rest" ? "Sicheres Rastfeld" : "Normales Feld"));
            els.board.appendChild(div);
            els.ringCells[cell.id] = div;
        });

        var castle = document.createElement("div");
        castle.className = "jagd-castle";
        castle.setAttribute("aria-label", "Schloss Mirelon");
        els.board.appendChild(castle);

        // Spielfiguren als absolut positionierte Elemente im Brett anlegen.
        state.players.forEach(function (player) {
            player.tokenIds.forEach(function (tokenId) {
                var t = document.createElement("div");
                t.className = "jagd-token jagd-token--" + player.color;
                t.id = "tok-" + tokenId;
                t.dataset.tokenId = tokenId;
                t.dataset.number = state.tokens[tokenId].tokenIndex + 1;
                t.title = player.name + " – Figur " + t.dataset.number;
                t.setAttribute("aria-label", t.title);
                tokenEls[tokenId] = t;
            });
        });
    }

    function buildTrays() {
        els.playerStrip.innerHTML = "";
        els.homeRow.innerHTML = "";
        els.lagerTrays = {};
        els.homeSlots = {};

        state.players.forEach(function (player) {
            var chip = document.createElement("div");
            chip.className = "jagd-player-chip jagd-tint-" + player.color;
            chip.dataset.playerId = player.id;
            chip.innerHTML =
                '<span class="jagd-player-dot"></span>' +
                '<strong>' + escapeHtml(player.name) + '</strong>' +
                (player.type === "ai" ? ' <span class="jagd-ai-badge">🤖</span>' : "") +
                '<span class="jagd-lager" data-lager="' + player.id + '"></span>';
            els.playerStrip.appendChild(chip);
            var camp = document.createElement("div");
            camp.className = "jagd-board-camp jagd-board-camp--" + player.color;
            camp.setAttribute("aria-label", "Lager " + player.name);
            els.board.appendChild(camp);
            els.lagerTrays[player.id] = camp;

            var slots = [];
            for (var i = 0; i < D.HOME_LENGTH; i++) {
                var homePos = homePosition(player.color, i);
                var slot = document.createElement("div");
                slot.className = "jagd-home-slot jagd-home-slot--board jagd-tint-" + player.color;
                slot.dataset.home = player.id + "-" + i;
                slot.style.left = homePos.left + "%";
                slot.style.top = homePos.top + "%";
                els.board.appendChild(slot);
                slots.push(slot);
            }
            els.homeSlots[player.id] = slots;
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }

    /* =====================================================
       RENDERN
       ===================================================== */

    function positionTokenAt(tokenEl, cellEl) {
        if (!cellEl) { return; }
        var boardRect = els.board.getBoundingClientRect();
        var r = cellEl.getBoundingClientRect();
        tokenEl.style.left = (r.left - boardRect.left + r.width / 2 - tokenEl.offsetWidth / 2) + "px";
        tokenEl.style.top = (r.top - boardRect.top + r.height / 2 - tokenEl.offsetHeight / 2) + "px";
    }

    function renderAllTokens() {
        Object.keys(state.tokens).forEach(function (id) {
            var token = state.tokens[id];
            var el = tokenEls[id];
            var effectIcons = [];
            var effectWords = [];
            if (token.frozenRounds > 0) {
                effectIcons.push("❄️" + token.frozenRounds);
                effectWords.push("eingefroren: " + token.frozenRounds + " Runde(n)");
            }
            if (token.shieldTurns > 0) {
                effectIcons.push("🛡️" + token.shieldTurns);
                effectWords.push("geschützt: " + token.shieldTurns + " Runde(n)");
            }
            if (token.magicBound) {
                effectIcons.push("⛓️1");
                effectWords.push("magisch gefesselt: 1 Runde");
            }
            el.dataset.effects = effectIcons.join(" ");
            var player = state.players[token.playerId];
            var baseLabel = player.name + " – Figur " + (token.tokenIndex + 1);
            el.title = baseLabel + (effectWords.length ? " (" + effectWords.join(", ") + ")" : "");
            el.setAttribute("aria-label", el.title);
            el.classList.toggle("is-frozen", token.frozenRounds > 0);
            el.classList.toggle("is-shielded", token.shieldTurns > 0);
            el.classList.toggle("is-bound", Boolean(token.magicBound));
            el.classList.remove("is-movable");

            if (token.zone === "lager") {
                el.style.position = "relative"; el.style.left = ""; el.style.top = "";
                els.lagerTrays[token.playerId].appendChild(el);
            } else if (token.zone === "home") {
                el.style.position = "relative"; el.style.left = ""; el.style.top = "";
                els.homeSlots[token.playerId][token.p - 48].appendChild(el);
            } else {
                els.board.appendChild(el);
                el.style.position = "absolute";
                var cellEl = token.zone === "ring"
                    ? els.ringCells[E.globalCellOfToken(state, token)]
                    : els.shortcutCells[D.SHORTCUTS[token.scFork].cells[token.scIdx].id];
                positionTokenAt(el, cellEl);
            }
        });
    }

    function renderTurnUI() {
        if (state.winnerId !== null) { return; }
        var player = E.currentPlayer(state);
        els.globalEffect.hidden = !state.reverseActive;
        els.globalEffect.textContent = state.reverseActive
            ? "🔄 Kehrtwende aktiv: Alle Figuren laufen rückwärts."
            : "";
        els.direction.textContent = state.reverseActive
            ? "↺ Laufrichtung: rückwärts"
            : "↻ Laufrichtung: vorwärts zum Schloss";
        els.direction.classList.toggle("is-reversed", state.reverseActive);
        els.turnBanner.textContent = (player.type === "ai" ? "🤖 " : "🧑 ") + player.name + " ist dran";
        els.turnBanner.className = "jagd-turn-banner jagd-tint-" + player.color;

        document.querySelectorAll(".jagd-player-chip").forEach(function (chip) {
            chip.classList.toggle("is-current", Number(chip.dataset.playerId) === player.id);
        });

        var canRoll = player.type === "human" && !state.rolledThisTurn;
        els.diceBtn.disabled = !canRoll;
        els.diceBtn.classList.toggle("is-reroll", canRoll && rerollReady);
        els.diceBtn.setAttribute("aria-label", state.bonusMovePending
            ? "Bonuswurf. Würfel antippen."
            : "Würfeln. Antippen zum Würfeln, ziehen zum Anschauen.");
        if (canRoll && rerollReady) {
            els.turnBanner.textContent = "🎲 Eine 6! " + player.name + " darf noch einmal würfeln";
        }

        if (player.type === "ai" && !state.rolledThisTurn) {
            setTimeout(aiTakeTurn, AI.THINK_DELAY_MS);
        }
    }

    function addLog(text) {
        var line = document.createElement("div");
        line.textContent = text;
        els.log.prepend(line);
        while (els.log.children.length > 30) { els.log.removeChild(els.log.lastChild); }
    }

    /* =====================================================
       WÜRFELN
       ===================================================== */

    // Zurück zur Modusauswahl, ohne die Seite neu zu laden (wichtig, weil
    // Mirelons Jagd eingebettet in Branos Spielhalle läuft).
    function backToModeSelect() {
        els.eventModal.hidden = true;
        els.forkModal.hidden = true;
        els.winModal.hidden = true;
        els.game.hidden = true;
        els.modeselect.hidden = false;
    }

    function wireGameControls() {
        els.diceBtn.addEventListener("click", onRollClick);
        updateSoundToggle();
        els.soundToggle.addEventListener("click", function () {
            if (!window.JagdSound) { return; }
            window.JagdSound.setMuted(!window.JagdSound.isMuted());
            updateSoundToggle();
        });
        // Kein location.reload(): Mirelons Jagd läuft eingebettet in Branos
        // Spielhalle (baerental.html) - ein voller Reload würde die ganze
        // Bärental-Seite zurücksetzen. Stattdessen zurück zur Modusauswahl.
        document.getElementById("jagd-restart").addEventListener("click", backToModeSelect);
        var leaveLink = document.getElementById("jagd-leave");
        if (leaveLink) {
            leaveLink.addEventListener("click", function (e) {
                e.preventDefault();
                if (window.BranosSpielhalle) { window.BranosSpielhalle.leaveGame(); }
                else { backToModeSelect(); }
            });
        }
        var winAgain = document.getElementById("jagd-win-again");
        if (winAgain) {
            winAgain.addEventListener("click", function () {
                els.winModal.hidden = true;
                backToModeSelect();
            });
        }
        document.addEventListener("click", function (e) {
            var tok = e.target.closest(".jagd-token.is-movable");
            if (tok) { onTokenClick(tok.dataset.tokenId); }
        });
        window.addEventListener("resize", function () { if (state) { renderAllTokens(); } });
    }

    function updateSoundToggle() {
        var muted = !window.JagdSound || window.JagdSound.isMuted();
        els.soundToggle.textContent = muted ? "🔇 Ton aus" : "🔊 Ton an";
        els.soundToggle.setAttribute("aria-pressed", String(!muted));
    }

    function onRollClick() {
        if (els.diceBtn.disabled) { return; }
        els.diceBtn.disabled = true;
        rerollReady = false;
        els.diceBtn.classList.remove("is-reroll");
        var result = E.rollDice(); // Ergebnis steht sofort fest
        animateDice(result, function () { afterRoll(result); });
    }

    // animateDice() STELLT das vorher feststehende Ergebnis nur DAR.
    function animateDice(result, done) {
        if (window.JagdSound) { window.JagdSound.roll(); }
        if (window.JagdDice3D) { window.JagdDice3D.roll(result); }
        var ticks = 8, i = 0;
        var iv = setInterval(function () {
            els.diceFace.textContent = String(Math.floor(Math.random() * 6) + 1);
            i++;
            if (i >= ticks) {
                clearInterval(iv);
                els.diceFace.textContent = String(result);
                setTimeout(done, 120);
            }
        }, 60);
    }

    function afterRoll(diceValue) {
        state.diceValue = diceValue;
        state.rolledThisTurn = true;
        var player = E.currentPlayer(state);
        var movable = E.getMovableTokens(state, player.id, diceValue);

        if (!movable.length) {
            addLog(player.name + " würfelt eine " + diceValue + " – keine Figur kann ziehen, die Runde wird ausgesetzt.");
            setTimeout(function () { advanceAfterMove(diceValue === 6); }, 500);
            return;
        }

        if (player.type === "ai") {
            var action = AI.chooseAction(state, diceValue);
            setTimeout(function () { executeAction(action); }, 400);
        } else {
            if (diceValue === 6) {
                els.turnBanner.textContent = "🎯 6 gewürfelt – Figur auswählen, danach noch einmal würfeln";
            }
            highlightMovable(movable);
        }
    }

    function highlightMovable(movable) {
        movable.forEach(function (m) { tokenEls[m.tokenId].classList.add("is-movable"); });
    }

    function clearHighlights() {
        Object.keys(tokenEls).forEach(function (id) { tokenEls[id].classList.remove("is-movable"); });
    }

    function onTokenClick(tokenId) {
        if (!tokenEls[tokenId].classList.contains("is-movable")) { return; }
        var token = state.tokens[tokenId];
        var kind = token.zone === "lager" ? "enter" : "move";
        executeAction({ tokenId: tokenId, kind: kind });
    }

    /* =====================================================
       ZUG AUSFÜHREN
       ===================================================== */

    function executeAction(action) {
        clearHighlights();
        if (action.kind === "enter") {
            var outcome = E.enterToken(state, action.tokenId);
            finishAction(action.tokenId, outcome);
        } else {
            attemptMove(action.tokenId, state.diceValue, {});
        }
    }

    function attemptMove(tokenId, steps, forkChoiceMap) {
        var outcome = E.moveToken(state, tokenId, steps, forkChoiceMap);
        if (outcome.needsForkChoice) {
            var token = state.tokens[tokenId];
            var player = state.players[token.playerId];
            if (player.type === "ai") {
                forkChoiceMap[outcome.needsForkChoice] = AI.chooseForkChoice();
                attemptMove(tokenId, steps, forkChoiceMap);
            } else {
                showForkPrompt(function (choice) {
                    forkChoiceMap[outcome.needsForkChoice] = choice;
                    attemptMove(tokenId, steps, forkChoiceMap);
                });
            }
            return;
        }
        finishAction(tokenId, outcome);
    }

    function showForkPrompt(onChoice) {
        els.forkModal.hidden = false;
        pendingForkResolve = onChoice;
    }

    function wireForkModal() {
        document.getElementById("jagd-fork-main").addEventListener("click", function () {
            els.forkModal.hidden = true;
            var cb = pendingForkResolve; pendingForkResolve = null;
            if (cb) { cb("main"); }
        });
        document.getElementById("jagd-fork-short").addEventListener("click", function () {
            els.forkModal.hidden = true;
            var cb = pendingForkResolve; pendingForkResolve = null;
            if (cb) { cb("shortcut"); }
        });
    }

    function finishAction(tokenId, outcome) {
        var token = state.tokens[tokenId];
        var tokenEl = tokenEls[tokenId];
        var path = outcome.path || [];

        if (!path.length) { afterMoveAnimation(tokenId, outcome); return; }

        var startRect = tokenEl.getBoundingClientRect();
        var boardRect = els.board.getBoundingClientRect();
        els.board.appendChild(tokenEl);
        tokenEl.style.position = "absolute";
        tokenEl.style.left = (startRect.left - boardRect.left) + "px";
        tokenEl.style.top = (startRect.top - boardRect.top) + "px";
        void tokenEl.offsetWidth; // Reflow erzwingen, damit die Startposition greift

        var i = 0;
        function step() {
            if (i >= path.length) { afterMoveAnimation(tokenId, outcome); return; }
            var s = path[i];
            var cellEl = s.zone === "ring" ? els.ringCells[s.globalId]
                : s.zone === "shortcut" ? els.shortcutCells[s.id]
                    : els.homeSlots[token.playerId][s.idx];
            positionTokenAt(tokenEl, cellEl);
            if (window.JagdSound) { window.JagdSound.move(); }
            i++;
            setTimeout(step, 190);
        }
        step();
    }

    function afterMoveAnimation(tokenId, outcome) {
        renderAllTokens();
        if (outcome.captured && outcome.captured.length && window.JagdSound) {
            window.JagdSound.capture();
        }
        (outcome.log || []).forEach(addLog);
        if (outcome.event) {
            showEventCard(outcome.event, tokenId);
        } else {
            proceedAfterAction(tokenId);
        }
    }

    /* =====================================================
       EREIGNISKARTEN
       ===================================================== */

    function showEventCard(eventId, tokenId) {
        var ev = D.getEvent(eventId);
        els.eventModal.hidden = false;
        var iconWrap = els.eventModal.querySelector(".jagd-event-icon");
        var iconFile = D.ASSETS.actionIcons[ev.id];
        iconWrap.innerHTML = iconFile
            ? '<img src="' + iconFile + '" alt="">'
            : ev.icon;
        els.eventModal.querySelector(".jagd-event-name").textContent = ev.name;
        els.eventModal.querySelector(".jagd-event-text").textContent = ev.text;

        var shieldPicker = els.eventModal.querySelector("#jagd-shield-picker");
        shieldPicker.innerHTML = "";
        shieldPicker.hidden = eventId !== "schutzschild";

        var confirmBtn = document.getElementById("jagd-event-confirm");
        confirmBtn.hidden = eventId === "schutzschild";

        function finish() {
            var log = E.applyEvent(state, eventId, tokenId);
            log.forEach(addLog);
            renderAllTokens();
            els.eventModal.hidden = true;
            proceedAfterAction(tokenId);
        }

        if (eventId === "schutzschild") {
            var token = state.tokens[tokenId];
            var player = state.players[token.playerId];
            if (player.type === "ai") {
                var target = AI.chooseShieldTarget(state, player.id);
                if (target) { E.applyShield(state, target); addLog(player.name + " schützt eine Figur."); }
                renderAllTokens();
                els.eventModal.hidden = true;
                proceedAfterAction(tokenId);
                return;
            }
            var mine = E.allTokensOf(state, player.id).filter(function (t) { return t.zone === "ring"; });
            if (!mine.length) {
                addLog("Keine Figur zum Schützen auf dem Feld.");
                els.eventModal.hidden = true;
                proceedAfterAction(tokenId);
                return;
            }
            mine.forEach(function (t, i) {
                var btn = document.createElement("button");
                btn.className = "yj-button";
                btn.className = "yj-button jagd-shield-option";
                btn.innerHTML = '<span class="jagd-shield-token jagd-token--' + player.color + '" data-number="' + (t.tokenIndex + 1) + '"></span>' +
                    '<span>Figur ' + (t.tokenIndex + 1) + ' schützen</span>';
                btn.addEventListener("click", function () {
                    E.applyShield(state, t.id);
                    addLog(player.name + " schützt Figur " + (t.tokenIndex + 1) + ".");
                    renderAllTokens();
                    els.eventModal.hidden = true;
                    proceedAfterAction(tokenId);
                });
                shieldPicker.appendChild(btn);
            });
            return;
        }

        confirmBtn.onclick = finish;
    }

    /* =====================================================
       ZUGENDE / SIEG
       ===================================================== */

    function proceedAfterAction(tokenId) {
        var playerId = state.tokens[tokenId].playerId;
        if (E.checkWin(state, playerId)) {
            state.winnerId = playerId;
            showWinScreen(playerId);
            return;
        }
        advanceAfterMove(state.diceValue === 6);
    }

    function advanceAfterMove(rerollAllowed) {
        if (rerollAllowed) {
            state.rolledThisTurn = false; state.diceValue = null;
            rerollReady = true;
        } else if (state.bonusMovePending) {
            state.bonusMovePending = false;
            state.rolledThisTurn = false; state.diceValue = null;
            rerollReady = false;
        } else {
            rerollReady = false;
            E.endTurn(state);
            renderAllTokens();
        }
        renderTurnUI();
    }

    function aiTakeTurn() {
        if (state.winnerId !== null) { return; }
        var player = E.currentPlayer(state);
        if (player.type !== "ai" || state.rolledThisTurn) { return; }
        var result = E.rollDice();
        animateDice(result, function () { afterRoll(result); });
    }

    function showWinScreen(playerId) {
        if (window.JagdSound) { window.JagdSound.win(); }
        var player = state.players[playerId];
        els.winModal.hidden = false;
        els.winModal.querySelector(".jagd-win-text").textContent =
            (player.type === "ai" ? "🤖 " : "🏆 ") + player.name + " hat alle " + player.tokenIds.length + " Figuren im Ziel!";
        addLog(player.name + " gewinnt die Partie!");
    }

})();
