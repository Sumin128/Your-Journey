/* =====================================================
   MEMORY BEI TESSA
   Klassisches Memory in drei Schwierigkeitsgraden:
   - Normal: 6 Kartenpaare (12 Karten), Deck 1
   - Schwer: 12 Kartenpaare (24 Karten), Deck 2
   - Extra Schwer: 18 Kartenpaare (36 Karten), Deck 1 + Deck 2
   Bei jeder Runde werden die Karten neu gemischt.
   ===================================================== */

const MEMORY_DECK_1_IDS = ["faro", "luis", "magical", "kuro", "tessa", "house"];

const MEMORY_DECK_2_IDS = [
    "bau", "boat", "branos", "bruecke", "eule", "hoehle",
    "igel", "lantern", "nest", "schloss", "squirrel", "zelt"
];

const MEMORY_DIFFICULTIES = {
    normal: {
        label: "Normal",
        path: "images/memory/deck1/",
        columns: 3,
        ids: MEMORY_DECK_1_IDS
    },
    schwer: {
        label: "Schwer",
        path: "images/memory/deck2/",
        columns: 6,
        ids: MEMORY_DECK_2_IDS
    },
    extraschwer: {
        label: "Extra Schwer",
        path: "images/memory/",
        columns: 6,
        ids: MEMORY_DECK_1_IDS.map(function (id) { return "deck1/" + id; })
            .concat(MEMORY_DECK_2_IDS.map(function (id) { return "deck2/" + id; }))
    }
};

const memoryDifficultySelect = document.getElementById("memory-difficulty-select");
const memoryDifficultyButtons = document.querySelectorAll(".memory-difficulty-button");
const memoryPlay = document.getElementById("memory-play");
const memoryIntroText = document.getElementById("memory-intro-text");

const memoryBoard = document.getElementById("memory-board");
const memoryMovesDisplay = document.getElementById("memory-moves");
const memoryPairsDisplay = document.getElementById("memory-pairs");
const memoryResultMessage = document.getElementById("memory-result-message");
const memoryRestartButton = document.getElementById("memory-restart-button");
const changeMemoryDifficultyButton = document.getElementById("change-memory-difficulty-button");

let currentMemoryDifficulty = null;
let memoryFlippedCards = [];
let memoryMatchedCount = 0;
let memoryMoves = 0;
let memoryBusy = false;
let memoryFinished = false;

/* 1. MISCHEN (Fisher-Yates) */

function shuffleMemoryCards(list) {

    const shuffled = list.slice();

    for (let i = shuffled.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;

    }

    return shuffled;

}

function buildMemoryDeck(cardIds) {

    const pairedIds = cardIds.concat(cardIds);

    return shuffleMemoryCards(pairedIds);

}

/* 2. SPIELFELD AUFBAUEN */

function renderMemoryBoard(deck, imagePath, columns) {

    if (!memoryBoard) {
        return;
    }

    memoryBoard.innerHTML = "";
    memoryBoard.style.gridTemplateColumns = "repeat(" + columns + ", minmax(0, 1fr))";
    memoryBoard.classList.toggle("memory-board--wide", columns > 3);

    deck.forEach(function (cardId) {

        const card = document.createElement("button");
        card.type = "button";
        card.className = "memory-card";
        card.dataset.cardId = cardId;
        card.setAttribute("aria-label", "Memory-Karte, verdeckt");

        card.innerHTML = `
            <span class="memory-card-inner">
                <span class="memory-card-face memory-card-back"></span>
                <span class="memory-card-face memory-card-front">
                    <img src="${imagePath}${cardId}.png" alt="">
                </span>
            </span>
        `;

        card.addEventListener("click", function () {
            handleMemoryCardClick(card);
        });

        memoryBoard.appendChild(card);

    });

}

/* 3. STATUS ANZEIGEN */

function updateMemoryStatus() {

    const totalPairs = currentMemoryDifficulty
        ? MEMORY_DIFFICULTIES[currentMemoryDifficulty].ids.length
        : 0;

    if (memoryMovesDisplay) {
        memoryMovesDisplay.textContent = "Versuche: " + memoryMoves;
    }

    if (memoryPairsDisplay) {
        memoryPairsDisplay.textContent = "Paare: " + memoryMatchedCount + " / " + totalPairs;
    }

}

