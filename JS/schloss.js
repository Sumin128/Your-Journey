/* =====================================================
   SCHLOSS.JS
   "Mein Schloss": Raum-Editor (Phase 1 - ein Raum, kein Shop, keine
   Möbel-Bemalung). Reine Layout-Daten (kein RPC nötig) - Speichern
   läuft ganz normal über savePlayer()/player-updated, siehe
   JS/player.js. Nur die wirtschaftlich wertvollen Felder
   (schloss.ownedFurniture/unlockedRooms) sind serverseitig
   geschützt, siehe supabase_migration_schloss.sql.
   Feature-Spezifikation: docs/mein-schloss.md
   ===================================================== */

(function () {

    const lockedSection = document.getElementById("schloss-locked");
    const lockedText = document.getElementById("schloss-locked-text");
    const editorSection = document.getElementById("schloss-editor");
    const roomEl = document.getElementById("schloss-room");
    const inventoryEl = document.getElementById("schloss-inventory");
    const undoButton = document.getElementById("schloss-undo");
    const itemMenu = document.getElementById("schloss-item-menu");

    if (!lockedSection || !editorSection || !roomEl) {
        return;
    }

    function isUnlocked() {
        return Boolean(player.progression) &&
            Array.isArray(player.progression.unlockedFeatures) &&
            player.progression.unlockedFeatures.indexOf("castle") !== -1;
    }

    function activeRoom() {
        return player.schloss.rooms[player.schloss.activeRoom || "wohnzimmer"];
    }

    function saveSchloss() {
        savePlayer();
        window.dispatchEvent(new CustomEvent("player-updated"));
    }


    /* --- Undo: kleiner In-Memory-Stack von placedItems-Schnappschüssen,
       nur für die laufende Sitzung (keine eigene Persistenz). --- */

    let undoStack = [];

    function pushUndoSnapshot() {
        undoStack.push(JSON.parse(JSON.stringify(activeRoom().placedItems || [])));
        if (undoStack.length > 30) {
            undoStack.shift();
        }
        updateUndoButton();
    }

    function undo() {
        if (!undoStack.length) {
            return;
        }
        activeRoom().placedItems = undoStack.pop();
        saveSchloss();
        renderRoom();
        updateUndoButton();
    }

    function updateUndoButton() {
        if (undoButton) {
            undoButton.disabled = undoStack.length === 0;
        }
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
                placeFurniture(furnitureId);
            });

            inventoryEl.appendChild(button);

        });

    }

    function placeFurniture(furnitureId) {

        pushUndoSnapshot();

        const room = activeRoom();

        // Frisch platzierte Möbel leicht gestaffelt statt exakt
        // übereinander (rein kosmetisch - Kind zieht sie danach sowieso
        // frei an ihren Platz).
        const stagger = room.placedItems.length % 6;

        room.placedItems.push({
            instanceId: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            furnitureId: furnitureId,
            design: 0,
            color: null,
            customVariantId: null,
            x: 0.22 + stagger * 0.09,
            y: 0.5 + (stagger % 2) * 0.12,
            flipped: false,
            scale: 1,
            content: null
        });

        saveSchloss();
        renderRoom();

    }


    /* --- Platzierte Möbel: Rendern + Ziehen (Pointer Events, gleiche
       Technik wie makeDraggable() in JS/tamagotchi.js) + Kontextmenü
       (Spiegeln/Entfernen/Farbe). --- */

    function renderRoom() {

        roomEl.querySelectorAll(".schloss-placed").forEach(function (el) {
            el.remove();
        });

        (activeRoom().placedItems || []).forEach(function (instance) {

            const furniture = getSchlossFurniture(instance.furnitureId);

            if (!furniture) {
                return;
            }

            const design = furniture.designs[instance.design] || furniture.designs[0];

            const el = document.createElement("button");
            el.type = "button";
            el.className = "schloss-placed" + (instance.flipped ? " schloss-placed--flipped" : "");
            el.style.left = (instance.x * 100) + "%";
            el.style.top = (instance.y * 100) + "%";

            const img = document.createElement("img");
            // Solange die Platzhalter-Sprites (schlossPlaceholderSprite())
            // im Einsatz sind, ist eine Hintergrundfarbe hinter dem Bild
            // unsichtbar (das SVG füllt die ganze Fläche undurchsichtig) -
            // deshalb wird der Platzhalter bei Farbwahl direkt mit der
            // gewählten Farbe neu erzeugt. Echte Gemini-Möbelbilder
            // (Schritt 5/6) nutzen stattdessen das im Architekturplan
            // beschriebene Masken-Tinting, dann fällt das hier weg.
            img.src = (instance.color && design.emoji)
                ? schlossPlaceholderSprite(design.emoji, instance.color)
                : design.sprite;
            img.alt = furniture.name;
            el.appendChild(img);

            makePlacedItemDraggable(el, instance);

            roomEl.appendChild(el);

        });

    }

    function makePlacedItemDraggable(el, instance) {

        let dragging = false;
        let moved = false;
        let pointerId = null;
        // Zwischenstand während des Ziehens bewusst NICHT auf der
        // persistierten instance ablegen (landet sonst im nächsten
        // Undo-Schnappschuss/localStorage mit) - nur lokale Variablen,
        // erst bei erfolgreichem Loslassen auf instance.x/y übernommen.
        let pendingX = null;
        let pendingY = null;

        el.addEventListener("pointerdown", function (event) {

            pointerId = event.pointerId;
            dragging = true;
            moved = false;
            pendingX = null;
            pendingY = null;
            el.setPointerCapture(pointerId);
            el.classList.add("schloss-placed--dragging");

        });

        el.addEventListener("pointermove", function (event) {

            if (!dragging || event.pointerId !== pointerId) {
                return;
            }

            moved = true;

            const bounds = roomEl.getBoundingClientRect();
            let x = (event.clientX - bounds.left) / bounds.width;
            let y = (event.clientY - bounds.top) / bounds.height;

            // Sanft auf ein unsichtbares 2%-Raster runden (fühlt sich
            // frei an, Positionen bleiben sauber vergleichbar), siehe
            // Architekturplan Abschnitt A.
            x = Math.round(Math.max(0.02, Math.min(0.96, x)) * 50) / 50;
            y = Math.round(Math.max(0.02, Math.min(0.94, y)) * 50) / 50;

            el.style.left = (x * 100) + "%";
            el.style.top = (y * 100) + "%";

            pendingX = x;
            pendingY = y;

        });

        function endDrag(event) {

            if (!dragging || event.pointerId !== pointerId) {
                return;
            }

            dragging = false;
            el.classList.remove("schloss-placed--dragging");

            if (moved && typeof pendingX === "number") {

                pushUndoSnapshot();
                instance.x = pendingX;
                instance.y = pendingY;
                saveSchloss();

            } else if (!moved) {

                openItemMenu(instance, el);

            }

        }

        el.addEventListener("pointerup", endDrag);
        el.addEventListener("pointercancel", endDrag);

    }


    /* --- Kontextmenü für ein ausgewähltes, platziertes Möbelstück --- */

    function openItemMenu(instance, anchorEl) {

        const furniture = getSchlossFurniture(instance.furnitureId);

        if (!furniture || !itemMenu) {
            return;
        }

        itemMenu.innerHTML = "";
        itemMenu.hidden = false;

        const title = document.createElement("strong");
        title.textContent = furniture.name;
        itemMenu.appendChild(title);

        const actions = document.createElement("div");
        actions.className = "schloss-item-menu-actions";

        const flipButton = document.createElement("button");
        flipButton.type = "button";
        flipButton.className = "yj-button yj-button--secondary yj-button--compact";
        flipButton.textContent = "🔄 Spiegeln";
        flipButton.addEventListener("click", function () {
            pushUndoSnapshot();
            instance.flipped = !instance.flipped;
            saveSchloss();
            renderRoom();
            closeItemMenu();
        });
        actions.appendChild(flipButton);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "yj-button yj-button--secondary yj-button--compact";
        removeButton.textContent = "🗑️ Entfernen";
        removeButton.addEventListener("click", function () {
            pushUndoSnapshot();
            const room = activeRoom();
            room.placedItems = room.placedItems.filter(function (item) {
                return item.instanceId !== instance.instanceId;
            });
            saveSchloss();
            renderRoom();
            closeItemMenu();
        });
        actions.appendChild(removeButton);

        itemMenu.appendChild(actions);

        if (furniture.colorable && furniture.colors.length) {

            const swatches = document.createElement("div");
            swatches.className = "schloss-item-menu-colors";

            furniture.colors.forEach(function (color) {

                const swatch = document.createElement("button");
                swatch.type = "button";
                swatch.className = "schloss-color-swatch";
                swatch.style.background = color;
                swatch.setAttribute("aria-label", "Farbe wählen");

                swatch.addEventListener("click", function () {
                    pushUndoSnapshot();
                    instance.color = color;
                    saveSchloss();
                    renderRoom();
                    closeItemMenu();
                });

                swatches.appendChild(swatch);

            });

            itemMenu.appendChild(swatches);

        }

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "schloss-item-menu-close";
        closeButton.setAttribute("aria-label", "Menü schließen");
        closeButton.textContent = "✕";
        closeButton.addEventListener("click", closeItemMenu);
        itemMenu.appendChild(closeButton);

    }

    function closeItemMenu() {
        if (itemMenu) {
            itemMenu.hidden = true;
        }
    }

    document.addEventListener("click", function (event) {
        if (itemMenu && !itemMenu.hidden && !itemMenu.contains(event.target) && !event.target.closest(".schloss-placed")) {
            closeItemMenu();
        }
    });


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
        renderRoom();
        updateUndoButton();

    }

    if (undoButton) {
        undoButton.addEventListener("click", undo);
    }

    render();

    // Bei Login/Cloud-Pull kann sich der Freischalt-Stand erst nach
    // dem ersten Render ändern (Race, siehe die Baumkind-Lehre in
    // JS/tamagotchi.js) - deshalb hier ebenfalls neu rendern.
    window.addEventListener("player-updated", render);

})();
