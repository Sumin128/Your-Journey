/* =====================================================
   FARO – VERSTECKE (Suchbild)
   Faros Bau ist voller Dinge. Das Kind sucht die Sachen
   von der Liste und tippt sie im Bild an.

   Die Trefferpunkte sind unsichtbare runde Knöpfe, die
   über den gemalten Gegenständen im Szenenbild liegen
   (Prozent-Koordinaten). Wer das Bild austauscht, muss
   die x/y-Werte anpassen.
   ===================================================== */

(function () {

    const SCENE = "images/faros_fuchsbau3.png";

    // x / y in Prozent des Bildes, r = Radius in Prozent der Breite.
    // Bewusst Dinge gewählt, die im Bild nur einmal deutlich vorkommen.
    const ITEMS = [
        { id: "lupe",       label: "Lupe",          x: 47,   y: 69,  r: 5 },
        { id: "feder",      label: "Feder",         x: 40,   y: 72,  r: 5 },
        { id: "notizbuch",  label: "Notizbuch",     x: 56,   y: 70,  r: 5 },
        { id: "laterne",    label: "Laterne",       x: 7.5,  y: 66,  r: 5 },
        { id: "pilz",       label: "Pilz",          x: 71,   y: 42,  r: 5 },
        { id: "pfote",      label: "Pfoten-Schild", x: 62,   y: 34,  r: 5 }
    ];

    let stageEl = null;
    let found = [];


    function start(stage) {

        stageEl = stage;
        found = [];

        stageEl.innerHTML = "";

        const title = document.createElement("h2");
        title.textContent = "Findest du diese Dinge in Faros Bau?";
        stageEl.appendChild(title);

        const list = document.createElement("div");
        list.className = "faro-seek-list";
        list.id = "faro-seek-list";
        ITEMS.forEach(function (item) {
            const chip = document.createElement("span");
            chip.className = "faro-seek-chip";
            chip.dataset.item = item.id;
            chip.textContent = item.label;
            list.appendChild(chip);
        });
        stageEl.appendChild(list);

        const scene = document.createElement("div");
        scene.className = "faro-seek-scene";
        scene.id = "faro-seek-scene";

        const img = document.createElement("img");
        img.src = SCENE;
        img.alt = "Faros Fuchsbau";
        img.draggable = false;
        scene.appendChild(img);

        ITEMS.forEach(function (item) {
            const spot = document.createElement("button");
            spot.type = "button";
            spot.className = "faro-seek-spot";
            spot.setAttribute("aria-label", "Verstecktes: " + item.label);
            spot.style.left = item.x + "%";
            spot.style.top = item.y + "%";
            spot.style.width = (item.r * 2) + "%";
            spot.dataset.item = item.id;
            spot.addEventListener("click", function (event) {
                event.stopPropagation();
                markFound(item);
            });
            scene.appendChild(spot);
        });

        // Fehlklick irgendwo ins Bild
        scene.addEventListener("click", function () {
            flashHint("Schau ganz genau hin …");
        });

        stageEl.appendChild(scene);

        const message = document.createElement("p");
        message.className = "faro-game-message";
        message.id = "faro-seek-message";
        stageEl.appendChild(message);

    }


    function markFound(item) {

        if (found.indexOf(item.id) !== -1) {
            return;
        }

        found.push(item.id);

        const spot = stageEl.querySelector('.faro-seek-spot[data-item="' + item.id + '"]');
        if (spot) {
            spot.classList.add("found");
        }

        const chip = stageEl.querySelector('.faro-seek-chip[data-item="' + item.id + '"]');
        if (chip) {
            chip.classList.add("found");
        }

        window.FaroGames.earn(1, "fox_correct");
        if (typeof playCorrectSound === "function") { playCorrectSound(); }

        if (found.length === ITEMS.length) {
            flashHint("Alles gefunden! Faro ist beeindruckt. 🦊");
        } else {
            flashHint(item.label + " gefunden!  (" + found.length + " / " + ITEMS.length + ")");
        }

    }


    let hintTimer = null;
    function flashHint(text) {
        const message = document.getElementById("faro-seek-message");
        if (!message) { return; }
        message.textContent = text;
        if (hintTimer) { clearTimeout(hintTimer); }
        hintTimer = setTimeout(function () {
            if (found.length === ITEMS.length) { return; }
            message.textContent = "";
        }, 2200);
    }


    function stop() {
        if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    }


    if (window.FaroGames) {
        window.FaroGames.register({
            id: "verstecke",
            label: "Faros Verstecke",
            icon: "🔍",
            start: start,
            stop: stop
        });
    }

})();
