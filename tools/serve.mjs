/* Winziger statischer Server für lokale Tests. Keine Abhängigkeiten.
   Direkt aufrufbar (node tools/serve.mjs [port]) oder als Modul. */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".jfif": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
    ".svg": "image/svg+xml", ".ico": "image/x-icon",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg"
};

export function startServer(port = 0) {
    return new Promise((resolve) => {
        const server = createServer(async (req, res) => {
            try {
                let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
                if (path === "/") path = "/index.html";
                const filePath = join(ROOT, normalize(path));
                if (!filePath.startsWith(ROOT)) { res.writeHead(403).end(); return; }

                const info = await stat(filePath).catch(() => null);
                if (!info || !info.isFile()) { res.writeHead(404).end("404: " + path); return; }

                const body = await readFile(filePath);
                res.writeHead(200, { "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream" });
                res.end(body);
            } catch (e) {
                res.writeHead(500).end(String(e));
            }
        });
        server.listen(port, () => resolve({ server, port: server.address().port }));
    });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("serve.mjs")) {
    const p = Number(process.argv[2]) || 8080;
    startServer(p).then(({ port }) => console.log(`http://localhost:${port}`));
}
