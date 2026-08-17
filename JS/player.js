/* =====================================================
   PLAYER.JS
   Zentrales Spielersystem für Your Journey
   ===================================================== */


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

    berries: 0,

    activeCursor: "default",

    settings: {

        soundOn: true,

        theme: "light"

    },

    items: {

    foxCursor: false,
    bearCursor: false,
     unicornCursor: false
},

    friends: {

        kuro: 0,

        olivia: 0,

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

    /* Falls ältere Speicherstände keine Freunde haben */

    if (!player.friends) {

        player.friends = {

            kuro: 0,

            olivia: 0,

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


    if (player.settings.theme !== "dark") {

        player.settings.theme = "light";

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

        if (player.avatar) {

            avatar.src = player.avatar;

            avatar.style.display = "block";

        } else {

            avatar.removeAttribute("src");

        }

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
   5. SPIELERNAME SPEICHERN
   ===================================================== */

function setPlayerName(name) {

    const cleanName =
        name.trim();

    if (!cleanName) {

        return;

    }

    player.name = cleanName;

    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}


/* =====================================================
   6. NAMENSEINGABE EINRICHTEN
   ===================================================== */

function setupPlayerName() {

    const playerNameInput =
        document.getElementById("player-name");

    const saveNameButton =
        document.getElementById("save-name");

    const nameArea =
        document.getElementById("kuro-name-area");


    /*
       Wenn auf der aktuellen Seite keine Namenseingabe
       existiert, passiert einfach nichts.
    */

    if (!playerNameInput || !saveNameButton) {

        return;

    }


    /* Gespeicherten Namen anzeigen */

    if (player.name) {

        playerNameInput.value =
            player.name;

        /*
           Wenn bereits ein Name existiert,
           brauchen wir die Eingabe zunächst nicht.
        */

        if (nameArea) {

            nameArea.style.display = "none";

        }

    }


    saveNameButton.addEventListener(
        "click",
        function() {

            setPlayerName(
                playerNameInput.value
            );

            if (player.name && nameArea) {

                nameArea.style.display = "none";

            }

        }
    );


    /*
       Enter funktioniert ebenfalls
    */

    playerNameInput.addEventListener(
        "keydown",
        function(event) {

            if (event.key === "Enter") {

                setPlayerName(
                    playerNameInput.value
                );

                if (player.name && nameArea) {

                    nameArea.style.display = "none";

                }

            }

        }
    );

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


    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

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
   8c. DUNKELMODUS
   ===================================================== */

function isDarkMode() {

    return Boolean(
        player.settings &&
        player.settings.theme === "dark"
    );

}


function applyTheme() {

    document.documentElement.setAttribute(
        "data-theme",
        isDarkMode() ? "dark" : "light"
    );

}


function setDarkMode(value) {

    player.settings.theme = value ? "dark" : "light";

    savePlayer();

    applyTheme();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}


/* =====================================================
   9. AVATARE
   ===================================================== */

const avatarOptions = [

    "avatare/avatar1.PNG",
    "avatare/avatar2.PNG",
    "avatare/avatar3.PNG",
    "avatare/avatar4.PNG",
    "avatare/avatar5.PNG",
    "avatare/avatar6.PNG"

];


/* =====================================================
   10. AVATAR SPEICHERN
   ===================================================== */

function setPlayerAvatar(avatarPath) {

    player.avatar = avatarPath;

    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}


/* =====================================================
   11. AVATARAUSWAHL ERSTELLEN
   ===================================================== */

function buildAvatarSelection() {

    const avatarSelection =
        document.getElementById("avatar-selection");

    if (!avatarSelection) {

        return;

    }


    avatarSelection.innerHTML = "";


    avatarOptions.forEach(function(avatarPath) {

        const avatarImage =
            document.createElement("img");

        avatarImage.src =
            avatarPath;

        avatarImage.alt =
            "Avatar auswählen";

        avatarImage.classList.add(
            "avatar"
        );


        /*
           Aktuellen Avatar markieren
        */

        if (player.avatar === avatarPath) {

            avatarImage.classList.add(
                "selected"
            );

        }


        avatarImage.addEventListener(
            "click",
            function() {

                setPlayerAvatar(
                    avatarPath
                );


                /*
                   Auswahl schließen
                */

                avatarSelection.hidden = true;


                /*
                   Markierung aktualisieren
                */

                const allAvatars =
                    avatarSelection.querySelectorAll(
                        ".avatar"
                    );

                allAvatars.forEach(
                    function(image) {

                        image.classList.remove(
                            "selected"
                        );

                    }
                );

                avatarImage.classList.add(
                    "selected"
                );

            }
        );


        avatarSelection.appendChild(
            avatarImage
        );

    });

}


/* =====================================================
   12. AVATAR ANKLICKEN
   ===================================================== */

function setupAvatarClick() {

    const playerAvatar =
        document.getElementById(
            "player-avatar"
        );

    const avatarSelection =
        document.getElementById(
            "avatar-selection"
        );


    /*
       Manche Seiten haben keine Avatar-Auswahl.
       Dann passiert einfach nichts.
    */

    if (!playerAvatar || !avatarSelection) {

        return;

    }


    playerAvatar.style.cursor =
        "pointer";


    playerAvatar.addEventListener(
        "click",
        function() {

            avatarSelection.hidden =
                !avatarSelection.hidden;

        }
    );

}


/* =====================================================
   13. AVATAR-AUSWAHL VORBEREITEN
   ===================================================== */

function setupAvatarSelection() {

    const avatarSelection =
        document.getElementById(
            "avatar-selection"
        );

    if (!avatarSelection) {

        return;

    }


    /*
       Beim Start verstecken.
    */

    avatarSelection.hidden = true;


    buildAvatarSelection();

    setupAvatarClick();

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

}


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
            "url('Icons/Cursor/bear_cursor.png') 4 4, auto";
    }


    if (
    player.activeCursor === "unicorn" &&
    player.items &&
    player.items.unicornCursor === true
) {
    cursor =
        "url('Icons/Cursor/unicorn_cursor.png') 4 4, auto";
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
       3. Namenseingabe einrichten
       (nur auf Seiten, auf denen sie existiert)
    */

    setupPlayerName();


    /*
       4. Avatar-Auswahl einrichten
       (nur auf Seiten, auf denen sie existiert)
    */

    setupAvatarSelection();


    /*
       5. Gespeicherten Cursor anwenden
    */

    applyCursor();


    /*
       6. Gespeicherten Farbmodus anwenden
    */

    applyTheme();

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
