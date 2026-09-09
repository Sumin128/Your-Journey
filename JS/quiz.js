/* =====================================================
   KUROS QUIZ
   Zwei getrennte Quizarten:
     1. TEXT-QUIZ  - grosser Fragenkatalog (JS/quiz-catalog.js),
        frei waehlbare Rundenlaenge + Thema. Ganz neu.
     2. GERAEUSCHE-QUIZ - unveraendert: quizTiergeraeusche
        (JS/data.js), "Geraeusch anhoeren"-Knopf, XP wie bisher.
   ===================================================== */

if (typeof markAnimalVisited === "function") {
    markAnimalVisited("kuro");
}

const TEXT_QUIZ_SESSION_KEY = "kuroTextQuizRound";


/* =====================================================
   HILFEN
   ===================================================== */

function quizShuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const quizEls = {
    select: document.getElementById("quiz-select"),
    landing: document.getElementById("quiz-type-landing"),
    textSetup: document.getElementById("text-quiz-setup"),
    geraeuscheSetup: document.getElementById("geraeusche-setup"),
    status: document.getElementById("quiz-status"),
    gamePanel: document.getElementById("quiz-game-panel"),
    container: document.getElementById("quiz-container"),
    progress: document.getElementById("progress-display")
};

function showSelectScreen(which) {
    // which: "landing" | "text" | "geraeusche"
    if (quizEls.select) { quizEls.select.style.display = "block"; }
    if (quizEls.status) { quizEls.status.style.display = "none"; }
    if (quizEls.gamePanel) { quizEls.gamePanel.style.display = "none"; }
    if (quizEls.container) { quizEls.container.innerHTML = ""; }

    if (quizEls.landing) { quizEls.landing.hidden = which !== "landing"; }
    if (quizEls.textSetup) { quizEls.textSetup.hidden = which !== "text"; }
    if (quizEls.geraeuscheSetup) { quizEls.geraeuscheSetup.hidden = which !== "geraeusche"; }
}

function showGameScreen() {
    if (quizEls.select) { quizEls.select.style.display = "none"; }
    if (quizEls.status) { quizEls.status.style.display = "block"; }
    if (quizEls.gamePanel) { quizEls.gamePanel.style.display = "block"; }
}


/* =====================================================
   LANDING: QUIZART WAEHLEN
   ===================================================== */

(function () {
    const toText = document.getElementById("quiz-type-text");
    const toGeraeusche = document.getElementById("quiz-type-geraeusche");

    if (toText) {
        toText.addEventListener("click", function () {
            enterTextQuizSetup();
        });
    }
    if (toGeraeusche) {
        toGeraeusche.addEventListener("click", openGeraeuscheQuiz);
    }

    // Zurück: aus Schritt 2 (Länge) zurück zu Schritt 1 (Thema),
    // aus Schritt 1 zurück zur Quizart-Auswahl.
    const textBack = document.getElementById("text-quiz-back");
    if (textBack) {
        textBack.addEventListener("click", function () {
            if (tqStep === "length") {
                tqStep = "category";
                tqSelectedLength = null;
                renderTextQuizSetup();
            } else {
                showSelectScreen("landing");
            }
        });
    }

    const gBack = document.getElementById("geraeusche-back");
    if (gBack) { gBack.addEventListener("click", function () { showSelectScreen("landing"); }); }
})();


/* =====================================================
   TEXT-QUIZ: AUSWAHL IN ZWEI SCHRITTEN
   1. Thema (Gemischt / Tiere / ...)  ->  2. Länge (5 / 10 / 15)
   Die Längen-Auswahl startet die Runde direkt.
   ===================================================== */

let tqSelectedLength = null;       // "kurz" | "mittel" | "gross"
let tqSelectedCategory = "gemischt";
let tqStep = "category";           // "category" | "length"

function tqCatAvailability(catId) {
    return (typeof textQuizCategoryAvailability === "function")
        ? textQuizCategoryAvailability(catId)
        : { lengths: { kurz: true, mittel: true, gross: true } };
}

