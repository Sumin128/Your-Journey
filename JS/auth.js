/* =====================================================
   AUTH.JS
   Optionaler Konto-Sync (Supabase) für Your Journey.

   Wichtig: Die App funktioniert weiterhin komplett OHNE
   Konto - dieses Modul kommt nur oben drauf und synchronisiert
   Münzen, Erfolge und Inventar, falls sich jemand freiwillig
   registriert. Ohne Konto bleibt alles wie bisher rein lokal
   in localStorage (siehe JS/player.js).

   Die Anmelde-Maske wird - genau wie der Rucksack in
   sidebar.js - per JavaScript gebaut und an <body> gehängt,
   damit sie auf jeder Seite über ein Icon in der Sidebar
   erreichbar ist, statt fest in einer einzelnen Seite zu
   stecken.
   ===================================================== */

const SUPABASE_URL = "https://mcfsfynceaajsflmrxzg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l78-VbeEioCEeLuRyiLTZg_Na79qEJJ";

const supabaseClient =
    (typeof supabase !== "undefined")
        ? supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
        : null;

let currentSession = null;
let isPasswordRecovery = false;


/* =====================================================
   1. STATUS
   ===================================================== */

function isLoggedIn() {

    return Boolean(currentSession);

}


/* =====================================================
   2. CLOUD <-> LOKAL SYNCHRONISIEREN
   ===================================================== */

async function pushProfileToCloud() {

    if (!supabaseClient || !currentSession) {
        return;
    }

    /* Läuft über die sync_player_data()-Funktion (siehe
       supabase_schema.sql) statt über ein direktes UPDATE auf
       profiles.player_data. Ein direktes UPDATE würde es jedem
       angemeldeten Nutzer erlauben, per Browser-Konsole/REST-API
       einen beliebigen player_data-Wert zu setzen (z. B. Münzen
       oder Erfolge frei erfinden) - die Funktion prüft den neuen
       Stand serverseitig gegen den alten, bevor gespeichert wird. */

    const rpcResult = await supabaseClient.rpc("sync_player_data", {
        new_data: player
    });

    if (rpcResult.error) {

        // Sync ist ein Hintergrund-Vorgang - darf das Spiel nicht
        // sichtbar stoeren, aber der Fehler soll wenigstens in der
        // Konsole auftauchen (z. B. falls die Plausibilitaetspruefung
        // in sync_player_data() einen Wert ablehnt).

        console.warn("Spielstand konnte nicht mit der Cloud synchronisiert werden:", rpcResult.error);

    }

}


/* =====================================================
   MÜNZEN SERVERSEITIG GUTSCHREIBEN
   Unabhängig vom lokalen, optimistischen Update in
   JS/player.js (dort nur für die sofortige Anzeige) - hier
   läuft die eigentliche, maßgebliche Gutschrift über
   earn_coins() (siehe supabase_migration_security_player_data.sql).
   Der Server bekommt nur den "reason" (welche Aktion war es),
   NIE einen vom Client berechneten Betrag - der Betrag steht
   serverseitig fest. Für Gäste ohne Konto passiert hier nichts,
   deren Münzen bleiben rein lokal (kein Server zum Absichern da).
   ===================================================== */

window.addEventListener("mirelon:earn-coins", async function (event) {

    if (!supabaseClient || !currentSession) {
        return;
    }

    const reason =
        event && event.detail && typeof event.detail.reason === "string"
            ? event.detail.reason
            : null;

    if (!reason) {
        return;
    }

    /* Der SQL-Parameter heißt "p_reason" (nicht "reason") - siehe
       Kommentar in supabase_migration_security_player_data.sql:
       sonst wäre er dort mit der gleichnamigen Tabellenspalte
       reward_cooldowns.reason mehrdeutig. Der Name muss hier exakt
       passen, supabase-js übergibt RPC-Parameter benannt. */

    const rpcResult = await supabaseClient.rpc("earn_coins", { p_reason: reason });

    if (rpcResult.error) {

        console.warn("Münzen konnten nicht serverseitig gutgeschrieben werden:", rpcResult.error);

        return;

    }

    /* Server ist die Wahrheit: den zurückgegebenen Stand als
       korrigierenden Abgleich übernehmen, statt dem lokalen,
       optimistischen Wert aus player.js blind zu vertrauen. */

    const authoritative = rpcResult.data;

    if (authoritative && typeof authoritative.coins === "number") {

        player.coins = authoritative.coins;
        player.totalCoinsEarned = authoritative.totalCoinsEarned;
        player.goldenFeathers = authoritative.goldenFeathers;

        savePlayer();
        updatePlayerUI();

    }

});


