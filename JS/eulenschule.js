/* =====================================================
   EULENSCHULE
   Profil anzeigen und Wörterraten starten
   ===================================================== */

/* 1. PROFIL LADEN UND ANZEIGEN */

loadPlayer();
applyCursor();

function updateOwlSchoolPlayer() {
    const featherCount = document.getElementById("feather-count");
    const playerNameDisplay = document.getElementById("player-name-display");
    const playerAvatarDisplay =
    document.getElementById("player-avatar");

    if (featherCount) {
        featherCount.textContent = "🪶 " + player.feathers + " Federn";
    }

    if (playerNameDisplay) {
        playerNameDisplay.textContent = player.name || "Abenteurer";

        if (playerAvatarDisplay && player.avatar) {
    playerAvatarDisplay.src = player.avatar;
}
    }
}

updateOwlSchoolPlayer();
window.addEventListener("player-updated", updateOwlSchoolPlayer);

/* 2. ELEMENTE AUS DEM HTML */

const difficultySelect = document.getElementById("difficulty-select");
const difficultyButtons = document.querySelectorAll(".difficulty-button");
const difficultyLabel = document.getElementById("difficulty-label");
const wordPlay = document.getElementById("word-play");

const keyboard = document.getElementById("keyboard");
const wordDisplay = document.getElementById("word-display");
const livesDisplay = document.getElementById("word-lives");
const categoryDisplay = document.getElementById("word-category");

const wordResultMessage =
    document.getElementById("word-result-message");

const wordMessage = document.getElementById("word-message");

const hintButton = document.getElementById("hint-button");
const nextWordButton = document.getElementById("next-word-button");
const changeDifficultyButton = document.getElementById("change-difficulty-button");

/* 3. SPIELVARIABLEN */

const alphabet = [
    "A", "B", "C", "D", "E", "F", "G",
    "H", "I", "J", "K", "L", "M", "N",
    "O", "P", "Q", "R", "S", "T",
    "U", "V", "W", "X", "Y", "Z"
];

if (typeof words === "undefined" || words.length === 0) {
    throw new Error("Die Wörterliste in JS/words.js ist leer oder wurde nicht geladen.");
}

const difficultySettings = {
    leicht: { label: "🌼 Leicht", lives: 7, hints: 2, feathers: 2, maxLength: 5 },
    mittel: { label: "🌳 Mittel", lives: 5, hints: 1, feathers: 3, minLength: 6, maxLength: 8 },
    schwer: { label: "🔥 Schwer", lives: 4, hints: 0, feathers: 5, minLength: 9 }
};

function getWordsForDifficulty(level) {
    const settings = difficultySettings[level];

    return words.filter(function (entry) {
        const length = entry.word.length;

        if (settings.minLength && length < settings.minLength) {
            return false;
        }

        if (settings.maxLength && length > settings.maxLength) {
            return false;
        }

        return true;
    });
}

let currentDifficulty = null;
let currentWord = "";
let currentCategory = "";
let guessedLetters = [];
let lives = 0;
let hintsRemaining = 0;

let gameFinished = false;

/* 4. TASTATUR ERSTELLEN */

function buildKeyboard() {
    if (!keyboard) {
        return;
    }

    keyboard.innerHTML = "";

    alphabet.forEach(function (letter) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = letter;
        button.classList.add("letter-button");

        button.addEventListener("click", function () {
            checkLetter(letter, button);
        });

        keyboard.appendChild(button);
    });
}

function resetKeyboard() {
    if (!keyboard) {
        return;
    }

    keyboard.querySelectorAll(".letter-button").forEach(function (button) {
        button.disabled = false;
        button.classList.remove("correct-letter", "wrong-letter");
    });
}

buildKeyboard();

/* 5. SCHWIERIGKEIT WÄHLEN & RUNDE STARTEN */

function startRound(level) {
    const settings = difficultySettings[level];
    const pool = getWordsForDifficulty(level);

    const randomWord = pool[Math.floor(Math.random() * pool.length)];

    currentDifficulty = level;
    currentWord = randomWord.word.toUpperCase();
    currentCategory = randomWord.category;
    guessedLetters = [];
    lives = settings.lives;
    hintsRemaining = settings.hints;
    gameFinished = false;

    if (difficultySelect) {
        difficultySelect.classList.add("is-hidden");
    }

    if (wordPlay) {
        wordPlay.classList.remove("is-hidden");
    }

    if (difficultyLabel) {
        difficultyLabel.textContent = settings.label;
    }

    resetKeyboard();
    updateWordDisplay();
    updateLives();
    updateCategory();
    updateHintButton();

    nextWordButton.style.display = "none";

    if (wordResultMessage) {
        wordResultMessage.textContent = "";
        wordResultMessage.classList.remove("word-win", "word-lose");
    }

    if (wordMessage) {
        wordMessage.textContent = "Wähle einen Buchstaben.";
    }
}

difficultyButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        startRound(button.dataset.difficulty);
    });
});