function tqCategoryDef(catId) {
    return TEXT_QUIZ_CATEGORIES.find(function (c) { return c.id === catId; }) || null;
}

// Von der Landing-Seite (und "Noch eine Runde") aufgerufen: immer bei
// Schritt 1 (Thema) beginnen.
function enterTextQuizSetup() {
    tqStep = "category";
    tqSelectedLength = null;
    if (tqSelectedCategory == null) { tqSelectedCategory = "gemischt"; }
    renderTextQuizSetup();
    showSelectScreen("text");
}

function renderTextQuizSetup() {

    const stepCat = document.getElementById("tq-step-category");
    const stepLen = document.getElementById("tq-step-length");
    const lengthsEl = document.getElementById("text-quiz-lengths");
    const catsEl = document.getElementById("text-quiz-categories");
    const chosenEl = document.getElementById("tq-chosen-category");
    const hintEl = document.getElementById("text-quiz-hint");

    if (!lengthsEl || !catsEl || typeof TEXT_QUIZ_LENGTHS === "undefined") {
        return;
    }

    if (stepCat) { stepCat.hidden = tqStep !== "category"; }
    if (stepLen) { stepLen.hidden = tqStep !== "length"; }

    // --- Schritt 1: Themen ---
    catsEl.innerHTML = "";
    TEXT_QUIZ_CATEGORIES.forEach(function (cat) {

        const avail = tqCatAvailability(cat.id);
        const anyLength = avail.lengths.kurz || avail.lengths.mittel || avail.lengths.gross;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-choice quiz-choice--category";
        btn.dataset.category = cat.id;
        btn.disabled = !anyLength;
        btn.setAttribute("aria-pressed", String(tqSelectedCategory === cat.id && tqStep === "length"));
        btn.textContent = cat.icon + " " + cat.label;

        btn.addEventListener("click", function () {
            if (btn.disabled) { return; }
            tqSelectedCategory = cat.id;
            tqSelectedLength = null;
            tqStep = "length";
            renderTextQuizSetup();
        });

        catsEl.appendChild(btn);
    });

    if (tqStep !== "length") { return; }

    // --- Schritt 2: Länge (klick startet die Runde) ---
    const catDef = tqCategoryDef(tqSelectedCategory);
    if (chosenEl) {
        chosenEl.textContent = catDef ? (catDef.icon + " " + catDef.label + " · ") : "";
    }

    const avail = tqCatAvailability(tqSelectedCategory);

    lengthsEl.innerHTML = "";
    TEXT_QUIZ_LENGTHS.forEach(function (len) {

        const canFill = avail.lengths[len.id];

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-choice quiz-choice--length";
        btn.dataset.length = len.id;
        btn.disabled = !canFill;
        btn.innerHTML =
            '<span class="quiz-choice-title">' + len.label + "</span>" +
            '<span class="quiz-choice-note">' + len.note + "</span>";

        btn.addEventListener("click", function () {
            if (btn.disabled) { return; }
            tqSelectedLength = len.id;
            startTextQuizRound(len.id, tqSelectedCategory);
        });

        lengthsEl.appendChild(btn);
    });

    // --- Hinweis, wenn eine Länge für dieses Thema (noch) nicht reicht ---
    if (hintEl) {
        const missing = TEXT_QUIZ_LENGTHS
            .filter(function (l) { return !avail.lengths[l.id]; })
            .map(function (l) { return l.label + " (" + l.count + ")"; });
        if (missing.length && tqSelectedCategory !== "gemischt") {
            hintEl.hidden = false;
            hintEl.textContent =
                "„" + missing.join("“ und „") + "“ gibt es zu diesem Thema noch nicht - " +
                "Kuro sammelt noch mehr Fragen.";
        } else {
            hintEl.hidden = true;
        }
    }
}


/* =====================================================
   TEXT-QUIZ: RUNDE SPIELEN
   ===================================================== */

let tqRound = null;        // { questions, difficulty, lengthId, category, roundId }
let tqIndex = 0;
let tqScore = 0;
let tqAnswered = false;    // aktuelle Frage schon beantwortet?

