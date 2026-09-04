/* =====================================================
   MY-DRAWINGS.JS
   Zeigt die eigenen, in der Malstube gespeicherten Bilder
   in der Galerie an - immer nur die eigenen (Supabase RLS
   filtert serverseitig zusätzlich auf user_id).

   Drei Zustände:
   - Gast:        eine Aufforderung zum Anmelden (kein Raster)
   - angemeldet, keine Bilder: eine Aufforderung "ab in die Malstube"
   - angemeldet mit Bildern:   ein Raster der echten Bilder (bis 8
     pro Seite, neueste zuerst), Klick zoomt, Mülleimer löscht
   ===================================================== */

(function setupMyDrawings() {

    const grid = document.getElementById("my-drawings-grid");
    const emptyEl = document.getElementById("my-drawings-empty");
    const pagination = document.getElementById("my-drawings-pagination");
    const prevButton = document.getElementById("my-drawings-prev");
    const nextButton = document.getElementById("my-drawings-next");
    const pageLabel = document.getElementById("my-drawings-page-label");

    if (!grid || !emptyEl || typeof supabaseClient === "undefined" || !supabaseClient) {
        return;
    }

    const PAGE_SIZE = 8;

    let allDrawings = [];
    let currentPage = 0;


    function setMyDrawingsMessage(text, isError) {

        const messageEl = document.getElementById("my-drawings-message");

        if (!messageEl) {
            return;
        }

        messageEl.textContent = text;
        messageEl.hidden = !text;
        messageEl.classList.toggle("account-message--error", Boolean(isError));

    }

    function showState(html) {

        grid.hidden = true;
        grid.innerHTML = "";
        pagination.hidden = true;

        emptyEl.hidden = false;
        emptyEl.innerHTML = html;

    }

    function showGuestState() {

        showState(
            '<div class="gallery-cta">' +
            '<span class="gallery-cta-icon" aria-hidden="true">🔒</span>' +
            '<p>Mit einem kostenlosen Konto sammelst du deine gemalten Bilder hier – auch auf einem anderen Gerät.</p>' +
            '<button type="button" class="yj-button" id="my-drawings-login">Anmelden</button>' +
            '</div>'
        );

        const loginBtn = document.getElementById("my-drawings-login");

        if (loginBtn) {
            loginBtn.addEventListener("click", function () {
                if (typeof openAccountPanel === "function") {
                    openAccountPanel();
                }
            });
        }

    }

    function showEmptyState() {

        showState(
            '<div class="gallery-cta">' +
            '<span class="gallery-cta-icon" aria-hidden="true">🎨</span>' +
            '<p>Noch kein Bild gespeichert. Mal eins in der Malstube!</p>' +
            '<a href="malen.html" class="yj-button">Zur Malstube</a>' +
            '</div>'
        );

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

        emptyEl.hidden = true;
        emptyEl.innerHTML = "";
        grid.hidden = false;
        grid.innerHTML = "";

        pageDrawings.forEach(function (drawing, index) {

            const url = signedUrls[index];

            if (!url) {
                return;
            }

            const card = document.createElement("figure");
            card.className = "gallery-card gallery-card--mine";
            card.dataset.full = url;
            card.tabIndex = 0;
            card.setAttribute("role", "button");
            card.setAttribute("aria-label", "Eigenes Bild ansehen");

            const img = document.createElement("img");
            img.src = url;
            img.alt = "Eigenes gemaltes Bild";
            img.className = "gallery-card-img";
            img.loading = "lazy";

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "my-drawing-delete-button";
            deleteButton.setAttribute("aria-label", "Bild löschen");
            deleteButton.dataset.drawingId = drawing.id;
            deleteButton.dataset.storagePath = drawing.storage_path;
            deleteButton.textContent = "🗑️";

            card.appendChild(img);
            card.appendChild(deleteButton);
            grid.appendChild(card);

        });

        updatePaginationControls();

    }


    async function loadMyDrawings() {

        const sessionResult = await supabaseClient.auth.getSession();
        const session = sessionResult.data.session;

        if (!session) {
            showGuestState();
            return;
        }

        try {

            const queryResult =
                await supabaseClient
                    .from("drawings")
                    .select("id, storage_path, created_at")
                    .eq("user_id", session.user.id)
                    .order("created_at", { ascending: false });

            if (queryResult.error || !queryResult.data) {
                showEmptyState();
                return;
            }

            allDrawings = queryResult.data;

            if (allDrawings.length === 0) {
                showEmptyState();
                return;
            }

            const totalPages = Math.max(1, Math.ceil(allDrawings.length / PAGE_SIZE));
            currentPage = Math.min(currentPage, totalPages - 1);

            await renderCurrentPage();

        } catch (error) {
            showEmptyState();
        }

    }


    async function deleteDrawing(button) {

        const confirmed = await (typeof showMirelonConfirm === "function"
            ? showMirelonConfirm("Dieses Bild wirklich löschen? Das kann nicht rückgängig gemacht werden.")
            : Promise.resolve(confirm("Dieses Bild wirklich löschen?")));

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

        if (button) {
            event.stopPropagation();
            deleteDrawing(button);
        }

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
