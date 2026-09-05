/* =====================================================
   LEVEL-DATA.JS
   Mirelon-Levelsystem: Katalog + gemeinsame Anwend-Logik.

   MIRELON_LEVELS ist der Anzeige-Katalog (Fortschrittsbalken,
   Levelseite, "was kommt als Nächstes" o.ä.) - für angemeldete
   Nutzer ist ausschließlich die serverseitige earn_xp()-Funktion
   (siehe supabase_migration_schloss.sql) maßgeblich, diese Tabelle
   hier ist dort NUR gespiegelt, nicht sicherheitsrelevant. Ändert
   sich die Progression, müssen beide Stellen von Hand synchron
   gehalten werden.

   Für GÄSTE (kein Konto, kein Server) ist applyEarnedXp() hier
   dagegen die einzige und maßgebliche Quelle - es gibt nichts
   dahinter zu schützen, genau wie bei Münzen/Erfolgen für Gäste
   schon heute (siehe grantCoins() in JS/player.js).

   Feature-Spezifikation: docs/mein-schloss.md
   ===================================================== */

const MIRELON_LEVELS = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 120, rewards: [{ type: "coins", amount: 30 }] },
    { level: 3, xpRequired: 300, rewards: [
        { type: "featureUnlock", key: "castle" },
        { type: "furniture", ids: ["stuhl_wald_a", "tisch_wald_a", "teppich_wald_a"] },
        { type: "coins", amount: 20 }
    ], storyEvent: "castle_unlock" },
    { level: 4, xpRequired: 550, rewards: [{ type: "coins", amount: 40 }] },
    { level: 5, xpRequired: 850, rewards: [{ type: "furniture", ids: ["lampe_wald_a"] }] },
    { level: 6, xpRequired: 1200, rewards: [{ type: "coins", amount: 50 }] },
    { level: 7, xpRequired: 1600, rewards: [{ type: "consumable", key: "konfetti", amount: 3 }] },
    { level: 8, xpRequired: 2050, rewards: [{ type: "furniture", ids: ["regal_wald_a"] }] },
    { level: 9, xpRequired: 2550, rewards: [{ type: "coins", amount: 60 }] },
    { level: 10, xpRequired: 3100, rewards: [{ type: "cosmetic", key: "sidebar_glanz_gold" }] }
];

/* Feste XP-Beträge je Aktivität - muss zur case-Anweisung in
   earn_xp() (supabase_migration_schloss.sql) passen. Hier nur für
   Gäste UND für die sofortige, optimistische Lokal-Anzeige bei
   angemeldeten Nutzern (wird danach vom Server überschrieben). */
const MIRELON_XP_REWARDS = {
    quiz_richtig: 8,
    faro_spiel_gewonnen: 15,
    malstube_bild_gespeichert: 12,
    baumkind_gepflegt: 5,
    puzzle_geloest: 20
};

function findLevelForXp(xp) {

    let result = 1;

    MIRELON_LEVELS.forEach(function (entry) {
        if (entry.xpRequired <= xp) {
            result = entry.level;
        }
    });

    return result;

}

/* Wendet eine bereits verdiente XP-Menge auf player.progression an,
   inkl. Level-Aufstieg + Belohnungen - identische Logik zu earn_xp()
   in supabase_migration_schloss.sql, nur lokal statt serverseitig.
   claimedLevelRewards verhindert Doppel-Vergabe genau wie dort.
   Gibt die Liste der neu vergebenen Belohnungen zurück (leer, wenn
   kein Level-Aufstieg dabei war) und setzt bei einem Story-Event
   player.pendingStoryEvents entsprechend. */
function applyEarnedXp(xpAmount) {

    if (typeof xpAmount !== "number" || xpAmount <= 0) {
        return { grantedRewards: [], storyEvent: null };
    }

    if (!player.progression) {
        player.progression = defaultProgression();
    }

    const previousLevel = player.progression.level || 1;

    player.progression.xp = (player.progression.xp || 0) + xpAmount;

    const newLevel = findLevelForXp(player.progression.xp);

    player.progression.level = newLevel;

    if (!Array.isArray(player.progression.unlockedFeatures)) {
        player.progression.unlockedFeatures = [];
    }

    if (!Array.isArray(player.progression.claimedLevelRewards)) {
        player.progression.claimedLevelRewards = [];
    }

    const granted = [];
    let storyEvent = null;

    MIRELON_LEVELS.forEach(function (entry) {

        if (entry.level <= previousLevel || entry.level > newLevel) {
            return;
        }

        if (player.progression.claimedLevelRewards.indexOf(String(entry.level)) !== -1) {
            return;
        }

        (entry.rewards || []).forEach(function (reward) {
            applyProgressionReward(reward);
            granted.push(reward);
        });

        player.progression.claimedLevelRewards.push(String(entry.level));

        if (entry.storyEvent) {

            storyEvent = entry.storyEvent;

            if (!Array.isArray(player.pendingStoryEvents)) {
                player.pendingStoryEvents = [];
            }

            if (player.pendingStoryEvents.indexOf(entry.storyEvent) === -1) {
                player.pendingStoryEvents.push(entry.storyEvent);
            }

        }

    });

    return { grantedRewards: granted, storyEvent: storyEvent };

}

/* Eine einzelne Belohnung auf den lokalen player anwenden. Getrennt
   von applyEarnedXp(), damit sowohl der Gast-Pfad (mehrere Rewards
   pro Level-Aufstieg) als auch ein möglicher Debug-/Testpfad dieselbe
   Stelle nutzen. */
function applyProgressionReward(reward) {

    if (!reward || !reward.type) {
        return;
    }

    if (reward.type === "coins" && typeof reward.amount === "number") {

        player.coins = (player.coins || 0) + reward.amount;
        player.totalCoinsEarned = (player.totalCoinsEarned || 0) + reward.amount;

    } else if (reward.type === "featureUnlock" && reward.key) {

        if (player.progression.unlockedFeatures.indexOf(reward.key) === -1) {
            player.progression.unlockedFeatures.push(reward.key);
        }

    } else if (reward.type === "furniture" && Array.isArray(reward.ids)) {

        if (!player.schloss) {
            player.schloss = defaultSchloss();
        }

        if (!Array.isArray(player.schloss.ownedFurniture)) {
            player.schloss.ownedFurniture = [];
        }

        reward.ids.forEach(function (id) {
            if (player.schloss.ownedFurniture.indexOf(id) === -1) {
                player.schloss.ownedFurniture.push(id);
            }
        });

    } else if (reward.type === "consumable" && reward.key) {

        if (!player.consumables) {
            player.consumables = {};
        }

        const amount = typeof reward.amount === "number" ? reward.amount : 1;

        player.consumables[reward.key] = (player.consumables[reward.key] || 0) + amount;

    }
    // "cosmetic"/"decoration"/"roomUnlock": für Phase 1 nur informativ
    // (z. B. für eine spätere Anzeige), ändert lokal nichts weiter.

}
