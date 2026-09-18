// Wandelt die im Code referenzierten großen PNGs in WebP um (verlustarm,
// max. 1600px lange Kante - alle betroffenen Bilder werden aktuell weit
// unter dieser Größe angezeigt, siehe Audit in der Commit-Beschreibung).
// Originale werden NICHT gelöscht, sondern nach images/_originale/
// verschoben (gleiche Unterordnerstruktur), bis das Ergebnis freigegeben
// ist. Einmaliges Werkzeug fuer diesen Optimierungsdurchgang - kein
// Teil des normalen Build-/Check-Laufs.
import sharp from "sharp";
import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAX_EDGE = 1600;
const QUALITY = 88;

// Pfade relativ zu images/ - nur Dateien, die tatsächlich noch von
// HTML/CSS/JS referenziert werden (unreferenzierte Funde separat
// gemeldet, nicht hier mitkonvertiert).
const FILES = [
    "branos.png",
    "faro1.png",
    "faros_fuchsbau3.png",
    "kuros_nest_final.png",
    "hasenschule.png",
    "luis_huette.png",
    "baerenthal.png",
    "tessa_hase.png",
    "kuro_shop_1.png",
    "Kuro_close.png",
    "luis_chameleon.png",
    "chameleon_luis_blue.png",
    "chameleon_luis_orange.png",
    "chameleon_luis_red.png",
    "chameleon_luis_green.png",
    "chameleon_luis_zuckerwatte.png",
    "chameleon_luis_brown.png",
    "schloss/textures/wuestenschloss-decke-lehmputz.png",
    "schloss/textures/wuestenschloss-kamin-sandstein.png",
    "schloss/textures/wuestenschloss-wand-sandstein.png",
    "schloss/textures/wuestenschloss-holz-akazie.png",
    "schloss/textures/wald-decke-kalkputz-storybook.png",
    "schloss/textures/wuestenschloss-boden-terracotta.png",
    "schloss/textures/wuestenschloss-tuer-akazie.png",
    "schloss/textures/wald-steinwand-storybook.png",
    "schloss/textures/waldpanorama-storybook.png",
    "schloss/textures/wald-holzboden-storybook.png",
    "schloss/textures/kamin-innenstein-storybook.png",
    "schloss/textures/wald-tuer-storybook.png",
    "schloss/textures/wald-deckenbalken-storybook.png",
    "schloss/textures/wuestenpanorama-storybook.png"
];

function fmtKb(bytes) { return (bytes / 1024).toFixed(0) + " KB"; }

async function run() {
    const results = [];
    for (const rel of FILES) {
        const srcAbs = path.join(ROOT, "images", rel);
        const destAbs = srcAbs.replace(/\.png$/i, ".webp");
        const archiveAbs = path.join(ROOT, "images", "_originale", rel);

        const before = (await stat(srcAbs)).size;

        await sharp(srcAbs)
            .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
            .webp({ quality: QUALITY })
            .toFile(destAbs);

        const after = (await stat(destAbs)).size;

        await mkdir(path.dirname(archiveAbs), { recursive: true });
        await rename(srcAbs, archiveAbs);

        results.push({ rel, before, after });
    }

    console.log("\nDatei".padEnd(58) + "vorher".padStart(10) + "nachher".padStart(10) + "gespart".padStart(12));
    let totalBefore = 0, totalAfter = 0;
    for (const r of results) {
        totalBefore += r.before; totalAfter += r.after;
        const saved = 100 - (r.after / r.before) * 100;
        console.log(
            r.rel.padEnd(58) + fmtKb(r.before).padStart(10) + fmtKb(r.after).padStart(10) + (saved.toFixed(0) + " %").padStart(12)
        );
    }
    console.log("-".repeat(90));
    console.log(
        "GESAMT".padEnd(58) + fmtKb(totalBefore).padStart(10) + fmtKb(totalAfter).padStart(10) +
        ((100 - (totalAfter / totalBefore) * 100).toFixed(0) + " %").padStart(12)
    );
}

run().catch((err) => { console.error(err); process.exit(1); });
