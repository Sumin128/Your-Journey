/* =====================================================
   SIDEBAR
   ===================================================== */

const sidebar =
    document.getElementById("sidebar");

/* =====================================================
   NOCH-NICHT-FREIGESCHALTETE ORTE ("kommt bald")
   Mein Schloss UND Tamos Werkstatt werden GEMEINSAM mit
   player.progression.unlockedFeatures = ["castle"] (Stufe 3)
   nutzbar. Vorher freundlich sichtbar, ohne Schloss-Symbol.
   Einzige Quelle der Wahrheit: dieselbe Prüfung wie Karten-
   Hotspot (JS/index.js) und Schloss-Seite (JS/schloss.js).
   ===================================================== */
const SIDEBAR_COMING_SOON = {
    castle: { gate: "castle", note: "ab Stufe 3" },
    tamo:   { gate: "castle", note: "kommt mit deinem Schloss" }
};

const SCHLOSS_UNLOCK_XP = 300;

function isFeatureUnlocked(key) {
    return typeof player !== "undefined" &&
        Boolean(player.progression) &&
        Array.isArray(player.progression.unlockedFeatures) &&
        player.progression.unlockedFeatures.indexOf(key) !== -1;
}

/* Freundlicher Hinweistext beim Klick auf einen "kommt bald"-Ort -
   für Schloss dynamisch mit den noch fehlenden XP. Genutzt von der
   Sidebar, dem Karten-Hotspot (JS/index.js) und der Schloss-Seite
   (JS/schloss.js) - Text an genau einer Stelle. */
function getLockedFeatureMessage(key) {
    if (key === "castle") {
        const xp = (typeof player !== "undefined" && player.progression && player.progression.xp) || 0;
        const left = Math.max(0, SCHLOSS_UNLOCK_XP - xp);
        return "Sammle noch " + left + " XP, dann kannst du dein eigenes Schloss einrichten.";
    }
    if (key === "tamo") {
        return "Tamo richtet seine Werkstatt gerade ein. Er kommt, sobald dein Schloss bereit ist.";
    }
    return "Das ist noch nicht freigeschaltet.";
}
window.getLockedFeatureMessage = getLockedFeatureMessage;

/* =====================================================
   SIDEBAR-MARKUP ZENTRAL ERZEUGEN
   Früher war die <nav id="sidebar"> auf jeder Seite von
   Hand kopiert (~230 Zeilen × 14 Seiten). Jetzt steht auf
   der Seite nur noch <nav id="sidebar"></nav> und der Inhalt
   wird hier gebaut. Aktive Seite ergibt sich aus dem
   Dateinamen. Klassen/IDs bleiben exakt gleich, damit CSS,
   Gruppen-Aufklappen, Theme, Inventar und Mobile-Nav weiter
   funktionieren.
   ===================================================== */

