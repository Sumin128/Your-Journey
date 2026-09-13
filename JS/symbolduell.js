/* =====================================================
   MIRELONS SYMBOLDUELL
   57 Karten aus der projektiven Ebene der Ordnung 7:
   8 Symbole je Karte, jedes Kartenpaar teilt genau 1 Symbol.
   ===================================================== */

(function () {
    "use strict";

    const SYMBOLS = [
        ["fuchs", "Fuchs"], ["eichenblatt", "Eichenblatt"], ["zauberstab", "Zauberstab"],
        ["goldschluessel", "Goldschlüssel"], ["pilz", "Pilz"], ["kristall", "Kristall"],
        ["zaubertrank", "Zaubertrank"], ["burgturm", "Burgturm"], ["feder", "Feder"],
        ["laterne", "Laterne"], ["frosch", "Frosch"], ["mond", "Mond"],
        ["eichel", "Eichel"], ["igel", "Igel"], ["hase", "Hase"], ["rabe", "Rabe"],
        ["eule", "Eule"], ["eichhoernchen", "Eichhörnchen"], ["baerentatze", "Bärentatze"],
        ["schmetterling", "Schmetterling"], ["schnecke", "Schnecke"],
        ["marienkaefer", "Marienkäfer"], ["libelle", "Libelle"], ["biene", "Biene"],
        ["tannenzapfen", "Tannenzapfen"], ["ahornblatt", "Ahornblatt"], ["blume", "Blume"],
        ["kleeblatt", "Kleeblatt"], ["farn", "Farn"], ["beerenzweig", "Beerenzweig"],
        ["sonne", "Sonne"], ["wolke", "Wolke"], ["schneeflocke", "Schneeflocke"],
        ["regentropfen", "Regentropfen"], ["regenbogen", "Regenbogen"], ["muschel", "Muschel"],
        ["kompass", "Kompass"], ["schatztruhe", "Schatztruhe"], ["krone", "Krone"],
        ["schild", "Schild"], ["schriftrolle", "Schriftrolle"], ["buch", "Buch"],
        ["schreibfeder", "Schreibfeder"], ["sandglas", "Sandglas"], ["glocke", "Glocke"],
        ["kerze", "Kerze"], ["tasse", "Tasse"], ["brot", "Brot"], ["apfel", "Apfel"],
        ["erdbeere", "Erdbeere"], ["karotte", "Karotte"], ["toertchen", "Törtchen"],
        ["musiknote", "Musiknote"], ["pinsel", "Pinsel"], ["burgfahne", "Burgfahne"],
        ["holzbruecke", "Holzbrücke"], ["boot", "Boot"]
    ].map(function (entry, index) {
        return { id: index, key: entry[0], label: entry[1] };
    });

    const SCORE_TO_WIN = 8;
    const GRID_SLOTS = [0, 1, 2, 3, 5, 6, 7, 8];
    const section = document.getElementById("symbolduell-game");
    if (!section) {
        return;
    }

    const intro = document.getElementById("symbolduell-intro");
    const play = document.getElementById("symbolduell-play");
    const result = document.getElementById("symbolduell-result");
    const leftCard = document.getElementById("symbolduell-card-left");
    const rightCard = document.getElementById("symbolduell-card-right");
    const message = document.getElementById("symbolduell-message");
    const playerScore = document.getElementById("symbolduell-player-score");
    const tessaScore = document.getElementById("symbolduell-tessa-score");
    const thinking = document.getElementById("symbolduell-thinking");
    const resultTitle = document.getElementById("symbolduell-result-title");
    const resultText = document.getElementById("symbolduell-result-text");

    let deck = buildDeck();
    let currentCards = [];
    let commonSymbol = null;
    let scores = { player: 0, tessa: 0 };
    let roundNumber = 0;
    let roundLocked = true;
    let botTimer = null;
    let transitionTimer = null;
    let usedPairs = new Set();
    let matchId = "";

    validateDeck(deck);

    function buildDeck() {
        const cards = [];
        const q = 7;

        for (let slope = 0; slope < q; slope += 1) {
            for (let intercept = 0; intercept < q; intercept += 1) {
                const card = [];
                for (let x = 0; x < q; x += 1) {
                    const y = (slope * x + intercept) % q;
                    card.push(y * q + x);
                }
                card.push(49 + slope);
                cards.push(card);
            }
        }

        for (let x = 0; x < q; x += 1) {
            const vertical = [];
            for (let y = 0; y < q; y += 1) {
                vertical.push(y * q + x);
            }
            vertical.push(56);
            cards.push(vertical);
        }

        cards.push([49, 50, 51, 52, 53, 54, 55, 56]);
        return cards;
    }

    function validateDeck(cards) {
        if (SYMBOLS.length !== 57 || cards.length !== 57) {
            throw new Error("Symbolduell: Es werden genau 57 Symbole und 57 Karten benötigt.");
        }
        cards.forEach(function (card, index) {
            if (card.length !== 8 || new Set(card).size !== 8) {
                throw new Error("Symbolduell: Karte " + index + " ist ungültig.");
            }
        });
        for (let a = 0; a < cards.length; a += 1) {
            for (let b = a + 1; b < cards.length; b += 1) {
                const overlap = cards[a].filter(function (id) { return cards[b].includes(id); });
                if (overlap.length !== 1) {
                    throw new Error("Symbolduell: Karten " + a + " und " + b + " haben " + overlap.length + " Treffer.");
                }
            }
        }
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function shuffled(values) {
        const copy = values.slice();
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = randomInt(0, i);
            const temp = copy[i];
            copy[i] = copy[j];
            copy[j] = temp;
        }
        return copy;
    }

    function chooseCards() {
        let first;
        let second;
        let key;
        do {
            first = randomInt(0, deck.length - 1);
            second = randomInt(0, deck.length - 1);
            key = first < second ? first + ":" + second : second + ":" + first;
        } while (first === second || usedPairs.has(key));
        usedPairs.add(key);
        return [deck[first], deck[second]];
    }

    function visualVariation(symbolId, cardSide) {
        const seed = (symbolId * 37 + roundNumber * 53 + cardSide * 89) % 997;
        return {
            scale: (0.72 + (seed % 39) / 100).toFixed(2),
            rotation: ((seed * 17) % 71) - 35
        };
    }

    function renderCard(element, card, side) {
        element.innerHTML = "";
        const symbols = shuffled(card);

        symbols.forEach(function (symbolId, index) {
            const symbol = SYMBOLS[symbolId];
            const variation = visualVariation(symbolId, side);
            const button = document.createElement("button");
            const image = document.createElement("span");
            button.type = "button";
            button.className = "symbolduell-symbol";
            button.dataset.symbolId = String(symbolId);
            button.style.gridColumn = String((GRID_SLOTS[index] % 3) + 1);
            button.style.gridRow = String(Math.floor(GRID_SLOTS[index] / 3) + 1);
            button.style.setProperty("--symbol-scale", variation.scale);
            button.style.setProperty("--symbol-rotation", variation.rotation + "deg");
            button.setAttribute("aria-label", symbol.label);
            image.className = "symbolduell-symbol-image";
            image.setAttribute("aria-hidden", "true");
            image.style.backgroundPosition =
                ((symbolId % 8) / 7 * 100).toFixed(4) + "% " +
                (Math.floor(symbolId / 8) / 7 * 100).toFixed(4) + "%";
            button.appendChild(image);
            button.addEventListener("click", onSymbolClick);
            element.appendChild(button);
        });
    }

    function startMatch() {
        clearTimers();
        scores = { player: 0, tessa: 0 };
        roundNumber = 0;
        usedPairs = new Set();
        matchId = "symbolduell_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
        intro.hidden = true;
        result.hidden = true;
        play.hidden = false;
        updateScore();
        startRound();
    }

    function startRound() {
        clearTimers();
        roundNumber += 1;
        roundLocked = false;
        currentCards = chooseCards();
        commonSymbol = currentCards[0].find(function (id) { return currentCards[1].includes(id); });
        renderCard(leftCard, currentCards[0], 0);
        renderCard(rightCard, currentCards[1], 1);
        message.textContent = "Finde das gleiche Symbol auf beiden Karten!";
        message.className = "symbolduell-message";

        const testMode = location.hostname === "127.0.0.1" || location.hostname === "localhost";
        const delay = testMode && new URLSearchParams(location.search).get("symbolduellTest") === "1"
            ? 450
            : randomInt(10000, 15000);
        thinking.style.setProperty("--thinking-duration", delay + "ms");
        thinking.classList.remove("is-running");
        void thinking.offsetWidth;
        thinking.classList.add("is-running");
        botTimer = window.setTimeout(tessaFindsMatch, delay);
    }

    function onSymbolClick(event) {
        if (roundLocked) {
            return;
        }
        const button = event.currentTarget;
        const symbolId = Number(button.dataset.symbolId);

        if (symbolId !== commonSymbol) {
            button.classList.remove("is-wrong");
            void button.offsetWidth;
            button.classList.add("is-wrong");
            message.textContent = "Das Symbol ist nur auf einer Karte – such weiter!";
            return;
        }

        roundLocked = true;
        window.clearTimeout(botTimer);
        thinking.classList.remove("is-running");
        revealMatch("player");
    }

    function tessaFindsMatch() {
        if (roundLocked) {
            return;
        }
        roundLocked = true;
        thinking.classList.remove("is-running");
        revealMatch("tessa");
    }

    function revealMatch(winner) {
        const symbol = SYMBOLS[commonSymbol];
        section.querySelectorAll('[data-symbol-id="' + commonSymbol + '"]').forEach(function (button) {
            button.classList.add("is-match");
        });
        section.querySelectorAll(".symbolduell-symbol").forEach(function (button) {
            button.disabled = true;
        });

        if (winner === "player") {
            message.textContent = "Richtig – " + symbol.label + "! Dein Punkt.";
            message.className = "symbolduell-message is-player";
        } else {
            message.textContent = "Tessa hat „" + symbol.label + "“ entdeckt!";
            message.className = "symbolduell-message is-tessa";
        }

        transitionTimer = window.setTimeout(function () {
            scores[winner] += 1;
            updateScore();
            if (scores[winner] >= SCORE_TO_WIN) {
                finishMatch(winner);
                return;
            }
            transitionTimer = window.setTimeout(startRound, 850);
        }, winner === "tessa" ? 950 : 550);
    }

    function updateScore() {
        playerScore.textContent = String(scores.player);
        tessaScore.textContent = String(scores.tessa);
    }

    function finishMatch(winner) {
        clearTimers();
        play.hidden = true;
        result.hidden = false;
        if (winner === "player") {
            resultTitle.textContent = "Du gewinnst das Symbolduell!";
            resultText.textContent = "Starker Blick: " + scores.player + " zu " + scores.tessa + ". Dafür erhältst du 25 XP.";
            window.dispatchEvent(new CustomEvent("mirelon:earn-xp", {
                detail: { reason: "symbolduell_gewonnen", difficulty: "normal", roundId: matchId }
            }));
            if (typeof awardHighscorePoints === "function") {
                awardHighscorePoints();
            }
            if (typeof fireConfetti === "function") {
                fireConfetti();
            }
        } else {
            resultTitle.textContent = "Tessa gewinnt diesmal";
            resultText.textContent = "Du hattest " + scores.player + " Punkte. Versuch es gleich noch einmal – die Symbole kennst du jetzt besser.";
        }
    }

    function clearTimers() {
        window.clearTimeout(botTimer);
        window.clearTimeout(transitionTimer);
        botTimer = null;
        transitionTimer = null;
        thinking.classList.remove("is-running");
    }

    function showIntro() {
        clearTimers();
        roundLocked = true;
        play.hidden = true;
        result.hidden = true;
        intro.hidden = false;
    }

    document.getElementById("symbolduell-start-button")?.addEventListener("click", startMatch);
    document.getElementById("symbolduell-restart-button")?.addEventListener("click", startMatch);
    document.getElementById("back-to-hase-menu-from-symbolduell")?.addEventListener("click", function () {
        clearTimers();
        section.hidden = true;
        document.getElementById("hase-game-menu").hidden = false;
    });
    document.getElementById("symbolduell-result-back")?.addEventListener("click", function () {
        clearTimers();
        section.hidden = true;
        document.getElementById("hase-game-menu").hidden = false;
    });
    window.addEventListener("pagehide", clearTimers);

    window.showSymbolduellIntro = showIntro;
    window.MirelonSymbolduell = { buildDeck: buildDeck, validateDeck: validateDeck, symbols: SYMBOLS };
}());
