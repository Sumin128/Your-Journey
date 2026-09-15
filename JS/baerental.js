/* =====================================================
   BÄRENTAL – SEITEN
   Branos Spielhalle: Willkommen -> Spielmenü -> Lokal/Computer/Online
   -> Mirelons Jagd / Miro (eingebettet, siehe JS/jagd-ui.js +
   JS/miro-ui.js) -> zurück zum Menü. Das frühere "Wer ist es?" wurde
   verworfen und vollständig entfernt (lief nicht zuverlässig).
   ===================================================== */

if (typeof markAnimalVisited === "function") {
    markAnimalVisited("branos");
}

const bearWelcome = document.getElementById("bear-welcome");
const bearGameMenu = document.getElementById("bear-game-menu");
const bearModeChoice = document.getElementById("bear-mode-choice");
const bearJagdEmbed = document.getElementById("bear-jagd-embed");
const bearMiroEmbed = document.getElementById("bear-miro-embed");

const bearStartButton = document.getElementById("bear-start-button");
const backToBranos = document.getElementById("back-to-branos");
const openJagdGame = document.getElementById("open-jagd-game");
const openMiroGame = document.getElementById("open-miro-game");

var pendingGameType = null; // "mirelons_jagd" | "miro" - zwischen Spielmenü und Moduswahl


/* =====================================================
   WILLKOMMEN → SPIELMENÜ
   ===================================================== */

if (bearStartButton) {
    bearStartButton.addEventListener("click", function () {
        bearWelcome.hidden = true;
        bearGameMenu.hidden = false;
    });
}


/* =====================================================
   SPIELMENÜ → BRANOS
   ===================================================== */

if (backToBranos) {
    backToBranos.addEventListener("click", function () {
        bearGameMenu.hidden = true;
        bearWelcome.hidden = false;
    });
}


/* =====================================================
   SPIELMENÜ → "WIE MÖCHTEST DU SPIELEN?"
   ===================================================== */

if (openJagdGame) {
    openJagdGame.addEventListener("click", function () {
        pendingGameType = "mirelons_jagd";
        bearGameMenu.hidden = true;
        bearModeChoice.hidden = false;
    });
}

if (openMiroGame) {
    openMiroGame.addEventListener("click", function () {
        pendingGameType = "miro";
        bearGameMenu.hidden = true;
        bearModeChoice.hidden = false;
    });
}

document.getElementById("mp-mode-back").addEventListener("click", function () {
    pendingGameType = null;
    bearModeChoice.hidden = true;
    bearGameMenu.hidden = false;
});

/* Lokal und "gegen Computer" laufen beide über dasselbe, unveränderte
   Setup-/Modusauswahl-Bildschirm des jeweiligen Spiels - der lässt
   schon heute jede Mischung aus Mensch/Computer zu, es gibt bewusst
   keine zweite, doppelte Auswahl dafür. */
function openLocalEmbed(gameType) {
    bearModeChoice.hidden = true;
    if (gameType === "mirelons_jagd") {
        bearJagdEmbed.hidden = false;
        // Jagds eigene Startkarten-Auswahl (Jagd/Miro/Tierversteck) wird
        // übersprungen - Branos Spielmenü ist bereits diese Auswahl.
        var landing = document.getElementById("jagd-landing");
        var modeselect = document.getElementById("jagd-modeselect");
        if (landing) { landing.hidden = true; }
        if (modeselect) { modeselect.hidden = false; }
    } else {
        bearMiroEmbed.hidden = false;
    }
}

document.getElementById("mp-mode-local").addEventListener("click", function () { openLocalEmbed(pendingGameType); });
document.getElementById("mp-mode-computer").addEventListener("click", function () { openLocalEmbed(pendingGameType); });

// Jagds eigener "Zurück"-Knopf in der Modusauswahl würde ohne dies zu
// Jagds eigener (übersprungener) Startkarten-Auswahl zurückspringen -
// zusätzlich zum Klick von JS/jagd-ui.js zurück zu Branos' Spielmenü.
var jagdBackLanding = document.getElementById("jagd-back-landing");
if (jagdBackLanding) {
    jagdBackLanding.addEventListener("click", function () {
        window.BranosSpielhalle.leaveGame();
    });
}


/* =====================================================
   ONLINE MIT RAUMCODE
   ===================================================== */

function myDisplayName() {
    return (typeof player !== "undefined" && player && player.name) ? player.name : "Gastgeber";
}

document.getElementById("mp-mode-online").addEventListener("click", function () {
    bearModeChoice.hidden = true;
    var gameType = pendingGameType;
    window.MultiplayerLobbyUI.open({
        gameType: gameType,
        defaultMaxPlayers: 4,
        playerName: myDisplayName(),
        onBack: function () {
            bearGameMenu.hidden = false;
        },
        onGameStart: function (session) {
            if (gameType === "mirelons_jagd") {
                bearJagdEmbed.hidden = false;
                window.JagdMultiplayerAdapter.attach(session);
            } else {
                bearMiroEmbed.hidden = false;
                window.MiroMultiplayerAdapter.attach(session);
            }
        }
    });
});


/* =====================================================
   SPIEL VERLASSEN → ZURÜCK ZUM SPIELMENÜ
   Von JS/jagd-ui.js ("Partie verlassen"/Neue Partie) und
   JS/miro-ui.js ("← Zurück zu Branos' Spielen"/"🚪 Verlassen") aufgerufen.
   ===================================================== */

window.BranosSpielhalle = {
    leaveGame: function () {
        if (window.MiroOnline && window.MiroOnline.active && window.MiroOnline.session) {
            window.MiroOnline.session.leave();
        }
        if (window.JagdOnline && window.JagdOnline.active && window.JagdOnline.session) {
            window.JagdOnline.session.leave();
        }
        window.MiroOnline = { active: false };
        window.JagdOnline = { active: false };
        window.MultiplayerLobbyUI.setBanner("");
        bearJagdEmbed.hidden = true;
        bearMiroEmbed.hidden = true;
        bearGameMenu.hidden = false;
    }
};
