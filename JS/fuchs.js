/* =====================================================
   FAROS FUCHSBAU
   Spielerprofil und Geräuschequiz
   ===================================================== */


/* =====================================================
   1. SPIELER LADEN
   ===================================================== */

loadPlayer();
applyCursor();

/* =====================================================
   faro Sprüche
   ===================================================== */

const faroSprueche = [

        "Pssst... hör genau hin!",

    "Kannst du erkennen, was dieses Geräusch macht?",

    "Hast du dieses Geräusch schon einmal gehört?",

    "Meine Ohren haben etwas Interessantes entdeckt.",

    "Lausch ganz genau... was könnte das sein?",

    "Ich bin gespannt. Was hörst du?",

    "Schließ kurz die Augen und hör gut zu.",

    "Weißt du, woher dieses Geräusch kommt?",

    "Na, erkennst du diesen Klang?",

    "Manchmal verraten Geräusche mehr als Worte.",

    "Hör noch einmal ganz genau hin.",

    "Dieses Geräusch kommt mir bekannt vor.",

    "Ich glaube, das kennst du bestimmt.",

    "Nimm dir Zeit und hör aufmerksam zu.",

    "Ich verlasse mich auf meine Ohren – und du?"

];

/* =====================================================
   2. SPIELERPROFIL ANZEIGEN
   ===================================================== */

function updateFaroPlayer() {

    const playerAvatar =
        document.getElementById("player-avatar");

    const playerNameDisplay =
        document.getElementById("player-name-display");

    const featherCount =
        document.getElementById("feather-count");


    if (playerAvatar) {

        playerAvatar.src = player.avatar || AVATAR_PLACEHOLDER;
        playerAvatar.style.display = "block";

    }


    if (playerNameDisplay) {

        playerNameDisplay.textContent =
            player.name || "Abenteurer";

    }


    if (featherCount) {

        featherCount.textContent =
            "🪶 " + player.feathers + " Federn";

    }

}

updateFaroPlayer();


/* =====================================================
   3. QUIZDATEN
   Erste Testfrage: Hund
   ===================================================== */

const foxQuizzes = {

    animals: [

        {
            sound: "Sounds/Fuchsbau_quiz/dog.mp3",

            answers: [
                { text: "Hund", correct: true },
                { text: "Katze", correct: false },
                { text: "Krähe", correct: false },
                { text: "Eule", correct: false }
            ]
        },

        {
            sound: "Sounds/Fuchsbau_quiz/cat.mp3",

            answers: [
                { text: "Marder", correct: false },
                { text: "Spatz", correct: false },
                { text: "Katze", correct: true },
                { text: "Pferd", correct: false }
            ]
        },

        {
            sound: "Sounds/Fuchsbau_quiz/crow.mp3",

            answers: [
                { text: "Eichhörnchen", correct: false },
                { text: "Krähe", correct: true },
                { text: "Giraffe", correct: false },
                { text: "Leopard", correct: false }
            ]
        },

        {
            sound: "Sounds/Fuchsbau_quiz/owl.mp3",

            answers: [
                { text: "Adler", correct: false },
                { text: "Kaninchen", correct: false },
                { text: "Hamster", correct: false },
                { text: "Eule", correct: true }
            ]
        },

        {
            sound: "Sounds/Fuchsbau_quiz/monkey.mp3",

            answers: [
                { text: "Luchs", correct: false },
                { text: "Affe", correct: true },
                { text: "Giraffe", correct: false },
                { text: "Fuchs", correct: false }
            ]
        },

        {
            sound: "Sounds/Fuchsbau_quiz/mouse.mp3",

            answers: [
                { text: "Maus", correct: true },
                { text: "Elster", correct: false },
                { text: "Hase", correct: false },
                { text: "Wal", correct: false }
            ]
        },

        {
            sound: "Sounds/Fuchsbau_quiz/bear.mp3",

            answers: [
                { text: "Bär", correct: true },
                { text: "Panther", correct: false },
                { text: "Elch", correct: false },
                { text: "Fuchs", correct: false }
            ]
        },

        {
            sound: "Sounds/Fuchsbau_quiz/wolf.mp3",

            answers: [
                { text: "Hund", correct: false },
                { text: "Löwe", correct: false },
                { text: "Wolf", correct: true },
                { text: "Panther", correct: false }
            ]
        }

    ],

    everyday: [

        {
            sound: "Sounds/Fuchsbau_quiz/toaster.mp3",

            answers: [
                { text: "Toaster", correct: true },
                { text: "Staubsauger", correct: false },
                { text: "Türklingel", correct: false },
                { text: "Waschmaschine", correct: false }
            ]
        },

        {
            sound: "Sounds/Fuchsbau_quiz/waschmaschine.mp3",

            answers: [
                { text: "Waschmaschine", correct: true },
                { text: "Trockner", correct: false },
                { text: "Föhn", correct: false },
                { text: "Kühlschrank", correct: false }
            ]
        },

    ]

};

    