async function pullProfileFromCloud() {

    if (!supabaseClient || !currentSession) {
        return;
    }

    /* WICHTIG (Account-Wechsel-Bug): player wird hier IMMER zuerst auf
       einen frischen Standard-Spielstand zurückgesetzt, bevor irgendwas
       vom Server geladen wird - egal was vorher in player stand (ein
       Gast-Spielstand, oder sogar noch die Daten eines anderen, gerade
       abgemeldeten Accounts auf demselben Gerät). Ohne dieses Reset
       würde Object.assign(player, cloudData) weiter unten den alten
       Stand als Grundlage nehmen und - falls die Cloud für diesen Nutzer
       leer ist - dessen fremde Felder einfach stehen lassen. */

    player = createDefaultPlayer();

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select("player_data")
            .eq("id", currentSession.user.id)
            .single();

    if (error || !data) {

        /* Netzwerk-/Serverfehler: der eigentliche Cloud-Stand ist
           unbekannt (könnte durchaus echte Daten enthalten, die
           gerade nur nicht abrufbar waren) - deshalb hier bewusst
           NICHT "player-updated" feuern, das würde über den eigenen
           Listener weiter unten sofort einen Push auslösen und damit
           im schlimmsten Fall echte Cloud-Daten mit dem gerade erst
           gesetzten frischen Default überschreiben. Nur die Anzeige
           lokal auffrischen; ein späterer erfolgreicher Sync-Versuch
           holt den echten Stand nach. */

        if (typeof updatePlayerUI === "function") {
            updatePlayerUI();
        }

        if (typeof applyCursor === "function") {
            applyCursor();
        }

        return;

    }

    const cloudData = data.player_data || {};

    if (Object.keys(cloudData).length > 0) {

        /* Konto existiert schon und hat Daten: Cloud-Stand
           gewinnt, damit alle Geräte denselben Stand zeigen.
           Basis ist ein frischer Default (siehe oben), nicht
           der vorherige player-Zustand. */

        player = Object.assign(createDefaultPlayer(), cloudData);

        /* Umstellung Federn -> Münzen: falls die Cloud noch einen
           alten Speicherstand ohne player.coins hat (siehe gleiche
           Migration in loadPlayer(), JS/player.js), hier genauso
           nachziehen - sonst verliert ein Spieler beim ersten Login
           auf einem neuen Gerät seinen Münzen-Stand. */

        if (
            typeof cloudData.coins !== "number" &&
            typeof cloudData.feathers === "number"
        ) {

            player.coins = cloudData.feathers;

        }

        if (
            typeof cloudData.totalCoinsEarned !== "number" &&
            typeof cloudData.totalFeathersEarned === "number"
        ) {

            player.totalCoinsEarned = cloudData.totalFeathersEarned;

        }

        /* Alte Schlüssel entfernen, damit sie nicht länger
           mitgespeichert werden. Direkt zurück in die Cloud
           schreiben (statt auf die nächste beliebige Änderung zu
           warten), damit player_data dort auch wirklich bereinigt
           wird. */

        const hadLegacyFeatherKeys =
            typeof cloudData.feathers !== "undefined" ||
            typeof cloudData.totalFeathersEarned !== "undefined";

        delete player.feathers;
        delete player.totalFeathersEarned;

        if (hadLegacyFeatherKeys) {
            pushProfileToCloud();
        }

    }

    /* Sonst (player_data ist leer, z. B. gerade erst registriert):
       der oben gesetzte frische Standard-Spielstand bleibt einfach
       stehen. Bewusst KEIN automatisches Hochladen eines vorherigen
       lokalen Standes mehr (das war der eigentliche Account-Wechsel-
       Bug) und auch keine automatische Übernahme eines eventuell
       vorhandenen Gast-Spielstands - das soll später eine bewusste
       "Gastfortschritt übernehmen?"-Funktion werden, keine stille
       Automatik. */

    window.dispatchEvent(new CustomEvent("player-updated"));

}


