/* =====================================================
   LEVEL-DATA.JS
   Mirelon-Fortschrittssystem: Katalog + gemeinsame Anwend-Logik.

   MIRELON_LEVELS ist der Anzeige-Katalog (Fortschrittsbalken,
   Sidebar-Levelanzeige, Fortschrittsseite). Für ANGEMELDETE Nutzer
   ist ausschliesslich die serverseitige earn_xp()-Funktion massgeblich
   (supabase_migration_progression_v2.sql) - diese Tabelle ist dort NUR
   gespiegelt, nicht sicherheitsrelevant. Ändert sich die Progression,
   müssen beide Stellen von Hand synchron gehalten werden.

   Für GÄSTE (kein Konto, kein Server) ist applyEarnedXp() hier die
   einzige und massgebliche Quelle - genau wie bei Münzen/Erfolgen
   für Gäste schon heute (grantCoins() in JS/player.js). Dieselben
   Regeln, lokal gespiegelt: XP je (Grund, Schwierigkeit), 100-XP-
   Tageslimit, keine Wiederholungs-XP für dieselbe Runde/Variante.

   Feature-Spezifikation: docs/mein-schloss.md
   ===================================================== */

/* Gesamt-XP je Stufe (Kurve 1-20). Muss zur VALUES-Tabelle in
   earn_xp() passen. */
const MIRELON_LEVELS = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100, rewards: [{ type: "coins", amount: 25 }] },
    { level: 3, xpRequired: 300, rewards: [
        { type: "featureUnlock", key: "castle" },
        { type: "furniture", ids: ["stuhl_wald_a", "tisch_wald_a", "teppich_wald_a"] },
        { type: "coins", amount: 20 }
    ], storyEvent: "castle_unlock" },
    { level: 4, xpRequired: 550, rewards: [{ type: "consumable", key: "konfetti", amount: 2 }] },
    { level: 5, xpRequired: 850, rewards: [{ type: "furniture", ids: ["lampe_wald_a"] }] },
    { level: 6, xpRequired: 1200, rewards: [{ type: "coins", amount: 40 }] },
    { level: 7, xpRequired: 1600, rewards: [{ type: "consumable", key: "feuerwerk", amount: 1 }] },
    { level: 8, xpRequired: 2050, rewards: [{ type: "furniture", ids: ["regal_wald_a"] }] },
    { level: 9, xpRequired: 2550, rewards: [{ type: "coins", amount: 50 }] },
    { level: 10, xpRequired: 3100, rewards: [{ type: "coins", amount: 60 }] },
    // 11-20: bewusst nur sichere Belohnungen (Münzen + vorhandene
    // Consumables). Grosse Meilensteine (Garten, neue Schlossräume/
    // -stile) kommen erst, wenn die Inhalte fertig sind.
    { level: 11, xpRequired: 3700, rewards: [{ type: "coins", amount: 40 }] },
    { level: 12, xpRequired: 4350, rewards: [{ type: "consumable", key: "konfetti", amount: 1 }] },
    { level: 13, xpRequired: 5050, rewards: [{ type: "coins", amount: 50 }] },
    { level: 14, xpRequired: 5800, rewards: [{ type: "consumable", key: "feuerwerk", amount: 1 }] },
    { level: 15, xpRequired: 6600, rewards: [{ type: "coins", amount: 60 }] },
    { level: 16, xpRequired: 7450, rewards: [{ type: "consumable", key: "konfetti", amount: 2 }] },
    { level: 17, xpRequired: 8350, rewards: [{ type: "coins", amount: 70 }] },
    { level: 18, xpRequired: 9300, rewards: [{ type: "consumable", key: "feuerwerk", amount: 1 }] },
    { level: 19, xpRequired: 10300, rewards: [{ type: "coins", amount: 80 }] },
    { level: 20, xpRequired: 11350, rewards: [
        { type: "coins", amount: 100 },
        { type: "consumable", key: "konfetti", amount: 2 },
        { type: "consumable", key: "feuerwerk", amount: 1 }
    ] }
];

const MIRELON_MAX_LEVEL = MIRELON_LEVELS[MIRELON_LEVELS.length - 1].level;

/* Ab Stufe 3 / 300 XP: Mein Schloss + Tamos Werkstatt. */
const MIRELON_CASTLE_XP = 300;

/* Höchstens so viele reguläre XP pro Kalendertag (serverseitig
   abgesichert, siehe earn_xp()). */
const MIRELON_DAILY_XP_CAP = 100;

/* XP-Betrag je (Grund, Schwierigkeit) - deckungsgleich mit der
   case-Anweisung in earn_xp(). Schwierigkeit: "leicht"|"normal"|
   "schwer" (unbekannt -> "normal"). */
function mirelonXpFor(reason, difficulty) {

    const d = (["leicht", "normal", "schwer"].indexOf(difficulty) !== -1)
        ? difficulty
        : "normal";

    switch (reason) {
        case "quiz_richtig":
        case "faro_spiel_gewonnen":
            return d === "leicht" ? 10 : (d === "schwer" ? 30 : 20);
        case "puzzle_geloest":
            return d === "leicht" ? 15 : (d === "schwer" ? 40 : 25);
        case "tagesaufgabe":
            return d === "schwer" ? 50 : 25;
        case "baumkind_gepflegt":
            return d === "normal" ? 10 : 5;
        case "malstube_bild_gespeichert":
            return 10;
        default:
            return null;
    }
}

function findLevelForXp(xp) {

    let result = 1;

    MIRELON_LEVELS.forEach(function (entry) {
        if (entry.xpRequired <= xp) {
            result = entry.level;
        }
    });

    return result;
}

/* "Aktuelle Teilstrecke" für den Fortschrittsbalken:
   { level, into, span, xp, nextLevel, toNext } - nie die Gesamt-XP. */
