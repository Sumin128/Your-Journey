/* =====================================================
   ZAUBER-GEFÄHRTE  (schwebender Begleiter)
   Wird – wie der Bug-Melder – per JavaScript auf jeder
   Seite erzeugt. Ein kleines Baumkind sitzt unten rechts
   über dem Bug-Melder; ein Klick öffnet ein kompaktes
   Panel mit Werten und Pflege-Knöpfen.

   Spielstand: player.tamagotchi (einzige Quelle:
   defaultTamagotchi() in JS/player.js).
   Feature-Spezifikation: docs/zauber-gefaehrte.md

   Neue Baumkinder gibt es künftig beim exotischen
   fahrenden Händler – dieser Begleiter zeigt nur das
   aktive Baumkind, er verkauft nichts.
   ===================================================== */

(function () {
    "use strict";

    if (typeof player === "undefined") {
        return;
    }

    if (!player.tamagotchi) {
        player.tamagotchi = (typeof defaultTamagotchi === "function")
            ? defaultTamagotchi()
            : {
                name: "Mippe", species: "igel", unlockedSpecies: ["igel"],
                hunger: 80, thirst: 80, happiness: 85, energy: 75, cleanliness: 90,
                level: 1, xp: 0, accessory: "none", isSleeping: false, hidden: false,
                lastTimestamp: Date.now()
            };
    }

    /* =====================================================
       1. BAUMKINDER
       Sprites: images/tamagotchi/<id>_<zustand>.png
       (happy / eating / drinking / sleeping / playing / clean).
       Siehe docs/zauber-gefaehrte.md (Bildspezifikation).
       ===================================================== */

    var PET_SPECIES = {
        igel: {
            name: "Mippe",
            speciesName: "Igelkind",
            icon: "🦔",
            sprites: {
                happy: "images/tamagotchi/igel_happy.png",
                eating: "images/tamagotchi/igel_eating.png",
                drinking: "images/tamagotchi/igel_drinking.png",
                sleeping: "images/tamagotchi/igel_sleeping.png",
                playing: "images/tamagotchi/igel_playing.png",
                clean: "images/tamagotchi/igel_clean.png"
            },
            speeches: {
                greeting: [
                    "Schön, dass du da bist.",
                    "Bei dir fühl ich mich sicher.",
                    "Ich hab schon auf dich gewartet."
                ],
                happy: [
                    "Das kitzelt ein bisschen.",
                    "Mit dir ist alles gemütlich.",
                    "Ich mag es, wenn du in der Nähe bist."
                ]
            }
        },
        otter: {
            name: "Fenn",
            speciesName: "Otterjunges",
            icon: "🦦",
            sprites: {
                happy: "images/tamagotchi/otter_happy.png",
                eating: "images/tamagotchi/otter_eating.png",
                drinking: "images/tamagotchi/otter_drinking.png",
                sleeping: "images/tamagotchi/otter_sleeping.png",
                playing: "images/tamagotchi/otter_playing.png",
                clean: "images/tamagotchi/otter_clean.png"
            },
            speeches: {
                greeting: [
                    "Komm, wir machen was zusammen!",
                    "Heute ist ein guter Tag zum Planschen.",
                    "Hast du Lust zu spielen?"
                ],
                happy: [
                    "Hihi, nochmal!",
                    "Das war lustig!",
                    "Mit dir wird mir nie langweilig."
                ]
            }
        },
        reh: {
            name: "Taja",
            speciesName: "Rehkitz",
            icon: "🦌",
            sprites: {
                happy: "images/tamagotchi/reh_happy.png",
                eating: "images/tamagotchi/reh_eating.png",
                drinking: "images/tamagotchi/reh_drinking.png",
                sleeping: "images/tamagotchi/reh_sleeping.png",
                playing: "images/tamagotchi/reh_playing.png",
                clean: "images/tamagotchi/reh_clean.png"
            },
            speeches: {
                greeting: [
                    "Ganz vorsichtig ... hallo.",
                    "Ich bin noch ein bisschen schüchtern.",
                    "Bleibst du bei mir?"
                ],
                happy: [
                    "Bei dir trau ich mich mehr.",
                    "Das war schön.",
                    "Danke, dass du so lieb bist."
                ]
            }
        },
        eichhorn: {
            name: "Piri",
            speciesName: "Eichhörnchenkind",
            icon: "🐿️",
            sprites: {
                happy: "images/tamagotchi/eichhorn_happy.png",
                eating: "images/tamagotchi/eichhorn_eating.png",
                drinking: "images/tamagotchi/eichhorn_drinking.png",
                sleeping: "images/tamagotchi/eichhorn_sleeping.png",
                playing: "images/tamagotchi/eichhorn_playing.png",
                clean: "images/tamagotchi/eichhorn_clean.png"
            },
            speeches: {
                greeting: [
                    "Schnell, schnell, da bist du ja!",
                    "Ich hab schon wieder was gesammelt.",
                    "Los, es gibt viel zu entdecken!"
                ],
                happy: [
                    "Wusch – das hat Spaß gemacht!",
                    "Noch eine Runde?",
                    "Ich flitz vor Freude im Kreis."
                ]
            }
        },
        baer: {
            name: "Bruno",
            speciesName: "Bärenjunges",
            icon: "🐻",
            sprites: {
                happy: "images/tamagotchi/baer_happy.png",
                eating: "images/tamagotchi/baer_eating.png",
                drinking: "images/tamagotchi/baer_drinking.png",
                sleeping: "images/tamagotchi/baer_sleeping.png",
                playing: "images/tamagotchi/baer_playing.png",
                clean: "images/tamagotchi/baer_clean.png"
            },
            speeches: {
                greeting: [
                    "Hallo ... hast du was zu essen?",
                    "Ich hab schon wieder Hunger.",
                    "Gemütlich hier bei dir."
                ],
                happy: [
                    "Mmh, das war lecker.",
                    "Jetzt bin ich satt und glücklich.",
                    "Kraul mich noch ein bisschen."
                ]
            }
        }
    };

    var LEVEL_TITLES = {
        1: "Nestling",
        2: "Waldentdecker",
        3: "Sternenfreund",
        4: "Zauberhüter",
        5: "Meister-Gefährte",
        6: "Himmelswächter",
        7: "Mirelon-Legende"
    };

    var GENERIC_SPEECHES = {
        hungry: ["Mein Bauch knurrt leise.", "Hättest du eine Waldbeere für mich?"],
        thirsty: ["Ein Schluck Quellwasser wäre schön.", "Ich hab ein bisschen Durst."],
        tired: ["Meine Augen werden schwer ...", "Zeit für ein Nickerchen?"],
        dirty: ["Ich bin ganz staubig.", "Bürstest du mich?"]
    };

    function species() {
        return PET_SPECIES[player.tamagotchi.species] || PET_SPECIES.igel;
    }

    /* Igel gibt es immer; die weiteren Baumkinder werden bei Bako
       gekauft und landen als player.items.baumkind<Art> (serverseitig
       geschützt). Siehe docs/zauber-gefaehrte.md */
    function unlockedList() {
        var out = ["igel"];
        var it = player.items || {};
        if (it.baumkindOtter) { out.push("otter"); }
        if (it.baumkindReh) { out.push("reh"); }
        if (it.baumkindEichhorn) { out.push("eichhorn"); }
        if (it.baumkindBaer) { out.push("baer"); }
        return out;
    }

    function spriteFor(state) {
        var s = species().sprites;
        return s[state] || s.happy;
    }

    /* =====================================================
       2. SPEICHERN & ZEITVERFALL (sanft, kindgerecht)
       ===================================================== */

    function save() {
        player.tamagotchi.lastTimestamp = Date.now();
        if (typeof savePlayer === "function") {
            savePlayer();
        }
        window.dispatchEvent(new CustomEvent("player-updated"));
    }

    function applyTimeDecay() {
        var t = player.tamagotchi;
        var now = Date.now();
        var minutes = (now - (t.lastTimestamp || now)) / 60000;

        if (minutes <= 5) {
            return false;
        }
        t.lastTimestamp = now;

        var decay = Math.min(60, Math.floor(minutes / 20) * 2);

        if (t.isSleeping) {
            t.energy = Math.min(100, t.energy + Math.floor(minutes / 10) * 5);
            t.hunger = Math.max(20, t.hunger - Math.floor(decay * 0.5));
            t.thirst = Math.max(20, t.thirst - Math.floor(decay * 0.5));
        } else {
            t.hunger = Math.max(15, t.hunger - decay);
            t.thirst = Math.max(15, t.thirst - decay);
            t.happiness = Math.max(20, t.happiness - Math.floor(decay * 0.7));
            t.cleanliness = Math.max(25, t.cleanliness - Math.floor(decay * 0.5));
            t.energy = Math.max(15, t.energy - Math.floor(decay * 0.6));
        }
        return true;
    }

    /* =====================================================
       3. TON (kleine Rückmeldungen, respektiert Ton-Schalter)
       ===================================================== */

    var audioCtx = null;

    function chime(type) {
        if (typeof isSoundOn === "function" && !isSoundOn()) {
            return;
        }
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            var ctx = audioCtx;
            if (ctx.state === "suspended" && ctx.resume) {
                ctx.resume();
            }
            var now = ctx.currentTime;
            var freqs = type === "level" ? [523.25, 659.25, 783.99, 1046.5] : [type === "eat" ? 320 : 480];
            freqs.forEach(function (f, i) {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = type === "eat" ? "triangle" : "sine";
                osc.frequency.setValueAtTime(f, now + i * 0.1);
                if (type === "pop") {
                    osc.frequency.exponentialRampToValueAtTime(f * 2, now + 0.1);
                }
                gain.gain.setValueAtTime(0.25, now + i * 0.1);
                gain.gain.linearRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.2);
            });
        } catch (e) {
            /* AudioContext nicht verfügbar – egal */
        }
    }

    /* =====================================================
       4. DOM AUFBAUEN
       ===================================================== */

    var root, spriteImg, bubble, panel, spriteState = "happy", spriteResetTimer = null, bubbleTimer = null;
    var suppressClick = false;

    function build() {
        if (document.getElementById("pet-companion")) {
            return;
        }

        root = document.createElement("div");
        root.id = "pet-companion";
        root.innerHTML =
            '<button id="pc-show" type="button" aria-label="Begleiter einblenden" hidden>' + species().icon + '</button>' +
            '<div id="pc-bubble" aria-live="polite" hidden></div>' +
            '<div id="pc-panel" role="dialog" aria-label="Zauber-Gefährte" hidden></div>' +
            '<button id="pc-actor" type="button" aria-label="Baumkind streicheln">' +
            '  <img id="pc-sprite" src="' + spriteFor("happy") + '" alt="Dein Baumkind" decoding="async">' +
            '</button>';
        document.body.appendChild(root);

        spriteImg = document.getElementById("pc-sprite");
        bubble = document.getElementById("pc-bubble");
        panel = document.getElementById("pc-panel");

        var actor = document.getElementById("pc-actor");

        // Tippen aufs Baumkind: Panel auf/zu. Ist das Panel schon offen,
        // wird das Baumkind stattdessen gestreichelt. Ziehen verschiebt es.
        actor.addEventListener("click", function () {
            if (suppressClick) {
                suppressClick = false;
                return;
            }
            if (panel.hidden) {
                openPanel();
            } else {
                cuddle();
            }
        });

        makeDraggable(actor);

        document.getElementById("pc-show").addEventListener("click", function () {
            player.tamagotchi.hidden = false;
            save();
            applyVisibility();
            say(species().speeches.greeting[0], 3500);
        });

        window.addEventListener("resize", applyPosition);

        applyPosition();
        applyVisibility();
        renderSprite();

        // eine ruhige Begrüßung pro Seitenaufruf – bei Bedarf ein Hinweis
        if (!player.tamagotchi.isSleeping) {
            setTimeout(function () {
                say(needSpeech() || pick(species().speeches.greeting), 4200);
            }, 1200);
        }
    }

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    /* Niedrigster Wert bestimmt Stimmung & spontanen Satz */
    function lowVital() {
        var t = player.tamagotchi;
        if (t.isSleeping) { return null; }
        if (t.hunger < 30) { return "hungry"; }
        if (t.thirst < 30) { return "thirsty"; }
        if (t.energy < 25) { return "tired"; }
        if (t.cleanliness < 30) { return "dirty"; }
        if (t.happiness < 30) { return "tired"; }
        return null;
    }

    function needSpeech() {
        var m = lowVital();
        return m && GENERIC_SPEECHES[m] ? pick(GENERIC_SPEECHES[m]) : null;
    }

    function renderMood() {
        if (!root) { return; }
        ["hungry", "thirsty", "tired", "dirty"].forEach(function (m) {
            root.classList.remove("pc-mood-" + m);
        });
        var m = lowVital();
        if (m) {
            root.classList.add("pc-mood-" + m);
        }
    }

    /* =====================================================
       4b. VERSCHIEBEN & POSITION
       ===================================================== */

    function applyPosition() {
        var p = player.tamagotchi.pos;
        var fits = p && typeof p.x === "number" &&
            p.x >= 0 && p.y >= 0 &&
            p.x <= window.innerWidth - 40 && p.y <= window.innerHeight - 40;
        if (fits) {
            root.style.left = p.x + "px";
            root.style.top = p.y + "px";
            root.style.right = "auto";
            root.style.bottom = "auto";
        } else {
            root.style.left = "";
            root.style.top = "";
            root.style.right = "";
            root.style.bottom = "";
        }
    }

    function makeDraggable(handle) {
        var startX = 0, startY = 0, baseLeft = 0, baseTop = 0, dragging = false, moved = false;

        handle.addEventListener("pointerdown", function (e) {
            if (e.button != null && e.button !== 0) { return; }
            dragging = true;
            moved = false;
            var r = root.getBoundingClientRect();
            baseLeft = r.left;
            baseTop = r.top;
            startX = e.clientX;
            startY = e.clientY;
            try { handle.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        });

        handle.addEventListener("pointermove", function (e) {
            if (!dragging) { return; }
            var dx = e.clientX - startX;
            var dy = e.clientY - startY;
            if (!moved && Math.abs(dx) + Math.abs(dy) < 6) { return; }
            moved = true;
            root.classList.add("pc-dragging");
            if (panel && !panel.hidden) { closePanel(); }
            var x = Math.max(4, Math.min(window.innerWidth - root.offsetWidth - 4, baseLeft + dx));
            var y = Math.max(4, Math.min(window.innerHeight - root.offsetHeight - 4, baseTop + dy));
            root.style.left = x + "px";
            root.style.top = y + "px";
            root.style.right = "auto";
            root.style.bottom = "auto";
        });

        function end() {
            if (!dragging) { return; }
            dragging = false;
            root.classList.remove("pc-dragging");
            if (moved) {
                var r = root.getBoundingClientRect();
                player.tamagotchi.pos = { x: Math.round(r.left), y: Math.round(r.top) };
                save();
                suppressClick = true;
                setTimeout(function () { suppressClick = false; }, 350);
            }
        }
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
    }

    function applyVisibility() {
        var hidden = Boolean(player.tamagotchi.hidden);
        document.getElementById("pc-actor").hidden = hidden;
        bubble.hidden = true;
        if (hidden) {
            closePanel();
        }
        document.getElementById("pc-show").hidden = !hidden;
    }

    /* =====================================================
       5. SPRECHBLASE & SPRITE
       ===================================================== */

    function say(text, ms) {
        if (!bubble || player.tamagotchi.hidden) {
            return;
        }
        bubble.textContent = text;
        bubble.hidden = false;
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(function () {
            bubble.hidden = true;
        }, ms || 3500);
    }

    function renderSprite() {
        if (!spriteImg) {
            return;
        }
        var state = player.tamagotchi.isSleeping ? "sleeping" : spriteState;
        spriteImg.src = spriteFor(state);
        root.classList.toggle("pc-sleeping", player.tamagotchi.isSleeping);
        renderMood();

        var showBtn = document.getElementById("pc-show");
        if (showBtn) {
            showBtn.textContent = species().icon;
        }
    }

    /* Kommt die Cloud-/Kontodaten erst nach dem Aufbau des Widgets an
       (auth.js pullProfileFromCloud feuert dann "player-updated"), muss
       das Widget nachziehen - sonst zeigt es weiter das alte Baumkind
       (z. B. Igel-Sprite mit den Werten des gewählten Rehs). */
    function syncFromPlayer() {
        if (!root || !player.tamagotchi) {
            return;
        }
        if (!PET_SPECIES[player.tamagotchi.species] && GEMINI_SPECIES[player.tamagotchi.species]) {
            player.tamagotchi.species = GEMINI_SPECIES[player.tamagotchi.species];
        }
        renderSprite();
        if (panel && !panel.hidden) {
            renderPanel();
        }
    }

    function flashSprite(state, ms) {
        spriteState = state;
        renderSprite();
        clearTimeout(spriteResetTimer);
        if (!player.tamagotchi.isSleeping) {
            spriteResetTimer = setTimeout(function () {
                spriteState = "happy";
                renderSprite();
            }, ms || 2200);
        }
    }

    function floatEmoji(glyph) {
        var span = document.createElement("span");
        span.className = "pc-float";
        span.textContent = glyph;
        root.appendChild(span);
        setTimeout(function () {
            span.remove();
        }, 1100);
    }

    /* =====================================================
       6. WERTE, XP & PANEL-RENDERING
       ===================================================== */

    var VITALS = [
        { key: "hunger", icon: "🍎", label: "Sättigung" },
        { key: "thirst", icon: "💧", label: "Erfrischung" },
        { key: "happiness", icon: "💖", label: "Laune" },
        { key: "energy", icon: "⚡", label: "Energie" },
        { key: "cleanliness", icon: "✨", label: "Glanz" }
    ];

    function clamp(n) {
        return Math.max(0, Math.min(100, Math.round(n)));
    }

    function renderPanel() {
        if (!panel || panel.hidden) {
            return;
        }
        var t = player.tamagotchi;
        var sp = species();
        var title = LEVEL_TITLES[t.level] || "Gefährte";
        var need = t.level * 100;
        var xpPct = clamp((t.xp / need) * 100);

        var bars = VITALS.map(function (v) {
            var val = clamp(t[v.key]);
            return '<div class="pc-vital">' +
                '<span class="pc-vital-ico" title="' + v.label + '">' + v.icon + '</span>' +
                '<span class="pc-bar"><span class="pc-bar-fill pc-' + v.key + '" style="width:' + val + '%"></span></span>' +
                '<span class="pc-vital-val">' + val + '</span>' +
                '</div>';
        }).join("");

        panel.innerHTML =
            '<div class="pc-head">' +
            '  <img class="pc-head-img" src="' + spriteFor("happy") + '" alt="">' +
            '  <div class="pc-head-txt">' +
            '    <strong>' + escapeHtml(t.name) + '</strong>' +
            '    <span class="pc-lvl">⭐ Stufe ' + t.level + ' · ' + title + '</span>' +
            '  </div>' +
            '  <button class="pc-icon-btn" type="button" data-act="menu" aria-label="Menü">⚙</button>' +
            '  <button class="pc-icon-btn" type="button" data-act="close" aria-label="Schließen">✕</button>' +
            '</div>' +
            '<div class="pc-xp"><span class="pc-xp-fill" style="width:' + xpPct + '%"></span></div>' +
            '<div class="pc-vitals">' + bars + '</div>' +
            '<div class="pc-actions">' +
            '  <button type="button" data-act="feed">🍓<span>Füttern</span></button>' +
            '  <button type="button" data-act="drink">🥛<span>Trinken</span></button>' +
            '  <button type="button" data-act="play">🎾<span>Spielen</span></button>' +
            '  <button type="button" data-act="sleep">' + (t.isSleeping ? '☀️<span>Wecken</span>' : '💤<span>Schlafen</span>') + '</button>' +
            '  <button type="button" data-act="clean">🧼<span>Bürsten</span></button>' +
            '</div>' +
            '<div class="pc-sub" hidden></div>';
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }

    function openPanel() {
        if (player.tamagotchi.hidden) {
            return;
        }
        bubble.hidden = true;
        var r = root.getBoundingClientRect();
        panel.classList.toggle("pc-panel-left", (r.left + r.width / 2) < window.innerWidth / 2);
        panel.classList.toggle("pc-panel-down", (r.top + r.height / 2) < window.innerHeight / 2);
        panel.hidden = false;
        renderPanel();
    }

    function closePanel() {
        if (panel) {
            panel.hidden = true;
            panel.innerHTML = "";
        }
    }

    /* =====================================================
       7. PFLEGE-AKTIONEN
       ===================================================== */

    /* Pflege ist ein Münz-Abfluss: günstig, aber nicht gratis – die
       Münzen verdient man in den Lernspielen. Kosten müssen zu
       spend_coins() in supabase_migration_tamagotchi_economy.sql passen. */
    var FOOD = {
        beeren: { label: "🫐 Waldbeeren", cost: 1, reason: "tamagotchi_feed_beeren", hunger: 22, happiness: 3, xp: 3 },
        honig: { label: "🍯 Honigwabe", cost: 3, reason: "tamagotchi_feed_honig", hunger: 48, happiness: 15, xp: 6 },
        stern: { label: "⭐ Sternenfrucht", cost: 8, reason: "tamagotchi_feed_stern", hunger: 100, thirst: 100, happiness: 100, energy: 100, cleanliness: 100, xp: 12 }
    };
    var DRINK = {
        wasser: { label: "💧 Quellwasser", cost: 1, reason: "tamagotchi_drink_wasser", thirst: 25, xp: 3 },
        trank: { label: "🧪 Zaubertrank", cost: 5, reason: "tamagotchi_drink_trank", thirst: 100, cleanliness: 40, happiness: 10, xp: 6 }
    };

    function loggedIn() {
        return typeof supabaseClient !== "undefined" && supabaseClient &&
            typeof currentSession !== "undefined" && currentSession;
    }

    /* Zieht die Münzen ab: optimistisch lokal, angemeldet zusätzlich
       serverseitig über spend_coins(reason). Bei Server-Ablehnung
       wird lokal zurückgebucht. */
    function pay(item) {
        var cost = item.cost || 0;
        if (cost <= 0) { return true; }

        if ((player.coins || 0) < cost) {
            if (typeof showMirelonToast === "function") {
                showMirelonToast("Dafür brauchst du " + cost + " Münzen – spiel ein paar Lernspiele!", "error");
            }
            return false;
        }

        player.coins -= cost;
        if (typeof updatePlayerUI === "function") { updatePlayerUI(); }
        window.dispatchEvent(new CustomEvent("player-updated"));

        if (loggedIn() && item.reason) {
            supabaseClient.rpc("spend_coins", { p_reason: item.reason }).then(function (r) {
                if (r.error) {
                    player.coins += cost;
                    if (typeof updatePlayerUI === "function") { updatePlayerUI(); }
                    window.dispatchEvent(new CustomEvent("player-updated"));
                    if (typeof showMirelonToast === "function") {
                        showMirelonToast("Das hat gerade nicht geklappt.", "error");
                    }
                } else if (r.data && typeof r.data.coins === "number") {
                    player.coins = r.data.coins;
                    if (typeof updatePlayerUI === "function") { updatePlayerUI(); }
                }
            });
        } else if (typeof savePlayer === "function") {
            savePlayer();
        }
        return true;
    }

    function applyItem(item) {
        var t = player.tamagotchi;
        ["hunger", "thirst", "happiness", "energy", "cleanliness"].forEach(function (k) {
            if (item[k]) {
                t[k] = Math.min(100, t[k] + item[k]);
            }
        });
    }

    function subMenu(html) {
        var sub = panel.querySelector(".pc-sub");
        if (!sub) {
            return;
        }
        sub.innerHTML = html;
        sub.hidden = false;
    }

    function handleAction(act, target) {
        var t = player.tamagotchi;

        if (act === "close") { closePanel(); return; }

        if (act === "menu") {
            var switchBtn = (unlockedList().length > 1)
                ? '<button type="button" data-act="switch">🔄 Baumkind wechseln</button>' : '';
            subMenu(
                '<button type="button" data-act="rename">✏️ Umbenennen</button>' +
                switchBtn +
                '<button type="button" data-act="hide">🙈 Begleiter ausblenden</button>'
            );
            return;
        }

        if (act === "hide") {
            t.hidden = true;
            save();
            applyVisibility();
            return;
        }

        if (act === "rename") {
            var name = window.prompt("Wie soll dein Baumkind heißen?", t.name);
            if (name && name.trim()) {
                t.name = name.trim().slice(0, 20);
                save();
                renderPanel();
                say("Ich heiße jetzt " + t.name + ".", 3000);
            }
            return;
        }

        if (act === "switch") {
            var list = unlockedList();
            var idx = list.indexOf(t.species);
            t.species = list[(idx + 1) % list.length];
            save();
            renderPanel();
            renderSprite();
            say(species().speeches.greeting[0], 3500);
            return;
        }

        if (t.isSleeping && act !== "sleep") {
            say("Pssst – ich schlafe gerade.", 2500);
            return;
        }

        if (act === "feed") {
            subMenu(Object.keys(FOOD).map(function (k) {
                return '<button type="button" data-feed="' + k + '">' + FOOD[k].label +
                    (FOOD[k].cost ? ' · ' + FOOD[k].cost + ' M' : ' · gratis') + '</button>';
            }).join(""));
            return;
        }
        if (target && target.dataset.feed) {
            var f = FOOD[target.dataset.feed];
            if (!f || !pay(f)) { return; }
            applyItem(f);
            flashSprite("eating", 2200);
            floatEmoji("🍪");
            chime("eat");
            say("Mmh, danke!", 2500);
            addXP(f.xp);
            afterAction();
            return;
        }

        if (act === "drink") {
            subMenu(Object.keys(DRINK).map(function (k) {
                return '<button type="button" data-drink="' + k + '">' + DRINK[k].label +
                    (DRINK[k].cost ? ' · ' + DRINK[k].cost + ' M' : ' · gratis') + '</button>';
            }).join(""));
            return;
        }
        if (target && target.dataset.drink) {
            var d = DRINK[target.dataset.drink];
            if (!d || !pay(d)) { return; }
            applyItem(d);
            flashSprite("drinking", 2200);
            floatEmoji("💧");
            chime("pop");
            say("Aah, erfrischend.", 2500);
            addXP(d.xp);
            afterAction();
            return;
        }

        if (act === "play" || act === "cuddle") { cuddle(); return; }

        if (act === "sleep") {
            toggleSleep();
            return;
        }

        if (act === "clean") {
            t.cleanliness = Math.min(100, t.cleanliness + 25);
            t.happiness = Math.min(100, t.happiness + 10);
            flashSprite("clean", 2200);
            floatEmoji("✨");
            chime("pop");
            say("Jetzt glänz ich wieder.", 2500);
            addXP(4);
            afterAction();
        }
    }

    function afterAction() {
        save();
        renderPanel();
        renderSprite();
    }

    function cuddle() {
        var t = player.tamagotchi;
        if (t.isSleeping) {
            say("Pssst – ich schlafe gerade.", 2500);
            return;
        }
        t.happiness = Math.min(100, t.happiness + 8);
        flashSprite("playing", 1200);
        floatEmoji("💖");
        chime("pop");
        var pool = t.happiness > 70 ? species().speeches.happy : species().speeches.greeting;
        say(pool[Math.floor(Math.random() * pool.length)], 3000);
        addXP(2);
        afterAction();
    }

    var sleepTicks = 0;

    function toggleSleep() {
        var t = player.tamagotchi;
        t.isSleeping = !t.isSleeping;
        sleepTicks = 0;
        if (t.isSleeping) {
            say("Gute Nacht ...", 3000);
            floatEmoji("💤");
        } else {
            say("Guten Morgen!", 3000);
        }
        afterAction();
    }

    /* Energie füllt sich WÄHREND des Schlafens langsam auf - vorher
       ging das nur über Seitenwechsel bzw. mehrfaches Wecken/Schlafen.
       Alle 4 s ein Punkt, dafür wird das Baumkind im Schlaf etwas
       hungrig/durstig. */
    function sleepTick() {
        var t = player.tamagotchi;
        if (!t.isSleeping || t.energy >= 100) {
            return;
        }
        t.energy = Math.min(100, t.energy + 1);
        sleepTicks += 1;

        if (sleepTicks % 4 === 0) {
            t.hunger = Math.max(25, t.hunger - 1);
            t.thirst = Math.max(25, t.thirst - 1);
        }

        renderSprite();
        if (panel && !panel.hidden) {
            renderPanel();
        }

        if (sleepTicks % 8 === 0 && typeof savePlayer === "function") {
            player.tamagotchi.lastTimestamp = Date.now();
            savePlayer();
        }

        if (t.energy >= 100) {
            say("Ich bin ausgeschlafen!", 3000);
        }
    }

    /* =====================================================
       8. XP & STUFEN
       ===================================================== */

    /* Stufen dauern bewusst lang – der Gefährte ist ein
       Langzeit-Ziel, kein Münz-Automat. */
    function xpNeeded(level) {
        return 100 + level * 150;
    }

    function addXP(amount) {
        var t = player.tamagotchi;
        t.xp = (t.xp || 0) + amount;

        var need = xpNeeded(t.level);
        if (t.xp >= need && t.level < 99) {
            t.xp -= need;
            t.level += 1;
            var title = LEVEL_TITLES[t.level] || "Großer Gefährte";
            chime("level");
            floatEmoji("⭐");
            say(t.name + " ist jetzt Stufe " + t.level + ": " + title + "!", 5000);
            grantLevelReward();
        }
    }

    /* Belohnung bei jedem Stufenaufstieg: mal Münzen (10–30),
       mal Feuerwerk (1–5). Angemeldet würfelt der Server
       (claim_tamagotchi_levelup_reward, mit Cooldown), Gäste lokal. */
    function grantLevelReward() {
        if (loggedIn()) {
            supabaseClient.rpc("claim_tamagotchi_levelup_reward").then(function (r) {
                if (!r.error && r.data) { showReward(r.data); }
            });
            return;
        }
        if (Math.random() < 0.5) {
            var c = 10 + Math.floor(Math.random() * 21);
            window.dispatchEvent(new CustomEvent("mirelon:earn-coins", { detail: { amount: c } }));
            showReward({ kind: "coins", amount: c });
        } else {
            var fw = 1 + Math.floor(Math.random() * 5);
            player.consumables = player.consumables || {};
            player.consumables.feuerwerk = (player.consumables.feuerwerk || 0) + fw;
            if (typeof savePlayer === "function") { savePlayer(); }
            window.dispatchEvent(new CustomEvent("player-updated"));
            showReward({ kind: "feuerwerk", amount: fw });
        }
    }

    function showReward(d) {
        if (d.kind === "coins") {
            if (typeof d.coins === "number") {
                player.coins = d.coins;
                if (typeof player.totalCoinsEarned === "number") { player.totalCoinsEarned = d.totalCoinsEarned; }
            }
            if (typeof updatePlayerUI === "function") { updatePlayerUI(); }
            window.dispatchEvent(new CustomEvent("player-updated"));
            say("Schau – " + d.amount + " Münzen als Geschenk! 🪙", 4000);
            if (typeof showMirelonToast === "function") {
                showMirelonToast("Stufen-Geschenk: +" + d.amount + " Münzen!", "info");
            }
        } else {
            if (typeof d.feuerwerk === "number") {
                player.consumables = player.consumables || {};
                player.consumables.feuerwerk = d.feuerwerk;
            }
            if (typeof updatePlayerUI === "function") { updatePlayerUI(); }
            window.dispatchEvent(new CustomEvent("player-updated"));
            say(d.amount + " Feuerwerkskörper – zünd sie aus dem Inventar! 🎆", 4000);
            if (typeof showMirelonToast === "function") {
                showMirelonToast("Stufen-Geschenk: +" + d.amount + " Feuerwerk!", "info");
            }
        }
    }


    /* =====================================================
       10. EVENTS & START
       ===================================================== */

    document.addEventListener("click", function (e) {
        if (!panel || panel.hidden) {
            return;
        }
        var btn = e.target.closest("[data-act],[data-feed],[data-drink]");
        if (btn && root.contains(btn)) {
            handleAction(btn.dataset.act || "", btn);
            return;
        }
        if (!root.contains(e.target)) {
            closePanel();
        }
    });

    // Alte, nie veröffentlichte Gemini-Fassung aufräumen (Waldgeist/Drache/…):
    // nur wirklich unbekannte Art-Schlüssel remappen. Ein "reh", das der
    // Spieler gewählt hat, wird hier NICHT mehr auf Igel zurückgesetzt -
    // das hat beim Rennen mit den asynchron nachladenden Kontodaten die
    // Auswahl verschluckt (Igel-Sprite + Reh-Werte).
    var GEMINI_SPECIES = { lumi: "igel", fox: "otter", dragon: "reh", owl: "eichhorn", cat: "baer" };
    if (!PET_SPECIES[player.tamagotchi.species] && GEMINI_SPECIES[player.tamagotchi.species]) {
        player.tamagotchi.species = GEMINI_SPECIES[player.tamagotchi.species];
    }
    if (!PET_SPECIES[player.tamagotchi.species]) {
        player.tamagotchi.species = "igel";
    }
    if (["Lumi", "Flöckchen", "Pyri", "Kira", "Mimi"].indexOf(player.tamagotchi.name) !== -1) {
        player.tamagotchi.name = species().name;
    }

    if (applyTimeDecay()) {
        save();
    }
    build();

    window.addEventListener("player-updated", syncFromPlayer);
    setInterval(sleepTick, 4000);

})();
