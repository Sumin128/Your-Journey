/* =====================================================
   GALERIE-LIKES
   Jede:r Besucher:in kann ein Bild liken. Karten mit
   den meisten Likes werden zuerst angezeigt.
   ===================================================== */

(function setupGalleryLikes() {

    const grid = document.getElementById('gallery-grid');

    if (!grid) {
        return;
    }

    const LIKES_KEY = 'yj-gallery-likes';
    const LIKED_BY_ME_KEY = 'yj-gallery-liked-by-me';

    const cards = Array.from(grid.querySelectorAll('.map-card'));

    // Ursprüngliche Reihenfolge merken, damit bei Gleichstand
    // die Karten nicht wild durcheinander springen.
    cards.forEach(function (card, index) {
        card.dataset.originalOrder = index;
    });

    function loadLikes() {
        try {
            return JSON.parse(localStorage.getItem(LIKES_KEY)) || {};
        } catch (error) {
            return {};
        }
    }

    function saveLikes(likes) {
        localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
    }

    function loadLikedByMe() {
        try {
            return JSON.parse(localStorage.getItem(LIKED_BY_ME_KEY)) || [];
        } catch (error) {
            return [];
        }
    }

    function saveLikedByMe(likedList) {
        localStorage.setItem(LIKED_BY_ME_KEY, JSON.stringify(likedList));
    }

    function sortGallery(likes) {

        const sortedCards = cards.slice().sort(function (a, b) {

            const likesA = likes[a.dataset.mapId] || 0;
            const likesB = likes[b.dataset.mapId] || 0;

            if (likesB !== likesA) {
                return likesB - likesA;
            }

            return Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder);

        });

        sortedCards.forEach(function (card) {
            grid.appendChild(card);
        });

    }

    function renderLikes() {

        const likes = loadLikes();
        const likedByMe = loadLikedByMe();

        cards.forEach(function (card) {

            const mapId = card.dataset.mapId;
            const button = card.querySelector('.map-like-button');
            const countLabel = button.querySelector('.map-like-count');

            countLabel.textContent = likes[mapId] || 0;
            button.classList.toggle('is-liked', likedByMe.includes(mapId));

        });

        sortGallery(likes);

    }

    grid.addEventListener('click', function (event) {

        const button = event.target.closest('.map-like-button');

        if (!button) {
            return;
        }

        const mapId = button.dataset.mapId;
        const likes = loadLikes();
        const likedByMe = loadLikedByMe();

        const alreadyLiked = likedByMe.includes(mapId);

        if (alreadyLiked) {
            likes[mapId] = Math.max(0, (likes[mapId] || 0) - 1);
            saveLikedByMe(likedByMe.filter(function (id) { return id !== mapId; }));
        } else {
            likes[mapId] = (likes[mapId] || 0) + 1;
            saveLikedByMe(likedByMe.concat(mapId));
        }

        saveLikes(likes);
        renderLikes();

    });

    renderLikes();

})();
