/* =====================================================
   PLAYER.JS
   Zentrales Spielersystem für Mirelon
   ===================================================== */


/* =====================================================
   0. AVATAR-PLATZHALTER
   Wird angezeigt, solange kein Avatar gewählt wurde,
   damit nirgends ein kaputtes Bild-Icon auftaucht.
   ===================================================== */

const AVATAR_PLACEHOLDER =
    "data:image/svg+xml;utf8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<circle cx="50" cy="50" r="50" fill="#96501e"/>' +
        '<path d="M50 20 C65 25 75 40 70 55 C65 70 50 78 50 78 C50 78 35 70 30 55 C25 40 35 25 50 20 Z" fill="#ffe2a5"/>' +
        '<line x1="50" y1="78" x2="50" y2="62" stroke="#96501e" stroke-width="3"/>' +
        '</svg>'
    );


/* =====================================================
   1. STANDARD-SPIELER
   ===================================================== */

let player = {

    name: "",

    avatar: "",

    coins: 0,

    goldenFeathers: 0,

    totalCoinsEarned: 0,

    achievements: [],

    quizzesCompleted: 0,

    visitedAnimals: [],

    wordGameWins: [],

    puzzlesCompleted: 0,

    puzzleGalleryImagesUsed: [],

    puzzleLuisVariantsCompleted: [],

    memoryGamesCompleted: {

        normal: 0

    },

    highscorePoints: 0,

    berries: 0,

    activeCursor: "default",

    sidebarTheme: "baumrinde",

    settings: {

        soundOn: true

    },

    items: {

    foxCursor: false,
    bearCursor: false,
     unicornCursor: false,
    kuroCursor: false,
    hasenCursor: false,
    goldenFeatherCursor: false,
    blackGoldenFeatherCursor: false,
    luisCursor: false
},

    friends: {

        kuro: 0,

        tessa: 0,

        faro: 0

    }

};


/* =====================================================
   2. SPIELER SPEICHERN
   ===================================================== */

function savePlayer() {

    localStorage.setItem(
        "player",
        JSON.stringify(player)
    );

}


/* =====================================================
   3. SPIELER LADEN
   ===================================================== */

function loadPlayer() {

    const savedPlayer =
        localStorage.getItem("player");

    if (!savedPlayer) {

        return;

    }


    const loadedPlayer =
        JSON.parse(savedPlayer);


    /*
       Object.assign sorgt dafür,
       dass neue Eigenschaften aus unserem
       Standard-Spieler erhalten bleiben.
    */

    player = Object.assign(
        {},
        player,
        loadedPlayer
    );


    /* Falls ältere Speicherstände noch kein items haben */

    if (!player.items) {

    player.items = {

        foxCursor: false,
        bearCursor: false,
        unicornCursor: false

    };

}

/* Bären-Cursor bei älteren Speicherständen ergänzen */

if (typeof player.items.bearCursor === "undefined") {

    player.items.bearCursor = false;

}

if (typeof player.items.unicornCursor === "undefined") {

    player.items.unicornCursor = false;

}

if (typeof player.items.kuroCursor === "undefined") {

    player.items.kuroCursor = false;

}

if (typeof player.items.hasenCursor === "undefined") {

    player.items.hasenCursor = false;

}

if (typeof player.items.goldenFeatherCursor === "undefined") {

    player.items.goldenFeatherCursor = false;

}

if (typeof player.items.blackGoldenFeatherCursor === "undefined") {

    player.items.blackGoldenFeatherCursor = false;

}

if (typeof player.items.luisCursor === "undefined") {

    player.items.luisCursor = false;

}

    /* Falls ältere Speicherstände noch kein memoryGamesCompleted haben */

    if (!player.memoryGamesCompleted) {

        player.memoryGamesCompleted = {

            normal: 0

        };

    }

    if (typeof player.memoryGamesCompleted.normal !== "number") {

        player.memoryGamesCompleted.normal = 0;

    }


    /* Falls ältere Speicherstände noch kein puzzleLuisVariantsCompleted haben */

    if (!Array.isArray(player.puzzleLuisVariantsCompleted)) {

        player.puzzleLuisVariantsCompleted = [];

    }


    /* Falls ältere Speicherstände keine Freunde haben */

    if (!player.friends) {

        player.friends = {

            kuro: 0,

            tessa: 0,

            faro: 0

        };

    }


    /* Alte Speicherstände vorbereiten */

    if (!Array.isArray(player.achievements)) {

        player.achievements = [];

    }


    /* Umstellung Federn -> Münzen: alte Speicherstände hatten die
       Werte noch unter player.feathers/totalFeathersEarned. Wichtig:
       hier gegen loadedPlayer (den rohen, ungemergten Speicherstand)
       prüfen statt gegen player - nach dem Object.assign oben hat
       player.coins durch den Standard-Spieler nämlich immer schon
       eine Zahl (0), auch wenn der Speicherstand selbst noch keine
       Münzen kannte, und der Migrations-Check würde nie greifen. */

    if (
        typeof loadedPlayer.coins !== "number" &&
        typeof loadedPlayer.feathers === "number"
    ) {

        player.coins = loadedPlayer.feathers;

    }


    if (
        typeof loadedPlayer.totalCoinsEarned !== "number" &&
        typeof loadedPlayer.totalFeathersEarned === "number"
    ) {

        player.totalCoinsEarned = loadedPlayer.totalFeathersEarned;

    }


    if (typeof player.coins !== "number") {

        player.coins = 0;

    }


    if (typeof player.totalCoinsEarned !== "number") {

        player.totalCoinsEarned = player.coins;

    }


    /* Alte Schlüssel entfernen, damit sie nicht weiter mitgespeichert
       werden (unten wird direkt gesichert, siehe Funktionsende). */

    const hadLegacyFeatherKeys =
        typeof loadedPlayer.feathers !== "undefined" ||
        typeof loadedPlayer.totalFeathersEarned !== "undefined";

    delete player.feathers;
    delete player.totalFeathersEarned;


    if (typeof player.goldenFeathers !== "number") {

        player.goldenFeathers = 0;

    }


    if (!player.activeCursor) {

        player.activeCursor = "default";

    }


    /* Falls ältere Speicherstände keine Einstellungen haben */

    if (!player.settings) {

        player.settings = {

            soundOn: true

        };

    }


    if (typeof player.settings.soundOn !== "boolean") {

        player.settings.soundOn = true;

    }


    /* Bereinigten Speicherstand direkt sichern statt auf die nächste
       beliebige Änderung zu warten, sonst bleiben die alten Federn-
       Schlüssel in einem ungenutzten Speicherstand (lokal wie in der
       Supabase-Cloud) einfach liegen. */

    if (hadLegacyFeatherKeys) {

        savePlayer();

    }

}


