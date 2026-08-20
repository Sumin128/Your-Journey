/* =====================================================
   HIGHSCORE.JS
   Globale Bestenliste fuer das Puzzle (Tabelle puzzle_scores
   in Supabase, siehe supabase_schema_puzzle_scores.sql).
   Jede Teile-Anzahl hat ihre eigene Top-10-Liste, da eine
   Zeit bei 12 Teilen nicht mit einer Zeit bei 108 Teilen
   vergleichbar ist.
   ===================================================== */

(function setupHighscore() {

    const tabsWrap = document.getElementById("highscorePieceTabs");
    const list = document.getElementById("highscoreList");
    const messageEl = document.getElementById("highscoreMessage");
    const personalBestEl = document.getElementById("highscorePersonalBest");

    if (!tabsWrap || !list) {
        return;
    }

    function formatDuration(durationMs) {

        const totalSeconds = Math.round(durationMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return minutes + ":" + String(seconds).padStart(2, "0");

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

            const badge = document.createElement("span");
            badge.className = "highscore-difficulty";
            badge.textContent = row.difficulty === "schwierig" ? "Schwierig" : "Normal";

            const time = document.createElement("span");
            time.className = "highscore-time";
            time.textContent = formatDuration(row.duration_ms);

            item.appendChild(rank);
            item.appendChild(name);
            item.appendChild(badge);
            item.appendChild(time);

            list.appendChild(item);

        });

    }

    async function loadHighscores(pieces) {

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
                .from("puzzle_scores")
                .select("user_id, player_name, difficulty, duration_ms")
                .eq("pieces", pieces)
                .order("duration_ms", { ascending: true })
                .limit(10);

        if (scoresResult.error) {
            setMessage("Bestenliste konnte nicht geladen werden.", true);
            return;
        }

        if (!scoresResult.data || !scoresResult.data.length) {
            setMessage("Hier steht noch niemand – löse als Erste*r ein Puzzle mit dieser Teile-Anzahl!", false);
        } else {
            renderList(scoresResult.data, session ? session.user.id : null);
        }

        if (!session) {
            return;
        }

        const ownBestInTop =
            scoresResult.data &&
            scoresResult.data.some(function (row) {
                return row.user_id === session.user.id;
            });

        if (ownBestInTop) {
            return;
        }

        const ownBestResult =
            await supabaseClient
                .from("puzzle_scores")
                .select("duration_ms")
                .eq("pieces", pieces)
                .eq("user_id", session.user.id)
                .order("duration_ms", { ascending: true })
                .limit(1);

        if (ownBestResult.data && ownBestResult.data.length) {
            personalBestEl.textContent =
                "Deine Bestzeit bei " + pieces + " Teilen: " +
                formatDuration(ownBestResult.data[0].duration_ms) +
                " (noch nicht in den Top 10)";
            personalBestEl.hidden = false;
        }

    }

    tabsWrap.addEventListener("click", function (event) {

        const tab = event.target.closest(".highscore-piece-tab");

        if (!tab) {
            return;
        }

        tabsWrap.querySelectorAll(".highscore-piece-tab").forEach(function (otherTab) {
            otherTab.classList.toggle("is-selected", otherTab === tab);
        });

        loadHighscores(parseInt(tab.dataset.pieces, 10));

    });

    const initialTab = tabsWrap.querySelector(".highscore-piece-tab.is-selected");
    loadHighscores(initialTab ? parseInt(initialTab.dataset.pieces, 10) : 48);

})();