/* =====================================================
   3. ANMELDEN / REGISTRIEREN / ABMELDEN / PASSWORT
   ===================================================== */

async function signUpAccount(email, password, parentalConsent) {

    if (!supabaseClient) {
        return { error: "Konto-Funktion gerade nicht verfügbar." };
    }

    if (!parentalConsent) {
        return { error: "Bitte bestätige die Einwilligung eines Erziehungsberechtigten." };
    }

    const { data, error } =
        await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { parental_consent: true },
                emailRedirectTo: window.location.origin + "/auth-success.html"
            }
        });

    if (error) {
        return { error: error.message };
    }

    if (!data.session) {

        /* Projekt verlangt E-Mail-Bestätigung, bevor man sich
           einloggen kann - kein Fehler, nur ein Hinweis. */

        return { success: true, needsConfirmation: true };

    }

    currentSession = data.session;

    /* Neuer Account startet immer frisch - NICHT mit dem bisherigen
       Gast-Spielstand (das wäre eine unbeabsichtigte automatische
       Übernahme). Eine bewusste "Gastfortschritt übernehmen?"-Funktion
       kann das später als eigene, vom Nutzer gewählte Aktion anbieten. */

    player = createDefaultPlayer();

    await pushProfileToCloud();

    /* Statt nur updatePlayerUI()/applyCursor() direkt aufzurufen: das
       "player-updated"-Event feuern, damit ALLE Anzeigen (Sidebar,
       Kuros Laden, Erfolge, ...) konsistent auffrischen - genau wie
       an jeder anderen Stelle im Spiel. Löst zwar über den eigenen
       Listener weiter unten noch einen zweiten, harmlosen Push aus
       (derselbe frische Stand ist schon oben hochgeladen), das ist
       hier kein Problem. */

    window.dispatchEvent(new CustomEvent("player-updated"));

    updateAuthUI();

    return { success: true };

}


async function signInAccount(email, password) {

    if (!supabaseClient) {
        return { error: "Konto-Funktion gerade nicht verfügbar." };
    }

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

    if (error) {
        return { error: error.message };
    }

    currentSession = data.session;

    await pullProfileFromCloud();
    updateAuthUI();

    return { success: true };

}


async function signOutAccount() {

    if (!supabaseClient) {
        return;
    }

    await supabaseClient.auth.signOut();

    currentSession = null;

    /* Account-Wechsel-Bug: den Account-Stand sofort aus player
       entfernen und durch den vorhandenen lokalen Gast-Spielstand
       ersetzen (oder einen frischen Default, falls es noch nie
       einen gab - loadPlayer() deckt beide Fälle ab). Niemals
       Account-Daten nach dem Logout sichtbar lassen oder unbemerkt
       auf den nächsten Login/Account übertragen. currentSession ist
       hier schon null, savePlayer() (von loadPlayer() ggf. intern
       aufgerufen) schreibt deshalb wieder normal in den Gast-
       Speicherplatz, nicht in den - inzwischen verlassenen - Account. */

    if (typeof loadPlayer === "function") {
        loadPlayer();
    }

    window.dispatchEvent(new CustomEvent("player-updated"));

    updateAuthUI();

}


async function requestPasswordReset(email) {

    if (!supabaseClient) {
        return { error: "Konto-Funktion gerade nicht verfügbar." };
    }

    const { error } =
        await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + "/reset-password.html"
        });

    if (error) {
        return { error: error.message };
    }

    return { success: true };

}


