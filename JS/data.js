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
    "Bereit, Federn zu sammeln?",
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
        "Bereit, Federn zu sammeln?",
        "Ich freue mich, dass du wieder da bist!",
        "Mal sehen, wie viele Fragen du heute schaffst!",
        "Gemeinsam schaffen wir das!",
        "Ich habe schon auf dich gewartet!",
        "Was für ein toller Tag zum Lernen!",
        "Bist du auch so motiviert wie ich?"
    ],

    correct: [
        "Super gemacht! 🪶",
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
   QUIZ - ALLGEMEINWISSEN
   ===================================================== */


   /* =====================================================
   QUIZ - ALLGEMEINWISSEN (für Kinder)
   ===================================================== */

const quizAllgemeinwissen = [

    {
        question: "Wo lernt man?",

        answers: [
            { text: "Im Supermarkt", correct: false },
            { text: "Im Kino", correct: false },
            { text: "In der Schule", correct: true },
            { text: "Im Auto", correct: false }
        ]
    },

    {
        question: "Welches Tier sagt 'miau'?",

        answers: [
            { text: "Hund", correct: false },
            { text: "Katze", correct: true },
            { text: "Kuh", correct: false },
            { text: "Vogel", correct: false }
        ]
    },

    {
        question: "Welche Farbe hat die Sonne ?",

        answers: [
            { text: "Blau", correct: false },
            { text: "Gelb", correct: true },
            { text: "Grün", correct: false },
            { text: "Lila", correct: false }
        ]
    },

    {
        question: "Womit schreibt man in der Schule?",

        answers: [
            { text: "Mit einem Stift", correct: true },
            { text: "Mit einer Gabel", correct: false },
            { text: "Mit einem Löffel", correct: false },
            { text: "Mit einem Schuh", correct: false }
        ]
    },

    {
        question: "Wie viele Beine hat ein Hund?",

        answers: [
            { text: "2", correct: false },
            { text: "4", correct: true },
            { text: "6", correct: false },
            { text: "8", correct: false }
        ]
    },

    {
        question: "Welches Fahrzeug fährt auf Schienen?",

        answers: [
            { text: "Auto", correct: false },
            { text: "Fahrrad", correct: false },
            { text: "Zug", correct: true },
            { text: "Boot", correct: false }
        ]
    },

    {
        question: "Was trägt man an den Füßen?",

        answers: [
            { text: "Hut", correct: false },
            { text: "Handschuhe", correct: false },
            { text: "Schuhe", correct: true },
            { text: "Brille", correct: false }
        ]
    },

    {
        question: "Was trinkt man oft aus einer Tasse?",

        answers: [
            { text: "Murmeln", correct: false },
            { text: "Tee", correct: true },
            { text: "Sand", correct: false },
            { text: "Stein", correct: false }
        ]
    },

    {
        question: "Welcher Ort hat viele Bücher?",

        answers: [
            { text: "Bibliothek", correct: true },
            { text: "Sportplatz", correct: false },
            { text: "Schwimmbad", correct: false },
            { text: "Park", correct: false }
        ]
    }

];

/* =====================================================
    QUIZ - FILM-CHARAKTERE (Kinder)
    ===================================================== */

const quizFilmCharaktere = [

    {
        question: "Welche Kraft hat Elsa aus 'Die Eiskönigin'?",

        answers: [
            { text: "Feuerzauber", correct: false },
            { text: "Eiszauber", correct: true },
            { text: "Wasseratmung", correct: false },
            { text: "Unsichtbarkeit", correct: false }
        ]
    },

    {
        question: "Welche Farbe hat Stitchs Fell?",

        answers: [
            { text: "Grün", correct: false },
            { text: "Blau", correct: true },
            { text: "Braun", correct: false },
            { text: "Gelb", correct: false }
        ]
    },

    {
        question: "Welches Tier ist Simba in 'Der König der ....'?",
        answers: [
            { text: "Elefanten", correct: false },
            { text: "Löwen", correct: true },
            { text: "Affen", correct: false },
            { text: "Zebras", correct: false }
        ]
    },

    {
        question: "Welches Instrument spielt 'Coco'?",
        answers: [
            { text: "Gitarre", correct: true },
            { text: "Trompete", correct: false },
            { text: "Klavier", correct: false },
            { text: "Geige", correct: false }
        ]
    },

    {
        question: "Welche Farbe hat Ariels Schwanzflosse ?",
        answers: [
            { text: "Pink", correct: false },
            { text: "Grün", correct: true },
            { text: "Lila", correct: false },
            { text: "Orange", correct: false }
        ]
    },

    {
        question: "Was ist Olafs Lieblingsjahreszeit?",
        answers: [
            { text: "Sommer", correct: true },
            { text: "Winter", correct: false },
            { text: "Herbst", correct: false },
            { text: "Frühling", correct: false }
        ]
    },

    {
        question: "Welche Farbe hat Cinderellas Kleid beim Ball?",
        answers: [
            { text: "Schwarz", correct: false },
            { text: "Blau", correct: true },
            { text: "Rot", correct: false },
            { text: "Gelb", correct: false }
        ]
    },

    {
        question: "Welches Fahrzeug ist Lightning McQueen?",
        answers: [
            { text: "Flugzeug", correct: false },
            { text: "Auto", correct: true },
            { text: "Boot", correct: false },
            { text: "Zug", correct: false }
        ]
    },

    {
        question: "Mit welchem Element ist 'Vaiana' verbunden?",
        answers: [
            { text: "Feuer", correct: false },
            { text: "Erde", correct: false },
            { text: "Wasser", correct: true },
            { text: "Wind", correct: false }
        ]
    }

];

/* =====================================================
   QUIZ - BUCHSTABEN & WÖRTER-DETEKTIVE (1. & 2. Klasse)
   ===================================================== */

const quizBuchstaben = [

    {
        question: "Welches Tier beginnt mit A?",

        answers: [
            { text: "Affe", correct: true },
            { text: "Katze", correct: false },
            { text: "Hund", correct: false },
            { text: "Maus", correct: false }
        ]
    },

    {
        question: "Was reimt sich auf 'Haus'?",

        answers: [
            { text: "Fenster", correct: false },
            { text: "Tisch", correct: false },
            { text: "Maus", correct: true },
            { text: "Auto", correct: false }
        ]
    },

    {
        question: "Wie viele Silben hat 'Schokolade'?",

        answers: [
            { text: "3", correct: false },
            { text: "5", correct: false },
            { text: "2", correct: false },
            { text: "4", correct: true }
        ]
    },

    {
        question: "Welches Wort beginnt mit B?",

        answers: [
            { text: "Ball", correct: true },
            { text: "Auto", correct: false },
            { text: "Tisch", correct: false },
            { text: "Zebra", correct: false }
        ]
    },

    {
        question: "Was reimt sich auf 'Ball'?",

        answers: [
            { text: "Tante", correct: false },
            { text: "Fall", correct: true },
            { text: "Sonne", correct: false },
            { text: "Haus", correct: false }
        ]
    },

    {
        question: "Wie viele Silben hat 'Banane'?",

        answers: [
            { text: "2", correct: false },
            { text: "3", correct: true },
            { text: "4", correct: false },
            { text: "1", correct: false }
        ]
    },

    {
        question: "Welches Wort beginnt mit S?",

        answers: [
            { text: "Schule", correct: true },
            { text: "Haus", correct: false },
            { text: "Apfel", correct: false },
            { text: "Tisch", correct: false }
        ]
    },

    {
        question: "Was reimt sich auf 'Suppe'?",

        answers: [
            { text: "Stuhl", correct: false },
            { text: "Baum", correct: false },
            { text: "Puppe", correct: true },
            { text: "Lampe", correct: false }
        ]
    },

    {
        question: "Wie viele Silben hat 'Elefant'?",

        answers: [
            { text: "2", correct: false },
            { text: "3", correct: true },
            { text: "4", correct: false },
            { text: "1", correct: false }
        ]
    }

];

/* =====================================================
   QUIZ - BERUFE (Kinder)
   ===================================================== */

const quizBerufe = [

    {
        question: "Wer löscht das Feuer?",

        answers: [
            { text: "Polizist", correct: false },
            { text: "Feuerwehr", correct: true },
            { text: "Bäcker", correct: false },
            { text: "Lehrer", correct: false }
        ]
    },

    {
        question: "Wer bringt die Post?",

        answers: [
            { text: "Arzt", correct: false },
            { text: "Friseur", correct: false },
            { text: "Mechaniker", correct: false },
            { text: "Postbote", correct: true }
        ]
    },

    {
        question: "Wer hilft kranken Tieren?",

        answers: [
            { text: "Tierarzt", correct: true },
            { text: "Gärtner", correct: false },
            { text: "Pilot", correct: false },
            { text: "Koch", correct: false }
        ]
    },

    {
        question: "Wer unterrichtet in der Schule?",

        answers: [
            { text: "Zahnarzt", correct: false },
            { text: "Lehrer", correct: true },
            { text: "Briefträger", correct: false },
            { text: "Polizist", correct: false }
        ]
    },

    {
        question: "Wer fährt den Krankenwagen?",

        answers: [
            { text: "Sanitäter", correct: true },
            { text: "Bauarbeiter", correct: false },
            { text: "Friseur", correct: false },
            { text: "Lehrer", correct: false }
        ]
    },

    {
        question: "Wer pflanzt Bäume und pflegt Gärten?",

        answers: [
            { text: "Richter", correct: false },
            { text: "Feuerwehr", correct: false },
            { text: "Gärtner", correct: true },
            { text: "Kassiererin", correct: false }
        ]
    },

    {
        question: "Wer repariert Autos?",

        answers: [
            { text: "Mechaniker", correct: true },
            { text: "Pilot", correct: false },
            { text: "Lehrer", correct: false },
            { text: "Bäcker", correct: false }
        ]
    },

    {
        question: "Wer kocht oft in Restaurants?",

        answers: [
            { text: "Tierarzt", correct: false },
            { text: "Postbote", correct: false },
            { text: "Elektriker", correct: false },
            { text: "Koch", correct: true }
        ]
    },

    {
        question: "Wer baut Häuser?",

        answers: [
            { text: "Mechaniker", correct: false },
            { text: "Bauarbeiter", correct: true },
            { text: "Arzt", correct: false },
            { text: "Bäcker", correct: false }
        ]
    }

];


/* =====================================================
   QUIZ - TIERE
   ===================================================== */

const quizTiere = [

    {
        question: "Welches Tier ist das?",
        image: "Katze_quiz.jpg",

        answers: [
            { text: "Löwe", correct: false },
            { text: "Hase", correct: false },
            { text: "Katze", correct: true },
            { text: "Pferd", correct: false }
        ]
    },

    {
        question: "Wo lebt ein Delfin?",
        image: "https://images.unsplash.com/photo-1591706405280-f03acb082051?q=80&w=1186&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        answers: [
            { text: "In der Luft", correct: false },
            { text: "Am Strand", correct: false },
            { text: "Im Wald", correct: false },
            { text: "Im Wasser", correct: true }
        ]
    },

    {
        question: "Welches Tier legt Eier?",
        image: "https://images.unsplash.com/photo-1504980927740-d1cc11dccf63?q=80&w=1077&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        answers: [
            { text: "Katze", correct: false },
            { text: "Huhn", correct: true },
            { text: "Hund", correct: false },
            { text: "Hase", correct: false }
        ]
    },

    {
        question: "Welches Tier hat Streifen?",
        image: "https://images.unsplash.com/photo-1450704944629-6a65f6810cf2?q=80&w=1167&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        answers: [
            { text: "Katze", correct: false },
            { text: "Huhn", correct: false },
            { text: "Zebra", correct: true },
            { text: "Hase", correct: false }
        ]
    },

    {
        question: "Welches Tier trägt seinen Panzer auf dem Rücken?",
        image: "https://images.unsplash.com/photo-1706518503834-fc7587c5c6dc?q=80&w=690&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        answers: [
            { text: "Katze", image: "", correct: false },
            { text: "Huhn", image: "", correct: false },
            { text: "Schildkröte", image: "", correct: true },
            { text: "Hase", image: "", correct: false }
        ]
    },

    {
        question: "Welches Tier kann fliegen?",
        image: "https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        answers: [
            {
                text: "Delfin",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-delfin-48.png",
                correct: false
            },
            {
                text: "Adler",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-adler-64.png",
                correct: true
            },
            {
                text: "Löwe",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-l_we-48.png",
                correct: false
            },
            {
                text: "Hase",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-kaninchen-emoji-48.png",
                correct: false
            }
        ]
    },

    {
        question: "Welches Tier hat einen langen Hals?",
        image: "https://images.unsplash.com/photo-1652077859695-de2851a95620?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        answers: [
            { text: "Delfin", correct: false },
            { text: "Marder", correct: false },
            { text: "Giraffe", correct: true },
            { text: "Gans", correct: false }
        ]
    },

    {
        question: "Welches Tier lebt am Nordpol?",
        image: "https://images.unsplash.com/photo-1504964306813-50d4333f6968?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        answers: [
            {
                text: "Löwe",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-l_we-48.png",
                correct: false
            },
            {
                text: "Tiger",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-tiger-emoji-48.png",
                correct: false
            },
            {
                text: "Känguru",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-k_nguru-48.png",
                correct: false
            },
            {
                text: "Eisbär",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-eisb_r-64.png",
                correct: true
            }
        ]
    },

    {
        question: "Was frisst ein Panda am liebsten?",
        image: "https://images.unsplash.com/photo-1703248187251-c897f32fe4ec?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        answers: [
            {
                text: "Knochen",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-bones-64.png",
                correct: false
            },
            {
                text: "Bambus",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-bambus-48.png",
                correct: true
            },
            {
                text: "Wurm",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-erdwurm-40.png",
                correct: false
            },
            {
                text: "Nüsse",
                image: "https://019f8dcc-b849-7c41-990e-d9aa39b36958.codepenusercontent.com/Icons/icons8-haselnuss-40.png",
                correct: false
            }
        ]
    }

];

