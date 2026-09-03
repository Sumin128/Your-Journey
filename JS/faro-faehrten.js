/* =====================================================
   FARO – FÄHRTEN LESEN
   Ein Tierspur-Abdruck (SVG) erscheint, das Kind wählt
   aus drei Tieren, welches hier gelaufen ist.

   Die Abdrücke sind bewusst einfache Formen (so sehen
   echte Spuren im Boden auch aus). Wer später gemalte
   Spurenbilder hat, ersetzt einfach das "svg"-Feld durch
   ein <img>.
   ===================================================== */

(function () {

    // SVG-Abdrücke + Namen kommen aus faro-tracks.js
    const TRACKS = window.FARO_TRACKS || {};
    const ANIMALS = Object.keys(window.FARO_TRACK_NAMES || {}).map(function (id) {
        return { id: id, name: window.FARO_TRACK_NAMES[id] };
    });

    const ROUNDS = 6;
    const REVEAL_MS = 1400;

    let stageEl = null;
    let order = [];
    let roundIndex = 0;
    let score = 0;
    let answered = false;
    let timer = null;


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
        order = [];
        let pool = [];
        for (let i = 0; i < ROUNDS; i++) {
            if (pool.length === 0) { pool = shuffle(ANIMALS); }
            order.push(pool.shift());
        }
        roundIndex = 0;
        score = 0;
        showRound();
    }


    function showRound() {

        answered = false;
        const target = order[roundIndex];

        // Hund- und Katzenspur sehen sich sehr ähnlich - nie als
        // Ablenker füreinander anbieten (wäre für kleine Kinder unfair).
        const confuse = { hund: "katze", katze: "hund" };
        const others = shuffle(ANIMALS.filter(function (a) {
            return a.id !== target.id && a.id !== confuse[target.id];
        })).slice(0, 2);
        const options = shuffle(others.concat(target));

        stageEl.innerHTML = "";

        const header = document.createElement("p");
        header.className = "faro-game-progress";
        header.textContent = "Spur " + (roundIndex + 1) + " von " + ROUNDS + "  ·  " + score + " richtig";
        stageEl.appendChild(header);

        const question = document.createElement("h2");
        question.textContent = "Welches Tier ist hier gelaufen?";
        stageEl.appendChild(question);

        const trackWrap = document.createElement("div");
        trackWrap.className = "faro-track-wrap";
        trackWrap.innerHTML =
            '<span class="faro-track">' + TRACKS[target.id] + '</span>' +
            '<span class="faro-track faro-track--faint">' + TRACKS[target.id] + '</span>';
        stageEl.appendChild(trackWrap);

        const answers = document.createElement("div");
        answers.className = "faro-answers";
        options.forEach(function (option) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "yj-button";
            button.textContent = option.name;
            button.addEventListener("click", function () {
                pickAnswer(option, target, answers);
            });
            answers.appendChild(button);
        });
        stageEl.appendChild(answers);

        const message = document.createElement("p");
        message.className = "faro-game-message";
        message.id = "faro-faehrten-message";
        stageEl.appendChild(message);

    }


    function pickAnswer(option, target, answers) {

        if (answered) { return; }
        answered = true;

        answers.querySelectorAll("button").forEach(function (b) {
            b.disabled = true;
            if (b.textContent === target.name) { b.classList.add("correct"); }
        });

        const message = document.getElementById("faro-faehrten-message");

        if (option.id === target.id) {
            score++;
            window.FaroGames.earn(1, "fox_correct");
            message.textContent = "Richtig gespürt! +1 Münze";
            if (typeof playCorrectSound === "function") { playCorrectSound(); }
        } else {
            message.textContent = "Das war die Spur vom " + target.name + ".";
            if (typeof playWrongSound === "function") { playWrongSound(); }
        }

        timer = setTimeout(function () {
            roundIndex++;
            if (roundIndex < ROUNDS) { showRound(); } else { showResult(); }
        }, REVEAL_MS);

    }


    function showResult() {

        stageEl.innerHTML = "";

        const title = document.createElement("h2");
        title.textContent = "Fährte gelesen!";
        stageEl.appendChild(title);

        const text = document.createElement("p");
        text.className = "faro-game-message";
        text.textContent = "Du hast " + score + " von " + ROUNDS + " Spuren erkannt.";
        stageEl.appendChild(text);

        const again = document.createElement("button");
        again.type = "button";
        again.className = "yj-button";
        again.textContent = "Nochmal";
        again.addEventListener("click", function () { start(stageEl); });
        stageEl.appendChild(again);

    }


    function stop() {
        if (timer) { clearTimeout(timer); timer = null; }
    }


    if (window.FaroGames) {
        window.FaroGames.register({
            id: "faehrten",
            label: "Fährten lesen",
            icon: "🐾",
            start: start,
            stop: stop
        });
    }

})();
