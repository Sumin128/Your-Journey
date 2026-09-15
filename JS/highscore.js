/* =====================================================
   HIGHSCORE.JS
   Globale Punkte-Bestenliste (Tabelle highscores in Supabase,
   siehe supabase_schema_highscores.sql). Jeder gewonnene
   Quiz/Wörterraten/Puzzle-Durchgang gibt Punkte
   (siehe awardHighscorePoints in JS/player.js) - hier wird
   nur die Rangliste angezeigt.
   ===================================================== */

(function setupHighscore() {

    const list = document.getElementById("highscoreList");
    const messageEl = document.getElementById("highscoreMessage");
    const personalBestEl = document.getElementById("highscorePersonalBest");

    if (!list) {
        return;
    }

    /* Feste "Tier-Vergleichswerte" - keine echten Mitspieler, sondern
       Ansporn-Ziele der fünf Mirelon-Figuren. Punkte fest verdrahtet
       (Vielfache von 10, wie ein echter Sieg), keine eigene Tabelle,
       kein Account - rein zur Motivation. Werte später bei Bedarf
       anpassen, wenn sich zeigt, wo echte Kinder gerade stehen. */
    const ANIMAL_RIVALS = [
        { icon: "🦎", name: "Luis", points: 30 },
        { icon: "🐰", name: "Tessa", points: 60 },
        { icon: "🦉", name: "Kuro", points: 90 },
        { icon: "🐻", name: "Branos", points: 130 },
        { icon: "🦊", name: "Faro", points: 170 }
    ].map(function (a) {
        return { user_id: null, player_name: a.icon + " " + a.name, points: a.points, isAnimal: true };
    });

    function setMessage(text, isError) {

        messageEl.textContent = text;
        messageEl.hidden = !text;
        messageEl.classList.toggle("account-message--error", Boolean(isError));

    }

    function renderList(rows, currentUserId) {

        list.innerHTML = "";

        rows.forEach(function (row, index) {

            const item = document.createElement("li");
            item.className = "highscore-row";

            if (currentUserId && row.user_id === currentUserId) {
                item.classList.add("highscore-row--own");
            }
            if (row.isAnimal) {
                item.classList.add("highscore-row--animal");
            }

            const rank = document.createElement("span");
            rank.className = "highscore-rank";
            rank.textContent = "#" + (index + 1);

            const name = document.createElement("span");
            name.className = "highscore-name";
            name.textContent = row.player_name;
            if (row.isAnimal) {
                const tag = document.createElement("span");
                tag.className = "highscore-tag";
                tag.textContent = "Tier";
                name.appendChild(tag);
            }

            const points = document.createElement("span");
            points.className = "highscore-time";
            points.textContent = row.points + " Punkte";

            item.appendChild(rank);
            item.appendChild(name);
            item.appendChild(points);

            list.appendChild(item);

        });

    }

    async function loadHighscores() {

        list.innerHTML = "";
        setMessage("", false);
        personalBestEl.hidden = true;

        if (typeof supabaseClient === "undefined" || !supabaseClient) {
            setMessage("Bestenliste ist gerade nicht erreichbar.", true);
            return;
        }

        const sessionResult = await supabaseClient.auth.getSession();
        const session = sessionResult.data.session;

        const scoresResult =
            await supabaseClient
                .from("highscores")
                .select("user_id, player_name, points")
                .order("points", { ascending: false })
                .limit(20);

        if (scoresResult.error) {
            setMessage("Bestenliste konnte nicht geladen werden.", true);
            return;
        }

        // Tier-Vergleichswerte reinmischen und neu nach Punkten sortieren -
        // damit sie an ihrem echten Rang stehen, statt einfach unten dran.
        const merged = (scoresResult.data || [])
            .concat(ANIMAL_RIVALS)
            .sort(function (a, b) { return b.points - a.points; });
        const displayRows = merged.slice(0, 10);

        renderList(displayRows, session ? session.user.id : null);

        if (!session) {
            return;
        }

        const ownInTop =
            displayRows.some(function (row) {
                return row.user_id === session.user.id;
            });

        if (ownInTop) {
            return;
        }

        const ownResult =
            await supabaseClient
                .from("highscores")
                .select("points")
                .eq("user_id", session.user.id)
                .maybeSingle();

        if (ownResult.data) {
            personalBestEl.textContent =
                "Deine Punkte: " + ownResult.data.points + " (noch nicht in den Top 10)";
            personalBestEl.hidden = false;
        }

    }

    loadHighscores();

})();
