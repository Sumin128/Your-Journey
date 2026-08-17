/* =====================================================
   EINSTELLUNGEN
   ===================================================== */

(function () {

    const soundToggle =
        document.getElementById("sound-toggle");

    if (soundToggle) {

        soundToggle.checked = isSoundOn();

        soundToggle.addEventListener("change", function () {

            setSoundOn(soundToggle.checked);

        });

    }


    const darkToggle =
        document.getElementById("dark-toggle");

    if (darkToggle) {

        darkToggle.checked = isDarkMode();

        darkToggle.addEventListener("change", function () {

            setDarkMode(darkToggle.checked);

        });

    }

})();
