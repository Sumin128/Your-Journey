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
    const collectionTabsEl = document.getElementById("tamo-collection-tabs");
    const coinCountEl = document.getElementById("tamo-coin-count");
    const lockedEl = document.getElementById("tamo-locked");

    if (!shelfEl) {
        return;
    }

    // Tamos Werkstatt öffnet GEMEINSAM mit dem Schloss (Stufe 3) -
    // einzige Quelle der Wahrheit: player.progression.unlockedFeatures,
    // dieselbe Prüfung wie Sidebar (JS/sidebar.js) und Schloss
    // (JS/schloss.js). Direkter Aufruf der URL vorher wird hier
    // freundlich abgefangen (keine Käufe möglich).
    function castleUnlocked() {
        return Boolean(player.progression) &&
            Array.isArray(player.progression.unlockedFeatures) &&
            player.progression.unlockedFeatures.indexOf("castle") !== -1;
    }

    // Alles außer der "kommt bald"-Karte
    const openSections = [
        document.querySelector(".tamo-intro"),
        document.querySelector(".tamo-workbench"),
        collectionTabsEl,
        shelfEl,
        document.querySelector(".tamo-hint")
    ];

    const ALL_KEY = "__all__";

    function activeForSale() {
        return SCHLOSS_FURNITURE.filter(function (f) {
            return f.unlockedBy === null && schlossFurnitureActive(f);
        });
    }

    /* Kollektions-Reiter oben in der Werkstatt: "Alle" + ein Reiter je
       Kollektion (SCHLOSS_COLLECTIONS), die mindestens ein AKTIVES
       kaufbares Möbel hat. Reine Shop-Sortierung - KEINE Auswirkung auf
       Besitz, Platzierung oder das aktive Raumdesign. Wächst automatisch
       mit weiteren Kollektionen (rosa, eis, ...). */
    function shopCollections() {
        const present = {};
        activeForSale().forEach(function (f) {
            present[f.collection || "wald"] = true;
        });
        const meta = (typeof SCHLOSS_COLLECTIONS !== "undefined" && Array.isArray(SCHLOSS_COLLECTIONS))
            ? SCHLOSS_COLLECTIONS : [{ key: "wald", name: "Wald", sort: 10 }];
        const cols = meta.filter(function (c) { return present[c.key]; })
            .slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
        // Kollektionen ohne Meta-Eintrag trotzdem zeigen (Notnagel).
        Object.keys(present).forEach(function (k) {
            if (!cols.some(function (c) { return c.key === k; })) {
                cols.push({ key: k, name: k.charAt(0).toUpperCase() + k.slice(1), sort: 999 });
            }
        });
        return [{ key: ALL_KEY, name: "Alle", sort: -1 }].concat(cols);
    }

    let activeCollection = ALL_KEY;

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

    function renderCollectionTabs(cols) {

        if (!collectionTabsEl) { return; }

        collectionTabsEl.innerHTML = "";

        // Nur ein Reiter ("Alle") -> Leiste einklappen, kein toter Zustand.
        if (cols.length <= 1) { return; }

        cols.forEach(function (c) {
            const tab = document.createElement("button");
            tab.type = "button";
            tab.className = "tamo-collection-tab" + (c.key === activeCollection ? " is-active" : "");
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-selected", c.key === activeCollection ? "true" : "false");
            tab.textContent = c.name;
            tab.addEventListener("click", function () {
                if (activeCollection === c.key) { return; }
                activeCollection = c.key;
                render();
            });
            collectionTabsEl.appendChild(tab);
        });
    }

    function render() {

        const locked = !castleUnlocked();

        if (lockedEl) {
            lockedEl.hidden = !locked;
        }
        openSections.forEach(function (el) {
            if (el) { el.hidden = locked; }
        });

        // Der seiten-eigene Text steht schon im HTML (#tamo-locked-text) -
        // absichtlich anders als der kurze Sidebar-Hinweis.
        if (locked) {
            return;
        }

        if (coinCountEl) {
            coinCountEl.textContent = coins();
        }

        // Kollektions-Reiter: "Alle" + je Kollektion mit aktiven Möbeln.
        const cols = shopCollections();
        if (!cols.some(function (c) { return c.key === activeCollection; })) {
            activeCollection = ALL_KEY;
        }
        renderCollectionTabs(cols);

        const ownedList = owned();

        // Regal: alle aktiven, frei kaufbaren Möbel; "Alle" zeigt alles,
        // ein Kollektions-Reiter filtert NUR die Anzeige (kein Einfluss auf
        // Besitz/Platzierung).
        const forSale = activeForSale().filter(function (f) {
            return activeCollection === ALL_KEY || (f.collection || "wald") === activeCollection;
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
            const colName = (cols.find(function (c) { return c.key === activeCollection; }) || {}).name;
            empty.textContent = (colName && activeCollection !== ALL_KEY)
                ? "Für " + colName + " schnitzt Tamo noch – schau bald wieder rein! 🪚"
                : "Tamo hat gerade alles verkauft – schau später wieder vorbei! 🎉";
            shelfEl.appendChild(empty);
        }

    }

    render();
    window.addEventListener("player-updated", render);

})();
