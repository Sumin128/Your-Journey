/* =====================================================
   BÄRENTAL – SEITEN
   ===================================================== */

if (typeof markAnimalVisited === "function") {
    markAnimalVisited("branos");
}

const bearWelcome =
    document.getElementById("bear-welcome");

const bearGameMenu =
    document.getElementById("bear-game-menu");

const guessAnimalGame =
    document.getElementById("guess-animal-game");


const bearStartButton =
    document.getElementById("bear-start-button");

const backToBranos =
    document.getElementById("back-to-branos");

const startAnimalGame =
    document.getElementById("start-animal-game");

const backToBearMenu =
    document.getElementById("back-to-bear-menu");

const guessNowButton =
    document.getElementById("guess-now-button");


/* =====================================================
   SPIELSTATUS
   ===================================================== */

let secretAnimal = null;

let questionsRemaining = 7;

let usedQuestions = [];

let guessingMode = false;

let roundFinished = false;

let activeCardSet = animals;


/* =====================================================
   FRAGEN
   ===================================================== */

const animalQuestions = [

    {
        id: "glasses",
        text: "Trägt dein Tier eine Brille?",
        property: "glasses",
        value: true
    },

    {
        id: "neckwear",
        text: "Trägt dein Tier etwas um den Hals?",

        /*
           Schal, Halstuch, Fliege oder Umhang.

           In unseren aktuellen Tierdaten sind
           Hals-Schleifen über bow und Schals/Umhänge
           über scarf erfasst.
        */
        test: function (animal) {
            return animal.scarf === true ||
                   animal.bow === true;
        }
    },

    {
        id: "headwear",
        text: "Trägt dein Tier eine Kopfbedeckung?",
        property: "headwear",
        value: true
    },

    {
        id: "bow",
        text: "Trägt dein Tier eine Schleife oder Spange?",
        property: "bow",
        value: true
    },

    {
        id: "mask",
        text: "Trägt dein Tier eine Maske?",
        property: "mask",
        value: true
    },

    {
        id: "earrings",
        text: "Trägt dein Tier Ohrringe?",
        property: "earrings",
        value: true
    }

];


/* =====================================================
   AUGENFARBEN
   ===================================================== */

const eyeColorQuestions = [

    {
        id: "eyes-green",
        text: "Grüne Augen",
        property: "eyeColor",
        value: "green"
    },

    {
        id: "eyes-blue",
        text: "Blaue Augen",
        property: "eyeColor",
        value: "blue"
    },

    {
        id: "eyes-brown",
        text: "Braune Augen",
        property: "eyeColor",
        value: "brown"
    },

    {
        id: "eyes-gold",
        text: "Goldene / gelbe Augen",
        property: "eyeColor",
        value: "gold"
    },

    {
        id: "eyes-purple",
        text: "Lilafarbene Augen",
        property: "eyeColor",
        value: "purple"
    }

];


/* =====================================================
   WILLKOMMEN → SPIELMENÜ
   ===================================================== */

function getActiveQuestions() {
    return animalQuestions;
}

function getActiveEyeColorQuestions() {
    return eyeColorQuestions;
}

function updateGameHeading() {
    const title = document.getElementById("guess-game-title");
    const subtitle = document.getElementById("guess-game-subtitle");
    if (title) { title.textContent = "🐾 Wer ist es?"; }
    if (subtitle) { subtitle.textContent = "Finde Branos' geheimes Tier"; }
}

if (bearStartButton) {

    bearStartButton.addEventListener(
        "click",
        function () {

            bearWelcome.hidden = true;

            bearGameMenu.hidden = false;

        }
    );

}


/* =====================================================
   SPIELMENÜ → BRANOS
   ===================================================== */

if (backToBranos) {

    backToBranos.addEventListener(
        "click",
        function () {

            bearGameMenu.hidden = true;

            bearWelcome.hidden = false;

        }
    );

}

/* =====================================================
   SPIEL STARTEN
   ===================================================== */

if (startAnimalGame) {

    startAnimalGame.addEventListener(
        "click",
        function () {

            activeCardSet = animals;
            updateGameHeading();

            bearGameMenu.hidden = true;

            guessAnimalGame.hidden = false;

            startAnimalRound();

        }
    );

}