function buildSidebarMarkup() {

    const here = (location.pathname.split("/").pop() || "index.html").toLowerCase() || "index.html";

    const icon = (src) =>
        `<span class="sidebar-icon"><img src="${src}" alt="" class="sidebar-icon-img" decoding="async"></span>`;

    const link = (href, label, iconSrc, extraClass) => {
        const current = href.toLowerCase() === here ? ' aria-current="page"' : "";
        const cls = "sidebar-link" + (extraClass ? " " + extraClass : "");
        return `<a href="${href}" class="${cls}"${current}>${icon(iconSrc)}<span class="sidebar-label">${label}</span></a>`;
    };

    /* comingKey (optional): Schlüssel aus SIDEBAR_COMING_SOON. Der Ort
       ist noch nicht nutzbar, bleibt aber freundlich sichtbar - KEIN
       Vorhängeschloss/Schlüssel, sondern eine kleine "kommt bald"-Zeile
       ("ab Stufe 3" o. ä.). Ein Klick zeigt showLockedFeatureMessage()
       statt zu navigieren (delegierter Handler weiter unten).
       updateSidebarLockState() macht den Link live nutzbar, sobald das
       Feature freigeschaltet ist. */
    const sublink = (href, label, iconSrc, comingKey) => {
        const cfg = comingKey ? SIDEBAR_COMING_SOON[comingKey] : null;
        const coming = Boolean(cfg) && !isFeatureUnlocked(cfg.gate);
        const current = !coming && href.toLowerCase() === here ? ' aria-current="page"' : "";
        const cls = "sidebar-link sidebar-sublink" + (coming ? " sidebar-sublink--coming" : "");
        const attr = coming ? ` data-coming-feature="${comingKey}" aria-disabled="true"` : "";
        const note = coming ? `<span class="sidebar-coming-note">${cfg.note}</span>` : "";
        return `<a href="${href}" class="${cls}"${current}${attr}>${icon(iconSrc)}<span class="sidebar-label">${label}${note}</span></a>`;
    };

    // defaultOpen: Gruppe ist beim Laden aufgeklappt, auch ohne aktiven
    // Link darin (Standardzustand fuer "Welt", siehe Gruppen-Logik unten).
    const group = (label, iconSrc, subs, defaultOpen) =>
        `<button type="button" class="sidebar-group-header"${defaultOpen ? ' data-default-open="true"' : ""}>${icon(iconSrc)}` +
        `<span class="sidebar-label">${label}</span><span class="sidebar-chevron">▸</span></button>` +
        `<div class="sidebar-subnav">${subs.join("")}</div>`;

    return `
        <div class="sidebar-header">
            <button id="sidebar-toggle" type="button" aria-label="Menü öffnen">☰</button>
            <img src="images/magischer_baum_von_mirelon_logo.png" alt="Mirelon" class="sidebar-title sidebar-logo" decoding="async">
        </div>

        <div class="sidebar-player">
            <a id="sidebar-profile-link" class="sidebar-profile-link" href="einstellungen.html#konto" aria-label="Profil &amp; Konto öffnen">
                <span class="sidebar-avatar-wrap">
                    <img id="sidebar-player-avatar" src="" alt="">
                </span>

                <span class="sidebar-player-info">
                    <strong id="sidebar-player-name">Abenteurer</strong>
                    <span id="sidebar-feathers"><img src="images/muenze.png" alt="" class="coin-icon"> 0 Münzen</span>
                    <span id="sidebar-achievements">⭐ 0 Erfolge</span>
                </span>

                <span class="sidebar-profile-hint" aria-hidden="true">Profil &amp; Konto öffnen</span>
            </a>

            <button id="inventory-button" type="button" aria-label="Inventar öffnen">
                <img src="Icons/Sidebar/inventar.png" alt="" class="inventory-icon" decoding="async">
            </button>

            <span id="sidebar-level-badge" class="sidebar-level-badge" aria-hidden="true">
                <span class="sidebar-level-badge-shape"></span>
                <span id="sidebar-level-badge-num" class="sidebar-level-badge-num">1</span>
            </span>

            <div id="sidebar-level" class="sidebar-level" hidden>
                <span id="sidebar-level-text" class="sidebar-level-text">0 / 100 XP</span>
                <div class="sidebar-level-track"><div id="sidebar-level-fill" class="sidebar-level-fill"></div></div>
                <div id="sidebar-level-goal" class="sidebar-level-goal"></div>
            </div>
        </div>

        <div class="sidebar-divider"></div>

        <div class="sidebar-nav">
            ${group("Welt", "Icons/Sidebar/lernorte.png", [
                sublink("index.html", "Startkarte", "Icons/Sidebar/startkarte.png"),
                sublink("schloss.html", "Mein Schloss", "Icons/Sidebar/schloss.png", "castle"),
                sublink("kuros_nest.html", "Kuros Nest", "Icons/Sidebar/rabe-2.png"),
                sublink("eulenschule.html", "Tessas Hasenschule", "Icons/Sidebar/hase.png"),
                sublink("fuchs.html", "Faros Fuchsbau", "Icons/Sidebar/fuchs.png"),
                sublink("baerental.html", "Bärental", "Icons/Sidebar/baer-2.png"),
                sublink("puzzle.html", "Luis’ Puzzle", "Icons/Sidebar/chamaeleon.png")
            ], true)}

            ${group("Kreativ", "Icons/Sidebar/kreativ.png", [
                sublink("malen.html", "Malstube", "Icons/Sidebar/malen.png"),
                sublink("galerie.html", "Galerie", "Icons/Sidebar/galerie.png")
            ])}

            ${group("Läden", "Icons/Sidebar/laeden.png", [
                sublink("shop_seite.html", "Kuros Laden", "Icons/Sidebar/kuros_laden.png"),
                sublink("bakos_basar.html", "Bakos Basar", "Icons/Sidebar/shop.png"),
                sublink("tamo_werkstatt.html", "Tamos Werkstatt", "Icons/Sidebar/tamo_werkstatt.png", "tamo")
            ])}

            ${group("Fortschritt", "Icons/Sidebar/fortschritt.png", [
                sublink("erfolge.html", "Erfolge", "Icons/Sidebar/erfolge.png"),
                sublink("bestenliste.html", "Bestenliste", "Icons/Sidebar/highscore.png")
            ])}
        </div>

        <div class="sidebar-divider"></div>

        <div class="sidebar-utility">
            ${link("einstellungen.html", "Einstellungen", "Icons/Sidebar/einstellungen.png")}
            ${link("impressum.html", "Impressum & Datenschutz", "Icons/Sidebar/impressum.png", "sidebar-legal-link")}
        </div>
    `;
}