/* =====================================================
   QUIZ - MATHE 1. KLASSE
   ===================================================== */

const Mathe1Klasse = [

    {
        question: "2 + 3 =",
        image: "",

        answers: [
            { text: "5", correct: true },
            { text: "6", correct: false },
            { text: "4", correct: false },
            { text: "8", correct: false }
        ]
    },

    {
        question: "5 + 4",
        image: "",

        answers: [
            { text: "2", correct: false },
            { text: "5", correct: false },
            { text: "12", correct: false },
            { text: "9", correct: true }
        ]
    },

    {
        question: "5 - 2",
        image: "",

        answers: [
            { text: "2", correct: false },
            { text: "3", correct: true },
            { text: "4", correct: false },
            { text: "5", correct: false }
        ]
    },

    {
        question: "4 + 2",
        image: "",

        answers: [
            { text: "6", correct: true },
            { text: "2", correct: false },
            { text: "9", correct: false },
            { text: "8", correct: false }
        ]
    },

    {
        question: "5 + 5",
        image: "",

        answers: [
            { text: "5", correct: false },
            { text: "10", correct: true },
            { text: "3", correct: false },
            { text: "2", correct: false }
        ]
    },

    {
        question: "8 - 4",
        image: "",

        answers: [
            { text: "3", correct: false },
            { text: "4", correct: true },
            { text: "9", correct: false },
            { text: "5", correct: false }
        ]
    },

    {
        question: "7 + 2",
        image: "",

        answers: [
            { text: "6", correct: false },
            { text: "7", correct: false },
            { text: "9", correct: true },
            { text: "13", correct: false }
        ]
    },

    {
        question: "9 - 2",
        image: "",

        answers: [
            { text: "2", correct: false },
            { text: "4", correct: false },
            { text: "8", correct: false },
            { text: "7", correct: true }
        ]
    },

    {
        question: "6 + 1",
        image: "",

        answers: [
            { text: "5", correct: false },
            { text: "7", correct: true },
            { text: "4", correct: false },
            { text: "5", correct: false }
        ]
    }

];


