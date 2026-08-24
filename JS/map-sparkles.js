/* =====================================================
   STARTSEITEN-KARTE - GOLDENE GLITZERPARTIKEL
   Erzeugt beim Hovern/Antippen eines Ortes auf der Karte
   ein paar sanft nach oben schwebende Glitzerpunkte.
   ===================================================== */

(function () {

    const prefersReducedMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const hotspots = document.querySelectorAll(".home-map-hotspot");

    if (prefersReducedMotion || hotspots.length === 0) {
        return;
    }

    function spawnSparkle(hotspot) {

        const sparkle = document.createElement("span");
        sparkle.className = "home-map-sparkle";

        const left = 20 + Math.random() * 60;
        const top = 20 + Math.random() * 60;
        const drift = Math.round((Math.random() - 0.5) * 28);

        sparkle.style.left = left + "%";
        sparkle.style.top = top + "%";
        sparkle.style.setProperty("--sx", drift + "px");

        sparkle.addEventListener("animationend", function () {
            sparkle.remove();
        });

        hotspot.appendChild(sparkle);

        // Falls "animationend" mal nicht feuert (z. B. Seitenwechsel),
        // Partikel spätestens nach 2s trotzdem entfernen.
        setTimeout(function () {
            sparkle.remove();
        }, 2000);

    }

    function burstSparkles(hotspot, count) {
        for (let i = 0; i < count; i++) {
            setTimeout(function () {
                spawnSparkle(hotspot);
            }, i * 130);
        }
    }

    hotspots.forEach(function (hotspot) {

        let intervalId = null;

        function start() {
            if (intervalId) {
                return;
            }
            burstSparkles(hotspot, 2);
            intervalId = setInterval(function () {
                spawnSparkle(hotspot);
            }, 420);
        }

        function stop() {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }

        hotspot.addEventListener("pointerenter", start);
        hotspot.addEventListener("pointerleave", stop);
        hotspot.addEventListener("focus", start);
        hotspot.addEventListener("blur", stop);

        // Erstes Antippen auf Touch-Geräten: Effekt sofort sichtbar
        // machen, auch wenn direkt danach zur Seite gewechselt wird.
        hotspot.addEventListener("touchstart", function () {
            burstSparkles(hotspot, 3);
        }, { passive: true });

    });

})();
