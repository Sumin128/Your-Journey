/* Bild-Generierung über Gemini (Nano Banana) für Mirelon-Assets.
   Nutzung:
     node tools/gemini-mcp/gen.mjs "<prompt>" <ausgabe.png> [ref1.png ref2.png ...]
   Key kommt aus .mcp.json im Projekt-Root (gitignored).
*/
import { GoogleGenAI, Modality } from "@google/genai";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const key = JSON.parse(fs.readFileSync(path.join(ROOT, ".mcp.json"), "utf8"))
    .mcpServers["gemini-image"].env.GEMINI_API_KEY;

const [prompt, outFile, ...refs] = process.argv.slice(2);
if (!prompt || !outFile) {
    console.error('Nutzung: node gen.mjs "<prompt>" <ausgabe.png> [ref.png ...]');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: key });

const parts = [{ text: prompt }];
for (const ref of refs) {
    const buf = fs.readFileSync(ref);
    const ext = path.extname(ref).slice(1).toLowerCase();
    parts.push({
        inlineData: {
            mimeType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png",
            data: buf.toString("base64")
        }
    });
}

const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts }],
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
});

let saved = false;
for (const p of res.candidates?.[0]?.content?.parts || []) {
    if (p.inlineData) {
        fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
        fs.writeFileSync(outFile, Buffer.from(p.inlineData.data, "base64"));
        console.log("gespeichert: " + outFile);
        saved = true;
    } else if (p.text) {
        console.log("[modell] " + p.text.trim().slice(0, 200));
    }
}
if (!saved) {
    console.error("kein Bild erhalten");
    process.exit(2);
}
