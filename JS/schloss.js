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


    /* --- "Raum gestalten": Schlossstil.
       - Besessene Stile (player.schloss.ownedStyles): frei wechselbar.
       - Katalog-Stile (SCHLOSS_STYLES) mit publicAvailable:true, die man
         noch nicht besitzt: freundlicher nächster Schritt
         ("Ab Stufe X …" bzw. "Kaufen" ab Level + Preis).
       - Nicht-öffentliche / noch nicht fertige Stile erscheinen NICHT.
       - Keine Sperr-Icons. Der Stil-Wechsel greift beim nächsten Laden
         der 3D-Szene (Raumhülle wird bei init gesetzt). --- */

    async function buySchlossStyle(styleKey, cardEl) {

        const cat = getSchlossStyle(styleKey);
        if (!cat) { return; }

        if (typeof isLoggedIn === "function" && isLoggedIn()) {
            try {
                if (cardEl) { cardEl.classList.add("is-busy"); }
                const res = await supabaseClient.rpc("purchase_schloss_style", { p_style_key: styleKey });
                if (res.error) { throw res.error; }
                const d = res.data || {};
                if (Array.isArray(d.ownedStyles)) { player.schloss.ownedStyles = d.ownedStyles; }
                if (typeof d.coins === "number") { player.coins = d.coins; }
                if (d.style) { player.schloss.style = d.style; }
                saveSchloss();
                showMirelonToast(cat.name + " gehört jetzt dir! 🎨", "info");
                renderStyleTab();
            } catch (e) {
                showMirelonToast("Kauf fehlgeschlagen: " + (e && e.message ? e.message : e), "error");
                if (cardEl) { cardEl.classList.remove("is-busy"); }
            }
            return;
        }

        // Gast: lokal (nur wenn Preis + Level passen).
        if (cat.coinPrice == null) { return; }
        if ((player.coins || 0) < cat.coinPrice) {
            showMirelonToast("Dir fehlen noch " + (cat.coinPrice - (player.coins || 0)) + " Münzen.", "error");
            return;
        }
        player.coins -= cat.coinPrice;
        // Kein Auto-Wald: fehlt die Liste, aus dem aktiven Stil ableiten.
        if (!Array.isArray(player.schloss.ownedStyles) || !player.schloss.ownedStyles.length) {
            player.schloss.ownedStyles = [player.schloss.style || "wald"];
        }
        if (player.schloss.ownedStyles.indexOf(styleKey) === -1) { player.schloss.ownedStyles.push(styleKey); }
        player.schloss.style = styleKey;
        saveSchloss();
        showMirelonToast(cat.name + " gehört jetzt dir! 🎨", "info");
        renderStyleTab();
    }

    function playerLevel() {
        return (player.progression && Number(player.progression.level)) || 1;
    }

    function renderStyleTab() {

        if (!styleEl || typeof SCHLOSS_STYLES === "undefined") {
            return;
        }

        const owned = (player.schloss && player.schloss.ownedStyles) || ["wald"];
        const activeStyle = (player.schloss && player.schloss.style) || "wald";

        styleEl.innerHTML = "";

        const hint = document.createElement("p");
        hint.className = "schloss-style-hint";
        hint.textContent = "Wähle den Stil deines Schlosses. Besessene Stile kannst du jederzeit kostenlos wechseln.";
        styleEl.appendChild(hint);

        SCHLOSS_STYLES.forEach(function (s) {

            const isOwned = owned.indexOf(s.key) !== -1;

            // Nicht besessene Stile nur zeigen, wenn öffentlich freigegeben.
            if (!isOwned && !s.publicAvailable) { return; }

            const card = document.createElement("button");
            card.type = "button";
            card.className = "schloss-style-card" +
                (s.key === activeStyle ? " is-active" : "") +
                (isOwned ? "" : " is-catalog");

            let footer = "";
            if (isOwned) {
                footer = s.key === activeStyle
                    ? '<span class="schloss-style-card-badge">aktiv</span>'
                    : '<span class="schloss-style-card-badge">wechseln</span>';
            } else if (s.coinPrice == null) {
                footer = '<span class="schloss-style-card-badge">Ab Stufe ' + s.requiredLevel + ' verfügbar</span>';
            } else if (playerLevel() < s.requiredLevel) {
                footer = '<span class="schloss-style-card-badge">Ab Stufe ' + s.requiredLevel + ' kaufbar</span>';
            } else {
                footer = '<span class="schloss-style-card-badge">Kaufen · ' + s.coinPrice + ' 🪙</span>';
            }

            card.innerHTML =
                '<span class="schloss-style-card-icon" aria-hidden="true">' + s.icon + '</span>' +
                '<span>' + s.name + '</span>' + footer;

            card.addEventListener("click", function () {

                if (isOwned) {
                    if (s.key === activeStyle) { return; }
                    player.schloss.style = s.key;
                    saveSchloss();
                    renderStyleTab();
                    showMirelonToast("Stil gewechselt zu " + s.name + " – lädt beim nächsten Öffnen.", "info");
                    return;
                }

                if (s.coinPrice == null) {
                    showMirelonToast(s.name + " kommt bald – ab Stufe " + s.requiredLevel + ". ✨", "info");
                    return;
                }
                if (playerLevel() < s.requiredLevel) {
                    showMirelonToast("Ab Stufe " + s.requiredLevel + " kannst du " + s.name + " kaufen.", "info");
                    return;
                }
                buySchlossStyle(s.key, card);

            });

            styleEl.appendChild(card);

        });

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
