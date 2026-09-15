/* =====================================================
   BÄRENTAL – SEITEN
   Branos Spielhalle: Willkommen -> Spielmenü -> Mirelons Jagd / Miro
   (beide eingebettet, siehe JS/jagd-ui.js + JS/miro-ui.js) -> zurück
   zum Menü. Das frühere "Wer ist es?" wurde entfernt (lief nicht
   zuverlässig); JS/animals.js wird auf dieser Seite nicht mehr geladen.
   ===================================================== */

if (typeof markAnimalVisited === "function") {
    markAnimalVisited("branos");
}

const bearWelcome = document.getElementById("bear-welcome");
const bearGameMenu = document.getElementById("bear-game-menu");
const bearJagdEmbed = document.getElementById("bear-jagd-embed");
const bearMiroEmbed = document.getElementById("bear-miro-embed");

const bearStartButton = document.getElementById("bear-start-button");
const backToBranos = document.getElementById("back-to-branos");
const openJagdGame = document.getElementById("open-jagd-game");
const openMiroGame = document.getElementById("open-miro-game");


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
   SPIELMENÜ → MIRELONS JAGD / MIRO
   ===================================================== */

if (openJagdGame) {
    openJagdGame.addEventListener("click", function () {
        bearGameMenu.hidden = true;
        bearJagdEmbed.hidden = false;
        // Jagds eigene Startkarten-Auswahl (Jagd/Miro/Tierversteck) wird
        // übersprungen - Branos Spielmenü ist bereits diese Auswahl.
        var landing = document.getElementById("jagd-landing");
        var modeselect = document.getElementById("jagd-modeselect");
        if (landing) { landing.hidden = true; }
        if (modeselect) { modeselect.hidden = false; }
    });
}

if (openMiroGame) {
    openMiroGame.addEventListener("click", function () {
        bearGameMenu.hidden = true;
        bearMiroEmbed.hidden = false;
    });
}

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
   SPIEL VERLASSEN → ZURÜCK ZUM SPIELMENÜ
   Von JS/jagd-ui.js ("Partie verlassen"/Neue Partie) und
   JS/miro-ui.js ("← Zurück zu Branos' Spielen"/"🚪 Verlassen") aufgerufen.
   ===================================================== */

window.BranosSpielhalle = {
    leaveGame: function () {
        bearJagdEmbed.hidden = true;
        bearMiroEmbed.hidden = true;
        bearGameMenu.hidden = false;
    }
};
