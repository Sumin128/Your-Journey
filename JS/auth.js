/* =====================================================
   AUTH.JS
   Optionaler Konto-Sync (Supabase) für Your Journey.

   Wichtig: Die App funktioniert weiterhin komplett OHNE
   Konto - dieses Modul kommt nur oben drauf und synchronisiert
   Federn, Erfolge und Inventar, falls sich jemand freiwillig
   registriert. Ohne Konto bleibt alles wie bisher rein lokal
   in localStorage (siehe JS/player.js).
   ===================================================== */

const SUPABASE_URL = "https://mcfsfynceaajsflmrxzg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l78-VbeEioCEeLuRyiLTZg_Na79qEJJ";

const supabaseClient =
    (typeof supabase !== "undefined")
        ? supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
        : null;

let currentSession = null;


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

    await supabaseClient
        .from("profiles")
        .update({
            player_data: player,
            updated_at: new Date().toISOString()
        })
        .eq("id", currentSession.user.id);

}


async function pullProfileFromCloud() {

    if (!supabaseClient || !currentSession) {
        return;
    }

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select("player_data")
            .eq("id", currentSession.user.id)
            .single();

    if (error || !data) {
        return;
    }

    const cloudData = data.player_data || {};

    if (Object.keys(cloudData).length > 0) {

        /* Konto existiert schon und hat Daten:
           Cloud-Stand gewinnt, damit alle Geräte denselben
           Stand zeigen. */

        player = Object.assign({}, player, cloudData);

        savePlayer();
        updatePlayerUI();
        applyCursor();

    } else {

        /* Erstes Login nach Registrierung, Cloud ist noch leer:
           aktuellen lokalen Stand hochladen. */

        await pushProfileToCloud();

    }

}


/* =====================================================
   3. ANMELDEN / REGISTRIEREN / ABMELDEN
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
                data: { parental_consent: true }
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

    await pushProfileToCloud();
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

    updateAuthUI();

}


/* =====================================================
   4. UI AKTUALISIEREN
   Funktioniert auf jeder Seite, auf der diese
   data-Attribute existieren (aktuell: Einstellungen).
   ===================================================== */

function updateAuthUI() {

    document.querySelectorAll("[data-auth-status]").forEach(function (el) {

        el.textContent = isLoggedIn()
            ? "Angemeldet als " + currentSession.user.email
            : "Nicht angemeldet – dein Fortschritt wird nur lokal auf diesem Gerät gespeichert.";

    });

    document.querySelectorAll("[data-auth-only]").forEach(function (el) {
        el.hidden = !isLoggedIn();
    });

    document.querySelectorAll("[data-guest-only]").forEach(function (el) {
        el.hidden = isLoggedIn();
    });

}


/* =====================================================
   5. FORMULARE VERKABELN (nur falls auf der Seite vorhanden)
   ===================================================== */

function setAccountMessage(text, isError) {

    const messageEl = document.getElementById("account-message");

    if (!messageEl) {
        return;
    }

    messageEl.textContent = text;
    messageEl.hidden = !text;
    messageEl.classList.toggle("account-message--error", Boolean(isError));

}


function wireAccountForms() {

    const loginTab = document.getElementById("account-tab-login");
    const signupTab = document.getElementById("account-tab-signup");
    const loginForm = document.getElementById("account-login-form");
    const signupForm = document.getElementById("account-signup-form");
    const logoutButton = document.getElementById("account-logout");

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
                setAccountMessage(result.error, true);
                return;
            }

            setAccountMessage("");
            loginForm.reset();

        });

    }

    if (signupForm) {

        signupForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const email = document.getElementById("signup-email").value.trim();
            const password = document.getElementById("signup-password").value;
            const consent = document.getElementById("signup-consent").checked;

            setAccountMessage("Einen Moment …", false);

            const result = await signUpAccount(email, password, consent);

            if (result.error) {
                setAccountMessage(result.error, true);
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

        });

    }

    if (logoutButton) {

        logoutButton.addEventListener("click", function () {

            signOutAccount();

        });

    }

}


/* =====================================================
   6. START
   ===================================================== */

async function initAuth() {

    wireAccountForms();

    if (!supabaseClient) {
        updateAuthUI();
        return;
    }

    const { data } = await supabaseClient.auth.getSession();

    currentSession = data.session;

    if (currentSession) {
        await pullProfileFromCloud();
    }

    updateAuthUI();

    supabaseClient.auth.onAuthStateChange(function (event, session) {

        currentSession = session;
        updateAuthUI();

    });

}


document.addEventListener("DOMContentLoaded", initAuth);


/* Nach jeder lokalen Änderung (Federn, Erfolge, ...)
   automatisch in die Cloud sichern, falls angemeldet. */

window.addEventListener("player-updated", function () {

    if (isLoggedIn()) {
        pushProfileToCloud();
    }

});
