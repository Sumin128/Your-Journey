/* =====================================================
   PLAYER.JS
   Zentrales Spielersystem für Mirelon
   ===================================================== */


/* =====================================================
   0. AVATAR-PLATZHALTER
   Wird angezeigt, solange kein Avatar gewählt wurde,
   damit nirgends ein kaputtes Bild-Icon auftaucht.
   ===================================================== */

const AVATAR_PLACEHOLDER =
    "data:image/svg+xml;utf8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<circle cx="50" cy="50" r="50" fill="#96501e"/>' +
        '<path d="M50 20 C65 25 75 40 70 55 C65 70 50 78 50 78 C50 78 35 70 30 55 C25 40 35 25 50 20 Z" fill="#ffe2a5"/>' +
        '<line x1="50" y1="78" x2="50" y2="62" stroke="#96501e" stroke-width="3"/>' +
        '</svg>'
    );


/* =====================================================
   1. STANDARD-SPIELER
   ===================================================== */

let player = {

    name: "",

    avatar: "",

    feathers: 0,

    goldenFeathers: 0,

    totalFeathersEarned: 0,

    achievements: [],

    quizzesCompleted: 0,

    visitedAnimals: [],

    wordGameWins: [],

    puzzlesCompleted: 0,

    puzzleGalleryImagesUsed: [],

    memoryGamesCompleted: {

        normal: 0

    },

    highscorePoints: 0,

    berries: 0,

    activeCursor: "default",

    sidebarTheme: "baumrinde",

    settings: {

        soundOn: true

    },

    items: {

    foxCursor: false,
    bearCursor: false,
     unicornCursor: false,
    kuroCursor: false,
    hasenCursor: false,
    goldenFeatherCursor: false,
    blackGoldenFeatherCursor: false
},

    friends: {

        kuro: 0,

        tessa: 0,

        faro: 0

    }

};


/* =====================================================
   2. SPIELER SPEICHERN
   ===================================================== */

function savePlayer() {

    localStorage.setItem(
        "player",
        JSON.stringify(player)
    );

}


/* =====================================================
   3. SPIELER LADEN
   ===================================================== */

function loadPlayer() {

    const savedPlayer =
        localStorage.getItem("player");

    if (!savedPlayer) {

        return;

    }


    const loadedPlayer =
        JSON.parse(savedPlayer);


    /*
       Object.assign sorgt dafür,
       dass neue Eigenschaften aus unserem
       Standard-Spieler erhalten bleiben.
    */

    player = Object.assign(
        {},
        player,
        loadedPlayer
    );


    /* Falls ältere Speicherstände noch kein items haben */

    if (!player.items) {

    player.items = {

        foxCursor: false,
        bearCursor: false,
        unicornCursor: false

    };

}

/* Bären-Cursor bei älteren Speicherständen ergänzen */

if (typeof player.items.bearCursor === "undefined") {

    player.items.bearCursor = false;

}

if (typeof player.items.unicornCursor === "undefined") {

    player.items.unicornCursor = false;

}

if (typeof player.items.kuroCursor === "undefined") {

    player.items.kuroCursor = false;

}

if (typeof player.items.hasenCursor === "undefined") {

    player.items.hasenCursor = false;

}

if (typeof player.items.goldenFeatherCursor === "undefined") {

    player.items.goldenFeatherCursor = false;

}

if (typeof player.items.blackGoldenFeatherCursor === "undefined") {

    player.items.blackGoldenFeatherCursor = false;

}

    /* Falls ältere Speicherstände noch kein memoryGamesCompleted haben */

    if (!player.memoryGamesCompleted) {

        player.memoryGamesCompleted = {

            normal: 0

        };

    }

    if (typeof player.memoryGamesCompleted.normal !== "number") {

        player.memoryGamesCompleted.normal = 0;

    }


    /* Falls ältere Speicherstände keine Freunde haben */

    if (!player.friends) {

        player.friends = {

            kuro: 0,

            tessa: 0,

            faro: 0

        };

    }


    /* Alte Speicherstände vorbereiten */

    if (!Array.isArray(player.achievements)) {

        player.achievements = [];

    }


    if (typeof player.feathers !== "number") {

        player.feathers = 0;

    }


    if (typeof player.totalFeathersEarned !== "number") {

        player.totalFeathersEarned = player.feathers;

    }


    if (typeof player.goldenFeathers !== "number") {

        player.goldenFeathers = 0;

    }


    if (!player.activeCursor) {

        player.activeCursor = "default";

    }


    /* Falls ältere Speicherstände keine Einstellungen haben */

    if (!player.settings) {

        player.settings = {

            soundOn: true

        };

    }


    if (typeof player.settings.soundOn !== "boolean") {

        player.settings.soundOn = true;

    }



}


