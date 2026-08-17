/* =====================================================
   INDEX.JS
   Begrüßung, Spielername und Avatar-Auswahl
   ===================================================== */

const playerName = document.getElementById("player-name");
const welcomeTitle = document.getElementById("welcome-title");
const welcomeMessage = document.getElementById("welcome-message");
const saveButton = document.getElementById("save-name");
const playerAvatar = document.getElementById("player-avatar");
const playerProfile = document.getElementById("player-profile");
const playerNameDisplay = document.getElementById("player-name-display");
const featherCount = document.getElementById("feather-count");
const avatarSelection = document.getElementById("avatar-selection");
const changeAvatarButton = document.getElementById("change-avatar");

/* =====================================================
   STARTSEITE AKTUALISIEREN
   ===================================================== */

function updatePlayerView() {
    if (welcomeTitle) {
        welcomeTitle.textContent = player.name ? "Hallo " + player.name + "!" : "Hallo!";
    }

    if (featherCount) {
        featherCount.textContent = "🪶 " + player.feathers + " Federn";
    }

    if (player.name && playerName && saveButton) {
        playerName.value = player.name;
        playerName.style.display = "none";
        saveButton.style.display = "none";
    }

    if (player.avatar && playerAvatar && playerProfile && playerNameDisplay) {
        playerAvatar.src = player.avatar;
        playerNameDisplay.textContent = player.name;
        playerProfile.style.display = "flex";

        if (avatarSelection) {
            avatarSelection.style.display = "none";
        }
    }
}

window.addEventListener("player-updated", function () {
    updatePlayerView();
    markSelectedAvatar();
});

/* =====================================================
   AUSGEWÄHLTEN AVATAR MARKIEREN
   ===================================================== */

function markSelectedAvatar() {
    document.querySelectorAll("#avatar-selection .avatar").forEach(function (avatar) {
        avatar.classList.toggle("selected", avatar.getAttribute("src") === player.avatar);
    });
}

/* =====================================================
   NAME SPEICHERN
   ===================================================== */

if (saveButton && playerName) {
    saveButton.addEventListener("click", function () {
        const name = playerName.value.trim();

        if (!name) {
            playerName.focus();
            return;
        }

        player.name = name;
        savePlayer();
        updatePlayerView();
    });
}

/* =====================================================
   AVATARE ANZEIGEN
   ===================================================== */

function showCharacters() {
    if (!avatarSelection) {
        return;
    }

    avatarSelection.innerHTML = "";

    characters.forEach(function (character) {
        const image = document.createElement("img");
        image.src = character.image;
        image.alt = "Avatar " + character.id;
        image.classList.add("avatar");

        if (player.avatar === character.image) {
            image.classList.add("selected");
        }

        image.addEventListener("click", function () {
            document.querySelectorAll(".avatar").forEach(function (avatar) {
                avatar.classList.remove("selected");
            });

            image.classList.add("selected");
            player.avatar = character.image;
            savePlayer();
            markSelectedAvatar();
            updatePlayerView();
            avatarSelection.style.display = "none";
        });

        avatarSelection.appendChild(image);
    });

    markSelectedAvatar();
}

/* =====================================================
   AVATAR ÄNDERN
   ===================================================== */

if (changeAvatarButton && avatarSelection) {
    changeAvatarButton.addEventListener("click", function () {
        avatarSelection.style.display = "grid";
        markSelectedAvatar();
    });
}

/* =====================================================
   KUROS BEGRÜSSUNG
   ===================================================== */

if (welcomeMessage && kuro && kuro.welcome) {
    const random = Math.floor(Math.random() * kuro.welcome.length);
    welcomeMessage.textContent = kuro.welcome[random];
}

showCharacters();
updatePlayerView();