/* =====================================================
   MATHE – PLUS
   ===================================================== */

const quizMathePlus = [

    { question: "3 + 4 =", image: "", answers: [
        { text: "6", correct: false }, { text: "7", correct: true }, { text: "8", correct: false }, { text: "5", correct: false }
    ]},

    { question: "6 + 2 =", image: "", answers: [
        { text: "8", correct: true }, { text: "7", correct: false }, { text: "9", correct: false }, { text: "6", correct: false }
    ]},

    { question: "5 + 5 =", image: "", answers: [
        { text: "9", correct: false }, { text: "10", correct: true }, { text: "11", correct: false }, { text: "15", correct: false }
    ]},

    { question: "7 + 3 =", image: "", answers: [
        { text: "9", correct: false }, { text: "11", correct: false }, { text: "10", correct: true }, { text: "8", correct: false }
    ]},

    { question: "2 + 6 =", image: "", answers: [
        { text: "8", correct: true }, { text: "4", correct: false }, { text: "7", correct: false }, { text: "9", correct: false }
    ]},

    { question: "8 + 1 =", image: "", answers: [
        { text: "7", correct: false }, { text: "9", correct: true }, { text: "10", correct: false }, { text: "8", correct: false }
    ]},

    { question: "4 + 4 =", image: "", answers: [
        { text: "8", correct: true }, { text: "6", correct: false }, { text: "10", correct: false }, { text: "4", correct: false }
    ]},

    { question: "9 + 3 =", image: "", answers: [
        { text: "11", correct: false }, { text: "13", correct: false }, { text: "12", correct: true }, { text: "10", correct: false }
    ]}

];


