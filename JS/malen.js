/* =====================================================
   MALEN.JS
   Zeichenfläche der Malstube: Maus- und Touch-Zeichnen,
   Werkzeugkasten in drei Kategorien-Tabs (immer nur eine
   Kategorie sichtbar, siehe .paint-tool-category-panel[hidden]):
   - Malen: Pinsel, Stift, Füller, Edding, Sprühdose (je eigener
     Strich-Charakter: Breite/Deckkraft/Kappe, siehe
     getBrushRenderParams())
   - Formen: Rechteck, Kreis, Dreieck, Stern, Herz, Linie
     (Umriss/Gefüllt, gleiche Snapshot-Technik für alle)
   - Werkzeuge: Radiergummi, Farbeimer, Farbverlauf, Stempel
   Rückgängig/Leeren sind bewusst NICHT Teil der Kategorien,
   sondern immer sichtbar (.paint-persistent-actions). Die
   Größen-Regler (Klein/Mittel/Groß + Slider) werden je nach
   Kategorie/Werkzeug per JS ins passende Panel verschoben,
   siehe updateSizeControlPlacement(). Dazu Speichern in
   Supabase Storage.

   Speichern funktioniert nur mit Konto (siehe auth.js) -
   die App bleibt ohne Konto komplett nutzbar, das Bild
   geht dann beim Verlassen der Seite nur verloren.
   ===================================================== */

