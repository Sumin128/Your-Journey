/* =====================================================
   SPIELVARIABLEN
   ===================================================== */

let currentQuestion = 0;
let score = 0;
let activeQuiz = [];






/* =====================================================
   QUIZ STARTEN
   ===================================================== */

function startQuiz(quizName) {

    // Das ausgewählte Quiz laden

    if (quizName === "allgemeinwissen") {

        activeQuiz = quizAllgemeinwissen;

    } else if (quizName === "tiere") {

        activeQuiz = quizTiere;

    } else if (quizName === "filmcharaktere") {

        activeQuiz = quizFilmCharaktere;

    } else if (quizName === "buchstaben") {

        activeQuiz = quizBuchstaben;

    } else if (quizName === "berufe") {

        activeQuiz = quizBerufe;

    } else if (quizName === "Mathe1Klasse") {

        activeQuiz = Mathe1Klasse;

    }

    // Neues Spiel beginnen
    currentQuestion = 0;
    score = 0;

    // Auswahl ausblenden
    document.getElementById("quiz-select").style.display = "none";
    document.getElementById("quiz-game-panel").style.display = "block";
    document.getElementById("quiz-status").style.display = "block";


    // Anzeigen einblenden
    document.getElementById("score-display").style.display = "block";
    document.getElementById("progress-display").style.display = "block";

    // Erste Frage anzeigen
    showQuestion();

}



/* =====================================================
   FRAGE ANZEIGEN
   ===================================================== */

function showQuestion() {

    const q = activeQuiz[currentQuestion];
    const container = document.getElementById("quiz-container");

    // Alten Inhalt löschen
    container.innerHTML = "";

    // Punktestand aktualisieren
    document.getElementById("score-display").textContent =
        "Punkte: " + score;

    // Fortschritt aktualisieren
    document.getElementById("progress-display").textContent =
        "Frage " + (currentQuestion + 1) + " von " + activeQuiz.length;

    // Überschrift erstellen
    const questionTitle = document.createElement("h2");
    questionTitle.textContent = "Frage " + (currentQuestion + 1);

    container.appendChild(questionTitle);

    // Bild anzeigen (falls vorhanden)
    if (q.image) {

        const img = document.createElement("img");
        img.src = q.image;
        img.className = "quiz-image";

        container.appendChild(img);

    }

    // Frage anzeigen
    const questionText = document.createElement("p");
    questionText.textContent = q.question;

    container.appendChild(questionText);

    // Antwortbuttons erzeugen
    q.answers.forEach(function (answer) {

        const button = document.createElement("button");

        // Kleines Bild im Button
        if (answer.image) {

            const answerImg = document.createElement("img");

            answerImg.src = answer.image;
            answerImg.className = "answer-image";

            button.appendChild(answerImg);

        }

        // Antworttext
        const answerText = document.createElement("span");
        answerText.textContent = answer.text;

        button.appendChild(answerText);

        // Klick auf den Button
        button.onclick = function () {

            checkAnswer(answer.correct, button);

        };

        container.appendChild(button);

    });

}


/* =====================================================
   ANTWORT PRÜFEN
   ===================================================== */

/* =====================================================
   ANTWORT PRÜFEN
   ===================================================== */

function checkAnswer(isCorrect, button) {

    if (isCorrect) {

        button.classList.add("correct");
        score++;
        addFeathers(1);

        if (typeof playCorrectSound === "function") {
            playCorrectSound();
        }

    } else {

        button.classList.add("wrong");

        if (typeof playWrongSound === "function") {
            playWrongSound();
        }

    }

    const allButtons =
        document.querySelectorAll("#quiz-container button");

    allButtons.forEach(function (btn) {
        btn.disabled = true;
    });

    setTimeout(nextQuestion, 1000);
}


/* =====================================================
   NÄCHSTE FRAGE
   ===================================================== */

function nextQuestion() {

    const container =
        document.getElementById("quiz-container");

    // Ausblenden (Animation)
    container.classList.add("fade-out");

    setTimeout(function () {

        currentQuestion++;

        // Gibt es noch Fragen?
        if (currentQuestion < activeQuiz.length) {

            showQuestion();

        }

        // Quiz beendet
        else {

            showResults();

        }

        container.classList.remove("fade-out");

    }, 300);

}



/* =====================================================
   ERGEBNIS ANZEIGEN
   ===================================================== */

function showResults() {

    const container =
        document.getElementById("quiz-container");

    container.innerHTML = "";

    // Überschrift
    const resultTitle =
        document.createElement("h2");

    resultTitle.textContent = "Ergebnis";

    container.appendChild(resultTitle);

    // Punktestand
    const resultText =
        document.createElement("p");

    resultText.textContent =
        score + " von " + activeQuiz.length + " korrekt";

    container.appendChild(resultText);

    // Zurück-Button
    const backButton =
        document.createElement("button");

    backButton.textContent =
        "Zurück zur Auswahl";

    backButton.onclick = function () {

    document.getElementById("quiz-select").style.display = "block";

    document.getElementById("quiz-status").style.display = "none";
    document.getElementById("quiz-game-panel").style.display = "none";

    document.getElementById("score-display").style.display = "none";
    document.getElementById("progress-display").style.display = "none";

    container.innerHTML = "";

};

    container.appendChild(backButton);

}