/* =====================================================
   MATHE – MINUS
   ===================================================== */

const quizMatheMinus = [

    { question: "9 - 3 =", image: "", answers: [
        { text: "5", correct: false }, { text: "6", correct: true }, { text: "7", correct: false }, { text: "4", correct: false }
    ]},

    { question: "8 - 5 =", image: "", answers: [
        { text: "2", correct: false }, { text: "3", correct: true }, { text: "4", correct: false }, { text: "1", correct: false }
    ]},

    { question: "10 - 4 =", image: "", answers: [
        { text: "5", correct: false }, { text: "7", correct: false }, { text: "6", correct: true }, { text: "4", correct: false }
    ]},

    { question: "7 - 2 =", image: "", answers: [
        { text: "4", correct: false }, { text: "5", correct: true }, { text: "6", correct: false }, { text: "3", correct: false }
    ]},

    { question: "6 - 6 =", image: "", answers: [
        { text: "1", correct: false }, { text: "0", correct: true }, { text: "6", correct: false }, { text: "2", correct: false }
    ]},

    { question: "12 - 5 =", image: "", answers: [
        { text: "6", correct: false }, { text: "8", correct: false }, { text: "7", correct: true }, { text: "5", correct: false }
    ]},

    { question: "9 - 7 =", image: "", answers: [
        { text: "3", correct: false }, { text: "2", correct: true }, { text: "1", correct: false }, { text: "4", correct: false }
    ]},

    { question: "10 - 10 =", image: "", answers: [
        { text: "10", correct: false }, { text: "1", correct: false }, { text: "0", correct: true }, { text: "5", correct: false }
    ]}

];


