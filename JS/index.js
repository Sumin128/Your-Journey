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
