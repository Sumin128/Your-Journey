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
   FARBTHEME (Baumrinde / Smaragdwald)
   Wird als data-theme-Attribut direkt am #sidebar-Element
   gesetzt, die eigentlichen Farben stecken als CSS-Custom-
   Properties in style.css. Gilt für alle Nutzer über
   localStorage; bei einem Konto zusätzlich über Supabase
   geräteübergreifend synchronisiert (siehe weiter unten).
   ===================================================== */

const SIDEBAR_THEME_KEY = "mirelon-sidebar-theme";
const DEFAULT_SIDEBAR_THEME = "baumrinde";

// "baumrinde" ist der Standard und bekommt bewusst KEIN data-theme-
// Attribut (nutzt die Basiswerte direkt am #sidebar). Neue Themes
// hier einfach ergänzen.
const SIDEBAR_THEMES_WITH_ATTRIBUTE = ["smaragdwald", "zuckerwatte"];

function getSidebarTheme() {

    return localStorage.getItem(SIDEBAR_THEME_KEY) || DEFAULT_SIDEBAR_THEME;

}

function applySidebarTheme(theme) {

    if (!sidebar) {
        return;
    }

    if (SIDEBAR_THEMES_WITH_ATTRIBUTE.includes(theme)) {
        sidebar.setAttribute("data-theme", theme);
    } else {
        sidebar.removeAttribute("data-theme");
    }

    document.querySelectorAll("[data-theme-choice]").forEach(function (card) {
        card.classList.toggle("is-selected", card.dataset.themeChoice === theme);
    });

}

function setSidebarTheme(theme, skipCloudSync) {

    const validTheme =
        SIDEBAR_THEMES_WITH_ATTRIBUTE.includes(theme)
            ? theme
            : DEFAULT_SIDEBAR_THEME;

    localStorage.setItem(SIDEBAR_THEME_KEY, validTheme);

    applySidebarTheme(validTheme);

    if (!skipCloudSync && typeof isLoggedIn === "function" && isLoggedIn()) {
        pushSidebarThemeToCloud(validTheme);
    }

}

// Sofort beim Laden anwenden, bevor irgendetwas anderes passiert,
// damit nicht kurz das falsche Theme aufblitzt.
applySidebarTheme(getSidebarTheme());


/* =====================================================
   FARBTHEME <-> SUPABASE (nur bei angemeldetem Konto)
   Bewusst eigenständig gehalten (nutzt nur die globalen
   supabaseClient/currentSession/isLoggedIn() aus auth.js
   lesend), damit auth.js selbst nicht angefasst werden muss.
   Setzt voraus, dass die Spalte "sidebar_theme" in der
   profiles-Tabelle existiert (siehe Migrations-Hinweis).
   ===================================================== */

async function pushSidebarThemeToCloud(theme) {

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        return;
    }

    if (typeof currentSession === "undefined" || !currentSession) {
        return;
    }

    await supabaseClient
        .from("profiles")
        .update({ sidebar_theme: theme })
        .eq("id", currentSession.user.id);

}

async function pullSidebarThemeFromCloud() {

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        return;
    }

    if (typeof currentSession === "undefined" || !currentSession) {
        return;
    }

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select("sidebar_theme")
            .eq("id", currentSession.user.id)
            .single();

    if (error || !data) {
        return;
    }

    if (data.sidebar_theme) {

        // Cloud hat schon einen Wert - der gewinnt, damit alle
        // Geräte denselben Stand zeigen.
        setSidebarTheme(data.sidebar_theme, true);

    } else {

        // Erstes Login, Cloud kennt noch kein Theme -
        // aktuellen lokalen Stand einmalig hochladen.
        pushSidebarThemeToCloud(getSidebarTheme());

    }

}

if (typeof supabaseClient !== "undefined" && supabaseClient) {

    supabaseClient.auth.onAuthStateChange(function (event, session) {

        if (session) {
            pullSidebarThemeFromCloud();
        }

    });

}


/* =====================================================
   AUSKLAPPBARE GRUPPEN (Lernorte, Kreativ)
   Beim Laden ist nur die Gruppe offen, die die gerade
   aktive Seite enthält (erkennbar an aria-current) - sonst
   bleibt alles zu, damit die Sidebar kompakt bleibt.
   ===================================================== */

const sidebarGroupHeaders =
    document.querySelectorAll(".sidebar-group-header");

function setSidebarGroupOpen(header, isOpen) {

    const panel = header.nextElementSibling;

    if (!panel) {
        return;
    }

    header.classList.toggle("is-open", isOpen);
    header.setAttribute("aria-expanded", String(isOpen));
    panel.classList.toggle("is-open", isOpen);

}

sidebarGroupHeaders.forEach(function (header) {

    const panel = header.nextElementSibling;

    const containsActiveLink =
        Boolean(panel) && panel.querySelector('[aria-current="page"]') !== null;

    setSidebarGroupOpen(header, containsActiveLink);

    header.addEventListener("click", function () {

        setSidebarGroupOpen(header, !header.classList.contains("is-open"));

    });

});


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

            <h2><img src="images/inventar.png" alt="" class="inventory-icon inventory-icon--title"> Dein Rucksack</h2>

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