/* =====================================================
   MATHE – MAL
   ===================================================== */

const quizMatheMal = [

    { question: "2 × 3 =", image: "", answers: [
        { text: "5", correct: false }, { text: "6", correct: true }, { text: "8", correct: false }, { text: "9", correct: false }
    ]},

    { question: "4 × 2 =", image: "", answers: [
        { text: "6", correct: false }, { text: "8", correct: true }, { text: "10", correct: false }, { text: "4", correct: false }
    ]},

    { question: "5 × 1 =", image: "", answers: [
        { text: "5", correct: true }, { text: "1", correct: false }, { text: "0", correct: false }, { text: "6", correct: false }
    ]},

    { question: "3 × 3 =", image: "", answers: [
        { text: "6", correct: false }, { text: "9", correct: true }, { text: "12", correct: false }, { text: "3", correct: false }
    ]},

    { question: "2 × 5 =", image: "", answers: [
        { text: "10", correct: true }, { text: "7", correct: false }, { text: "8", correct: false }, { text: "12", correct: false }
    ]},

    { question: "4 × 4 =", image: "", answers: [
        { text: "12", correct: false }, { text: "16", correct: true }, { text: "8", correct: false }, { text: "20", correct: false }
    ]},

    { question: "3 × 2 =", image: "", answers: [
        { text: "5", correct: false }, { text: "6", correct: true }, { text: "9", correct: false }, { text: "3", correct: false }
    ]},

    { question: "5 × 5 =", image: "", answers: [
        { text: "20", correct: false }, { text: "10", correct: false }, { text: "25", correct: true }, { text: "15", correct: false }
    ]}

];


