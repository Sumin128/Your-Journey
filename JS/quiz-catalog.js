/* =====================================================
   KUROS TEXT-QUIZ - ZENTRALER FRAGENKATALOG
   =====================================================
   Ein grosser, erweiterbarer Katalog statt vieler getrennter
   Einzelquizze. Runden werden daraus zusammengestellt
   (Laenge + optionales Thema, siehe JS/quiz.js).

   Das GERAEUSCHE-Quiz ist davon voellig unabhaengig und bleibt
   in JS/data.js (quizTiergeraeusche) + JS/quiz.js unveraendert.

   Frageformat (Minimum):
     {
       id: "eindeutig-und-stabil",
       category: "tiere" | "natur" | "wissen" | "sprache" | "denken",
       difficulty: "leicht" | "normal" | "schwer",
       question: "...",
       answers: ["...", "...", "...", "..."],   // 2-4 Antworten
       correctIndex: 0,                          // Index der richtigen Antwort
       explanation: "Kurze freundliche Erklaerung."
     }

   Regeln beim Ziehen einer Runde (JS/quiz.js):
   - keine Frage doppelt in einer Runde
   - "Gemischt": Kategorien werden gleichmaessig gemischt
   - gewaehltes Thema: nur Fragen dieser Kategorie
   - eine Rundenlaenge wird fuer ein Thema nur angeboten, wenn es
     genug Fragen ohne Wiederholung dafuer hat
     (siehe textQuizCategoryAvailability()).

   Alle Fragen hier sind mit correctIndex 0 notiert (richtige Antwort
   zuerst) - JS/quiz.js mischt Fragen- UND Antwortreihenfolge pro Runde.
   =====================================================*/

const TEXT_QUIZ_CATEGORIES = [
    { id: "gemischt",  label: "Überraschung / Gemischt", icon: "🎲" },
    { id: "tiere",     label: "Tiere",   icon: "🦁" },
    { id: "natur",     label: "Natur",   icon: "🌿" },
    { id: "wissen",    label: "Wissen",  icon: "🧠" },
    { id: "sprache",   label: "Sprache", icon: "🔤" },
    { id: "denken",    label: "Denken",  icon: "🧩" }
];

/* Rundenlaengen. difficulty = die XP-Schwierigkeit (bestehende
   earn_xp()-Logik: leicht/normal/schwer). */
const TEXT_QUIZ_LENGTHS = [
    { id: "kurz",   label: "Kurz",   count: 5,  difficulty: "leicht", note: "5 Fragen · ca. 3 Minuten" },
    { id: "mittel", label: "Mittel", count: 10, difficulty: "normal", note: "10 Fragen · ca. 6 Minuten" },
    { id: "gross",  label: "Groß",   count: 15, difficulty: "schwer", note: "15 Fragen · ca. 10 Minuten" }
];

