/* =====================================================
   BUG-MELDER
   Schwebender Marienkäfer-Button, der auf jeder Seite
   per JavaScript erzeugt wird. Öffnet ein kleines
   Formular und speichert die Meldung in Supabase (Tabelle
   "bugs"). Nutzt den globalen supabaseClient aus JS/auth.js,
   das auf jeder Seite schon vor diesem Skript geladen wird -
   keine eigene Supabase-Verbindung noetig.
   ===================================================== */

function createBugReporter() {

    if (document.getElementById("bug-reporter")) {
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = "bug-reporter";

    wrapper.innerHTML = `
        <div id="bug-reporter-panel" hidden>

            <h3><img src="Icons/bug_reporter.png" alt="" class="bug-reporter-icon" loading="lazy" decoding="async"> Bug melden</h3>

            <label for="bug-reporter-type">Was ist los?</label>
            <select id="bug-reporter-type">
                <option value="Darstellung / Optik">Darstellung / Optik</option>
                <option value="Funktion kaputt">Funktion kaputt</option>
                <option value="Rechtschreibung">Rechtschreibung</option>
                <option value="Idee / Vorschlag">Idee / Vorschlag</option>
                <option value="Sonstiges">Sonstiges</option>
            </select>

            <label for="bug-reporter-text">Kurz beschreiben</label>
            <textarea
                id="bug-reporter-text"
                rows="4"
                placeholder="Was ist passiert?"></textarea>

            <p id="bug-reporter-status" aria-live="polite"></p>

            <div id="bug-reporter-actions">
                <button id="bug-reporter-cancel" type="button" class="yj-button yj-button--secondary yj-button--compact">
                    Abbrechen
                </button>
                <button id="bug-reporter-send" type="button" class="yj-button yj-button--compact">
                    Senden
                </button>
            </div>

        </div>

        <button id="bug-reporter-toggle" type="button" aria-label="Bug melden">
            <img src="Icons/bug_reporter.png" alt="" decoding="async">
        </button>
    `;

    document.body.appendChild(wrapper);


    const toggleButton = document.getElementById("bug-reporter-toggle");
    const panel = document.getElementById("bug-reporter-panel");
    const cancelButton = document.getElementById("bug-reporter-cancel");
    const sendButton = document.getElementById("bug-reporter-send");
    const typeSelect = document.getElementById("bug-reporter-type");
    const textField = document.getElementById("bug-reporter-text");
    const statusText = document.getElementById("bug-reporter-status");


    toggleButton.addEventListener("click", function () {
        panel.hidden = !panel.hidden;

        if (!panel.hidden) {
            textField.focus();
        }
    });

    cancelButton.addEventListener("click", function () {
        panel.hidden = true;
    });


    function resetAndClose() {

        textField.value = "";

        setTimeout(function () {
            panel.hidden = true;
            statusText.textContent = "";
        }, 1500);

    }


    sendButton.addEventListener("click", function () {

        const type = typeSelect.value;
        const text = textField.value.trim();

        if (!text) {
            textField.focus();
            return;
        }

        sendButton.disabled = true;
        statusText.textContent = "Sende...";

        (async function () {

            const { error } = await supabaseClient
                .from("bugs")
                .insert([
                    {
                        title: type,
                        description: text,
                        category: type,
                        email: "",
                        browser: navigator.userAgent,
                        device: navigator.platform,
                        url: location.href
                    }
                ]);

            if (error) {
                throw error;
            }

            statusText.textContent = "Danke! Dein Bug wurde gemeldet. 🐞";
            resetAndClose();

        })()
            .catch(function (error) {
                console.error(error);
                statusText.textContent = "Fehler beim Senden.";
            })
            .finally(function () {
                sendButton.disabled = false;
            });

    });

}

createBugReporter();