/* 4. SCHWIERIGKEIT WÄHLEN / ZURÜCK ZUR AUSWAHL */

function showMemoryDifficultySelect() {

    currentMemoryDifficulty = null;

    if (memoryPlay) {
        memoryPlay.classList.add("is-hidden");
    }

    if (memoryDifficultySelect) {
        memoryDifficultySelect.classList.remove("is-hidden");
    }

}

/* 5. RUNDE STARTEN */

function startMemoryGame(difficulty) {

    const settings = MEMORY_DIFFICULTIES[difficulty];

    if (!settings) {
        return;
    }

    currentMemoryDifficulty = difficulty;

    memoryFlippedCards = [];
    memoryMatchedCount = 0;
    memoryMoves = 0;
    memoryBusy = false;
    memoryFinished = false;

    if (memoryDifficultySelect) {
        memoryDifficultySelect.classList.add("is-hidden");
    }

    if (memoryPlay) {
        memoryPlay.classList.remove("is-hidden");
    }

    if (memoryIntroText) {
        memoryIntroText.textContent = "Finde alle " + settings.ids.length + " Kartenpaare!";
    }

    if (memoryResultMessage) {
        memoryResultMessage.textContent = "";
        memoryResultMessage.classList.remove("word-win");
    }

    if (memoryRestartButton) {
        memoryRestartButton.hidden = true;
    }

    updateMemoryStatus();

    const deck = buildMemoryDeck(settings.ids);
    renderMemoryBoard(deck, settings.path, settings.columns);

}

/* 6. KARTE ANKLICKEN */

function handleMemoryCardClick(card) {

    if (
        memoryBusy ||
        memoryFinished ||
        card.classList.contains("is-flipped") ||
        card.classList.contains("is-matched")
    ) {
        return;
    }

    card.classList.add("is-flipped");
    card.setAttribute("aria-label", "Memory-Karte, aufgedeckt");

    memoryFlippedCards.push(card);

    if (memoryFlippedCards.length < 2) {
        return;
    }

    memoryMoves++;
    updateMemoryStatus();

    memoryBusy = true;

    const [firstCard, secondCard] = memoryFlippedCards;

    if (firstCard.dataset.cardId === secondCard.dataset.cardId) {

        firstCard.classList.add("is-matched");
        secondCard.classList.add("is-matched");

        memoryFlippedCards = [];
        memoryMatchedCount++;

        updateMemoryStatus();

        memoryBusy = false;

        if (memoryMatchedCount === MEMORY_DIFFICULTIES[currentMemoryDifficulty].ids.length) {
            finishMemoryGame();
        }

    } else {

        setTimeout(function () {

            firstCard.classList.remove("is-flipped");
            secondCard.classList.remove("is-flipped");
            firstCard.setAttribute("aria-label", "Memory-Karte, verdeckt");
            secondCard.setAttribute("aria-label", "Memory-Karte, verdeckt");

            memoryFlippedCards = [];
            memoryBusy = false;

        }, 900);

    }

}

/* 7. RUNDE ABSCHLIESSEN */

function finishMemoryGame() {

    memoryFinished = true;

    if (memoryResultMessage) {
        memoryResultMessage.textContent =
            "🎉 Super! Du hast alle Paare gefunden! (" + memoryMoves + " Versuche)";
        memoryResultMessage.classList.add("word-win");
    }

    if (memoryRestartButton) {
        memoryRestartButton.hidden = false;
    }

    if (typeof registerMemoryCompletion === "function") {
        registerMemoryCompletion(currentMemoryDifficulty);
    }

}

/* 8. BUTTONS VERKABELN */

memoryDifficultyButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        startMemoryGame(button.dataset.memoryDifficulty);
    });
});

if (memoryRestartButton) {
    memoryRestartButton.addEventListener("click", function () {
        startMemoryGame(currentMemoryDifficulty);
    });
}

if (changeMemoryDifficultyButton) {
    changeMemoryDifficultyButton.addEventListener("click", showMemoryDifficultySelect);
}