/* =====================================================
   4. SPIELERANZEIGE AKTUALISIEREN
   Aktualisiert Name, Avatar, Münzen und Erfolge.
   Funktioniert auf jeder Seite, auf der diese IDs existieren.
   ===================================================== */

function updatePlayerUI() {

    const playerNameDisplays =
        document.querySelectorAll("#player-name-display");

    const playerAvatars =
        document.querySelectorAll("#player-avatar");

    const featherDisplays =
        document.querySelectorAll("#feather-count");

    const achievementDisplays =
        document.querySelectorAll("#achievement-count");


    /* NAME */

    playerNameDisplays.forEach(function(display) {

        display.textContent =
            player.name || "Abenteurer";

    });


    /* AVATAR */

    playerAvatars.forEach(function(avatar) {

        avatar.src = player.avatar || AVATAR_PLACEHOLDER;

        avatar.style.display = "block";

    });


    /* MÜNZEN */

    featherDisplays.forEach(function(display) {

        display.innerHTML =
            '<img src="images/muenze.png" alt="" class="coin-icon"> ' +
            player.coins + " Münzen";

    });


    /* ERFOLGE */

    achievementDisplays.forEach(function(display) {

        display.textContent =
            "⭐ " + player.achievements.length + " Erfolge";

    });


    /* KUROS BEGRÜSSUNG */

    const welcomeTitle =
        document.getElementById("welcome-title");

    if (welcomeTitle) {

        if (player.name) {

            welcomeTitle.textContent =
                "Hallo " + player.name + "!";

        } else {

            welcomeTitle.textContent =
                "Hallo!";

        }

    }

}


/* =====================================================
   7. MÜNZEN
   ===================================================== */

/*
   addCoins() ist absichtlich KEINE globale Funktion mehr. In diesem
   Projekt gibt es keinen Bundler/kein Modulsystem - jede Funktion,
   die als "function foo() {}" auf oberster Ebene eines <script>-Tags
   steht, landet automatisch als aufrufbare globale Funktion auf
   window und war damit vorher direkt in der Browser-Konsole nutzbar
   (addCoins(1000) gab sofort 1000 Münzen).

   Stattdessen: die eigentliche Vergabe-Logik steckt unten in einer
   IIFE (sofort ausgeführte Funktion) als lokale Variable - die ist
   von aussen (Konsole, andere <script>-Dateien) grundsätzlich nicht
   per Namen erreichbar, weder als window.grantCoins noch als loses
   "grantCoins". Andere Dateien (quiz.js, fuchs.js, eulenschule.js)
   und der Rest von player.js selbst lösen eine Münzgutschrift nur
   noch über ein CustomEvent aus - das bereits bestehende Muster für
   "player-updated" wird hier fuer die Anfrage-Richtung wiederverwendet:

       window.dispatchEvent(new CustomEvent("mirelon:earn-coins", {
           detail: { amount: 1 }
       }));

   Ehrlicher Hinweis: da der komplette Quellcode oeffentlich auf
   GitHub liegt, koennte ein Angreifer dieses Event-Muster in der
   Konsole nachbauen (window.dispatchEvent(new CustomEvent(...))).
   Das ist kein 100%iges Verbot, aber es gibt keinen einzeln
   aufrufbaren Funktionsnamen mehr, und - wichtiger - die eigentliche,
   verlaessliche Pruefung laeuft ohnehin serverseitig in
   sync_player_data() (siehe supabase_schema.sql): player.coins ist
   als Variable im Browser sowieso frei veraenderbar, das laesst sich
   clientseitig grundsaetzlich nicht vollstaendig verhindern.
*/
(function () {

    function grantCoins(amount) {

        if (typeof amount !== "number" || amount <= 0) {

            return;

        }

        player.coins += amount;

        player.totalCoinsEarned += amount;


        /*
           Goldene Feder:
           Für jeweils 100 insgesamt verdiente Münzen
           bekommt der Spieler eine goldene Feder (eigenständiger
           Cursor-Bonus, unabhängig vom Währungsnamen - siehe
           player.items.goldenFeatherCursor).
        */

        const earnedGoldenFeathers =
            Math.floor(
                player.totalCoinsEarned / 100
            );


        if (
            earnedGoldenFeathers >
            player.goldenFeathers
        ) {

            player.goldenFeathers =
                earnedGoldenFeathers;

        }


        checkCoinMilestones();

        savePlayer();

        updatePlayerUI();

        window.dispatchEvent(
            new CustomEvent("player-updated")
        );

    }

    window.addEventListener("mirelon:earn-coins", function (event) {

        const amount =
            event && event.detail && typeof event.detail.amount === "number"
                ? event.detail.amount
                : 0;

        grantCoins(amount);

    });

})();


/* =====================================================
   MÜNZEN-MEILENSTEINE
   ===================================================== */

const coinMilestoneAchievements = [
    { count: 10, name: "Erste Münzen", description: "Verdiene insgesamt 10 Münzen.", icon: "🪙" },
    { count: 100, name: "Münzensammler", description: "Verdiene insgesamt 100 Münzen.", icon: "🥉" },
    { count: 1000, name: "Münzenmeister", description: "Verdiene insgesamt 1000 Münzen.", icon: "🏆" }
];

function checkCoinMilestones() {

    coinMilestoneAchievements.forEach(function (milestone) {

        if (player.totalCoinsEarned >= milestone.count) {

            addAchievement(milestone.name);

        }

    });

}


/* =====================================================
   8. MÜNZEN AUSGEBEN
   ===================================================== */

function spendCoins(amount) {

    if (amount <= 0) {

        return false;

    }


    if (player.coins < amount) {

        return false;

    }


    player.coins -= amount;

    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

    return true;

}

/* =====================================================
   8b. TON EIN / AUS
   ===================================================== */

function isSoundOn() {

    return Boolean(
        player.settings &&
        player.settings.soundOn
    );

}


