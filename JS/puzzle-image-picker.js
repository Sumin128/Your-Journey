/* =====================================================
   PUZZLE-IMAGE-PICKER.JS
   Modal zur Bildauswahl fuer das Puzzle: entweder eigene,
   in der Malstube gespeicherte Bilder (aus Supabase, wie in
   my-drawings.js) oder feste Bilder aus der Galerie der
   Webseite. Ruft bei Auswahl window.MirelonPuzzle.setSourceImage
   auf (siehe puzzle.js).
   ===================================================== */

(function setupPuzzleImagePicker() {

    const overlay = document.getElementById("imagePickerOverlay");
    const openBtn = document.getElementById("galleryPickBtn");
    const closeBtn = document.getElementById("imagePickerClose");
    const mineGrid = document.getElementById("imagePickerMineGrid");
    const mineHint = document.getElementById("imagePickerMineHint");
    const siteGrid = document.getElementById("imagePickerSiteGrid");

    if (!overlay || !openBtn) {
        return;
    }

    // Die gleichen Bilder wie auf der Galerie-Seite (galerie.html).
    const SITE_IMAGES = [
        { label: "Übersichtskarte", src: "images/startseite_v4.png" },
        { label: "Kuros Nest", src: "images/kuros_nest_final.png" },
        { label: "Hoppels Hasenbau", src: "images/eulenschule.png" },
        { label: "Faros Fuchsbau", src: "images/faros_fuchsbau3.png" },
        { label: "Bärental", src: "images/baerenthal.png" },
        { label: "Luis", src: "images/luis_chameleon.png" },
    ];

    function createThumb(src, label, isGalleryImage) {

        const button = document.createElement("button");
        button.type = "button";
        button.className = "image-picker-thumb";

        const img = document.createElement("img");
        img.src = src;
        img.alt = label;
        img.loading = "lazy";

        const caption = document.createElement("span");
        caption.textContent = label;

        button.appendChild(img);
        button.appendChild(caption);

        button.addEventListener("click", function () {

            if (window.MirelonPuzzle && window.MirelonPuzzle.setSourceImage) {
                window.MirelonPuzzle.setSourceImage(src, label, { isGalleryImage: Boolean(isGalleryImage) });
            }

            closeOverlay();

        });

        return button;

    }

    function renderSiteGrid() {

        siteGrid.innerHTML = "";

        SITE_IMAGES.forEach(function (entry) {
            siteGrid.appendChild(createThumb(entry.src, entry.label, true));
        });

    }

    async function renderMineGrid() {

        mineGrid.innerHTML = "";
        mineHint.hidden = true;

        if (typeof supabaseClient === "undefined" || !supabaseClient) {
            mineHint.textContent = "Melde dich an, um eigene Bilder zu nutzen.";
            mineHint.hidden = false;
            return;
        }

        const sessionResult = await supabaseClient.auth.getSession();
        const session = sessionResult.data.session;

        if (!session) {
            mineHint.textContent = "Melde dich an, um deine gemalten Bilder hier zu sehen.";
            mineHint.hidden = false;
            return;
        }

        const queryResult =
            await supabaseClient
                .from("drawings")
                .select("id, storage_path, created_at")
                .eq("user_id", session.user.id)
                .order("created_at", { ascending: false });

        if (queryResult.error || !queryResult.data || !queryResult.data.length) {
            mineHint.textContent = "Noch kein Bild – mal doch eins in der Malstube!";
            mineHint.hidden = false;
            return;
        }

        const signedUrls = await Promise.all(
            queryResult.data.map(function (drawing) {

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

        queryResult.data.forEach(function (drawing, index) {

            const url = signedUrls[index];

            if (!url) {
                return;
            }

            mineGrid.appendChild(createThumb(url, "Eigenes Bild"));

        });

        if (!mineGrid.children.length) {
            mineHint.textContent = "Noch kein Bild – mal doch eins in der Malstube!";
            mineHint.hidden = false;
        }

    }

    function openOverlay() {

        overlay.classList.add("show");
        renderSiteGrid();
        renderMineGrid();

    }

    function closeOverlay() {
        overlay.classList.remove("show");
    }

    openBtn.addEventListener("click", openOverlay);
    closeBtn.addEventListener("click", closeOverlay);

    overlay.addEventListener("click", function (event) {

        if (event.target === overlay) {
            closeOverlay();
        }

    });

    window.addEventListener("keydown", function (event) {

        if (event.key === "Escape" && overlay.classList.contains("show")) {
            closeOverlay();
        }

    });

})();
