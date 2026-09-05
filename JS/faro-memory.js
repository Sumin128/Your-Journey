/* =====================================================
   FARO – FÄHRTEN-MEMORY
   Klassisches Memory mit den sechs Tierspuren aus
   faro-tracks.js: 6 Paare, 12 Karten (4 x 3).
   +1 Münze pro gefundenem Paar (fox_correct).
   ===================================================== */

(function () {

    const PAIR_COUNT = 6;

    let stageEl = null;
    let boardEl = null;
    let statusEl = null;
    let flipped = [];
    let matched = 0;
    let tries = 0;
    let busy = false;


    function shuffle(list) {
        const copy = list.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }


    function start(stage) {

        stageEl = stage;
        flipped = [];
        matched = 0;
        tries = 0;
        busy = false;

        stageEl.innerHTML = "";

        const title = document.createElement("h2");
        title.textContent = "Fährten-Memory";
        stageEl.appendChild(title);

        statusEl = document.createElement("p");
        statusEl.className = "faro-game-progress";
        statusEl.id = "faro-memory-status";
        stageEl.appendChild(statusEl);

        boardEl = document.createElement("div");
        boardEl.className = "faro-memory-board";

        const ids = Object.keys(window.FARO_TRACKS || {}).slice(0, PAIR_COUNT);
        const deck = shuffle(ids.concat(ids));

        deck.forEach(function (id) {

            const card = document.createElement("button");
            card.type = "button";
            card.className = "faro-memory-card";
            card.dataset.track = id;
            card.setAttribute("aria-label", "Memory-Karte, verdeckt");
            card.innerHTML =
                '<span class="faro-memory-inner">' +
                '<span class="faro-memory-face faro-memory-back"></span>' +
                '<span class="faro-memory-face faro-memory-front"><span class="faro-track">' +
                window.FARO_TRACKS[id] + '</span></span>' +
                '</span>';

            card.addEventListener("click", function () {
                flipCard(card);
            });

            boardEl.appendChild(card);

        });

        stageEl.appendChild(boardEl);

        const message = document.createElement("p");
        message.className = "faro-game-message";
        message.id = "faro-memory-message";
        stageEl.appendChild(message);

        updateStatus();

    }


    function updateStatus() {
        if (statusEl) {
            statusEl.textContent = "Paare " + matched + " / " + PAIR_COUNT + "  ·  " + tries + " Versuche";
        }
    }


    function flipCard(card) {

        if (busy || card.classList.contains("is-flipped") || card.classList.contains("is-matched")) {
            return;
        }

        card.classList.add("is-flipped");
        flipped.push(card);

        if (flipped.length < 2) {
            return;
        }

        tries++;
        updateStatus();
        busy = true;

        const a = flipped[0];
        const b = flipped[1];

        if (a.dataset.track === b.dataset.track) {

            a.classList.add("is-matched");
            b.classList.add("is-matched");
            flipped = [];
            matched++;
            busy = false;
            updateStatus();

            window.FaroGames.earn(1, "fox_correct");
            if (typeof playCorrectSound === "function") { playCorrectSound(); }

            if (matched === PAIR_COUNT) {
                showWin();
            }

        } else {

            setTimeout(function () {
                a.classList.remove("is-flipped");
                b.classList.remove("is-flipped");
                flipped = [];
                busy = false;
            }, 850);

        }

    }


    function showWin() {

        window.dispatchEvent(new CustomEvent("mirelon:earn-xp", { detail: { reason: "faro_spiel_gewonnen" } }));

        const message = document.getElementById("faro-memory-message");
        if (message) {
            message.textContent = "Alle Fährten-Paare gefunden! (" + tries + " Versuche)";
        }

        const again = document.createElement("button");
        again.type = "button";
        again.className = "yj-button";
        again.textContent = "Nochmal";
        again.addEventListener("click", function () { start(stageEl); });
        stageEl.appendChild(again);

    }


    function stop() {
        busy = false;
        flipped = [];
    }


    if (window.FaroGames) {
        window.FaroGames.register({
            id: "memory",
            label: "Fährten-Memory",
            icon: "🃏",
            start: start,
            stop: stop
        });
    }

})();
