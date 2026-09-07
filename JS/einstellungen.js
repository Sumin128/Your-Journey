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
       LEVEL-ABZEICHEN - zwei Schritte: Form wählen, Farbe wählen.
       Klick übernimmt/speichert direkt über window.setLevelBadge()
       (JS/sidebar.js) - speichert AUSSCHLIESSLICH
       player.levelBadge = { shape, color }. Keine XP-/DB-Logik.
       ===================================================== */

    const SHAPE_LABEL = { schild: "Schild", herz: "Herz", stern: "Stern", baum: "Baum" };
    const COLOR_LABEL = { waldgruen: "Waldgrün", himmelblau: "Himmelblau", beerenrosa: "Beerenrosa", sonnengold: "Sonnengold" };

    const badgeShapesEl = document.getElementById("settings-badge-shapes");
    const badgeColorsEl = document.getElementById("settings-badge-colors");
    const badgePreview = document.getElementById("settings-badge-preview");
    const badgePreviewNum = document.getElementById("settings-badge-preview-num");

    function currentBadgeChoice() {
        if (typeof window.sidebarBadgeChoice === "function") {
            return window.sidebarBadgeChoice();
        }
        const b = (typeof player !== "undefined" && player.levelBadge) || {};
        return { shape: b.shape || "baum", color: b.color || "waldgruen" };
    }

    function currentLevelNumber() {
        if (typeof mirelonLevelProgress !== "function" || typeof player === "undefined") {
            return 1;
        }
        const xp = (player.progression && typeof player.progression.xp === "number")
            ? player.progression.xp : 0;
        return mirelonLevelProgress(xp).level;
    }

    function makeChoiceButton(kind, value, isSelected, inner, onPick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "settings-badge-choice" + (isSelected ? " is-selected" : "");
        btn.setAttribute("aria-pressed", String(isSelected));
        btn.innerHTML = inner;
        btn.addEventListener("click", onPick);
        return btn;
    }

    function renderBadgePicker() {

        if (!badgeShapesEl || !badgeColorsEl ||
            !Array.isArray(window.MIRELON_BADGE_SHAPES)) {
            return;
        }

        const cur = currentBadgeChoice();

        badgeShapesEl.innerHTML = "";
        window.MIRELON_BADGE_SHAPES.forEach(function (shape) {
            const inner =
                '<span class="settings-badge-choice-icon" style="background-image:url(\'images/badges/' +
                shape + "_" + cur.color + '.png\')"></span>' +
                "<span>" + (SHAPE_LABEL[shape] || shape) + "</span>";
            badgeShapesEl.appendChild(makeChoiceButton(
                "shape", shape, shape === cur.shape, inner,
                function () {
                    if (typeof window.setLevelBadge === "function") {
                        window.setLevelBadge(shape, currentBadgeChoice().color);
                    }
                }
            ));
        });

        badgeColorsEl.innerHTML = "";
        window.MIRELON_BADGE_COLORS.forEach(function (color) {
            const inner =
                '<span class="settings-badge-choice-dot settings-badge-dot--' + color + '"></span>' +
                "<span>" + (COLOR_LABEL[color] || color) + "</span>";
            badgeColorsEl.appendChild(makeChoiceButton(
                "color", color, color === cur.color, inner,
                function () {
                    if (typeof window.setLevelBadge === "function") {
                        window.setLevelBadge(currentBadgeChoice().shape, color);
                    }
                }
            ));
        });

        if (badgePreview) {
            const shp = badgePreview.querySelector(".settings-badge-preview-shape");
            if (shp) {
                shp.style.backgroundImage =
                    'url("images/badges/' + cur.shape + "_" + cur.color + '.png")';
            }
        }
        if (badgePreviewNum) {
            badgePreviewNum.textContent = currentLevelNumber();
        }
    }

    renderBadgePicker();
    window.addEventListener("player-updated", renderBadgePicker);


    /* =====================================================
       KONTO & SPIELSTAND  (Anker #konto)
       Alle Aktionen öffnen NUR bestehende, echte Auth-Abläufe aus
       JS/auth.js (openAccountPanel() + das dortige Konto-Panel:
       Anmelden/Registrieren-Tabs, "E-Mail ändern" / "Passwort ändern"
       als <details>, Ausloggen über signOutAccount()). Es wird keine
       Auth-/Cloud-/Hydration-Logik verändert. Der Gast-/Angemeldet-
       Wechsel der beiden Blöcke erledigt updateAuthUI() über
       [data-guest-only] / [data-auth-only].
       ===================================================== */

    /* Konto-Panel öffnen und darin einen bestimmten Tab bzw. eine der
       <details>-Sektionen aktivieren. Alles nur über vorhandene
       Steuerelemente des Panels - kein neuer Ablauf. */
    function openAccountPanelAt(action) {

        if (typeof openAccountPanel !== "function") {
            return;
        }

        openAccountPanel();

        // Panel-DOM existiert nach openAccountPanel() (createAccountPanel()).
        window.requestAnimationFrame(function () {

            if (action === "signup") {
                const t = document.getElementById("account-tab-signup");
                if (t) { t.click(); }
                return;
            }

            if (action === "login") {
                const t = document.getElementById("account-tab-login");
                if (t) { t.click(); }
                return;
            }

            if (action === "email" || action === "password") {

                const sections = document.querySelectorAll(
                    "#account-logged-in .account-change-section"
                );
                // Reihenfolge im Panel: [0] E-Mail ändern, [1] Passwort ändern
                const target = action === "email" ? sections[0] : sections[1];

                sections.forEach(function (d) { d.open = (d === target); });

                if (target) {
                    target.scrollIntoView({ block: "nearest" });
                    const input = target.querySelector("input");
                    if (input) { input.focus(); }
                }
            }

        });
    }

    const bind = function (id, handler) {
        const el = document.getElementById(id);
        if (el) { el.addEventListener("click", handler); }
    };

    bind("settings-account-create", function () { openAccountPanelAt("signup"); });
    bind("settings-account-signin", function () { openAccountPanelAt("login"); });
    bind("settings-account-email", function () { openAccountPanelAt("email"); });
    bind("settings-account-password", function () { openAccountPanelAt("password"); });

    bind("settings-account-logout", async function () {

        const confirmed =
            typeof showMirelonConfirm === "function"
                ? await showMirelonConfirm(
                    "Möchtest du dich wirklich ausloggen? Dein Spielstand " +
                    "bleibt sicher in deinem Konto gespeichert und ist beim " +
                    "nächsten Anmelden wieder da.",
                    { okLabel: "Ausloggen", cancelLabel: "Angemeldet bleiben" }
                )
                : window.confirm("Wirklich ausloggen?");

        if (confirmed && typeof signOutAccount === "function") {
            signOutAccount();
        }

    });


    /* =====================================================
       SPRUNG ZUM KONTO-ANKER  (#konto)
       Von der Sidebar-Profilkarte (Avatar/Name) aus. Sauberes
       Scrollen + kurze, sehr dezente Umrandung; prefers-reduced-
       motion schaltet die weiche Bewegung ab.
       ===================================================== */

    let kontoHighlightTimer = null;

    function focusKontoSection() {

        const section = document.getElementById("konto");

        if (!section) {
            return;
        }

        const reduceMotion =
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        section.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "start"
        });

        section.classList.add("is-anchor-highlight");

        window.clearTimeout(kontoHighlightTimer);
        kontoHighlightTimer = window.setTimeout(function () {
            section.classList.remove("is-anchor-highlight");
        }, 2200);

    }

    function maybeFocusKonto() {
        if (window.location.hash === "#konto") {
            focusKontoSection();
        }
    }

    // Beim Laden (Gast: sofort; angemeldet: erst wenn der echte
    // Spielstand steht und die Seite sichtbar ist -> player-ready).
    window.requestAnimationFrame(maybeFocusKonto);
    window.addEventListener("player-ready", maybeFocusKonto);
    // Gleiche Seite, Klick auf den Sidebar-Link -> nur der Hash ändert sich.
    window.addEventListener("hashchange", maybeFocusKonto);

})();