function setSoundOn(value) {

    player.settings.soundOn = Boolean(value);

    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}


/* =====================================================
   14. ERFOLGE
   ===================================================== */

function addAchievement(achievementName) {

    if (!achievementName) {

        return;

    }


    /*
       Nur echte, im Spiel definierte Erfolge zulassen (siehe
       achievementCatalog weiter unten) - sonst könnte jeder über
       die Browser-Konsole beliebige, frei erfundene Erfolge
       freischalten (z. B. addAchievement("Hack")).
    */

    if (
        typeof achievementCatalog !== "undefined" &&
        !achievementCatalog.some(function (achievement) {
            return achievement.name === achievementName;
        })
    ) {

        return;

    }


    /*
       Erfolg nicht doppelt vergeben.
    */

    if (
        player.achievements.includes(
            achievementName
        )
    ) {

        return;

    }


    player.achievements.push(
        achievementName
    );


    savePlayer();

    updatePlayerUI();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

    showAchievementToast(achievementName);

}


/* =====================================================
   ERFOLGS-BENACHRICHTIGUNG
   ===================================================== */

function showAchievementToast(achievementName) {

    const toast =
        document.createElement("div");

    toast.className = "achievement-toast";

    toast.textContent =
        "🏆 Neuer Erfolg: " + achievementName + "!";

    document.body.appendChild(toast);

    setTimeout(function () {

        toast.classList.add("achievement-toast--show");

    }, 10);

    setTimeout(function () {

        toast.classList.remove("achievement-toast--show");

        setTimeout(function () {

            toast.remove();

        }, 400);

    }, 3500);

}


/* =====================================================
   ALLGEMEINE MELDUNGEN (z. B. Shop-Hinweise)
   Ersetzt hässliche alert()-Popups durch eine kleine,
   im Mirelon-Stil gehaltene Hinweis-Box.
   ===================================================== */

function showMirelonToast(message, type) {

    const existing =
        document.querySelector(".mirelon-toast");

    if (existing) {
        existing.remove();
    }

    const toast =
        document.createElement("div");

    toast.className =
        "mirelon-toast mirelon-toast--" + (type === "error" ? "error" : "info");

    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const icon =
        document.createElement("span");

    icon.className = "mirelon-toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = type === "error" ? "🪙" : "✨";

    const text =
        document.createElement("span");

    text.className = "mirelon-toast-text";
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);

    document.body.appendChild(toast);

    setTimeout(function () {

        toast.classList.add("mirelon-toast--show");

    }, 10);

    setTimeout(function () {

        toast.classList.remove("mirelon-toast--show");

        setTimeout(function () {

            toast.remove();

        }, 400);

    }, 3200);

}


/* =====================================================
   CHARAKTER-SPRECHBLASE (wiederverwendbar)
   Generische kleine Sprechblase für spontane Reaktionen
   einzelner Mirelon-Figuren - rein kosmetisch, vergibt
   keine Münzen, Erfolge oder Fortschritt. Aktuell nur für
   Luis genutzt (siehe Easter-Egg weiter unten), aber so
   gebaut, dass sich später z. B. Branos, Kuro, Faro oder
   Tessa über dieselbe Funktion melden können - dafür
   einfach in CHARACTER_BUBBLE_DEFAULT_AVATARS einen
   weiteren Charakter ergänzen bzw. beim Aufruf ein
   avatarSrc mitgeben.
   ===================================================== */

const CHARACTER_BUBBLE_DEFAULT_AVATARS = {

    luis: function () {

        const theme =
            typeof getSidebarTheme === "function" ? getSidebarTheme() : "baumrinde";

        return LUIS_THEME_IMAGES[theme] || LUIS_THEME_IMAGES.baumrinde;

    }

};

let characterBubbleHideTimeoutId = null;
let characterBubbleRemoveTimeoutId = null;
let characterBubbleRepositionHandler = null;

function positionCharacterBubbleNearAnchor(bubble, anchorEl) {

    const anchorRect = anchorEl.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();

    const margin = 12;
    const viewportMargin = 12;

    let left = anchorRect.left;
    let top = anchorRect.bottom + margin;

    const maxLeft = window.innerWidth - bubbleRect.width - viewportMargin;
    left = Math.max(viewportMargin, Math.min(left, maxLeft));

    // Passt die Blase unter die Figur nicht mehr in den Viewport,
    // stattdessen darüber anzeigen.
    if (top + bubbleRect.height > window.innerHeight - viewportMargin) {
        top = anchorRect.top - bubbleRect.height - margin;
    }

    top = Math.max(viewportMargin, top);

    bubble.style.left = left + "px";
    bubble.style.top = top + "px";

    // Der kleine Pfeil soll weiterhin ungefähr auf die Figur zeigen,
    // auch wenn die Blase seitlich verschoben werden musste.
    const arrow = bubble.querySelector(".character-bubble-arrow");

    if (arrow) {

        const arrowLeft =
            Math.max(16, Math.min(anchorRect.left + anchorRect.width / 2 - left - 7, bubbleRect.width - 30));

        arrow.style.left = arrowLeft + "px";

    }

}