if (changeDifficultyButton) {
    changeDifficultyButton.addEventListener("click", function () {
        gameFinished = true;

        if (wordPlay) {
            wordPlay.classList.add("is-hidden");
        }

        if (difficultySelect) {
            difficultySelect.classList.remove("is-hidden");
        }
    });
}

/* 6. BUCHSTABEN PRÜFEN */

function checkLetter(letter, button) {

    // Kein Spiel gestartet, schon beendet oder Buchstabe schon benutzt?
    if (
        !currentDifficulty ||
        gameFinished ||
        lives <= 0 ||
        guessedLetters.includes(letter)
    ) {
        return;
    }

    // Buchstaben merken
    guessedLetters.push(letter);

    // Button danach nicht mehr anklickbar
    button.disabled = true;


    // RICHTIGER BUCHSTABE
    if (currentWord.includes(letter)) {

        button.classList.add("correct-letter");

    }

    // FALSCHER BUCHSTABE
    else {

        button.classList.add("wrong-letter");

        lives--;

    }


    updateWordDisplay();
    updateLives();


    // VERLOREN
    if (lives <= 0) {

    gameFinished = true;

    nextWordButton.style.display = "block";

    updateHintButton();

    if (wordResultMessage) {

        wordResultMessage.textContent =
            "😢 Schade! Das gesuchte Wort war: " + currentWord;

        wordResultMessage.classList.add("word-lose");

    }

    return;
}


    checkWinCondition();

}

function checkWinCondition() {

    if (gameFinished) {
        return;
    }

    const wordFullyGuessed = currentWord
        .split("")
        .every(function (currentLetter) {
            return guessedLetters.includes(currentLetter);
        });

    if (!wordFullyGuessed) {
        return;
    }

    gameFinished = true;

    addFeathers(difficultySettings[currentDifficulty].feathers);

    updateOwlSchoolPlayer();

    nextWordButton.style.display = "block";

    updateHintButton();

    if (wordResultMessage) {

        wordResultMessage.textContent =
            "🎉 Super! Du hast das Wort erraten!";

        wordResultMessage.classList.add("word-win");

    }

}

/* 7. TIPP */

if (hintButton) {
    hintButton.addEventListener("click", function () {

        if (!currentDifficulty || gameFinished || hintsRemaining <= 0) {
            return;
        }

        const openLetters = currentWord
            .split("")
            .filter(function (letter, index, allLetters) {
                return !guessedLetters.includes(letter) &&
                    allLetters.indexOf(letter) === index;
            });

        if (openLetters.length === 0) {
            return;
        }

        const hintLetter =
            openLetters[Math.floor(Math.random() * openLetters.length)];

        hintsRemaining--;

        guessedLetters.push(hintLetter);

        const hintKeyButton = [...document.querySelectorAll(".letter-button")]
            .find(function (button) {
                return button.textContent === hintLetter;
            });

        if (hintKeyButton) {
            hintKeyButton.disabled = true;
            hintKeyButton.classList.add("correct-letter");
        }

        updateWordDisplay();
        updateHintButton();
        checkWinCondition();

    });
}

function updateHintButton() {
    if (!hintButton) {
        return;
    }

    if (!currentDifficulty || difficultySettings[currentDifficulty].hints === 0) {
        hintButton.style.display = "none";
        return;
    }

    hintButton.style.display = "";
    hintButton.textContent = "💡 Tipp (" + hintsRemaining + ")";
    hintButton.disabled = gameFinished || hintsRemaining <= 0;
}

/* 8. ANZEIGEN */

function updateWordDisplay() {
    if (!wordDisplay) {
        return;
    }

    wordDisplay.innerHTML = "";

    for (let i = 0; i < currentWord.length; i++) {
        const currentLetter = currentWord[i];
        const isGuessed = guessedLetters.includes(currentLetter);

        const slot = document.createElement("span");
        slot.classList.add("letter-slot");

        if (isGuessed) {
            slot.textContent = currentLetter;
            slot.classList.add("letter-slot--filled");
        }

        wordDisplay.appendChild(slot);
    }
}

function updateLives() {
    if (livesDisplay) {
        livesDisplay.textContent = "❤️".repeat(Math.max(0, lives));
    }
}

function updateCategory() {
    if (categoryDisplay) {
        categoryDisplay.textContent = "Kategorie: " + currentCategory;
    }
}

/* 9. NÄCHSTE RUNDE */

nextWordButton.addEventListener("click", function () {

    startRound(currentDifficulty);

});

/* =====================================================
   TASTATUR UNTERSTÜTZUNG
   ===================================================== */

document.addEventListener("keydown", function(event){

    if(!currentDifficulty || gameFinished){
        return;
    }

    const letter = event.key.toUpperCase();

    if(!alphabet.includes(letter)){
        return;
    }

    const button = [...document.querySelectorAll(".letter-button")]
        .find(btn => btn.textContent === letter);

    if(button && !button.disabled){

        checkLetter(letter, button);

    }

});
