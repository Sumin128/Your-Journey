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


const kuroCursorButton =
    document.querySelector("#kuro-cursor-button");

const kuroCursorPrice = 90;


const hasenCursorButton =
    document.querySelector("#hasen-cursor-button");

const hasenCursorPrice = 100;


const goldenFeatherCursorButton =
    document.querySelector("#golden-feather-cursor-button");

const goldenFeatherCursorPrice = 300;


const blackGoldenFeatherCursorButton =
    document.querySelector("#blackgolden-feather-cursor-button");

const blackGoldenFeatherCursorPrice = 300;

/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Bärencursor
   ===================================================== */

function buyBearCursor() {

    if (player.items.bearCursor) {

        player.activeCursor = "bear";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        updateBearCursorButton();

        return;
    }

    if (player.feathers < bearCursorPrice) {

        showMirelonToast(
            "Dir fehlen noch " + (bearCursorPrice - player.feathers) + " 🪶, um den Bären-Cursor zu kaufen.",
            "error"
        );

        return;
    }

    player.feathers -= bearCursorPrice;

    player.items.bearCursor = true;

    player.activeCursor = "bear";

    if (typeof registerShopPurchase === "function") {
        registerShopPurchase();
    }

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

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

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        updateUnicornCursorButton();

        return;
    }

    if (player.feathers < unicornCursorPrice) {

        showMirelonToast(
            "Dir fehlen noch " + (unicornCursorPrice - player.feathers) + " 🪶, um den Einhorn-Cursor zu kaufen.",
            "error"
        );

        return;
    }

    player.feathers -= unicornCursorPrice;

    player.items.unicornCursor = true;

    player.activeCursor = "unicorn";

    if (typeof registerShopPurchase === "function") {
        registerShopPurchase();
    }

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    updateShopPlayer();

    updateUnicornCursorButton();

}

/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Kuro-Cursor
   ===================================================== */

function buyKuroCursor() {

    if (player.items.kuroCursor) {

        player.activeCursor = "kuro";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        updateKuroCursorButton();

        return;
    }

    if (player.feathers < kuroCursorPrice) {

        showMirelonToast(
            "Dir fehlen noch " + (kuroCursorPrice - player.feathers) + " 🪶, um den Kuro-Cursor zu kaufen.",
            "error"
        );

        return;
    }

    player.feathers -= kuroCursorPrice;

    player.items.kuroCursor = true;

    player.activeCursor = "kuro";

    if (typeof registerShopPurchase === "function") {
        registerShopPurchase();
    }

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    updateShopPlayer();

    updateKuroCursorButton();

}

/* =====================================================
   KUROS LADEN
   Update des Kuro-Cursor Buttons
   ===================================================== */

function updateKuroCursorButton() {

    if (!kuroCursorButton) {
        return;
    }

    if (!player.items.kuroCursor) {

        kuroCursorButton.textContent = "Kaufen";
        kuroCursorButton.disabled = false;

        return;
    }

    if (player.activeCursor === "kuro") {

        kuroCursorButton.textContent = "Aktiv";
        kuroCursorButton.disabled = true;

    } else {

        kuroCursorButton.textContent = "Aktivieren";
        kuroCursorButton.disabled = false;

    }

}

/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Hasen-Cursor
   ===================================================== */

function buyHasenCursor() {

    if (player.items.hasenCursor) {

        player.activeCursor = "hasen";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        updateHasenCursorButton();

        return;
    }

    if (player.feathers < hasenCursorPrice) {

        showMirelonToast(
            "Dir fehlen noch " + (hasenCursorPrice - player.feathers) + " 🪶, um den Hasen-Cursor zu kaufen.",
            "error"
        );

        return;
    }

    player.feathers -= hasenCursorPrice;

    player.items.hasenCursor = true;

    player.activeCursor = "hasen";

    if (typeof registerShopPurchase === "function") {
        registerShopPurchase();
    }

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    updateShopPlayer();

    updateHasenCursorButton();

}

/* =====================================================
   KUROS LADEN
   Update des Hasen-Cursor Buttons
   ===================================================== */

function updateHasenCursorButton() {

    if (!hasenCursorButton) {
        return;
    }

    if (!player.items.hasenCursor) {

        hasenCursorButton.textContent = "Kaufen";
        hasenCursorButton.disabled = false;

        return;
    }

    if (player.activeCursor === "hasen") {

        hasenCursorButton.textContent = "Aktiv";
        hasenCursorButton.disabled = true;

    } else {

        hasenCursorButton.textContent = "Aktivieren";
        hasenCursorButton.disabled = false;

    }

}

/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Goldene-Feder-Cursor
   ===================================================== */

