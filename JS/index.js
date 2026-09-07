/* =====================================================
   INDEX.JS  -  Startseite
   "Willkommen in Mirelon"-Onboarding: eine kurze, vierteilige
   Reise (Name+Avatar / Level-Abzeichen / Seitenstil / erstes
   Baumkind). Erst nach "Mein Abenteuer beginnen" wird alles
   GEMEINSAM gespeichert und player.introSeen = true gesetzt.
   Bis dahin lebt nur ein lokaler Entwurf.

   Das Onboarding erscheint nur, wenn der maßgebliche Spielstand
   feststeht (Hydration "ready") und player.introSeen falsch ist -
   ein angemeldeter Spieler überschreibt so nie versehentlich
   einen leeren lokalen Startstand.
   ===================================================== */

const onboardingOverlay = document.getElementById("onboarding-overlay");
const onboardingNameInput = document.getElementById("player-name");
const onboardingAvatarSelection = document.getElementById("avatar-selection");

const ONBOARDING_STEP_COUNT = 4;
let onboardingStep = 1;
let onboardingBuilt = false;

/* Lokaler Entwurf - erst beim letzten Schritt in player übernommen. */
const onboardingDraft = {
    name: "",
    avatar: "",
    badge: { shape: "baum", color: "waldgruen" },
    theme: "orange",
    species: "igel"
};


/* =====================================================
   SICHTBARKEIT
   ===================================================== */

function onboardingShouldShow() {

    if (!onboardingOverlay) {
        return false;
    }

    const hydration =
        typeof getPlayerHydrationState === "function"
            ? getPlayerHydrationState()
            : "ready";

    if (hydration !== "ready") {
        return false;
    }

    if (player.introSeen === true) {
        return false;
    }

    /* Kompatibilität (auch für den Cloud-Pfad, wo loadPlayer() nicht
       läuft): wer schon Name UND Avatar hat, hat die Ersteinrichtung
       bereits hinter sich - auch ohne gesetztes introSeen-Feld. */
    if (player.name && player.avatar) {
        return false;
    }

    return true;
}

function updateOnboardingVisibility() {

    if (!onboardingOverlay) {
        return;
    }

    if (!onboardingShouldShow()) {
        onboardingOverlay.hidden = true;
        return;
    }

    if (!onboardingBuilt) {
        seedOnboardingDraft();
        buildOnboarding();
        onboardingBuilt = true;
    }

    onboardingOverlay.hidden = false;
    showOnboardingStep(onboardingStep);
}


/* =====================================================
   ENTWURF VORBELEGEN
   ===================================================== */

function seedOnboardingDraft() {

    onboardingDraft.name = player.name || "";
    onboardingDraft.avatar = player.avatar || "";

    const badge = (player.levelBadge && typeof player.levelBadge === "object")
        ? player.levelBadge
        : {};
    const shapes = window.MIRELON_BADGE_SHAPES || ["schild", "herz", "stern", "baum"];
    const colors = window.MIRELON_BADGE_COLORS || ["waldgruen", "himmelblau", "beerenrosa", "sonnengold"];
    onboardingDraft.badge.shape = shapes.indexOf(badge.shape) !== -1 ? badge.shape : "baum";
    onboardingDraft.badge.color = colors.indexOf(badge.color) !== -1 ? badge.color : "waldgruen";

    onboardingDraft.theme = player.sidebarTheme || "orange";

    const petOrder = window.MIRELON_PET_ORDER || ["igel", "otter", "reh", "eichhorn", "baer"];
    const currentSpecies = (player.tamagotchi && player.tamagotchi.species) || "igel";
    onboardingDraft.species = petOrder.indexOf(currentSpecies) !== -1 ? currentSpecies : "igel";
}


/* =====================================================
   AUFBAU DER SCHRITTE
   ===================================================== */

function buildOnboarding() {
    buildOnboardingAvatars();
    buildOnboardingBadge();
    buildOnboardingThemes();
    buildOnboardingPets();
    wireOnboardingNav();
}

/* --- Schritt 1: Avatare --- */
function buildOnboardingAvatars() {

    if (!onboardingAvatarSelection || typeof characters === "undefined") {
        return;
    }

    onboardingAvatarSelection.innerHTML = "";

    characters.forEach(function (character) {

        const image = document.createElement("img");
        image.src = character.image;
        image.alt = "Avatar " + character.id;
        image.className = "avatar";
        image.setAttribute("role", "button");
        image.setAttribute("tabindex", "0");
        image.setAttribute("aria-pressed", String(onboardingDraft.avatar === character.image));
        image.classList.toggle("selected", onboardingDraft.avatar === character.image);

        const pick = function () {
            onboardingDraft.avatar = character.image;
            onboardingAvatarSelection.querySelectorAll(".avatar").forEach(function (el) {
                el.classList.remove("selected");
                el.setAttribute("aria-pressed", "false");
            });
            image.classList.add("selected");
            image.setAttribute("aria-pressed", "true");
            refreshStep1Button();
        };

        image.addEventListener("click", pick);
        image.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                pick();
            }
        });

        onboardingAvatarSelection.appendChild(image);
    });
}

