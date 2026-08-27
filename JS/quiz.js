/* =====================================================
   SPIELVARIABLEN
   ===================================================== */

if (typeof markAnimalVisited === "function") {
    markAnimalVisited("kuro");
}

let currentQuestion = 0;
let score = 0;
let activeQuiz = [];
let currentCategoryId = null;


/* =====================================================
   ZUFÄLLIGE REIHENFOLGE
   Mischt eine Kopie des Arrays, ohne das Original
   zu verändern (Fisher-Yates).
   ===================================================== */

function shuffleArray(array) {

    const shuffled = array.slice();

    for (let i = shuffled.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];

    }

    return shuffled;

}


/* =====================================================
   QUIZ MISCHEN
   Fragenreihenfolge UND Antwortreihenfolge werden bei
   jedem Quizstart neu gemischt.
   ===================================================== */

function shuffleQuiz(quiz) {

    const questionsShuffled = shuffleArray(quiz);

    return questionsShuffled.map(function (question) {

        return Object.assign({}, question, {
            answers: shuffleArray(question.answers)
        });

    });

}


/* =====================================================
   KATEGORIEN ANZEIGEN
   ===================================================== */

function renderQuizCategories() {

    const container = document.getElementById("quiz-category-buttons");

    if (!container || typeof quizCategories === "undefined") {
        return;
    }

    container.innerHTML = "";

    quizCategories.forEach(function (category) {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "yj-button";
        button.textContent = category.icon + " " + category.label;

        button.addEventListener("click", function () {
            showQuizList(category.id);
        });

        container.appendChild(button);

    });

}


/* =====================================================
   QUIZLISTE EINER KATEGORIE ANZEIGEN
   ===================================================== */

function showQuizList(categoryId) {

    const category = quizCategories.find(function (item) {
        return item.id === categoryId;
    });

    if (!category) {
        return;
    }

    currentCategoryId = categoryId;

    document.getElementById("quiz-category-select").hidden = true;
    document.getElementById("quiz-list-select").hidden = false;

    document.getElementById("quiz-category-title").textContent =
        category.icon + " " + category.label;

    const listContainer = document.getElementById("quiz-select-buttons");
    listContainer.innerHTML = "";

    category.quizzes.forEach(function (quizEntry) {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "yj-button";
        button.textContent = quizEntry.icon + " " + quizEntry.label;

        button.addEventListener("click", function () {
            startQuiz(quizEntry.id);
        });

        listContainer.appendChild(button);

    });

}


/* =====================================================
   ZURÜCK ZU DEN KATEGORIEN
   ===================================================== */

const quizBackToCategoriesButton =
    document.getElementById("quiz-back-to-categories");

if (quizBackToCategoriesButton) {

    quizBackToCategoriesButton.addEventListener("click", function () {

        currentCategoryId = null;

        document.getElementById("quiz-list-select").hidden = true;
        document.getElementById("quiz-category-select").hidden = false;

    });

}


/* =====================================================
   QUIZ ANHAND SEINER ID FINDEN
   ===================================================== */

function findQuizById(quizId) {

    if (typeof quizCategories === "undefined") {
        return null;
    }

    for (let i = 0; i < quizCategories.length; i++) {

        const match = quizCategories[i].quizzes.find(function (quizEntry) {
            return quizEntry.id === quizId;
        });

        if (match) {
            return match;
        }

    }

    return null;

}


/* =====================================================
   QUIZ STARTEN
   ===================================================== */

function startQuiz(quizId) {

    const quizEntry = findQuizById(quizId);

    if (!quizEntry) {
        return;
    }

    activeQuiz = shuffleQuiz(quizEntry.quiz);

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
    const answersWrapper = document.createElement("div");
    answersWrapper.className = "quiz-answers";

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

        answersWrapper.appendChild(button);

    });

    container.appendChild(answersWrapper);

}


/* =====================================================
   ANTWORT PRÜFEN
   ===================================================== */

function checkAnswer(isCorrect, button) {

    if (isCorrect) {

        button.classList.add("correct");
        score++;
        addCoins(1);

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
   QUIZ VERLASSEN
   Wird sowohl vom "Quiz verlassen"-Button während des
   Spiels als auch vom Ergebnis-Bildschirm benutzt.
   ===================================================== */

function exitQuiz() {

    document.getElementById("quiz-select").style.display = "block";

    document.getElementById("quiz-status").style.display = "none";
    document.getElementById("quiz-game-panel").style.display = "none";

    document.getElementById("score-display").style.display = "none";
    document.getElementById("progress-display").style.display = "none";

    document.getElementById("quiz-container").innerHTML = "";

    /*
       Zurück zur Quizliste der aktuellen Kategorie,
       damit man leicht ein weiteres Quiz aus dem
       gleichen Thema probieren kann.
    */

    if (currentCategoryId) {
        showQuizList(currentCategoryId);
    }

}


const quizExitButton = document.getElementById("quiz-exit-button");

if (quizExitButton) {

    quizExitButton.addEventListener("click", exitQuiz);

}


/* =====================================================
   ERGEBNIS ANZEIGEN
   ===================================================== */

function showResults() {

    if (typeof registerQuizCompletion === "function") {

        registerQuizCompletion();

    }

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

    backButton.type = "button";
    backButton.className = "yj-button yj-button--compact";

    backButton.textContent =
        "Zurück zur Auswahl";

    backButton.onclick = exitQuiz;

    container.appendChild(backButton);

}


renderQuizCategories();
