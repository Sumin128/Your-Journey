/* =====================================================
   KUROS LADEN
   Zeigt den gespeicherten Spieler und seine Federn an
   ===================================================== */

function updateShopPlayer() {
    const featherCount = document.getElementById("feather-count");
    const playerName = document.getElementById("shop-player-name");

    if (featherCount) {
        featherCount.textContent = player.feathers + " Federn";
    }

    if (playerName) {
        playerName.textContent = player.name
            ? "Profil: " + player.name
            : "Kein Profil geladen";
    }
}



/* =====================================================
   KUROS LADEN
   Items und kaufpreise
   ===================================================== */


const foxCursorButton =
    document.querySelector("#fox-cursor-button");

const foxCursorPrice = 30;


const bearCursorButton =
    document.querySelector("#bear-cursor-button");

const bearCursorPrice = 40;


const unicornCursorButton =
    document.querySelector("#unicorn-cursor-button");

const unicornCursorPrice = 200;
/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Bärencursor
   ===================================================== */

function buyBearCursor() {

    if (player.items.bearCursor) {

        player.activeCursor = "bear";

        savePlayer();

        applyCursor();

        updateBearCursorButton();

        return;
    }

    if (player.feathers < bearCursorPrice) {

        alert("Du hast nicht genug Federn.");

        return;
    }

    player.feathers -= bearCursorPrice;

    player.items.bearCursor = true;

    player.activeCursor = "bear";

    savePlayer();

    applyCursor();

    updateShopPlayer();

    updateBearCursorButton();

}


/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Einhorncursor
   ===================================================== */

function buyUnicornCursor() {

    if (player.items.unicornCursor) {

        player.activeCursor = "unicorn";

        savePlayer();

        applyCursor();

        updateUnicornCursorButton();

        return;
    }

    if (player.feathers < unicornCursorPrice) {

        alert("Du hast nicht genug Federn.");

        return;
    }

    player.feathers -= unicornCursorPrice;

    player.items.unicornCursor = true;

    player.activeCursor = "unicorn";

    savePlayer();

    applyCursor();

    updateShopPlayer();

    updateUnicornCursorButton();

}

/* =====================================================
   KUROS LADEN
   Update des Bärencursor Buttons
   ===================================================== */

function updateBearCursorButton() {

    if (!bearCursorButton) {
        return;
    }

    if (!player.items.bearCursor) {

        bearCursorButton.textContent = "Kaufen";
        bearCursorButton.disabled = false;

        return;
    }

    if (player.activeCursor === "bear") {

        bearCursorButton.textContent = "Aktiv";
        bearCursorButton.disabled = true;

    } else {

        bearCursorButton.textContent = "Aktivieren";
        bearCursorButton.disabled = false;

    }

}
/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Fuchscursor
   ===================================================== */


function buyFoxCursor() {

    if (player.items.foxCursor) {

        player.activeCursor = "fox";

        savePlayer();

        applyCursor();

        updateFoxCursorButton();

        return;
    }

    if (player.feathers < foxCursorPrice) {

        alert("Du hast nicht genug Federn.");

        return;
    }

    player.feathers -= foxCursorPrice;

    player.items.foxCursor = true;

    player.activeCursor = "fox";

    savePlayer();

    applyCursor();

    updateShopPlayer();

    updateFoxCursorButton();

}

/* =====================================================
   KUROS LADEN
   Update des Fuchscursor Buttons
   ===================================================== */ 

function updateFoxCursorButton() {

    if (!player.items.foxCursor) {

        foxCursorButton.textContent = "Kaufen";
        foxCursorButton.disabled = false;

        return;
    }

    if (player.activeCursor === "fox") {

        foxCursorButton.textContent = "Aktiv";
        foxCursorButton.disabled = true;

    } else {

        foxCursorButton.textContent = "Aktivieren";
        foxCursorButton.disabled = false;

    }

}

function updateUnicornCursorButton() {

    if (!unicornCursorButton) {
        return;
    }

    if (!player.items.unicornCursor) {

        unicornCursorButton.textContent = "Kaufen";
        unicornCursorButton.disabled = false;

        return;
    }

    if (player.activeCursor === "unicorn") {

        unicornCursorButton.textContent = "Aktiv";
        unicornCursorButton.disabled = true;

    } else {

        unicornCursorButton.textContent = "Aktivieren";
        unicornCursorButton.disabled = false;

    }

}

updateShopPlayer();

updateFoxCursorButton();


updateBearCursorButton();
updateUnicornCursorButton();

if (foxCursorButton) {
    foxCursorButton.addEventListener("click", buyFoxCursor);
}

if (bearCursorButton) {
    bearCursorButton.addEventListener("click", buyBearCursor);
}

if (unicornCursorButton) {
    unicornCursorButton.addEventListener("click", buyUnicornCursor);
}

window.addEventListener(
    "player-updated",
    updateShopPlayer
);