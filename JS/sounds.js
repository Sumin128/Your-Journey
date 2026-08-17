/* =====================================================
   SOUNDS
   Gemeinsame Soundfunktionen
   ===================================================== */

const soundsScriptUrl = document.currentScript.src;
const correctSound = new Audio(
    new URL("../Sounds/correct_answer.mp3", soundsScriptUrl).href
);
const wrongSound = new Audio(
    new URL("../Sounds/wrong_answer.mp3", soundsScriptUrl).href
);

correctSound.preload = "auto";
wrongSound.preload = "auto";


function playCorrectSound() {

    if (typeof isSoundOn === "function" && !isSoundOn()) {
        return;
    }

    correctSound.currentTime = 0;
    correctSound.play().catch(function (error) {
        console.warn("Der Richtig-Sound konnte nicht abgespielt werden.", error);
    });

}


function playWrongSound() {

    if (typeof isSoundOn === "function" && !isSoundOn()) {
        return;
    }

    wrongSound.currentTime = 0;
    wrongSound.play().catch(function (error) {
        console.warn("Der Falsch-Sound konnte nicht abgespielt werden.", error);
    });

}
