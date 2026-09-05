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
    const shopEl = document.getElementById("schloss-shop");
    const tabButtons = document.querySelectorAll(".schloss-tab");

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

    }

    render();

    // Bei Login/Cloud-Pull kann sich der Freischalt-Stand erst nach
    // dem ersten Render ändern (Race, siehe die Baumkind-Lehre in
    // JS/tamagotchi.js) - deshalb hier ebenfalls neu rendern. Wirkt
    // sich auch auf einen frischen Kauf/Verkauf aus (Inventar/Laden
    // neu zeichnen).
    window.addEventListener("player-updated", render);

})();