/* =====================================================
   MATHE – GETEILT
   ===================================================== */

const quizMatheGeteilt = [

    { question: "6 ÷ 2 =", image: "", answers: [
        { text: "2", correct: false }, { text: "3", correct: true }, { text: "4", correct: false }, { text: "6", correct: false }
    ]},

    { question: "8 ÷ 4 =", image: "", answers: [
        { text: "1", correct: false }, { text: "2", correct: true }, { text: "4", correct: false }, { text: "3", correct: false }
    ]},

    { question: "10 ÷ 5 =", image: "", answers: [
        { text: "5", correct: false }, { text: "1", correct: false }, { text: "2", correct: true }, { text: "10", correct: false }
    ]},

    { question: "9 ÷ 3 =", image: "", answers: [
        { text: "2", correct: false }, { text: "3", correct: true }, { text: "4", correct: false }, { text: "6", correct: false }
    ]},

    { question: "12 ÷ 2 =", image: "", answers: [
        { text: "5", correct: false }, { text: "7", correct: false }, { text: "6", correct: true }, { text: "4", correct: false }
    ]},

    { question: "20 ÷ 4 =", image: "", answers: [
        { text: "4", correct: false }, { text: "6", correct: false }, { text: "5", correct: true }, { text: "8", correct: false }
    ]},

    { question: "15 ÷ 5 =", image: "", answers: [
        { text: "5", correct: false }, { text: "3", correct: true }, { text: "2", correct: false }, { text: "4", correct: false }
    ]},

    { question: "4 ÷ 1 =", image: "", answers: [
        { text: "1", correct: false }, { text: "0", correct: false }, { text: "4", correct: true }, { text: "2", correct: false }
    ]}

];


/* =====================================================
   SUPERHELDEN
   ===================================================== */

const quizSuperhelden = [

    { question: "Welcher Superheld wird auch \"Mann aus Stahl\" genannt und kann fliegen?", image: "", answers: [
        { text: "Batman", correct: false }, { text: "Superman", correct: true }, { text: "Spiderman", correct: false }, { text: "Iron Man", correct: false }
    ]},

    { question: "Welcher Superheld schießt Netze aus seinen Handgelenken?", image: "", answers: [
        { text: "Spiderman", correct: true }, { text: "Hulk", correct: false }, { text: "Thor", correct: false }, { text: "Flash", correct: false }
    ]},

    { question: "Welcher Superheld ist als Fledermaus-Detektiv in Gotham City unterwegs?", image: "", answers: [
        { text: "Iron Man", correct: false }, { text: "Batman", correct: true }, { text: "Wolverine", correct: false }, { text: "Aquaman", correct: false }
    ]},

    { question: "Welche Heldin trägt einen goldenen Lasso der Wahrheit?", image: "", answers: [
        { text: "Catwoman", correct: false }, { text: "Supergirl", correct: false }, { text: "Wonder Woman", correct: true }, { text: "Black Widow", correct: false }
    ]},

    { question: "Welcher Held wird riesig und grün, wenn er wütend wird?", image: "", answers: [
        { text: "Hulk", correct: true }, { text: "Thor", correct: false }, { text: "Superman", correct: false }, { text: "Groot", correct: false }
    ]},

    { question: "Welcher Held hat sich einen High-Tech-Anzug aus Metall gebaut?", image: "", answers: [
        { text: "Batman", correct: false }, { text: "Iron Man", correct: true }, { text: "Flash", correct: false }, { text: "Thor", correct: false }
    ]},

    { question: "Welcher Held ist blitzschnell unterwegs?", image: "", answers: [
        { text: "Flash", correct: true }, { text: "Hulk", correct: false }, { text: "Batman", correct: false }, { text: "Aquaman", correct: false }
    ]},

    { question: "Welcher Held trägt einen Hammer, den nur er heben kann?", image: "", answers: [
        { text: "Iron Man", correct: false }, { text: "Superman", correct: false }, { text: "Thor", correct: true }, { text: "Batman", correct: false }
    ]}

];


/* =====================================================
   SCHURKEN
   ===================================================== */