const TEXT_QUIZ_QUESTIONS = [

    /* ========== TIERE ========== */
    { id: "tiere-katze-maeuse", category: "tiere", difficulty: "leicht",
      question: "Welches Haustier fängt gern Mäuse und schnurrt?",
      answers: ["Katze", "Hund", "Kaninchen", "Wellensittich"], correctIndex: 0,
      explanation: "Katzen schnurren, wenn sie sich wohlfühlen, und jagen gern kleine Tiere." },
    { id: "tiere-miau", category: "tiere", difficulty: "leicht",
      question: "Welches Tier sagt „miau“?",
      answers: ["Katze", "Hund", "Kuh", "Vogel"], correctIndex: 0,
      explanation: "„Miau“ ist ein typischer Katzenlaut." },
    { id: "tiere-hund-beine", category: "tiere", difficulty: "leicht",
      question: "Wie viele Beine hat ein Hund?",
      answers: ["4", "2", "6", "8"], correctIndex: 0,
      explanation: "Hunde sind Vierbeiner - sie laufen auf vier Beinen." },
    { id: "tiere-delfin-wasser", category: "tiere", difficulty: "leicht",
      question: "Wo lebt ein Delfin?",
      answers: ["Im Wasser", "In der Luft", "Im Wald", "In der Wüste"], correctIndex: 0,
      explanation: "Delfine sind Meerestiere und schwimmen im Meer." },
    { id: "tiere-huhn-eier", category: "tiere", difficulty: "leicht",
      question: "Welches dieser Tiere legt Eier?",
      answers: ["Huhn", "Katze", "Hund", "Pferd"], correctIndex: 0,
      explanation: "Hühner legen Eier. Katzen, Hunde und Pferde bekommen lebende Junge." },
    { id: "tiere-zebra-streifen", category: "tiere", difficulty: "leicht",
      question: "Welches Tier hat schwarz-weiße Streifen?",
      answers: ["Zebra", "Kamel", "Elch", "Robbe"], correctIndex: 0,
      explanation: "Das Zebra hat ein gestreiftes Fell - jedes Muster ist einzigartig." },
    { id: "tiere-schildkroete-panzer", category: "tiere", difficulty: "leicht",
      question: "Welches Tier trägt seinen Panzer immer mit sich?",
      answers: ["Schildkröte", "Frosch", "Hase", "Reh"], correctIndex: 0,
      explanation: "Die Schildkröte kann sich bei Gefahr in ihren Panzer zurückziehen." },
    { id: "tiere-giraffe-hals", category: "tiere", difficulty: "leicht",
      question: "Welches Tier hat einen sehr langen Hals?",
      answers: ["Giraffe", "Igel", "Ente", "Maus"], correctIndex: 0,
      explanation: "Mit ihrem langen Hals kommt die Giraffe an Blätter hoch oben in den Bäumen." },
    { id: "tiere-eisbaer-nordpol", category: "tiere", difficulty: "normal",
      question: "Welches Tier lebt in der Eiswelt am Nordpol?",
      answers: ["Eisbär", "Löwe", "Känguru", "Papagei"], correctIndex: 0,
      explanation: "Der Eisbär hat ein dickes Fell und eine Fettschicht gegen die Kälte." },
    { id: "tiere-panda-bambus", category: "tiere", difficulty: "normal",
      question: "Was frisst ein Panda am liebsten?",
      answers: ["Bambus", "Fleisch", "Nüsse", "Gras"], correctIndex: 0,
      explanation: "Pandas essen fast nur Bambus und knabbern den ganzen Tag daran." },
    { id: "tiere-adler-fliegen", category: "tiere", difficulty: "leicht",
      question: "Welches dieser Tiere kann fliegen?",
      answers: ["Adler", "Delfin", "Löwe", "Schaf"], correctIndex: 0,
      explanation: "Der Adler ist ein großer Greifvogel mit kräftigen Flügeln." },
    { id: "tiere-biber-damm", category: "tiere", difficulty: "normal",
      question: "Welches Tier baut aus Ästen einen Damm im Fluss?",
      answers: ["Biber", "Fuchs", "Eichhörnchen", "Storch"], correctIndex: 0,
      explanation: "Biber fällen mit ihren Zähnen Bäume und stauen damit das Wasser." },
    { id: "tiere-biene-honig", category: "tiere", difficulty: "leicht",
      question: "Welches Tier sammelt Nektar und macht Honig?",
      answers: ["Biene", "Ameise", "Fliege", "Spinne"], correctIndex: 0,
      explanation: "Bienen leben in einem Bienenstock und stellen dort Honig her." },
    { id: "tiere-kaenguru-beutel", category: "tiere", difficulty: "normal",
      question: "Welches Tier hüpft und trägt sein Baby in einem Beutel?",
      answers: ["Känguru", "Hase", "Frosch", "Pinguin"], correctIndex: 0,
      explanation: "Kängurus leben in Australien. Das Junge sitzt im Beutel der Mutter." },
    { id: "tiere-elefant-ruessel", category: "tiere", difficulty: "leicht",
      question: "Welches Tier hat einen langen Rüssel?",
      answers: ["Elefant", "Nashorn", "Bär", "Wolf"], correctIndex: 0,
      explanation: "Mit dem Rüssel kann der Elefant greifen, trinken und sich duschen." },
    { id: "tiere-welpe", category: "tiere", difficulty: "normal",
      question: "Wie nennt man ein Hundebaby?",
      answers: ["Welpe", "Kalb", "Küken", "Fohlen"], correctIndex: 0,
      explanation: "Ein junger Hund heißt Welpe. Ein Katzenbaby heißt Kätzchen." },
    { id: "tiere-frosch-quaken", category: "tiere", difficulty: "leicht",
      question: "Welches Tier quakt und lebt gern am Teich?",
      answers: ["Frosch", "Taube", "Schaf", "Ziege"], correctIndex: 0,
      explanation: "Frösche leben im und am Wasser und quaken vor allem am Abend." },
    { id: "tiere-fisch-flossen", category: "tiere", difficulty: "leicht",
      question: "Womit schwimmt ein Fisch durchs Wasser?",
      answers: ["Mit Flossen", "Mit Beinen", "Mit Flügeln", "Mit Rädern"], correctIndex: 0,
      explanation: "Fische bewegen sich mit ihren Flossen und dem Schwanz." },
    { id: "tiere-schnecke-langsam", category: "tiere", difficulty: "leicht",
      question: "Welches Tier ist besonders langsam und hinterlässt eine Schleimspur?",
      answers: ["Schnecke", "Gepard", "Hase", "Pferd"], correctIndex: 0,
      explanation: "Die Schnecke kriecht langsam und trägt ihr Haus auf dem Rücken." },
    { id: "tiere-eule-nacht", category: "tiere", difficulty: "normal",
      question: "Welcher Vogel ist vor allem nachts wach und jagt Mäuse?",
      answers: ["Eule", "Ente", "Huhn", "Spatz"], correctIndex: 0,
      explanation: "Eulen können im Dunkeln sehr gut sehen und hören." },

    /* ========== NATUR ========== */
    { id: "natur-sonne-gelb", category: "natur", difficulty: "leicht",
      question: "Welche Farbe sieht die Sonne für uns meistens aus?",
      answers: ["Gelb", "Blau", "Grün", "Lila"], correctIndex: 0,
      explanation: "Am Himmel wirkt die Sonne hellgelb bis weiß." },
    { id: "natur-regen-wasser", category: "natur", difficulty: "leicht",
      question: "Was fällt bei Regen vom Himmel?",
      answers: ["Wassertropfen", "Sand", "Steine", "Blätter"], correctIndex: 0,
      explanation: "Regen besteht aus vielen kleinen Wassertropfen aus den Wolken." },
    { id: "natur-fruehling", category: "natur", difficulty: "leicht",
      question: "Welche Jahreszeit kommt nach dem Winter?",
      answers: ["Frühling", "Sommer", "Herbst", "noch ein Winter"], correctIndex: 0,
      explanation: "Nach dem Winter wird es Frühling - dann wachsen wieder Blätter und Blumen." },
    { id: "natur-pflanze-wasser", category: "natur", difficulty: "normal",
      question: "Was braucht eine Pflanze, um zu wachsen?",
      answers: ["Wasser und Licht", "nur Dunkelheit", "Schokolade", "Musik"], correctIndex: 0,
      explanation: "Pflanzen brauchen Wasser, Licht und Luft zum Wachsen." },
    { id: "natur-eis", category: "natur", difficulty: "leicht",
      question: "Wie nennt man Wasser, das ganz hart gefroren ist?",
      answers: ["Eis", "Dampf", "Schaum", "Nebel"], correctIndex: 0,
      explanation: "Wenn Wasser sehr kalt wird, gefriert es zu festem Eis." },
    { id: "natur-blatt-gruen", category: "natur", difficulty: "leicht",
      question: "Welche Farbe haben die meisten Blätter im Sommer?",
      answers: ["Grün", "Rot", "Blau", "Schwarz"], correctIndex: 0,
      explanation: "Blätter sind im Sommer grün. Im Herbst werden viele gelb, orange oder braun." },
    { id: "natur-baum-teile", category: "natur", difficulty: "normal",
      question: "Welcher Teil eines Baums steckt tief in der Erde?",
      answers: ["Die Wurzeln", "Die Blätter", "Die Äste", "Die Krone"], correctIndex: 0,
      explanation: "Mit den Wurzeln hält sich der Baum fest und nimmt Wasser auf." },
    { id: "natur-schnee", category: "natur", difficulty: "leicht",
      question: "Wann fällt normalerweise Schnee?",
      answers: ["Im Winter", "Im Hochsommer", "Nie", "Nur nachts im Juli"], correctIndex: 0,
      explanation: "Schnee fällt, wenn es kalt genug ist - meistens im Winter." },
    { id: "natur-regenbogen", category: "natur", difficulty: "normal",
      question: "Wann sieht man am Himmel oft einen Regenbogen?",
      answers: ["Wenn Sonne und Regen zusammenkommen", "Nur nachts", "Bei dichtem Nebel", "Wenn es schneit"], correctIndex: 0,
      explanation: "Sonnenlicht scheint durch Regentropfen und wird zu bunten Farben." },
    { id: "natur-mars", category: "natur", difficulty: "normal",
      question: "Welcher Planet wird der „rote Planet“ genannt?",
      answers: ["Mars", "Jupiter", "Venus", "Saturn"], correctIndex: 0,
      explanation: "Der Boden vom Mars ist rostrot - deshalb der Name." },
    { id: "natur-mond-licht", category: "natur", difficulty: "normal",
      question: "Warum können wir den Mond nachts sehen?",
      answers: ["Er leiht sich Licht von der Sonne", "Er brennt wie ein Feuer", "Er ist eine große Lampe", "Er glüht von selbst"], correctIndex: 0,
      explanation: "Der Mond leuchtet nicht selbst - er spiegelt das Sonnenlicht zurück." },
    { id: "natur-astronaut", category: "natur", difficulty: "leicht",
      question: "Wie nennt man eine Person, die ins Weltall fliegt?",
      answers: ["Astronaut", "Pilot", "Kapitän", "Taucher"], correctIndex: 0,
      explanation: "Astronautinnen und Astronauten fliegen mit Raketen ins All." },
    { id: "natur-rakete", category: "natur", difficulty: "leicht",
      question: "Womit fliegt man ins Weltall?",
      answers: ["Mit einer Rakete", "Mit einem Fahrrad", "Mit einem Segelboot", "Mit einem Bus"], correctIndex: 0,
      explanation: "Eine Rakete ist stark genug, um die Erde zu verlassen." },
    { id: "natur-sonne-stern", category: "natur", difficulty: "normal",
      question: "Was ist die Sonne eigentlich?",
      answers: ["Ein Stern", "Ein Planet", "Ein großer Mond", "Eine Wolke"], correctIndex: 0,
      explanation: "Die Sonne ist der Stern, der unserer Erde am nächsten ist." },
    { id: "natur-planeten-acht", category: "natur", difficulty: "schwer",
      question: "Wie viele Planeten hat unser Sonnensystem?",
      answers: ["8", "3", "12", "100"], correctIndex: 0,
      explanation: "Von Merkur bis Neptun sind es acht Planeten." },
    { id: "natur-dino-zeit", category: "natur", difficulty: "normal",
      question: "Wann lebten die Dinosaurier?",
      answers: ["Vor vielen Millionen Jahren", "Vor 100 Jahren", "Letzten Sommer", "Sie leben heute noch bei uns"], correctIndex: 0,
      explanation: "Dinosaurier lebten lange bevor es Menschen gab." },
    { id: "natur-dino-triceratops", category: "natur", difficulty: "schwer",
      question: "Welcher Dinosaurier hatte drei Hörner am Kopf?",
      answers: ["Triceratops", "Brachiosaurus", "Stegosaurus", "T. Rex"], correctIndex: 0,
      explanation: "„Triceratops“ heißt übersetzt ungefähr „Dreihorngesicht“." },
    { id: "natur-dino-pflanzenfresser", category: "natur", difficulty: "normal",
      question: "Wie nennt man Tiere, die nur Pflanzen fressen?",
      answers: ["Pflanzenfresser", "Fleischfresser", "Allesfresser", "Steinfresser"], correctIndex: 0,
      explanation: "Pflanzenfresser essen Gras, Blätter oder Früchte - kein Fleisch." },
    { id: "natur-jahreszeiten", category: "natur", difficulty: "leicht",
      question: "Wie viele Jahreszeiten gibt es bei uns?",
      answers: ["4", "2", "7", "12"], correctIndex: 0,
      explanation: "Frühling, Sommer, Herbst und Winter - das sind vier." },
    { id: "natur-wolke-regen", category: "natur", difficulty: "normal",
      question: "Woraus besteht eine Regenwolke?",
      answers: ["Aus winzigen Wassertröpfchen", "Aus Watte", "Aus Rauch", "Aus Zuckerwatte"], correctIndex: 0,
      explanation: "Wolken sind viele winzige Wassertröpfchen, die zusammen schweben." },

    /* ========== WISSEN ========== */
    { id: "wissen-schule-lernen", category: "wissen", difficulty: "leicht",
      question: "Wo lernt man mit anderen Kindern lesen und rechnen?",
      answers: ["In der Schule", "Im Supermarkt", "Im Kino", "Im Schwimmbad"], correctIndex: 0,
      explanation: "In der Schule lernt man viele neue Dinge." },
    { id: "wissen-stift-schreiben", category: "wissen", difficulty: "leicht",
      question: "Womit schreibt man in ein Heft?",
      answers: ["Mit einem Stift", "Mit einer Gabel", "Mit einem Löffel", "Mit einem Schuh"], correctIndex: 0,
      explanation: "Zum Schreiben nimmt man einen Stift oder Bleistift." },
    { id: "wissen-zug-schienen", category: "wissen", difficulty: "leicht",
      question: "Welches Fahrzeug fährt auf Schienen?",
      answers: ["Zug", "Auto", "Fahrrad", "Boot"], correctIndex: 0,
      explanation: "Züge fahren auf zwei Schienen aus Metall." },
    { id: "wissen-schuhe-fuesse", category: "wissen", difficulty: "leicht",
      question: "Was zieht man sich über die Füße?",
      answers: ["Schuhe", "Hut", "Handschuhe", "Brille"], correctIndex: 0,
      explanation: "Schuhe schützen die Füße vor Kälte und spitzen Steinen." },
    { id: "wissen-bibliothek", category: "wissen", difficulty: "normal",
      question: "Wie heißt ein Ort, an dem man Bücher ausleihen kann?",
      answers: ["Bibliothek", "Sportplatz", "Bäckerei", "Bahnhof"], correctIndex: 0,
      explanation: "In der Bibliothek kann man Bücher lesen und mit nach Hause nehmen." },
    { id: "wissen-feuerwehr", category: "wissen", difficulty: "leicht",
      question: "Wer löscht ein Feuer?",
      answers: ["Die Feuerwehr", "Der Bäcker", "Die Lehrerin", "Der Gärtner"], correctIndex: 0,
      explanation: "Die Feuerwehr kommt mit einem großen roten Auto und löscht mit Wasser." },
    { id: "wissen-tierarzt", category: "wissen", difficulty: "leicht",
      question: "Wer hilft kranken Tieren?",
      answers: ["Der Tierarzt", "Der Pilot", "Der Koch", "Der Maler"], correctIndex: 0,
      explanation: "Die Tierärztin oder der Tierarzt untersucht und pflegt Tiere." },
    { id: "wissen-postbote", category: "wissen", difficulty: "leicht",
      question: "Wer bringt Briefe und Pakete zu den Häusern?",
      answers: ["Der Postbote", "Der Zahnarzt", "Der Feuerwehrmann", "Der Friseur"], correctIndex: 0,
      explanation: "Die Postbotin oder der Postbote stellt Briefe und Pakete zu." },
    { id: "wissen-mechaniker", category: "wissen", difficulty: "normal",
      question: "Wer repariert kaputte Autos?",
      answers: ["Der Mechaniker", "Der Bäcker", "Die Lehrerin", "Der Pilot"], correctIndex: 0,
      explanation: "In der Werkstatt kümmert sich die Mechanikerin um das Auto." },
    { id: "wissen-baecker", category: "wissen", difficulty: "leicht",
      question: "Wer backt früh am Morgen Brot und Brötchen?",
      answers: ["Der Bäcker", "Der Astronaut", "Der Kapitän", "Der Maler"], correctIndex: 0,
      explanation: "Die Bäckerei duftet morgens nach frischem Brot." },
    { id: "wissen-ampel-rot", category: "wissen", difficulty: "leicht",
      question: "Was bedeutet Rot an der Ampel?",
      answers: ["Stehen bleiben", "Schnell rennen", "Tanzen", "Rückwärts gehen"], correctIndex: 0,
      explanation: "Bei Rot warten alle. Erst bei Grün darf man gehen." },
    { id: "wissen-woche-tage", category: "wissen", difficulty: "normal",
      question: "Wie viele Tage hat eine Woche?",
      answers: ["7", "5", "10", "12"], correctIndex: 0,
      explanation: "Montag bis Sonntag - das sind sieben Tage." },
    { id: "wissen-jahr-monate", category: "wissen", difficulty: "schwer",
      question: "Wie viele Monate hat ein Jahr?",
      answers: ["12", "7", "10", "24"], correctIndex: 0,
      explanation: "Von Januar bis Dezember sind es zwölf Monate." },
    { id: "wissen-rotkaeppchen", category: "wissen", difficulty: "leicht",
      question: "Welches Märchenmädchen trägt einen roten Umhang mit Kapuze?",
      answers: ["Rotkäppchen", "Aschenputtel", "Rapunzel", "Schneewittchen"], correctIndex: 0,
      explanation: "Rotkäppchen besucht im Märchen ihre Großmutter." },
    { id: "wissen-rapunzel", category: "wissen", difficulty: "normal",
      question: "Welche Märchenfigur hat sehr lange goldene Haare und wohnt in einem Turm?",
      answers: ["Rapunzel", "Rotkäppchen", "Dornröschen", "Aschenputtel"], correctIndex: 0,
      explanation: "„Rapunzel, lass dein Haar herunter!“ heißt es im Märchen." },
    { id: "wissen-schneewittchen-zwerge", category: "wissen", difficulty: "normal",
      question: "Wie viele Zwerge helfen Schneewittchen im Wald?",
      answers: ["7", "3", "5", "10"], correctIndex: 0,
      explanation: "Die sieben Zwerge arbeiten tagsüber im Bergwerk." },
    { id: "wissen-piraten-flagge", category: "wissen", difficulty: "normal",
      question: "Welches Bild ist oft auf einer Piratenflagge?",
      answers: ["Ein Totenkopf", "Eine Blume", "Ein Herz", "Ein Regenbogen"], correctIndex: 0,
      explanation: "Die schwarze Piratenflagge mit Totenkopf heißt „Jolly Roger“." },
    { id: "wissen-piraten-schatz", category: "wissen", difficulty: "leicht",
      question: "Worin vergraben Piraten in Geschichten ihren Schatz?",
      answers: ["In einer Truhe", "In einer Socke", "In einem Luftballon", "In einem Buch"], correctIndex: 0,
      explanation: "Der Schatz steckt meist in einer schweren Holztruhe." },
    { id: "wissen-piraten-papagei", category: "wissen", difficulty: "leicht",
      question: "Welches Tier sitzt in Piratengeschichten oft auf der Schulter?",
      answers: ["Papagei", "Katze", "Kaninchen", "Schildkröte"], correctIndex: 0,
      explanation: "Ein bunter Papagei ist der klassische Begleiter im Piraten-Märchen." },
    { id: "wissen-superman", category: "wissen", difficulty: "leicht",
      question: "Welcher Held wird „Mann aus Stahl“ genannt und kann fliegen?",
      answers: ["Superman", "Batman", "Spider-Man", "Iron Man"], correctIndex: 0,
      explanation: "Superman trägt ein rotes Cape und ein „S“ auf der Brust." },
    { id: "wissen-spiderman", category: "wissen", difficulty: "leicht",
      question: "Welcher Held klettert an Wänden hoch und schwingt an Fäden?",
      answers: ["Spider-Man", "Hulk", "Thor", "Flash"], correctIndex: 0,
      explanation: "Spider-Man bedeutet „Spinnen-Mann“." },
    { id: "wissen-elsa-eis", category: "wissen", difficulty: "leicht",
      question: "Welche Kraft hat Elsa aus „Die Eiskönigin“?",
      answers: ["Sie kann Eis und Schnee zaubern", "Sie wird unsichtbar", "Sie kann fliegen", "Sie kann unter Wasser atmen"], correctIndex: 0,
      explanation: "Elsa erschafft mit ihren Händen Eis, Schnee und Frost." },
    { id: "wissen-simba-loewe", category: "wissen", difficulty: "leicht",
      question: "Welches Tier ist Simba aus „Der König der Löwen“?",
      answers: ["Ein Löwe", "Ein Affe", "Ein Elefant", "Ein Zebra"], correctIndex: 0,
      explanation: "Simba ist ein junger Löwe, der später König wird." },

    /* ========== SPRACHE ========== */
    { id: "sprache-tier-a", category: "sprache", difficulty: "leicht",
      question: "Welches Tier beginnt mit dem Buchstaben A?",
      answers: ["Affe", "Katze", "Hund", "Maus"], correctIndex: 0,
      explanation: "„Affe“ fängt mit A an." },
    { id: "sprache-wort-b", category: "sprache", difficulty: "leicht",
      question: "Welches Wort beginnt mit B?",
      answers: ["Ball", "Auto", "Tisch", "Zebra"], correctIndex: 0,
      explanation: "„Ball“ fängt mit B an." },
    { id: "sprache-wort-s", category: "sprache", difficulty: "leicht",
      question: "Welches Wort beginnt mit S?",
      answers: ["Schule", "Haus", "Apfel", "Tisch"], correctIndex: 0,
      explanation: "„Schule“ fängt mit S an." },
    { id: "sprache-apfel-anfang", category: "sprache", difficulty: "leicht",
      question: "Mit welchem Buchstaben fängt das Wort „Apfel“ an?",
      answers: ["A", "P", "F", "L"], correctIndex: 0,
      explanation: "Man hört und schreibt zuerst das A." },
    { id: "sprache-nach-a", category: "sprache", difficulty: "normal",
      question: "Welcher Buchstabe kommt im Alphabet direkt nach A?",
      answers: ["B", "C", "D", "Z"], correctIndex: 0,
      explanation: "Das Alphabet beginnt mit A, B, C, D ..." },
    { id: "sprache-reim-haus", category: "sprache", difficulty: "leicht",
      question: "Was reimt sich auf „Haus“?",
      answers: ["Maus", "Fenster", "Tisch", "Blume"], correctIndex: 0,
      explanation: "„Haus“ und „Maus“ klingen am Ende gleich." },
    { id: "sprache-reim-ball", category: "sprache", difficulty: "leicht",
      question: "Was reimt sich auf „Ball“?",
      answers: ["Fall", "Sonne", "Tante", "Haus"], correctIndex: 0,
      explanation: "„Ball“ und „Fall“ reimen sich." },
    { id: "sprache-reim-suppe", category: "sprache", difficulty: "normal",
      question: "Was reimt sich auf „Suppe“?",
      answers: ["Puppe", "Stuhl", "Baum", "Lampe"], correctIndex: 0,
      explanation: "„Suppe“ und „Puppe“ reimen sich." },
    { id: "sprache-reim-baum", category: "sprache", difficulty: "normal",
      question: "Was reimt sich auf „Baum“?",
      answers: ["Traum", "Blatt", "Wald", "Ast"], correctIndex: 0,
      explanation: "„Baum“ und „Traum“ klingen am Ende gleich." },
    { id: "sprache-silben-banane", category: "sprache", difficulty: "normal",
      question: "Wie viele Silben hat das Wort „Ba-na-ne“?",
      answers: ["3", "2", "4", "1"], correctIndex: 0,
      explanation: "Ba - na - ne: das sind drei Silben." },
    { id: "sprache-silben-elefant", category: "sprache", difficulty: "normal",
      question: "Wie viele Silben hat das Wort „E-le-fant“?",
      answers: ["3", "2", "4", "1"], correctIndex: 0,
      explanation: "E - le - fant: drei Silben." },
    { id: "sprache-silben-schokolade", category: "sprache", difficulty: "schwer",
      question: "Wie viele Silben hat das Wort „Scho-ko-la-de“?",
      answers: ["4", "2", "3", "5"], correctIndex: 0,
      explanation: "Scho - ko - la - de: vier Silben." },
    { id: "sprache-silben-sonne", category: "sprache", difficulty: "leicht",
      question: "Wie viele Silben hat das Wort „Son-ne“?",
      answers: ["2", "1", "3", "4"], correctIndex: 0,
      explanation: "Son - ne: zwei Silben." },
    { id: "sprache-gegenteil-gross", category: "sprache", difficulty: "leicht",
      question: "Was ist das Gegenteil von „groß“?",
      answers: ["klein", "schnell", "laut", "nass"], correctIndex: 0,
      explanation: "Groß und klein sind Gegenteile." },
    { id: "sprache-gegenteil-kalt", category: "sprache", difficulty: "leicht",
      question: "Was ist das Gegenteil von „kalt“?",
      answers: ["warm", "hell", "leise", "weich"], correctIndex: 0,
      explanation: "Kalt und warm sind Gegenteile." },
    { id: "sprache-gegenteil-hell", category: "sprache", difficulty: "normal",
      question: "Was ist das Gegenteil von „hell“?",
      answers: ["dunkel", "schwer", "spitz", "rund"], correctIndex: 0,
      explanation: "Hell und dunkel sind Gegenteile." },
    { id: "sprache-mehrzahl-hund", category: "sprache", difficulty: "normal",
      question: "Wie heißt die Mehrzahl von „der Hund“?",
      answers: ["die Hunde", "die Hunden", "die Hundies", "die Hund"], correctIndex: 0,
      explanation: "Ein Hund - viele Hunde." },
    { id: "sprache-mehrzahl-baum", category: "sprache", difficulty: "schwer",
      question: "Wie heißt die Mehrzahl von „der Baum“?",
      answers: ["die Bäume", "die Baume", "die Bäumer", "die Baums"], correctIndex: 0,
      explanation: "Ein Baum - viele Bäume (mit ä)." },
    { id: "sprache-frage-w", category: "sprache", difficulty: "normal",
      question: "Welches Wort passt in eine Frage: „___ heißt du?“",
      answers: ["Wie", "Und", "Auch", "Sehr"], correctIndex: 0,
      explanation: "„Wie heißt du?“ ist eine typische Frage." },
    { id: "sprache-gross-satzanfang", category: "sprache", difficulty: "schwer",
      question: "Wie schreibt man das erste Wort in einem Satz?",
      answers: ["Mit großem Anfangsbuchstaben", "Immer klein", "In roter Farbe", "Rückwärts"], correctIndex: 0,
      explanation: "Jeder Satz beginnt mit einem großen Buchstaben." },

    /* ========== DENKEN ========== */
    { id: "denken-plus-3-4", category: "denken", difficulty: "leicht",
      question: "3 + 4 = ?",
      answers: ["7", "6", "8", "5"], correctIndex: 0,
      explanation: "3 und noch 4 dazu sind 7." },
    { id: "denken-plus-5-5", category: "denken", difficulty: "leicht",
      question: "5 + 5 = ?",
      answers: ["10", "9", "11", "15"], correctIndex: 0,
      explanation: "5 und 5 ergeben 10." },
    { id: "denken-plus-7-3", category: "denken", difficulty: "leicht",
      question: "7 + 3 = ?",
      answers: ["10", "9", "11", "8"], correctIndex: 0,
      explanation: "7 und 3 dazu sind 10." },
    { id: "denken-plus-9-3", category: "denken", difficulty: "normal",
      question: "9 + 3 = ?",
      answers: ["12", "11", "13", "10"], correctIndex: 0,
      explanation: "9 und 3 dazu sind 12." },
    { id: "denken-minus-9-3", category: "denken", difficulty: "leicht",
      question: "9 − 3 = ?",
      answers: ["6", "5", "7", "4"], correctIndex: 0,
      explanation: "Von 9 nimmt man 3 weg, dann bleiben 6." },
    { id: "denken-minus-10-4", category: "denken", difficulty: "normal",
      question: "10 − 4 = ?",
      answers: ["6", "5", "7", "4"], correctIndex: 0,
      explanation: "10 weniger 4 sind 6." },
    { id: "denken-minus-12-5", category: "denken", difficulty: "normal",
      question: "12 − 5 = ?",
      answers: ["7", "6", "8", "5"], correctIndex: 0,
      explanation: "12 weniger 5 sind 7." },
    { id: "denken-minus-6-6", category: "denken", difficulty: "leicht",
      question: "6 − 6 = ?",
      answers: ["0", "1", "6", "2"], correctIndex: 0,
      explanation: "Nimmt man alles weg, bleibt nichts übrig: 0." },
    { id: "denken-mal-2-3", category: "denken", difficulty: "normal",
      question: "2 × 3 = ?",
      answers: ["6", "5", "8", "9"], correctIndex: 0,
      explanation: "2 mal die 3, also 3 + 3 = 6." },
    { id: "denken-mal-3-3", category: "denken", difficulty: "normal",
      question: "3 × 3 = ?",
      answers: ["9", "6", "12", "3"], correctIndex: 0,
      explanation: "3 + 3 + 3 = 9." },
    { id: "denken-mal-2-5", category: "denken", difficulty: "normal",
      question: "2 × 5 = ?",
      answers: ["10", "7", "8", "12"], correctIndex: 0,
      explanation: "5 + 5 = 10." },
    { id: "denken-mal-5-5", category: "denken", difficulty: "schwer",
      question: "5 × 5 = ?",
      answers: ["25", "10", "20", "15"], correctIndex: 0,
      explanation: "Fünfmal die 5 ergibt 25." },
    { id: "denken-geteilt-6-2", category: "denken", difficulty: "normal",
      question: "6 ÷ 2 = ?",
      answers: ["3", "2", "4", "6"], correctIndex: 0,
      explanation: "6 auf 2 gleiche Häufchen: je 3." },
    { id: "denken-geteilt-10-5", category: "denken", difficulty: "normal",
      question: "10 ÷ 5 = ?",
      answers: ["2", "5", "1", "10"], correctIndex: 0,
      explanation: "10 auf 5 gleiche Teile: je 2." },
    { id: "denken-geteilt-12-2", category: "denken", difficulty: "schwer",
      question: "12 ÷ 2 = ?",
      answers: ["6", "5", "7", "4"], correctIndex: 0,
      explanation: "12 auf 2 gleiche Häufchen: je 6." },
    { id: "denken-reihe-2er", category: "denken", difficulty: "normal",
      question: "Was kommt als Nächstes: 2, 4, 6, 8, ___ ?",
      answers: ["10", "9", "12", "7"], correctIndex: 0,
      explanation: "Immer 2 mehr: nach 8 kommt 10." },
    { id: "denken-reihe-5er", category: "denken", difficulty: "schwer",
      question: "Was kommt als Nächstes: 5, 10, 15, ___ ?",
      answers: ["20", "16", "25", "18"], correctIndex: 0,
      explanation: "Immer 5 mehr: nach 15 kommt 20." },
    { id: "denken-kuehe", category: "denken", difficulty: "normal",
      question: "Ein Bauer hat 3 Kühe und kauft 2 dazu. Wie viele Kühe hat er jetzt?",
      answers: ["5", "4", "6", "3"], correctIndex: 0,
      explanation: "3 + 2 = 5 Kühe." },
    { id: "denken-gewicht", category: "denken", difficulty: "schwer",
      question: "Was ist schwerer: 1 Kilo Federn oder 1 Kilo Steine?",
      answers: ["Beide sind gleich schwer", "Die Steine", "Die Federn", "Das kann man nicht wissen"], correctIndex: 0,
      explanation: "1 Kilo ist 1 Kilo - egal ob Federn oder Steine." },
    { id: "denken-groesser", category: "denken", difficulty: "leicht",
      question: "Welche Zahl ist größer: 7 oder 4?",
      answers: ["7", "4", "beide gleich", "keine"], correctIndex: 0,
      explanation: "7 kommt beim Zählen nach 4, also ist 7 größer." },
    { id: "denken-haelfte-8", category: "denken", difficulty: "normal",
      question: "Was ist die Hälfte von 8?",
      answers: ["4", "2", "6", "16"], correctIndex: 0,
      explanation: "8 in zwei gleiche Teile: je 4." },
    { id: "denken-muster-form", category: "denken", difficulty: "normal",
      question: "Kreis, Dreieck, Kreis, Dreieck, ___ ?",
      answers: ["Kreis", "Viereck", "Stern", "Dreieck"], correctIndex: 0,
      explanation: "Das Muster wiederholt sich - nach dem Dreieck kommt wieder ein Kreis." }
];

