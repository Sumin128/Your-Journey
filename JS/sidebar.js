/* =====================================================
   SIDEBAR
   ===================================================== */

const sidebar =
    document.getElementById("sidebar");

const sidebarToggle =
    document.getElementById("sidebar-toggle");

    if(localStorage.getItem("sidebarOpen") === "true"){

    sidebar.classList.add("open");

}

/* =====================================================
   ÖFFNEN / SCHLIESSEN
   ===================================================== */


/* =====================================================
   SPIELERDATEN ANZEIGEN
   ===================================================== */

function updateSidebarPlayer() {

    if (typeof player === "undefined") {
        return;
    }


    const avatar =
        document.getElementById(
            "sidebar-player-avatar"
        );

    const name =
        document.getElementById(
            "sidebar-player-name"
        );

    const feathers =
        document.getElementById(
            "sidebar-feathers"
        );

    const achievements =
        document.getElementById(
            "sidebar-achievements"
        );


    if (name) {

        name.textContent =
            player.name || "Abenteurer";

    }


    if (avatar) {

        avatar.src =
            player.avatar || AVATAR_PLACEHOLDER;

    }


    if (feathers) {

        feathers.textContent =
            "🪶 " + player.feathers + " Federn";

    }


    if (achievements) {

        const amount =
            Array.isArray(player.achievements)
                ? player.achievements.length
                : 0;

        achievements.textContent =
            "⭐ " + amount + " Erfolge";

    }

}


updateSidebarPlayer();


window.addEventListener(
    "player-updated",
    updateSidebarPlayer
);



if (sidebar && sidebarToggle) {

    sidebarToggle.addEventListener("click", function () {

        sidebar.classList.toggle("open");

        localStorage.setItem(
            "sidebarOpen",
            sidebar.classList.contains("open")
        );

    });

}

/* =====================================================
   INVENTAR
   ===================================================== */

const inventoryButton =
    document.getElementById("inventory-button");

    function createInventory() {

    // Falls der Rucksack bereits im HTML existiert,
    // keinen zweiten erstellen.
    if (document.getElementById("inventory-panel")) {
        return;
    }

    const panel = document.createElement("div");

    panel.id = "inventory-panel";
    panel.hidden = true;

    panel.innerHTML = `
        <div class="inventory-header">

            <h2>🎒 Dein Rucksack</h2>

            <button
                id="inventory-close"
                type="button">
                ✕
            </button>

        </div>

        <div class="inventory-items">

            <button
                id="inventory-fox-cursor"
                class="inventory-item"
                type="button">
                🦊 Fuchs-Cursor
            </button>

            <button
                id="inventory-bear-cursor"
                class="inventory-item"
                type="button">
                🐻 Bären-Cursor
            </button>

            <button
                id="inventory-unicorn-cursor"
                class="inventory-item"
                type="button">
                🦄 Einhorn-Cursor
            </button>

            <button
                id="inventory-default-cursor"
                class="inventory-item"
                type="button">
                🖱️ Standard-Cursor
            </button>

        </div>
    `;

    document.body.appendChild(panel);
}

createInventory();

const inventoryPanel =
    document.getElementById("inventory-panel");

const inventoryClose =
    document.getElementById("inventory-close");

if (inventoryButton && inventoryPanel) {

    inventoryButton.addEventListener("click", function () {

        inventoryPanel.hidden = !inventoryPanel.hidden;

    });

}

if (inventoryClose && inventoryPanel) {

    inventoryClose.addEventListener("click", function () {

        inventoryPanel.hidden = true;

    });

}

const inventoryFoxCursorButton =
    document.getElementById("inventory-fox-cursor");

const inventoryBearCursorButton =
    document.getElementById("inventory-bear-cursor");

    const inventoryUnicornCursorButton =
    document.getElementById("inventory-unicorn-cursor");

const inventoryDefaultCursorButton =
    document.getElementById("inventory-default-cursor");


if (inventoryFoxCursorButton) {

    inventoryFoxCursorButton.addEventListener("click", function () {

        setCursor("fox");

    });

}


if (inventoryBearCursorButton) {

    inventoryBearCursorButton.addEventListener("click", function () {

        setCursor("bear");

    });

}

if (inventoryUnicornCursorButton) {

    inventoryUnicornCursorButton.addEventListener("click", function () {

        setCursor("unicorn");

    });

}


if (inventoryDefaultCursorButton) {

    inventoryDefaultCursorButton.addEventListener("click", function () {

        setCursor("default");

    });

}