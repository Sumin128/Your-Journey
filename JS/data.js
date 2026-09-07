/* =====================================================
   KURO
   Alle Texte und Dialoge von Kuro
   ===================================================== */

   /* =====================================================
   KURO
   ===================================================== */

// Begrüßungen von Kuro

const welcomeMessages = [

    "Heute wartet ein neues Abenteuer auf dich!",
    "Bereit, Münzen zu sammeln?",
    "Ich freue mich, dass du wieder da bist!",
    "Mal sehen, wie viele Fragen du heute schaffst!",
    "Gemeinsam schaffen wir das!",
    "Ich habe schon auf dich gewartet!",
    "Was für ein toller Tag zum Lernen!",
    "Bist du auch so motiviert wie ich?"

];
const kuro = {

    name: "Kuro",

    welcome: [
        "Heute wartet ein neues Abenteuer auf dich!",
        "Bereit, Münzen zu sammeln?",
        "Ich freue mich, dass du wieder da bist!",
        "Mal sehen, wie viele Fragen du heute schaffst!",
        "Gemeinsam schaffen wir das!",
        "Ich habe schon auf dich gewartet!",
        "Was für ein toller Tag zum Lernen!",
        "Bist du auch so motiviert wie ich?"
    ],

    correct: [
        "Super gemacht! 🪙",
        "Genau richtig!",
        "Klasse! Weiter so!",
        "Das war richtig!",
        "Du wirst immer besser!"
    ],

    wrong: [
        "Fast geschafft!",
        "Das war nicht ganz richtig.",
        "Kein Problem, wir lernen gemeinsam!",
        "Beim nächsten Mal klappt es!"
    ],

    finish: [
        "Ich bin stolz auf dich!",
        "Das war ein tolles Quiz!",
        "Lass uns gleich noch eins machen!",
        "Du hast das super gemacht!"
    ]

};


/* =====================================================
   AVATARE
   Alle verfügbaren Spielfiguren
   ===================================================== */

   /* =====================================================
   AVATARE
   ===================================================== */

const characters = [

    {
        id: 1,
        image: "avatare/avatar1.PNG"
    },

    {
        id: 2,
        image: "avatare/avatar2.PNG"
    },

    {
        id: 3,
        image: "avatare/avatar3.PNG"
    },

    {
        id: 4,
        image: "avatare/avatar4.PNG"
    },

    {
        id: 5,
        image: "avatare/avatar5.PNG"
    },

    {
        id: 6,
        image: "avatare/avatar6.PNG"
    },

    {
        id: 7,
        image: "avatare/avatar7.PNG"
    },

    {
        id: 8,
        image: "avatare/avatar8.PNG"
    },

    {
        id: 9,
        image: "avatare/avatar9.PNG"
    }

];




/* =====================================================
   GERÄUSCHEQUIZ
   Früher bei Faro, jetzt bei Kuro im Reiter "Geräusche".
   Statt eines Bildes hat jede Frage ein "sound" - JS/quiz.js
   zeigt dann einen "Geräusch anhören"-Knopf.
   Audiodateien: Sounds/Fuchsbau_quiz/
   ===================================================== */

const quizTiergeraeusche = [

    { sound: "Sounds/Fuchsbau_quiz/dog.mp3", question: "Welches Tier macht dieses Geräusch?", answers: [
        { text: "Hund", correct: true }, { text: "Katze", correct: false }, { text: "Krähe", correct: false }, { text: "Eule", correct: false }
    ]},

    { sound: "Sounds/Fuchsbau_quiz/cat.mp3", question: "Welches Tier macht dieses Geräusch?", answers: [
        { text: "Katze", correct: true }, { text: "Marder", correct: false }, { text: "Spatz", correct: false }, { text: "Pferd", correct: false }
    ]},

    { sound: "Sounds/Fuchsbau_quiz/crow.mp3", question: "Welches Tier macht dieses Geräusch?", answers: [
        { text: "Krähe", correct: true }, { text: "Eichhörnchen", correct: false }, { text: "Giraffe", correct: false }, { text: "Leopard", correct: false }
    ]},

    { sound: "Sounds/Fuchsbau_quiz/owl.mp3", question: "Welches Tier macht dieses Geräusch?", answers: [
        { text: "Eule", correct: true }, { text: "Adler", correct: false }, { text: "Kaninchen", correct: false }, { text: "Hamster", correct: false }
    ]},

    { sound: "Sounds/Fuchsbau_quiz/monkey.mp3", question: "Welches Tier macht dieses Geräusch?", answers: [
        { text: "Affe", correct: true }, { text: "Luchs", correct: false }, { text: "Giraffe", correct: false }, { text: "Fuchs", correct: false }
    ]},

    { sound: "Sounds/Fuchsbau_quiz/mouse.mp3", question: "Welches Tier macht dieses Geräusch?", answers: [
        { text: "Maus", correct: true }, { text: "Elster", correct: false }, { text: "Hase", correct: false }, { text: "Wal", correct: false }
    ]},

    { sound: "Sounds/Fuchsbau_quiz/bear.mp3", question: "Welches Tier macht dieses Geräusch?", answers: [
        { text: "Bär", correct: true }, { text: "Panther", correct: false }, { text: "Elch", correct: false }, { text: "Fuchs", correct: false }
    ]},

    { sound: "Sounds/Fuchsbau_quiz/wolf.mp3", question: "Welches Tier macht dieses Geräusch?", answers: [
        { text: "Wolf", correct: true }, { text: "Hund", correct: false }, { text: "Löwe", correct: false }, { text: "Panther", correct: false }
    ]}

];


/* =====================================================
   GERÄUSCHE-QUIZ-KATALOG
   Nur noch das Geräusche-Quiz läuft über diese Struktur
   (JS/quiz.js). Das Text-Quiz nutzt seit 2026 den zentralen
   Fragenkatalog in JS/quiz-catalog.js.
   ===================================================== */

const geraeuscheQuizzes = [
    { id: "tiergeraeusche", label: "Tiergeräusche", icon: "🔊", quiz: quizTiergeraeusche }
];