(function setupMalstube() {

    const canvas = document.getElementById("paint-canvas");

    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d");

    const swatches = document.querySelectorAll(".paint-color-swatch");
    const colorPicker = document.getElementById("paint-color-picker");
    const sizeButtons = document.querySelectorAll(".paint-size-button");
    const sizeSlider = document.getElementById("paint-size-slider");
    const sizeValueLabel = document.getElementById("paint-size-value");
    const toolButtons = document.querySelectorAll("#malen-toolbar .tool-button[data-tool]");
    const fillButtons = document.querySelectorAll("#malen-toolbar .tool-button[data-fill-mode]");
    const stampButtons = document.querySelectorAll("#malen-toolbar .tool-button[data-stamp]");
    const stampMotifGroup = document.getElementById("stamp-motif-group");
    const categoryTabs = document.querySelectorAll("#malen-toolbar .paint-category-tab[data-category]");
    const categoryPanels = document.querySelectorAll("#malen-toolbar .paint-tool-category-panel[data-category-panel]");
    const sizeControlEl = document.getElementById("paint-size-control");
    const undoButton = document.getElementById("paint-undo-button");
    const clearButton = document.getElementById("paint-clear-button");
    const saveButton = document.getElementById("paint-save-button");
    const messageEl = document.getElementById("paint-message");

    const MAX_HISTORY_STATES = 20;
    const SHAPE_TOOLS = ["rectangle", "circle", "triangle", "star", "heart", "line"];

    /* Kategorien, deren Werkzeuge IMMER eine Größe brauchen (Malen,
       Formen - alle Pinseltypen und Formen nutzen currentSize als
       Strichbreite). Im "Werkzeuge"-Panel brauchen nur Radiergummi
       und Stempel eine Größe, siehe updateSizeControlPlacement(). */
    const SIZE_ALWAYS_PANELS = ["paint", "shapes"];
    const TOOLS_PANEL_SIZE_TOOLS = ["eraser", "stamp"];

    /* Echte Maskottchen als Stempel-Motive, per Bild statt Emoji -
       einmal vorab laden, damit das erste Stempeln nicht auf das
       Bild warten muss. */
    const STAMP_IMAGE_SOURCES = {
        kuro: "images/Kuro_close.png",
        tessa: "images/tessa_hase.png",
        faro: "images/faro1.png",
        branos: "images/branos.png",
        luis: "images/chameleon_luis_green.png"
    };

    const stampImages = {};

    Object.keys(STAMP_IMAGE_SOURCES).forEach(function (stampId) {

        const image = new Image();
        image.src = STAMP_IMAGE_SOURCES[stampId];

        stampImages[stampId] = image;

    });

    let currentColor = "#e53935";
    let currentSize = 12;
    let currentTool = "brush";
    let fillMode = "stroke";
    let currentStamp = "kuro";
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let history = [];

    let shapeStartPoint = null;
    let shapeSnapshot = null;
    let sprayIntervalId = null;


    /* =====================================================
       1. ZEICHENFLÄCHE VORBEREITEN
       ===================================================== */

    function fillWhiteBackground() {

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

    }

    function pushHistoryState() {

        history.push(canvas.toDataURL());

        if (history.length > MAX_HISTORY_STATES) {
            history.shift();
        }

    }

    function restoreHistoryState(dataUrl) {

        const image = new Image();

        image.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0);
        };

        image.src = dataUrl;

    }

    fillWhiteBackground();
    pushHistoryState();


    /* =====================================================
       2. WERKZEUGE
       ===================================================== */

    function setActiveSwatch(swatch) {

        swatches.forEach(function (item) {
            item.classList.remove("is-active");
        });

        if (swatch) {
            swatch.classList.add("is-active");
        }

    }

    swatches.forEach(function (swatch) {

        swatch.addEventListener("click", function () {

            currentColor = swatch.dataset.color;
            colorPicker.value = currentColor;

            setActiveSwatch(swatch);

            updateCanvasCursor();

        });

    });

    colorPicker.addEventListener("input", function () {

        currentColor = colorPicker.value;

        setActiveSwatch(null);

        updateCanvasCursor();

    });

    function setSize(size, sourceButton) {

        currentSize = size;

        sizeButtons.forEach(function (item) {
            item.classList.toggle("is-active", item === sourceButton);
        });

        if (sizeSlider) {
            sizeSlider.value = String(size);
        }

        if (sizeValueLabel) {
            sizeValueLabel.textContent = size + " px";
        }

        updateCanvasCursor();

    }

    sizeButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            setSize(Number(button.dataset.size), button);

        });

    });

    if (sizeSlider) {

        sizeSlider.addEventListener("input", function () {

            setSize(Number(sizeSlider.value), null);

        });

    }

    /* Die Größen-Regler (Klein/Mittel/Groß + Slider) gibt es nur EIN
       Mal im DOM - je nach aktiver Kategorie/Werkzeug wird derselbe
       Block per appendChild() in das passende Panel verschoben, statt
       ihn viermal zu duplizieren. */
    function updateSizeControlPlacement() {

        if (!sizeControlEl) {
            return;
        }

        const activePanel = document.querySelector("#malen-toolbar .paint-tool-category-panel:not([hidden])");

        if (!activePanel) {
            sizeControlEl.hidden = true;
            return;
        }

        const panelKey = activePanel.dataset.categoryPanel;
        const showSize = SIZE_ALWAYS_PANELS.includes(panelKey) || (panelKey === "tools" && TOOLS_PANEL_SIZE_TOOLS.includes(currentTool));

        if (!showSize) {
            sizeControlEl.hidden = true;
            return;
        }

        if (sizeControlEl.parentElement !== activePanel) {
            activePanel.appendChild(sizeControlEl);
        }

        sizeControlEl.hidden = false;

    }

    toolButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            currentTool = button.dataset.tool;

            toolButtons.forEach(function (item) {
                item.classList.remove("is-active");
            });

            button.classList.add("is-active");

            if (stampMotifGroup) {
                stampMotifGroup.hidden = currentTool !== "stamp";
            }

            updateCanvasCursor();
            updateSizeControlPlacement();

        });

    });

    fillButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            fillMode = button.dataset.fillMode;

            fillButtons.forEach(function (item) {
                item.classList.remove("is-active");
            });

            button.classList.add("is-active");

        });

    });

    stampButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            currentStamp = button.dataset.stamp;

            stampButtons.forEach(function (item) {
                item.classList.remove("is-active");
            });

            button.classList.add("is-active");

        });

    });

    categoryTabs.forEach(function (tab) {

        tab.addEventListener("click", function () {

            categoryTabs.forEach(function (item) {
                item.classList.remove("is-active");
                item.setAttribute("aria-selected", "false");
            });

            categoryPanels.forEach(function (panel) {
                panel.hidden = panel.dataset.categoryPanel !== tab.dataset.category;
            });

            tab.classList.add("is-active");
            tab.setAttribute("aria-selected", "true");

            updateSizeControlPlacement();

        });

    });

    updateSizeControlPlacement();


    /* =====================================================
       2b. CURSOR JE WERKZEUG
       Pinsel und Radiergummi bekommen einen Kreis-Cursor, der
       exakt dem tatsächlichen Mal-/Radierradius entspricht -
       der Mittelpunkt des Kreises (= Hotspot) ist genau die
       Stelle, an der gezeichnet/radiert wird, nicht irgendeine
       Ecke eines Icons. Wächst mit der Stiftgröße mit.
       Rechteck/Kreis behalten den normalen Fadenkreuz-Cursor.
       ===================================================== */

    const CURSOR_TOOLS = ["brush", "pencil", "pen", "marker", "eraser", "spray"];
    const CURSOR_MIN_DIAMETER = 8;
    const CURSOR_PADDING = 4;

    function buildCircleCursor(diameterPx, strokeColor, fillColor) {

        const canvasSize = diameterPx + CURSOR_PADDING * 2;

        const cursorCanvas = document.createElement("canvas");
        cursorCanvas.width = canvasSize;
        cursorCanvas.height = canvasSize;

        const cursorCtx = cursorCanvas.getContext("2d");
        const center = canvasSize / 2;
        const radius = diameterPx / 2;

        cursorCtx.beginPath();
        cursorCtx.arc(center, center, radius, 0, Math.PI * 2);

        if (fillColor) {
            cursorCtx.fillStyle = fillColor;
            cursorCtx.fill();
        }

        cursorCtx.lineWidth = 2;
        cursorCtx.strokeStyle = strokeColor;
        cursorCtx.stroke();

        return { dataUrl: cursorCanvas.toDataURL(), hotspot: Math.round(center) };

    }

    function updateCanvasCursor() {

        if (!CURSOR_TOOLS.includes(currentTool)) {
            canvas.style.cursor = "crosshair";
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const displayScale = rect.width > 0 ? rect.width / canvas.width : 800 / 1200;

        const diameterPx = Math.max(CURSOR_MIN_DIAMETER, Math.round(currentSize * displayScale));
        const isEraser = currentTool === "eraser";

        const strokeColor = isEraser ? "#555555" : currentColor;
        const fillColor = isEraser ? "rgba(255, 255, 255, 0.65)" : null;

        const cursor = buildCircleCursor(diameterPx, strokeColor, fillColor);

        canvas.style.cursor = "url(" + cursor.dataUrl + ") " + cursor.hotspot + " " + cursor.hotspot + ", crosshair";

    }

    window.addEventListener("resize", updateCanvasCursor);

    updateCanvasCursor();


    /* =====================================================
       3. ZEICHNEN (MAUS + TOUCH ÜBER POINTER EVENTS)
       ===================================================== */

    function getCanvasPoint(event) {

        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };

    }

    /* Jeder Pinseltyp bekommt einen eigenen Strich-Charakter statt nur
       eines anderen Namens - Breite, Deckkraft und Kappe unterscheiden
       sich, damit Stift/Füller/Edding sich beim Malen wirklich anders
       anfühlen als der Standard-Pinsel. */
    function getBrushRenderParams(tool, distance) {

        if (tool === "pencil") {
            return { width: Math.max(1, currentSize * 0.45), opacity: 0.85, cap: "round" };
        }

        if (tool === "pen") {

            // Füllfederhalter: schnell gezogen = dünnerer Strich,
            // langsam gezogen = dickerer Strich (wie echte Tinte).
            const speedFactor = Math.min(1, (distance || 0) / 30);
            const width = Math.max(1.5, currentSize * (1.3 - speedFactor * 0.7));

            return { width: width, opacity: 1, cap: "round" };

        }

        if (tool === "marker") {
            return { width: currentSize * 1.4, opacity: 0.55, cap: "square" };
        }

        return { width: currentSize, opacity: 1, cap: "round" };

    }

    function drawDot(point) {

        const isEraser = currentTool === "eraser";
        const params = isEraser
            ? { width: currentSize, opacity: 1 }
            : getBrushRenderParams(currentTool, 0);

        ctx.globalAlpha = params.opacity;

        ctx.beginPath();
        ctx.arc(point.x, point.y, params.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = isEraser ? "#ffffff" : currentColor;
        ctx.fill();

        ctx.globalAlpha = 1;

    }

    function drawLine(from, to) {

        const isEraser = currentTool === "eraser";
        const distance = Math.hypot(to.x - from.x, to.y - from.y);

        const params = isEraser
            ? { width: currentSize, opacity: 1, cap: "round" }
            : getBrushRenderParams(currentTool, distance);

        ctx.globalAlpha = params.opacity;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = isEraser ? "#ffffff" : currentColor;
        ctx.lineWidth = params.width;
        ctx.lineCap = params.cap;
        ctx.lineJoin = "round";
        ctx.stroke();

        ctx.globalAlpha = 1;

    }

    function traceStarPath(x, y, width, height) {

        const cx = x + width / 2;
        const cy = y + height / 2;
        const outerRadius = Math.min(width, height) / 2;
        const innerRadius = outerRadius * 0.45;
        const points = 5;

        for (let i = 0; i < points * 2; i++) {

            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI / points) * i - Math.PI / 2;

            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }

        }

        ctx.closePath();

    }

    function traceHeartPath(x, y, width, height) {

        const midX = x + width / 2;

        ctx.moveTo(midX, y + height * 0.3);

        ctx.bezierCurveTo(midX, y, x, y, x, y + height * 0.3);
        ctx.bezierCurveTo(x, y + height * 0.65, midX, y + height * 0.8, midX, y + height);
        ctx.bezierCurveTo(midX, y + height * 0.8, x + width, y + height * 0.65, x + width, y + height * 0.3);
        ctx.bezierCurveTo(x + width, y, midX, y, midX, y + height * 0.3);

        ctx.closePath();

    }

    function drawShapePreview(point) {

        if (!shapeSnapshot || !shapeStartPoint) {
            return;
        }

        ctx.putImageData(shapeSnapshot, 0, 0);

        const x = Math.min(shapeStartPoint.x, point.x);
        const y = Math.min(shapeStartPoint.y, point.y);
        const width = Math.abs(point.x - shapeStartPoint.x);
        const height = Math.abs(point.y - shapeStartPoint.y);

        ctx.lineWidth = currentSize;
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        if (currentTool === "line") {

            ctx.beginPath();
            ctx.moveTo(shapeStartPoint.x, shapeStartPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();

            return;

        }

        ctx.beginPath();

        if (currentTool === "rectangle") {

            ctx.rect(x, y, width, height);

        } else if (currentTool === "circle") {

            ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);

        } else if (currentTool === "triangle") {

            ctx.moveTo(x + width / 2, y);
            ctx.lineTo(x + width, y + height);
            ctx.lineTo(x, y + height);
            ctx.closePath();

        } else if (currentTool === "star") {

            traceStarPath(x, y, width, height);

        } else if (currentTool === "heart") {

            traceHeartPath(x, y, width, height);

        }

        if (fillMode === "fill") {
            ctx.fill();
        } else {
            ctx.stroke();
        }

    }


    /* =====================================================
       3b. WEITERE WERKZEUGE: SPRÜHDOSE, STEMPEL, FARBEIMER
       ===================================================== */

    function sprayAt(point) {

        const sprayRadius = Math.max(6, currentSize);
        const dotsPerBurst = 12;

        ctx.fillStyle = currentColor;

        for (let i = 0; i < dotsPerBurst; i++) {

            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * sprayRadius;

            const dotX = point.x + Math.cos(angle) * distance;
            const dotY = point.y + Math.sin(angle) * distance;

            ctx.globalAlpha = 0.35 + Math.random() * 0.3;

            ctx.beginPath();
            ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
            ctx.fill();

        }

        ctx.globalAlpha = 1;

    }

    function drawStamp(point) {

        const image = stampImages[currentStamp];

        if (!image || !image.complete || !image.naturalWidth) {
            return;
        }

        const targetHeight = Math.max(40, currentSize * 4);
        const targetWidth = targetHeight * (image.naturalWidth / image.naturalHeight);

        ctx.drawImage(
            image,
            point.x - targetWidth / 2,
            point.y - targetHeight / 2,
            targetWidth,
            targetHeight
        );

    }

    function hexToRgb(hex) {

        const value = hex.replace("#", "");

        return [
            parseInt(value.substring(0, 2), 16),
            parseInt(value.substring(2, 4), 16),
            parseInt(value.substring(4, 6), 16)
        ];

    }

    /* Gemeinsame Flood-Fill-Traversierung für Farbeimer UND Farbverlauf -
       markiert nur, WELCHE zusammenhängenden Pixel zur Zielfläche
       gehören (plus deren Breite als minX/maxX), ohne schon eine Farbe
       zu schreiben. Färben passiert danach separat je nach Werkzeug. */
    function floodFillTraversal(startX, startY) {

        const width = canvas.width;
        const height = canvas.height;

        if (startX < 0 || startY < 0 || startX >= width || startY >= height) {
            return null;
        }

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const startIndex = (startY * width + startX) * 4;

        const targetR = data[startIndex];
        const targetG = data[startIndex + 1];
        const targetB = data[startIndex + 2];
        const targetA = data[startIndex + 3];

        const TOLERANCE_SQUARED = 40 * 40;

        function matchesTarget(index) {

            const dr = data[index] - targetR;
            const dg = data[index + 1] - targetG;
            const db = data[index + 2] - targetB;
            const da = data[index + 3] - targetA;

            return (dr * dr + dg * dg + db * db + da * da) <= TOLERANCE_SQUARED;

        }

        const visited = new Uint8Array(width * height);
        const stack = [startY * width + startX];

        visited[startY * width + startX] = 1;

        let minX = startX;
        let maxX = startX;

        while (stack.length > 0) {

            const pixelPos = stack.pop();
            const x = pixelPos % width;

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;

            if (x > 0) {

                const left = pixelPos - 1;

                if (!visited[left] && matchesTarget(left * 4)) {
                    visited[left] = 1;
                    stack.push(left);
                }

            }

            if (x < width - 1) {

                const right = pixelPos + 1;

                if (!visited[right] && matchesTarget(right * 4)) {
                    visited[right] = 1;
                    stack.push(right);
                }

            }

            const up = pixelPos - width;

            if (up >= 0 && !visited[up] && matchesTarget(up * 4)) {
                visited[up] = 1;
                stack.push(up);
            }

            const down = pixelPos + width;

            if (down < width * height && !visited[down] && matchesTarget(down * 4)) {
                visited[down] = 1;
                stack.push(down);
            }

        }

        return { imageData, data, width, visited, minX, maxX, targetR, targetG, targetB, targetA };

    }

    function floodFill(startX, startY, fillRgb) {

        startX = Math.round(startX);
        startY = Math.round(startY);

        const result = floodFillTraversal(startX, startY);

        if (!result) {
            return;
        }

        const [fillR, fillG, fillB] = fillRgb;

        if (result.targetR === fillR && result.targetG === fillG && result.targetB === fillB && result.targetA === 255) {
            return;
        }

        const { data, visited } = result;

        for (let pixelPos = 0; pixelPos < visited.length; pixelPos++) {

            if (!visited[pixelPos]) {
                continue;
            }

            const index = pixelPos * 4;

            data[index] = fillR;
            data[index + 1] = fillG;
            data[index + 2] = fillB;
            data[index + 3] = 255;

        }

        ctx.putImageData(result.imageData, 0, 0);

    }

    /* Farbverlauf-Werkzeug: füllt die angeklickte Fläche wie der
       Farbeimer, aber mit einem weichen Übergang von der Grundfarbe
       (links) zu einer helleren Tönung derselben Farbe (rechts) statt
       eines flachen Farbtons. */
    function floodFillGradient(startX, startY, baseRgb) {

        startX = Math.round(startX);
        startY = Math.round(startY);

        const result = floodFillTraversal(startX, startY);

        if (!result) {
            return;
        }

        const { data, visited, width, minX, maxX } = result;

        const lightRgb = baseRgb.map(function (channel) {
            return Math.round(channel + (255 - channel) * 0.7);
        });

        const rangeX = Math.max(1, maxX - minX);

        for (let pixelPos = 0; pixelPos < visited.length; pixelPos++) {

            if (!visited[pixelPos]) {
                continue;
            }

            const t = (pixelPos % width - minX) / rangeX;
            const index = pixelPos * 4;

            data[index] = Math.round(baseRgb[0] + (lightRgb[0] - baseRgb[0]) * t);
            data[index + 1] = Math.round(baseRgb[1] + (lightRgb[1] - baseRgb[1]) * t);
            data[index + 2] = Math.round(baseRgb[2] + (lightRgb[2] - baseRgb[2]) * t);
            data[index + 3] = 255;

        }

        ctx.putImageData(result.imageData, 0, 0);

    }

    canvas.addEventListener("pointerdown", function (event) {

        canvas.setPointerCapture(event.pointerId);

        const point = getCanvasPoint(event);

        if (currentTool === "bucket") {

            floodFill(point.x, point.y, hexToRgb(currentColor));
            pushHistoryState();

            return;

        }

        if (currentTool === "gradient") {

            floodFillGradient(point.x, point.y, hexToRgb(currentColor));
            pushHistoryState();

            return;

        }

        if (currentTool === "stamp") {

            drawStamp(point);
            pushHistoryState();

            return;

        }

        isDrawing = true;

        if (SHAPE_TOOLS.includes(currentTool)) {

            shapeStartPoint = point;
            shapeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

            return;

        }

        lastX = point.x;
        lastY = point.y;

        if (currentTool === "spray") {

            sprayAt(point);

            sprayIntervalId = setInterval(function () {
                sprayAt({ x: lastX, y: lastY });
            }, 60);

            return;

        }

        drawDot(point);

    });

    canvas.addEventListener("pointermove", function (event) {

        if (!isDrawing) {
            return;
        }

        const point = getCanvasPoint(event);

        if (SHAPE_TOOLS.includes(currentTool)) {

            drawShapePreview(point);

            return;

        }

        if (currentTool === "spray") {

            sprayAt(point);

            lastX = point.x;
            lastY = point.y;

            return;

        }

        drawLine({ x: lastX, y: lastY }, point);

        lastX = point.x;
        lastY = point.y;

    });

    function stopSprayInterval() {

        if (sprayIntervalId) {
            clearInterval(sprayIntervalId);
            sprayIntervalId = null;
        }

    }

    function endStroke(event) {

        if (!isDrawing) {
            return;
        }

        if (SHAPE_TOOLS.includes(currentTool)) {
            drawShapePreview(getCanvasPoint(event));
        }

        stopSprayInterval();

        isDrawing = false;
        shapeStartPoint = null;
        shapeSnapshot = null;

        pushHistoryState();

    }

    function cancelStroke() {

        if (!isDrawing) {
            return;
        }

        if (SHAPE_TOOLS.includes(currentTool) && shapeSnapshot) {
            ctx.putImageData(shapeSnapshot, 0, 0);
        }

        stopSprayInterval();

        isDrawing = false;
        shapeStartPoint = null;
        shapeSnapshot = null;

    }

    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointerleave", endStroke);
    canvas.addEventListener("pointercancel", cancelStroke);


    /* =====================================================
       4. RÜCKGÄNGIG / LEEREN
       ===================================================== */

    undoButton.addEventListener("click", function () {

        if (history.length <= 1) {
            return;
        }

        history.pop();

        restoreHistoryState(history[history.length - 1]);

    });

    clearButton.addEventListener("click", async function () {

        const confirmed = await showMirelonConfirm(
            "Möchtest du die Zeichenfläche wirklich komplett leeren?"
        );

        if (!confirmed) {
            return;
        }

        fillWhiteBackground();
        pushHistoryState();

    });


    /* =====================================================
       5. SPEICHERN
       ===================================================== */

    function setMessage(text, isError) {

        if (!messageEl) {
            return;
        }

        messageEl.textContent = text;
        messageEl.hidden = !text;
        messageEl.classList.toggle("account-message--error", Boolean(isError));

    }

    saveButton.addEventListener("click", async function () {

        if (!isLoggedIn()) {

            setMessage("Melde dich an, damit dein Bild nicht verloren geht.", true);
            openAccountPanel();

            return;

        }

        setMessage("Bild wird gespeichert …", false);

        canvas.toBlob(async function (blob) {

            if (!blob) {
                setMessage("Bild konnte nicht gespeichert werden.", true);
                return;
            }

            const userId = currentSession.user.id;
            const filePath = userId + "/" + Date.now() + ".png";

            const uploadResult =
                await supabaseClient.storage
                    .from("drawings")
                    .upload(filePath, blob, { contentType: "image/png" });

            if (uploadResult.error) {
                setMessage("Hochladen fehlgeschlagen: " + uploadResult.error.message, true);
                return;
            }

            const insertResult =
                await supabaseClient
                    .from("drawings")
                    .insert({ user_id: userId, storage_path: filePath });

            if (insertResult.error) {
                setMessage("Speichern fehlgeschlagen: " + insertResult.error.message, true);
                return;
            }

            setMessage("Bild gespeichert! Du findest es in deiner Galerie. 🎉", false);

        }, "image/png");

    });

})();