function showCharacterBubble(options) {

    const settings = options || {};
    const character = settings.character || "luis";
    const text = settings.text || "";
    const duration = settings.duration || 9000;

    const anchorEl =
        settings.anchorEl ||
        (settings.anchorSelector ? document.querySelector(settings.anchorSelector) : null);

    let avatarSrc = settings.avatarSrc;

    if (!anchorEl && !avatarSrc && typeof CHARACTER_BUBBLE_DEFAULT_AVATARS[character] === "function") {

        avatarSrc = CHARACTER_BUBBLE_DEFAULT_AVATARS[character]();

    }

    const existingBubble = document.querySelector(".character-bubble");

    if (existingBubble) {
        existingBubble.remove();
    }

    clearTimeout(characterBubbleHideTimeoutId);
    clearTimeout(characterBubbleRemoveTimeoutId);

    window.removeEventListener("resize", characterBubbleRepositionHandler);

    const bubble = document.createElement("div");

    bubble.className =
        "character-bubble character-bubble--" + character + (anchorEl ? " character-bubble--anchored" : "");

    bubble.setAttribute("role", "status");
    bubble.setAttribute("aria-live", "polite");

    bubble.innerHTML = `
        <button type="button" class="character-bubble-close" aria-label="Schließen">✕</button>
        <p class="character-bubble-text"></p>
        <span class="character-bubble-arrow" aria-hidden="true"></span>
        ${avatarSrc ? '<img class="character-bubble-avatar" src="' + avatarSrc + '" alt="">' : ""}
    `;

    bubble.querySelector(".character-bubble-text").textContent = text;

    document.body.appendChild(bubble);

    if (anchorEl) {

        positionCharacterBubbleNearAnchor(bubble, anchorEl);

        characterBubbleRepositionHandler = function () {
            positionCharacterBubbleNearAnchor(bubble, anchorEl);
        };

        window.addEventListener("resize", characterBubbleRepositionHandler);

    }

    function scheduleHide() {

        clearTimeout(characterBubbleHideTimeoutId);

        characterBubbleHideTimeoutId = setTimeout(function () {

            bubble.classList.remove("character-bubble--show");

            characterBubbleRemoveTimeoutId = setTimeout(function () {

                window.removeEventListener("resize", characterBubbleRepositionHandler);
                bubble.remove();

            }, 400);

        }, duration);

    }

    setTimeout(function () {

        bubble.classList.add("character-bubble--show");
        scheduleHide();

    }, 10);

    // Solange Maus oder Fokus auf der Sprechblase liegen, den
    // automatischen Timer pausieren statt sie wegzuschieben.
    bubble.addEventListener("mouseenter", function () {
        clearTimeout(characterBubbleHideTimeoutId);
    });

    bubble.addEventListener("mouseleave", scheduleHide);

    bubble.addEventListener("focusin", function () {
        clearTimeout(characterBubbleHideTimeoutId);
    });

    bubble.addEventListener("focusout", scheduleHide);

    bubble.querySelector(".character-bubble-close").addEventListener("click", function () {

        clearTimeout(characterBubbleHideTimeoutId);
        clearTimeout(characterBubbleRemoveTimeoutId);
        window.removeEventListener("resize", characterBubbleRepositionHandler);
        bubble.remove();

    });

}


/* =====================================================
   MIRELON-BESTÄTIGUNGSDIALOG (wiederverwendbar)
   Ersetzt den hässlichen, browser-eigenen confirm()-Dialog
   durch eine kleine Box im Mirelon-Stil. Verhält sich wie
   confirm() - liefert aber ein Promise<boolean> statt
   synchron zu blockieren, daher mit await aufrufen:

       const ok = await showMirelonConfirm("Wirklich löschen?");
       if (!ok) return;

   ===================================================== */