function refreshStep1Button() {
    const nextBtn = onboardingOverlay.querySelector('.onboarding-step[data-step="1"] [data-onboarding-next]');
    if (nextBtn) {
        nextBtn.disabled = !(onboardingDraft.name.trim() && onboardingDraft.avatar);
    }
}

if (onboardingNameInput) {
    onboardingNameInput.addEventListener("input", function () {
        onboardingDraft.name = onboardingNameInput.value;
        refreshStep1Button();
    });
    onboardingNameInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !refreshAndCheckStep1()) {
            goToOnboardingStep(2);
        }
    });
}

function refreshAndCheckStep1() {
    refreshStep1Button();
    return !(onboardingDraft.name.trim() && onboardingDraft.avatar);
}

/* --- Schritt 2: Level-Abzeichen --- */
const ONBOARDING_SHAPE_LABEL = { schild: "Schild", herz: "Herz", stern: "Stern", baum: "Baum" };
const ONBOARDING_COLOR_LABEL = { waldgruen: "Waldgrün", himmelblau: "Himmelblau", beerenrosa: "Beerenrosa", sonnengold: "Sonnengold" };

function buildOnboardingBadge() {

    const shapesEl = document.getElementById("onboarding-badge-shapes");
    const colorsEl = document.getElementById("onboarding-badge-colors");
    const shapes = window.MIRELON_BADGE_SHAPES || ["schild", "herz", "stern", "baum"];
    const colors = window.MIRELON_BADGE_COLORS || ["waldgruen", "himmelblau", "beerenrosa", "sonnengold"];

    if (!shapesEl || !colorsEl) {
        return;
    }

    shapesEl.innerHTML = "";
    shapes.forEach(function (shape) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "onboarding-choice";
        btn.textContent = ONBOARDING_SHAPE_LABEL[shape] || shape;
        btn.addEventListener("click", function () {
            onboardingDraft.badge.shape = shape;
            renderOnboardingBadgeState();
        });
        shapesEl.appendChild(btn);
    });

    colorsEl.innerHTML = "";
    colors.forEach(function (color) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "onboarding-choice";
        btn.innerHTML =
            '<span class="onboarding-color-dot onboarding-color-dot--' + color + '"></span>' +
            "<span>" + (ONBOARDING_COLOR_LABEL[color] || color) + "</span>";
        btn.addEventListener("click", function () {
            onboardingDraft.badge.color = color;
            renderOnboardingBadgeState();
        });
        colorsEl.appendChild(btn);
    });

    renderOnboardingBadgeState();
}

function renderOnboardingBadgeState() {

    const shapesEl = document.getElementById("onboarding-badge-shapes");
    const colorsEl = document.getElementById("onboarding-badge-colors");
    const shapes = window.MIRELON_BADGE_SHAPES || ["schild", "herz", "stern", "baum"];
    const colors = window.MIRELON_BADGE_COLORS || ["waldgruen", "himmelblau", "beerenrosa", "sonnengold"];

    if (shapesEl) {
        [...shapesEl.children].forEach(function (btn, i) {
            const on = shapes[i] === onboardingDraft.badge.shape;
            btn.classList.toggle("is-selected", on);
            btn.setAttribute("aria-pressed", String(on));
        });
    }
    if (colorsEl) {
        [...colorsEl.children].forEach(function (btn, i) {
            const on = colors[i] === onboardingDraft.badge.color;
            btn.classList.toggle("is-selected", on);
            btn.setAttribute("aria-pressed", String(on));
        });
    }

    const shapeEl = onboardingOverlay.querySelector(".onboarding-badge-shape");
    if (shapeEl) {
        shapeEl.style.backgroundImage =
            'url("images/badges/' + onboardingDraft.badge.shape + "_" + onboardingDraft.badge.color + '.png?v=2")';
    }
}

/* --- Schritt 3: Seitenstil --- */
const ONBOARDING_THEMES = [
    { id: "baumrinde", label: "Wurzelholz" },
    { id: "smaragdwald", label: "Mooswald" },
    { id: "zuckerwatte", label: "Feenzauber" },
    { id: "azurblau", label: "Mondsee" },
    { id: "rot", label: "Drachenfeuer" },
    { id: "orange", label: "Bernsteinlicht" }
];