/* =====================================================
   4. HTML-ELEMENTE
   ===================================================== */

const animalSoundsButton =
    document.getElementById("animal-sounds-button");

const everydaySoundsButton =
    document.getElementById("everyday-sounds-button");

const quizSelection =
    document.getElementById("faro-quiz-select");

const soundQuiz =
    document.getElementById("sound-quiz");

const soundQuestion =
    document.getElementById("sound-question");

const playSoundButton =
    document.getElementById("play-sound-button");

const soundAnswers =
    document.getElementById("sound-answers");

const soundMessage =
    document.getElementById("sound-message");

const backToQuizzes =
    document.getElementById("back-to-quizzes");
/* =====================================================
   5. SPIELVARIABLEN
   ===================================================== */

let activeSoundQuiz = [];

let currentSoundQuestion = 0;

let currentAudio = null;

let questionAnswered = false;


/* =====================================================
   6. TIERGERÄUSCHE STARTEN
   ===================================================== */

function startAnimalSoundsQuiz() {

    activeSoundQuiz = foxQuizzes.animals;

    currentSoundQuestion = 0;

    questionAnswered = false;

    if (quizSelection) {
        quizSelection.style.display = "none";
    }

    if (soundQuiz) {
        soundQuiz.hidden = false;
    }

    if (backToQuizzes) {
        backToQuizzes.hidden = false;
    }

    if (playSoundButton) {
        playSoundButton.style.display = "inline-block";
    }

    showSoundQuestion();

}


/* =====================================================
   ZUR QUIZAUSWAHL ZURÜCK
   ===================================================== */

function returnToQuizSelection() {

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    if (soundQuiz) {
        soundQuiz.hidden = true;
    }

    if (quizSelection) {
        quizSelection.style.display = "block";
    }

    if (playSoundButton) {
        playSoundButton.style.display = "inline-block";
    }

    if (backToQuizzes) {
        backToQuizzes.hidden = true;
    }

    if (soundAnswers) {
        soundAnswers.innerHTML = "";
    }

    activeSoundQuiz = [];
    currentSoundQuestion = 0;
    questionAnswered = false;

}
/* =====================================================
   quiz für alltägliche geräusche starten
   ===================================================== */


function startEverydaySoundsQuiz() {

    activeSoundQuiz = foxQuizzes.everyday;

    currentSoundQuestion = 0;

    questionAnswered = false;

    if (quizSelection) {
        quizSelection.style.display = "none";
    }

    if (soundQuiz) {
        soundQuiz.hidden = false;
    }

    // ⬇️ DAS HIER EINFÜGEN
    if (backToQuizzes) {

        backToQuizzes.hidden = false;

    }

    showSoundQuestion();

}

/* =====================================================
   7. FRAGE ANZEIGEN
   ===================================================== */

function showSoundQuestion() {

    const question =
        activeSoundQuiz[currentSoundQuestion];

    questionAnswered = false;


    if (soundQuestion) {

        const randomSpruch = faroSprueche[
    Math.floor(Math.random() * faroSprueche.length)
];

soundQuestion.textContent = randomSpruch;

    }


    if (soundMessage) {

        soundMessage.textContent =
            "Faro sagt: Hör genau hin!";

    }


    if (soundAnswers) {

        soundAnswers.innerHTML = "";

    }


    currentAudio =
        new Audio(question.sound);


    question.answers.forEach(function(answer) {

        const button =
            document.createElement("button");

        button.type = "button";

        button.textContent =
            answer.text;

        button.classList.add(
            "sound-answer-button"
        );

        button.addEventListener(
            "click",
            function() {

                checkSoundAnswer(
                    answer.correct,
                    button
                );

            }
        );

        soundAnswers.appendChild(button);

    });

}


/* =====================================================
   8. GERÄUSCH ABSPIELEN
   ===================================================== */

