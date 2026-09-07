/* Malt 5 gemalte Gouache-Farbfelder (4 Emblemfarben + Gold) als Material
   fuer den Badge-Compositor. KEINE Formen, nur Flaeche + Pinseltextur +
   Licht von oben-links.  -> images/badges/neu/mat_<name>.png
*/
import { GoogleGenAI, Modality } from "@google/genai";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const key = JSON.parse(fs.readFileSync(path.join(ROOT, ".mcp.json"), "utf8"))
    .mcpServers["gemini-image"].env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: key });
const OUT = path.join(ROOT, "images/badges/neu");
fs.mkdirSync(OUT, { recursive: true });

const MATS = {
    waldgruen: "deep forest green with soft mossy undertones",
    himmelblau: "a bright, friendly sky blue",
    beerenrosa: "a warm berry-rose pink",
    sonnengold: "a glowing sun-gold / warm amber yellow",
    gold: "warm brushed metallic gold, soft golden highlights and deeper amber shadows"
};

function prompt(desc) {
    return `A hand-painted gouache colour field, entirely ${desc}. Soft visible brush strokes, gentle smooth shading with light coming from the upper-left: a little lighter and warmer in the top-left, a little deeper in the bottom-right. Storybook picture-book paint texture, cosy and friendly. NO objects, NO shapes, NO outlines, NO text, NO gradient banding - just an even painted surface that fills the entire square edge to edge.`;
}

for (const [name, desc] of Object.entries(MATS)) {
    process.stdout.write(name + " ... ");
    const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts: [{ text: prompt(desc) }] }],
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
    });
    let ok = false;
    for (const p of res.candidates?.[0]?.content?.parts || []) {
        if (p.inlineData) {
            fs.writeFileSync(path.join(OUT, `mat_${name}.png`), Buffer.from(p.inlineData.data, "base64"));
            ok = true;
        }
    }
    console.log(ok ? "ok" : "KEIN BILD");
}
console.log("fertig");
