/* =====================================================
   MY-DRAWINGS.JS
   Zeigt die eigenen, in der Malstube gespeicherten Bilder
   in der Galerie an - immer nur die eigenen (Supabase RLS
   filtert serverseitig zusätzlich auf user_id), niemals
   die Bilder anderer Nutzer.

   Rotations-Regel: es werden immer bis zu 4 Bilder gezeigt,
   aber ein neues Bild verdrängt ein angezeigtes erst, wenn
   dieses mindestens MIN_DISPLAY_HOURS Stunden sichtbar war.
   Das lässt sich rein aus den created_at-Zeitstempeln aller
   gespeicherten Bilder berechnen (siehe computeDisplayedDrawings),
   ohne einen zusätzlichen Datenbank-Status zu brauchen.
   ===================================================== */

(function setupMyDrawings() {

    const grid = document.getElementById("my-drawings-grid");

    if (!grid || typeof supabaseClient === "undefined" || !supabaseClient) {
        return;
    }

    /* Wie viele Stunden ein Bild mindestens sichtbar bleibt,
       bevor ein neueres Bild es aus den 4 Boxen verdrängen darf.
       Kann hier einfach angepasst werden. */

    const MIN_DISPLAY_HOURS = 24;


    /* =====================================================
       1. ROTATIONS-REGEL
       ===================================================== */

    function computeDisplayedDrawings(drawingsAscendingByCreatedAt) {

        const displayed = [];

        drawingsAscendingByCreatedAt.forEach(function (drawing) {

            if (displayed.length < 4) {
                displayed.push(drawing);
                return;
            }

            const oldest = displayed[0];

            const oldestAgeHours =
                (new Date(drawing.created_at) - new Date(oldest.created_at)) / 3600000;

            if (oldestAgeHours >= MIN_DISPLAY_HOURS) {
                displayed.shift();
                displayed.push(drawing);
            }

        });

        return displayed.slice().reverse();

    }


    /* =====================================================
       2. ANZEIGE
       ===================================================== */

    function setMyDrawingsMessage(text, isError) {

        const messageEl = document.getElementById("my-drawings-message");

        if (!messageEl) {
            return;
        }

        messageEl.textContent = text;
        messageEl.hidden = !text;
        messageEl.classList.toggle("account-message--error", Boolean(isError));

    }

    function renderEmptyBox(box, isGuest) {

        box.classList.add("my-drawing-box--empty");

        if (isGuest) {

            box.innerHTML =
                "<p>Melde dich an, um hier deine gemalten Bilder zu sehen.</p>";

        } else {

            box.innerHTML =
                '<p>Noch kein Bild – mal doch eins in der Malstube!</p>' +
                '<a href="malen.html" class="yj-button yj-button--compact">🎨 Zur Malstube</a>';

        }

    }

    async function renderDrawings(drawings) {

        const boxes = grid.querySelectorAll(".my-drawing-box");

        const signedUrls = await Promise.all(
            drawings.map(function (drawing) {

                return supabaseClient.storage
                    .from("drawings")
                    .createSignedUrl(drawing.storage_path, 3600)
                    .then(function (result) {
                        return result.data ? result.data.signedUrl : null;
                    })
                    .catch(function () {
                        return null;
                    });

            })
        );

        boxes.forEach(function (box, index) {

            box.classList.remove("my-drawing-box--empty");
            box.innerHTML = "";

            const drawing = drawings[index];
            const url = signedUrls[index];

            if (!drawing || !url) {
                renderEmptyBox(box, false);
                return;
            }

            const img = document.createElement("img");
            img.src = url;
            img.alt = "Eigenes gemaltes Bild";
            img.loading = "lazy";

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "yj-button yj-button--compact my-drawing-delete-button";
            deleteButton.setAttribute("aria-label", "Bild löschen");
            deleteButton.dataset.drawingId = drawing.id;
            deleteButton.dataset.storagePath = drawing.storage_path;
            deleteButton.textContent = "🗑️";

            box.appendChild(img);
            box.appendChild(deleteButton);

        });

    }

    function renderGuestState() {

        const guestHint = document.getElementById("my-drawings-guest-hint");

        if (guestHint) {
            guestHint.hidden = false;
        }

        const boxes = grid.querySelectorAll(".my-drawing-box");

        boxes.forEach(function (box) {
            box.classList.remove("my-drawing-box--empty");
            box.innerHTML = "";
            renderEmptyBox(box, true);
        });

    }


    /* =====================================================
       3. DATEN LADEN
       ===================================================== */

    async function loadMyDrawings() {

        const sessionResult = await supabaseClient.auth.getSession();
        const session = sessionResult.data.session;

        if (!session) {
            renderGuestState();
            return;
        }

        const guestHint = document.getElementById("my-drawings-guest-hint");

        if (guestHint) {
            guestHint.hidden = true;
        }

        try {

            const queryResult =
                await supabaseClient
                    .from("drawings")
                    .select("id, storage_path, created_at")
                    .eq("user_id", session.user.id)
                    .order("created_at", { ascending: true });

            if (queryResult.error || !queryResult.data) {

                const boxes = grid.querySelectorAll(".my-drawing-box");
                boxes.forEach(function (box) {
                    renderEmptyBox(box, false);
                });

                return;

            }

            const displayed = computeDisplayedDrawings(queryResult.data);

            await renderDrawings(displayed);

        } catch (error) {

            const boxes = grid.querySelectorAll(".my-drawing-box");
            boxes.forEach(function (box) {
                renderEmptyBox(box, false);
            });

        }

    }

    /* =====================================================
       4. BILD LÖSCHEN
       Bewusste Nutzer-Aktion - darf die MIN_DISPLAY_HOURS-
       Mindestanzeigezeit umgehen, die nur für das automatische
       Verdrängen durch neue Bilder gilt (siehe Regel oben).
       ===================================================== */

    async function deleteDrawing(button) {

        const confirmed = confirm("Dieses Bild wirklich löschen? Das kann nicht rückgängig gemacht werden.");

        if (!confirmed) {
            return;
        }

        const drawingId = button.dataset.drawingId;
        const storagePath = button.dataset.storagePath;

        button.disabled = true;

        await supabaseClient.storage.from("drawings").remove([storagePath]);

        const deleteResult =
            await supabaseClient
                .from("drawings")
                .delete()
                .eq("id", drawingId);

        if (deleteResult.error) {
            setMyDrawingsMessage("Löschen fehlgeschlagen: " + deleteResult.error.message, true);
            button.disabled = false;
            return;
        }

        setMyDrawingsMessage("Bild gelöscht.", false);

        loadMyDrawings();

    }

    grid.addEventListener("click", function (event) {

        const button = event.target.closest(".my-drawing-delete-button");

        if (!button) {
            return;
        }

        deleteDrawing(button);

    });


    loadMyDrawings();

    supabaseClient.auth.onAuthStateChange(function () {
        loadMyDrawings();
    });

})();
