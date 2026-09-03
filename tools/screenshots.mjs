/* Lädt jede HTML-Seite in echtem Chromium, sammelt Konsolen-Fehler und
   fehlgeschlagene Requests, macht Screenshots (Desktop + Handy).

   node tools/screenshots.mjs             -> alle Seiten
   node tools/screenshots.mjs fuchs bako  -> nur passende Seiten
*/

import { chromium } from "playwright";
import { startServer } from "./serve.mjs";
import { readdirSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "tools", "__screenshots__");
const filters = process.argv.slice(2);

const IGNORE_CONSOLE = [
    /favicon/i,
    /supabase.*401/i,          // nicht angemeldet ist ok
    /Failed to load resource.*401/i
];

const pages = readdirSync(root)
    .filter((f) => f.endsWith(".html"))
    .filter((f) => filters.length === 0 || filters.some((x) => f.includes(x)));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const { server, port } = await startServer();
const browser = await chromium.launch();
let problems = 0;

for (const file of pages) {
    const name = file.replace(".html", "");
    for (const [label, viewport] of [
        ["desktop", { width: 1280, height: 900 }],
        ["mobile", { width: 390, height: 844 }]
    ]) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const errors = [];

        page.on("console", (m) => {
            if (m.type() === "error" && !IGNORE_CONSOLE.some((re) => re.test(m.text()))) {
                errors.push("console: " + m.text());
            }
        });
        page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
        page.on("requestfailed", (r) => {
            const u = r.url();
            if (!/favicon/i.test(u)) errors.push("requestfailed: " + u + " (" + r.failure()?.errorText + ")");
        });
        page.on("response", (r) => {
            if (r.status() >= 400 && !/favicon|supabase|401/i.test(r.url())) {
                errors.push("http " + r.status() + ": " + r.url());
            }
        });

        await page.goto(`http://localhost:${port}/${file}`, { waitUntil: "load", timeout: 15000 }).catch((e) => errors.push("goto: " + e.message));
        await page.waitForTimeout(900);
        await page.screenshot({ path: join(outDir, `${name}.${label}.png`), fullPage: label === "desktop" });

        if (errors.length) {
            problems += errors.length;
            console.log(`\n✗ ${file} [${label}]`);
            for (const e of [...new Set(errors)]) console.log("   " + e);
        }
        await ctx.close();
    }
}

await browser.close();
server.close();

console.log(`\n${pages.length} Seiten, Screenshots in tools/__screenshots__/`);
if (problems) { console.log(`${problems} Konsolen-/Request-Probleme (siehe oben)`); process.exit(1); }
console.log("keine Konsolen-/Request-Fehler");