/* =====================================================
   4. SPIELERANZEIGE AKTUALISIEREN
   Aktualisiert Name, Avatar, Federn und Erfolge.
   Funktioniert auf jeder Seite, auf der diese IDs existieren.
   ===================================================== */

function updatePlayerUI() {

    const playerNameDisplays =
        document.querySelectorAll("#player-name-display");

    const playerAvatars =
        document.querySelectorAll("#player-avatar");

    const featherDisplays =
        document.querySelectorAll("#feather-count");

    const achievementDisplays =
        document.querySelectorAll("#achievement-count");


    /* NAME */

    playerNameDisplays.forEach(function(display) {

        display.textContent =
            player.name || "Abenteurer";

    });


    /* AVATAR */

    playerAvatars.forEach(function(avatar) {

        avatar.src = player.avatar || AVATAR_PLACEHOLDER;

        avatar.style.display = "block";

    });


    /* FEDERN */

    featherDisplays.forEach(function(display) {

        display.textContent =
            "🪶 " + player.feathers + " Federn";

    });


    /* ERFOLGE */

    achievementDisplays.forEach(function(display) {

        display.textContent =
            "⭐ " + player.achievements.length + " Erfolge";

    });


    /* KUROS BEGRÜSSUNG */

    const welcomeTitle =
        document.getElementById("welcome-title");

    if (welcomeTitle) {

        if (player.name) {

            welcomeTitle.textContent =
                "Hallo " + player.name + "!";

        } else {

            welcomeTitle.textContent =
                "Hallo!";

        }

    }

}


/* =====================================================
   7. FEDERN
   ===================================================== */

function addFeathers(amount) {

    if (amount <= 0) {

        return;

    }

    player.feathers += amount;

    player.totalFeathersEarned += amount;


    /*
       Goldene Feder:
       Für jeweils 100 insgesamt verdiente Federn
       bekommt der Spieler eine goldene Feder.
    */

    const earnedGoldenFeathers =
        Math.floor(
            player.totalFeathersEarned / 100
        );


    if (
        earnedGoldenFeathers >
        player.goldenFeathers
    ) {

        player.goldenFeathers =
            earnedGoldenFeathers;

    }


    checkFeatherMilestones();

    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}


/* =====================================================
   FEDERN-MEILENSTEINE
   ===================================================== */

const featherMilestoneAchievements = [
    { count: 10, name: "Erste Federn", description: "Verdiene insgesamt 10 Federn.", icon: "🪶" },
    { count: 100, name: "Federsammler", description: "Verdiene insgesamt 100 Federn.", icon: "🥉" },
    { count: 1000, name: "Federmeister", description: "Verdiene insgesamt 1000 Federn.", icon: "🏆" }
];

function checkFeatherMilestones() {

    featherMilestoneAchievements.forEach(function (milestone) {

        if (player.totalFeathersEarned >= milestone.count) {

            addAchievement(milestone.name);

        }

    });

}


/* =====================================================
   8. FEDERN AUSGEBEN
   ===================================================== */

function spendFeathers(amount) {

    if (amount <= 0) {

        return false;

    }


    if (player.feathers < amount) {

        return false;

    }


    player.feathers -= amount;

    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

    return true;

}

/* =====================================================
   8b. TON EIN / AUS
   ===================================================== */

function isSoundOn() {

    return Boolean(
        player.settings &&
        player.settings.soundOn
    );

}


function setSoundOn(value) {

    player.settings.soundOn = Boolean(value);

    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}


/* =====================================================
   14. ERFOLGE
   ===================================================== */

function addAchievement(achievementName) {

    if (!achievementName) {

        return;

    }


    /*
       Erfolg nicht doppelt vergeben.
    */

    if (
        player.achievements.includes(
            achievementName
        )
    ) {

        return;

    }


    player.achievements.push(
        achievementName
    );


    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

    showAchievementToast(achievementName);

}


/* =====================================================
   ERFOLGS-BENACHRICHTIGUNG
   ===================================================== */

