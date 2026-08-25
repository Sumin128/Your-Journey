/* =====================================================
   SIDEBAR
   ===================================================== */

const sidebar =
    document.getElementById("sidebar");

const sidebarToggle =
    document.getElementById("sidebar-toggle");

// Ab hier gilt die kompakte Mobile-Navigation (Topbar +
// Sidebar als Off-Canvas-Overlay) statt der dauerhaft
// sichtbaren Desktop-Sidebar. Siehe CSS/components/mobile-nav.css.
const mirelonMobileNavQuery =
    window.matchMedia("(max-width: 960px)");

// Der zuletzt gespeicherte Sidebar-Zustand gilt nur auf
// Desktop - auf Mobile soll die Sidebar immer verborgen
// starten, unabhaengig davon, ob sie beim letzten Besuch
// (ggf. auf einem groesseren Bildschirm) offen war.
if (
    localStorage.getItem("sidebarOpen") === "true" &&
    !mirelonMobileNavQuery.matches
) {

    sidebar.classList.add("open");

}

/* =====================================================
   ÖFFNEN / SCHLIESSEN
   ===================================================== */


/* =====================================================
   FARBTHEME (Baumrinde / Smaragdwald / Zuckerwatte)
   Wird als data-theme-Attribut direkt am #sidebar-Element
   gesetzt, die eigentlichen Farben stecken als CSS-Custom-
   Properties in style.css.

   Die Wahl lebt als sidebarTheme-Eigenschaft direkt im ganz
   normalen player-Objekt (siehe player.js) und wird darüber
   genau wie alles andere synchronisiert: für Gäste rein
   lokal per savePlayer() (localStorage), für angemeldete
   Nutzer automatisch mit über die bestehende player_data-
   Spalte in Supabase (auth.js pusht/pullt dort schon das
   komplette player-Objekt) - keine eigene Sync-Logik nötig.
   ===================================================== */

// "baumrinde" ist der Standard und bekommt bewusst KEIN data-theme-
// Attribut (nutzt die Basiswerte direkt am #sidebar). Neue Themes
// hier einfach ergänzen.
const SIDEBAR_THEMES_WITH_ATTRIBUTE = ["smaragdwald", "zuckerwatte", "azurblau", "rot"];