const quizSchurken = [

    { question: "Welcher Bösewicht hat grüne Haare und ein gruseliges Lachen?", image: "", answers: [
        { text: "Joker", correct: true }, { text: "Lex Luthor", correct: false }, { text: "Thanos", correct: false }, { text: "Green Goblin", correct: false }
    ]},

    { question: "Welcher Schurke trägt einen Handschuh, mit dem er das halbe Universum verschwinden lassen will?", image: "", answers: [
        { text: "Joker", correct: false }, { text: "Thanos", correct: true }, { text: "Darth Vader", correct: false }, { text: "Mr. Freeze", correct: false }
    ]},

    { question: "Welche Bösewichtin stiehlt gerne Diamanten und trägt ein Katzenkostüm?", image: "", answers: [
        { text: "Harley Quinn", correct: false }, { text: "Catwoman", correct: true }, { text: "Poison Ivy", correct: false }, { text: "Black Widow", correct: false }
    ]},

    { question: "Welcher Schurke reitet auf einem fliegenden Gleiter und trägt eine gruselige Maske?", image: "", answers: [
        { text: "Green Goblin", correct: true }, { text: "Venom", correct: false }, { text: "Loki", correct: false }, { text: "Bane", correct: false }
    ]},

    { question: "Welcher eiskalte Bösewicht kann alles einfrieren, was er berührt?", image: "", answers: [
        { text: "Mr. Freeze", correct: true }, { text: "Joker", correct: false }, { text: "Thanos", correct: false }, { text: "Bane", correct: false }
    ]},

    { question: "Welcher Schurke ist Supermans größter Feind und hat eine Glatze?", image: "", answers: [
        { text: "Joker", correct: false }, { text: "Lex Luthor", correct: true }, { text: "Loki", correct: false }, { text: "Thanos", correct: false }
    ]},

    { question: "Welche Bösewichtin liebt den Joker und trägt rot-schwarze Kleidung?", image: "", answers: [
        { text: "Catwoman", correct: false }, { text: "Poison Ivy", correct: false }, { text: "Harley Quinn", correct: true }, { text: "Black Widow", correct: false }
    ]},

    { question: "Welcher Bösewicht trägt eine schwarze Maske und atmet schwer durch einen Helm?", image: "", answers: [
        { text: "Darth Vader", correct: true }, { text: "Bane", correct: false }, { text: "Thanos", correct: false }, { text: "Loki", correct: false }
    ]}

];


/* =====================================================
   QUIZ-KATEGORIEN
   Ordnet die einzelnen Quizze zu Themenblöcken.
   Wird von JS/quiz.js benutzt, um die Kategorie- und
   Quiz-Auswahl bei Kuro anzuzeigen.
   ===================================================== */

const quizCategories = [

    {
        id: "mathe",
        label: "Mathe",
        icon: "🔢",
        quizzes: [
            { id: "mathePlus", label: "Plus", icon: "➕", quiz: quizMathePlus },
            { id: "matheMinus", label: "Minus", icon: "➖", quiz: quizMatheMinus },
            { id: "matheMal", label: "Mal", icon: "✖️", quiz: quizMatheMal },
            { id: "matheGeteilt", label: "Geteilt", icon: "➗", quiz: quizMatheGeteilt }
        ]
    },

    {
        id: "helden",
        label: "Helden & Schurken",
        icon: "🦸",
        quizzes: [
            { id: "superhelden", label: "Superhelden", icon: "🦸", quiz: quizSuperhelden },
            { id: "schurken", label: "Schurken", icon: "🦹", quiz: quizSchurken },
            { id: "filmcharaktere", label: "Film-Charaktere", icon: "🎬", quiz: quizFilmCharaktere }
        ]
    },

    {
        id: "wissen",
        label: "Wissen & Sprache",
        icon: "🧠",
        quizzes: [
            { id: "allgemeinwissen", label: "Allgemeinwissen", icon: "🧠", quiz: quizAllgemeinwissen },
            { id: "buchstaben", label: "Buchstaben & Wörter-Detektive", icon: "🔤", quiz: quizBuchstaben },
            { id: "berufe", label: "Berufe", icon: "🧰", quiz: quizBerufe },
            { id: "tiere", label: "Tiere", icon: "🦁", quiz: quizTiere }
        ]
    }

];


