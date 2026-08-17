/* =====================================================
   INVENTAR
   ===================================================== */

const inventoryButton =
    document.getElementById("inventory-button");

const inventoryPanel =
    document.getElementById("inventory-panel");

const inventoryClose =
    document.getElementById("inventory-close");

const foxInventoryButton =
    document.getElementById("inventory-fox-cursor");

const bearInventoryButton =
    document.getElementById("inventory-bear-cursor");

const defaultCursorButton =
    document.getElementById("inventory-default-cursor");


/* =====================================================
   PANEL ÖFFNEN / SCHLIESSEN
   ===================================================== */

if (inventoryButton && inventoryPanel) {

    inventoryButton.addEventListener("click", function () {

        inventoryPanel.hidden =
            !inventoryPanel.hidden;

        updateInventory();

    });

}

if (inventoryClose && inventoryPanel) {

    inventoryClose.addEventListener("click", function () {

        inventoryPanel.hidden = true;

    });

}


/* =====================================================
   INVENTAR AKTUALISIEREN
   ===================================================== */

function updateInventory() {

    if (!foxInventoryButton || !bearInventoryButton) {
        return;
    }


    /* FUCHS BESITZ */

    if (player.items.foxCursor) {

        foxInventoryButton.disabled = false;

    } else {

        foxInventoryButton.disabled = true;

        foxInventoryButton.textContent =
            "🦊 Fuchs-Cursor – nicht freigeschaltet";

    }


    /* BÄR BESITZ */

    if (player.items.bearCursor) {

        bearInventoryButton.disabled = false;

    } else {

        bearInventoryButton.disabled = true;

        bearInventoryButton.textContent =
            "🐻 Bären-Cursor – nicht freigeschaltet";

    }


    /* MARKIERUNGEN ZURÜCKSETZEN */

    foxInventoryButton.classList.remove("active");
    bearInventoryButton.classList.remove("active");
    defaultCursorButton.classList.remove("active");


    /* AKTIVER CURSOR */

    if (player.activeCursor === "fox") {

        foxInventoryButton.textContent =
            "🦊 Fuchs-Cursor – Aktiv";

        foxInventoryButton.classList.add("active");

    } else if (player.items.foxCursor) {

        foxInventoryButton.textContent =
            "🦊 Fuchs-Cursor";

    }


    if (player.activeCursor === "bear") {

        bearInventoryButton.textContent =
            "🐻 Bären-Cursor – Aktiv";

        bearInventoryButton.classList.add("active");

    } else if (player.items.bearCursor) {

        bearInventoryButton.textContent =
            "🐻 Bären-Cursor";

    }


    if (player.activeCursor === "default") {

        defaultCursorButton.classList.add("active");

    }

}


/* =====================================================
   FUCHS-CURSOR
   ===================================================== */

if (foxInventoryButton) {

    foxInventoryButton.addEventListener("click", function () {

        if (!player.items.foxCursor) {
            return;
        }

        /*
           Wenn Fuchs schon aktiv ist:
           wieder deaktivieren.
        */

        if (player.activeCursor === "fox") {

            setCursor("default");

        } else {

            /*
               setCursor("fox") setzt automatisch
               nur den Fuchs als aktiven Cursor.
            */

            setCursor("fox");

        }

        updateInventory();

    });

}


/* =====================================================
   BÄREN-CURSOR
   ===================================================== */

if (bearInventoryButton) {

    bearInventoryButton.addEventListener("click", function () {

        if (!player.items.bearCursor) {
            return;
        }

        if (player.activeCursor === "bear") {

            setCursor("default");

        } else {

            setCursor("bear");

        }

        updateInventory();

    });

}


/* =====================================================
   STANDARD-CURSOR
   ===================================================== */

if (defaultCursorButton) {

    defaultCursorButton.addEventListener("click", function () {

        setCursor("default");

        updateInventory();

    });

}


/* =====================================================
   SPIELERÄNDERUNGEN
   ===================================================== */

window.addEventListener(
    "player-updated",
    updateInventory
);


updateInventory();