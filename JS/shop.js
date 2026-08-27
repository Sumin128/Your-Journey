/* =====================================================
   KUROS LADEN
   Zeigt den gespeicherten Spieler und seine Münzen an
   ===================================================== */

function updateShopPlayer() {
    const featherCount = document.getElementById("feather-count");
    const playerName = document.getElementById("shop-player-name");

    if (featherCount) {
        featherCount.innerHTML =
            '<img src="images/muenze.png" alt="" class="coin-icon"> ' +
            player.coins + " Münzen";
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


const luisCursorButton =
    document.querySelector("#luis-cursor-button");

const luisCursorPrice = 500;

/* =====================================================
   KUROS LADEN
   Gemeinsame Kauf-Funktion für alle Cursor-Items.

   Für eingeloggte Nutzer läuft der eigentliche Kauf atomar über die
   purchase_item()-Funktion (siehe
   supabase_migration_security_player_data.sql): Preis nachschlagen,
   Guthaben prüfen, Münzen abziehen, Item gutschreiben - alles
   serverseitig in einem Schritt, der Client kann diesen Vorgang
   nicht in zwei separate, für sich manipulierbare Schritte
   zerlegen. Erst wenn der Server Erfolg meldet, wird das Item
   lokal als gekauft übernommen (mit dem vom Server zurückgegebenen
   Münzstand, nicht mit einer selbst gerechneten Differenz).

   Für Gäste ohne Konto (kein Server zum Absichern vorhanden) bleibt
   der Kauf wie bisher rein lokal.
   ===================================================== */

async function purchaseCursorItem(options) {

    const itemKey = options.itemKey;
    const price = options.price;
    const cursorName = options.cursorName;
    const updateButton = options.updateButton;

    if (player.items[itemKey]) {

        player.activeCursor = cursorName;

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        updateButton();

        return;

    }

    if (player.coins < price) {

        showMirelonToast(
            "Dir fehlen noch " + (price - player.coins) + " 🪙, um dieses Item zu kaufen.",
            "error"
        );

        return;

    }

    const isLoggedIn =
        typeof supabaseClient !== "undefined" && supabaseClient &&
        typeof currentSession !== "undefined" && currentSession;

    if (isLoggedIn) {

        const rpcResult = await supabaseClient.rpc("purchase_item", { item_key: itemKey });

        if (rpcResult.error) {

            showMirelonToast(
                "Kauf fehlgeschlagen: " + rpcResult.error.message,
                "error"
            );

            return;

        }

        if (rpcResult.data && typeof rpcResult.data.coins === "number") {
            player.coins = rpcResult.data.coins;
        }

    } else {

        player.coins -= price;

    }

    player.items[itemKey] = true;

    player.activeCursor = cursorName;

    if (typeof registerShopPurchase === "function") {
        registerShopPurchase();
    }

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    updateShopPlayer();

    updateButton();

}


/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Bärencursor
   ===================================================== */

function buyBearCursor() {

    purchaseCursorItem({
        itemKey: "bearCursor",
        price: bearCursorPrice,
        cursorName: "bear",
        updateButton: updateBearCursorButton
    });

}


/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Einhorncursor
   ===================================================== */

function buyUnicornCursor() {

    purchaseCursorItem({
        itemKey: "unicornCursor",
        price: unicornCursorPrice,
        cursorName: "unicorn",
        updateButton: updateUnicornCursorButton
    });

}

/* =====================================================
   KUROS LADEN
   Kauf Funktion für den Kuro-Cursor
   ===================================================== */

function buyKuroCursor() {

    purchaseCursorItem({
        itemKey: "kuroCursor",
        price: kuroCursorPrice,
        cursorName: "kuro",
        updateButton: updateKuroCursorButton
    });

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

    purchaseCursorItem({
        itemKey: "hasenCursor",
        price: hasenCursorPrice,
        cursorName: "hasen",
        updateButton: updateHasenCursorButton
    });

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

    purchaseCursorItem({
        itemKey: "goldenFeatherCursor",
        price: goldenFeatherCursorPrice,
        cursorName: "goldenfeather",
        updateButton: updateGoldenFeatherCursorButton
    });

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

    purchaseCursorItem({
        itemKey: "blackGoldenFeatherCursor",
        price: blackGoldenFeatherCursorPrice,
        cursorName: "blackgoldenfeather",
        updateButton: updateBlackGoldenFeatherCursorButton
    });

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
   Kauf Funktion für den Luis-Cursor
   ===================================================== */

function buyLuisCursor() {

    purchaseCursorItem({
        itemKey: "luisCursor",
        price: luisCursorPrice,
        cursorName: "luis",
        updateButton: updateLuisCursorButton
    });

}

/* =====================================================
   KUROS LADEN
   Update des Luis-Cursor Buttons
   ===================================================== */

function updateLuisCursorButton() {

    if (!luisCursorButton) {
        return;
    }

    if (!player.items.luisCursor) {

        luisCursorButton.textContent = "Kaufen";
        luisCursorButton.disabled = false;

        return;
    }

    if (player.activeCursor === "luis") {

        luisCursorButton.textContent = "Aktiv";
        luisCursorButton.disabled = true;

    } else {

        luisCursorButton.textContent = "Aktivieren";
        luisCursorButton.disabled = false;

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

    purchaseCursorItem({
        itemKey: "foxCursor",
        price: foxCursorPrice,
        cursorName: "fox",
        updateButton: updateFoxCursorButton
    });

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
updateLuisCursorButton();

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

if (luisCursorButton) {
    luisCursorButton.addEventListener("click", buyLuisCursor);
}

window.addEventListener(
    "player-updated",
    updateShopPlayer
);