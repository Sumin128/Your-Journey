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

    /* =====================================================
       ONLINE-MULTIPLAYER-HAKEN (siehe JS/miro-multiplayer-adapter.js)
       Lokal und gegen Computer bleibt alles wie bisher: window.MiroOnline
       existiert dann nicht bzw. .active ist false, isOnlineGuest() ist
       überall false, kein Verhaltensunterschied. Nur wenn eine Online-
       Partie läuft UND dieser Client nicht der Gastgeber ist, werden
       eigene Klicks nicht mehr direkt auf die Engine angewendet,
       sondern als Aktionswunsch an den Gastgeber geschickt.
       ===================================================== */
    function isOnlineGuest() {
        return Boolean(window.MiroOnline && window.MiroOnline.active && !window.MiroOnline.isHost());
    }
    function isOnlineActive() {
        return Boolean(window.MiroOnline && window.MiroOnline.active);
    }

    // Startwürfeln: jeder Spieler würfelt einmal, höchste Zahl beginnt,
    // bei Gleichstand würfeln nur die Betroffenen erneut (siehe
    // runStartDiceTurn()/resolveStartDiceRound()). Ersetzt den früheren
    // Münzwurf vollständig.
    // Startwürfel-Rundenfortschritt (Reihe, Gleichstand-Kandidaten,
    // bisherige Ergebnisse, wer gerade dran ist) lebt bewusst NICHT in
    // eigenen Modul-Variablen, sondern direkt auf state.coinProgress -
    // das macht ihn Teil des Zustands, der online über hostSync()/
    // load_room_state() gespeichert und nach einem Reconnect
    // fortgesetzt werden kann, statt bei jedem Beitritt neu
    // anzufangen (siehe startCoinPhaseState()). Nach Spielbeginn wird
    // das Feld wieder entfernt (siehe finishCoinPhase()).
    var startDiceWinnerId = null;   // kurz gesetzt für die Sieger-Hervorhebung - rein lokal/ephemer, kein Reconnect-Bedarf
    var els = {};

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        ["setup", "game", "start", "turn", "direction", "direction-ring", "color", "opponents", "effect", "fx", "draw", "deck-count", "discard", "hand", "hand-count", "hand-coin-badge", "pass", "choice", "choice-title", "choice-text", "choice-options", "rules", "rules-modal", "rules-close", "win", "win-title", "startdice", "startdice-hint", "startdice-btn", "startdice-face"].forEach(function (name) {
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

    function resetLocalUiState() {
        clearTimeout(aiTimer);
        clearInterval(aiScanTimer);
        clearTimeout(humanTurnTimer);
        clearTimeout(actionTimer);
        selectedCardId = null;
        selectedOwnerId = null;
        humanTurnLocked = false;
        actionAnimating = false;
    }

    function startGame() {
        resetLocalUiState();
        state = E.createGame(configsForMode(), { seed: Date.now() });
        els.setup.hidden = true;
        els.game.hidden = false;
        els.startdice.hidden = false;
        render();
        beginStartDice();
    }

    // Von JS/miro-multiplayer-adapter.js genutzt: der Gastgeber hat den
    // Anfangszustand bereits fertig erzeugt UND das Startwürfeln ist schon
    // vorbei (Beitritt mitten im Spiel) - keine lokale Würfel-Vorschaltung.
    function startWithState(initialState) {
        resetLocalUiState();
        state = initialState;
        els.setup.hidden = true;
        els.game.hidden = false;
        els.startdice.hidden = true;
        els.game.classList.add("is-coin-complete");
        render();
        scheduleAI();
    }

    // Von JS/miro-multiplayer-adapter.js genutzt: der Gastgeber hat einen
    // frischen Zustand (Phase "coin", Hände schon gemischt) erzeugt, oder
    // ein Gast tritt bei, während das Startwürfeln noch läuft. Beide
    // Fälle starten hier in die ganz normale, interaktive Würfelrunde -
    // online wie lokal läuft danach dieselbe Funktion (runStartDiceTurn()).
    function startCoinPhaseState(initialState) {
        resetLocalUiState();
        state = initialState;
        els.setup.hidden = true;
        els.game.hidden = false;
        els.startdice.hidden = false;
        els.game.classList.remove("is-coin-complete", "is-coin-leaving");
        startDiceWinnerId = null;
        // Läuft das Startwürfeln online schon (Gastgeber-Neustart nach
        // eigenem Reload, oder Beitritt mitten in der Runde), steht der
        // Fortschritt schon in state.coinProgress (siehe hostSync()) -
        // dann hier NICHT neu anfangen, sondern genau dort weitermachen.
        if (!state.coinProgress) { initCoinProgress(); }
        render();
        runStartDiceTurn();
    }

    function initCoinProgress() {
        state.coinProgress = {
            contenders: state.players.map(function (p) { return p.id; }),
            results: {},
            allResults: {},
            activeId: null
        };
    }

    /* =====================================================
       STARTWÜRFELN (ersetzt den früheren Münzwurf)
       Jeder Spieler würfelt einmal, die höchste Zahl beginnt. Bei
       Gleichstand würfeln nur die betroffenen Spieler erneut. Nutzt
       denselben 3D-Würfel/dieselbe Würfellogik wie Mirelons Jagd
       (JS/jagd-dice-3d.mjs, hier über JS/miro-startdice-3d.mjs).

       Der Würfel liegt direkt auf dem Tisch (keine Box mehr) - das
       Ergebnis jedes Spielers erscheint stattdessen neben seinem
       Namen (renderOpponents()/renderOwnCoinBadge()), der aktive
       Sitzplatz wird über dieselbe .is-current-Markierung wie im
       laufenden Spiel hervorgehoben.

       Online (siehe runStartDiceTurnOnline()/JS/miro-multiplayer-
       adapter.js): die Reihenfolge/Gleichstandslogik läuft weiterhin
       auf JEDEM Gerät identisch mit (rein deterministisch aus den
       bereits bekannten Würfelwerten), aber einen NEUEN Würfelwert
       erzeugt ausschließlich der Gastgeber (hostRollStartDiceForSeat)
       und verteilt ihn per Broadcast (applyStartDiceResult) - kein
       Client würfelt für einen fremden oder gar den eigenen Wurf
       selbst, wenn er nicht der Gastgeber ist.
       ===================================================== */

    function beginStartDice() {
        initCoinProgress();
        startDiceWinnerId = null;
        runStartDiceTurn();
    }

    function updateStartDiceUi() {
        var cp = state.coinProgress;
        var player = state.players[cp.activeId];
        var isMyTurn = player.type === "human" && (!isOnlineActive() || cp.activeId === window.MiroOnline.mySeat);
        if (player.type === "ai") { els.startdiceHint.textContent = player.name + " würfelt …"; }
        else if (isMyTurn) { els.startdiceHint.textContent = "Du bist dran – tippe auf den Würfel"; }
        else { els.startdiceHint.textContent = player.name + " ist an der Reihe …"; }
        els.startdiceBtn.disabled = !isMyTurn;
        renderOpponents();
        renderOwnCoinBadge();
    }

    function runStartDiceTurn() {
        var cp = state.coinProgress;
        var nextId = cp.contenders.filter(function (id) { return cp.results[id] === undefined; })[0];
        if (nextId === undefined) { resolveStartDiceRound(); return; }
        cp.activeId = nextId;
        updateStartDiceUi();
        if (isOnlineActive()) { runStartDiceTurnOnline(nextId, state.players[nextId]); return; }
        if (state.players[nextId].type === "ai") {
            els.startdiceBtn.disabled = true;
            setTimeout(function () {
                playStartDiceRoll(nextId, 1 + Math.floor(Math.random() * 6), runStartDiceTurn);
            }, 700 + Math.random() * 500);
        }
    }

    // Nur die Zug-Weiterleitung: wer gerade dran wäre, würfelt online
    // niemals selbst lokal (außer für den eigenen Sitzplatz, siehe
    // onStartDiceTap) - der Gastgeber ist die einzige Quelle neuer
    // Zufallswerte (KI-Würfe hier, entfernte Menschen über deren
    // Aktionswunsch "startdice_roll" in JS/miro-multiplayer-adapter.js).
    function runStartDiceTurnOnline(nextId, player) {
        if (nextId === window.MiroOnline.mySeat) { els.startdiceBtn.disabled = false; return; }
        els.startdiceBtn.disabled = true;
        if (!window.MiroOnline.isHost()) { return; }
        if (player.type === "ai") {
            setTimeout(function () { hostRollStartDiceForSeat(nextId); }, 700 + Math.random() * 500);
        }
    }

    function onStartDiceTap() {
        var cp = state.coinProgress;
        if (!cp || cp.activeId === null || els.startdiceBtn.disabled) { return; }
        if (isOnlineActive()) {
            if (cp.activeId !== window.MiroOnline.mySeat) { return; }
            els.startdiceBtn.disabled = true;
            if (window.MiroOnline.isHost()) { hostRollStartDiceForSeat(cp.activeId); }
            else { window.MiroOnline.requestAction({ type: "startdice_roll" }); }
            return;
        }
        if (state.players[cp.activeId].type !== "human") { return; }
        var id = cp.activeId;
        els.startdiceBtn.disabled = true;
        playStartDiceRoll(id, 1 + Math.floor(Math.random() * 6), runStartDiceTurn);
    }

    // Gastgeber-only: erzeugt EINMALIG den autoritativen Wert für einen
    // fälligen Wurf (eigener Sitzplatz oder KI), verteilt ihn an alle
    // übrigen Geräte und wendet ihn lokal genauso an wie ein Gast das
    // per applyStartDiceResult() tut - identischer Ablauf überall.
    function hostRollStartDiceForSeat(seat) {
        var cp = state.coinProgress;
        if (!cp || cp.activeId !== seat || cp.results[seat] !== undefined) { return; }
        var value = 1 + Math.floor(Math.random() * 6);
        if (window.MiroOnline.hostBroadcastStartDice) { window.MiroOnline.hostBroadcastStartDice(seat, value); }
        playStartDiceRoll(seat, value, runStartDiceTurn);
    }

    // Von JS/miro-multiplayer-adapter.js für JEDEN Client (Gastgeber
    // eingeschlossen, für sein eigenes Echo) beim Empfang eines
    // "startdice_result"-Broadcasts aufgerufen.
    function applyStartDiceResult(seat, value) {
        var cp = state && state.coinProgress;
        if (!state || state.phase !== "coin" || !cp || cp.activeId !== seat || cp.results[seat] !== undefined) { return; }
        playStartDiceRoll(seat, value, runStartDiceTurn);
    }

    function playStartDiceRoll(playerId, value, done) {
        var cp = state.coinProgress;
        cp.results[playerId] = value;
        cp.allResults[playerId] = value;
        if (window.JagdSound) { window.JagdSound.roll(); }
        if (window.MiroStartDice3D) { window.MiroStartDice3D.roll(value); }
        else { els.startdiceFace.textContent = String(value); }
        renderOpponents();
        renderOwnCoinBadge();
        // Online: der Gastgeber hält den Rundenfortschritt zusätzlich in
        // der Datenbank fest (state.coinProgress ist Teil des normal
        // gesyncten Zustands) - ein wiederverbundener Mitspieler setzt so
        // genau hier fort, statt bei allen Sitzplätzen neu anzufangen.
        if (isOnlineActive() && window.MiroOnline.isHost()) { window.MiroOnline.hostSync(); }
        setTimeout(done, 900);
    }

    function resolveStartDiceRound() {
        var cp = state.coinProgress;
        var best = Math.max.apply(null, cp.contenders.map(function (id) { return cp.results[id]; }));
        var tied = cp.contenders.filter(function (id) { return cp.results[id] === best; });
        cp.activeId = null;
        if (tied.length > 1) {
            els.startdiceHint.textContent = "Gleichstand bei " + best + "! " +
                tied.map(function (id) { return state.players[id].name; }).join(" & ") + " würfeln erneut.";
            cp.contenders = tied;
            cp.results = {};
            renderOpponents();
            renderOwnCoinBadge();
            if (isOnlineActive() && window.MiroOnline.isHost()) { window.MiroOnline.hostSync(); }
            setTimeout(runStartDiceTurn, 1400);
            return;
        }
        var starterId = tied[0];
        startDiceWinnerId = starterId;
        els.startdiceHint.textContent = "✨ " + state.players[starterId].name + " wurde gewählt und beginnt!";
        renderOpponents();
        renderOwnCoinBadge();
        // Online darf nur der Gastgeber die Engine weiterschalten - Gäste
        // warten auf die bestätigte state_update-Übertragung (siehe
        // applyConfirmedState() im Adapter), statt selbst die Phase zu
        // wechseln.
        if (isOnlineActive() && !window.MiroOnline.isHost()) { return; }
        setTimeout(function () {
            E.startFromCoin(state, starterId);
            finishCoinPhase();
        }, 1200);
    }

    // Reihenfolge laut Vorgabe: erst Würfel/Hinweis/Ergebnisse sanft
    // ausblenden - ERST DANACH rücken Zieh- und Ablagestapel in die
    // Tischmitte (über die bestehende .is-coin-complete-CSS-Transition).
    function finishCoinPhase() {
        els.game.classList.add("is-coin-leaving");
        setTimeout(function () {
            els.startdice.hidden = true;
            els.game.classList.remove("is-coin-leaving");
            // Temporäre Würfel-Rundendaten sind nach Spielbeginn nicht mehr
            // nötig - raus aus dem (ggf. persistierten) Zustand.
            delete state.coinProgress;
            startDiceWinnerId = null;
            render();
            emitState("initiative");
            els.game.classList.add("is-coin-complete");
            scheduleAI();
        }, 450);
    }

    function renderOwnCoinBadge() {
        if (!els.handCoinBadge) { return; }
        var seatedPlayer = viewPlayer();
        var cp = state && state.coinProgress;
        if (!state || state.phase !== "coin" || !cp || !seatedPlayer) { els.handCoinBadge.hidden = true; return; }
        var value = cp.allResults[seatedPlayer.id];
        els.handCoinBadge.hidden = false;
        els.handCoinBadge.className = "miro-coin-badge" +
            (typeof value !== "number" ? " is-pending" : "") +
            (startDiceWinnerId === seatedPlayer.id ? " is-winner" : "");
        els.handCoinBadge.textContent = typeof value === "number" ? "🎲 " + value : "…";
    }

    function onDraw() {
        if (!canHumanAct()) { return; }
        if (isOnlineGuest()) { window.MiroOnline.requestAction({ type: "draw" }); return; }
        try {
            var travelTime = animateDrawToPlayer(state.currentPlayerId, 1);
            E.drawForTurn(state, state.currentPlayerId);
            afterAction("draw", travelTime);
        }
        catch (error) { showError(error); }
    }

    function onPass() {
        if (!canHumanAct()) { return; }
        if (isOnlineGuest()) { window.MiroOnline.requestAction({ type: "pass" }); return; }
        try {
            if (state.phase === "chain") { E.finishChain(state, state.currentPlayerId); }
            else { return; }
            afterAction("pass");
        } catch (error) { showError(error); }
    }

    function onCard(cardId) {
        if (!canHumanAct()) { return; }
        if (isOnlineGuest()) { window.MiroOnline.requestAction({ type: "play", cardId: cardId }); return; }
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
        renderOwnCoinBadge();
        var seatedPlayer = viewPlayer();
        var activeId = state.phase === "coin" ? (state.coinProgress && state.coinProgress.activeId) : state.currentPlayerId;
        document.querySelector(".miro-player-area").classList.toggle("is-current", Boolean(seatedPlayer && seatedPlayer.id === activeId));
        els.effect.textContent = effectText();
    }

    function effectText() {
        // Während des Startwürfelns steht der spezifischere Hinweis schon
        // direkt über dem Würfel (siehe updateStartDiceUi) - keine zweite,
        // sich überlappende Statuszeile hier.
        if (state.phase === "coin") { return ""; }
        if (state.phase === "chain") { return "✨ Zauberkette! Du darfst eine weitere Zahlenkarte legen."; }
        if (state.phase === "trade") { return "🔀 Wähle Tauschpartner, Abgabekarte und neue Farbe."; }
        if (state.phase === "treasure") { return "💎 Wähle einen der beiden Schätze."; }
        return state.log[0] || "Lege eine passende Karte oder ziehe eine neue.";
    }

    function renderOpponents() {
        els.opponents.innerHTML = "";
        var visibleCount = 0;
        var seatedPlayer = viewPlayer();
        var cp = state.coinProgress;
        var activeId = state.phase === "coin" ? (cp && cp.activeId) : state.currentPlayerId;
        state.players.forEach(function (player) {
            if (seatedPlayer && player.id === seatedPlayer.id) { return; }
            visibleCount++;
            var wrap = document.createElement("div");
            wrap.className = "miro-opponent" + (player.id === activeId ? " is-current" : "");
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
            wrap.appendChild(label);
            if (state.phase === "coin" && cp) {
                var rollValue = cp.allResults[player.id];
                var badge = document.createElement("span");
                badge.className = "miro-coin-badge" +
                    (typeof rollValue !== "number" ? " is-pending" : "") +
                    (startDiceWinnerId === player.id ? " is-winner" : "");
                badge.textContent = typeof rollValue === "number" ? "🎲 " + rollValue : "…";
                wrap.appendChild(badge);
            }
            els.opponents.appendChild(wrap);
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
        // Online: jeder Browser zeigt IMMER den eigenen Sitzplatz unten -
        // anders als lokal (Hotseat) darf die Ansicht hier nicht auf den
        // gerade aktiven Spieler springen (das wäre fremde Handkarten).
        if (isOnlineActive() && typeof window.MiroOnline.mySeat === "number") {
            return state.players[window.MiroOnline.mySeat] || null;
        }
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
                if (isOnlineGuest()) { window.MiroOnline.requestAction({ type: "color", color: key }); return; }
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
                    if (isOnlineGuest()) {
                        window.MiroOnline.requestAction({ type: "trade", targetId: tradeDraft.targetId, giveCardId: tradeDraft.giveCardId, color: color });
                        tradeDraft = null;
                        return;
                    }
                    try {
                        E.resolveTrade(state, state.currentPlayerId, tradeDraft.targetId, tradeDraft.giveCardId, color);
                        tradeDraft = null; afterAction("trade");
                    }
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
                if (isOnlineGuest()) { window.MiroOnline.requestAction({ type: "treasure", keepCardId: card.id }); return; }
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
        // Online: nur der Gastgeber rechnet Computerzüge - alle anderen
        // warten auf dessen bestätigtes Ergebnis (siehe Adapter).
        if (isOnlineGuest()) { return; }
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
        if (!state || state.currentPlayerId === null || state.players[state.currentPlayerId].type !== "human" ||
            state.winnerId !== null || humanTurnLocked || actionAnimating) {
            return false;
        }
        // Online: ein Browser darf nur für seinen EIGENEN Sitzplatz
        // handeln, nie für den Zug eines anderen Menschen.
        if (isOnlineActive() && state.currentPlayerId !== window.MiroOnline.mySeat) {
            return false;
        }
        return true;
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

    // Schmale Schnittstelle für JS/miro-multiplayer-adapter.js. Kein
    // Redesign der Engine/Darstellung - nur Zugriff auf das, was der
    // Adapter für Online-Partien braucht (Zustand setzen/lesen, neu
    // zeichnen, mit einem fertigen Zustand statt lokalem Würfeln
    // starten, zurück zur Spieler-Auswahl).
    window.MiroUI = {
        getState: function () { return state; },
        setState: function (newState) { state = newState; },
        render: function (type) { render(type); },
        startWithState: startWithState,
        startCoinPhaseState: startCoinPhaseState,
        hostRollStartDiceForSeat: hostRollStartDiceForSeat,
        applyStartDiceResult: applyStartDiceResult,
        backToSetup: backToSetup,
        showWinner: showWinner
    };
})();
