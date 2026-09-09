/* =====================================================
   SCHLOSS-STARTER.JS
   Einmaliger Einrichtungsstart beim allerersten Besuch von
   "Mein Schloss" nach der Freischaltung (Stufe 3).

   Ablauf: "Dein Schloss erwacht!" -> Stil wählen (kostenlos, dauerhaft
   besessen) -> zwei zufällige Startmöbel aufdecken -> "Jetzt einrichten".

   Sicherheit: bei ANGEMELDETEN Spielern vergibt AUSSCHLIESSLICH die
   Server-Funktion claim_castle_starter_setup() Stil + Möbel und setzt
   starterSetupCompleted (serverseitig geschützt, siehe
   supabase_migration_schloss_styles.sql). Der Client übernimmt nur die
   Rückgabewerte. Für GÄSTE derselbe Ablauf lokal mit denselben Feldern
   und denselben Pools (STARTER_POOLS in JS/schloss-data.js).

   Idempotenz: der Ablauf erscheint nur solange
   player.schloss.starterSetupCompleted === false ist. Reload / Tab /
   Accountwechsel / doppelter RPC vergeben nie doppelt (Server prüft den
   Flag; Gast-Guard unten verhindert Doppelaufruf im selben Tab).
   ===================================================== */

(function () {

    "use strict";

    if (typeof player === "undefined" || typeof SCHLOSS_STYLES === "undefined") {
        return;
    }

    const editorSection = document.getElementById("schloss-editor");
    const starterSection = document.getElementById("schloss-starter");

    if (!starterSection || !editorSection) {
        return;
    }

    function castleUnlocked() {
        return Boolean(player.progression) &&
            Array.isArray(player.progression.unlockedFeatures) &&
            player.progression.unlockedFeatures.indexOf("castle") !== -1;
    }

    function starterNeeded() {
        return castleUnlocked() &&
            Boolean(player.schloss) &&
            player.schloss.starterSetupCompleted !== true;
    }

    function loggedIn() {
        return typeof isLoggedIn === "function" && isLoggedIn();
    }

    // Nur wirklich wählbare Stile: starter-fähig UND öffentlich freigegeben.
    function starterStyles() {
        return SCHLOSS_STYLES.filter(function (s) {
            return s.starterEligible && s.publicAvailable;
        }).sort(function (a, b) { return a.sort - b.sort; });
    }

    let busy = false;           // Doppelklick-/Doppelaufruf-Guard (dieser Tab)
    let chosenStyleKey = null;

    /* ---------- lokale (Gast-)Vergabe: spiegelt claim_castle_starter_setup ---------- */

    function guestClaim(styleKey) {

        const owned = (Array.isArray(player.schloss.ownedFurniture) ? player.schloss.ownedFurniture : []).slice();
        const rawPool = (typeof STARTER_POOLS !== "undefined" && STARTER_POOLS[styleKey]) || {};
        const pool = {
            seat: Array.isArray(rawPool.seat) ? rawPool.seat : [],
            decor: Array.isArray(rawPool.decor) ? rawPool.decor : []
        };

        function pick(list, exclude) {
            const cand = list.filter(function (id) {
                return owned.indexOf(id) === -1 && id !== exclude &&
                    (typeof getSchlossFurniture !== "function" || getSchlossFurniture(id));
            });
            if (!cand.length) { return null; }
            return cand[Math.floor(Math.random() * cand.length)];
        }

        let seat = pick(pool.seat, null);
        let decor = pick(pool.decor, seat);
        // Fallback aus dem gesamten Pool, weiter ohne Duplikat.
        const all = pool.seat.concat(pool.decor);
        if (!seat) { seat = pick(all, decor); }
        if (!decor) { decor = pick(all, seat); }

        const gifts = [];
        [seat, decor].forEach(function (id) {
            if (id && owned.indexOf(id) === -1 && gifts.indexOf(id) === -1) {
                owned.push(id);
                gifts.push(id);
            }
        });

        // Echte Wahl: der beim Starter gewählte Stil ist der einzige
        // Besitzstil - kein automatisch geschenktes "wald" (spiegelt
        // claim_castle_starter_setup: ownedStyles = [p_style_key]).
        player.schloss.ownedStyles = [styleKey];

        player.schloss.style = styleKey;
        player.schloss.ownedFurniture = owned;
        player.schloss.starterSetupCompleted = true;

        savePlayer();

        return { style: styleKey, ownedStyles: player.schloss.ownedStyles, gifts: gifts };
    }

    async function serverClaim(styleKey) {
        const res = await supabaseClient.rpc("claim_castle_starter_setup", { p_style_key: styleKey });
        if (res.error) { throw res.error; }
        const d = res.data || {};

        // Rückgabewerte unverändert übernehmen.
        if (Array.isArray(d.ownedStyles)) { player.schloss.ownedStyles = d.ownedStyles; }
        if (Array.isArray(d.ownedFurniture)) { player.schloss.ownedFurniture = d.ownedFurniture; }
        if (d.style) { player.schloss.style = d.style; }
        player.schloss.starterSetupCompleted = true;
        savePlayer();

        return { style: d.style || styleKey, ownedStyles: player.schloss.ownedStyles, gifts: d.gifts || [] };
    }

    /* ---------- UI ---------- */

    function el(tag, cls, html) {
        const n = document.createElement(tag);
        if (cls) { n.className = cls; }
        if (html != null) { n.innerHTML = html; }
        return n;
    }

    function furnitureCard(id) {
        const f = (typeof getSchlossFurniture === "function" && getSchlossFurniture(id)) || null;
        const card = el("div", "schloss-starter-gift");
        card.innerHTML =
            '<div class="schloss-starter-gift-inner">' +
                '<img src="' + (f ? f.designs[0].sprite : "") + '" alt="">' +
                '<span>' + (f ? f.name : id) + '</span>' +
            "</div>";
        return card;
    }

    function showEditor() {
        starterSection.hidden = true;
        editorSection.hidden = false;
        window.dispatchEvent(new CustomEvent("player-updated"));
    }

    function renderGifts(result) {

        starterSection.innerHTML = "";
        starterSection.appendChild(el("h1", "schloss-starter-title", "Deine ersten Möbel! 🎁"));
        starterSection.appendChild(el("p", "schloss-starter-sub",
            "Damit dein Schloss nicht ganz leer ist – du kannst sie gleich aufstellen."));

        const row = el("div", "schloss-starter-gifts");
        (result.gifts || []).forEach(function (id, i) {
            const c = furnitureCard(id);
            c.style.animationDelay = (0.15 + i * 0.25) + "s";
            row.appendChild(c);
        });
        if (!(result.gifts || []).length) {
            row.appendChild(el("p", "schloss-starter-sub", "Deine Startmöbel warten schon in deinem Inventar."));
        }
        starterSection.appendChild(row);

        const go = el("button", "yj-button yj-button--wide schloss-starter-go", "Jetzt einrichten →");
        go.type = "button";
        go.addEventListener("click", showEditor);
        starterSection.appendChild(go);
    }

    async function confirmStyle() {

        if (busy || !chosenStyleKey) { return; }
        busy = true;

        const confirmBtn = starterSection.querySelector(".schloss-starter-confirm");
        if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "Einen Moment …"; }

        try {
            const result = loggedIn()
                ? await serverClaim(chosenStyleKey)
                : guestClaim(chosenStyleKey);
            renderGifts(result);
        } catch (e) {
            busy = false;
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Diesen Stil nehmen"; }
            if (typeof showMirelonToast === "function") {
                showMirelonToast("Das hat nicht geklappt: " + (e && e.message ? e.message : e), "error");
            }
        }
    }

    function renderStyleChoice() {

        const styles = starterStyles();
        starterSection.innerHTML = "";

        starterSection.appendChild(el("h1", "schloss-starter-title", "Dein Schloss erwacht! 🏰"));
        starterSection.appendChild(el("p", "schloss-starter-sub",
            styles.length > 1
                ? "Such dir aus, wie dein Schloss aussehen soll. Du kannst später jederzeit kostenlos wechseln."
                : "So sieht dein Schloss zum Start aus. Weitere Stile kommen später dazu."));

        const grid = el("div", "schloss-starter-styles");
        styles.forEach(function (s) {
            const card = el("button", "schloss-starter-style-card");
            card.type = "button";
            card.dataset.styleKey = s.key;
            card.innerHTML =
                '<span class="schloss-starter-style-preview" style="background-image:url(' + s.preview + ')"></span>' +
                '<span class="schloss-starter-style-name">' + s.icon + " " + s.name + "</span>";
            card.addEventListener("click", function () {
                chosenStyleKey = s.key;
                grid.querySelectorAll(".schloss-starter-style-card").forEach(function (c) {
                    c.classList.toggle("is-chosen", c === card);
                });
                const cb = starterSection.querySelector(".schloss-starter-confirm");
                if (cb) { cb.disabled = false; }
            });
            grid.appendChild(card);
        });
        starterSection.appendChild(grid);

        // Bei nur einem Stil direkt vorwählen.
        if (styles.length === 1) {
            chosenStyleKey = styles[0].key;
            grid.querySelector(".schloss-starter-style-card").classList.add("is-chosen");
        }

        const confirm = el("button", "yj-button yj-button--wide schloss-starter-confirm",
            styles.length > 1 ? "Diesen Stil nehmen" : "Los geht's!");
        confirm.type = "button";
        confirm.disabled = !chosenStyleKey;
        confirm.addEventListener("click", confirmStyle);
        starterSection.appendChild(confirm);
    }

    function maybeStart() {
        if (!starterNeeded()) {
            starterSection.hidden = true;
            return;
        }
        // Editor verstecken, Starter zeigen.
        editorSection.hidden = true;
        starterSection.hidden = false;
        if (!starterSection.dataset.rendered) {
            starterSection.dataset.rendered = "1";
            renderStyleChoice();
        }
    }

    maybeStart();
    // Nach Login/Cloud-Pull kann sich der Freischalt-/Setup-Stand ändern.
    window.addEventListener("player-updated", function () {
        if (!starterSection.dataset.rendered) { maybeStart(); }
    });

})();
