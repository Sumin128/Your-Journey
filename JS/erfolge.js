/* =====================================================
   ERFOLGE-SEITE
   Zeigt alle Erfolge aus dem Katalog (player.js) an,
   freigeschaltete farbig, gesperrte ausgegraut.
   ===================================================== */

function renderAchievements() {

    const grid = document.getElementById("achievements-grid");
    const summary = document.getElementById("achievements-summary");

    if (!grid || typeof achievementCatalog === "undefined") {
        return;
    }

    const unlockedCount = achievementCatalog.filter(function (achievement) {

        return player.achievements.includes(achievement.name);

    }).length;

    if (summary) {

        summary.textContent =
            unlockedCount + " von " + achievementCatalog.length + " Erfolgen freigeschaltet";

    }

    grid.innerHTML = "";

    achievementCatalog.forEach(function (achievement) {

        const isUnlocked = player.achievements.includes(achievement.name);
        const isHiddenSecret = Boolean(achievement.secret) && !isUnlocked;

        const card = document.createElement("div");

        card.className =
            "achievement-card " +
            (isUnlocked ? "achievement-card--unlocked" : "achievement-card--locked") +
            (isHiddenSecret ? " achievement-card--secret" : "");

        const icon = document.createElement("div");
        icon.className = "achievement-card-icon";
        icon.textContent = isUnlocked ? achievement.icon : "🔒";

        const name = document.createElement("h2");
        name.textContent = isHiddenSecret ? "???" : achievement.name;

        const description = document.createElement("p");
        description.textContent =
            isHiddenSecret ? "Ein geheimer Erfolg wartet darauf, entdeckt zu werden." : achievement.description;

        const status = document.createElement("span");
        status.className = "achievement-card-status";
        status.textContent = isUnlocked ? "Freigeschaltet" : "Noch gesperrt";

        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(description);
        card.appendChild(status);

        grid.appendChild(card);

    });

}

renderAchievements();

window.addEventListener("player-updated", renderAchievements);