function getSidebarTheme() {

    return (typeof player !== "undefined" && player.sidebarTheme) || "baumrinde";

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

function setSidebarTheme(theme) {

    const validTheme =
        SIDEBAR_THEMES_WITH_ATTRIBUTE.includes(theme)
            ? theme
            : "baumrinde";

    player.sidebarTheme = validTheme;

    savePlayer();

    applySidebarTheme(validTheme);

    window.dispatchEvent(new CustomEvent("player-updated"));

}

// Sofort beim Laden anwenden, bevor irgendetwas anderes passiert,
// damit nicht kurz das falsche Theme aufblitzt.
applySidebarTheme(getSidebarTheme());

// Falls sich player.sidebarTheme anderswo ändert (z. B. nach einem
// Login, das ein abweichendes Theme aus der Cloud mitbringt),
// Sidebar-Farbe neu anwenden.
window.addEventListener("player-updated", function () {

    applySidebarTheme(getSidebarTheme());

});


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

        const willOpen = !header.classList.contains("is-open");

        // Immer nur eine Gruppe gleichzeitig offen: alle anderen zuklappen,
        // bevor diese hier ggf. aufklappt.
        sidebarGroupHeaders.forEach(function (otherHeader) {

            if (otherHeader !== header) {
                setSidebarGroupOpen(otherHeader, false);
            }

        });

        setSidebarGroupOpen(header, willOpen);

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

    const mobileFeathers =
        document.getElementById(
            "mobile-topbar-feathers"
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


    if (mobileFeathers) {

        mobileFeathers.textContent =
            "🪶 " + player.feathers;

    }

}


updateSidebarPlayer();


window.addEventListener(
    "player-updated",
    updateSidebarPlayer
);



const sidebarBackdrop =
    document.createElement("div");

sidebarBackdrop.id = "sidebar-backdrop";

document.body.appendChild(sidebarBackdrop);

function setSidebarOpen(isOpen) {

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle("open", isOpen);

    // Der gespeicherte Zustand ist nur fuer Desktop gedacht -
    // auf Mobile wird nichts persistiert, damit die Sidebar
    // beim naechsten Besuch wieder verborgen startet.
    if (!mirelonMobileNavQuery.matches) {

        localStorage.setItem("sidebarOpen", isOpen);

    }

    sidebarBackdrop.classList.toggle(
        "is-visible",
        isOpen && mirelonMobileNavQuery.matches
    );

}

function toggleSidebar() {

    setSidebarOpen(!sidebar.classList.contains("open"));

}

sidebarBackdrop.addEventListener("click", function () {

    setSidebarOpen(false);

});

// Beim Wechsel ueber den Breakpoint (z. B. Fenster-Resize,
// Tablet-Rotation) Backdrop-Sichtbarkeit neu abgleichen.
mirelonMobileNavQuery.addEventListener("change", function () {

    setSidebarOpen(sidebar.classList.contains("open"));

});

if (sidebar && sidebarToggle) {

    sidebarToggle.addEventListener("click", toggleSidebar);

}


/* =====================================================
   MOBILE TOPBAR
   Wird einmalig injiziert (wie das Inventar-Panel weiter
   unten) - nur unterhalb des Nav-Breakpoints sichtbar,
   siehe CSS/components/mobile-nav.css. Nutzt fuer Menue
   UND Profil dieselbe bestehende Sidebar, statt eine
   zweite, parallele Profilanzeige zu bauen.
   ===================================================== */

function createMobileTopbar() {

    if (document.getElementById("mobile-topbar")) {
        return;
    }

    const topbar =
        document.createElement("header");

    topbar.id = "mobile-topbar";

    topbar.innerHTML = `
        <button
            id="mobile-menu-button"
            type="button"
            aria-label="Menü öffnen">
            ☰
        </button>

        <a id="mobile-brand" href="index.html">
            🌳 Mirelon
        </a>

        <span id="mobile-topbar-feathers" aria-live="polite">
            🪶 0
        </span>

        <button
            id="mobile-profile-button"
            type="button"
            aria-label="Profil öffnen">
            👤
        </button>
    `;

    document.body.insertBefore(topbar, document.body.firstChild);

}

createMobileTopbar();

const mobileMenuButton =
    document.getElementById("mobile-menu-button");

const mobileProfileButton =
    document.getElementById("mobile-profile-button");

if (mobileMenuButton) {

    mobileMenuButton.addEventListener("click", toggleSidebar);

}

if (mobileProfileButton) {

    mobileProfileButton.addEventListener("click", toggleSidebar);

}

// Topbar wurde erst nach dem ersten updateSidebarPlayer()-Aufruf
// erzeugt - einmalig nachziehen, damit die Federanzahl sofort
// stimmt statt erst beim naechsten "player-updated"-Event.
updateSidebarPlayer();


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

            <h2><img src="Icons/Sidebar/inventar.png" alt="" class="inventory-icon inventory-icon--title" loading="lazy" decoding="async"> Dein Inventar</h2>

            <button
                id="inventory-close"
                type="button"
                aria-label="Inventar schließen">
                ✕
            </button>

        </div>

        <div class="inventory-categories" role="group" aria-label="Kategorie filtern">

            <button type="button" class="inventory-category-chip is-active" data-category="all" aria-pressed="true">Alle</button>
            <button type="button" class="inventory-category-chip" data-category="cursor" aria-pressed="false">🖱 Cursor</button>
            <button type="button" class="inventory-category-chip" data-category="items" aria-pressed="false">🎁 Items</button>

        </div>

        <div class="inventory-body">

            <div class="inventory-items">

                <button
                    id="inventory-fox-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <span class="inventory-item-icon" aria-hidden="true">🦊</span>
                    <span class="inventory-item-name">Fuchs</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-bear-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <span class="inventory-item-icon" aria-hidden="true">🐻</span>
                    <span class="inventory-item-name">Bär</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-unicorn-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <img src="Icons/Cursor/unicorn_cursor.png" alt="" class="inventory-item-icon inventory-item-icon--img" loading="lazy" decoding="async">
                    <span class="inventory-item-name">Einhorn</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-kuro-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <img src="Icons/Cursor/kuro_cursor.png" alt="" class="inventory-item-icon inventory-item-icon--img" loading="lazy" decoding="async">
                    <span class="inventory-item-name">Kuro</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-hasen-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <img src="Icons/Cursor/hasen_cursor.png" alt="" class="inventory-item-icon inventory-item-icon--img" loading="lazy" decoding="async">
                    <span class="inventory-item-name">Hase</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-golden-feather-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <img src="Icons/Cursor/golden_feather_cursor.png" alt="" class="inventory-item-icon inventory-item-icon--img" loading="lazy" decoding="async">
                    <span class="inventory-item-name">Goldene Feder</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-blackgolden-feather-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <img src="Icons/Cursor/blackgolden_feather_cursor.png" alt="" class="inventory-item-icon inventory-item-icon--img" loading="lazy" decoding="async">
                    <span class="inventory-item-name">Schwarzgoldene Feder</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-default-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <span class="inventory-item-icon" aria-hidden="true">🖱️</span>
                    <span class="inventory-item-name">Standard</span>
                    <span class="inventory-item-status"></span>
                </button>

            </div>

            <p class="inventory-empty-state" hidden>
                Hier erscheinen bald neue Gegenstände! 🎁
            </p>

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

        if (!inventoryPanel.hidden) {
            updateInventoryUI();
        }

    });

}

if (inventoryClose && inventoryPanel) {

    inventoryClose.addEventListener("click", function () {

        inventoryPanel.hidden = true;

    });

}


/* =====================================================
   INVENTAR: KATEGORIE-FILTER
   ===================================================== */

const inventoryCategoryChips =
    document.querySelectorAll(".inventory-category-chip");

let activeInventoryCategory = "all";

