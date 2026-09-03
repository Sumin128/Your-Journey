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

    // viewBox 0 0 100 120, Füllfarbe erbt über "currentColor"
    const TRACKS = {

        hund:
            '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
            '<ellipse cx="28" cy="46" rx="10" ry="15"/>' +
            '<ellipse cx="44" cy="32" rx="10" ry="16"/>' +
            '<ellipse cx="60" cy="32" rx="10" ry="16"/>' +
            '<ellipse cx="76" cy="46" rx="10" ry="15"/>' +
            '<path d="M22 78 Q50 52 78 78 Q84 104 50 108 Q16 104 22 78 Z"/>' +
            '<circle cx="24" cy="26" r="3"/><circle cx="42" cy="12" r="3"/>' +
            '<circle cx="62" cy="12" r="3"/><circle cx="80" cy="26" r="3"/>' +
            '</svg>',

        katze:
            '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
            '<ellipse cx="31" cy="48" rx="9" ry="12"/>' +
            '<ellipse cx="45" cy="38" rx="9" ry="13"/>' +
            '<ellipse cx="59" cy="38" rx="9" ry="13"/>' +
            '<ellipse cx="72" cy="48" rx="9" ry="12"/>' +
            '<path d="M26 74 Q50 54 74 74 Q82 100 50 104 Q18 100 26 74 Z"/>' +
            '</svg>',

        reh:
            '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
            '<path d="M47 16 C 34 20, 28 48, 34 82 C 37 100, 45 108, 47 108 C 48 90, 48 40, 47 16 Z"/>' +
            '<path d="M53 16 C 66 20, 72 48, 66 82 C 63 100, 55 108, 53 108 C 52 90, 52 40, 53 16 Z"/>' +
            '</svg>',

        baer:
            '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
            '<path d="M16 66 Q50 40 84 66 Q90 100 50 104 Q10 100 16 66 Z"/>' +
            '<ellipse cx="22" cy="50" rx="8" ry="11"/>' +
            '<ellipse cx="37" cy="40" rx="8" ry="12"/>' +
            '<ellipse cx="52" cy="36" rx="8" ry="12"/>' +
            '<ellipse cx="67" cy="40" rx="8" ry="12"/>' +
            '<ellipse cx="81" cy="50" rx="8" ry="11"/>' +
            '<path d="M20 34 l4 8 l4 -8 Z"/><path d="M35 24 l4 8 l4 -8 Z"/>' +
            '<path d="M50 20 l4 8 l4 -8 Z"/><path d="M65 24 l4 8 l4 -8 Z"/>' +
            '<path d="M79 34 l4 8 l4 -8 Z"/>' +
            '</svg>',

        vogel:
            '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round">' +
            '<path d="M50 66 L28 20"/>' +
            '<path d="M50 66 L50 12"/>' +
            '<path d="M50 66 L72 20"/>' +
            '<path d="M50 66 L50 106"/>' +
            '</svg>',

        ente:
            '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
            '<path d="M50 84 L24 26 Q37 34 50 22 Q63 34 76 26 Z"/>' +
            '<rect x="46" y="80" width="8" height="26" rx="4"/>' +
            '</svg>'
    };

    const ANIMALS = [
        { id: "hund", name: "Hund" },
        { id: "katze", name: "Katze" },
        { id: "reh", name: "Reh" },
        { id: "baer", name: "Bär" },
        { id: "vogel", name: "Vogel" },
        { id: "ente", name: "Ente" }
    ];

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
