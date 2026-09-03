/* =====================================================
   FARO – SCHATTENRATEN
   Ein schwarzer Umriss (Silhouette) erscheint, das Kind
   wählt aus drei Namen. Bei richtiger Antwort verwandelt
   sich der Schatten in das bunte Tier.

   Bildmaterial: die Baumkind-Sprites aus images/tamagotchi/
   (transparente PNGs) - per CSS-Filter zu Silhouetten
   gemacht. Neue Tiere hier einfach ergänzen.
   ===================================================== */

(function () {

    const ANIMALS = [
        { id: "baer", name: "Bär" },
        { id: "eichhorn", name: "Eichhörnchen" },
        { id: "igel", name: "Igel" },
        { id: "otter", name: "Otter" },
        { id: "reh", name: "Reh" }
    ];

    // Aufrechte Posen - als Silhouette besser erkennbar als
    // "sleeping" (zusammengerollter Klumpen).
    const POSES = ["happy", "playing"];
    const ROUNDS = 6;
    const REVEAL_MS = 1500;

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


    function buildRoundOrder() {
        // ROUNDS Ziele ohne direkte Wiederholung
        const result = [];
        let pool = [];
        let last = null;

        for (let i = 0; i < ROUNDS; i++) {
            if (pool.length === 0) {
                pool = shuffle(ANIMALS);
            }
            let pick = pool.shift();
            if (pick === last && pool.length > 0) {
                pool.push(pick);
                pick = pool.shift();
            }
            last = pick;
            result.push(pick);
        }
        return result;
    }


    function start(stage) {

        stageEl = stage;
        order = buildRoundOrder();
        roundIndex = 0;
        score = 0;

        showRound();

    }


    function showRound() {

        answered = false;

        const target = order[roundIndex];
        const pose = POSES[Math.floor(Math.random() * POSES.length)];
        const flipped = Math.random() < 0.5;

        // Drei Antwortmöglichkeiten: Ziel + zwei andere
        const others = shuffle(ANIMALS.filter(function (a) { return a.id !== target.id; })).slice(0, 2);
        const options = shuffle(others.concat(target));

        stageEl.innerHTML = "";

        const header = document.createElement("p");
        header.className = "faro-game-progress";
        header.textContent = "Schatten " + (roundIndex + 1) + " von " + ROUNDS + "  ·  " + score + " richtig";
        stageEl.appendChild(header);

        const question = document.createElement("h2");
        question.textContent = "Wessen Schatten ist das?";
        stageEl.appendChild(question);

        const shadowWrap = document.createElement("div");
        shadowWrap.className = "faro-shadow-wrap";

        const img = document.createElement("img");
        img.className = "faro-shadow";
        img.src = "images/tamagotchi/" + target.id + "_" + pose + ".png";
        img.alt = "Schatten eines Tieres";
        if (flipped) {
            img.style.transform = "scaleX(-1)";
        }
        shadowWrap.appendChild(img);
        stageEl.appendChild(shadowWrap);

        const answers = document.createElement("div");
        answers.className = "faro-answers";

        options.forEach(function (option) {

            const button = document.createElement("button");
            button.type = "button";
            button.className = "yj-button";
            button.textContent = option.name;
            button.addEventListener("click", function () {
                pickAnswer(option, target, img, answers, flipped);
            });
            answers.appendChild(button);

        });

        stageEl.appendChild(answers);

        const message = document.createElement("p");
        message.className = "faro-game-message";
        message.id = "faro-schatten-message";
        stageEl.appendChild(message);

    }


    function pickAnswer(option, target, img, answers, flipped) {

        if (answered) {
            return;
        }
        answered = true;

        const buttons = answers.querySelectorAll("button");
        buttons.forEach(function (b) {
            b.disabled = true;
            if (b.textContent === target.name) {
                b.classList.add("correct");
            }
        });

        const message = document.getElementById("faro-schatten-message");
        const correct = option.id === target.id;

        // Schatten "aufdecken": Filter weg, Tier wird bunt
        img.classList.add("revealed");
        if (flipped) {
            img.style.transform = "scaleX(-1)";
        }

        if (correct) {
            score++;
            window.FaroGames.earn(1, "fox_correct");
            message.textContent = "Richtig! Das ist der " + target.name + ". +1 Münze";
            if (typeof playCorrectSound === "function") { playCorrectSound(); }
        } else {
            message.textContent = "Das war der " + target.name + ".";
            if (typeof playWrongSound === "function") { playWrongSound(); }
        }

        timer = setTimeout(function () {
            roundIndex++;
            if (roundIndex < ROUNDS) {
                showRound();
            } else {
                showResult();
            }
        }, REVEAL_MS);

    }


    function showResult() {

        stageEl.innerHTML = "";

        const title = document.createElement("h2");
        title.textContent = "Geschafft!";
        stageEl.appendChild(title);

        const text = document.createElement("p");
        text.className = "faro-game-message";
        text.textContent = "Du hast " + score + " von " + ROUNDS + " Schatten erkannt.";
        stageEl.appendChild(text);

        const again = document.createElement("button");
        again.type = "button";
        again.className = "yj-button";
        again.textContent = "Nochmal";
        again.addEventListener("click", function () {
            start(stageEl);
        });
        stageEl.appendChild(again);

    }


    function stop() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }


    if (window.FaroGames) {
        window.FaroGames.register({
            id: "schatten",
            label: "Schattenraten",
            icon: "🌑",
            start: start,
            stop: stop
        });
    }

})();
