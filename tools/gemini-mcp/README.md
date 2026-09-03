# Lokaler Gemini-Bild-MCP-Server

Nur für die Entwicklung (Asset-Generierung), nicht Teil der Website.

`@creating-cat/gemini-image-mcp-server@0.1.4` hat das Modell
`gemini-2.0-flash-preview-image-generation` hartkodiert - das hat Google
abgeschaltet. Deshalb hier lokal installiert und die eine Zeile gepatcht auf
`gemini-2.5-flash-image` (Nano Banana).

Patch nach jedem `npm install` neu anwenden:

    sed -i "s/gemini-2.0-flash-preview-image-generation/gemini-2.5-flash-image/g" \
      node_modules/@creating-cat/gemini-image-mcp-server/dist/tools/imageGenerationTool.js

Eingebunden über `.mcp.json` im Projekt-Root (gitignored, enthält den API-Key).
