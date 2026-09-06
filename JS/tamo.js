/* =====================================================
   TAMO BIBER – SCHLOSSWERKSTATT  (tamo_werkstatt.html)

   Eigenständige Möbelshop-Seite für "Mein Schloss". Löst den früheren
   "Laden"-Tab im Schloss ab – die Kauf-/Besitz-/Coin-Logik ist
   dieselbe wie zuvor: server-RPC purchase_schloss_furniture() bei
   angemeldeten Konten (supabase_migration_schloss_shop.sql), lokaler
   Abzug für Gäste. Gekauftes Möbel landet in
   player.schloss.ownedFurniture und erscheint dann im Schloss-Inventar
   (JS/schloss.js renderInventory()) – keine zweite Besitz-Quelle.

   Angeboten wird jedes Katalog-Möbel mit unlockedBy === null. Die
   Level-Belohnungs-Möbel (Startpaket, Waldlampe) bleiben bewusst
   ausschließlich über earn_xp()-Level-Aufstiege erreichbar.
   ===================================================== */

(function () {
    "use strict";

    if (typeof player === "undefined" || typeof SCHLOSS_FURNITURE === "undefined") {
        return;
    }

    const shelfEl = document.getElementById("tamo-shelf");
    const coinCountEl = document.getElementById("tamo-coin-count");

    if (!shelfEl) {
        return;
    }

    /* Tamos Kategorien in Anzeige-Reihenfolge. tamoCategory() ordnet
       jedes Katalog-Möbel einem dieser Fächer zu (Katalog-`category`
       plus ein paar gezielte Sonderfälle). */
    const CATEGORIES = [
        { id: "sitzmoebel", name: "Sitzmöbel", icon: "🪑" },
        { id: "tische", name: "Tische", icon: "🪵" },
        { id: "teppiche", name: "Teppiche & Kissen", icon: "🧶" },
        { id: "licht", name: "Licht", icon: "🕯️" },
        { id: "aufbewahrung", name: "Aufbewahrung", icon: "🧰" },
        { id: "pflanzen", name: "Pflanzen", icon: "🌿" },
        { id: "wanddeko", name: "Wanddeko", icon: "🖼️" }
    ];

    function tamoCategory(furniture) {
        const id = furniture.id;
        const c = furniture.category;

        if (id.indexOf("teppich") === 0 || id.indexOf("kissen") === 0) { return "teppiche"; }
        if (c === "sitzmoebel") { return "sitzmoebel"; }
        if (c === "tische") { return "tische"; }
        if (c === "licht") { return "licht"; }
        if (c === "pflanzen") { return "pflanzen"; }
        if (c === "regale" || c === "aufbewahrung") { return "aufbewahrung"; }
        // deko + textilien-Rest (Vorhang) → Wanddeko
        return "wanddeko";
    }

    function loggedIn() {
        return typeof isLoggedIn === "function" && isLoggedIn();
    }

    function coins() {
        return player.coins || 0;
    }

    function owned() {
        return (player.schloss && player.schloss.ownedFurniture) || [];
    }

    function toast(msg, type) {
        if (typeof showMirelonToast === "function") {
            showMirelonToast(msg, type || "info");
        }
    }

    /* ---- Kauf: exakt das bisherige Schloss-Laden-Muster ---- */

    async function buyFurniture(furnitureId, card) {

        const furniture = getSchlossFurniture(furnitureId);

        if (!furniture) {
            return;
        }

        if (owned().indexOf(furnitureId) !== -1) {
            toast(furniture.name + " gehört dir schon.", "info");
            return;
        }

        if (coins() < furniture.price) {
            toast("Dir fehlen noch " + (furniture.price - coins()) + " Münzen.", "error");
            return;
        }

        if (card) { card.classList.add("is-busy"); }

        try {

            if (loggedIn()) {

                const result = await supabaseClient.rpc("purchase_schloss_furniture", { p_furniture_id: furnitureId });

                if (result.error) { throw result.error; }

                if (result.data && typeof result.data.coins === "number") {
                    player.coins = result.data.coins;
                }

            } else {

                player.coins -= furniture.price;

            }

            if (!player.schloss) { player.schloss = {}; }
            if (!Array.isArray(player.schloss.ownedFurniture)) { player.schloss.ownedFurniture = []; }
            if (player.schloss.ownedFurniture.indexOf(furnitureId) === -1) {
                player.schloss.ownedFurniture.push(furnitureId);
            }

            if (typeof registerShopPurchase === "function") { registerShopPurchase(); }

            savePlayer();
            window.dispatchEvent(new CustomEvent("player-updated"));

            toast("🪵 " + furniture.name + " ist fertig – ab damit in dein Schloss-Inventar!", "info");

        } catch (e) {

            toast("Kauf fehlgeschlagen: " + (e && e.message ? e.message : e), "error");

        } finally {

            if (card) { card.classList.remove("is-busy"); }
            render();

        }

    }

    /* ---- Rendern ---- */

    function render() {

        if (coinCountEl) {
            coinCountEl.textContent = coins();
        }

        const ownedList = owned();

        const forSale = SCHLOSS_FURNITURE.filter(function (f) {
            return f.unlockedBy === null;
        });

        shelfEl.innerHTML = "";

        CATEGORIES.forEach(function (cat) {

            const items = forSale.filter(function (f) {
                return tamoCategory(f) === cat.id;
            });

            if (!items.length) {
                return;
            }

            const section = document.createElement("section");
            section.className = "tamo-cat";

            const heading = document.createElement("h2");
            heading.className = "tamo-cat-title";
            heading.innerHTML = '<span class="tamo-cat-icon" aria-hidden="true">' + cat.icon + "</span>" + cat.name;
            section.appendChild(heading);

            const grid = document.createElement("div");
            grid.className = "tamo-grid";

            items.forEach(function (f) {

                const isOwned = ownedList.indexOf(f.id) !== -1;
                const canAfford = coins() >= f.price;

                const card = document.createElement("div");
                card.className = "tamo-card" + (isOwned ? " is-owned" : "");

                card.innerHTML =
                    '<div class="tamo-card-plank">' +
                        '<img class="tamo-card-img" src="' + f.designs[0].sprite + '" alt="" decoding="async">' +
                    "</div>" +
                    '<span class="tamo-card-name">' + f.name + "</span>" +
                    (isOwned
                        ? '<span class="tamo-card-owned">✓ Schon bei dir</span>'
                        : '<span class="tamo-card-price"><img src="images/muenze.png" alt="" class="coin-icon"> ' + f.price + "</span>" +
                          '<button type="button" class="yj-button yj-button--compact tamo-buy"' +
                            (canAfford ? "" : " disabled") + ">" +
                            (canAfford ? "Kaufen" : "Zu wenig Münzen") +
                          "</button>");

                if (!isOwned) {
                    const btn = card.querySelector(".tamo-buy");
                    if (btn) {
                        btn.addEventListener("click", function () {
                            buyFurniture(f.id, card);
                        });
                    }
                }

                grid.appendChild(card);

            });

            section.appendChild(grid);
            shelfEl.appendChild(section);

        });

        if (!shelfEl.children.length) {
            const empty = document.createElement("p");
            empty.className = "tamo-loading";
            empty.textContent = "Tamo hat gerade alles verkauft – schau später wieder vorbei! 🎉";
            shelfEl.appendChild(empty);
        }

    }

    render();
    window.addEventListener("player-updated", render);

})();
