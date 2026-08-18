/* =====================================================
   MALEN.JS
   Zeichenfläche der Malstube: Maus- und Touch-Zeichnen,
   Werkzeuge (Pinsel, Rechteck, Kreis, Radiergummi,
   Umriss/Gefüllt, Stiftgröße, Rückgängig, Leeren) und
   Speichern in Supabase Storage.

   Speichern funktioniert nur mit Konto (siehe auth.js) -
   die App bleibt ohne Konto komplett nutzbar, das Bild
   geht dann beim Verlassen der Seite nur verloren.

   Bewusst noch NICHT gebaut (spätere Ausbaustufe, siehe
   malen-und-galerie-prompt.md):
   - Gerade-Linie-Werkzeug (gleiche Snapshot-Technik wie
     Rechteck/Kreis, nur ctx.moveTo()/ctx.lineTo())
   - Farbeimer/Flood-Fill (braucht einen eigenen Pixel-
     Algorithmus über getImageData/putImageData)
   - Stempel-Werkzeug mit den Tier-Icons (🦊🐻🦉)
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
    const toolButtons = document.querySelectorAll(".paint-tool-button");
    const fillButtons = document.querySelectorAll(".paint-fill-button");
    const undoButton = document.getElementById("paint-undo-button");
    const clearButton = document.getElementById("paint-clear-button");
    const saveButton = document.getElementById("paint-save-button");
    const messageEl = document.getElementById("paint-message");

    const MAX_HISTORY_STATES = 20;
    const SHAPE_TOOLS = ["rectangle", "circle"];

    let currentColor = "#e53935";
    let currentSize = 12;
    let currentTool = "brush";
    let fillMode = "stroke";
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let history = [];

    let shapeStartPoint = null;
    let shapeSnapshot = null;


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

        });

    });

    colorPicker.addEventListener("input", function () {

        currentColor = colorPicker.value;

        setActiveSwatch(null);

    });

    sizeButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            currentSize = Number(button.dataset.size);

            sizeButtons.forEach(function (item) {
                item.classList.remove("is-active");
            });

            button.classList.add("is-active");

        });

    });

    toolButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            currentTool = button.dataset.tool;

            toolButtons.forEach(function (item) {
                item.classList.remove("is-active");
            });

            button.classList.add("is-active");

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

    function drawDot(point) {

        ctx.beginPath();
        ctx.arc(point.x, point.y, currentSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = currentTool === "eraser" ? "#ffffff" : currentColor;
        ctx.fill();

    }

    function drawLine(from, to) {

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = currentTool === "eraser" ? "#ffffff" : currentColor;
        ctx.lineWidth = currentSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

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

        ctx.beginPath();

        if (currentTool === "rectangle") {

            ctx.rect(x, y, width, height);

        } else if (currentTool === "circle") {

            ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);

        }

        ctx.lineWidth = currentSize;
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;

        if (fillMode === "fill") {
            ctx.fill();
        } else {
            ctx.stroke();
        }

    }

    canvas.addEventListener("pointerdown", function (event) {

        isDrawing = true;
        canvas.setPointerCapture(event.pointerId);

        const point = getCanvasPoint(event);

        if (SHAPE_TOOLS.includes(currentTool)) {

            shapeStartPoint = point;
            shapeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

            return;

        }

        lastX = point.x;
        lastY = point.y;

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

        drawLine({ x: lastX, y: lastY }, point);

        lastX = point.x;
        lastY = point.y;

    });

    function endStroke(event) {

        if (!isDrawing) {
            return;
        }

        if (SHAPE_TOOLS.includes(currentTool)) {
            drawShapePreview(getCanvasPoint(event));
        }

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

    clearButton.addEventListener("click", function () {

        const confirmed = confirm("Möchtest du die Zeichenfläche wirklich komplett leeren?");

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