function showMirelonConfirm(message, options) {

    return new Promise(function (resolve) {

        const settings = options || {};
        const okLabel = settings.okLabel || "OK";
        const cancelLabel = settings.cancelLabel || "Abbrechen";

        const existing = document.querySelector(".mirelon-confirm-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement("div");

        overlay.className = "mirelon-confirm-overlay";

        overlay.innerHTML = `
            <div class="mirelon-confirm-backdrop"></div>
            <div class="mirelon-confirm-card" role="alertdialog" aria-modal="true">
                <p class="mirelon-confirm-text"></p>
                <div class="mirelon-confirm-actions">
                    <button type="button" class="yj-button yj-button--secondary yj-button--compact mirelon-confirm-cancel"></button>
                    <button type="button" class="yj-button yj-button--primary yj-button--compact mirelon-confirm-ok"></button>
                </div>
            </div>
        `;

        overlay.querySelector(".mirelon-confirm-text").textContent = message || "";
        overlay.querySelector(".mirelon-confirm-ok").textContent = okLabel;
        overlay.querySelector(".mirelon-confirm-cancel").textContent = cancelLabel;

        document.body.appendChild(overlay);

        function close(result) {

            document.removeEventListener("keydown", onKeydown);
            overlay.classList.remove("mirelon-confirm-overlay--show");

            setTimeout(function () {
                overlay.remove();
            }, 200);

            resolve(result);

        }

        function onKeydown(event) {

            if (event.key === "Escape") {
                close(false);
            }

        }

        document.addEventListener("keydown", onKeydown);

        overlay.querySelector(".mirelon-confirm-backdrop").addEventListener("click", function () {
            close(false);
        });

        overlay.querySelector(".mirelon-confirm-cancel").addEventListener("click", function () {
            close(false);
        });

        overlay.querySelector(".mirelon-confirm-ok").addEventListener("click", function () {
            close(true);
        });

        setTimeout(function () {

            overlay.classList.add("mirelon-confirm-overlay--show");
            overlay.querySelector(".mirelon-confirm-ok").focus();

        }, 10);

    });

}


/* =====================================================
   LUIS-EASTER-EGG: HÄUFIGE THEME-WECHSEL
   Reagiert humorvoll, wenn innerhalb von 60 Minuten
   mindestens 5 tatsächliche Wechsel des globalen Mirelon-
   Designs stattfinden (siehe setSidebarTheme() in
   JS/sidebar.js, das diese Funktion bei jedem echten
   Wechsel aufruft). Die Zeitstempel liegen bewusst NICHT
   im player-Objekt, damit savePlayer() dafür keine
   Supabase-Synchronisation auslöst - rein lokales,
   kosmetisches Easter-Egg ohne Belohnung.

   Der Spruch kommt von Luis, also erscheint er auch nur
   dort, wo Luis tatsächlich zu sehen ist (Luis Puzzle,
   puzzle.html) - nicht sofort auf der Einstellungsseite,
   wo der 5. Wechsel passiert. Deshalb wird beim 5. Wechsel
   nur ein "pending"-Flag gesetzt; showPendingLuisThemeReaction()
   (von JS/puzzle.js beim Laden aufgerufen) löst die
   eigentliche Sprechblase erst beim nächsten Besuch der
   Puzzle-Seite aus und startet dort auch den Cooldown.
   ===================================================== */

const LUIS_THEME_CHANGE_WINDOW_MS = 60 * 60 * 1000;
const LUIS_THEME_CHANGE_THRESHOLD = 5;
const LUIS_THEME_CHANGE_TIMESTAMPS_KEY = "mirelonThemeChangeTimestamps";
const LUIS_THEME_REACTION_LAST_SHOWN_KEY = "mirelonLuisThemeReactionLastShown";
const LUIS_THEME_REACTION_PENDING_KEY = "mirelonLuisThemeReactionPending";
const LUIS_THEME_REACTION_TEXT = "Schon wieder?! Meine Schuppen kommen ja gar nicht mehr hinterher!";

function registerThemeChangeForLuisEasterEgg() {

    const now = Date.now();

    let timestamps = [];

    try {

        timestamps = JSON.parse(localStorage.getItem(LUIS_THEME_CHANGE_TIMESTAMPS_KEY) || "[]");

        if (!Array.isArray(timestamps)) {
            timestamps = [];
        }

    } catch (error) {

        timestamps = [];

    }

    timestamps.push(now);

    timestamps = timestamps.filter(function (timestamp) {

        return typeof timestamp === "number" && (now - timestamp) < LUIS_THEME_CHANGE_WINDOW_MS;

    });

    try {

        localStorage.setItem(LUIS_THEME_CHANGE_TIMESTAMPS_KEY, JSON.stringify(timestamps));

    } catch (error) {

        // Storage kann in privaten/eingeschränkten Browser-Kontexten fehlen.

    }

    if (timestamps.length < LUIS_THEME_CHANGE_THRESHOLD) {
        return;
    }

    let lastShown = 0;

    try {

        lastShown = Number(localStorage.getItem(LUIS_THEME_REACTION_LAST_SHOWN_KEY)) || 0;

    } catch (error) {

        lastShown = 0;

    }

    if ((now - lastShown) < LUIS_THEME_CHANGE_WINDOW_MS) {
        return;
    }

    try {

        localStorage.setItem(LUIS_THEME_REACTION_PENDING_KEY, "true");

    } catch (error) {

        // Storage kann in privaten/eingeschränkten Browser-Kontexten fehlen.

    }

}

// Wird von JS/puzzle.js beim Laden von Luis Puzzle aufgerufen. Zeigt
// die Sprechblase nur, wenn zuvor tatsächlich ein "pending"-Easter-
// Egg ausgelöst wurde, und startet erst hier (beim tatsächlichen
// Zeigen) den 60-Minuten-Cooldown.
function showPendingLuisThemeReaction() {

    let isPending = false;

    try {

        isPending = localStorage.getItem(LUIS_THEME_REACTION_PENDING_KEY) === "true";

    } catch (error) {

        isPending = false;

    }

    if (!isPending) {
        return;
    }

    try {

        localStorage.removeItem(LUIS_THEME_REACTION_PENDING_KEY);
        localStorage.setItem(LUIS_THEME_REACTION_LAST_SHOWN_KEY, String(Date.now()));

    } catch (error) {

        // Storage kann in privaten/eingeschränkten Browser-Kontexten fehlen.

    }

    showCharacterBubble({
        character: "luis",
        text: LUIS_THEME_REACTION_TEXT,
        duration: 9000,
        anchorSelector: "#luisMascot"
    });

}


/* =====================================================
   HIGHSCORE-PUNKTE
   Gemeinsamer Punktestand über alle Spiele hinweg (Quiz,
   Wörterraten, Wer-ist-es, Puzzle) - unabhängig von den
   Münzen. Jeder Sieg gibt den gleichen festen Punktewert.
   Speist die globale Bestenliste (bestenliste.html/highscore.js)
   über eine eigene Supabase-Tabelle (siehe
   supabase_schema_highscores.sql). Der eigentliche Punktestand
   in der Cloud wird serverseitig über die increment_highscore()-
   Funktion um einen festen Wert erhöht (nicht direkt vom Client
   gesetzt), damit niemand sich per Browser-Konsole einen
   beliebigen Punktestand eintragen kann.
   ===================================================== */

const HIGHSCORE_POINTS_PER_WIN = 10;

async function syncHighscoreToCloud() {

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        return;
    }

    try {

        const sessionResult = await supabaseClient.auth.getSession();
        const session = sessionResult.data.session;

        if (!session) {
            return;
        }

        const rpcResult = await supabaseClient.rpc("increment_highscore", {
            player_name_input: player.name || "Abenteurer",
        });

        if (rpcResult.error) {

            // Bestenliste ist ein Bonus-Feature - darf das Spiel nicht
            // sichtbar stoeren, aber der Fehler soll wenigstens in der
            // Konsole auftauchen, statt komplett spurlos zu verschwinden
            // (supabase.rpc() wirft bei einem serverseitigen Fehler keine
            // Exception, sondern liefert nur {error} im Ergebnis zurueck).

            console.warn("Bestenliste konnte nicht aktualisiert werden:", rpcResult.error);

        }

    } catch (error) {

        console.warn("Bestenliste konnte nicht aktualisiert werden:", error);

    }

}

function awardHighscorePoints() {

    if (typeof player.highscorePoints !== "number") {

        player.highscorePoints = 0;

    }

    player.highscorePoints += HIGHSCORE_POINTS_PER_WIN;

    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

    syncHighscoreToCloud();

}


/* =====================================================
   QUIZ-ERFOLGE BEI KURO
   Wird von JS/quiz.js aufgerufen, wenn ein Quiz
   zu Ende gespielt wurde.
   ===================================================== */

const quizCompletionAchievements = [
    { count: 1, name: "Erstes Quiz gemeistert", description: "Schließe dein erstes Quiz bei Kuro ab.", icon: "🥉" },
    { count: 3, name: "3 Quizze gemeistert", description: "Schließe 3 Quizze bei Kuro ab.", icon: "🥈" },
    { count: 5, name: "5 Quizze gemeistert", description: "Schließe 5 Quizze bei Kuro ab.", icon: "🥇" },
    { count: 10, name: "10 Quizze gemeistert", description: "Schließe 10 Quizze bei Kuro ab.", icon: "🏆" }
];

function registerQuizCompletion() {

    if (typeof player.quizzesCompleted !== "number") {

        player.quizzesCompleted = 0;

    }

    player.quizzesCompleted++;

    savePlayer();

    awardHighscorePoints();

    const unlockedAchievement = quizCompletionAchievements.find(
        function (achievement) {

            return achievement.count === player.quizzesCompleted;

        }
    );

    if (unlockedAchievement) {

        addAchievement(unlockedAchievement.name);

    }

}


/* =====================================================
   TIER-FREUNDE BESUCHEN
   Wird auf den Orts-Seiten (Kuros Nest, Hasenschule,
   Fuchsbau, Bärental, ...) aufgerufen. Kommt ein neuer
   Ort/Tier dazu, einfach hier in die Liste eintragen -
   der Erfolg passt sich automatisch an.
   ===================================================== */