function persistTextRound() {
    try {
        sessionStorage.setItem(TEXT_QUIZ_SESSION_KEY, JSON.stringify({
            round: tqRound,
            index: tqIndex,
            score: tqScore
        }));
    } catch (e) {}
}

function clearTextRound() {
    try { sessionStorage.removeItem(TEXT_QUIZ_SESSION_KEY); } catch (e) {}
}

function startTextQuizRound(lengthId, categoryId) {

    if (typeof buildTextQuizRound !== "function") { return; }

    const round = buildTextQuizRound(lengthId, categoryId);

    if (!round) {
        // Sollte durch die deaktivierten Knoepfe nicht passieren -
        // trotzdem freundlich abfangen.
        const hintEl = document.getElementById("text-quiz-hint");
        if (hintEl) {
            hintEl.hidden = false;
            hintEl.textContent = "Kuro sammelt noch mehr Fragen zu diesem Thema.";
        }
        return;
    }

    tqRound = round;
    tqIndex = 0;
    tqScore = 0;
    tqAnswered = false;

    persistTextRound();

    showGameScreen();
    showTextQuestion();
}

function resumeTextQuizRound(saved) {
    tqRound = saved.round;
    tqIndex = Math.min(saved.index || 0, tqRound.questions.length - 1);
    tqScore = saved.score || 0;
    tqAnswered = false;
    showGameScreen();
    showTextQuestion();
}

function showTextQuestion() {

    const q = tqRound.questions[tqIndex];
    const container = quizEls.container;
    container.innerHTML = "";
    tqAnswered = false;

    if (quizEls.progress) {
        quizEls.progress.style.display = "block";
        quizEls.progress.textContent =
            "Frage " + (tqIndex + 1) + " von " + tqRound.questions.length;
    }

    const title = document.createElement("h2");
    title.textContent = "Frage " + (tqIndex + 1);
    container.appendChild(title);

    const questionText = document.createElement("p");
    questionText.className = "quiz-question-text";
    questionText.textContent = q.question;
    container.appendChild(questionText);

    const answersWrap = document.createElement("div");
    answersWrap.className = "quiz-answers";

    q.answers.forEach(function (answerText, i) {

        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = answerText;

        btn.addEventListener("click", function () {
            handleTextAnswer(i, btn, answersWrap);
        });

        answersWrap.appendChild(btn);
    });

    container.appendChild(answersWrap);
}

function handleTextAnswer(chosenIndex, button, answersWrap) {

    if (tqAnswered) { return; }
    tqAnswered = true;

    const q = tqRound.questions[tqIndex];
    const isCorrect = chosenIndex === q.correctIndex;

    const buttons = answersWrap.querySelectorAll("button");
    buttons.forEach(function (b, i) {
        b.disabled = true;
        if (i === q.correctIndex) { b.classList.add("correct"); }
        else if (i === chosenIndex) { b.classList.add("wrong"); }
    });

    if (isCorrect) {
        tqScore++;
        // Coins pro richtiger Antwort - wie im bisherigen Quiz.
        window.dispatchEvent(new CustomEvent("mirelon:earn-coins", {
            detail: { amount: 1, reason: "quiz_correct" }
        }));
        if (typeof playCorrectSound === "function") { playCorrectSound(); }
    } else if (typeof playWrongSound === "function") {
        playWrongSound();
    }

    persistTextRound();

    // Erklaerung anzeigen
    const explain = document.createElement("div");
    explain.className = "quiz-explanation" + (isCorrect ? " is-correct" : " is-wrong");
    const line = document.createElement("p");
    line.textContent = (isCorrect ? "Richtig! " : "Nicht ganz. ") + q.explanation;
    explain.appendChild(line);

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "yj-button yj-button--compact quiz-next-button";
    const isLast = tqIndex >= tqRound.questions.length - 1;
    nextBtn.textContent = isLast ? "Ergebnis ansehen" : "Weiter";
    nextBtn.addEventListener("click", nextTextQuestion);
    explain.appendChild(nextBtn);

    quizEls.container.appendChild(explain);
    nextBtn.focus();
}

