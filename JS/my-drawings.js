/* =====================================================
   MY-DRAWINGS.JS
   Zeigt die eigenen, in der Malstube gespeicherten Bilder
   in der Galerie an - immer nur die eigenen (Supabase RLS
   filtert serverseitig zusätzlich auf user_id), niemals
   die Bilder anderer Nutzer.

   Zeigt bis zu 4 Bilder pro Seite (neueste zuerst). Wer mehr
   als 4 Bilder gespeichert hat, blättert über "Weiter"/
   "Zurück" zur nächsten Seite, statt dass ältere Bilder
   automatisch verdrängt werden.
   ===================================================== */

(function setupMyDrawings() {

    const grid = document.getElementById("my-drawings-grid");
    const pagination = document.getElementById("my-drawings-pagination");
    const prevButton = document.getElementById("my-drawings-prev");
    const nextButton = document.getElementById("my-drawings-next");
    const pageLabel = document.getElementById("my-drawings-page-label");

    if (!grid || typeof supabaseClient === "undefined" || !supabaseClient) {
        return;
    }

    const PAGE_SIZE = 4;

    let allDrawings = [];
    let currentPage = 0;


    /* =====================================================
       1. ANZEIGE
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

    function updatePaginationControls() {

        const totalPages = Math.max(1, Math.ceil(allDrawings.length / PAGE_SIZE));

        if (totalPages <= 1) {
            pagination.hidden = true;
            return;
        }

        pagination.hidden = false;
        pageLabel.textContent = "Seite " + (currentPage + 1) + " von " + totalPages;
        prevButton.disabled = currentPage === 0;
        nextButton.disabled = currentPage >= totalPages - 1;

    }

    async function renderCurrentPage() {

        const boxes = grid.querySelectorAll(".my-drawing-box");
        const pageStart = currentPage * PAGE_SIZE;
        const pageDrawings = allDrawings.slice(pageStart, pageStart + PAGE_SIZE);

        const signedUrls = await Promise.all(
            pageDrawings.map(function (drawing) {

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

            const drawing = pageDrawings[index];
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

        updatePaginationControls();

    }

    function renderGuestState() {

        const guestHint = document.getElementById("my-drawings-guest-hint");

        if (guestHint) {
            guestHint.hidden = false;
        }

        pagination.hidden = true;

        const boxes = grid.querySelectorAll(".my-drawing-box");
        boxes.forEach(function (box) {
            box.classList.remove("my-drawing-box--empty");
            box.innerHTML = "";
            renderEmptyBox(box, true);
        });

    }


    /* =====================================================
       2. DATEN LADEN
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
                    .order("created_at", { ascending: false });

            if (queryResult.error || !queryResult.data) {

                const boxes = grid.querySelectorAll(".my-drawing-box");
                boxes.forEach(function (box) {
                    renderEmptyBox(box, false);
                });

                return;

            }

            allDrawings = queryResult.data;
            const totalPages = Math.max(1, Math.ceil(allDrawings.length / PAGE_SIZE));
            currentPage = Math.min(currentPage, totalPages - 1);

            await renderCurrentPage();

        } catch (error) {

            const boxes = grid.querySelectorAll(".my-drawing-box");
            boxes.forEach(function (box) {
                renderEmptyBox(box, false);
            });

        }

    }


    /* =====================================================
       3. BILD LÖSCHEN
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

    prevButton.addEventListener("click", function () {

        if (currentPage === 0) {
            return;
        }

        currentPage -= 1;
        renderCurrentPage();

    });

    nextButton.addEventListener("click", function () {

        const totalPages = Math.max(1, Math.ceil(allDrawings.length / PAGE_SIZE));

        if (currentPage >= totalPages - 1) {
            return;
        }

        currentPage += 1;
        renderCurrentPage();

    });


    loadMyDrawings();

    supabaseClient.auth.onAuthStateChange(function () {
        currentPage = 0;
        loadMyDrawings();
    });

})();
