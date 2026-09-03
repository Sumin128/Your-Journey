/* =====================================================
   FAROS FUCHSBAU
   Spielerprofil + Menü für Faros Spür-Spiele.

   Die einzelnen Spiele registrieren sich selbst über
   window.FaroGames.register({...}) aus ihren eigenen
   Dateien (faro-schatten.js, faro-faehrten.js, ...).
   Das Geräuschequiz ist zu Kuro umgezogen.
   ===================================================== */


/* =====================================================
   1. SPIELER
   ===================================================== */

loadPlayer();
applyCursor();

if (typeof markAnimalVisited === "function") {
    markAnimalVisited("faro");
}


function updateFaroPlayer() {

    const playerAvatar = document.getElementById("player-avatar");
    const playerNameDisplay = document.getElementById("player-name-display");
    const featherCount = document.getElementById("feather-count");

    if (playerAvatar) {
        playerAvatar.src = player.avatar || AVATAR_PLACEHOLDER;
        playerAvatar.style.display = "block";
    }

    if (playerNameDisplay) {
        playerNameDisplay.textContent = player.name || "Abenteurer";
    }

    if (featherCount) {
        featherCount.innerHTML =
            '<img src="images/muenze.png" alt="" class="coin-icon"> ' +
            player.coins + " Münzen";
    }

}

updateFaroPlayer();


/* =====================================================
   2. SPIELE-REGISTRIERUNG UND MENÜ
   ===================================================== */

const faroGameButtons = document.getElementById("faro-game-buttons");
const faroGamesMenu = document.getElementById("faro-games");
const faroGameStage = document.getElementById("faro-game-stage");
const faroBackToGames = document.getElementById("faro-back-to-games");

const FARO_GAMES = [];
let faroActiveGame = null;

window.FaroGames = {

    register: function (game) {
        // game: { id, label, icon, start(stageEl), stop() }
        FARO_GAMES.push(game);
        renderFaroGameMenu();
    },

    // Münzen wie überall über das zentrale Event vergeben
    earn: function (amount, reason) {
        window.dispatchEvent(new CustomEvent("mirelon:earn-coins", {
            detail: { amount: amount, reason: reason }
        }));
        updateFaroPlayer();
    }

};


function renderFaroGameMenu() {

    if (!faroGameButtons) {
        return;
    }

    faroGameButtons.innerHTML = "";

    if (FARO_GAMES.length === 0) {
        const hint = document.createElement("p");
        hint.className = "yj-muted";
        hint.textContent = "Faro sucht noch neue Spiele … bald geht es los!";
        faroGameButtons.appendChild(hint);
        return;
    }

    FARO_GAMES.forEach(function (game) {

        const button = document.createElement("button");
        button.type = "button";
        button.className = "yj-button";
        button.textContent = game.icon + " " + game.label;
        button.addEventListener("click", function () {
            openFaroGame(game.id);
        });

        faroGameButtons.appendChild(button);

    });

}


function openFaroGame(gameId) {

    const game = FARO_GAMES.find(function (g) { return g.id === gameId; });

    if (!game || !faroGameStage) {
        return;
    }

    faroActiveGame = game;

    faroGamesMenu.hidden = true;
    faroGameStage.hidden = false;
    faroBackToGames.hidden = false;

    faroGameStage.innerHTML = "";
    game.start(faroGameStage);

    faroGameStage.scrollIntoView({ behavior: "smooth", block: "start" });

}


function closeFaroGame() {

    if (faroActiveGame && typeof faroActiveGame.stop === "function") {
        faroActiveGame.stop();
    }

    faroActiveGame = null;

    if (faroGameStage) {
        faroGameStage.hidden = true;
        faroGameStage.innerHTML = "";
    }

    faroBackToGames.hidden = true;
    faroGamesMenu.hidden = false;

}

if (faroBackToGames) {
    faroBackToGames.addEventListener("click", closeFaroGame);
}

// Spiel-Dateien werden nach fuchs.js geladen und rufen register()
// selbst auf. Einmal initial rendern, damit auch ohne Spiele der
// leere Zustand erscheint.
renderFaroGameMenu();


/* =====================================================
   3. FLINKFUNK – KLEINES RADIO-EASTER-EGG
   ===================================================== */

const flinkfunkRadio = document.getElementById("flinkfunk-radio");
const fluteSound = new Audio("Sounds/radio_flute/flute_song.mp3");

let noteInterval;

if (flinkfunkRadio) {

    flinkfunkRadio.addEventListener("click", function () {

        if (typeof isSoundOn !== "function" || isSoundOn()) {
            fluteSound.currentTime = 0;
            fluteSound.play().catch(function () {});
        }

        clearInterval(noteInterval);
        createMusicNote();

        noteInterval = setInterval(function () {
            const amount = Math.floor(Math.random() * 2) + 1;
            for (let i = 0; i < amount; i++) {
                createMusicNote();
            }
        }, 700);

    });

}

fluteSound.addEventListener("ended", function () {
    clearInterval(noteInterval);
});

function createMusicNote() {

    const symbols = ["♫", "♪", "♬"];
    const box = document.getElementById("flinkfunk-box");

    if (!box) {
        return;
    }

    const note = document.createElement("span");
    note.classList.add("floating-note");
    note.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    note.style.left = (20 + Math.random() * 60) + "px";
    note.style.top = (20 + Math.random() * 20) + "px";
    note.style.fontSize = (22 + Math.random() * 12) + "px";

    box.appendChild(note);

    setTimeout(function () {
        note.remove();
    }, 2000);

}