const animalFriends = [
    { id: "kuro", name: "Kuro" },
    { id: "tessa", name: "Tessa" },
    { id: "faro", name: "Faro" },
    { id: "branos", name: "Branos" },
    { id: "luis", name: "Luis" }
];

const visitAllAnimalsAchievement = {
    name: "Alle Tiere besucht",
    description: "Besuche Kuro, Tessa, Faro, Branos und Luis.",
    icon: "🐾"
};

function markAnimalVisited(animalId) {

    if (!Array.isArray(player.visitedAnimals)) {

        player.visitedAnimals = [];

    }

    if (player.visitedAnimals.includes(animalId)) {

        return;

    }

    player.visitedAnimals.push(animalId);

    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

    const allVisited = animalFriends.every(function (animal) {

        return player.visitedAnimals.includes(animal.id);

    });

    if (allVisited) {

        addAchievement(visitAllAnimalsAchievement.name);

    }

}


/* =====================================================
   WÖRTERRATEN-ERFOLGE
   Wird von JS/eulenschule.js aufgerufen, wenn eine
   Runde gewonnen wurde.
   ===================================================== */

const wordGameDifficultyAchievements = {
    leicht: { name: "Wörterraten: Leicht gemeistert", description: "Gewinne eine Runde Wörterraten auf Leicht.", icon: "🌼" },
    mittel: { name: "Wörterraten: Mittel gemeistert", description: "Gewinne eine Runde Wörterraten auf Mittel.", icon: "🌳" },
    schwer: { name: "Wörterraten: Schwer gemeistert", description: "Gewinne eine Runde Wörterraten auf Schwer.", icon: "🔥" }
};

const wordGameMasterAchievement = {
    name: "Wörterraten-Meister",
    description: "Gewinne eine Runde Wörterraten auf jeder Schwierigkeit.",
    icon: "📖"
};

function registerWordGameWin(difficulty) {

    if (!Array.isArray(player.wordGameWins)) {

        player.wordGameWins = [];

    }

    const difficultyAchievement = wordGameDifficultyAchievements[difficulty];

    if (!difficultyAchievement) {

        return;

    }

    awardHighscorePoints();

    if (!player.wordGameWins.includes(difficulty)) {

        player.wordGameWins.push(difficulty);

        savePlayer();

    }

    addAchievement(difficultyAchievement.name);

    const allDifficultiesWon = Object.keys(wordGameDifficultyAchievements).every(
        function (key) {

            return player.wordGameWins.includes(key);

        }
    );

    if (allDifficultiesWon) {

        addAchievement(wordGameMasterAchievement.name);

    }

}


/* =====================================================
   WER-IST-ES BEI BRANOS
   Wird von JS/baerental.js aufgerufen, wenn das geheime
   Tier richtig erraten wurde.
   ===================================================== */

function registerAnimalGuessWin() {

    awardHighscorePoints();

}


/* =====================================================
   MEMORY BEI TESSA
   Wird von JS/memory.js aufgerufen, wenn eine Memory-
   Runde fertig gespielt wurde (alle Paare gefunden).
   ===================================================== */

const memoryCompletionAchievements = [
    { difficulty: "normal", count: 1, name: "Memory-Neuling", description: "Spiele Memory auf Normal 1 Mal.", icon: "🧠" },
    { difficulty: "normal", count: 5, name: "Memory-Profi", description: "Spiele Memory auf Normal 5 Mal.", icon: "🃏" },
    { difficulty: "normal", count: 10, name: "Memory-Meister", description: "Spiele Memory auf Normal 10 Mal.", icon: "🏅" },

    { difficulty: "schwer", count: 1, name: "Herausforderer", description: "Spiele Memory auf Schwer 1 Mal.", icon: "🔥" },
    { difficulty: "schwer", count: 5, name: "Kartenprofi", description: "Spiele Memory auf Schwer 5 Mal.", icon: "🎴" },
    { difficulty: "schwer", count: 10, name: "Schwer-Champion", description: "Spiele Memory auf Schwer 10 Mal.", icon: "🏆" },

    { difficulty: "extraschwer", count: 1, name: "Wagemutig", description: "Spiele Memory auf Extra Schwer 1 Mal.", icon: "💀" },
    { difficulty: "extraschwer", count: 5, name: "Gedächtniskünstler", description: "Spiele Memory auf Extra Schwer 5 Mal.", icon: "🧩" },
    { difficulty: "extraschwer", count: 10, name: "Memory-Legende", description: "Spiele Memory auf Extra Schwer 10 Mal.", icon: "👑" }
];

function registerMemoryCompletion(difficulty) {

    const level = difficulty || "normal";

    if (!player.memoryGamesCompleted) {
        player.memoryGamesCompleted = {};
    }

    if (typeof player.memoryGamesCompleted[level] !== "number") {
        player.memoryGamesCompleted[level] = 0;
    }

    player.memoryGamesCompleted[level]++;

    let memoryReward = 1;

    if (level === "schwer") {
        memoryReward = 5;
    } else if (level === "extraschwer") {
        memoryReward = 10;
    }

    /*
       "amount" ist nur fuer die optimistische, sofortige Anzeige im
       Browser (siehe grantCoins() weiter oben) - massgeblich ist der
       serverseitig festgelegte Betrag zum selben "reason" in
       earn_coins() (siehe supabase_migration_security_player_data.sql).
       Beide Betraege muessen inhaltlich uebereinstimmen, der Client
       kann den Server-Betrag aber nicht beeinflussen.
    */
    window.dispatchEvent(
        new CustomEvent("mirelon:earn-coins", {
            detail: { amount: memoryReward, reason: "memory_" + level }
        })
    );

    awardHighscorePoints();

    const unlockedAchievement = memoryCompletionAchievements.find(function (achievement) {

        return achievement.difficulty === level && achievement.count === player.memoryGamesCompleted[level];

    });

    if (unlockedAchievement) {

        addAchievement(unlockedAchievement.name);

    }

}


/* =====================================================
   PUZZLE-ERFOLGE
   Wird von JS/puzzle.js aufgerufen, wenn ein Puzzle
   fertig gelöst wurde.
   ===================================================== */