if (sidebar && !sidebar.querySelector(".sidebar-nav")) {
    sidebar.innerHTML = buildSidebarMarkup();
}

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

// "orange" (Bernsteinlicht) ist der Standard - am neutralsten. Nur
// "baumrinde" nutzt die attributlosen Basiswerte direkt am #sidebar,
// alle anderen (inkl. Standard) bekommen ein data-theme-Attribut.
const SIDEBAR_THEMES_WITH_ATTRIBUTE = ["smaragdwald", "zuckerwatte", "azurblau", "rot", "orange"];
const DEFAULT_THEME = "orange";

function getSidebarTheme() {

    return (typeof player !== "undefined" && player.sidebarTheme) || DEFAULT_THEME;

}

function applySidebarTheme(theme) {

    if (!sidebar) {
        return;
    }

    if (SIDEBAR_THEMES_WITH_ATTRIBUTE.includes(theme)) {
        sidebar.setAttribute("data-theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
    } else {
        sidebar.removeAttribute("data-theme");
        document.documentElement.removeAttribute("data-theme");
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

    // Ein Klick auf das bereits aktive Theme zählt nicht als
    // Wechsel (weder für den Cloud-Sync-Aufwand unten noch für
    // das Luis-Easter-Egg).
    const isActualChange = validTheme !== player.sidebarTheme;

    player.sidebarTheme = validTheme;

    savePlayer();

    applySidebarTheme(validTheme);

    window.dispatchEvent(new CustomEvent("player-updated"));

    if (isActualChange && typeof registerThemeChangeForLuisEasterEgg === "function") {

        registerThemeChangeForLuisEasterEgg();

    }

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
   AUSKLAPPBARE GRUPPEN (Welt, Kreativ, Läden, Fortschritt)
   - Ein Klick auf den Gruppentitel klappt NUR diese Gruppe
     auf/zu (kein Akkordeon, mehrere dürfen offen sein).
   - Beim Laden offen: die Gruppe mit dem aktiven Link
     (aria-current). Liegt die aktive Seite in keiner Gruppe
     (z. B. Einstellungen, Impressum), ist "Welt"
     (data-default-open) als Standardgruppe offen.
   - Kein persistenter Zustand: die aktive Seite ergibt sich
     bei jedem Laden aus der URL, die Hervorhebung bleibt so
     auch nach einem Reload erhalten.
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

const sidebarActiveGroupExists = Array.prototype.some.call(
    sidebarGroupHeaders,
    function (header) {
        const panel = header.nextElementSibling;
        return Boolean(panel) && panel.querySelector('[aria-current="page"]') !== null;
    }
);

sidebarGroupHeaders.forEach(function (header) {

    const panel = header.nextElementSibling;

    const containsActiveLink =
        Boolean(panel) && panel.querySelector('[aria-current="page"]') !== null;

    // "Welt" ist die Standardgruppe: offen, solange keine andere Gruppe
    // die aktive Seite enthält.
    const openByDefault =
        header.dataset.defaultOpen === "true" && !sidebarActiveGroupExists;

    setSidebarGroupOpen(header, containsActiveLink || openByDefault);

    header.addEventListener("click", function () {

        // Nur diese Gruppe umschalten - andere bleiben, wie sie sind.
        setSidebarGroupOpen(header, !header.classList.contains("is-open"));

    });

});


/* =====================================================
   "KOMMT BALD"-ORTE (Mein Schloss & Tamos Werkstatt vor Stufe 3)
   Ein Klick navigiert NICHT, sondern zeigt eine freundliche
   In-Welt-Nachricht (kein technisches "Level 3 nötig"). Dieselbe
   getLockedFeatureMessage() nutzen auch Karten-Hotspot (JS/index.js)
   und Schloss-Seite (JS/schloss.js).
   ===================================================== */

function showLockedFeatureMessage(featureKey) {

    const message = getLockedFeatureMessage(featureKey);

    if (typeof showMirelonToast === "function") {
        showMirelonToast(message, "info");
    } else {
        alert(message);
    }

}

window.showLockedFeatureMessage = showLockedFeatureMessage;

if (sidebar) {

    sidebar.addEventListener("click", function (event) {

        const comingLink = event.target.closest(".sidebar-sublink--coming");

        if (!comingLink) {
            return;
        }

        event.preventDefault();

        showLockedFeatureMessage(comingLink.dataset.comingFeature);

    });

}

// Live nachziehen, falls sich unlockedFeatures NACH dem Sidebar-Aufbau
// ändert (Cloud-Daten treffen erst nach dem Login-Pull ein, oder ein
// Level-Aufstieg passiert waehrend die Seite offen ist) - baut nicht
// die ganze Sidebar neu (das wuerde z. B. offene Gruppen zuklappen),
// sondern macht nur die betroffenen Links nutzbar.
function updateSidebarLockState() {

    if (typeof player === "undefined") {
        return;
    }

    document.querySelectorAll(".sidebar-sublink--coming[data-coming-feature]").forEach(function (el) {

        const cfg = SIDEBAR_COMING_SOON[el.dataset.comingFeature];

        if (!cfg || !isFeatureUnlocked(cfg.gate)) {
            return;
        }

        el.classList.remove("sidebar-sublink--coming");
        el.removeAttribute("data-coming-feature");
        el.removeAttribute("aria-disabled");

        const note = el.querySelector(".sidebar-coming-note");

        if (note) {
            note.remove();
        }

        if (el.getAttribute("href") &&
            el.getAttribute("href").toLowerCase() === (location.pathname.split("/").pop() || "index.html").toLowerCase()) {
            el.setAttribute("aria-current", "page");
        }

    });

}

updateSidebarLockState();

window.addEventListener("player-updated", updateSidebarLockState);


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

        feathers.innerHTML =
            '<img src="images/muenze.png" alt="" class="coin-icon"> ' +
            player.coins + " Münzen";

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

        mobileFeathers.innerHTML =
            '<img src="images/muenze.png" alt="" class="coin-icon"> ' +
            player.coins;

    }

    updateSidebarLevel();

}

/* Level-Abzeichen + XP-Balken im festen Profilbereich. Immer sichtbar
   (nicht im aufklappbaren "Fortschritt"-Menü). Nutzt die zentrale
   Datenquelle mirelonLevelProgress() aus JS/level-data.js. */
/* Finale Badge-Serie: 4 Formen x 4 Farben = 16 Varianten
   (images/badges/<form>_<farbe>.png). Alle Varianten haben denselben
   einheitlichen, exakt mittigen hellen Zahlenkern - deshalb braucht
   die HTML-Levelzahl KEINE per-Variante-Korrektur mehr, sie wird nur
   zentriert (siehe CSS). "blatt" aus der alten Serie fällt weg. */
const SIDEBAR_BADGE_SHAPES = ["schild", "herz", "stern", "baum"];
const SIDEBAR_BADGE_COLORS = ["waldgruen", "himmelblau", "beerenrosa", "sonnengold"];
const SIDEBAR_BADGE_DEFAULT = { shape: "baum", color: "waldgruen" };

function sidebarBadgeChoice() {
    const b = (typeof player !== "undefined" && player.levelBadge) || {};
    const shape = SIDEBAR_BADGE_SHAPES.indexOf(b.shape) !== -1 ? b.shape : SIDEBAR_BADGE_DEFAULT.shape;
    const color = SIDEBAR_BADGE_COLORS.indexOf(b.color) !== -1 ? b.color : SIDEBAR_BADGE_DEFAULT.color;
    return { shape: shape, color: color };
}

/* Auswahl "Mein Level-Abzeichen" (Einstellungen). Speichert AUSSCHLIESSLICH
   player.levelBadge = { shape, color } und wird wie sidebarTheme ganz
   normal mitsynchronisiert - kein eigener Sync-Weg, keine XP-/DB-Logik. */
function setLevelBadge(shape, color) {

    if (SIDEBAR_BADGE_SHAPES.indexOf(shape) === -1 ||
        SIDEBAR_BADGE_COLORS.indexOf(color) === -1) {
        return;
    }

    player.levelBadge = { shape: shape, color: color };

    savePlayer();
    updateSidebarLevel();

    window.dispatchEvent(new CustomEvent("player-updated"));
}

window.setLevelBadge = setLevelBadge;
window.sidebarBadgeChoice = sidebarBadgeChoice;
window.MIRELON_BADGE_SHAPES = SIDEBAR_BADGE_SHAPES;
window.MIRELON_BADGE_COLORS = SIDEBAR_BADGE_COLORS;

function updateSidebarLevel() {

    if (typeof player === "undefined" || typeof mirelonLevelProgress !== "function") {
        return;
    }

    const prog = (player.progression && typeof player.progression.xp === "number")
        ? player.progression
        : { xp: 0, level: 1 };

    const p = mirelonLevelProgress(prog.xp);
    const choice = sidebarBadgeChoice();

    const badge = document.getElementById("sidebar-level-badge");
    const badgeNum = document.getElementById("sidebar-level-badge-num");
    const box = document.getElementById("sidebar-level");
    const text = document.getElementById("sidebar-level-text");
    const fill = document.getElementById("sidebar-level-fill");
    const goal = document.getElementById("sidebar-level-goal");

    if (badge) {
        badge.dataset.shape = choice.shape;
        badge.dataset.color = choice.color;
        const shapeEl = badge.querySelector(".sidebar-level-badge-shape");
        if (shapeEl) {
            shapeEl.style.backgroundImage =
                'url("images/badges/' + choice.shape + "_" + choice.color + '.png?v=2")';
        }
    }
    if (badgeNum) {
        badgeNum.textContent = p.level;
    }

    if (box) { box.hidden = false; }

    if (text) {
        // Die Stufe steht auf dem Abzeichen; hier nur der XP-Stand.
        text.textContent = p.maxed
            ? "Höchststufe erreicht!"
            : (p.xp + " / " + p.nextXp + " XP");
    }

    if (fill) {
        const pct = (p.span > 0) ? Math.max(0, Math.min(100, (p.into / p.span) * 100)) : 100;
        fill.style.width = pct + "%";
    }

    if (goal) {
        if (p.maxed) {
            goal.textContent = "";
            goal.hidden = true;
        } else if (p.level < 3) {
            goal.textContent = "Noch " + Math.max(0, MIRELON_CASTLE_XP - p.xp) + " XP bis zu deinem Schloss!";
            goal.hidden = false;
        } else {
            goal.textContent = "Noch " + p.toNext + " XP bis Stufe " + p.nextLevel;
            goal.hidden = false;
        }
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
            <img src="images/muenze.png" alt="" class="coin-icon"> 0
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
// erzeugt - einmalig nachziehen, damit die Münzenanzahl sofort
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
                    <img src="Icons/Cursor/fox_cursor.png" alt="" class="inventory-item-icon inventory-item-icon--img" loading="lazy" decoding="async">
                    <span class="inventory-item-name">Fuchs</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-bear-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <img src="Icons/Cursor/bear_cursor.png" alt="" class="inventory-item-icon inventory-item-icon--img" loading="lazy" decoding="async">
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
                    id="inventory-luis-cursor"
                    class="inventory-item"
                    type="button"
                    data-category="cursor">
                    <img src="Icons/Cursor/luis_cursor.png" alt="" class="inventory-item-icon inventory-item-icon--img" loading="lazy" decoding="async">
                    <span class="inventory-item-name">Luis</span>
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

                <button
                    id="inventory-firework"
                    class="inventory-item"
                    type="button"
                    data-category="items">
                    <span class="inventory-item-icon" aria-hidden="true">🎆</span>
                    <span class="inventory-item-name">Feuerwerk</span>
                    <span class="inventory-item-status"></span>
                </button>

                <button
                    id="inventory-konfetti"
                    class="inventory-item"
                    type="button"
                    data-category="items">
                    <span class="inventory-item-icon" aria-hidden="true">🎊</span>
                    <span class="inventory-item-name">Konfetti</span>
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
    { id: "inventory-luis-cursor", name: "luis", label: "Luis", owned: function () { return Boolean(player.items && player.items.luisCursor); } },
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

    /* Verbrauchs-Feuerwerk (Kategorie "Items") */

    const fireworkButton = document.getElementById("inventory-firework");

    if (fireworkButton) {

        const qty = (player.consumables && Number(player.consumables.feuerwerk)) || 0;
        const matchesCategory =
            activeInventoryCategory === "all" ||
            activeInventoryCategory === "items";

        fireworkButton.hidden = !matchesCategory;

        if (matchesCategory) {
            visibleCount++;
        }

        fireworkButton.disabled = qty < 1;
        fireworkButton.classList.toggle("is-locked", qty < 1);

        const statusEl = fireworkButton.querySelector(".inventory-item-status");

        if (statusEl) {
            statusEl.textContent = qty > 0 ? "×" + qty + " · Zünden" : "🔒 Leer";
        }

        fireworkButton.setAttribute(
            "aria-label",
            qty > 0
                ? "Feuerwerk zünden, noch " + qty + " übrig"
                : "Feuerwerk, leer – bei Bako erhältlich"
        );

    }

    /* Verbrauchs-Konfetti (Kategorie "Items") - gleiche Mechanik wie
       Feuerwerk, eigener seltener Vorrat. */
    const konfettiButton = document.getElementById("inventory-konfetti");

    if (konfettiButton) {

        const qty = (player.consumables && Number(player.consumables.konfetti)) || 0;
        const matchesCategory =
            activeInventoryCategory === "all" ||
            activeInventoryCategory === "items";

        konfettiButton.hidden = !matchesCategory;

        if (matchesCategory) {
            visibleCount++;
        }

        konfettiButton.disabled = qty < 1;
        konfettiButton.classList.toggle("is-locked", qty < 1);

        const statusEl = konfettiButton.querySelector(".inventory-item-status");

        if (statusEl) {
            statusEl.textContent = qty > 0 ? "×" + qty + " · Werfen" : "🔒 Leer";
        }

        konfettiButton.setAttribute(
            "aria-label",
            qty > 0
                ? "Konfetti werfen, noch " + qty + " übrig"
                : "Konfetti, leer – als Level-Belohnung erhältlich"
        );

    }

    const emptyState =
        inventoryPanel.querySelector(".inventory-empty-state");

    if (emptyState) {
        emptyState.hidden = visibleCount > 0;
    }

}


/* =====================================================
   INVENTAR: VERBRAUCHS-EFFEKTE (Feuerwerk, Konfetti)
   Verbrauch bei angemeldeten Konten serverseitig über
   use_consumable_item() (siehe supabase_migration_
   security_player_data.sql); der Effekt startet erst
   NACH erfolgreichem Abzug.
   ===================================================== */

let consumableBusy = false;

async function useConsumable(key, effect) {

    if (consumableBusy) {
        return;
    }

    const qty = (player.consumables && Number(player.consumables[key])) || 0;

    if (qty < 1) {
        return;
    }

    consumableBusy = true;

    try {

        const loggedIn =
            typeof supabaseClient !== "undefined" && supabaseClient &&
            typeof currentSession !== "undefined" && currentSession;

        if (loggedIn) {

            const res = await supabaseClient.rpc("use_consumable_item", { item_key: key });

            if (res.error) {
                throw res.error;
            }

            if (!player.consumables) {
                player.consumables = {};
            }

            if (res.data && typeof res.data.remaining === "number") {
                player.consumables[key] = res.data.remaining;
            } else {
                player.consumables[key] = qty - 1;
            }

        } else {

            if (!player.consumables) {
                player.consumables = {};
            }

            player.consumables[key] = qty - 1;

        }

        savePlayer();
        window.dispatchEvent(new CustomEvent("player-updated"));

        if (inventoryPanel) {
            inventoryPanel.hidden = true;
        }

        if (typeof effect === "function") {
            effect();
        }

    } catch (e) {

        if (typeof showMirelonToast === "function") {
            showMirelonToast("Hat nicht geklappt: " + (e && e.message ? e.message : e), "error");
        }

    } finally {

        consumableBusy = false;

    }

}

function igniteFirework() {
    return useConsumable("feuerwerk", function () {
        if (typeof MirelonFireworks !== "undefined" && MirelonFireworks.play) {
            MirelonFireworks.play({ seconds: 12 });
        }
    });
}

function throwKonfetti() {
    return useConsumable("konfetti", function () {
        if (typeof MirelonConfetti !== "undefined" && MirelonConfetti.play) {
            MirelonConfetti.play({ seconds: 8 });
        }
    });
}

(function () {

    const fireworkButton = document.getElementById("inventory-firework");

    if (fireworkButton) {
        fireworkButton.addEventListener("click", igniteFirework);
    }

    const konfettiButton = document.getElementById("inventory-konfetti");

    if (konfettiButton) {
        konfettiButton.addEventListener("click", throwKonfetti);
    }

})();

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

    const inventoryLuisCursorButton =
    document.getElementById("inventory-luis-cursor");

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

if (inventoryLuisCursorButton) {

    inventoryLuisCursorButton.addEventListener("click", function () {

        setCursor("luis");

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