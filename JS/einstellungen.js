/* =====================================================
   EINSTELLUNGEN
   ===================================================== */

(function () {

    /* =====================================================
       PROFIL: NAME
       ===================================================== */

    const settingsNameInput =
        document.getElementById("settings-name-input");

    const settingsSaveNameButton =
        document.getElementById("settings-save-name");

    if (settingsNameInput) {

        settingsNameInput.value = player.name || "";

    }

    function saveSettingsName() {

        const name = settingsNameInput.value.trim();

        if (!name) {
            return;
        }

        player.name = name;

        savePlayer();
        updatePlayerUI();

        window.dispatchEvent(new CustomEvent("player-updated"));

    }

    if (settingsSaveNameButton) {

        settingsSaveNameButton.addEventListener(
            "click",
            saveSettingsName
        );

    }

    if (settingsNameInput) {

        settingsNameInput.addEventListener("keydown", function (event) {

            if (event.key === "Enter") {
                saveSettingsName();
            }

        });

    }


    /* =====================================================
       PROFIL: AVATAR
       ===================================================== */

    const settingsAvatarSelection =
        document.getElementById("settings-avatar-selection");

    function renderSettingsAvatars() {

        if (!settingsAvatarSelection || typeof characters === "undefined") {
            return;
        }

        settingsAvatarSelection.innerHTML = "";

        characters.forEach(function (character) {

            const image = document.createElement("img");

            image.src = character.image;
            image.alt = "Avatar " + character.id;
            image.classList.add("avatar");

            if (player.avatar === character.image) {
                image.classList.add("selected");
            }

            image.addEventListener("click", function () {

                player.avatar = character.image;

                savePlayer();
                updatePlayerUI();

                window.dispatchEvent(new CustomEvent("player-updated"));

                settingsAvatarSelection
                    .querySelectorAll(".avatar")
                    .forEach(function (avatarImage) {
                        avatarImage.classList.remove("selected");
                    });

                image.classList.add("selected");

            });

            settingsAvatarSelection.appendChild(image);

        });

    }

    renderSettingsAvatars();


    const soundToggle =
        document.getElementById("sound-toggle");

    if (soundToggle) {

        soundToggle.checked = isSoundOn();

        soundToggle.addEventListener("change", function () {

            setSoundOn(soundToggle.checked);

        });

    }


    const darkToggle =
        document.getElementById("dark-toggle");

    if (darkToggle) {

        darkToggle.checked = isDarkMode();

        darkToggle.addEventListener("change", function () {

            setDarkMode(darkToggle.checked);

        });

    }

})();