function buildOnboardingThemes() {

    const grid = document.getElementById("onboarding-themes");
    if (!grid) {
        return;
    }

    grid.innerHTML = "";
    ONBOARDING_THEMES.forEach(function (theme) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "settings-theme-card onboarding-theme-card";
        btn.dataset.theme = theme.id;
        btn.innerHTML =
            '<span class="settings-theme-swatch settings-theme-swatch--' + theme.id + '"></span>' +
            '<span class="settings-theme-name">' + theme.label + "</span>";
        btn.addEventListener("click", function () {
            onboardingDraft.theme = theme.id;
            renderOnboardingThemeState();
            // Live-Vorschau (nur visuell, nicht gespeichert).
            if (typeof applySidebarTheme === "function") {
                applySidebarTheme(theme.id);
            }
        });
        grid.appendChild(btn);
    });

    renderOnboardingThemeState();
}

function renderOnboardingThemeState() {
    const grid = document.getElementById("onboarding-themes");
    if (!grid) { return; }
    [...grid.children].forEach(function (btn) {
        const on = btn.dataset.theme === onboardingDraft.theme;
        btn.classList.toggle("is-selected", on);
        btn.setAttribute("aria-pressed", String(on));
    });
}

/* --- Schritt 4: Erstes Baumkind --- */
function buildOnboardingPets() {

    const grid = document.getElementById("onboarding-pets");
    const species = window.MIRELON_PET_SPECIES;
    const order = window.MIRELON_PET_ORDER || ["igel", "otter", "reh", "eichhorn", "baer"];

    if (!grid || !species) {
        return;
    }

    grid.innerHTML = "";
    order.forEach(function (id) {
        const sp = species[id];
        if (!sp) { return; }

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "onboarding-pet-card";
        btn.dataset.species = id;
        btn.innerHTML =
            '<img src="' + (sp.sprites && sp.sprites.happy) + '" alt="" class="onboarding-pet-sprite" decoding="async">' +
            '<span class="onboarding-pet-name">' + sp.name + "</span>" +
            '<span class="onboarding-pet-kind">' + sp.speciesName + "</span>";
        btn.addEventListener("click", function () {
            onboardingDraft.species = id;
            renderOnboardingPetState();
        });
        grid.appendChild(btn);
    });

    renderOnboardingPetState();
}

function renderOnboardingPetState() {
    const grid = document.getElementById("onboarding-pets");
    if (!grid) { return; }
    [...grid.children].forEach(function (btn) {
        const on = btn.dataset.species === onboardingDraft.species;
        btn.classList.toggle("is-selected", on);
        btn.setAttribute("aria-pressed", String(on));
    });
}


/* =====================================================
   NAVIGATION ZWISCHEN DEN SCHRITTEN
   ===================================================== */

function showOnboardingStep(n) {

    onboardingStep = Math.max(1, Math.min(ONBOARDING_STEP_COUNT, n));

    onboardingOverlay.querySelectorAll(".onboarding-step").forEach(function (el) {
        el.hidden = Number(el.dataset.step) !== onboardingStep;
    });

    const progress = document.getElementById("onboarding-progress");
    if (progress) {
        progress.textContent = "Schritt " + onboardingStep + " von " + ONBOARDING_STEP_COUNT;
    }

    if (onboardingStep === 1) {
        if (onboardingNameInput) { onboardingNameInput.value = onboardingDraft.name; }
        refreshStep1Button();
    }

    // Fokus auf die Überschrift des Schritts (Screenreader / Tastatur).
    const heading = onboardingOverlay.querySelector('.onboarding-step[data-step="' + onboardingStep + '"] h2');
    if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
    }
}

function goToOnboardingStep(n) {
    showOnboardingStep(n);
}

function wireOnboardingNav() {

    onboardingOverlay.querySelectorAll("[data-onboarding-next]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            if (onboardingStep === 1 && refreshAndCheckStep1()) { return; }
            goToOnboardingStep(onboardingStep + 1);
        });
    });

    onboardingOverlay.querySelectorAll("[data-onboarding-back]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            goToOnboardingStep(onboardingStep - 1);
        });
    });

    const finishBtn = onboardingOverlay.querySelector("[data-onboarding-finish]");
    if (finishBtn) {
        finishBtn.addEventListener("click", finishOnboarding);
    }
}


/* =====================================================
   ABSCHLUSS: ALLES GEMEINSAM SPEICHERN
   ===================================================== */