async function updateEmail(newEmail) {

    if (!supabaseClient) {
        return { error: "Konto-Funktion gerade nicht verfügbar." };
    }

    const { error } =
        await supabaseClient.auth.updateUser({ email: newEmail });

    if (error) {
        return { error: error.message };
    }

    return { success: true };

}


async function setNewPassword(newPassword) {

    if (!supabaseClient) {
        return { error: "Konto-Funktion gerade nicht verfügbar." };
    }

    const { error } =
        await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
        return { error: error.message };
    }

    isPasswordRecovery = false;

    return { success: true };

}


/* =====================================================
   4. UI AKTUALISIEREN
   ===================================================== */

function updateAuthUI() {

    /* Während der "Passwort vergessen"-Wiederherstellung hat man
       zwar technisch eine (temporäre) Sitzung, soll aber weder
       den "angemeldet"-Bereich noch den normalen Login/Registrieren-
       Bereich sehen - nur das Passwort-Formular. */

    const showLoggedInView = isLoggedIn() && !isPasswordRecovery;

    document.querySelectorAll("[data-auth-status]").forEach(function (el) {

        el.textContent = isLoggedIn() && !isPasswordRecovery
            ? "Angemeldet als " + currentSession.user.email
            : "Nicht angemeldet – dein Fortschritt wird nur lokal auf diesem Gerät gespeichert.";

    });

    document.querySelectorAll("[data-auth-only]").forEach(function (el) {
        el.hidden = !showLoggedInView;
    });

    document.querySelectorAll("[data-guest-only]").forEach(function (el) {
        el.hidden = showLoggedInView;
    });

}


/* Uebersetzt die technischen (englischen) Supabase-Fehlermeldungen
   in verstaendliche deutsche Hinweise. Unbekannte Meldungen kommen
   unveraendert durch, damit nie eine leere Meldung angezeigt wird. */
function friendlyAuthError(message) {

    const knownMessages = {
        "Invalid login credentials": "E-Mail oder Passwort ist falsch.",
        "User already registered": "Für diese E-Mail-Adresse gibt es schon ein Konto.",
        "Email not confirmed": "Bitte bestätige zuerst deine E-Mail-Adresse über den Link, den wir dir geschickt haben.",
        "Password should be at least 6 characters": "Das Passwort muss mindestens 6 Zeichen haben.",
        "Unable to validate email address: invalid format": "Das ist keine gültige E-Mail-Adresse.",
        "Auth session missing!": "Der Link ist abgelaufen oder ungültig. Fordere einen neuen Link an."
    };

    if (knownMessages[message]) {
        return knownMessages[message];
    }

    if (/network|fetch/i.test(message)) {
        return "Keine Verbindung möglich. Prüf deine Internetverbindung und versuch's nochmal.";
    }

    if (/rate limit|only request this after/i.test(message)) {
        return "Bitte warte einen Moment, bevor du es erneut versuchst.";
    }

    if (/expired|invalid.*(link|token)/i.test(message)) {
        return "Der Link ist abgelaufen oder ungültig. Fordere einen neuen Link an.";
    }

    return message;

}


function setAccountMessage(text, isError) {

    const messageEl = document.getElementById("account-message");

    if (!messageEl) {
        return;
    }

    messageEl.textContent = text;
    messageEl.hidden = !text;
    messageEl.classList.toggle("account-message--error", Boolean(isError));

}


/* =====================================================
   5. DAS POP-UP-FENSTER BAUEN
   Wird - genau wie der Rucksack in sidebar.js - einmal per
   JavaScript erzeugt und an <body> gehängt.
   ===================================================== */