function nextTextQuestion() {

    const container = quizEls.container;
    container.classList.add("fade-out");

    setTimeout(function () {
        tqIndex++;

        if (tqIndex < tqRound.questions.length) {
            persistTextRound();
            showTextQuestion();
        } else {
            showTextResults();
        }

        container.classList.remove("fade-out");
    }, 250);
}

function showTextResults() {

    const total = tqRound.questions.length;
    const ratio = total > 0 ? tqScore / total : 0;
    const reachedMin = ratio >= 0.6;

    // Runde abgeschlossen: Zaehler/Highscore + XP (nur ab 60 %).
    if (typeof registerTextQuizCompletion === "function") {
        registerTextQuizCompletion(tqRound.roundId, tqRound.difficulty, reachedMin);
    }

    clearTextRound();

    const container = quizEls.container;
    container.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = "Geschafft!";
    container.appendChild(title);

    const scoreLine = document.createElement("p");
    scoreLine.className = "quiz-result-score";
    scoreLine.textContent = tqScore + " von " + total + " richtig";
    container.appendChild(scoreLine);

    const msg = document.createElement("p");
    msg.className = "quiz-result-message";
    if (reachedMin) {
        msg.textContent = "Stark! Du hast genug richtig - deine Sterne (XP) sind unterwegs.";
    } else {
        msg.textContent =
            "Diesmal hat es noch nicht für Sterne gereicht - dafür braucht Kuro " +
            "mindestens 6 von 10 richtigen Antworten. Probier es gern gleich noch einmal!";
    }
    container.appendChild(msg);

    const againBtn = document.createElement("button");
    againBtn.type = "button";
    againBtn.className = "yj-button yj-button--compact";
    againBtn.textContent = "Noch eine Runde";
    againBtn.addEventListener("click", function () {
        enterTextQuizSetup();
    });
    container.appendChild(againBtn);

    const homeBtn = document.createElement("button");
    homeBtn.type = "button";
    homeBtn.className = "yj-button yj-button--secondary yj-button--compact";
    homeBtn.textContent = "Zurück zur Quiz-Auswahl";
    homeBtn.addEventListener("click", function () { showSelectScreen("landing"); });
    container.appendChild(homeBtn);

    tqRound = null;
}


/* =====================================================
   GERAEUSCHE-QUIZ  (unveraendert im Ablauf)
   ===================================================== */

let gqQuiz = [];
let gqId = null;
let gqIndex = 0;
let gqScore = 0;
let gqAudio = null;

function openGeraeuscheQuiz() {

    const list = (typeof geraeuscheQuizzes !== "undefined") ? geraeuscheQuizzes : [];

    if (list.length === 1) {
        startGeraeuscheQuiz(list[0].id);
        return;
    }

    // Mehrere Geraeusche-Quizze -> Liste zeigen
    const listEl = document.getElementById("geraeusche-list");
    if (listEl) {
        listEl.innerHTML = "";
        list.forEach(function (entry) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "quiz-choice";
            btn.textContent = entry.icon + " " + entry.label;
            btn.addEventListener("click", function () { startGeraeuscheQuiz(entry.id); });
            listEl.appendChild(btn);
        });
    }
    showSelectScreen("geraeusche");
}

function startGeraeuscheQuiz(quizId) {

    const list = (typeof geraeuscheQuizzes !== "undefined") ? geraeuscheQuizzes : [];
    const entry = list.find(function (q) { return q.id === quizId; });
    if (!entry) { return; }

    gqQuiz = quizShuffle(entry.quiz).map(function (question) {
        return Object.assign({}, question, { answers: quizShuffle(question.answers) });
    });
    gqId = quizId;
    gqIndex = 0;
    gqScore = 0;

    showGameScreen();
    showGeraeuscheQuestion();
}

