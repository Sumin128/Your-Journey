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


    /* =====================================================
       DESIGN: SIDEBAR-FARBTHEME
       Die eigentliche Anwenden-/Speichern-Logik (inkl.
       Supabase-Sync) steckt in sidebar.js, damit sie auf
       jeder Seite verfügbar ist - hier wird nur der Klick
       auf eine der beiden Karten verkabelt.
       ===================================================== */

    document.querySelectorAll("[data-theme-choice]").forEach(function (card) {

        card.addEventListener("click", function () {

            if (typeof setSidebarTheme === "function") {
                setSidebarTheme(card.dataset.themeChoice);
            }

        });

    });


    /* =====================================================
       LEVEL-ABZEICHEN
       16 Vorschau-Kacheln (4 Formen x 4 Farben) - die
       Speichern-/Anwenden-Logik steckt in sidebar.js
       (window.setLevelBadge), damit sie überall verfügbar ist.
       ===================================================== */

    const badgeGrid = document.getElementById("settings-badge-grid");

    if (badgeGrid && Array.isArray(window.MIRELON_BADGE_SHAPES)) {

        const shapeName = { schild: "Schild", herz: "Herz", blatt: "Blatt-Medaillon", stern: "Stern-Medaille" };
        const colorName = { waldgruen: "Waldgrün", himmelblau: "Himmelblau", beerenrosa: "Beerenrosa", sonnengold: "Sonnengold" };

        window.MIRELON_BADGE_SHAPES.forEach(function (shape) {
            window.MIRELON_BADGE_COLORS.forEach(function (color) {

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "settings-badge-card";
                btn.dataset.badgeShape = shape;
                btn.dataset.badgeColor = color;
                btn.setAttribute("aria-label", shapeName[shape] + ", " + colorName[color]);
                btn.innerHTML =
                    '<span class="settings-badge-preview">' +
                    '<img src="images/badges/' + shape + "_" + color + '.png" alt="" decoding="async">' +
                    '<span class="settings-badge-num">7</span>' +
                    "</span>";

                btn.addEventListener("click", function () {
                    if (typeof window.setLevelBadge === "function") {
                        window.setLevelBadge(shape, color);
                    }
                });

                badgeGrid.appendChild(btn);
            });
        });

        if (typeof window.markSelectedBadge === "function") {
            window.markSelectedBadge();
        }
    }

})();