function showAchievementToast(achievementName) {

    const toast =
        document.createElement("div");

    toast.className = "achievement-toast";

    toast.textContent =
        "🏆 Neuer Erfolg: " + achievementName + "!";

    document.body.appendChild(toast);

    setTimeout(function () {

        toast.classList.add("achievement-toast--show");

    }, 10);

    setTimeout(function () {

        toast.classList.remove("achievement-toast--show");

        setTimeout(function () {

            toast.remove();

        }, 400);

    }, 3500);

}


/* =====================================================
   HIGHSCORE-PUNKTE
   Gemeinsamer Punktestand über alle Spiele hinweg (Quiz,
   Wörterraten, Wer-ist-es, Puzzle) - unabhängig von den
   Federn. Jeder Sieg gibt den gleichen festen Punktewert.
   Speist die globale Bestenliste (bestenliste.html/highscore.js)
   über eine eigene Supabase-Tabelle (siehe
   supabase_schema_highscores.sql). Der eigentliche Punktestand
   in der Cloud wird serverseitig über die increment_highscore()-
   Funktion um einen festen Wert erhöht (nicht direkt vom Client
   gesetzt), damit niemand sich per Browser-Konsole einen
   beliebigen Punktestand eintragen kann.
   ===================================================== */

const HIGHSCORE_POINTS_PER_WIN = 10;

async function syncHighscoreToCloud() {

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        return;
    }

    try {

        const sessionResult = await supabaseClient.auth.getSession();
        const session = sessionResult.data.session;

        if (!session) {
            return;
        }

        const rpcResult = await supabaseClient.rpc("increment_highscore", {
            player_name_input: player.name || "Abenteurer",
        });

        if (rpcResult.error) {

            // Bestenliste ist ein Bonus-Feature - darf das Spiel nicht
            // sichtbar stoeren, aber der Fehler soll wenigstens in der
            // Konsole auftauchen, statt komplett spurlos zu verschwinden
            // (supabase.rpc() wirft bei einem serverseitigen Fehler keine
            // Exception, sondern liefert nur {error} im Ergebnis zurueck).

            console.warn("Bestenliste konnte nicht aktualisiert werden:", rpcResult.error);

        }

    } catch (error) {

        console.warn("Bestenliste konnte nicht aktualisiert werden:", error);

    }

}

function awardHighscorePoints() {

    if (typeof player.highscorePoints !== "number") {

        player.highscorePoints = 0;

    }

    player.highscorePoints += HIGHSCORE_POINTS_PER_WIN;

    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

    syncHighscoreToCloud();

}


/* =====================================================
   QUIZ-ERFOLGE BEI KURO
   Wird von JS/quiz.js aufgerufen, wenn ein Quiz
   zu Ende gespielt wurde.
   ===================================================== */

const quizCompletionAchievements = [
    { count: 1, name: "Erstes Quiz gemeistert", description: "Schließe dein erstes Quiz bei Kuro ab.", icon: "🥉" },
    { count: 3, name: "3 Quizze gemeistert", description: "Schließe 3 Quizze bei Kuro ab.", icon: "🥈" },
    { count: 5, name: "5 Quizze gemeistert", description: "Schließe 5 Quizze bei Kuro ab.", icon: "🥇" },
    { count: 10, name: "10 Quizze gemeistert", description: "Schließe 10 Quizze bei Kuro ab.", icon: "🏆" }
];

function registerQuizCompletion() {

    if (typeof player.quizzesCompleted !== "number") {

        player.quizzesCompleted = 0;

    }

    player.quizzesCompleted++;

    savePlayer();

    awardHighscorePoints();

    const unlockedAchievement = quizCompletionAchievements.find(
        function (achievement) {

            return achievement.count === player.quizzesCompleted;

        }
    );

    if (unlockedAchievement) {

        addAchievement(unlockedAchievement.name);

    }

}


/* =====================================================
   TIER-FREUNDE BESUCHEN
   Wird auf den Orts-Seiten (Kuros Nest, Hasenschule,
   Fuchsbau, Bärental, ...) aufgerufen. Kommt ein neuer
   Ort/Tier dazu, einfach hier in die Liste eintragen -
   der Erfolg passt sich automatisch an.
   ===================================================== */

const animalFriends = [
    { id: "kuro", name: "Kuro" },
    { id: "tessa", name: "Tessa" },
    { id: "faro", name: "Faro" },
    { id: "branos", name: "Branos" }
];

const visitAllAnimalsAchievement = {
    name: "Alle Tiere besucht",
    description: "Besuche Kuro, Tessa, Faro und Branos.",
    icon: "🐾"
};