inventoryCategoryChips.forEach(function (chip) {

    chip.addEventListener("click", function () {

        activeInventoryCategory = chip.dataset.category;

        inventoryCategoryChips.forEach(function (otherChip) {

            const isActive = otherChip === chip;

            otherChip.classList.toggle("is-active", isActive);
            otherChip.setAttribute("aria-pressed", String(isActive));

        });

        updateInventoryUI();

    });

});


/* =====================================================
   INVENTAR: CURSOR-DEFINITIONEN
   Eine Quelle der Wahrheit für Anzeige (Name, Kategorie,
   Besitz-Prüfung) - die Kauf-/Aktivierungslogik selbst
   bleibt unverändert in setCursor()/shop.js.
   ===================================================== */

const INVENTORY_CURSORS = [
    { id: "inventory-fox-cursor", name: "fox", label: "Fuchs", owned: function () { return Boolean(player.items && player.items.foxCursor); } },
    { id: "inventory-bear-cursor", name: "bear", label: "Bär", owned: function () { return Boolean(player.items && player.items.bearCursor); } },
    { id: "inventory-unicorn-cursor", name: "unicorn", label: "Einhorn", owned: function () { return Boolean(player.items && player.items.unicornCursor); } },
    { id: "inventory-kuro-cursor", name: "kuro", label: "Kuro", owned: function () { return Boolean(player.items && player.items.kuroCursor); } },
    { id: "inventory-hasen-cursor", name: "hasen", label: "Hase", owned: function () { return Boolean(player.items && player.items.hasenCursor); } },
    { id: "inventory-golden-feather-cursor", name: "goldenfeather", label: "Goldene Feder", owned: function () { return Boolean(player.items && player.items.goldenFeatherCursor); } },
    { id: "inventory-blackgolden-feather-cursor", name: "blackgoldenfeather", label: "Schwarzgoldene Feder", owned: function () { return Boolean(player.items && player.items.blackGoldenFeatherCursor); } },
    { id: "inventory-default-cursor", name: "default", label: "Standard", owned: function () { return true; } },
];

function updateInventoryUI() {

    if (typeof player === "undefined" || !inventoryPanel) {
        return;
    }

    let visibleCount = 0;

    INVENTORY_CURSORS.forEach(function (entry) {

        const button = document.getElementById(entry.id);

        if (!button) {
            return;
        }

        const isOwned = entry.owned();
        const isActive = player.activeCursor === entry.name;
        const matchesCategory =
            activeInventoryCategory === "all" ||
            activeInventoryCategory === button.dataset.category;

        button.hidden = !matchesCategory;

        if (matchesCategory) {
            visibleCount++;
        }

        button.disabled = !isOwned;
        button.classList.toggle("is-active", isActive);
        button.classList.toggle("is-locked", !isOwned);

        const statusEl = button.querySelector(".inventory-item-status");

        if (statusEl) {

            statusEl.textContent =
                isActive ? "✓ Aktiv" : (isOwned ? "" : "🔒 Gesperrt");

        }

        let ariaLabel = entry.label + "-Cursor";

        if (isActive) {
            ariaLabel += ", aktiv";
        } else if (!isOwned) {
            ariaLabel += ", gesperrt, im Laden erhältlich";
        }

        button.setAttribute("aria-label", ariaLabel);

    });

    const emptyState =
        inventoryPanel.querySelector(".inventory-empty-state");

    if (emptyState) {
        emptyState.hidden = visibleCount > 0;
    }

}

const inventoryFoxCursorButton =
    document.getElementById("inventory-fox-cursor");

const inventoryBearCursorButton =
    document.getElementById("inventory-bear-cursor");

    const inventoryUnicornCursorButton =
    document.getElementById("inventory-unicorn-cursor");

    const inventoryKuroCursorButton =
    document.getElementById("inventory-kuro-cursor");

    const inventoryHasenCursorButton =
    document.getElementById("inventory-hasen-cursor");

    const inventoryGoldenFeatherCursorButton =
    document.getElementById("inventory-golden-feather-cursor");

    const inventoryBlackGoldenFeatherCursorButton =
    document.getElementById("inventory-blackgolden-feather-cursor");

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

if (inventoryKuroCursorButton) {

    inventoryKuroCursorButton.addEventListener("click", function () {

        setCursor("kuro");

    });

}

if (inventoryHasenCursorButton) {

    inventoryHasenCursorButton.addEventListener("click", function () {

        setCursor("hasen");

    });

}

if (inventoryGoldenFeatherCursorButton) {

    inventoryGoldenFeatherCursorButton.addEventListener("click", function () {

        setCursor("goldenfeather");

    });

}

if (inventoryBlackGoldenFeatherCursorButton) {

    inventoryBlackGoldenFeatherCursorButton.addEventListener("click", function () {

        setCursor("blackgoldenfeather");

    });

}


if (inventoryDefaultCursorButton) {

    inventoryDefaultCursorButton.addEventListener("click", function () {

        setCursor("default");

    });

}


updateInventoryUI();

window.addEventListener(
    "player-updated",
    updateInventoryUI
);