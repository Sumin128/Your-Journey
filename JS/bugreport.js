/* =====================================================
   BUG-MELDER
   Schwebender Marienkäfer-Button, der auf jeder Seite
   per JavaScript erzeugt wird. Öffnet ein kleines
   Formular und verschickt die Meldung automatisch
   per Formspree (Fallback: E-Mail-Programm).
   ===================================================== */

const BUG_REPORT_EMAIL = "simon.walbroehl@gmail.com";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/meajrbwv";

function createBugReporter() {

    if (document.getElementById("bug-reporter")) {
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = "bug-reporter";

    wrapper.innerHTML = `
        <div id="bug-reporter-panel" hidden>

            <h3><img src="Icons/bug_reporter.png" alt="" class="bug-reporter-icon"> Bug melden</h3>

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
            <img src="Icons/bug_reporter.png" alt="">
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


    function buildReportText(type, text) {

        return "Typ: " + type + "\n" +
            "Seite: " + document.title + "\n" +
            "Link: " + location.href + "\n\n" +
            "Beschreibung:\n" + text;

    }

    function sendViaMailto(type, text) {

        const subject = "Mirelon – Bug: " + type;

        const mailtoLink =
            "mailto:" + BUG_REPORT_EMAIL +
            "?subject=" + encodeURIComponent(subject) +
            "&body=" + encodeURIComponent(buildReportText(type, text));

        window.location.href = mailtoLink;

    }

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

        fetch(FORMSPREE_ENDPOINT, {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            body: JSON.stringify({
                type: type,
                message: text,
                page: document.title,
                url: location.href
            })

        })
            .then(function (response) {

                if (!response.ok) {
                    throw new Error("Formspree Fehler");
                }

                statusText.textContent = "Danke! Dein Bug wurde gemeldet. 🐞";

                resetAndClose();

            })
            .catch(function () {

                statusText.textContent = "Versand fehlgeschlagen – öffne E-Mail-Programm...";

                sendViaMailto(type, text);

                resetAndClose();

            })
            .finally(function () {

                sendButton.disabled = false;

            });

    });

}

createBugReporter();