/* Alle Frage-IDs muessen eindeutig sein - Doppelte hier laut markieren. */
(function () {
    const seen = Object.create(null);
    for (const q of TEXT_QUIZ_QUESTIONS) {
        if (seen[q.id]) {
            console.warn("Doppelte Frage-ID im Text-Quiz-Katalog:", q.id);
        }
        seen[q.id] = true;
    }
})();


/* =====================================================
   VERFUEGBARKEIT: welche Rundenlaenge kann ein Thema fuellen?
   Eine Kategorie wird fuer eine Laenge nur angeboten, wenn sie
   mindestens so viele Fragen hat (keine stillen Wiederholungen).
   "gemischt" nutzt den Gesamtbestand.
   ===================================================== */

function textQuizCountByCategory() {
    const counts = { gemischt: TEXT_QUIZ_QUESTIONS.length };
    for (const q of TEXT_QUIZ_QUESTIONS) {
        counts[q.category] = (counts[q.category] || 0) + 1;
    }
    return counts;
}

function textQuizCategoryAvailability(categoryId) {
    const counts = textQuizCountByCategory();
    const have = counts[categoryId] || 0;
    const available = {};
    for (const len of TEXT_QUIZ_LENGTHS) {
        available[len.id] = have >= len.count;
    }
    return { have: have, lengths: available };
}