function finishOnboarding() {

    player.name = onboardingDraft.name.trim();
    player.avatar = onboardingDraft.avatar;

    player.levelBadge = {
        shape: onboardingDraft.badge.shape,
        color: onboardingDraft.badge.color
    };

    player.sidebarTheme = onboardingDraft.theme;

    // Baumkind: gewählte Art aktiv + freigeschaltet (kein Bako-Item).
    if (!player.tamagotchi || typeof player.tamagotchi !== "object") {
        player.tamagotchi = (typeof defaultTamagotchi === "function") ? defaultTamagotchi() : { species: "igel", unlockedSpecies: ["igel"], names: {} };
    }
    player.tamagotchi.species = onboardingDraft.species;

    if (!Array.isArray(player.tamagotchi.unlockedSpecies)) {
        player.tamagotchi.unlockedSpecies = ["igel"];
    }
    if (player.tamagotchi.unlockedSpecies.indexOf(onboardingDraft.species) === -1) {
        player.tamagotchi.unlockedSpecies.push(onboardingDraft.species);
    }

    const speciesMeta = (window.MIRELON_PET_SPECIES || {})[onboardingDraft.species];
    if (speciesMeta) {
        player.tamagotchi.names = player.tamagotchi.names || {};
        player.tamagotchi.names[onboardingDraft.species] = speciesMeta.name;
        player.tamagotchi.name = speciesMeta.name;
    }

    player.introSeen = true;

    savePlayer();
    updatePlayerUI();

    if (typeof applySidebarTheme === "function") {
        applySidebarTheme(player.sidebarTheme);
    }

    window.dispatchEvent(new CustomEvent("player-updated"));

    onboardingOverlay.hidden = true;
    updateLockedHotspots();

    // Das neue Baumkind begrüßt auf der Startkarte.
    if (typeof window.mirelonPetGreet === "function") {
        setTimeout(window.mirelonPetGreet, 400);
    }
}


/* =====================================================
   AUF DEN ECHTEN SPIELSTAND REAGIEREN
   "player-ready" feuert JS/auth.js NACH einem erfolgreichen
   Cloud-Pull (oder sofort im Gast-Fall).
   ===================================================== */

function syncStartPageToPlayer() {

    // Onboarding noch nicht abgeschlossen -> Entwurf neu vorbelegen
    // (der echte Stand könnte jetzt Cloud-Werte enthalten), sonst
    // Startseite auf den echten Stand bringen.
    if (onboardingShouldShow() && !onboardingBuilt) {
        seedOnboardingDraft();
    }

    updateOnboardingVisibility();
    updateLockedHotspots();
}

window.addEventListener("player-ready", syncStartPageToPlayer);

window.addEventListener("player-updated", function () {
    if (typeof getPlayerHydrationState === "function" &&
        getPlayerHydrationState() !== "ready") {
        return;
    }
    updateOnboardingVisibility();
});

updateOnboardingVisibility();


/* =====================================================
   "KOMMT BALD"-HOTSPOTS AUF DER KARTE (Schloss & Tamos Werkstatt)
   Beide werden GEMEINSAM mit player.progression.unlockedFeatures
   = ["castle"] (Stufe 3) nutzbar - einzige Quelle der Wahrheit,
   dieselbe wie Sidebar (JS/sidebar.js) und Schloss-Seite
   (JS/schloss.js). Klick-auf-gesperrt nutzt window.showLockedFeatureMessage.
   ===================================================== */

// data-locked-feature -> Feature, das den Ort freischaltet
const HOTSPOT_GATE = { castle: "castle", tamo: "castle" };
const HOTSPOT_OPEN_TOOLTIP = {
    castle: "Gehe zu Deinem Schloss",
    tamo: "Gehe zu Tamos Werkstatt"
};

function updateLockedHotspots() {

    const unlocked =
        (typeof player !== "undefined" && player.progression &&
            Array.isArray(player.progression.unlockedFeatures))
            ? player.progression.unlockedFeatures
            : [];

    document.querySelectorAll('.home-map-hotspot--locked[data-locked-feature]').forEach(function (hotspot) {

        const key = hotspot.dataset.lockedFeature;
        const gate = HOTSPOT_GATE[key] || key;

        if (unlocked.indexOf(gate) === -1) {
            return;
        }

        hotspot.classList.remove("home-map-hotspot--locked");
        hotspot.removeAttribute("aria-disabled");
        hotspot.removeAttribute("data-locked-feature");

        const badge = hotspot.querySelector(".home-map-lock-badge");
        if (badge) {
            badge.remove();
        }

        const tooltip = hotspot.querySelector(".home-map-tooltip");
        if (tooltip && HOTSPOT_OPEN_TOOLTIP[key]) {
            tooltip.textContent = HOTSPOT_OPEN_TOOLTIP[key];
        }

    });

}

updateLockedHotspots();

window.addEventListener("player-updated", updateLockedHotspots);

document.querySelectorAll(".home-map").forEach(function (mapEl) {

    mapEl.addEventListener("click", function (event) {

        const lockedHotspot = event.target.closest(".home-map-hotspot--locked");

        if (!lockedHotspot) {
            return;
        }

        event.preventDefault();

        if (typeof window.showLockedFeatureMessage === "function") {
            window.showLockedFeatureMessage(lockedHotspot.dataset.lockedFeature);
        }

    });

});