function markAnimalVisited(animalId) {

    if (!Array.isArray(player.visitedAnimals)) {

        player.visitedAnimals = [];

    }

    if (player.visitedAnimals.includes(animalId)) {

        return;

    }

    player.visitedAnimals.push(animalId);

    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

    const allVisited = animalFriends.every(function (animal) {

        return player.visitedAnimals.includes(animal.id);

    });

    if (allVisited) {

        addAchievement(visitAllAnimalsAchievement.name);

    }

}


/* =====================================================
   WÖRTERRATEN-ERFOLGE
   Wird von JS/eulenschule.js aufgerufen, wenn eine
   Runde gewonnen wurde.
   ===================================================== */

const wordGameDifficultyAchievements = {
    leicht: { name: "Wörterraten: Leicht gemeistert", description: "Gewinne eine Runde Wörterraten auf Leicht.", icon: "🌼" },
    mittel: { name: "Wörterraten: Mittel gemeistert", description: "Gewinne eine Runde Wörterraten auf Mittel.", icon: "🌳" },
    schwer: { name: "Wörterraten: Schwer gemeistert", description: "Gewinne eine Runde Wörterraten auf Schwer.", icon: "🔥" }
};

const wordGameMasterAchievement = {
    name: "Wörterraten-Meister",
    description: "Gewinne eine Runde Wörterraten auf jeder Schwierigkeit.",
    icon: "📖"
};

function registerWordGameWin(difficulty) {

    if (!Array.isArray(player.wordGameWins)) {

        player.wordGameWins = [];

    }

    const difficultyAchievement = wordGameDifficultyAchievements[difficulty];

    if (!difficultyAchievement) {

        return;

    }

    awardHighscorePoints();

    if (!player.wordGameWins.includes(difficulty)) {

        player.wordGameWins.push(difficulty);

        savePlayer();

    }

    addAchievement(difficultyAchievement.name);

    const allDifficultiesWon = Object.keys(wordGameDifficultyAchievements).every(
        function (key) {

            return player.wordGameWins.includes(key);

        }
    );

    if (allDifficultiesWon) {

        addAchievement(wordGameMasterAchievement.name);

    }

}


/* =====================================================
   WER-IST-ES BEI BRANOS
   Wird von JS/baerental.js aufgerufen, wenn das geheime
   Tier richtig erraten wurde.
   ===================================================== */

function registerAnimalGuessWin() {

    awardHighscorePoints();

}


/* =====================================================
   MEMORY BEI TESSA
   Wird von JS/memory.js aufgerufen, wenn eine Memory-
   Runde fertig gespielt wurde (alle Paare gefunden).
   ===================================================== */

const memoryCompletionAchievements = [
    { count: 1, name: "Memory-Neuling", description: "Spiele Memory auf Normal 1 Mal.", icon: "🧠" },
    { count: 5, name: "Memory-Profi", description: "Spiele Memory auf Normal 5 Mal.", icon: "🃏" }
];

function registerMemoryCompletion(difficulty) {

    const level = difficulty || "normal";

    if (!player.memoryGamesCompleted) {
        player.memoryGamesCompleted = {};
    }

    if (typeof player.memoryGamesCompleted[level] !== "number") {
        player.memoryGamesCompleted[level] = 0;
    }

    player.memoryGamesCompleted[level]++;

    addFeathers(level === "schwer" ? 5 : 1);

    awardHighscorePoints();

    if (level === "normal") {

        const unlockedAchievement = memoryCompletionAchievements.find(function (achievement) {

            return achievement.count === player.memoryGamesCompleted.normal;

        });

        if (unlockedAchievement) {

            addAchievement(unlockedAchievement.name);

        }

    }

}


/* =====================================================
   PUZZLE-ERFOLGE
   Wird von JS/puzzle.js aufgerufen, wenn ein Puzzle
   fertig gelöst wurde.
   ===================================================== */

const puzzleCompletionAchievements = [
    { count: 5, name: "5 Puzzle gelöst", description: "Löse 5 Puzzle.", icon: "🧩" },
    { count: 10, name: "10 Puzzle gelöst", description: "Löse 10 Puzzle.", icon: "🧩" },
    { count: 20, name: "20 Puzzle gelöst", description: "Löse 20 Puzzle.", icon: "🧩" },
    { count: 50, name: "50 Puzzle gelöst", description: "Löse 50 Puzzle.", icon: "🧩" },
    { count: 100, name: "100 Puzzle gelöst", description: "Löse 100 Puzzle.", icon: "🧩" }
];