/* =====================================================
   SPIEL VERLASSEN
   ===================================================== */

if (backToBearMenu) {

    backToBearMenu.addEventListener(
        "click",
        function () {

            guessAnimalGame.hidden = true;

            bearGameMenu.hidden = false;

        }
    );

}


/* =====================================================
   NEUE RUNDE
   ===================================================== */

function startAnimalRound() {

    questionsRemaining = 7;

    usedQuestions = [];

    guessingMode = false;

    roundFinished = false;


    chooseSecretAnimal();

    buildQuestions();

    buildAnimalBoard();

    updateQuestionCounter();


    const branosAnswer =
        document.getElementById("branos-answer");


    if (branosAnswer) {

        branosAnswer.textContent =
            "Stell mir eine Frage!";

    }


    if (guessNowButton) {

        guessNowButton.disabled = false;

        guessNowButton.textContent =
            "🎯 Jetzt raten";

    }

}


/* =====================================================
   BRANOS WÄHLT EIN ZUFÄLLIGES TIER
   ===================================================== */

function chooseSecretAnimal() {

    const randomIndex =
        Math.floor(
            Math.random() * activeCardSet.length
        );


    secretAnimal =
        activeCardSet[randomIndex];


    /*
       NUR ZUM TESTEN!

       F12 → Konsole

       Später löschen wir diese Zeile.
    */

    console.log(
        "Branos hat gewählt:",
        secretAnimal.name
    );

}


/* =====================================================
   FRAGEN ANZEIGEN
   ===================================================== */

function buildQuestions() {

    const questionButtons =
        document.getElementById(
            "question-buttons"
        );


    if (!questionButtons) {
        return;
    }


    questionButtons.innerHTML = "";


    /* =================================================
       NORMALE FRAGEN
       ================================================= */

    getActiveQuestions().forEach(
        function (question) {

            const button =
                document.createElement("button");


            button.type = "button";

            button.textContent =
                question.text;


            button.addEventListener(
                "click",
                function () {

                    askQuestion(
                        question,
                        button
                    );

                }
            );


            questionButtons.appendChild(
                button
            );

        }
    );


    /* =================================================
       AUGENFARBEN-RUBRIK
       ================================================= */

    const eyeGroup =
        document.createElement("div");


    eyeGroup.className =
        "question-group";


    const eyeToggle =
        document.createElement("button");


    eyeToggle.type =
        "button";


    eyeToggle.className =
        "question-group-toggle";


    eyeToggle.textContent =
        "👁 Augenfarbe  ▾";


    /* Untermenü */

    const eyeChoices =
        document.createElement("div");


    eyeChoices.className =
        "eye-color-choices";


    eyeChoices.hidden = true;


    /* Rubrik öffnen / schließen */

    eyeToggle.addEventListener(
        "click",
        function () {

            eyeChoices.hidden =
                !eyeChoices.hidden;


            if (eyeChoices.hidden) {

                eyeToggle.textContent =
                    "👁 Augenfarbe  ▾";

            }

            else {

                eyeToggle.textContent =
                    "👁 Augenfarbe  ▴";

            }

        }
    );


    /* Farben erzeugen */

    getActiveEyeColorQuestions().forEach(
        function (question) {

            const button =
                document.createElement("button");


            button.type =
                "button";


            button.className =
                "eye-color-button";


            button.textContent =
                question.text;


            button.addEventListener(
                "click",
                function () {

                    askQuestion(
                        question,
                        button
                    );

                }
            );


            eyeChoices.appendChild(
                button
            );

        }
    );


    eyeGroup.appendChild(
        eyeToggle
    );


    eyeGroup.appendChild(
        eyeChoices
    );


    questionButtons.appendChild(
        eyeGroup
    );

}


/* =====================================================
   FRAGE STELLEN
   ===================================================== */

