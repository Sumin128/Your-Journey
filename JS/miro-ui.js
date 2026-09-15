(function () {
    "use strict";

    var D = window.MiroData;
    var E = window.MiroEngine;
    var AI = window.MiroAI;
    var state = null;
    var aiTimer = null;
    var aiScanTimer = null;
    var actionTimer = null;
    var actionAnimating = false;
    var tradeDraft = null;
    var lastTurnId = null;
    var selectedCardId = null;
    var selectedOwnerId = null;
    var humanTurnLocked = false;
    var humanTurnTimer = null;
    // Startwürfeln: jeder Spieler würfelt einmal, höchste Zahl beginnt,
    // bei Gleichstand würfeln nur die Betroffenen erneut (siehe
    // runStartDiceTurn()/resolveStartDiceRound()). Ersetzt den früheren
    // Münzwurf vollständig.
    var startDiceContenders = [];   // Spieler-IDs, die in DIESER (Wieder-)Runde noch würfeln müssen
    var startDiceResults = {};      // Spieler-ID -> Wert nur für die aktuelle Runde (Gleichstandsprüfung)
    var startDiceAllResults = {};   // Spieler-ID -> letzter gewürfelter Wert, bleibt auch nach Ausscheiden sichtbar
    var startDicePendingHumanId = null;
    var els = {};

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        ["setup", "game", "start", "turn", "direction", "direction-ring", "color", "opponents", "effect", "fx", "draw", "deck-count", "discard", "hand", "hand-count", "pass", "choice", "choice-title", "choice-text", "choice-options", "rules", "rules-modal", "rules-close", "win", "win-title", "startdice", "startdice-hint", "startdice-players", "startdice-btn", "startdice-face"].forEach(function (name) {
            els[toCamel(name)] = document.getElementById("miro-" + name);
        });
        els.start.addEventListener("click", startGame);
        els.startdiceBtn.addEventListener("click", onStartDiceTap);
        els.draw.addEventListener("click", onDraw);
        var winAgain = document.getElementById("miro-win-again");
        if (winAgain) { winAgain.addEventListener("click", backToSetup); }
        var leaveSetup = document.getElementById("miro-leave-setup");
        if (leaveSetup) {
            leaveSetup.addEventListener("click", function (e) {
                e.preventDefault();
                if (window.BranosSpielhalle) { window.BranosSpielhalle.leaveGame(); }
            });
        }
        var leaveGame = document.getElementById("miro-leave");
        if (leaveGame) {
            leaveGame.addEventListener("click", function () {
                if (window.BranosSpielhalle) { window.BranosSpielhalle.leaveGame(); }
                else { backToSetup(); }
            });
        }
        els.pass.addEventListener("click", onPass);
        els.rules.addEventListener("click", function () { els.rulesModal.hidden = false; });
        els.rulesClose.addEventListener("click", function () { els.rulesModal.hidden = true; });
        els.discard.addEventListener("dragover", function (event) { event.preventDefault(); });
        els.discard.addEventListener("drop", function (event) {
            event.preventDefault();
            var id = event.dataTransfer.getData("text/miro-card");
            if (id) { onCard(id); }
        });
    }

    function toCamel(value) { return value.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }

    function configsForMode() {
        var configs = [{ type: "human", name: "Du" }];
        var aiNames = ["Miro-Magier", "Nebel-Hexe", "Runen-Hüter"];
        [2, 3, 4].forEach(function (slot, index) {
            var type = document.getElementById("miro-player-" + slot).value;
            if (type !== "off") {
                configs.push({ type: type, name: type === "ai" ? aiNames[index] : "Spieler " + slot });
            }
        });
        return configs;
    }

    // Zurück zur Spieler-Auswahl, ohne die Seite neu zu laden (wichtig,
    // weil Miro eingebettet in Branos Spielhalle läuft).
    function backToSetup() {
        clearTimeout(aiTimer);
        clearInterval(aiScanTimer);
        clearTimeout(humanTurnTimer);
        clearTimeout(actionTimer);
        state = null;
        els.win.hidden = true;
        els.game.hidden = true;
        els.game.classList.remove("is-coin-complete");
        els.setup.hidden = false;
    }

    function startGame() {
        clearTimeout(aiTimer);
        clearInterval(aiScanTimer);
        clearTimeout(humanTurnTimer);
        clearTimeout(actionTimer);
        selectedCardId = null;
        selectedOwnerId = null;
        humanTurnLocked = false;
        actionAnimating = false;
        state = E.createGame(configsForMode(), { seed: Date.now() });
        els.setup.hidden = true;
        els.game.hidden = false;
        els.startdice.hidden = false;
        render();
        beginStartDice();
    }

    /* =====================================================
       STARTWÜRFELN (ersetzt den früheren Münzwurf)
       Jeder Spieler würfelt einmal, die höchste Zahl beginnt. Bei
       Gleichstand würfeln nur die betroffenen Spieler erneut. Nutzt
       denselben 3D-Würfel/dieselbe Würfellogik wie Mirelons Jagd
       (JS/jagd-dice-3d.mjs, hier über JS/miro-startdice-3d.mjs).
       ===================================================== */

    function beginStartDice() {
        startDiceContenders = state.players.map(function (p) { return p.id; });
        startDiceResults = {};
        startDiceAllResults = {};
        renderStartDicePlayers();
        runStartDiceTurn();
    }

    function renderStartDicePlayers() {
        els.startdicePlayers.innerHTML = "";
        state.players.forEach(function (player) {
            var stillIn = startDiceContenders.indexOf(player.id) !== -1;
            var chip = document.createElement("div");
            chip.className = "miro-startdice-chip" +
                (!stillIn ? " is-out" : "") +
                (stillIn && startDicePendingHumanId === player.id ? " is-active" : "");
            // Der zuletzt gewürfelte Wert bleibt sichtbar, auch wenn der
            // Spieler bei einem Gleichstand-Rewurf nicht mehr mitwürfelt.
            var value = startDiceAllResults[player.id];
            chip.innerHTML = "<strong>" + (player.type === "ai" ? "🤖 " : "🧑 ") + escapeHtml(player.name) + "</strong>" +
                "<span>" + (typeof value === "number" ? value : "…") + "</span>";
            els.startdicePlayers.appendChild(chip);
        });
    }

    function runStartDiceTurn() {
        var nextId = startDiceContenders.filter(function (id) { return startDiceResults[id] === undefined; })[0];
        if (nextId === undefined) { resolveStartDiceRound(); return; }
        var player = state.players[nextId];
        renderStartDicePlayers();
        if (player.type === "ai") {
            els.startdiceHint.textContent = player.name + " würfelt …";
            els.startdiceBtn.disabled = true;
            setTimeout(function () {
                playStartDiceRoll(nextId, 1 + Math.floor(Math.random() * 6), runStartDiceTurn);
            }, 700 + Math.random() * 500);
        } else {
            els.startdiceHint.textContent = escapeHtml(player.name) + ", tippe den Würfel!";
            els.startdiceBtn.disabled = false;
            startDicePendingHumanId = nextId;
        }
    }

    function onStartDiceTap() {
        if (startDicePendingHumanId === null) { return; }
        var id = startDicePendingHumanId;
        startDicePendingHumanId = null;
        els.startdiceBtn.disabled = true;
        playStartDiceRoll(id, 1 + Math.floor(Math.random() * 6), runStartDiceTurn);
    }

    function playStartDiceRoll(playerId, value, done) {
        startDiceResults[playerId] = value;
        startDiceAllResults[playerId] = value;
        if (window.JagdSound) { window.JagdSound.roll(); }
        if (window.MiroStartDice3D) { window.MiroStartDice3D.roll(value); }
        else { els.startdiceFace.textContent = String(value); }
        renderStartDicePlayers();
        setTimeout(done, 900);
    }

    function resolveStartDiceRound() {
        var best = Math.max.apply(null, startDiceContenders.map(function (id) { return startDiceResults[id]; }));
        var tied = startDiceContenders.filter(function (id) { return startDiceResults[id] === best; });
        if (tied.length > 1) {
            els.startdiceHint.textContent = "Gleichstand bei " + best + "! " +
                tied.map(function (id) { return state.players[id].name; }).join(" & ") + " würfeln erneut.";
            startDiceContenders = tied;
            startDiceResults = {};
            setTimeout(runStartDiceTurn, 1400);
            return;
        }
        var starterId = tied[0];
        els.startdiceHint.textContent = "✨ " + state.players[starterId].name + " wurde gewählt und beginnt!";
        setTimeout(function () {
            E.startFromCoin(state, starterId);
            render();
            emitState("initiative");
            els.startdice.hidden = true;
            els.game.classList.add("is-coin-complete");
            scheduleAI();
        }, 1200);
    }

    function onDraw() {
        if (!canHumanAct()) { return; }
        try {
            var travelTime = animateDrawToPlayer(state.currentPlayerId, 1);
            E.drawForTurn(state, state.currentPlayerId);
            afterAction("draw", travelTime);
        }
        catch (error) { showError(error); }
    }

    function onPass() {
        if (!canHumanAct()) { return; }
        try {
            if (state.phase === "chain") { E.finishChain(state, state.currentPlayerId); }
            else { return; }
            afterAction("pass");
        } catch (error) { showError(error); }
    }

    function onCard(cardId) {
        if (!canHumanAct()) { return; }
        try {
            var playedCard = state.players[state.currentPlayerId].hand.filter(function (card) { return card.id === cardId; })[0];
            animatePlayedCard(cardId);
            var settleTime = animateCardDrawEffects(state.currentPlayerId, playedCard);
            E.playCard(state, state.currentPlayerId, cardId);
            afterAction("play", settleTime);
        } catch (error) { showError(error); }
    }

    function afterAction(type, settleTime) {
        clearTimeout(actionTimer);
        actionAnimating = Boolean(settleTime);
        els.game.classList.toggle("is-action-settling", actionAnimating);
        selectedCardId = null;
        selectedOwnerId = null;
        closeChoice();
        render(type);
        if (type === "play") { showActionFx(E.topCard(state)); }
        emitState(type);
        if (actionAnimating) {
            actionTimer = setTimeout(function () {
                actionAnimating = false;
                els.game.classList.remove("is-action-settling");
                render();
                continueAfterAction();
            }, settleTime);
            return;
        }
        continueAfterAction();
    }

    function continueAfterAction() {
        if (state.winnerId !== null) { showWinner(); return; }
        var actor = state.currentPlayerId === null ? null : state.players[state.currentPlayerId];
        // Offene Aktionsphasen der KI werden von derselben Engine automatisch
        // aufgelöst. Nur menschliche Spieler sehen das Auswahlfenster.
        if (actor && actor.type === "ai") { scheduleAI(); return; }
        if (state.phase === "choose-color") { showColorChoice(); return; }
        if (state.phase === "trade") { showTradeTarget(); return; }
        if (state.phase === "treasure") { showTreasureChoice(); return; }
        scheduleAI();
    }

    function render(actionType) {
        if (!state) { return; }
        var current = state.currentPlayerId === null ? null : state.players[state.currentPlayerId];
        var turnChanged = Boolean(current && current.id !== lastTurnId && state.phase !== "coin");
        if (lastTurnId !== null && turnChanged) { pulseTurn(); }
        if (turnChanged) { beginHumanTurnPause(current); }
        lastTurnId = current ? current.id : null;
        els.turn.textContent = current ? (current.type === "ai" ? "🤖 " : "🧑 ") + current.name + " ist dran" : "Startwürfeln";
        els.direction.textContent = state.direction === 1 ? "↻" : "↺";
        els.direction.classList.toggle("is-reverse", state.direction === -1);
        els.directionRing.classList.toggle("is-reverse", state.direction === -1);
        var color = D.COLORS[state.activeColor];
        els.color.textContent = color ? color.icon + " " + color.short : "–";
        els.color.style.background = color ? color.hex : "#777";
        els.deckCount.textContent = state.drawPile.length;
        els.draw.disabled = !current || current.type !== "human" || state.phase !== "play" || humanTurnLocked || actionAnimating;
        els.draw.style.setProperty("--deck-depth", Math.min(9, Math.ceil(state.drawPile.length / 12)) + "px");
        els.pass.hidden = !(current && current.type === "human" && state.phase === "chain");
        els.pass.textContent = "Zauberkette beenden";
        renderOpponents();
        renderDiscard(actionType === "play");
        renderHand();
        var seatedPlayer = viewPlayer();
        document.querySelector(".miro-player-area").classList.toggle("is-current", Boolean(seatedPlayer && seatedPlayer.id === state.currentPlayerId));
        els.effect.textContent = effectText();
    }

    function effectText() {
        if (state.phase === "coin") { return "Der Würfel entscheidet …"; }
        if (state.phase === "chain") { return "✨ Zauberkette! Du darfst eine weitere Zahlenkarte legen."; }
        if (state.phase === "trade") { return "🔀 Wähle Tauschpartner, Abgabekarte und neue Farbe."; }
        if (state.phase === "treasure") { return "💎 Wähle einen der beiden Schätze."; }
        return state.log[0] || "Lege eine passende Karte oder ziehe eine neue.";
    }

    function renderOpponents() {
        els.opponents.innerHTML = "";
        var visibleCount = 0;
        var seatedPlayer = viewPlayer();
        state.players.forEach(function (player) {
            if (seatedPlayer && player.id === seatedPlayer.id) { return; }
            visibleCount++;
            var wrap = document.createElement("div");
            wrap.className = "miro-opponent" + (player.id === state.currentPlayerId ? " is-current" : "");
            wrap.dataset.playerId = player.id;
            var hand = document.createElement("div");
            hand.className = "miro-opponent-hand";
            player.hand.forEach(function (_, i) {
                var card = document.createElement("span"); card.className = "miro-mini-card";
                card.style.setProperty("--i", i); card.style.setProperty("--mid", (player.hand.length - 1) / 2);
                hand.appendChild(card);
            });
            wrap.appendChild(hand);
            var label = document.createElement("strong"); label.textContent = player.name + " · " + player.hand.length + " Karten";
            wrap.appendChild(label); els.opponents.appendChild(wrap);
        });
        els.opponents.dataset.count = visibleCount;
    }

    function renderDiscard(animate) {
        els.discard.innerHTML = "";
        state.discardPile.slice(-2).forEach(function (card, i, arr) {
            var node = cardNode(card, false);
            if (animate && i === arr.length - 1) { node.classList.add("is-new"); }
            els.discard.appendChild(node);
        });
    }

    function renderHand() {
        els.hand.innerHTML = "";
        var player = viewPlayer();
        if (!player || player.type !== "human") { els.handCount.textContent = ""; return; }
        if (selectedOwnerId !== player.id) { selectedCardId = null; selectedOwnerId = player.id; }
        els.handCount.textContent = player.hand.length + " Karten";
        var playable = {};
        if (player.id === state.currentPlayerId) {
            E.playableCards(state, player.id).forEach(function (card) { playable[card.id] = true; });
        }
        player.hand.forEach(function (card, i) {
            var allowed = Boolean(playable[card.id]);
            var node = cardNode(card, true);
            node.style.setProperty("--i", i);
            node.style.setProperty("--mid", (player.hand.length - 1) / 2);
            node.style.setProperty("--fan-drop", Math.abs(i - (player.hand.length - 1) / 2) * 2 + "px");
            if (allowed) {
                node.classList.add("is-playable");
                node.title = "Spielbar: " + E.playReason(state, card);
                if (selectedCardId === card.id) {
                    node.classList.add("is-selected");
                    node.setAttribute("aria-pressed", "true");
                    node.title += " – noch einmal drücken zum Ablegen";
                } else {
                    node.setAttribute("aria-pressed", "false");
                }
                node.addEventListener("click", function () { selectOrPlayCard(card); });
            } else {
                var unavailableText = card.action === "trade" && player.hand.length < 2
                    ? "Kartentausch kann nicht als letzte Karte gespielt werden, weil du danach noch eine Karte abgeben musst."
                    : "Diese Karte passt weder zur aktiven Farbe noch zu Zahl oder Symbol.";
                node.title = "Nicht spielbar: " + unavailableText;
                node.addEventListener("click", function () {
                    node.classList.remove("is-rejected");
                    void node.offsetWidth;
                    node.classList.add("is-rejected");
                    showError(new Error(unavailableText));
                });
            }
            els.hand.appendChild(node);
        });
    }

    function selectOrPlayCard(card) {
        if (!canHumanAct()) { return; }
        if (selectedCardId === card.id) {
            selectedCardId = null;
            onCard(card.id);
            return;
        }
        selectedCardId = card.id;
        selectedOwnerId = state.currentPlayerId;
        els.effect.textContent = E.cardName(card) + " ausgewählt – noch einmal drücken zum Ablegen.";
        renderHand();
    }

    function beginHumanTurnPause(player) {
        clearTimeout(humanTurnTimer);
        humanTurnLocked = player.type === "human";
        els.game.classList.toggle("is-turn-waiting", humanTurnLocked);
        if (!humanTurnLocked) { return; }
        humanTurnTimer = setTimeout(function () {
            humanTurnLocked = false;
            els.game.classList.remove("is-turn-waiting");
            if (state && state.currentPlayerId === player.id) {
                els.draw.disabled = state.phase !== "play";
            }
        }, 650);
    }

    function viewPlayer() {
        if (!state) { return null; }
        var current = state.currentPlayerId === null ? null : state.players[state.currentPlayerId];
        if (current && current.type === "human") { return current; }
        return state.players.filter(function (player) { return player.type === "human"; })[0] || null;
    }

    function cardNode(card, interactive) {
        var node = document.createElement(interactive ? "button" : "div");
        if (interactive) { node.type = "button"; }
        var color = card.color && D.COLORS[card.color];
        node.className = "miro-card" + (card.kind === "wild" ? " miro-card--wild" : "");
        node.dataset.cardId = card.id;
        node.style.setProperty("--card-color", color ? color.hex : "#57456c");
        var corner = card.kind === "number" ? card.value : symbolFor(card);
        var center = card.kind === "number"
            ? "<strong>" + card.value + "</strong>"
            : '<img src="' + D.ACTIONS[card.action].icon + '" alt="">';
        node.innerHTML = '<span class="miro-card-corner">' + corner + '</span><span class="miro-card-corner miro-card-corner--bottom">' + corner + '</span><span class="miro-card-center">' + center + '</span><span class="miro-card-label">' + escapeHtml(E.cardName(card)) + "</span>";
        node.setAttribute("aria-label", E.cardName(card));
        return node;
    }

    function animatePlayedCard(cardId) {
        var source = els.hand.querySelector('[data-card-id="' + cardId + '"]');
        if (source) { flyClone(source, els.discard, "miro-flight-card"); }
    }

    function animateDrawToPlayer(playerId, count) {
        var seatedPlayer = viewPlayer();
        var target = seatedPlayer && seatedPlayer.id === playerId
            ? els.hand
            : els.opponents.querySelector('[data-player-id="' + playerId + '"]');
        if (!target) { return 0; }
        var sourceRect = els.draw.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var travelTime = reducedMotion ? 20 : 760;
        var cardGap = reducedMotion ? 20 : 500;
        for (var i = 0; i < count; i++) {
            (function (index) {
                var clone = document.createElement("div");
                clone.className = "miro-draw-flight";
                clone.style.backgroundImage = 'url("' + D.cardBack + '")';
                clone.style.transitionDelay = (index * cardGap) + "ms";
                positionFlight(clone, sourceRect);
                document.body.appendChild(clone);
                requestAnimationFrame(function () {
                    clone.style.left = (targetRect.left + targetRect.width / 2 - clone.offsetWidth / 2 + index * 5) + "px";
                    clone.style.top = (targetRect.top + targetRect.height / 2 - clone.offsetHeight / 2 + index * 3) + "px";
                    clone.style.transform = "rotate(" + (-10 + index * 10) + "deg) scale(.62)";
                    clone.style.opacity = ".15";
                });
                setTimeout(function () { clone.remove(); }, travelTime + 100 + index * cardGap);
            })(i);
        }
        return travelTime + Math.max(0, count - 1) * cardGap;
    }

    function animateCardDrawEffects(actorId, card) {
        if (!card || !card.action) { return 0; }
        if (card.action === "draw2" || card.action === "draw3") {
            return animateDrawToPlayer(E.nextPlayerId(state, actorId, 1), card.action === "draw2" ? 2 : 3);
        } else if (card.action === "treasure") {
            return animateDrawToPlayer(actorId, 2);
        }
        return 0;
    }

    function flyClone(source, target, className) {
        var clone = source.cloneNode(true);
        clone.className += " " + className;
        clone.setAttribute("aria-hidden", "true");
        clone.setAttribute("tabindex", "-1");
        positionFlight(clone, source.getBoundingClientRect());
        document.body.appendChild(clone);
        requestAnimationFrame(function () {
            var rect = target.getBoundingClientRect();
            clone.style.left = (rect.left + rect.width / 2 - clone.offsetWidth / 2) + "px";
            clone.style.top = (rect.top + rect.height / 2 - clone.offsetHeight / 2) + "px";
            clone.style.transform = "rotate(8deg) scale(.78)";
            clone.style.opacity = ".25";
        });
        setTimeout(function () { clone.remove(); }, 820);
    }

    function positionFlight(node, rect) {
        node.style.left = rect.left + "px";
        node.style.top = rect.top + "px";
        node.style.width = rect.width + "px";
        node.style.height = rect.height + "px";
    }

    function pulseTurn() {
        var hud = els.turn.closest(".miro-hud");
        hud.classList.remove("is-turn-change");
        void hud.offsetWidth;
        hud.classList.add("is-turn-change");
    }

    function showActionFx(card) {
        if (!card || !card.action) { return; }
        els.fx.innerHTML = '<img src="' + D.ACTIONS[card.action].icon + '" alt="">';
        els.fx.classList.remove("is-active");
        void els.fx.offsetWidth;
        els.fx.classList.add("is-active");
    }

    function symbolFor(card) {
        return { draw2: "+2", draw3: "+3", skip: "⏸", reverse: "↺", treasure: "💎", fog: "☁", wish: "✦", trade: "⇄" }[card.action] || "✦";
    }

    function showColorChoice(onChosen) {
        openChoice("Farbe wünschen", "Welche Farbe gilt als Nächstes?");
        Object.keys(D.COLORS).forEach(function (key) {
            var button = document.createElement("button");
            button.textContent = D.COLORS[key].icon + " " + D.COLORS[key].name;
            button.style.borderColor = D.COLORS[key].hex;
            button.addEventListener("click", function () {
                if (onChosen) { onChosen(key); return; }
                try { E.chooseColor(state, state.currentPlayerId, key); afterAction("color"); } catch (error) { showError(error); }
            });
            els.choiceOptions.appendChild(button);
        });
    }

    function showTradeTarget() {
        tradeDraft = {};
        openChoice("Kartentausch", "Von wem möchtest du eine zufällige Karte erhalten?");
        state.players.filter(function (p) { return p.id !== state.currentPlayerId && p.hand.length; }).forEach(function (player) {
            var button = document.createElement("button");
            button.textContent = player.name + " · " + player.hand.length + " Karten";
            button.addEventListener("click", function () { tradeDraft.targetId = player.id; showTradeGive(); });
            els.choiceOptions.appendChild(button);
        });
    }

    function showTradeGive() {
        openChoice("Eine Karte abgeben", "Diese Karte erhält dein Tauschpartner.");
        state.players[state.currentPlayerId].hand.forEach(function (card) {
            var node = cardNode(card, true);
            node.classList.add("is-playable");
            node.addEventListener("click", function () {
                tradeDraft.giveCardId = card.id;
                showColorChoice(function (color) {
                    try { E.resolveTrade(state, state.currentPlayerId, tradeDraft.targetId, tradeDraft.giveCardId, color); tradeDraft = null; afterAction("trade"); }
                    catch (error) { showError(error); }
                });
            });
            els.choiceOptions.appendChild(node);
        });
    }

    function showTreasureChoice() {
        openChoice("Schatzfund", "Welche Karte möchtest du behalten?");
        state.pending.cards.forEach(function (card) {
            var node = cardNode(card, true); node.classList.add("is-playable");
            node.addEventListener("click", function () {
                try { E.resolveTreasure(state, state.currentPlayerId, card.id); afterAction("treasure"); }
                catch (error) { showError(error); }
            });
            els.choiceOptions.appendChild(node);
        });
    }

    function openChoice(title, text) {
        els.choiceTitle.textContent = title; els.choiceText.textContent = text; els.choiceOptions.innerHTML = ""; els.choice.hidden = false;
    }
    function closeChoice() { els.choice.hidden = true; els.choiceOptions.innerHTML = ""; }

    function scheduleAI() {
        clearTimeout(aiTimer);
        stopAIThinking();
        var player = state && state.currentPlayerId !== null && state.players[state.currentPlayerId];
        if (!player || player.type !== "ai" || state.winnerId !== null) { return; }
        var considersCards = state.phase === "play" || state.phase === "chain";
        if (considersCards) { startAIThinking(player); }
        var delay = considersCards ? Math.min(3400, 1750 + player.hand.length * 140) : 900;
        aiTimer = setTimeout(runAI, delay);
    }

    function runAI() {
        stopAIThinking();
        var actorId = state.currentPlayerId;
        var choice = AI.takeTurn(state);
        var settleTime = 0;
        try {
            if (choice.type === "play") {
                var aiCard = state.players[actorId].hand.filter(function (card) { return card.id === choice.cardId; })[0];
                settleTime = animateCardDrawEffects(actorId, aiCard);
                E.playCard(state, actorId, choice.cardId);
            }
            else if (choice.type === "draw") { settleTime = animateDrawToPlayer(actorId, 1); E.drawForTurn(state, actorId); }
            else if (choice.type === "end-chain") { E.finishChain(state, actorId); }
            else if (choice.type === "color") { E.chooseColor(state, actorId, choice.color); }
            else if (choice.type === "trade") { E.resolveTrade(state, actorId, choice.targetId, choice.giveCardId, choice.color); }
            else if (choice.type === "treasure") { E.resolveTreasure(state, actorId, choice.keepCardId); }
            afterAction(choice.type, settleTime);
        } catch (error) { showError(error); }
    }

    function startAIThinking(player) {
        var wrap = els.opponents.querySelector('[data-player-id="' + player.id + '"]');
        if (!wrap) { return; }
        wrap.classList.add("is-thinking");
        var cards = Array.prototype.slice.call(wrap.querySelectorAll(".miro-mini-card"));
        var index = -1;
        function advance() {
            cards.forEach(function (card) { card.classList.remove("is-considering"); });
            if (!cards.length) { return; }
            index = (index + 1) % cards.length;
            cards[index].classList.add("is-considering");
        }
        advance();
        aiScanTimer = setInterval(advance, 430);
    }

    function stopAIThinking() {
        clearInterval(aiScanTimer);
        aiScanTimer = null;
        els.opponents.querySelectorAll(".is-thinking,.is-considering").forEach(function (node) {
            node.classList.remove("is-thinking", "is-considering");
        });
    }

    function canHumanAct() {
        return state && state.currentPlayerId !== null && state.players[state.currentPlayerId].type === "human" && state.winnerId === null && !humanTurnLocked && !actionAnimating;
    }

    function showWinner() {
        var winner = state.players[state.winnerId];
        els.winTitle.textContent = winner.name === "Du" ? "Du gewinnst Miro!" : winner.name + " gewinnt Miro!";
        els.win.hidden = false;
    }

    function showError(error) {
        els.effect.textContent = "⚠️ " + error.message;
        els.effect.classList.add("is-error");
        setTimeout(function () { els.effect.classList.remove("is-error"); }, 1200);
    }

    function emitState(reason) {
        document.dispatchEvent(new CustomEvent("miro:state", { detail: { reason: reason, revision: state.revision, snapshot: E.snapshot(state) } }));
    }

    function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[c]; }); }
})();