// Die 5 festen Bilder aus dem "Bilder aus Mirelon"-Abschnitt der
// Puzzle-Bildauswahl (siehe SITE_IMAGES in JS/puzzle-image-picker.js).
// Eigene, in der Malstube gemalte Bilder zählen hier bewusst nicht mit,
// da diese Liste unbegrenzt ist und "alle" damit nie erreichbar wäre.
const puzzleGalleryImages = [
    "Übersichtskarte",
    "Kuros Nest",
    "Tessas Hasenschule",
    "Faros Fuchsbau",
    "Bärental",
    "Luis"
];

const puzzleGalleryAchievement = {
    name: "Puzzle-Weltenbummler",
    description: "Löse ein Puzzle mit jedem Bild aus der Galerie.",
    icon: "🗺️"
};

function registerPuzzleCompletion(galleryImageLabel) {

    if (typeof player.puzzlesCompleted !== "number") {

        player.puzzlesCompleted = 0;

    }

    player.puzzlesCompleted++;

    if (galleryImageLabel) {

        if (!Array.isArray(player.puzzleGalleryImagesUsed)) {

            player.puzzleGalleryImagesUsed = [];

        }

        if (!player.puzzleGalleryImagesUsed.includes(galleryImageLabel)) {

            player.puzzleGalleryImagesUsed.push(galleryImageLabel);

        }

    }

    savePlayer();

    awardHighscorePoints();

    const unlockedCountAchievement = puzzleCompletionAchievements.find(
        function (achievement) {

            return achievement.count === player.puzzlesCompleted;

        }
    );

    if (unlockedCountAchievement) {

        addAchievement(unlockedCountAchievement.name);

    }

    if (galleryImageLabel) {

        const allGalleryImagesUsed = puzzleGalleryImages.every(function (label) {

            return player.puzzleGalleryImagesUsed.includes(label);

        });

        if (allGalleryImagesUsed) {

            addAchievement(puzzleGalleryAchievement.name);

        }

    }

}


/* =====================================================
   KUROS LADEN - KAUF-ERFOLGE (Liste)
   ===================================================== */

const shopItemAchievements = [
    { count: 1, name: "Erster Kauf", description: "Kaufe dein erstes Item in Kuros Laden.", icon: "🛍️" },
    { count: 2, name: "Fleißiger Käufer", description: "Kaufe 2 Items in Kuros Laden.", icon: "🛒" },
    { count: 3, name: "Sammler", description: "Kaufe alle 3 Cursor in Kuros Laden.", icon: "🎁" }
];


/* =====================================================
   GESAMTKATALOG ALLER ERFOLGE
   Wird von der Erfolge-Seite (erfolge.html) genutzt, um
   alle Erfolge (freigeschaltet oder nicht) anzuzeigen.
   ===================================================== */

const achievementCatalog = quizCompletionAchievements.concat([
    visitAllAnimalsAchievement,
    wordGameDifficultyAchievements.leicht,
    wordGameDifficultyAchievements.mittel,
    wordGameDifficultyAchievements.schwer,
    wordGameMasterAchievement
]).concat(puzzleCompletionAchievements).concat([
    puzzleGalleryAchievement
]).concat(featherMilestoneAchievements).concat(shopItemAchievements).concat(memoryCompletionAchievements);


/* =====================================================
   15. CURSOR ANWENDEN
   ===================================================== */

function applyCursor() {

    let cursor = "auto";

    if (
        player.activeCursor === "fox" &&
        player.items &&
        player.items.foxCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/fox_cursor.png') 4 4, auto";
    }


    if (
        player.activeCursor === "bear" &&
        player.items &&
        player.items.bearCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/bear_cursor.png') 8 12, auto";
    }


    if (
    player.activeCursor === "unicorn" &&
    player.items &&
    player.items.unicornCursor === true
) {
    cursor =
        "url('Icons/Cursor/unicorn_cursor.png') 4 4, auto";
}


    if (
        player.activeCursor === "kuro" &&
        player.items &&
        player.items.kuroCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/kuro_cursor.png') 6 37, auto";
    }


    if (
        player.activeCursor === "hasen" &&
        player.items &&
        player.items.hasenCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/hasen_cursor.png') 17 10, auto";
    }


    if (
        player.activeCursor === "goldenfeather" &&
        player.items &&
        player.items.goldenFeatherCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/golden_feather_cursor.png') 13 14, auto";
    }


    if (
        player.activeCursor === "blackgoldenfeather" &&
        player.items &&
        player.items.blackGoldenFeatherCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/blackgolden_feather_cursor.png') 10 13, auto";
    }


    document.documentElement.style.cursor = cursor;
    document.body.style.cursor = cursor;
}