function askQuestion(
    question,
    button
) {

    if (!secretAnimal) {
        return;
    }


    if (roundFinished) {
        return;
    }


    if (guessingMode) {
        return;
    }


    if (questionsRemaining <= 0) {
        return;
    }


    if (
        usedQuestions.includes(
            question.id
        )
    ) {

        return;

    }


    /* =================================================
       ANTWORT PRÜFEN

       Funktioniert sowohl mit true/false
       als auch mit Augenfarben.
       ================================================= */

    let answer;


/*
   Manche Fragen benutzen eine eigene Prüffunktion.
   Zum Beispiel "etwas um den Hals".
*/

if (typeof question.test === "function") {

    answer =
        question.test(secretAnimal);

}

else {

    answer =
        secretAnimal[
            question.property
        ] === question.value;

}


    const branosAnswer =
        document.getElementById(
            "branos-answer"
        );


    if (branosAnswer) {

        if (answer) {

            branosAnswer.textContent =
                "Ja! 🐻";

        }

        else {

            branosAnswer.textContent =
                "Nein! 🐻";

        }

    }


    /* Frage als benutzt speichern */

    usedQuestions.push(
        question.id
    );


    /* Button sperren */

    button.disabled = true;

    button.classList.add(
        "question-used"
    );


    questionsRemaining--;


    updateQuestionCounter();


    /* =================================================
       KEINE FRAGEN MEHR
       ================================================= */

    if (questionsRemaining === 0) {

    guessingMode = true;

    disableAllQuestions();


    /*
       Tierkarten werden jetzt zum Raten markiert.
    */

    document
        .querySelectorAll(".animal-card")
        .forEach(
            function (card) {

                card.classList.add(
                    "guessable"
                );

            }
        );


    if (guessNowButton) {

        guessNowButton.textContent =
            "🎯 Wähle ein Tier";

    }


    /*
       WICHTIG:
       Antwort der letzten Frage bleibt sichtbar.
    */

    if (branosAnswer) {

        if (answer) {

            branosAnswer.textContent =
                "Ja! 🐻 Das war deine letzte Frage. Jetzt musst du raten!";

        }

        else {

            branosAnswer.textContent =
                "Nein! 🐻 Das war deine letzte Frage. Jetzt musst du raten!";

        }

    }

}

}


/* =====================================================
   FRAGENZÄHLER
   ===================================================== */

function updateQuestionCounter() {

    const counter =
        document.getElementById(
            "questions-left"
        );


    if (counter) {

        counter.textContent =
            questionsRemaining;

    }

}


/* =====================================================
   TIERKARTEN ERSTELLEN
   ===================================================== */

function buildAnimalBoard() {

    const animalBoard =
        document.getElementById(
            "animal-board"
        );


    if (!animalBoard) {
        return;
    }


    animalBoard.innerHTML = "";


    activeCardSet.forEach(
        function (animal) {

            const card =
                document.createElement(
                    "button"
                );


            card.type =
                "button";


            card.className =
                "animal-card";


            card.dataset.animal =
                animal.name;


            /* =========================================
               INNERE KARTE
               ========================================= */

            const inner =
                document.createElement("div");


            inner.className =
                "animal-card-inner";


            /* =========================================
               VORDERSEITE
               ========================================= */

            const front =
                document.createElement("div");


            front.className =
                "animal-card-front";


            const image =
                document.createElement("img");


            image.src =
                animal.image;


            image.alt =
                animal.name;


            front.appendChild(
                image
            );


            /* =========================================
               RÜCKSEITE
               ========================================= */

            const back =
                document.createElement("div");


            back.className =
                "animal-card-back";


            back.innerHTML =
                "🐾";


            inner.appendChild(
                front
            );


            inner.appendChild(
                back
            );


            card.appendChild(
                inner
            );


            /* =========================================
               KARTENKLICK
               ========================================= */

            card.addEventListener(
                "click",
                function () {

                    handleAnimalCardClick(
                        animal,
                        card
                    );

                }
            );


            animalBoard.appendChild(
                card
            );

        }
    );

}


/* =====================================================
   KARTENKLICK
   ===================================================== */

function handleAnimalCardClick(
    animal,
    card
) {

    if (roundFinished) {
        return;
    }


    /* =================================================
       NORMALER MODUS

       Karte umdrehen / wieder öffnen
       ================================================= */

    if (!guessingMode) {

        card.classList.toggle(
            "flipped"
        );

        return;

    }


    /* =================================================
       RATEMODUS

       Falls die Karte vorher umgedreht wurde,
       zuerst wieder öffnen.
       ================================================= */

    if (
        card.classList.contains(
            "flipped"
        )
    ) {

        card.classList.remove(
            "flipped"
        );

        return;

    }


    makeGuess(animal);

}


