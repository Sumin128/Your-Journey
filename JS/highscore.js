/* =====================================================
   HIGHSCORE.JS
   Globale Punkte-Bestenliste (Tabelle highscores in Supabase,
   siehe supabase_schema_highscores.sql). Jeder gewonnene
   Quiz/Wörterraten/Wer-ist-es/Puzzle-Durchgang gibt Punkte
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

            const rank = document.createElement("span");
            rank.className = "highscore-rank";
            rank.textContent = "#" + (index + 1);

            const name = document.createElement("span");
            name.className = "highscore-name";
            name.textContent = row.player_name;

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
                .limit(10);

        if (scoresResult.error) {
            setMessage("Bestenliste konnte nicht geladen werden.", true);
            return;
        }

        if (!scoresResult.data || !scoresResult.data.length) {
            setMessage("Hier steht noch niemand – gewinne als Erste*r ein Spiel!", false);
        } else {
            renderList(scoresResult.data, session ? session.user.id : null);
        }

        if (!session) {
            return;
        }

        const ownInTop =
            scoresResult.data &&
            scoresResult.data.some(function (row) {
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