function playCurrentSound() {

    if (!currentAudio) {
        return;
    }

    currentAudio.currentTime = 0;

    currentAudio.play().catch(function(error) {

        console.error(
            "Das Geräusch konnte nicht abgespielt werden:",
            error
        );

    });

}


/* =====================================================
   9. ANTWORT PRÜFEN
   ===================================================== */

function checkSoundAnswer(isCorrect, button) {

    if (questionAnswered) {
        return;
    }

    questionAnswered = true;

    const answerButtons =
        document.querySelectorAll(".sound-answer-button");

    answerButtons.forEach(function(answerButton) {
        answerButton.disabled = true;
    });

    if (isCorrect) {

        button.classList.add("correct");

        addFeathers(1);
        updateFaroPlayer();

        if (soundMessage) {
            soundMessage.textContent =
                "Faro sagt: Genau richtig! +1 Feder";
        }

    } else {

        button.classList.add("wrong");

        if (soundMessage) {
            soundMessage.textContent =
                "Faro sagt: Das war ein guter Versuch.";
        }

    }

    // Nach 1,5 Sekunden nächste Frage zeigen
    setTimeout(nextSoundQuestion, 1500);

}

/* =====================================================
   NÄCHSTE GERÄUSCHFRAGE
   ===================================================== */

function nextSoundQuestion() {

    currentSoundQuestion++;

    if (currentSoundQuestion < activeSoundQuiz.length) {

        showSoundQuestion();

    } else {

        if (soundQuestion) {
            soundQuestion.textContent = "Quiz beendet!";
        }

        if (soundAnswers) {
            soundAnswers.innerHTML = "";
        }

        if (playSoundButton) {
            playSoundButton.style.display = "none";
        }

        if (soundMessage) {
            soundMessage.textContent =
                "Faro sagt: Sehr gut gehört!";
        }

    }

}

/* =====================================================
   10. BUTTONS VERBINDEN
   ===================================================== */

if (animalSoundsButton) {

    animalSoundsButton.addEventListener(
        "click",
        startAnimalSoundsQuiz
    );

}


if (playSoundButton) {

    playSoundButton.addEventListener(
        "click",
        playCurrentSound
    );

}


if (backToQuizzes) {

    backToQuizzes.addEventListener(
        "click",
        returnToQuizSelection
    );

}


/*
   "Alltagsgeräusche" bleibt bewusst ohne Klick-Handler,
   solange die Sounddateien (toaster.mp3, waschmaschine.mp3)
   im Projekt fehlen – siehe JS/words.js-Pendant-Diskussion.
*/



/* =====================================================
   10. faros flinkfunk geräusch
   ===================================================== */


const flinkfunkRadio =
    document.getElementById("flinkfunk-radio");

const musicNotes =
    document.querySelectorAll(".music-note");

const fluteSound =
    new Audio("Sounds/radio_flute/flute_song.mp3");

let noteInterval;

if (flinkfunkRadio) {

    flinkfunkRadio.addEventListener("click", function() {

        if (typeof isSoundOn !== "function" || isSoundOn()) {
            fluteSound.currentTime = 0;
            fluteSound.play();
        }

        clearInterval(noteInterval);

        createMusicNote();

        noteInterval = setInterval(function() {

            const amount =
                Math.floor(Math.random() * 2) + 1;

            for (let i = 0; i < amount; i++) {
                createMusicNote();
            }

        }, 700);

    });

}

function showMusicNotes() {

    musicNotes.forEach(function(note){

        note.classList.remove("show-note");

    });

    setTimeout(function(){

        musicNotes.forEach(function(note){

            note.classList.add("show-note");

        });

    },10);

}

fluteSound.addEventListener("ended", function(){

    clearInterval(noteInterval);

    musicNotes.forEach(function(note){

        note.classList.remove("show-note");

    });

});

function createMusicNote(){

    const symbols = [

        "♫",
        "♪",
        "♬"

    ];

    const note =
        document.createElement("span");

    note.classList.add("floating-note");

    note.textContent =
        symbols[Math.floor(Math.random()*symbols.length)];

    note.style.left =
        (20 + Math.random()*60) + "px";

    note.style.top =
        (20 + Math.random()*20) + "px";

    note.style.fontSize =
        (22 + Math.random()*12) + "px";

    document
        .getElementById("flinkfunk-box")
        .appendChild(note);

    setTimeout(function(){

        note.remove();

    },2000);

}