const puzzleCompletionAchievements = [
    { count: 5, name: "5 Puzzle gelöst", description: "Löse 5 Puzzle.", icon: "🧩" },
    { count: 10, name: "10 Puzzle gelöst", description: "Löse 10 Puzzle.", icon: "🧩" },
    { count: 20, name: "20 Puzzle gelöst", description: "Löse 20 Puzzle.", icon: "🧩" },
    { count: 50, name: "50 Puzzle gelöst", description: "Löse 50 Puzzle.", icon: "🧩" },
    { count: 100, name: "100 Puzzle gelöst", description: "Löse 100 Puzzle.", icon: "🧩" }
];

// Die 5 festen Bilder aus dem "Bilder aus Mirelon"-Abschnitt der
// Puzzle-Bildauswahl (siehe SITE_IMAGES in JS/puzzle-image-picker.js).
// Eigene, in der Malstube gemalte Bilder zählen hier bewusst nicht mit,
// da diese Liste unbegrenzt ist und "alle" damit nie erreichbar wäre.
const puzzleGalleryImages = [
    "Übersichtskarte",
    "Kuros Nest",
    "Tessas Hasenschule",
    "Faros Fuchsbau",
    "Bärental",
    "Luis"
];

const puzzleGalleryAchievement = {
    name: "Puzzle-Weltenbummler",
    description: "Löse ein Puzzle mit jedem Bild aus der Galerie.",
    icon: "🗺️"
};

function registerPuzzleCompletion(galleryImageLabel) {

    if (typeof player.puzzlesCompleted !== "number") {

        player.puzzlesCompleted = 0;

    }

    player.puzzlesCompleted++;

    if (galleryImageLabel) {

        if (!Array.isArray(player.puzzleGalleryImagesUsed)) {

            player.puzzleGalleryImagesUsed = [];

        }

        if (!player.puzzleGalleryImagesUsed.includes(galleryImageLabel)) {

            player.puzzleGalleryImagesUsed.push(galleryImageLabel);

        }

    }

    savePlayer();

    awardHighscorePoints();

    const unlockedCountAchievement = puzzleCompletionAchievements.find(
        function (achievement) {

            return achievement.count === player.puzzlesCompleted;

        }
    );

    if (unlockedCountAchievement) {

        addAchievement(unlockedCountAchievement.name);

    }

    if (galleryImageLabel) {

        const allGalleryImagesUsed = puzzleGalleryImages.every(function (label) {

            return player.puzzleGalleryImagesUsed.includes(label);

        });

        if (allGalleryImagesUsed) {

            addAchievement(puzzleGalleryAchievement.name);

        }

    }

}


/* =====================================================
   PUZZLE-ERFOLG "LUIS IN ALLEN FARBEN"
   Die 5 Puzzle-Design-Varianten entsprechen 1:1 den
   globalen Mirelon-Designs (siehe SIDEBAR_THEMES_WITH_ATTRIBUTE
   + "baumrinde" in JS/sidebar.js) - hier dieselben IDs
   wiederverwendet statt einer eigenen Liste.
   Wird von JS/puzzle.js aufgerufen, wenn ein Puzzle mit
   dem jeweils aktiven globalen Theme gelöst wurde.
   ===================================================== */

// Einzige Quelle der Wahrheit fuer die Luis-Farbvariante pro
// globalem Mirelon-Theme - wird sowohl fuer den Puzzle-Erfolg
// als auch fuer das Luis-Sprechblasen-Easter-Egg genutzt (siehe
// showCharacterBubble()/CHARACTER_BUBBLE_DEFAULT_AVATARS weiter
// unten), damit es keine zweite, abweichende Zuordnung gibt.
const LUIS_THEME_IMAGES = {
    baumrinde: "images/chameleon_luis_brown.png",
    smaragdwald: "images/chameleon_luis_green.png",
    zuckerwatte: "images/chameleon_luis_zuckerwatte.png",
    azurblau: "images/chameleon_luis_blue.png",
    rot: "images/chameleon_luis_red.png",
    orange: "images/chameleon_luis_orange.png"
};

const puzzleLuisThemeIds = Object.keys(LUIS_THEME_IMAGES);

const puzzleLuisAchievement = {
    name: "Luis in allen Farben",
    description: "Löse mit jeder Luis-Variante mindestens ein Puzzle.",
    icon: "🦎",
    // Geheimer Erfolg: auf der Erfolge-Seite (erfolge.html) wird
    // Name/Beschreibung erst nach dem Freischalten angezeigt, siehe
    // JS/erfolge.js.
    secret: true
};

function registerPuzzleLuisVariant(themeId) {

    if (!puzzleLuisThemeIds.includes(themeId)) {
        return;
    }

    if (!Array.isArray(player.puzzleLuisVariantsCompleted)) {
        player.puzzleLuisVariantsCompleted = [];
    }

    if (!player.puzzleLuisVariantsCompleted.includes(themeId)) {

        player.puzzleLuisVariantsCompleted.push(themeId);

        savePlayer();

    }

    const allVariantsCompleted = puzzleLuisThemeIds.every(function (id) {

        return player.puzzleLuisVariantsCompleted.includes(id);

    });

    if (allVariantsCompleted) {

        addAchievement(puzzleLuisAchievement.name);

    }

}


/* =====================================================
   KUROS LADEN - KAUF-ERFOLGE (Liste)
   ===================================================== */

const shopItemAchievements = [
    { count: 1, name: "Erster Kauf", description: "Kaufe dein erstes Item in Kuros Laden.", icon: "🛍️" },
    { count: 2, name: "Fleißiger Käufer", description: "Kaufe 2 Items in Kuros Laden.", icon: "🛒" },
    { count: 3, name: "Sammler", description: "Kaufe alle 3 Cursor in Kuros Laden.", icon: "🎁" }
];


/* =====================================================
   GESAMTKATALOG ALLER ERFOLGE
   Wird von der Erfolge-Seite (erfolge.html) genutzt, um
   alle Erfolge (freigeschaltet oder nicht) anzuzeigen.
   ===================================================== */

const achievementCatalog = quizCompletionAchievements.concat([
    visitAllAnimalsAchievement,
    wordGameDifficultyAchievements.leicht,
    wordGameDifficultyAchievements.mittel,
    wordGameDifficultyAchievements.schwer,
    wordGameMasterAchievement
]).concat(puzzleCompletionAchievements).concat([
    puzzleGalleryAchievement,
    puzzleLuisAchievement
]).concat(coinMilestoneAchievements).concat(shopItemAchievements).concat(memoryCompletionAchievements);


