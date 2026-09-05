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
    const shopEl = document.getElementById("schloss-shop");
    const tabButtons = document.querySelectorAll(".schloss-tab");
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
        // frei an ihren Platz). Raster aus Spalte+Zeile statt nur einem
        // 6er-Zyklus, damit sich Positionen nicht schon ab dem 7. Stück
        // wiederholen (kein Limit für gleichzeitig platzierte Möbel).
        const index = room.placedItems.length;
        const col = index % 6;
        const row = Math.floor(index / 6) % 3;
        const wrapNudge = Math.floor(index / 18) * 0.015;

        room.placedItems.push({
            instanceId: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            furnitureId: furnitureId,
            design: 0,
            color: null,
            customVariantId: null,
            x: 0.14 + col * 0.13 + wrapNudge,
            y: 0.32 + row * 0.22 + wrapNudge,
            flipped: false,
            scale: 1,
            content: null
        });

        saveSchloss();
        renderRoom();

    }


    /* --- Schlossladen (Phase 2): jedes Möbelstück mit unlockedBy === null
       ist normal per Coins kaufbar. Level-Belohnungs-Möbel (unlockedBy.type
       === "level", z. B. das Startpaket) taucht hier bewusst NICHT auf -
       das bleibt ausschließlich über earn_xp()-Level-Aufstiege erreichbar,
       siehe supabase_migration_schloss_shop.sql. Kauf-Ablauf ist exakt das
       Muster aus JS/bako.js buyBaumkind(): lokale Vorab-Prüfung -> RPC (bei
       Login) bzw. lokaler Abzug (Gast) -> serverseitigen Wert übernehmen ->
       ownedFurniture ergänzen -> speichern. --- */

    function renderShop() {

        if (!shopEl) {
            return;
        }

        shopEl.innerHTML = "";

        const owned = player.schloss.ownedFurniture || [];

        const purchasable = SCHLOSS_FURNITURE.filter(function (furniture) {
            return furniture.unlockedBy === null && owned.indexOf(furniture.id) === -1;
        });

        if (!purchasable.length) {
            const empty = document.createElement("p");
            empty.className = "schloss-inventory-empty";
            empty.textContent = "Du hast schon alles aus dem Laden! 🎉";
            shopEl.appendChild(empty);
            return;
        }

        purchasable.forEach(function (furniture) {

            const card = document.createElement("button");
            card.type = "button";
            card.className = "schloss-inv-item schloss-shop-item";
            card.innerHTML =
                '<img src="' + furniture.designs[0].sprite + '" alt="">' +
                '<span>' + furniture.name + '</span>' +
                '<span class="schloss-shop-price"><img src="images/muenze.png" alt="" class="coin-icon"> ' + furniture.price + '</span>';

            card.addEventListener("click", function () {
                buySchlossFurniture(furniture.id, card);
            });

            shopEl.appendChild(card);

        });

    }

    async function buySchlossFurniture(furnitureId, button) {

        const furniture = getSchlossFurniture(furnitureId);

        if (!furniture) {
            return;
        }

        if ((player.schloss.ownedFurniture || []).indexOf(furnitureId) !== -1) {
            showMirelonToast(furniture.name + " gehört dir schon.", "info");
            return;
        }

        if ((player.coins || 0) < furniture.price) {
            showMirelonToast("Dir fehlen noch " + (furniture.price - player.coins) + " Münzen.", "error");
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {

            const loggedIn = typeof isLoggedIn === "function" && isLoggedIn();

            if (loggedIn) {

                const result = await supabaseClient.rpc("purchase_schloss_furniture", { p_furniture_id: furnitureId });

                if (result.error) {
                    throw result.error;
                }

                if (result.data && typeof result.data.coins === "number") {
                    player.coins = result.data.coins;
                }

            } else {

                player.coins -= furniture.price;

            }

            if (!Array.isArray(player.schloss.ownedFurniture)) {
                player.schloss.ownedFurniture = [];
            }

            if (player.schloss.ownedFurniture.indexOf(furnitureId) === -1) {
                player.schloss.ownedFurniture.push(furnitureId);
            }

            showMirelonToast("🛍️ " + furniture.name + " gehört jetzt dir!", "info");

            saveSchloss();
            renderInventory();
            renderShop();

        } catch (e) {

            showMirelonToast("Kauf fehlgeschlagen: " + (e && e.message ? e.message : e), "error");

        } finally {

            if (button) {
                button.disabled = false;
            }

        }

    }

    tabButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            tabButtons.forEach(function (other) {
                other.classList.toggle("is-active", other === button);
            });

            const tab = button.dataset.schlossTab;
            inventoryEl.hidden = tab !== "inventory";
            if (shopEl) {
                shopEl.hidden = tab !== "shop";
            }

        });

    });


    /* --- Farb-Technikprobe (Architekturplan Abschnitt A): konturerhaltendes
       Einfärben per Canvas. Ein reiner CSS-Filter (hue-rotate etc.) würde
       Konturen/Schatten mitverfärben - hier wird stattdessen das Original
       per "multiply" mit der Wunschfarbe abgedunkelt/eingefärbt und
       anschließend per "destination-in" wieder auf die ursprüngliche
       Silhouette (Transparenz) zurückgeschnitten. Ergebnis wird pro
       Sprite+Farbe im Speicher zwischengespeichert (nicht persistiert -
       gespeichert wird nur instance.color, das Bild wird beim nächsten
       Rendern einfach neu erzeugt). --- */

    const tintCache = {};

    function tintSpriteInto(targetImg, spriteSrc, color) {

        const cacheKey = spriteSrc + "|" + color;

        if (tintCache[cacheKey]) {
            targetImg.src = tintCache[cacheKey];
            return;
        }

        const source = new Image();

        source.onload = function () {

            const canvas = document.createElement("canvas");
            canvas.width = source.naturalWidth;
            canvas.height = source.naturalHeight;

            const ctx = canvas.getContext("2d");

            ctx.drawImage(source, 0, 0);
            ctx.globalCompositeOperation = "multiply";
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(source, 0, 0);

            const dataUrl = canvas.toDataURL("image/png");
            tintCache[cacheKey] = dataUrl;
            targetImg.src = dataUrl;

        };

        source.src = spriteSrc;

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
            img.alt = furniture.name;

            if (instance.color) {
                // Farb-Technikprobe (Architekturplan Abschnitt A):
                // konturerhaltendes Einfärben per Canvas statt eines
                // CSS-Filters (der würde Beschläge/Schatten mitfärben).
                img.src = design.sprite;
                tintSpriteInto(img, design.sprite, instance.color);
            } else {
                img.src = design.sprite;
            }

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
        renderShop();
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