function createAccountPanel() {

    if (document.getElementById("account-panel")) {
        return;
    }

    const panel = document.createElement("div");
    panel.id = "account-panel";
    panel.hidden = true;

    panel.innerHTML = `
        <div id="account-panel-backdrop"></div>

        <div id="account-panel-card" role="dialog" aria-label="Konto">

            <button id="account-panel-close" type="button" aria-label="Schließen">✕</button>

            <h2>🔐 Konto</h2>

            <p class="account-intro">
                Du musst dich nicht registrieren, um zu spielen. Ohne Konto
                wird dein Fortschritt nur auf diesem Gerät gespeichert und
                kann verloren gehen. Mit einem kostenlosen Konto bleiben
                Münzen, Erfolge und Inventar dauerhaft erhalten.
            </p>

            <div id="account-logged-in" data-auth-only hidden>

                <p data-auth-status></p>

                <details class="account-change-section">

                    <summary>E-Mail ändern</summary>

                    <form id="account-change-email-form" class="account-form">

                        <input id="change-email-new" class="yj-input" type="email" placeholder="Neue E-Mail-Adresse" autocomplete="email" required>

                        <button type="submit" class="yj-button yj-button--compact">
                            E-Mail ändern
                        </button>

                    </form>

                </details>

                <details class="account-change-section">

                    <summary>Passwort ändern</summary>

                    <form id="account-change-password-form" class="account-form">

                        <input id="change-password-new" class="yj-input" type="password" placeholder="Neues Passwort (mind. 6 Zeichen)" autocomplete="new-password" minlength="6" required>
                        <input id="change-password-repeat" class="yj-input" type="password" placeholder="Neues Passwort wiederholen" autocomplete="new-password" minlength="6" required>

                        <button type="submit" class="yj-button yj-button--compact">
                            Passwort ändern
                        </button>

                    </form>

                </details>

                <button id="account-logout" type="button" class="yj-button yj-button--compact">
                    Abmelden
                </button>

            </div>

            <div id="account-guest" data-guest-only>

                <p data-auth-status></p>

                <div class="account-tabs">

                    <button id="account-tab-login" type="button" class="yj-button yj-button--compact account-tab is-active">
                        Anmelden
                    </button>

                    <button id="account-tab-signup" type="button" class="yj-button yj-button--compact account-tab">
                        Registrieren
                    </button>

                </div>

                <form id="account-login-form" class="account-form">

                    <input id="login-email" class="yj-input" type="email" placeholder="E-Mail" autocomplete="email" required>
                    <input id="login-password" class="yj-input" type="password" placeholder="Passwort" autocomplete="current-password" required>

                    <button id="account-forgot-password" type="button" class="account-forgot-link">
                        Passwort vergessen?
                    </button>

                    <button type="submit" class="yj-button yj-button--wide">
                        Anmelden
                    </button>

                </form>

                <form id="account-signup-form" class="account-form" hidden>

                    <input id="signup-email" class="yj-input" type="email" placeholder="E-Mail eines Elternteils" autocomplete="email" required>
                    <input id="signup-password" class="yj-input" type="password" placeholder="Passwort (mind. 6 Zeichen)" autocomplete="new-password" minlength="6" required>
                    <input id="signup-password-repeat" class="yj-input" type="password" placeholder="Passwort wiederholen" autocomplete="new-password" minlength="6" required>

                    <label class="account-consent">
                        <input type="checkbox" id="signup-consent" required>
                        Ich bin erziehungsberechtigt und stimme der
                        Erstellung dieses Kontos für mein Kind zu.
                    </label>

                    <button type="submit" class="yj-button yj-button--wide">
                        Konto erstellen
                    </button>

                </form>

                <form id="account-reset-form" class="account-form" hidden>

                    <p>Neues Passwort festlegen:</p>

                    <input id="reset-password" class="yj-input" type="password" placeholder="Neues Passwort (mind. 6 Zeichen)" autocomplete="new-password" minlength="6" required>

                    <input id="reset-password-repeat" class="yj-input" type="password" placeholder="Neues Passwort wiederholen" autocomplete="new-password" minlength="6" required>

                    <button type="submit" class="yj-button yj-button--wide">
                        Passwort speichern
                    </button>

                </form>

                <p id="account-message" class="account-message" hidden></p>

            </div>

        </div>
    `;

    document.body.appendChild(panel);

    wireAccountForms();

}


function openAccountPanel() {

    createAccountPanel();

    const panel = document.getElementById("account-panel");
    panel.hidden = false;

    updateAuthUI();

}