function mirelonLevelProgress(xp) {

    const value = Math.max(0, Number(xp) || 0);
    const level = findLevelForXp(value);
    const current = MIRELON_LEVELS.find(function (e) { return e.level === level; });
    const next = MIRELON_LEVELS.find(function (e) { return e.level === level + 1; });

    const base = current ? current.xpRequired : 0;

    if (!next) {
        return { level: level, into: 0, span: 0, xp: value, nextLevel: null, nextXp: null, toNext: 0, maxed: true };
    }

    return {
        level: level,
        into: value - base,          // Balkenfüllung: into / span
        span: next.xpRequired - base,
        xp: value,                   // Gesamt-XP (Anzeige: xp / nextXp)
        nextLevel: next.level,
        nextXp: next.xpRequired,
        toNext: Math.max(0, next.xpRequired - value),
        maxed: false
    };
}

/* Lokaler Kalendertag (YYYY-MM-DD) für die Gast-Tageslogik. */
function mirelonToday() {
    const d = new Date();
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

/* Dedup-Schlüssel wie in earn_xp() - gleiche Runde+Stufe zählt nur
   einmal; neue Runde-ID ODER höhere Schwierigkeit = neuer Schlüssel. */
function mirelonDedupKey(reason, difficulty, roundId, today) {
    if (reason === "malstube_bild_gespeichert") {
        return "xpr_malstube_" + today;
    }
    if (roundId != null && String(roundId).trim() !== "") {
        return "xpr_" + reason + "_" + difficulty + "_" + String(roundId).trim().slice(0, 120);
    }
    return "xp_" + reason;
}

/* Verdient eine XP-Menge für den GAST lokal, inkl. Level-Aufstieg +
   Belohnungen + Tageslimit + Wiederholungssperre - dieselben Regeln
   wie earn_xp() serverseitig. Für angemeldete Nutzer ist das nur die
   sofortige, optimistische Anzeige (auth.js ersetzt sie danach durch
   die Server-Antwort).

   Rückgabe:
     { grantedRewards, storyEvent, xpGained, capped, alreadyRewarded } */
function applyEarnedXp(reason, difficulty, roundId) {

    const empty = { grantedRewards: [], storyEvent: null, xpGained: 0, capped: false, alreadyRewarded: false };

    const d = (["leicht", "normal", "schwer"].indexOf(difficulty) !== -1) ? difficulty : "normal";
    const base = mirelonXpFor(reason, d);

    if (base == null) {
        return empty;
    }

    if (!player.progression) {
        player.progression = defaultProgression();
    }

    const prog = player.progression;

    if (!Array.isArray(prog.unlockedFeatures)) { prog.unlockedFeatures = []; }
    if (!Array.isArray(prog.claimedLevelRewards)) { prog.claimedLevelRewards = []; }
    if (!prog.xpRounds || typeof prog.xpRounds !== "object") { prog.xpRounds = {}; }

    const today = mirelonToday();

    if (prog.dayDate !== today) {
        prog.dayDate = today;
        prog.dayXp = 0;
        // alte Runden-Schlüssel aufräumen (>2 Tage)
        const cutoff = Date.now() - 2 * 86400000;
        Object.keys(prog.xpRounds).forEach(function (k) {
            if (prog.xpRounds[k] < cutoff) { delete prog.xpRounds[k]; }
        });
    }

    prog.dayXp = Number(prog.dayXp) || 0;

    // 1) Tageslimit
    const remaining = MIRELON_DAILY_XP_CAP - prog.dayXp;
    if (remaining <= 0) {
        return { grantedRewards: [], storyEvent: null, xpGained: 0, capped: true, alreadyRewarded: false };
    }

    // 2) Wiederholungssperre
    const key = mirelonDedupKey(reason, d, roundId, today);
    const isRoundKey = key.indexOf("xpr_") === 0;
    const ttl = (reason === "malstube_bild_gespeichert")
        ? 86400000
        : (isRoundKey ? 64800000 : (reason === "baumkind_gepflegt" ? 3600000 : 4000));
    const last = prog.xpRounds[key] || 0;
    if (Date.now() - last < ttl) {
        return { grantedRewards: [], storyEvent: null, xpGained: 0, capped: false, alreadyRewarded: true };
    }
    prog.xpRounds[key] = Date.now();

    // 3) Gutschrift (auf Tagesrest gedeckelt)
    const gained = Math.min(base, remaining);
    const previousLevel = prog.level || 1;

    prog.xp = (prog.xp || 0) + gained;
    prog.dayXp += gained;
    prog.level = findLevelForXp(prog.xp);

    const granted = [];
    let storyEvent = null;

    MIRELON_LEVELS.forEach(function (entry) {

        if (entry.level <= previousLevel || entry.level > prog.level) { return; }
        if (prog.claimedLevelRewards.indexOf(String(entry.level)) !== -1) { return; }

        (entry.rewards || []).forEach(function (reward) {
            applyProgressionReward(reward);
            granted.push(reward);
        });

        prog.claimedLevelRewards.push(String(entry.level));

        if (entry.storyEvent) {
            storyEvent = entry.storyEvent;
            if (!Array.isArray(player.pendingStoryEvents)) { player.pendingStoryEvents = []; }
            if (player.pendingStoryEvents.indexOf(entry.storyEvent) === -1) {
                player.pendingStoryEvents.push(entry.storyEvent);
            }
        }

    });

    return {
        grantedRewards: granted,
        storyEvent: storyEvent,
        xpGained: gained,
        capped: gained < base,
        alreadyRewarded: false
    };
}

/* Eine einzelne Belohnung auf den lokalen player anwenden. */
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
    // "cosmetic"/"decoration"/"roomUnlock": für Phase 1 nur informativ.
}