function buyGoldenFeatherCursor() {

    if (player.items.goldenFeatherCursor) {

        player.activeCursor = "goldenfeather";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        updateGoldenFeatherCursorButton();

        return;
    }

    if (player.feathers < goldenFeatherCursorPrice) {

        showMirelonToast(
            "Dir fehlen noch " + (goldenFeatherCursorPrice - player.feathers) + " 🪶, um die Goldene Feder zu kaufen.",
            "error"
        );

        return;
    }

    player.feathers -= goldenFeatherCursorPrice;

    player.items.goldenFeatherCursor = true;

    player.activeCursor = "goldenfeather";

    if (typeof registerShopPurchase === "function") {
        registerShopPurchase();
    }

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    updateShopPlayer();

    updateGoldenFeatherCursorButton();

}

/* =====================================================
   KUROS LADEN
   Update des Goldene-Feder-Cursor Buttons
   ===================================================== */

function updateGoldenFeatherCursorButton() {

    if (!goldenFeatherCursorButton) {
        return;
    }

    if (!player.items.goldenFeatherCursor) {

        goldenFeatherCursorButton.textContent = "Kaufen";
        goldenFeatherCursorButton.disabled = false;

        return;
    }

    if (player.activeCursor === "goldenfeather") {

        goldenFeatherCursorButton.textContent = "Aktiv";
        goldenFeatherCursorButton.disabled = true;

    } else {

        goldenFeatherCursorButton.textContent = "Aktivieren";
        goldenFeatherCursorButton.disabled = false;

    }

}

/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Schwarzgoldene-Feder-Cursor
   ===================================================== */

function buyBlackGoldenFeatherCursor() {

    if (player.items.blackGoldenFeatherCursor) {

        player.activeCursor = "blackgoldenfeather";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        updateBlackGoldenFeatherCursorButton();

        return;
    }

    if (player.feathers < blackGoldenFeatherCursorPrice) {

        showMirelonToast(
            "Dir fehlen noch " + (blackGoldenFeatherCursorPrice - player.feathers) + " 🪶, um die Schwarzgoldene Feder zu kaufen.",
            "error"
        );

        return;
    }

    player.feathers -= blackGoldenFeatherCursorPrice;

    player.items.blackGoldenFeatherCursor = true;

    player.activeCursor = "blackgoldenfeather";

    if (typeof registerShopPurchase === "function") {
        registerShopPurchase();
    }

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    updateShopPlayer();

    updateBlackGoldenFeatherCursorButton();

}

/* =====================================================
   KUROS LADEN
   Update des Schwarzgoldene-Feder-Cursor Buttons
   ===================================================== */

function updateBlackGoldenFeatherCursorButton() {

    if (!blackGoldenFeatherCursorButton) {
        return;
    }

    if (!player.items.blackGoldenFeatherCursor) {

        blackGoldenFeatherCursorButton.textContent = "Kaufen";
        blackGoldenFeatherCursorButton.disabled = false;

        return;
    }

    if (player.activeCursor === "blackgoldenfeather") {

        blackGoldenFeatherCursorButton.textContent = "Aktiv";
        blackGoldenFeatherCursorButton.disabled = true;

    } else {

        blackGoldenFeatherCursorButton.textContent = "Aktivieren";
        blackGoldenFeatherCursorButton.disabled = false;

    }

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

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        updateFoxCursorButton();

        return;
    }

    if (player.feathers < foxCursorPrice) {

        showMirelonToast(
            "Dir fehlen noch " + (foxCursorPrice - player.feathers) + " 🪶, um den Fuchs-Cursor zu kaufen.",
            "error"
        );

        return;
    }

    player.feathers -= foxCursorPrice;

    player.items.foxCursor = true;

    player.activeCursor = "fox";

    if (typeof registerShopPurchase === "function") {
        registerShopPurchase();
    }

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    updateShopPlayer();

    updateFoxCursorButton();

}

/* =====================================================
   KUROS LADEN
   Update des Fuchscursor Buttons
   ===================================================== */ 

function updateFoxCursorButton() {

    if (!foxCursorButton) {
        return;
    }

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
updateKuroCursorButton();
updateHasenCursorButton();
updateGoldenFeatherCursorButton();
updateBlackGoldenFeatherCursorButton();

if (foxCursorButton) {
    foxCursorButton.addEventListener("click", buyFoxCursor);
}

if (bearCursorButton) {
    bearCursorButton.addEventListener("click", buyBearCursor);
}

if (unicornCursorButton) {
    unicornCursorButton.addEventListener("click", buyUnicornCursor);
}

if (kuroCursorButton) {
    kuroCursorButton.addEventListener("click", buyKuroCursor);
}

if (hasenCursorButton) {
    hasenCursorButton.addEventListener("click", buyHasenCursor);
}

if (goldenFeatherCursorButton) {
    goldenFeatherCursorButton.addEventListener("click", buyGoldenFeatherCursor);
}

if (blackGoldenFeatherCursorButton) {
    blackGoldenFeatherCursorButton.addEventListener("click", buyBlackGoldenFeatherCursor);
}

window.addEventListener(
    "player-updated",
    updateShopPlayer
);