/* =====================================================
   RUNDE ZUSAMMENSTELLEN
   - keine Frage doppelt
   - "gemischt": Kategorien gleichmaessig ziehen
   - feste Kategorie: nur diese
   Rueckgabe: { questions:[...], difficulty, roundId } oder null,
   wenn die Kombination nicht ohne Wiederholung fuellbar ist.
   ===================================================== */

function textQuizShuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* Kurzer, stabiler Hash (djb2) -> Base36. Fuer die roundId, damit sie
   trotz vieler Frage-IDs kurz bleibt (earn_xp kappt bei 120 Zeichen). */
function textQuizHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
}

function buildTextQuizRound(lengthId, categoryId) {

    const lengthDef = TEXT_QUIZ_LENGTHS.find(function (l) { return l.id === lengthId; });
    if (!lengthDef) { return null; }

    const category = categoryId || "gemischt";
    const need = lengthDef.count;

    const pool = (category === "gemischt")
        ? TEXT_QUIZ_QUESTIONS.slice()
        : TEXT_QUIZ_QUESTIONS.filter(function (q) { return q.category === category; });

    if (pool.length < need) {
        return null; // nicht ohne Wiederholung fuellbar
    }

    let picked;

    if (category === "gemischt") {
        // Kategorien gleichmaessig: pro Kategorie mischen, dann reihum ziehen
        const byCat = {};
        for (const q of textQuizShuffle(pool)) {
            (byCat[q.category] = byCat[q.category] || []).push(q);
        }
        const cats = textQuizShuffle(Object.keys(byCat));
        picked = [];
        let idx = 0;
        while (picked.length < need) {
            const cat = cats[idx % cats.length];
            if (byCat[cat] && byCat[cat].length) {
                picked.push(byCat[cat].shift());
            }
            idx++;
            // Sicherheitsnetz gegen Endlosschleife
            if (idx > need * cats.length + 5) { break; }
        }
        picked = textQuizShuffle(picked).slice(0, need);
    } else {
        picked = textQuizShuffle(pool).slice(0, need);
    }

    if (picked.length < need) { return null; }

    // roundId: Quizart + Thema + Laenge + Hash der SORTIERTEN Frage-IDs
    const idKey = picked.map(function (q) { return q.id; }).sort().join(",");
    const roundId = "txt_" + category + "_" + lengthId + "_" + textQuizHash(idKey);

    // Fragen- und Antwortreihenfolge fuer die Runde mischen; correctIndex
    // wird dabei mitgefuehrt.
    const questions = picked.map(function (q) {
        const order = textQuizShuffle(q.answers.map(function (_, i) { return i; }));
        return {
            id: q.id,
            category: q.category,
            question: q.question,
            answers: order.map(function (i) { return q.answers[i]; }),
            correctIndex: order.indexOf(q.correctIndex),
            explanation: q.explanation
        };
    });

    return {
        questions: questions,
        difficulty: lengthDef.difficulty,
        lengthId: lengthId,
        category: category,
        roundId: roundId
    };
}

window.TEXT_QUIZ_CATEGORIES = TEXT_QUIZ_CATEGORIES;
window.TEXT_QUIZ_LENGTHS = TEXT_QUIZ_LENGTHS;
window.buildTextQuizRound = buildTextQuizRound;
window.textQuizCategoryAvailability = textQuizCategoryAvailability;
window.textQuizCountByCategory = textQuizCountByCategory;
