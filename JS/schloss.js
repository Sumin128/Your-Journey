/* =====================================================
   SCHLOSS.JS
   "Mein Schloss": Raum-Editor. Reine Layout-Daten (kein RPC nötig für
   Platzierung) - Speichern läuft ganz normal über savePlayer()/
   player-updated, siehe JS/player.js. Nur die wirtschaftlich
   wertvollen Felder (schloss.ownedFurniture/unlockedRooms) sind
   serverseitig geschützt, siehe supabase_migration_schloss.sql.
   Feature-Spezifikation: docs/mein-schloss.md

   Die eigentliche Raumansicht (Platzieren/Ziehen/Drehen/Entfernen/
   Speichern der placedItems) läuft seit der 3D-Umstellung komplett in
   JS/schloss-3d.js (Three.js) - diese Datei liefert nur noch, wonach
   das Kind greifen kann (Inventar/Laden), nicht mehr wie/wo es im Raum
   landet. Ein Klick auf ein Inventar-Möbelstück löst hier bewusst
   KEINE direkte Platzierung mehr aus, sondern nur ein Event
   ("schloss:place-furniture") - schloss-3d.js entscheidet, wo/wie es
   in der Szene erscheint (kennt Raumgrenzen, andere Möbel, Kamera).
   ===================================================== */

(function () {

    const lockedSection = document.getElementById("schloss-locked");
    const lockedText = document.getElementById("schloss-locked-text");
    const editorSection = document.getElementById("schloss-editor");
    const inventoryEl = document.getElementById("schloss-inventory");
    const styleEl = document.getElementById("schloss-style");
    const tabButtons = document.querySelectorAll(".schloss-tab");
    const drawer = document.getElementById("schloss-drawer");
    const drawerToggle = document.getElementById("schloss-drawer-toggle");

    if (!lockedSection || !editorSection) {
        return;
    }

    function isUnlocked() {
        return Boolean(player.progression) &&
            Array.isArray(player.progression.unlockedFeatures) &&
            player.progression.unlockedFeatures.indexOf("castle") !== -1;
    }

    function saveSchloss() {
        savePlayer();
        window.dispatchEvent(new CustomEvent("player-updated"));
    }


    /* --- Inventar: zeigt JEDES besessene Möbelstück, unabhängig davon,
       ob (und wie oft) es schon platziert ist - Besitz und Instanzen
       im Raum sind bewusst getrennt (einmal kaufen/verdienen, beliebig
       oft platzieren). --- */

    function renderInventory() {

        inventoryEl.innerHTML = "";

        const owned = player.schloss.ownedFurniture || [];

        if (!owned.length) {
            const empty = document.createElement("p");
            empty.className = "schloss-inventory-empty";
            empty.textContent = "Noch keine Möbel – verdiene sie durch deine Mirelon-Abenteuer!";
            inventoryEl.appendChild(empty);
            return;
        }

        owned.forEach(function (furnitureId) {

            const furniture = getSchlossFurniture(furnitureId);

            if (!furniture) {
                return;
            }

            const button = document.createElement("button");
            button.type = "button";
            button.className = "schloss-inv-item";
            button.innerHTML =
                '<img src="' + furniture.designs[0].sprite + '" alt="">' +
                '<span>' + furniture.name + '</span>';

            button.addEventListener("click", function () {
                window.dispatchEvent(new CustomEvent("schloss:place-furniture", {
                    detail: { furnitureId: furnitureId }
                }));
            });

            inventoryEl.appendChild(button);

        });

    }


    /* --- Möbel KAUFEN läuft nicht mehr hier: der Laden ist eine eigene
       Seite (tamo_werkstatt.html / JS/tamo.js), die dieselbe
       purchase_schloss_furniture-Logik nutzt. Im Schloss bleiben nur
       Inventar + Stil; ein Klick auf "Neue Möbel bei Tamo" ist ein
       normaler Link. --- */

    tabButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            // Reine Link-Tabs (zu Tamo) navigieren normal, kein Tab-Wechsel.
            if (button.classList.contains("schloss-tab--link")) {
                return;
            }

            tabButtons.forEach(function (other) {
                other.classList.toggle("is-active", other === button);
            });

            const tab = button.dataset.schlossTab;
            inventoryEl.hidden = tab !== "inventory";
            if (styleEl) { styleEl.hidden = tab !== "style"; }

            // Beim Tab-Wechsel die Schublade automatisch aufklappen.
            if (drawer) { drawer.classList.remove("is-collapsed"); }
            if (drawerToggle) { drawerToggle.setAttribute("aria-expanded", "true"); }

        });

    });

    if (drawerToggle && drawer) {
        drawerToggle.addEventListener("click", function () {
            const collapsed = drawer.classList.toggle("is-collapsed");
            drawerToggle.setAttribute("aria-expanded", String(!collapsed));
        });
    }


    /* --- Stil-Auswahl (Themes). Nur "wald" ist in diesem Durchgang
       vollständig - die anderen drei sind sichtbar, aber gesperrt und
       dürfen nicht wirken, als wären sie fertig. Ein Klick darauf sagt
       kurz Bescheid und wechselt NICHT. --- */

    function renderStyleTab() {

        if (!styleEl || typeof SCHLOSS_THEMES === "undefined") {
            return;
        }

        const activeStyle = (player.schloss && player.schloss.style) || "wald";

        styleEl.innerHTML = "";

        SCHLOSS_THEMES.forEach(function (themeEntry) {

            const card = document.createElement("button");
            card.type = "button";
            card.className = "schloss-style-card" +
                (themeEntry.id === activeStyle ? " is-active" : "") +
                (themeEntry.available ? "" : " is-locked");

            card.innerHTML =
                '<span class="schloss-style-card-icon" aria-hidden="true">' + themeEntry.icon + '</span>' +
                '<span>' + themeEntry.name + '</span>' +
                (themeEntry.available ? "" : '<span class="schloss-style-card-badge">bald</span>');

            card.addEventListener("click", function () {

                if (!themeEntry.available) {
                    showMirelonToast(themeEntry.name + " wird noch gebaut – bald! 🔨", "info");
                    return;
                }

                if (themeEntry.id === ((player.schloss && player.schloss.style) || "wald")) {
                    return;
                }

                player.schloss.style = themeEntry.id;
                saveSchloss();
                renderStyleTab();
                // Die 3D-Szene übernimmt den neuen Stil beim nächsten
                // Laden der Seite (Raumhülle wird bei init gesetzt).
                showMirelonToast("Stil gewechselt zu " + themeEntry.name + ".", "info");

            });

            styleEl.appendChild(card);

        });

    }


    /* --- Einstieg --- */

    function render() {

        if (!isUnlocked()) {

            lockedSection.hidden = false;
            editorSection.hidden = true;

            if (lockedText && typeof LOCKED_FEATURE_MESSAGES !== "undefined") {
                lockedText.textContent = LOCKED_FEATURE_MESSAGES.castle;
            }

            return;

        }

        lockedSection.hidden = true;
        editorSection.hidden = false;

        renderInventory();
        renderStyleTab();

    }

    render();

    // Bei Login/Cloud-Pull kann sich der Freischalt-Stand erst nach
    // dem ersten Render ändern (Race, siehe die Baumkind-Lehre in
    // JS/tamagotchi.js) - deshalb hier ebenfalls neu rendern. Wirkt
    // sich auch auf einen frischen Kauf/Verkauf aus (Inventar/Laden
    // neu zeichnen).
    window.addEventListener("player-updated", render);

})();
