/* =====================================================
   LEVEL-UP.JS
   Anzeige für den Mirelon-Levelsystem-Fortschritt:
    - kleines Popup für einen normalen Level-Aufstieg
    - großes Erzähl-Panel (Faro) für Level mit storyEvent
      (aktuell nur Level 3 / "castle_unlock")

   Wird von JS/player.js (Gast-Pfad, optimistisch) und JS/auth.js
   (maßgeblicher Server-Pfad) über window.showMirelonLevelUp()
   aufgerufen. Rein Anzeige - vergibt selbst nichts, siehe
   JS/level-data.js für die eigentliche Belohnungs-Logik.
   ===================================================== */

const STORY_EVENTS = {

    castle_unlock: {
        character: "Faro",
        avatar: "images/faro1.png",
        text: "Hey, du Entdecker-Ass! Ich hab da draußen im Wald was Spannendes gefunden – ein altes Schloss! Es hat schon lange auf jemanden gewartet, der sich darum kümmert. Willst du es dir ansehen?",
        confirmLabel: "Ja, zeig's mir! 🏰",
        dismissLabel: "Später",
        goTo: "schloss.html"
    }

};

function formatRewardLine(reward) {

    if (!reward || !reward.type) {
        return null;
    }

    if (reward.type === "coins") {
        return "🪙 +" + reward.amount + " Münzen";
    }

    if (reward.type === "featureUnlock" && reward.key === "castle") {
        return "🏰 Das Schloss ist freigeschaltet!";
    }

    if (reward.type === "furniture") {
        const count = Array.isArray(reward.ids) ? reward.ids.length : 1;
        return "🪑 " + count + " neue" + (count === 1 ? "s Möbelstück" : " Möbelstücke") + " fürs Schloss";
    }

    if (reward.type === "consumable" && reward.key === "konfetti") {
        return "🎊 +" + (reward.amount || 1) + " Konfetti";
    }

    if (reward.type === "cosmetic") {
        return "✨ Neuer Glanz freigeschaltet";
    }

    return null;

}

/* Entfernt ein Story-Event aus player.pendingStoryEvents, sobald es
   gezeigt wurde - unkritisch/ungeschützt, siehe defaultProgression()
   in JS/player.js (Trennung "Feature freigeschaltet" vs. "Story
   gesehen"). */
function markStoryEventSeen(storyEventKey) {

    if (!Array.isArray(player.pendingStoryEvents)) {
        return;
    }

    const index = player.pendingStoryEvents.indexOf(storyEventKey);

    if (index !== -1) {
        player.pendingStoryEvents.splice(index, 1);
        savePlayer();
        window.dispatchEvent(new CustomEvent("player-updated"));
    }

}

function showLevelUpPopup(level, grantedRewards) {

    const existing = document.querySelector(".level-up-popup");

    if (existing) {
        existing.remove();
    }

    const popup = document.createElement("div");

    popup.className = "level-up-popup";

    const lines = (grantedRewards || [])
        .map(formatRewardLine)
        .filter(Boolean);

    popup.innerHTML = `
        <button type="button" class="level-up-popup-close" aria-label="Schließen">✕</button>
        <div class="level-up-popup-title">🎉 Level ${level} erreicht!</div>
        <ul class="level-up-popup-rewards"></ul>
    `;

    const list = popup.querySelector(".level-up-popup-rewards");

    lines.forEach(function (line) {
        const item = document.createElement("li");
        item.textContent = line;
        list.appendChild(item);
    });

    document.body.appendChild(popup);

    function close() {
        popup.classList.remove("level-up-popup--show");
        setTimeout(function () { popup.remove(); }, 300);
    }

    popup.querySelector(".level-up-popup-close").addEventListener("click", close);

    setTimeout(function () { popup.classList.add("level-up-popup--show"); }, 10);
    setTimeout(close, 6000);

}

function showStoryEvent(storyEventKey, level) {

    const story = STORY_EVENTS[storyEventKey];

    if (!story) {
        markStoryEventSeen(storyEventKey);
        return;
    }

    const existing = document.querySelector(".mirelon-story-overlay");

    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement("div");

    overlay.className = "mirelon-story-overlay";

    overlay.innerHTML = `
        <div class="mirelon-story-backdrop"></div>
        <div class="mirelon-story-card" role="alertdialog" aria-modal="true">
            <img src="${story.avatar}" alt="${story.character}" class="mirelon-story-avatar" decoding="async">
            <p class="mirelon-story-text"></p>
            <div class="mirelon-story-actions">
                <button type="button" class="yj-button yj-button--secondary yj-button--compact mirelon-story-dismiss"></button>
                <button type="button" class="yj-button yj-button--primary yj-button--compact mirelon-story-confirm"></button>
            </div>
        </div>
    `;

    overlay.querySelector(".mirelon-story-text").textContent = story.text;
    overlay.querySelector(".mirelon-story-confirm").textContent = story.confirmLabel;
    overlay.querySelector(".mirelon-story-dismiss").textContent = story.dismissLabel;

    document.body.appendChild(overlay);

    function close() {
        overlay.classList.remove("mirelon-story-overlay--show");
        setTimeout(function () { overlay.remove(); }, 200);
        markStoryEventSeen(storyEventKey);
    }

    overlay.querySelector(".mirelon-story-backdrop").addEventListener("click", close);
    overlay.querySelector(".mirelon-story-dismiss").addEventListener("click", close);

    overlay.querySelector(".mirelon-story-confirm").addEventListener("click", function () {
        markStoryEventSeen(storyEventKey);
        location.href = story.goTo;
    });

    setTimeout(function () { overlay.classList.add("mirelon-story-overlay--show"); }, 10);

}

function showMirelonLevelUp(level, grantedRewards, storyEvent) {

    if (storyEvent && STORY_EVENTS[storyEvent]) {
        showStoryEvent(storyEvent, level);
        return;
    }

    showLevelUpPopup(level, grantedRewards);

}

window.showMirelonLevelUp = showMirelonLevelUp;
