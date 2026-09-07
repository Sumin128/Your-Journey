/* =====================================================
   INDEX.JS
   Ersteinrichtung auf der Startseite:
   Name eingeben + Avatar wählen, bevor es losgeht.
   ===================================================== */

const onboardingOverlay = document.getElementById("onboarding-overlay");
const onboardingNameInput = document.getElementById("player-name");
const onboardingSaveButton = document.getElementById("save-name");
const onboardingAvatarSelection = document.getElementById("avatar-selection");

let selectedOnboardingAvatar = player.avatar || "";


/* =====================================================
   ÜBERLAGERUNG EIN-/AUSBLENDEN
   ===================================================== */

function updateOnboardingVisibility() {

    if (!onboardingOverlay) {
        return;
    }

    /* Nur wenn der maßgebliche Spielstand feststeht ("ready").
       Während "loading" ist die Seite ohnehin ausgeblendet; im
       "failed"-Zustand darf das Onboarding NIE erscheinen (der
       echte Cloud-Stand könnte einen Namen enthalten). */
    const hydration =
        typeof getPlayerHydrationState === "function"
            ? getPlayerHydrationState()
            : "ready";

    if (hydration !== "ready") {
        onboardingOverlay.hidden = true;
        return;
    }

    onboardingOverlay.hidden = Boolean(player.name && player.avatar);

}


/* =====================================================
   "LOS GEHT'S"-BUTTON AKTIVIEREN/DEAKTIVIEREN
   ===================================================== */

function updateOnboardingSaveButton() {

    if (!onboardingSaveButton) {
        return;
    }

    const hasName =
        onboardingNameInput &&
        onboardingNameInput.value.trim().length > 0;

    onboardingSaveButton.disabled =
        !(hasName && selectedOnboardingAvatar);

}


/* =====================================================
   AVATARE ANZEIGEN
   ===================================================== */

function renderOnboardingAvatars() {

    if (!onboardingAvatarSelection || typeof characters === "undefined") {
        return;
    }

    onboardingAvatarSelection.innerHTML = "";

    characters.forEach(function (character) {

        const image = document.createElement("img");

        image.src = character.image;
        image.alt = "Avatar " + character.id;
        image.classList.add("avatar");

        if (selectedOnboardingAvatar === character.image) {
            image.classList.add("selected");
        }

        image.addEventListener("click", function () {

            selectedOnboardingAvatar = character.image;

            onboardingAvatarSelection
                .querySelectorAll(".avatar")
                .forEach(function (avatarImage) {
                    avatarImage.classList.remove("selected");
                });

            image.classList.add("selected");

            updateOnboardingSaveButton();

        });

        onboardingAvatarSelection.appendChild(image);

    });

}


/* =====================================================
   EINRICHTUNG SPEICHERN
   ===================================================== */

function saveOnboarding() {

    const name = onboardingNameInput.value.trim();

    if (!name || !selectedOnboardingAvatar) {
        return;
    }

    player.name = name;
    player.avatar = selectedOnboardingAvatar;

    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(new CustomEvent("player-updated"));

    updateOnboardingVisibility();

}


if (onboardingNameInput) {

    onboardingNameInput.value = player.name || "";

    onboardingNameInput.addEventListener(
        "input",
        updateOnboardingSaveButton
    );

    onboardingNameInput.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Enter") {
                saveOnboarding();
            }

        }
    );

}

if (onboardingSaveButton) {

    onboardingSaveButton.addEventListener(
        "click",
        saveOnboarding
    );

}


renderOnboardingAvatars();
updateOnboardingSaveButton();
updateOnboardingVisibility();


/* =====================================================
   AUF DEN ECHTEN SPIELSTAND REAGIEREN
   "player-ready" feuert JS/auth.js NACH einem erfolgreichen
   Cloud-Pull (oder sofort im Gast-Fall). Erst dann die
   Startseite komplett auf den echten Stand bringen.
   ===================================================== */

function syncStartPageToPlayer() {

    selectedOnboardingAvatar = player.avatar || "";

    if (onboardingNameInput) {
        onboardingNameInput.value = player.name || "";
    }

    renderOnboardingAvatars();
    updateOnboardingSaveButton();
    updateOnboardingVisibility();
    updateLockedHotspots();

}

window.addEventListener("player-ready", syncStartPageToPlayer);

/* Spätere echte Änderungen (Name/Avatar im Profil geändert o. ä.). */
window.addEventListener("player-updated", function () {
    if (typeof getPlayerHydrationState === "function" &&
        getPlayerHydrationState() !== "ready") {
        return;
    }
    updateOnboardingVisibility();
});


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