function closeAccountPanel() {

    const panel = document.getElementById("account-panel");

    if (panel) {
        panel.hidden = true;
    }

}


function showPasswordResetForm() {

    createAccountPanel();
    openAccountPanel();

    const loginForm = document.getElementById("account-login-form");
    const signupForm = document.getElementById("account-signup-form");
    const resetForm = document.getElementById("account-reset-form");
    const tabs = document.querySelector(".account-tabs");

    if (loginForm) loginForm.hidden = true;
    if (signupForm) signupForm.hidden = true;
    if (tabs) tabs.hidden = true;
    if (resetForm) resetForm.hidden = false;

    setAccountMessage(
        "Du kannst jetzt ein neues Passwort festlegen.",
        false
    );

}


/* =====================================================
   6. ICON IN DER SIDEBAR EINFÜGEN
   ===================================================== */

function createAccountIcon() {

    if (document.getElementById("account-open-button")) {
        return;
    }

    const avatarWrap = document.querySelector(".sidebar-avatar-wrap");

    if (!avatarWrap) {
        return;
    }

    const button = document.createElement("button");
    button.id = "account-open-button";
    button.type = "button";
    button.title = "Konto";
    button.setAttribute("aria-label", "Konto öffnen");
    button.innerHTML = '<img src="Icons/Sidebar/anmeldung.png" alt="" class="inventory-icon" decoding="async">';

    button.addEventListener("click", openAccountPanel);

    avatarWrap.appendChild(button);

}


/* =====================================================
   7. FORMULARE VERKABELN
   ===================================================== */

