/* =====================================================
   BAKOS BASAR
   Exotischer fahrender Händler: verkauft die weiteren
   Baumkinder (Freischaltung für den Zauber-Gefährten)
   und Verbrauchs-Feuerwerk.

   Käufe laufen bei angemeldeten Konten serverseitig über
   purchase_item() / purchase_consumable_bundle()
   (supabase_migration_bako_shop.sql); Gäste kaufen lokal.
   Preise stehen serverseitig fest – die Werte hier sind nur
   für Anzeige und die Gast-Berechnung.

   Feature-Spezifikation: docs/zauber-gefaehrte.md
   ===================================================== */

(function () {
    "use strict";

    if (typeof player === "undefined") {
        return;
    }

    var BAUMKINDER = [
        { key: "baumkindOtter", name: "Fenn", art: "Otterjunges", price: 25 },
        { key: "baumkindReh", name: "Taja", art: "Rehkitz", price: 45 },
        { key: "baumkindEichhorn", name: "Piri", art: "Eichhörnchenkind", price: 70 },
        { key: "baumkindBaer", name: "Bruno", art: "Bärenjunges", price: 100 }
    ];

    var FIREWORK = { bundle: "feuerwerk5", item: "feuerwerk", qty: 5, price: 30 };

    function loggedIn() {
        return typeof supabaseClient !== "undefined" && supabaseClient &&
            typeof currentSession !== "undefined" && currentSession;
    }

    function coins() {
        return player.coins || 0;
    }

    function toast(msg, type) {
        if (typeof showMirelonToast === "function") {
            showMirelonToast(msg, type || "info");
        }
    }

    function afterPurchase() {
        if (typeof registerShopPurchase === "function") {
            registerShopPurchase();
        }
        savePlayer();
        window.dispatchEvent(new CustomEvent("player-updated"));
        render();
    }

    /* ---- Baumkind kaufen ---- */

    async function buyBaumkind(entry, btn) {
        if (player.items && player.items[entry.key]) {
            toast(entry.name + " gehört dir schon.", "info");
            return;
        }
        if (coins() < entry.price) {
            toast("Dir fehlen noch " + (entry.price - coins()) + " Münzen.", "error");
            return;
        }

        btn.disabled = true;
        try {
            if (loggedIn()) {
                var res = await supabaseClient.rpc("purchase_item", { item_key: entry.key });
                if (res.error) { throw res.error; }
                if (res.data && typeof res.data.coins === "number") {
                    player.coins = res.data.coins;
                }
            } else {
                player.coins -= entry.price;
            }

            if (!player.items) { player.items = {}; }
            player.items[entry.key] = true;

            toast("🌿 " + entry.name + " (" + entry.art + ") zieht bei dir ein! Wechsle am ⚙-Menü deines Begleiters.", "info");
            afterPurchase();
        } catch (e) {
            toast("Kauf fehlgeschlagen: " + (e && e.message ? e.message : e), "error");
            btn.disabled = false;
        }
    }

    /* ---- Feuerwerk-Paket kaufen ---- */

    async function buyFirework(btn) {
        if (coins() < FIREWORK.price) {
            toast("Dir fehlen noch " + (FIREWORK.price - coins()) + " Münzen.", "error");
            return;
        }

        btn.disabled = true;
        try {
            if (loggedIn()) {
                var res = await supabaseClient.rpc("purchase_consumable_bundle", { bundle_key: FIREWORK.bundle });
                if (res.error) { throw res.error; }
                if (res.data && typeof res.data.coins === "number") {
                    player.coins = res.data.coins;
                }
                if (!player.consumables) { player.consumables = {}; }
                if (res.data && typeof res.data.quantity === "number") {
                    player.consumables[FIREWORK.item] = res.data.quantity;
                }
            } else {
                player.coins -= FIREWORK.price;
                if (!player.consumables) { player.consumables = {}; }
                player.consumables[FIREWORK.item] =
                    (player.consumables[FIREWORK.item] || 0) + FIREWORK.qty;
            }

            toast("🎆 " + FIREWORK.qty + " Feuerwerkskörper – im Inventar unter „Zünden“.", "info");
            afterPurchase();
        } catch (e) {
            toast("Kauf fehlgeschlagen: " + (e && e.message ? e.message : e), "error");
        } finally {
            btn.disabled = false;
        }
    }

    /* ---- Rendern ---- */

    function render() {
        var cc = document.getElementById("feather-count");
        if (cc) {
            cc.innerHTML = '<img src="images/muenze.png" alt="" class="coin-icon"> ' + coins() + " Münzen";
        }

        BAUMKINDER.forEach(function (b) {
            var btn = document.querySelector('[data-buy-baumkind="' + b.key + '"]');
            if (!btn) { return; }
            var owned = Boolean(player.items && player.items[b.key]);

            var hotspot = btn.closest(".bako-hotspot");
            if (hotspot) { hotspot.classList.toggle("is-owned", owned); }

            btn.disabled = owned;
            btn.textContent = owned ? "✓ Gekauft" : "Kaufen";

            var priceEl = document.querySelector('[data-price="' + b.key + '"]');
            if (priceEl) {
                priceEl.innerHTML = owned
                    ? "Gehört dir"
                    : b.price + ' <img src="images/muenze.png" alt="" class="coin-icon">';
            }
        });

        var fq = document.getElementById("bako-firework-qty");
        if (fq) {
            fq.textContent = (player.consumables && player.consumables[FIREWORK.item]) || 0;
        }
    }

    function closeHotspots(except) {
        var open = document.querySelectorAll(".bako-hotspot.is-open");
        for (var i = 0; i < open.length; i++) {
            if (open[i] !== except) { open[i].classList.remove("is-open"); }
        }
    }

    document.addEventListener("click", function (e) {
        var bk = e.target.closest("[data-buy-baumkind]");
        if (bk) {
            var entry = BAUMKINDER.filter(function (x) { return x.key === bk.dataset.buyBaumkind; })[0];
            if (entry) { buyBaumkind(entry, bk); }
            return;
        }
        if (e.target.closest("#bako-buy-firework")) {
            buyFirework(e.target.closest("#bako-buy-firework"));
            return;
        }

        // Tippen aufs Hotspot-Icon: Tooltip fest ein-/ausblenden (nicht nur Hover)
        var hs = e.target.closest(".bako-hotspot");
        if (hs && !e.target.closest(".shop-hotspot-tooltip")) {
            var wasOpen = hs.classList.contains("is-open");
            closeHotspots(hs);
            hs.classList.toggle("is-open", !wasOpen);
            return;
        }

        // Klick daneben schließt offene Tooltips
        if (!e.target.closest(".shop-hotspot-tooltip")) {
            closeHotspots(null);
        }
    });

    window.addEventListener("player-updated", render);
    render();

})();
