#!/usr/bin/env node
/* =====================================================
   Mirelon – Smoke-Test (keine Abhängigkeiten)

   Prüft vor jedem Deploy:
   1. Jede JS-Datei unter JS/ ist syntaktisch gültig (node --check).
   2. Jede HTML-Seite im Projektroot referenziert nur JS-/CSS-Dateien,
      die es wirklich gibt.
   3. Kein <script>/<link> zeigt auf einen doppelten oder leeren Pfad.

   Aufruf:  node tools/check-pages.mjs
   Exit 1 bei Fehlern (bricht die GitHub Action ab).
   ===================================================== */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

/* ---- 1. Alle JS-Dateien parsen ---- */
const jsDir = join(root, "JS");
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith(".js"));
for (const f of jsFiles) {
    try {
        execFileSync(process.execPath, ["--check", join(jsDir, f)], { stdio: "pipe" });
    } catch (e) {
        errors.push(`JS/${f}: Syntaxfehler\n${(e.stderr || e.message).toString().trim()}`);
    }
}

/* ---- 2. HTML-Referenzen prüfen ---- */
const htmlFiles = readdirSync(root).filter((f) => f.endsWith(".html"));
const refRe = /(?:src|href)\s*=\s*"((?:JS|CSS)\/[^"]+)"/g;

for (const page of htmlFiles) {
    const html = readFileSync(join(root, page), "utf8");
    const seen = new Set();
    let m;
    while ((m = refRe.exec(html)) !== null) {
        const raw = m[1];
        const path = raw.split("?")[0];

        if (!path || path.endsWith("/")) {
            errors.push(`${page}: leerer/ungültiger Pfad "${raw}"`);
            continue;
        }
        if (seen.has(path)) {
            errors.push(`${page}: "${path}" wird doppelt eingebunden`);
        }
        seen.add(path);

        if (!existsSync(join(root, path))) {
            errors.push(`${page}: referenziert "${raw}" – Datei fehlt`);
        }
    }
}

/* ---- Ergebnis ---- */
if (errors.length > 0) {
    console.error(`\n✗ ${errors.length} Problem(e):\n`);
    for (const e of errors) console.error("  • " + e + "\n");
    process.exit(1);
}

console.log(`✓ ${jsFiles.length} JS-Dateien ok, ${htmlFiles.length} HTML-Seiten ok`);