function wireAccountForms() {

    const loginTab = document.getElementById("account-tab-login");
    const signupTab = document.getElementById("account-tab-signup");
    const loginForm = document.getElementById("account-login-form");
    const signupForm = document.getElementById("account-signup-form");
    const resetForm = document.getElementById("account-reset-form");
    const changeEmailForm = document.getElementById("account-change-email-form");
    const changePasswordForm = document.getElementById("account-change-password-form");
    const logoutButton = document.getElementById("account-logout");
    const forgotButton = document.getElementById("account-forgot-password");
    const closeButton = document.getElementById("account-panel-close");
    const backdrop = document.getElementById("account-panel-backdrop");

    if (loginTab && signupTab && loginForm && signupForm) {

        loginTab.addEventListener("click", function () {

            loginTab.classList.add("is-active");
            signupTab.classList.remove("is-active");
            loginForm.hidden = false;
            signupForm.hidden = true;
            setAccountMessage("");

        });

        signupTab.addEventListener("click", function () {

            signupTab.classList.add("is-active");
            loginTab.classList.remove("is-active");
            signupForm.hidden = false;
            loginForm.hidden = true;
            setAccountMessage("");

        });

    }

    if (loginForm) {

        loginForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const email = document.getElementById("login-email").value.trim();
            const password = document.getElementById("login-password").value;

            setAccountMessage("Einen Moment …", false);

            const result = await signInAccount(email, password);

            if (result.error) {
                setAccountMessage(friendlyAuthError(result.error), true);
                return;
            }

            setAccountMessage("");
            loginForm.reset();
            closeAccountPanel();

        });

    }

    if (signupForm) {

        signupForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const email = document.getElementById("signup-email").value.trim();
            const password = document.getElementById("signup-password").value;
            const passwordRepeat = document.getElementById("signup-password-repeat").value;
            const consent = document.getElementById("signup-consent").checked;

            if (password !== passwordRepeat) {
                setAccountMessage("Die beiden Passwörter stimmen nicht überein.", true);
                return;
            }

            setAccountMessage("Einen Moment …", false);

            const result = await signUpAccount(email, password, consent);

            if (result.error) {
                setAccountMessage(friendlyAuthError(result.error), true);
                return;
            }

            if (result.needsConfirmation) {
                setAccountMessage(
                    "Fast geschafft! Bitte bestätige die E-Mail, die wir gerade geschickt haben, bevor du dich anmeldest.",
                    false
                );
                signupForm.reset();
                return;
            }

            setAccountMessage("");
            signupForm.reset();
            closeAccountPanel();

        });

    }

    if (resetForm) {

        resetForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const newPassword = document.getElementById("reset-password").value;
            const newPasswordRepeat = document.getElementById("reset-password-repeat").value;

            if (newPassword !== newPasswordRepeat) {
                setAccountMessage("Die beiden Passwörter stimmen nicht überein.", true);
                return;
            }

            setAccountMessage("Einen Moment …", false);

            const result = await setNewPassword(newPassword);

            if (result.error) {
                setAccountMessage(friendlyAuthError(result.error), true);
                return;
            }

            setAccountMessage("Passwort gespeichert! Du bist jetzt angemeldet.", false);
            resetForm.reset();
            resetForm.hidden = true;

            const tabs = document.querySelector(".account-tabs");
            const loginFormEl = document.getElementById("account-login-form");
            if (tabs) tabs.hidden = false;
            if (loginFormEl) loginFormEl.hidden = false;

            updateAuthUI();

        });

    }

    if (changeEmailForm) {

        changeEmailForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const newEmail = document.getElementById("change-email-new").value.trim();

            setAccountMessage("Einen Moment …", false);

            const result = await updateEmail(newEmail);

            if (result.error) {
                setAccountMessage(friendlyAuthError(result.error), true);
                return;
            }

            setAccountMessage(
                "Bestätige die neue Adresse über den Link, den wir dir geschickt haben.",
                false
            );
            changeEmailForm.reset();

        });

    }

    if (changePasswordForm) {

        changePasswordForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const newPassword = document.getElementById("change-password-new").value;
            const newPasswordRepeat = document.getElementById("change-password-repeat").value;

            if (newPassword !== newPasswordRepeat) {
                setAccountMessage("Die beiden Passwörter stimmen nicht überein.", true);
                return;
            }

            setAccountMessage("Einen Moment …", false);

            const result = await setNewPassword(newPassword);

            if (result.error) {
                setAccountMessage(friendlyAuthError(result.error), true);
                return;
            }

            setAccountMessage("Passwort geändert!", false);
            changePasswordForm.reset();

        });

    }

    if (forgotButton) {

        forgotButton.addEventListener("click", async function () {

            const email = document.getElementById("login-email").value.trim();

            if (!email) {
                setAccountMessage("Bitte trag zuerst deine E-Mail-Adresse oben ein.", true);
                return;
            }

            setAccountMessage("Einen Moment …", false);

            const result = await requestPasswordReset(email);

            if (result.error) {
                setAccountMessage(friendlyAuthError(result.error), true);
                return;
            }

            setAccountMessage(
                "Falls diese E-Mail-Adresse registriert ist, haben wir dir einen Link zum Zurücksetzen geschickt.",
                false
            );

        });

    }

    if (logoutButton) {

        logoutButton.addEventListener("click", function () {

            signOutAccount();

        });

    }

    if (closeButton) {
        closeButton.addEventListener("click", closeAccountPanel);
    }

    if (backdrop) {
        backdrop.addEventListener("click", closeAccountPanel);
    }

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {
            closeAccountPanel();
        }

    });

}


/* =====================================================
   8. START
   ===================================================== */

async function initAuth() {

    createAccountIcon();

    if (!supabaseClient) {
        return;
    }

    const { data } = await supabaseClient.auth.getSession();

    currentSession = data.session;

    if (currentSession) {
        await pullProfileFromCloud();
    }

    supabaseClient.auth.onAuthStateChange(function (event, session) {

        currentSession = session;

        if (event === "PASSWORD_RECOVERY") {
            isPasswordRecovery = true;
            showPasswordResetForm();
        }

        updateAuthUI();

    });

}


document.addEventListener("DOMContentLoaded", initAuth);


/* Nach jeder lokalen Änderung (Münzen, Erfolge, ...)
   automatisch in die Cloud sichern, falls angemeldet. */

window.addEventListener("player-updated", function () {

    if (isLoggedIn()) {
        pushProfileToCloud();
    }

});