/* =====================================================
   16. CURSOR ÄNDERN
   ===================================================== */

function setCursor(cursorName) {

    // Standardcursor
    if (cursorName === "default") {

        player.activeCursor = "default";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        return true;
    }

    // Fuchs
    if (
        cursorName === "fox" &&
        player.items &&
        player.items.foxCursor
    ) {

        player.activeCursor = "fox";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        return true;
    }

    // Bär
if (
    cursorName === "bear" &&
    player.items &&
    player.items.bearCursor
) {

    player.activeCursor = "bear";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Einhorn
if (
    cursorName === "unicorn" &&
    player.items &&
    player.items.unicornCursor
) {

    player.activeCursor = "unicorn";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Kuro
if (
    cursorName === "kuro" &&
    player.items &&
    player.items.kuroCursor
) {

    player.activeCursor = "kuro";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Hase
if (
    cursorName === "hasen" &&
    player.items &&
    player.items.hasenCursor
) {

    player.activeCursor = "hasen";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Goldene Feder
if (
    cursorName === "goldenfeather" &&
    player.items &&
    player.items.goldenFeatherCursor
) {

    player.activeCursor = "goldenfeather";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Schwarzgoldene Feder
if (
    cursorName === "blackgoldenfeather" &&
    player.items &&
    player.items.blackGoldenFeatherCursor
) {

    player.activeCursor = "blackgoldenfeather";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


return false;
}



/* =====================================================
   17. FUCHS-CURSOR FREISCHALTEN
   ===================================================== */

function unlockFoxCursor() {

    if (!player.items) {

        player.items = {};

    }


    player.items.foxCursor =
        true;


    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}

/* =====================================================
   BÄREN-CURSOR FREISCHALTEN
   ===================================================== */

function unlockBearCursor() {

    if (!player.items) {

        player.items = {};

    }

    player.items.bearCursor = true;

    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}
/* =====================================================
   18. CURSOR DEAKTIVIEREN
   ===================================================== */

function disableCustomCursor() {

    player.activeCursor =
        "default";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

}


/* =====================================================
   19. ITEM BESITZ PRÜFEN
   ===================================================== */

function hasItem(itemName) {

    if (!player.items) {

        return false;

    }


    return Boolean(
        player.items[itemName]
    );

}


/* =====================================================
   KUROS LADEN - KAUF-ERFOLGE
   Wird von JS/shop.js nach jedem erfolgreichen (neuen)
   Kauf aufgerufen und zählt, wie viele der Shop-Items
   der Spieler insgesamt besitzt. Die Erfolgsliste selbst
   (shopItemAchievements) steht weiter oben beim
   Gesamtkatalog, damit sie dort schon zur Verfügung steht.
   ===================================================== */

function countOwnedShopItems() {

    if (!player.items) {
        return 0;
    }

    return Object.values(player.items).filter(Boolean).length;

}

function registerShopPurchase() {

    const ownedCount = countOwnedShopItems();

    const unlockedAchievement = shopItemAchievements.find(function (achievement) {

        return achievement.count === ownedCount;

    });

    if (unlockedAchievement) {

        addAchievement(unlockedAchievement.name);

    }

}

/* =====================================================
   20. SPIELERSYSTEM INITIALISIEREN
   ===================================================== */

function initPlayer() {

    /*
       1. Gespeicherten Spieler laden
    */

    loadPlayer();


    /*
       2. Name, Avatar, Federn und Erfolge anzeigen
    */

    updatePlayerUI();


    /*
       3. Gespeicherten Cursor anwenden
    */

    applyCursor();

}


/* =====================================================
   21. UI AKTUALISIEREN, WENN SPIELERDATEN SICH ÄNDERN
   ===================================================== */

window.addEventListener(
    "player-updated",
    function() {

        updatePlayerUI();

        applyCursor();

    }
);


/* =====================================================
   22. SEITE STARTEN
   ===================================================== */

/*
   Da player.js bei dir am Ende des HTML geladen wird,
   existieren die HTML-Elemente zu diesem Zeitpunkt bereits.
*/

initPlayer();