/* =====================================================
   JETZT RATEN
   ===================================================== */

if (guessNowButton) {

    guessNowButton.addEventListener(
        "click",
        function () {

            if (roundFinished) {

                startAnimalRound();

                return;

            }


            if (guessingMode) {

                cancelGuessMode();

                return;

            }


            activateGuessMode();

        }
    );

}


/* =====================================================
   RATEMODUS AKTIVIEREN
   ===================================================== */

function activateGuessMode() {

    guessingMode = true;


    const branosAnswer =
        document.getElementById(
            "branos-answer"
        );


    if (branosAnswer) {

        branosAnswer.textContent =
            "Welches Tier glaubst du, habe ich gewählt? Klicke auf eine Karte! 🐻";

    }


    if (guessNowButton) {

        if (questionsRemaining > 0) {

            guessNowButton.textContent =
                "↩ Raten abbrechen";

        }

        else {

            guessNowButton.textContent =
                "🎯 Wähle ein Tier";

        }

    }


    /*
       Sobald keine Fragen mehr übrig sind,
       werden alle übrigen Fragebuttons gesperrt.
    */

    if (questionsRemaining === 0) {

        disableAllQuestions();

    }


    document
        .querySelectorAll(
            ".animal-card"
        )
        .forEach(
            function (card) {

                card.classList.add(
                    "guessable"
                );

            }
        );

}


/* =====================================================
   RATEMODUS ABBRECHEN
   ===================================================== */

function cancelGuessMode() {

    if (questionsRemaining <= 0) {
        return;
    }


    guessingMode = false;


    if (guessNowButton) {

        guessNowButton.textContent =
            "🎯 Jetzt raten";

    }


    const branosAnswer =
        document.getElementById(
            "branos-answer"
        );


    if (branosAnswer) {

        branosAnswer.textContent =
            "Okay, stell mir noch eine Frage! 🐻";

    }


    document
        .querySelectorAll(
            ".animal-card"
        )
        .forEach(
            function (card) {

                card.classList.remove(
                    "guessable"
                );

            }
        );

}


/* =====================================================
   TIER RATEN
   ===================================================== */

function makeGuess(animal) {

    if (!secretAnimal) {
        return;
    }


    const branosAnswer =
        document.getElementById(
            "branos-answer"
        );


    /* =================================================
       RICHTIG
       ================================================= */

    if (
        animal.name ===
        secretAnimal.name
    ) {

        roundFinished = true;


        if (branosAnswer) {

            branosAnswer.textContent =
                "Richtig! 🎉 Mein geheimes Tier war " +
                secretAnimal.name +
                "!";

        }


        if (typeof registerAnimalGuessWin === "function") {

            registerAnimalGuessWin();

        }


        finishRound(
            animal.name
        );

        return;

    }


    /* =================================================
       FALSCH

       Ein falscher finaler Tipp beendet die Runde.
       ================================================= */

    roundFinished = true;


    if (branosAnswer) {

        branosAnswer.textContent =
            "Leider falsch! Mein geheimes Tier war " +
            secretAnimal.name +
            ". 🐻";

    }


    finishRound(
        secretAnimal.name
    );

}


/* =====================================================
   RUNDE BEENDET
   ===================================================== */

function finishRound(
    secretAnimalName
) {

    disableAllQuestions();


    document
        .querySelectorAll(
            ".animal-card"
        )
        .forEach(
            function (card) {

                card.classList.remove(
                    "guessable"
                );


                /*
                   Geheimes Tier hervorheben
                */

                if (
                    card.dataset.animal ===
                    secretAnimalName
                ) {

                    card.classList.remove(
                        "flipped"
                    );

                    card.classList.add(
                        "secret-reveal"
                    );

                }

            }
        );


    if (guessNowButton) {

        guessNowButton.textContent =
            "🔄 Neue Runde";

    }

}


/* =====================================================
   ALLE FRAGEN SPERREN
   ===================================================== */

function disableAllQuestions() {

    document
        .querySelectorAll(
            "#question-buttons button"
        )
        .forEach(
            function (button) {

                button.disabled = true;

            }
        );

}
