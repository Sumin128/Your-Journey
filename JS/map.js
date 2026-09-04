/* =====================================================
   GALERIE-LIGHTBOX
   Klick auf eine .gallery-card (Welt-Bild oder eigenes
   Bild) öffnet es gross im #map-modal. Delegiert, damit
   auch nachträglich eingefügte eigene Bilder funktionieren.
   ===================================================== */

(function setupGalleryLightbox() {

    const modal = document.getElementById("map-modal");
    const modalImg = document.getElementById("map-modal-img");
    const closeButton = document.getElementById("map-modal-close");
    const main = document.getElementById("gallery-main");

    if (!modal || !modalImg || !main) {
        return;
    }

    function openCard(card) {

        const full = card.dataset.full || (card.querySelector("img") && card.querySelector("img").src);

        if (!full) {
            return;
        }

        modalImg.src = full;
        modal.classList.add("open");

    }

    function close() {
        modal.classList.remove("open");
        modalImg.src = "";
    }

    main.addEventListener("click", function (event) {

        if (event.target.closest(".my-drawing-delete-button")) {
            return;
        }

        const card = event.target.closest(".gallery-card");

        if (card) {
            openCard(card);
        }

    });

    main.addEventListener("keydown", function (event) {

        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        const card = event.target.closest(".gallery-card");

        if (card) {
            event.preventDefault();
            openCard(card);
        }

    });

    if (closeButton) {
        closeButton.addEventListener("click", close);
    }

    modal.addEventListener("click", function (event) {
        if (event.target === modal) {
            close();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            close();
        }
    });

})();