function showGeraeuscheQuestion() {

    const q = gqQuiz[gqIndex];
    const container = quizEls.container;
    container.innerHTML = "";

    if (quizEls.progress) {
        quizEls.progress.style.display = "block";
        quizEls.progress.textContent =
            "Frage " + (gqIndex + 1) + " von " + gqQuiz.length;
    }

    const title = document.createElement("h2");
    title.textContent = "Frage " + (gqIndex + 1);
    container.appendChild(title);

    if (q.sound) {
        if (gqAudio) { gqAudio.pause(); }
        gqAudio = new Audio(q.sound);

        const playButton = document.createElement("button");
        playButton.type = "button";
        playButton.className = "yj-button quiz-sound-button";
        playButton.textContent = "🔊 Geräusch anhören";
        playButton.onclick = function () {
            gqAudio.currentTime = 0;
            gqAudio.play().catch(function () {});
        };
        container.appendChild(playButton);

        gqAudio.play().catch(function () {});
    }

    const questionText = document.createElement("p");
    questionText.textContent = q.question;
    container.appendChild(questionText);

    const answersWrap = document.createElement("div");
    answersWrap.className = "quiz-answers";

    q.answers.forEach(function (answer) {
        const button = document.createElement("button");
        const span = document.createElement("span");
        span.textContent = answer.text;
        button.appendChild(span);
        button.onclick = function () { checkGeraeuscheAnswer(answer.correct, button); };
        answersWrap.appendChild(button);
    });

    container.appendChild(answersWrap);
}

function checkGeraeuscheAnswer(isCorrect, button) {

    if (isCorrect) {
        button.classList.add("correct");
        gqScore++;
        window.dispatchEvent(new CustomEvent("mirelon:earn-coins", {
            detail: { amount: 1, reason: "quiz_correct" }
        }));
        if (typeof playCorrectSound === "function") { playCorrectSound(); }
    } else {
        button.classList.add("wrong");
        if (typeof playWrongSound === "function") { playWrongSound(); }
    }

    quizEls.container.querySelectorAll("button").forEach(function (btn) {
        btn.disabled = true;
    });

    setTimeout(nextGeraeuscheQuestion, 1000);
}

function nextGeraeuscheQuestion() {

    const container = quizEls.container;
    container.classList.add("fade-out");

    setTimeout(function () {
        gqIndex++;
        if (gqIndex < gqQuiz.length) {
            showGeraeuscheQuestion();
        } else {
            showGeraeuscheResults();
        }
        container.classList.remove("fade-out");
    }, 300);
}

function showGeraeuscheResults() {

    if (typeof registerQuizCompletion === "function") {
        registerQuizCompletion(gqId);
    }

    const container = quizEls.container;
    container.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = "Ergebnis";
    container.appendChild(title);

    const resultText = document.createElement("p");
    resultText.textContent = gqScore + " von " + gqQuiz.length + " korrekt";
    container.appendChild(resultText);

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "yj-button yj-button--compact";
    backButton.textContent = "Zurück zur Quiz-Auswahl";
    backButton.onclick = function () { exitQuiz(); };
    container.appendChild(backButton);
}


/* =====================================================
   QUIZ VERLASSEN (gemeinsam)
   ===================================================== */

function exitQuiz() {

    if (gqAudio) {
        gqAudio.pause();
        gqAudio = null;
    }

    // Laufende Text-Runde bewusst abbrechen -> kein Wiederaufnehmen,
    // keine XP (Runde nicht abgeschlossen).
    clearTextRound();
    tqRound = null;

    showSelectScreen("landing");
}

(function () {
    const exitButton = document.getElementById("quiz-exit-button");
    if (exitButton) { exitButton.addEventListener("click", exitQuiz); }
})();


/* =====================================================
   START / RELOAD-BEHANDLUNG
   Laeuft eine Text-Runde (in sessionStorage)? -> sauber
   fortsetzen. Sonst normale Landing-Ansicht.
   ===================================================== */

(function () {
    let saved = null;
    try {
        const raw = sessionStorage.getItem(TEXT_QUIZ_SESSION_KEY);
        if (raw) { saved = JSON.parse(raw); }
    } catch (e) { saved = null; }

    if (saved && saved.round &&
        Array.isArray(saved.round.questions) &&
        saved.round.questions.length > 0) {
        resumeTextQuizRound(saved);
    } else {
        clearTextRound();
        showSelectScreen("landing");
    }
})();
