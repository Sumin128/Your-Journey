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
    const invCatsEl = document.getElementById("schloss-inv-cats");
    const styleEl = document.getElementById("schloss-style");
    const tabButtons = document.querySelectorAll(".schloss-tab");
    const drawer = document.getElementById("schloss-drawer");
    const drawerToggle = document.getElementById("schloss-drawer-toggle");


    /* --- Inventar-Kategorien (nur Anzeige-Gruppierung, keine Katalog-
       oder Platzierungslogik). "Alle" zeigt jedes besessene Möbel.
       Zuordnung greift zuerst auf placementType (Wanddeko / Boden), dann
       auf furniture.category zurück - deckt auch spätere Möbel ab. --- */

    const INV_CATS = [
        { id: "alle", label: "Alle" },
        { id: "sitzmoebel", label: "Sitzmöbel" },
        { id: "tische", label: "Tische & Ablagen" },
        { id: "aufbewahrung", label: "Aufbewahrung" },
        { id: "boden", label: "Teppiche & Bodendeko" },
        { id: "pflanzen", label: "Pflanzen & Deko" },
        { id: "licht", label: "Licht & Feuer" },
        { id: "wanddeko", label: "Wanddeko" }
    ];

    let activeInvCat = "alle";

    function invCategoryOf(furniture) {

        if (!furniture) {
            return "pflanzen";
        }

        // Wanddeko: alles was an der Wand hängt (Bild/Rahmen/Spiegel/Uhr/
        // Vorhang/Wandbehang/Wandleuchte).
        if (furniture.placementType === "wallDecor") {
            return "wanddeko";
        }

        // Boden: Teppiche, Kuschelkissen (seatDecor) und flache Bodendeko.
        if ((furniture.id || "").indexOf("teppich") === 0 ||
            furniture.placementType === "seatDecor" ||
            furniture.placementType === "floorDecor") {
            return "boden";
        }

        switch (furniture.category) {
            case "sitzmoebel": return "sitzmoebel";
            case "tische": return "tische";
            case "regale":
            case "aufbewahrung": return "aufbewahrung";
            case "licht": return "licht";
            case "pflanzen": return "pflanzen";
            default: return "pflanzen"; // freie, nicht an die Wand gehängte Deko
        }

    }

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

    // Kategoriezeile einmal aufbauen; der Wechsel filtert nur die
    // Kartenliste neu (wählt/verschiebt/speichert NICHTS).
    function renderInvCats() {

        if (!invCatsEl) {
            return;
        }

        invCatsEl.innerHTML = "";

        // Immer alle Gruppen zeigen (auch leere - dann kommt beim Wechsel
        // eine freundliche Meldung). Die Zeile ist so auch eine Übersicht,
        // welche Möbelarten es überhaupt gibt.
        INV_CATS.forEach(function (cat) {

            const button = document.createElement("button");
            button.type = "button";
            button.className = "schloss-inv-cat" +
                (cat.id === activeInvCat ? " is-active" : "");
            button.textContent = cat.label;
            button.setAttribute("aria-pressed", String(cat.id === activeInvCat));

            button.addEventListener("click", function () {
                if (activeInvCat === cat.id) {
                    return;
                }
                activeInvCat = cat.id;
                renderInvCats();
                renderInventory();
            });

            invCatsEl.appendChild(button);

        });

        // Aktive Kategorie in den sichtbaren Bereich scrollen (Mobil:
        // die Zeile ist schmaler als alle Pillen). block:"nearest"
        // verhindert ein ungewolltes vertikales Scrollen der Seite.
        const activeBtn = invCatsEl.querySelector(".schloss-inv-cat.is-active");
        if (activeBtn && activeBtn.scrollIntoView) {
            activeBtn.scrollIntoView({ inline: "center", block: "nearest" });
        }

    }

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

        const shown = owned.filter(function (furnitureId) {
            const furniture = getSchlossFurniture(furnitureId);
            if (!furniture) { return false; }
            return activeInvCat === "alle" || invCategoryOf(furniture) === activeInvCat;
        });

        if (!shown.length) {
            const empty = document.createElement("p");
            empty.className = "schloss-inventory-empty";
            empty.textContent = "In dieser Gruppe hast du noch nichts – wähle „Alle“ oder eine andere Gruppe.";
            inventoryEl.appendChild(empty);
            return;
        }

        shown.forEach(function (furnitureId) {

            const furniture = getSchlossFurniture(furnitureId);

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
       Seite (tamo_werkstatt.html / JS/tamo.js). Erreichbar bleibt sie
       über die Sidebar ("Läden") - KEIN Button in dieser Leiste. Im
       Schloss bleiben nur "Inventar" + "Raum gestalten". --- */

    tabButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            tabButtons.forEach(function (other) {
                other.classList.toggle("is-active", other === button);
            });

            const tab = button.dataset.schlossTab;
            const isInventory = tab === "inventory";
            inventoryEl.hidden = !isInventory;
            if (invCatsEl) { invCatsEl.hidden = !isInventory; }
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


    /* --- "Raum gestalten": Schlossdesign-Wähler.
       - Besessene Designs (player.schloss.ownedStyles): frei wechselbar
         ("Verwenden"); das aktive ist deutlich als "Aktiv" markiert.
       - Katalog-Designs mit publicAvailable:true, Level erreicht, Preis
         gesetzt: "Für X Münzen kaufen".
       - Level noch nicht erreicht: sichtbar, aber gesperrt ("Ab Stufe X").
       - Nicht-öffentliche / noch nicht fertige Designs erscheinen NICHT
         (dev-only über ?style=<key> in der 3D-Szene prüfbar).
       Kauf bei ANGEMELDETEN Konten AUSSCHLIESSLICH über die serverseitige
       RPC purchase_schloss_style (kein lokaler Abzug). Doppelklick /
       wiederholte Requests: Button wird sofort gesperrt (buyBusy), die
       RPC ist zusätzlich serverseitig idempotent (for update + already-
       owned-Pfad). Der Stilwechsel greift beim nächsten Laden der
       3D-Szene (Raumhülle wird bei init gesetzt). --- */

    let buyBusy = false;

    function playerLevel() {
        return (player.progression && Number(player.progression.level)) || 1;
    }

    function playerCoins() {
        return Math.max(0, Math.floor(Number(player.coins) || 0));
    }

    function friendlyBuyError(msg) {
        const m = String(msg || "");
        if (/genug Münzen|Münzen \(brauchst/i.test(m)) {
            return "Dafür reichen deine Münzen noch nicht ganz – sammle noch ein bisschen! 🪙";
        }
        if (/Stufe .* nötig/i.test(m)) {
            return "Dieses Design kannst du erst ab einer höheren Stufe kaufen.";
        }
        if (/nicht verfügbar|Unbekannter Stil|kein Preis/i.test(m)) {
            return "Dieses Design ist gerade noch nicht erhältlich.";
        }
        return "Das hat nicht geklappt: " + m;
    }

    function applyPurchaseResult(d, styleName) {
        if (Array.isArray(d.ownedStyles)) { player.schloss.ownedStyles = d.ownedStyles; }
        if (typeof d.coins === "number") { player.coins = d.coins; }
        // Nach dem Kauf sofort als aktives Design übernehmen (RPC gibt
        // style zurück und hat es serverseitig gesetzt).
        if (d.style) { player.schloss.style = d.style; }
        saveSchloss();
        showMirelonToast(styleName + " gehört jetzt dir – dein Schloss lädt es beim nächsten Öffnen. 🎨", "info");
        renderStyleTab();
    }

    async function buySchlossStyle(s, actionEl) {

        if (buyBusy) { return; }

        // Freundliche Vorprüfung (die RPB/der Gast-Pfad prüft es hart nochmal).
        if (playerLevel() < s.requiredLevel) {
            showMirelonToast("Ab Stufe " + s.requiredLevel + " kannst du " + s.name + " kaufen.", "info");
            return;
        }
        if (s.coinPrice == null) {
            showMirelonToast(s.name + " ist gerade noch nicht erhältlich.", "info");
            return;
        }
        if (playerCoins() < s.coinPrice) {
            showMirelonToast("Dir fehlen noch " + (s.coinPrice - playerCoins()) +
                " Münzen für " + s.name + " – sammle noch ein bisschen! 🪙", "info");
            return;
        }

        buyBusy = true;
        if (actionEl) { actionEl.disabled = true; actionEl.textContent = "Einen Moment …"; }

        try {

            if (typeof isLoggedIn === "function" && isLoggedIn()) {
                const res = await supabaseClient.rpc("purchase_schloss_style", { p_style_key: s.key });
                if (res.error) { throw res.error; }
                applyPurchaseResult(res.data || {}, s.name);
            } else {
                // Gast: kein Server -> lokaler Abzug (nur Gäste, nie Konten).
                const owned = (Array.isArray(player.schloss.ownedStyles) && player.schloss.ownedStyles.length)
                    ? player.schloss.ownedStyles.slice()
                    : [player.schloss.style || "wald"];
                if (owned.indexOf(s.key) === -1) {
                    player.coins = playerCoins() - s.coinPrice;
                    owned.push(s.key);
                }
                player.schloss.ownedStyles = owned;
                player.schloss.style = s.key;
                saveSchloss();
                showMirelonToast(s.name + " gehört jetzt dir – dein Schloss lädt es beim nächsten Öffnen. 🎨", "info");
                renderStyleTab();
            }

        } catch (e) {
            showMirelonToast(friendlyBuyError(e && e.message ? e.message : e), "error");
        } finally {
            buyBusy = false;
        }
    }

    function useSchlossStyle(s) {
        if (player.schloss.style === s.key) { return; }
        player.schloss.style = s.key;
        saveSchloss();
        renderStyleTab();
        showMirelonToast(s.name + " ist jetzt dein Design – es lädt beim nächsten Öffnen des Schlosses.", "info");
    }

    function styleCard(s, isOwned, isActive) {

        const lvl = playerLevel();
        const levelOk = lvl >= s.requiredLevel;

        let stateClass, metaHtml, actionLabel, actionKind;

        if (isActive) {
            stateClass = "is-active";
            metaHtml = '<span class="schloss-style-card-status">✓ Aktiv</span>';
            actionLabel = "Aktiv";
            actionKind = "active";
        } else if (isOwned) {
            stateClass = "is-owned";
            metaHtml = '<span class="schloss-style-card-status">In deinem Besitz</span>';
            actionLabel = "Verwenden";
            actionKind = "use";
        } else if (!levelOk) {
            stateClass = "is-locked";
            metaHtml = '<span class="schloss-style-card-status">🔒 Ab Stufe ' + s.requiredLevel + '</span>' +
                (s.coinPrice != null ? '<span class="schloss-style-card-price">' + s.coinPrice + ' 🪙</span>' : '');
            actionLabel = "Ab Stufe " + s.requiredLevel;
            actionKind = "locked";
        } else {
            stateClass = "is-buyable";
            metaHtml = '<span class="schloss-style-card-status">Ab Stufe ' + s.requiredLevel + ' · freigeschaltet</span>' +
                '<span class="schloss-style-card-price">' + s.coinPrice + ' 🪙</span>';
            actionLabel = "Für " + s.coinPrice + " Münzen kaufen";
            actionKind = "buy";
        }

        const card = document.createElement("div");
        card.className = "schloss-style-card " + stateClass;

        const preview = s.preview
            ? '<span class="schloss-style-card-preview" role="img" aria-label="Vorschau ' + s.name +
              '" style="background-image:url(' + s.preview + ')"></span>'
            : '<span class="schloss-style-card-preview schloss-style-card-preview--icon" aria-hidden="true">' + s.icon + '</span>';

        card.innerHTML =
            preview +
            '<div class="schloss-style-card-body">' +
                '<span class="schloss-style-card-name">' + s.icon + ' ' + s.name + '</span>' +
                '<div class="schloss-style-card-meta">' + metaHtml + '</div>' +
            '</div>';

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "schloss-style-card-action schloss-style-card-action--" + actionKind;
        btn.textContent = actionLabel;
        btn.disabled = (actionKind === "active" || actionKind === "locked");

        if (actionKind === "use") {
            btn.addEventListener("click", function () { useSchlossStyle(s); });
        } else if (actionKind === "buy") {
            btn.addEventListener("click", function () { buySchlossStyle(s, btn); });
        }

        card.querySelector(".schloss-style-card-body").appendChild(btn);
        return card;
    }

    function renderStyleTab() {

        if (!styleEl || typeof SCHLOSS_STYLES === "undefined") {
            return;
        }

        const owned = (player.schloss && Array.isArray(player.schloss.ownedStyles) && player.schloss.ownedStyles.length)
            ? player.schloss.ownedStyles
            : ["wald"];
        const activeStyle = (player.schloss && player.schloss.style) || "wald";

        styleEl.innerHTML = "";

        const hint = document.createElement("p");
        hint.className = "schloss-style-hint";
        hint.textContent = "Wähle das Design deines Schlosses. Alle deine Möbel passen in jedes Design – " +
            "besessene Designs kannst du jederzeit kostenlos wechseln.";
        styleEl.appendChild(hint);

        const grid = document.createElement("div");
        grid.className = "schloss-style-grid";

        SCHLOSS_STYLES.slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }).forEach(function (s) {

            const isOwned = owned.indexOf(s.key) !== -1;

            // Nicht besessene, nicht öffentlich freigegebene Designs
            // erscheinen gar nicht (nicht fertige Designs bleiben verborgen).
            if (!isOwned && !s.publicAvailable) { return; }

            grid.appendChild(styleCard(s, isOwned, s.key === activeStyle));
        });

        styleEl.appendChild(grid);
    }


    /* --- Einstieg --- */

    function starterPending() {
        return Boolean(player.schloss) && player.schloss.starterSetupCompleted !== true;
    }

    function render() {

        if (!isUnlocked()) {

            lockedSection.hidden = false;
            editorSection.hidden = true;

            if (lockedText && typeof window.getLockedFeatureMessage === "function") {
                lockedText.textContent = window.getLockedFeatureMessage("castle");
            }

            return;

        }

        lockedSection.hidden = true;

        // Erster Schlossbesuch: der Einrichtungsstart (JS/schloss-starter.js)
        // übernimmt die Anzeige, bis er abgeschlossen ist.
        if (starterPending()) {
            editorSection.hidden = true;
            return;
        }

        editorSection.hidden = false;

        renderInvCats();
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
