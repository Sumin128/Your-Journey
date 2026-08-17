/* =====================================================
   MAP POPUP (Index.html)
   Öffnet das Kartenbild in einem kleinen Modal beim Klicken
   ===================================================== */

(function setupMapModal() {

const mapImages = document.querySelectorAll('.map-image');
    const mapModal = document.getElementById('map-modal');
    const mapModalImg = document.getElementById('map-modal-img');
    const mapModalClose = document.getElementById('map-modal-close');

    if (mapImages.length === 0 || !mapModal) {
        console.warn('Map modal not initialized: missing elements', { mapImages, mapModal });
        return;
    }

    console.log('Map modal initialized', { mapImages, mapModal, mapModalImg, mapModalClose });

    // Klick auf kleine Karte öffnet Modal
    // Klick auf ein Bild öffnet das Modal
mapImages.forEach(function (image) {

    image.style.cursor = 'pointer';

    image.addEventListener('click', function () {

        mapModalImg.src = image.src;

        mapModal.classList.add('open');

    });

});

   

    // Schließen per Button
    if (mapModalClose) {
        mapModalClose.addEventListener('click', function () {
            mapModal.classList.remove('open');
        });
    }

    // Schließen per Klick außerhalb des Inhalts
    mapModal.addEventListener('click', function (e) {
        if (e.target === mapModal) {
            mapModal.classList.remove('open');
        }
    });

    // Schließen per Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            mapModal.classList.remove('open');
        }
    });

})();