/* =====================================================
   15. CURSOR ANWENDEN
   ===================================================== */

function applyCursor() {

    let cursor = "auto";

    if (
        player.activeCursor === "fox" &&
        player.items &&
        player.items.foxCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/fox_cursor.png') 4 4, auto";
    }


    if (
        player.activeCursor === "bear" &&
        player.items &&
        player.items.bearCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/bear_cursor.png') 8 12, auto";
    }


    if (
    player.activeCursor === "unicorn" &&
    player.items &&
    player.items.unicornCursor === true
) {
    cursor =
        "url('Icons/Cursor/unicorn_cursor.png') 4 4, auto";
}


    if (
        player.activeCursor === "kuro" &&
        player.items &&
        player.items.kuroCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/kuro_cursor.png') 6 37, auto";
    }


    if (
        player.activeCursor === "hasen" &&
        player.items &&
        player.items.hasenCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/hasen_cursor.png') 17 10, auto";
    }


    if (
        player.activeCursor === "goldenfeather" &&
        player.items &&
        player.items.goldenFeatherCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/golden_feather_cursor.png') 13 14, auto";
    }


    if (
        player.activeCursor === "blackgoldenfeather" &&
        player.items &&
        player.items.blackGoldenFeatherCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/blackgolden_feather_cursor.png') 10 13, auto";
    }


    if (
        player.activeCursor === "luis" &&
        player.items &&
        player.items.luisCursor === true
    ) {
        cursor =
            "url('Icons/Cursor/luis_cursor.png') 19 5, auto";
    }


    document.documentElement.style.cursor = cursor;
    document.body.style.cursor = cursor;
}


/* =====================================================
   16. CURSOR ÄNDERN
   ===================================================== */

function setCursor(cursorName) {

    // Standardcursor
    if (cursorName === "default") {

        player.activeCursor = "default";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        return true;
    }

    // Fuchs
    if (
        cursorName === "fox" &&
        player.items &&
        player.items.foxCursor
    ) {

        player.activeCursor = "fox";

        savePlayer();

        window.dispatchEvent(new CustomEvent("player-updated"));

        applyCursor();

        return true;
    }

    // Bär
if (
    cursorName === "bear" &&
    player.items &&
    player.items.bearCursor
) {

    player.activeCursor = "bear";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Einhorn
if (
    cursorName === "unicorn" &&
    player.items &&
    player.items.unicornCursor
) {

    player.activeCursor = "unicorn";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Kuro
if (
    cursorName === "kuro" &&
    player.items &&
    player.items.kuroCursor
) {

    player.activeCursor = "kuro";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Hase
if (
    cursorName === "hasen" &&
    player.items &&
    player.items.hasenCursor
) {

    player.activeCursor = "hasen";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Goldene Feder
if (
    cursorName === "goldenfeather" &&
    player.items &&
    player.items.goldenFeatherCursor
) {

    player.activeCursor = "goldenfeather";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Schwarzgoldene Feder
if (
    cursorName === "blackgoldenfeather" &&
    player.items &&
    player.items.blackGoldenFeatherCursor
) {

    player.activeCursor = "blackgoldenfeather";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


// Luis
if (
    cursorName === "luis" &&
    player.items &&
    player.items.luisCursor
) {

    player.activeCursor = "luis";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

    return true;
}


return false;
}



/* =====================================================
   17. FUCHS-CURSOR FREISCHALTEN
   ===================================================== */

function unlockFoxCursor() {

    if (!player.items) {

        player.items = {};

    }


    player.items.foxCursor =
        true;


    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}

/* =====================================================
   BÄREN-CURSOR FREISCHALTEN
   ===================================================== */

function unlockBearCursor() {

    if (!player.items) {

        player.items = {};

    }

    player.items.bearCursor = true;

    savePlayer();

    window.dispatchEvent(
        new CustomEvent("player-updated")
    );

}
/* =====================================================
   18. CURSOR DEAKTIVIEREN
   ===================================================== */

function disableCustomCursor() {

    player.activeCursor =
        "default";

    savePlayer();

    window.dispatchEvent(new CustomEvent("player-updated"));

    applyCursor();

}


/* =====================================================
   19. ITEM BESITZ PRÜFEN
   ===================================================== */

function hasItem(itemName) {

    if (!player.items) {

        return false;

    }


    return Boolean(
        player.items[itemName]
    );

}


/* =====================================================
   KUROS LADEN - KAUF-ERFOLGE
   Wird von JS/shop.js nach jedem erfolgreichen (neuen)
   Kauf aufgerufen und zählt, wie viele der Shop-Items
   der Spieler insgesamt besitzt. Die Erfolgsliste selbst
   (shopItemAchievements) steht weiter oben beim
   Gesamtkatalog, damit sie dort schon zur Verfügung steht.
   ===================================================== */

function countOwnedShopItems() {

    if (!player.items) {
        return 0;
    }

    return Object.values(player.items).filter(Boolean).length;

}

function registerShopPurchase() {

    const ownedCount = countOwnedShopItems();

    const unlockedAchievement = shopItemAchievements.find(function (achievement) {

        return achievement.count === ownedCount;

    });

    if (unlockedAchievement) {

        addAchievement(unlockedAchievement.name);

    }

}

/* =====================================================
   20. SPIELERSYSTEM INITIALISIEREN
   ===================================================== */

function initPlayer() {

    /*
       1. Gespeicherten Spieler laden
    */

    loadPlayer();


    /*
       2. Name, Avatar, Münzen und Erfolge anzeigen
    */

    updatePlayerUI();


    /*
       3. Gespeicherten Cursor anwenden
    */

    applyCursor();

}


/* =====================================================
   21. UI AKTUALISIEREN, WENN SPIELERDATEN SICH ÄNDERN
   ===================================================== */

window.addEventListener(
    "player-updated",
    function() {

        updatePlayerUI();

        applyCursor();

    }
);


/* =====================================================
   22. SEITE STARTEN
   ===================================================== */

/*
   Da player.js bei dir am Ende des HTML geladen wird,
   existieren die HTML-Elemente zu diesem Zeitpunkt bereits.
*/

initPlayer();
