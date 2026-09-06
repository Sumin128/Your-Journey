/* =====================================================
   SCHLOSS-3D.JS
   "Mein Schloss" - 3D-Raumansicht (Three.js).

   SCHRITT 3 (aktueller Stand): echtes Inventar/Katalog (JS/schloss-
   data.js) angeschlossen, Speichern/Laden in player.schloss (inkl.
   Migration alter 2D-Spielstände, siehe JS/schloss-migration.js).
   Möbel werden als aufrechte, aus den vorhandenen Gemini-Bildern
   geschnittene "Pappaufsteller" auf dem Boden gerendert (echte
   .glb-Modelle sind der nächste optische Schritt, siehe
   images/schloss/models/ + GLTFLoader-Import unten, aktuell
   ungenutzt). Platzieren aus dem Inventar (JS/schloss.js, Event
   "schloss:place-furniture"), Ziehen, Drehen, Entfernen - alles
   schreibt in player.schloss.rooms.<raum>.placedItems und speichert
   über savePlayer()/player-updated wie jede andere Layout-Änderung.

   Nur schloss.ownedFurniture/unlockedRooms sind serverseitig
   geschützt (siehe supabase_migration_schloss.sql) - diese Datei
   verändert sie nie direkt, sondern liest nur, was das Kind schon
   besitzt (über JS/schloss-data.js SCHLOSS_FURNITURE).

   Feature-Spezifikation: docs/mein-schloss.md
   ===================================================== */

import * as THREE from "three";
// Für echte .glb-Möbelmodelle (images/schloss/models/) - opt-in pro
// Möbel über design.model in JS/schloss-data.js, sonst 2D-Cutout.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.getElementById("schloss-canvas");

if (canvas) {

    let started = false;

    function isUnlocked() {
        return Boolean(player.progression) &&
            Array.isArray(player.progression.unlockedFeatures) &&
            player.progression.unlockedFeatures.indexOf("castle") !== -1;
    }

    function tryStart() {
        if (started || !isUnlocked()) {
            return;
        }
        started = true;
        initSchloss3D(canvas);
    }

    tryStart();

    // Bei Login/Cloud-Pull kann sich der Freischalt-Stand erst nach
    // dem ersten Versuch ändern (Race, siehe die Baumkind-Lehre in
    // JS/tamagotchi.js) - deshalb hier erneut prüfen.
    window.addEventListener("player-updated", tryStart);

}

function initSchloss3D(canvas) {

    const ROOM_WIDTH = 8;
    const ROOM_DEPTH = 6;
    const ROOM_HEIGHT = 4.5;
    const WALL_MARGIN = 0.15; // Sicherheitsabstand zur Wand, damit Möbel nicht "einwächst"

    // Echte Raumhülle (GLTFLoader). Ist der Pfad gesetzt und lädt das
    // Modell, ersetzt es die prozedurale Hülle; sonst baut
    // buildProceduralShell() die einfache Geometrie als technischen
    // Fallback - die Szene sieht nie "kaputt" aus.
    //
    // Aktuell BEWUSST leer: die erste Tripo-Generation
    // (images/schloss/models/waldzimmer-shell.glb, im Repo abgelegt)
    // ist als Raumhülle noch nicht gut genug - kleiner, blasser
    // Diorama-Klotz, dessen Proportionen nicht zur 8x6-Möbelfläche
    // passen. Sobald eine brauchbare Hülle vorliegt: hier den Pfad
    // eintragen, der Rest (Skalierung, 180deg-Drehung, Kamera) ist
    // unten schon vorbereitet. Details: docs/mein-schloss.md.
    const ROOM_SHELL_MODEL = "";

    // Fester Ankerpunkt für Kamin-Nische, Feuer und Kaminlicht - Feuer
    // und Punktlicht leben unabhängig von der Hülle (procedural ODER
    // GLB), damit der Kamin immer brennt (Vorgabe: Feuer NICHT ins GLB).
    const FIRE_ANCHOR = new THREE.Vector3(2.75, 0, -ROOM_DEPTH / 2 + 0.45);

    const isMobile = window.matchMedia("(max-width: 700px)").matches;

    function activeRoom() {
        return player.schloss.rooms[player.schloss.activeRoom || "wohnzimmer"];
    }

    function saveSchloss() {
        savePlayer();
        window.dispatchEvent(new CustomEvent("player-updated"));
    }

    // Muss VOR dem ersten addFurnitureGroup()-Aufruf weiter unten stehen
    // (der läuft schon beim initialen Laden vorhandener placedItems) -
    // sonst ReferenceError (TDZ), da createFurnitureCutout()/
    // loadFurnitureTexture() weiter unten im Code stehen, aber früher
    // aufgerufen werden als sie textureCache erreichen würden.
    const textureLoader = new THREE.TextureLoader();
    const textureCache = {};
    const gltfLoader = new GLTFLoader(); // ebenfalls vor dem ersten addFurnitureGroup() (TDZ, siehe oben)

    // Innenausstattungs-Stil ("Theme"). Aktuell hat nur "wald" eine
    // shell; für alles andere (bewusst noch nicht fertige Themes)
    // fällt es sauber auf die Wald-Hülle zurück, damit die Szene nie
    // "kaputt" aussieht, während das Theme im UI als gesperrt gilt.
    const theme = getSchlossTheme(player.schloss.style);
    const shell = theme.shell || getSchlossTheme("wald").shell;


    /* --- Grundgerüst --- */

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(shell.background);
    scene.fog = new THREE.Fog(shell.fogColor, 20, 42);

    // PerspectiveCamera.fov ist der VERTIKALE Blickwinkel. Bei einem
    // hohen, schmalen Wrapper (Handy im Hochformat) würde damit der
    // horizontale Ausschnitt schrumpfen und die Seitenwände/der Kamin
    // aus dem Bild fallen. resize() rechnet deshalb den vertikalen fov
    // aus einem konstant gehaltenen HORIZONTALEN Zielwinkel zurück.
    const TARGET_HORIZONTAL_FOV = isMobile ? 68 : 56;

    // Offene Frontansicht wie im Konzeptbild: leicht erhöht, nur sanft
    // nach unten geneigt. Tür links, Fenster mittig, Kamin rechts sind
    // gleichzeitig im Bild; die Rückwand ist die Hauptbühne, die
    // Seitenwände nur ein schmaler räumlicher Rahmen.
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    if (isMobile) {
        camera.position.set(0, 3.5, 9.6);
        camera.lookAt(0, 1.7, -3.0);
    } else {
        camera.position.set(0, 3.6, 9.5);
        camera.lookAt(0, 1.7, -3.2);
    }

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Größe kommt vom Wrapper (#schloss-scene-wrap), nicht vom Canvas
    // selbst - siehe CSS-Kommentar bei #schloss-canvas.
    const sceneWrap = canvas.parentElement;

    function resize() {

        const box = sceneWrap.getBoundingClientRect();
        const width = box.width || 1;
        const height = box.height || 1;

        renderer.setSize(width, height, false);
        renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));

        const aspect = width / height;
        camera.aspect = aspect;

        // vFov aus dem Ziel-hFov: vFov = 2·atan( tan(hFov/2) / aspect ).
        // Nach oben gedeckelt, damit auf extremem Hochformat der
        // vertikale Blickwinkel nicht so weit aufreißt, dass über/vor
        // dem Raum leerer Hintergrund sichtbar wird (Boden/Decke sind
        // zusätzlich über die Raumgrenzen hinaus vergrößert).
        const hFovRad = TARGET_HORIZONTAL_FOV * Math.PI / 180;
        const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / Math.max(aspect, 0.55));
        // Vertikalen Blickwinkel deckeln - im Hochformat enger, sonst
        // sieht man über/unter dem Raum zu viel leeren Hintergrund.
        camera.fov = Math.min(isMobile ? 52 : 62, vFovRad * 180 / Math.PI);

        camera.updateProjectionMatrix();

    }

    window.addEventListener("resize", resize);

    // ResizeObserver fängt auch Änderungen, die kein window-resize
    // auslösen (Sidebar auf/zu, Schublade ein-/ausklappen, Tablet-
    // Drehung, spätes Layout nach dem Laden).
    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(resize).observe(sceneWrap);
    }


    /* --- Licht: warmes Fensterlicht + Kaminglühen + sanftes Umgebungslicht --- */

    scene.add(new THREE.AmbientLight(shell.ambient.color, shell.ambient.intensity));

    // Weiches Himmel/Boden-Licht - hebt Decke und Wände gleichmässig an,
    // damit der Raum hell und luftig wirkt statt in eine dunkle Ecke zu
    // kippen.
    scene.add(new THREE.HemisphereLight(0xfff4e2, 0xcbb289, 0.55));

    const windowLight = new THREE.DirectionalLight(shell.windowLight.color, shell.windowLight.intensity);
    windowLight.position.set(-3.2, 4.2, 1.6);
    windowLight.target.position.set(0, 0, 0);
    windowLight.castShadow = !isMobile;
    if (windowLight.castShadow) {
        windowLight.shadow.mapSize.set(1024, 1024);
        windowLight.shadow.camera.left = -5;
        windowLight.shadow.camera.right = 5;
        windowLight.shadow.camera.top = 5;
        windowLight.shadow.camera.bottom = -5;
        windowLight.shadow.bias = -0.001;
    }
    scene.add(windowLight);
    scene.add(windowLight.target);

    const fireLight = new THREE.PointLight(shell.fireLight.color, shell.fireLight.intensity, 7.5, 2);
    fireLight.position.set(FIRE_ANCHOR.x, 0.6, -ROOM_DEPTH / 2 + 0.05);
    scene.add(fireLight);

    // Dezentes Fülllicht von der Kameraseite, ohne Schatten - hebt die
    // Schattenseite von 3D-Möbelmodellen an, damit sie nicht zu dunkel
    // absaufen (Cutouts brauchen das nicht, schadet ihnen aber nicht).
    const fillLight = new THREE.DirectionalLight(0xffe9cf, 0.42);
    fillLight.position.set(1.5, 3, 7);
    scene.add(fillLight);


    /* --- Raumhülle: echte GLB-Architektur, sonst prozeduraler Fallback --- */

    // Sichtbarer, texturierter Boden - etwas größer als der Raum, damit
    // bei weitem Blickwinkel kein leerer Hintergrund unter dem Raum
    // durchscheint. Bleibt die verlässliche Standfläche; wird nur
    // ausgeblendet, wenn die GLB-Hülle ihren eigenen Boden mitbringt.
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(ROOM_WIDTH + 8, ROOM_DEPTH + 10),
        new THREE.MeshStandardMaterial({ map: makeFloorTexture(shell.floorBaseColor), roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 1.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Anker für den Lichtstaub (Fensterbereich) - buildProceduralShell()
    // setzt ihn auf das erste Fenster; bei GLB-Hülle bleibt der Default.
    const dustAnchor = new THREE.Vector3(-2.7, 2.4, -ROOM_DEPTH / 2 + 0.3);

    // Prozedurale Hülle in einer eigenen Gruppe - so lässt sie sich in
    // einem Rutsch ausblenden, sobald die echte GLB-Hülle geladen ist.
    const proceduralShell = new THREE.Group();
    scene.add(proceduralShell);
    buildProceduralShell(proceduralShell, dustAnchor);

    // Echte Raumhülle versuchen (nur wenn ein Pfad gesetzt ist):
    // Erfolg -> prozedurale Hülle + Boden weg. Fehler (Datei fehlt /
    // kaputt) -> prozedurale Hülle bleibt als technischer Fallback
    // stehen, die Szene sieht nie "kaputt" aus.
    if (ROOM_SHELL_MODEL) {
        gltfLoader.load(
            ROOM_SHELL_MODEL,
            function (gltf) {
                const model = gltf.scene;
                model.traverse(function (o) {
                    if (!o.isMesh) { return; }
                    o.receiveShadow = true;
                    o.castShadow = false;
                    // Generator-Meshes sind meist nur nach aussen
                    // sichtbar - von innen (Kameraposition) würde man
                    // sonst durch die Rückwand schauen.
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(function (m) { if (m) { m.side = THREE.DoubleSide; } });
                });
                // Auf Raumbreite bringen, um 180deg drehen (die erste
                // Tripo-Hülle öffnet nach hinten), X/Z auf den Ursprung
                // zentrieren, Unterkante auf y=0.
                model.rotation.y = Math.PI;
                let box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const s = (ROOM_WIDTH * 1.4) / (size.x || ROOM_WIDTH);
                if (isFinite(s) && s > 0) { model.scale.setScalar(s); }
                box = new THREE.Box3().setFromObject(model);
                const c = box.getCenter(new THREE.Vector3());
                model.position.x -= c.x;
                model.position.z -= c.z;
                if (isFinite(box.min.y)) { model.position.y -= box.min.y; }
                scene.add(model);
                proceduralShell.visible = false;
                floor.visible = false;
                // Grössere Hülle -> Kamera etwas weiter zurück.
                camera.position.set(0, 6.5, 14.5);
                camera.lookAt(0, 3, -1.5);
                resize();
                window.__schlossShell = model;
            },
            undefined,
            function (err) {
                console.warn("Schloss-Raumhülle nicht ladbar, prozeduraler Fallback:", ROOM_SHELL_MODEL, err);
            }
        );
    }

    // Kaminfeuer + flackerndes Punktlicht leben AUSSERHALB der Hülle
    // (Vorgabe: Feuer gehört nicht ins GLB) - Anker: FIRE_ANCHOR.
    const fireMesh = buildFireMesh();
    // Sitzt IN der Feuerraum-Nische, knapp hinter der Öffnungsebene.
    fireMesh.position.set(FIRE_ANCHOR.x, 0.1, -ROOM_DEPTH / 2 - 0.16);
    scene.add(fireMesh);

    // Sanft schwebender Lichtstaub im Fensterlicht - passend zum
    // "verwunschenen Waldschloss"-Gefühl, rein dekorativ. Weniger
    // Partikel auf Mobilgeräten.
    const dustMotes = buildDustMotes(isMobile ? 24 : 50);
    dustMotes.position.copy(dustAnchor);
    scene.add(dustMotes);


    /* --- Möbel laden: Daten migrieren, dann pro Eintrag eine 3D-Gruppe --- */

    const room = activeRoom();

    const needsMigration = (room.placedItems || []).some(function (item) {
        return typeof item.z !== "number" || typeof item.rotationY !== "number";
    });

    room.placedItems = migrateSchlossPlacedItems(room.placedItems, ROOM_WIDTH, ROOM_DEPTH);

    if (needsMigration) {
        saveSchloss();
    }

    const placedGroups = [];

    function findInstance(group) {
        return room.placedItems.find(function (item) {
            return item.instanceId === group.userData.instanceId;
        });
    }

    function addFurnitureGroup(instance) {

        const furniture = getSchlossFurniture(instance.furnitureId);

        if (!furniture) {
            return null;
        }

        const design = furniture.designs[instance.design] || furniture.designs[0];

        const group = new THREE.Group();
        group.position.set(instance.x, 0, instance.z);
        group.rotation.y = instance.rotationY || 0;
        group.userData.instanceId = instance.instanceId;
        group.userData.footprint = furniture.footprint || { w: 0.6, d: 0.6 };
        group.userData.furniture = furniture;

        // Echtes 3D-Modell, wenn design.model gesetzt ist - sonst (und
        // als Fallback bei Ladefehler) der gemalte 2D-Cutout.
        if (design.model) {
            loadFurnitureModel(group, furniture, design, function onModelFail() {
                populateWithCutout(group, furniture, design, instance.color);
            });
        } else {
            populateWithCutout(group, furniture, design, instance.color);
        }

        // Leuchtende Möbel (furniture.light, z. B. Waldlampe): echte
        // kleine Punktlichtquelle + warmer Leuchtkern. Zustand aus
        // instance.lightOn (fehlt der Wert -> an).
        if (furniture.light) {
            addLampLight(group, furniture.light);
            setLampState(group, instance.lightOn !== false);
        }

        scene.add(group);
        placedGroups.push(group);

        return group;

    }

    room.placedItems.forEach(addFurnitureGroup);


    /* --- Platzieren aus dem Inventar (JS/schloss.js) --- */

    window.addEventListener("schloss:place-furniture", function (event) {

        const furnitureId = event.detail && event.detail.furnitureId;

        if (!furnitureId || !getSchlossFurniture(furnitureId)) {
            return;
        }

        // Frisch platzierte Möbel gestaffelt statt exakt übereinander
        // (rein kosmetisch - Kind zieht sie danach frei an ihren Platz).
        const index = room.placedItems.length;
        const col = index % 5;
        const row = Math.floor(index / 5) % 3;

        const instance = {
            instanceId: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            furnitureId: furnitureId,
            design: 0,
            color: null,
            customVariantId: null,
            x: -2.6 + col * 1.3,
            z: 1.2 + row * 1.1,
            rotationY: 0,
            scale: 1,
            content: null,
            lightOn: true
        };

        room.placedItems.push(instance);

        const group = addFurnitureGroup(instance);

        saveSchloss();
        selectGroup(group);

    });


    // Auswahlring auf dem Boden - deutlicher, kindgerechter Hinweis
    // statt einer dünnen Outline.
    const selectionRing = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.68, 40),
        new THREE.MeshBasicMaterial({ color: 0xffd77a, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.02;
    selectionRing.visible = false;
    scene.add(selectionRing);


    /* --- Auswahl + Ziehen + Drehen + Entfernen --- */

    const rotateControls = document.getElementById("schloss-rotate-controls");
    const rotateLeftBtn = document.getElementById("schloss-rotate-left");
    const rotateRightBtn = document.getElementById("schloss-rotate-right");
    const removeBtn = document.getElementById("schloss-rotate-remove");
    const colorSwatchesEl = document.getElementById("schloss-color-swatches");
    const lightToggleBtn = document.getElementById("schloss-light-toggle");

    let selected = null;

    function updateLightToggle(group) {

        if (!lightToggleBtn) { return; }

        const isLamp = Boolean(group && group.userData.furniture && group.userData.furniture.light);
        lightToggleBtn.hidden = !isLamp;

        if (isLamp) {
            const inst = findInstance(group);
            const on = !inst || inst.lightOn !== false;
            lightToggleBtn.textContent = on ? "💡" : "🌙";
            lightToggleBtn.setAttribute("aria-pressed", String(on));
        }

    }

    function selectGroup(group) {

        selected = group;

        if (group) {
            selectionRing.visible = true;
            selectionRing.position.x = group.position.x;
            selectionRing.position.z = group.position.z;
            if (rotateControls) { rotateControls.hidden = false; }
            renderColorSwatches(group);
            updateLightToggle(group);
        } else {
            selectionRing.visible = false;
            if (rotateControls) { rotateControls.hidden = true; }
            if (lightToggleBtn) { lightToggleBtn.hidden = true; }
        }

    }

    if (lightToggleBtn) {
        lightToggleBtn.addEventListener("click", function () {

            if (!selected) { return; }

            const instance = findInstance(selected);
            if (!instance) { return; }

            const nextOn = instance.lightOn === false; // war aus -> an
            instance.lightOn = nextOn;
            setLampState(selected, nextOn);
            lightToggleBtn.textContent = nextOn ? "💡" : "🌙";
            lightToggleBtn.setAttribute("aria-pressed", String(nextOn));
            saveSchloss();

        });
    }

    // Farbauswahl (nur bei furniture.colorable, z. B. Teppich) - selbe
    // Idee wie das Kontextmenü im ehemaligen 2D-Editor, jetzt als
    // eigene Zeile über den Dreh-/Entfernen-Buttons.
    function renderColorSwatches(group) {

        if (!colorSwatchesEl) {
            return;
        }

        const furniture = group.userData.furniture;

        colorSwatchesEl.innerHTML = "";

        if (!furniture || !furniture.colorable || !furniture.colors || !furniture.colors.length) {
            colorSwatchesEl.hidden = true;
            return;
        }

        colorSwatchesEl.hidden = false;

        furniture.colors.forEach(function (color) {

            const swatch = document.createElement("button");
            swatch.type = "button";
            swatch.className = "schloss-color-swatch";
            swatch.style.background = color;
            swatch.setAttribute("aria-label", "Farbe wählen");

            swatch.addEventListener("click", function () {

                const instance = findInstance(group);

                if (instance) {
                    instance.color = color;
                    saveSchloss();
                }

                applyColorToGroup(group, color);

            });

            colorSwatchesEl.appendChild(swatch);

        });

    }

    function rotateSelected(delta) {

        if (!selected) {
            return;
        }

        selected.rotation.y += delta;

        const instance = findInstance(selected);

        if (instance) {
            instance.rotationY = selected.rotation.y;
            saveSchloss();
        }

    }

    if (rotateLeftBtn) {
        rotateLeftBtn.addEventListener("click", function () { rotateSelected(Math.PI / 8); });
    }

    if (rotateRightBtn) {
        rotateRightBtn.addEventListener("click", function () { rotateSelected(-Math.PI / 8); });
    }

    if (removeBtn) {
        removeBtn.addEventListener("click", function () {

            if (!selected) {
                return;
            }

            scene.remove(selected);

            const index = placedGroups.indexOf(selected);
            if (index !== -1) {
                placedGroups.splice(index, 1);
            }

            room.placedItems = room.placedItems.filter(function (item) {
                return item.instanceId !== selected.userData.instanceId;
            });

            saveSchloss();
            selectGroup(null);

        });
    }

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let dragging = false;
    let dragPointerId = null;
    let dragMoved = false;

    function updatePointerNDC(event) {
        const bounds = canvas.getBoundingClientRect();
        pointerNDC.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointerNDC.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    }

    function findGroupFromIntersection(object) {
        let node = object;
        while (node) {
            if (placedGroups.indexOf(node) !== -1) { return node; }
            node = node.parent;
        }
        return null;
    }

    // Boden-Dekoration (z. B. Teppich): liegt flach auf, kollidiert
    // nicht mit normalen Möbeln.
    function isFloorDecor(group) {
        return Boolean(group && group.userData.furniture &&
            group.userData.furniture.placementType === "floorDecor");
    }

    canvas.addEventListener("pointerdown", function (event) {

        updatePointerNDC(event);
        raycaster.setFromCamera(pointerNDC, camera);

        const hits = raycaster.intersectObjects(placedGroups, true);

        if (hits.length) {

            const group = findGroupFromIntersection(hits[0].object);
            selectGroup(group);

            if (group) {
                dragging = true;
                dragMoved = false;
                dragPointerId = event.pointerId;
                // Kann auf manchen Geräten/synthetischen Events ohne
                // "echten" aktiven Pointer werfen - Ziehen funktioniert
                // auch ohne Capture, nur weniger robust bei schnellen
                // Bewegungen über den Canvas-Rand hinaus.
                try {
                    canvas.setPointerCapture(event.pointerId);
                } catch (e) {
                    /* ignorieren */
                }
            }

        } else {

            selectGroup(null);

        }

    });

    canvas.addEventListener("pointermove", function (event) {

        if (!dragging || !selected || event.pointerId !== dragPointerId) {
            return;
        }

        updatePointerNDC(event);
        raycaster.setFromCamera(pointerNDC, camera);

        const point = new THREE.Vector3();
        const hit = raycaster.ray.intersectPlane(floorPlane, point);

        if (!hit) {
            return;
        }

        dragMoved = true;

        const footprint = selected.userData.footprint || { w: 0.6, d: 0.6 };
        const halfW = ROOM_WIDTH / 2 - footprint.w / 2 - WALL_MARGIN;
        const halfD = ROOM_DEPTH / 2 - footprint.d / 2 - WALL_MARGIN;

        let x = Math.max(-halfW, Math.min(halfW, point.x));
        let z = Math.max(-halfD, Math.min(halfD, point.z));

        // Boden-Dekoration (Teppich) nimmt NICHT an der Möbel-Kollision
        // teil - weder als geschobenes noch als schiebendes Objekt.
        // Tisch/Stuhl dürfen darauf stehen. Raumgrenzen gelten weiter.
        if (!isFloorDecor(selected)) {

            // Einfache, verzeihende Überlappungsprüfung: kein hartes
            // Blockieren, sondern ein sanftes Auseinanderschieben, falls
            // sich zwei Möbel-"Kreise" zu stark überschneiden.
            placedGroups.forEach(function (other) {

                if (other === selected || isFloorDecor(other)) {
                    return;
                }

                const otherFootprint = other.userData.footprint || { w: 0.6, d: 0.6 };
                const dx = x - other.position.x;
                const dz = z - other.position.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                const minDistance = (footprint.w + footprint.d) / 4 + (otherFootprint.w + otherFootprint.d) / 4;

                if (distance > 0.0001 && distance < minDistance) {
                    const push = minDistance - distance;
                    x += (dx / distance) * push;
                    z += (dz / distance) * push;
                }

            });

            x = Math.max(-halfW, Math.min(halfW, x));
            z = Math.max(-halfD, Math.min(halfD, z));

        }

        selected.position.set(x, 0, z);
        selectionRing.position.x = x;
        selectionRing.position.z = z;

    });

    function endDrag(event) {

        if (event.pointerId !== dragPointerId) {
            return;
        }

        dragging = false;
        dragPointerId = null;

        // Nur EINMAL beim Loslassen speichern, nicht bei jedem
        // pointermove-Tick (sonst würde ein einziges Ziehen dutzende
        // savePlayer()/sync_player_data()-Aufrufe auslösen).
        if (dragMoved && selected) {
            const instance = findInstance(selected);
            if (instance) {
                instance.x = selected.position.x;
                instance.z = selected.position.z;
                saveSchloss();
            }
        }

        dragMoved = false;

    }

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);


    /* --- Render-Loop --- */

    function animate(time) {

        requestAnimationFrame(animate);

        // Lichtstaub sanft schweben lassen (siehe buildDustMotes()) -
        // kleine Sinus-Bewegung um die Ausgangsposition, kein echtes
        // Partikelsystem nötig für ein paar Dutzend Punkte.
        const dustPositions = dustMotes.geometry.attributes.position.array;
        const dustBase = dustMotes.userData.basePositions;
        const dustPhases = dustMotes.userData.phases;
        const t = (time || 0) * 0.001;

        for (let i = 0; i < dustPhases.length; i++) {
            dustPositions[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(t * 0.4 + dustPhases[i]) * 0.15;
            dustPositions[i * 3] = dustBase[i * 3] + Math.cos(t * 0.25 + dustPhases[i]) * 0.08;
        }

        dustMotes.geometry.attributes.position.needsUpdate = true;

        // Kaminfeuer: leicht flackerndes Punktlicht + ruhig wehende
        // Flammen-Ebenen + pulsende Glut. Rein zeitgesteuert (überlagerte
        // Sinus), kein Partikelsystem - das Feuer gehört nicht ins GLB.
        const flick = 0.84 + Math.sin(t * 8.5) * 0.08 + Math.sin(t * 16.7) * 0.045;
        fireLight.intensity = shell.fireLight.intensity * flick;

        const flames = fireMesh.userData.flames || [];
        for (let i = 0; i < flames.length; i++) {
            const fl = flames[i];
            const ph = fl.userData.phase;
            const wob = Math.sin(t * 3.2 + ph) * 0.6 + Math.sin(t * 6.8 + ph) * 0.3;
            fl.position.x = fl.userData.baseX + wob * 0.05;
            fl.rotation.z = wob * 0.13;
            fl.scale.y = fl.userData.s0 * (0.86 + Math.sin(t * 5.5 + ph) * 0.16 + (flick - 0.84));
            fl.scale.x = fl.userData.s0 * (0.98 + Math.sin(t * 4.1 + ph) * 0.06);
            fl.material.opacity = 0.7 + Math.sin(t * 8.3 + ph) * 0.22;
        }
        if (fireMesh.userData.embers) {
            fireMesh.userData.embers.material.opacity = 0.55 + Math.sin(t * 2.1) * 0.16 + Math.sin(t * 5.3) * 0.06;
        }

        renderer.render(scene, camera);

    }

    resize();
    animate();

    // Debug-Griff fürs Kamera-/Hüllen-Feintuning (harmlos, nur lesend
    // gedacht) - erlaubt es, in der Konsole Kamera und Szene zu prüfen.
    window.__schloss3d = { scene: scene, camera: camera, renderer: renderer, THREE: THREE };


    /* =====================================================
       Hilfsfunktionen
       ===================================================== */

    // Lädt das vorhandene 2D-Gemini-Bild eines Möbelstücks als
    // aufrechtes, aus dem Bild geschnittenes "Pappaufsteller"-Plane -
    // die im Architekturplan genannte Übergangslösung, bis echte
    // .glb-Modelle (images/schloss/models/) existieren. Anders als ein
    // THREE.Sprite (das immer zur Kamera zeigt) bleibt ein normales
    // Plane innerhalb seiner Gruppe drehbar, damit "Drehen" sichtbar
    // etwas bewirkt.
    function loadFurnitureTexture(src, onLoaded) {

        if (textureCache[src]) {
            onLoaded(textureCache[src]);
            return;
        }

        textureLoader.load(src, function (texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
            textureCache[src] = texture;
            onLoaded(texture);
        });

    }

    // Echtes .glb-Modell in eine bestehende Möbelgruppe laden. Maßstab
    // wird an den footprint angepasst (Generatoren liefern beliebige
    // Größen), X/Z zentriert, Unterkante auf den Boden. Bei Ladefehler
    // ruft onFail() den 2D-Cutout als Rückfall auf. gltfLoader ist oben
    // deklariert (TDZ).
    function loadFurnitureModel(group, furniture, design, onFail) {

        gltfLoader.load(
            design.model,
            function (gltf) {

                const model = gltf.scene;

                model.traverse(function (obj) {
                    if (obj.isMesh) {
                        obj.castShadow = !isMobile;
                        obj.receiveShadow = true;
                    }
                });

                const footprint = furniture.footprint || { w: 0.6, d: 0.6 };

                // Maßstab an den footprint anpassen. Tripo/andere
                // Generatoren liefern das Modell in irgendeiner Größe -
                // hier auf die im Katalog hinterlegte Breite bringen
                // (die breitere der beiden Grundflächen-Achsen zählt).
                let box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const modelWidth = Math.max(size.x, size.z) || 1;
                const targetWidth = Math.max(footprint.w, footprint.d);
                const scale = targetWidth / modelWidth;

                if (isFinite(scale) && scale > 0) {
                    model.scale.setScalar(scale);
                }

                // Nach dem Skalieren: X/Z zentrieren und Unterkante auf
                // den Boden (unabhängig davon, wo der Pivot lag).
                box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.x -= center.x;
                model.position.z -= center.z;
                if (isFinite(box.min.y)) {
                    model.position.y -= box.min.y;
                }

                group.add(model);
                group.userData.model = model;

            },
            undefined,
            function (error) {
                console.warn("Schloss-Möbelmodell nicht ladbar:", design.model, error);
                if (typeof onFail === "function") {
                    onFail();
                }
            }
        );

    }

    function populateWithCutout(group, furniture, design, initialColor) {

        const footprint = furniture.footprint || { w: 0.6, d: 0.6 };
        const flat = Boolean(furniture.flatOnFloor);

        const material = new THREE.MeshStandardMaterial({
            transparent: true,
            alphaTest: 0.4,
            side: THREE.DoubleSide,
            roughness: 0.9
        });

        group.userData.material = material;
        group.userData.spriteSrc = design.sprite;

        // Platzhalter-Fläche, bis die Textur geladen ist (vermeidet ein
        // kurzes "Nichts" beim ersten Rendern).
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(footprint.w, footprint.w), material);

        if (flat) {
            // Liegt flach auf dem Boden (z. B. Teppich, Kissen) statt
            // aufrecht zu stehen wie normale Möbel-Cutouts - sonst würde
            // ein Teppich wie ein aufgestelltes Bild aussehen.
            plane.rotation.x = -Math.PI / 2;
            plane.position.y = 0.015; // knapp über dem Boden, kein Z-Fighting
            plane.receiveShadow = true;
            // Zuerst zeichnen (renderOrder < 0) + kein Tiefe-Schreiben,
            // damit normale, aufrecht stehende Möbel immer sichtbar
            // darüber liegen und keine Z-Fighting-Kante entsteht.
            plane.renderOrder = -1;
            material.depthWrite = false;
        } else {
            plane.position.y = footprint.w / 2;
            plane.castShadow = true;
        }

        group.add(plane);

        loadFurnitureTexture(design.sprite, function (texture) {

            const image = texture.image;
            const aspect = (image && image.width && image.height) ? image.width / image.height : 1;
            const secondDimension = footprint.w / aspect;

            plane.geometry.dispose();
            plane.geometry = new THREE.PlaneGeometry(footprint.w, secondDimension);

            if (!flat) {
                plane.position.y = secondDimension / 2;
            }

            material.map = texture;
            material.needsUpdate = true;

            if (initialColor) {
                applyColorToGroup(group, initialColor);
            }

        });

    }

    // Farb-Technikprobe (Architekturplan Abschnitt A), jetzt an der
    // 3D-Szene statt am 2D-Sprite: konturerhaltendes Einfärben per
    // Canvas (multiply + destination-in) statt eines CSS-Filters (der
    // würde Beschläge/Schatten mitfärben). Ergebnis pro Sprite+Farbe
    // im Speicher zwischengespeichert - gespeichert wird weiterhin nur
    // instance.color, die Textur wird beim Laden einfach neu erzeugt.
    const tintedTextureCache = {};

    function getTintedTexture(spriteSrc, baseTexture, color, callback) {

        const cacheKey = spriteSrc + "|" + color;

        if (tintedTextureCache[cacheKey]) {
            callback(tintedTextureCache[cacheKey]);
            return;
        }

        const image = baseTexture.image;

        if (!image || !image.width) {
            return;
        }

        const canvasEl = document.createElement("canvas");
        canvasEl.width = image.width;
        canvasEl.height = image.height;

        const ctx = canvasEl.getContext("2d");

        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(image, 0, 0);

        const tinted = new THREE.CanvasTexture(canvasEl);
        tinted.colorSpace = THREE.SRGBColorSpace;

        tintedTextureCache[cacheKey] = tinted;
        callback(tinted);

    }

    function applyColorToGroup(group, color) {

        const spriteSrc = group.userData.spriteSrc;
        const baseTexture = textureCache[spriteSrc];
        const material = group.userData.material;

        if (!baseTexture || !material) {
            return;
        }

        if (!color) {
            material.map = baseTexture;
            material.needsUpdate = true;
            return;
        }

        getTintedTexture(spriteSrc, baseTexture, color, function (tinted) {
            material.map = tinted;
            material.needsUpdate = true;
        });

    }

    function makeFloorTexture(baseColor) {

        const size = 512;
        const el = document.createElement("canvas");
        el.width = el.height = size;
        const ctx = el.getContext("2d");

        ctx.fillStyle = baseColor || "#a9793f";
        ctx.fillRect(0, 0, size, size);

        const plankHeight = size / 8;
        for (let row = 0; row < 8; row++) {
            const shade = row % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
            ctx.fillStyle = shade;
            ctx.fillRect(0, row * plankHeight, size, plankHeight);
            ctx.strokeStyle = "rgba(60,35,15,0.35)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, row * plankHeight);
            ctx.lineTo(size, row * plankHeight);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(el);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        // Bodenfläche ist ROOM+Überstand groß (14×14) - Wiederholung
        // entsprechend, damit die Dielenbreite gleich bleibt.
        texture.repeat.set(5, 5);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;

    }

    // Warme Natursteinwand (gemalt, nicht fotorealistisch): heller
    // Grundton, unregelmässige Quader mit dezenter Farbvariation, ein
    // paar deutlich dunklere Steine, angedeutete Mörtelfugen.
    function makeStoneTexture(baseColor) {

        const size = 512;
        const el = document.createElement("canvas");
        el.width = el.height = size;
        const ctx = el.getContext("2d");

        ctx.fillStyle = baseColor || "#c3a982";
        ctx.fillRect(0, 0, size, size);

        const rng = mulberry32(7);
        const rows = 7;
        const rowH = size / rows;

        for (let r = 0; r < rows; r++) {
            const y = r * rowH;
            const offset = (r % 2) * (rowH * 0.9);
            let x = -offset;
            while (x < size) {
                const w = rowH * (0.8 + rng() * 1.1);
                const pad = 3;
                const dark = rng() < 0.13;
                const warm = 210 + Math.floor(rng() * 30);
                let cr, cg, cb;
                if (dark) { cr = warm - 95; cg = warm - 110; cb = warm - 120; }
                else { cr = warm; cg = warm - 22; cb = warm - 52; }
                const a = dark ? 0.6 : 0.22 + rng() * 0.22;
                ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + "," + a.toFixed(2) + ")";
                ctx.fillRect(x + pad, y + pad, w - pad * 2, rowH - pad * 2);
                ctx.strokeStyle = "rgba(120,92,60,0.35)";
                ctx.lineWidth = 2;
                ctx.strokeRect(x + pad, y + pad, w - pad * 2, rowH - pad * 2);
                x += w;
            }
        }

        // sanfte, ungleichmässige Aufhellung (Licht von oben)
        const grad = ctx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, "rgba(255,246,225,0.18)");
        grad.addColorStop(1, "rgba(60,42,26,0.12)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(el);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2.6, 2.2);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;

    }

    // Märchenhaft gemalte Waldsicht durchs Fenster (kein externes Asset):
    // sanfter Himmel-/Nebelverlauf, mehrere Tiefenebenen aus hellen und
    // dunklen, unregelmässig gewölbten Baumkronen mit etwas Dunst
    // dazwischen (atmosphärische Perspektive). seed variiert die Ansicht
    // pro Fenster, damit sich nichts wie ein Muster wiederholt.
    function makeForestWindowTexture(skyColors, seed) {

        const colors = (skyColors && skyColors.length === 3) ? skyColors : ["#fdeaba", "#ffd08a", "#e9a566"];

        const w = 360, h = 420;
        const el = document.createElement("canvas");
        el.width = w;
        el.height = h;
        const ctx = el.getContext("2d");
        const rng = mulberry32(17 + (seed || 0) * 101);

        // --- Himmel: warm oben, dunstig-hell zur Baumlinie ---
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, colors[0]);
        sky.addColorStop(0.3, colors[1]);
        sky.addColorStop(0.55, "#f3eccf");
        sky.addColorStop(1, "#dfe6c2");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // warmer Dunst am Horizont
        const horizon = ctx.createRadialGradient(w * 0.55, h * 0.56, 10, w * 0.55, h * 0.56, w * 0.7);
        horizon.addColorStop(0, "rgba(255,244,210,0.7)");
        horizon.addColorStop(1, "rgba(255,244,210,0)");
        ctx.fillStyle = horizon;
        ctx.fillRect(0, 0, w, h);

        // Eine Nadelbaum-Treelinie: rundlich-spitze Wipfel, hintere Reihen
        // heller/dunstiger (atmosphärische Tiefe).
        function treeLine(baseY, treeH, colour, count, jitter) {
            ctx.fillStyle = colour;
            for (let i = -1; i <= count; i++) {
                const cx = (w + 60) * (i / count) - 30 + (rng() - 0.5) * jitter;
                const th = treeH * (0.6 + rng() * 0.8);
                const tw = th * (0.32 + rng() * 0.12);
                ctx.beginPath();
                ctx.moveTo(cx - tw, baseY);
                ctx.quadraticCurveTo(cx - tw * 0.5, baseY - th * 0.55, cx, baseY - th);
                ctx.quadraticCurveTo(cx + tw * 0.5, baseY - th * 0.55, cx + tw, baseY);
                ctx.closePath();
                ctx.fill();
            }
            // Boden-Verbindung
            ctx.fillRect(0, baseY - 2, w, h - baseY + 4);
        }

        // sanfte Hügel im Dunst
        ctx.fillStyle = "rgba(176, 196, 150, 0.75)";
        ctx.beginPath();
        ctx.moveTo(0, h * 0.62);
        ctx.quadraticCurveTo(w * 0.35, h * 0.5, w * 0.7, h * 0.6);
        ctx.quadraticCurveTo(w * 0.9, h * 0.66, w, h * 0.58);
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fill();

        treeLine(h * 0.60, 70, "rgba(150, 178, 138, 0.8)", 9, 26);
        ctx.fillStyle = "rgba(240, 244, 222, 0.35)";
        ctx.fillRect(0, h * 0.5, w, h * 0.5);
        treeLine(h * 0.74, 110, "rgba(96, 132, 92, 0.95)", 7, 40);
        treeLine(h * 0.9, 150, "rgba(58, 92, 62, 1)", 5, 54);

        // warme Lichtflecken zwischen den Wipfeln
        for (let i = 0; i < 8; i++) {
            const gx = rng() * w;
            const gy = h * (0.5 + rng() * 0.32);
            const gr = 3 + rng() * 6;
            const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 3);
            glow.addColorStop(0, "rgba(255,247,210,0.75)");
            glow.addColorStop(1, "rgba(255,247,210,0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(gx, gy, gr * 3, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(el);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;

    }

    function buildDustMotes(count) {

        const basePositions = new Float32Array(count * 3);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            basePositions[i * 3] = (Math.random() - 0.5) * 2.2;
            basePositions[i * 3 + 1] = Math.random() * 2.2 - 0.3;
            basePositions[i * 3 + 2] = Math.random() * 2.5;
            phases[i] = Math.random() * Math.PI * 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(basePositions.slice(), 3));

        const material = new THREE.PointsMaterial({
            color: 0xffe3ad,
            size: 0.035,
            map: makeDustTexture(),
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.userData.basePositions = basePositions;
        points.userData.phases = phases;

        return points;

    }

    function makeDustTexture() {

        const size = 32;
        const el = document.createElement("canvas");
        el.width = el.height = size;
        const ctx = el.getContext("2d");

        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, "rgba(255,240,200,1)");
        gradient.addColorStop(1, "rgba(255,240,200,0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        return new THREE.CanvasTexture(el);

    }

    // Prozeduraler Wald-Schlossraum. Komposition nach dem Konzeptbild:
    // offene Vorderseite, Rueckwand als Hauptbuehne mit DREI echten
    // Oeffnungen - links hohe Holztuer mit schlankem Steinbogen, mittig
    // grosses dreiteiliges Fenster tief nach hinten eingelassen, rechts
    // ein nach hinten eingelassener Kamin. Helle Decke, drei schlanke
    // Balken. Nichts ragt in die 8x6-Moebelzone.
    function buildProceduralShell(group, dustAnchor) {

        const wallMat = new THREE.MeshStandardMaterial({ map: makeStoneTexture(shell.wallBaseColor), roughness: 1 });
        wallMat.map.repeat.set(2.4, 1.7);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xd7c4a0, roughness: 0.9 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f4a29, roughness: 0.85 });
        const beamMat = new THREE.MeshStandardMaterial({ color: 0x5e3e25, roughness: 0.9 });
        const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x40311f, roughness: 1 });

        const WALL_Z = -ROOM_DEPTH / 2;
        const HW = ROOM_WIDTH / 2;
        const CEILING_Y = 4.4;

        // --- Oeffnungen in der Rueckwand ---
        const WIN = { x1: -2.85, x2: 0.55, y1: 0.95, yTop: 3.5 };
        const winW = WIN.x2 - WIN.x1;
        const COLW = 0.16;
        const BAYW = (winW - 2 * COLW) / 3;
        const BAY_SPRING = WIN.yTop - BAYW / 2;
        const FP = { x1: 2.05, w: 1.4, y1: 0.05, yTop: 1.65 };
        const FP_R = FP.w / 2;
        const FP_SPRING = FP.yTop - FP_R;
        const fpCx = FP.x1 + FP_R;

        // === Rueckwand: EINE Steinflaeche mit ausgeschnittenen Boegen ===
        const bwShape = new THREE.Shape();
        bwShape.moveTo(-HW, 0);
        bwShape.lineTo(HW, 0);
        bwShape.lineTo(HW, ROOM_HEIGHT);
        bwShape.lineTo(-HW, ROOM_HEIGHT);
        bwShape.lineTo(-HW, 0);

        for (let b = 0; b < 3; b++) {
            const bx = WIN.x1 + b * (BAYW + COLW);
            const cx = bx + BAYW / 2;
            const h = new THREE.Path();
            h.moveTo(bx, WIN.y1);
            h.lineTo(bx, BAY_SPRING);
            h.absarc(cx, BAY_SPRING, BAYW / 2, Math.PI, 0, true);
            h.lineTo(bx + BAYW, WIN.y1);
            h.lineTo(bx, WIN.y1);
            bwShape.holes.push(h);
        }
        const fh = new THREE.Path();
        fh.moveTo(FP.x1, FP.y1);
        fh.lineTo(FP.x1, FP_SPRING);
        fh.absarc(fpCx, FP_SPRING, FP_R, Math.PI, 0, true);
        fh.lineTo(FP.x1 + FP.w, FP.y1);
        fh.lineTo(FP.x1, FP.y1);
        bwShape.holes.push(fh);

        const bwGeo = new THREE.ShapeGeometry(bwShape, 14);
        bwGeo.computeBoundingBox();
        const bb = bwGeo.boundingBox;
        const uv = bwGeo.attributes.uv, ps = bwGeo.attributes.position;
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i,
                (ps.getX(i) - bb.min.x) / (bb.max.x - bb.min.x),
                (ps.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
        }
        const backWall = new THREE.Mesh(bwGeo, wallMat);
        backWall.position.z = WALL_Z;
        backWall.receiveShadow = true;
        group.add(backWall);

        // === Seitenwaende (schmaler raeumlicher Rahmen) ===
        [-1, 1].forEach(function (s) {
            const w = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat);
            w.rotation.y = -s * Math.PI / 2;
            w.position.set(s * HW, ROOM_HEIGHT / 2, 0);
            w.receiveShadow = true;
            group.add(w);
        });

        // === Decke: heller Putz (unbeleuchtet, damit sie nie dunkel
        // absäuft) + drei schlanke dunkle Balken als Akzent ===
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(ROOM_WIDTH + 8, ROOM_DEPTH + 10),
            new THREE.MeshBasicMaterial({ color: 0xf0e7d2 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, CEILING_Y, 1.5);
        group.add(ceiling);

        // Balken nur über der hinteren Raumhälfte - so liegen ihre
        // vorderen Enden weit von der Kamera weg und wirken nicht wie
        // vorspringende Klötze.
        [-2.7, -0.2, 2.3].forEach(function (x) {
            const bl = ROOM_DEPTH * 0.62;
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.17, bl), beamMat);
            beam.position.set(x, CEILING_Y - 0.11, WALL_Z + bl / 2 - 0.05);
            group.add(beam);
        });

        // === schmale Holz-Sockelleiste (drei Waende, wandbuendig) ===
        [
            { g: [ROOM_WIDTH, 0.12, 0.05], p: [0, 0.06, WALL_Z + 0.03] },
            { g: [0.05, 0.12, ROOM_DEPTH], p: [-HW + 0.03, 0.06, 0] },
            { g: [0.05, 0.12, ROOM_DEPTH], p: [HW - 0.03, 0.06, 0] }
        ].forEach(function (c) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(c.g[0], c.g[1], c.g[2]), woodMat);
            m.position.set(c.p[0], c.p[1], c.p[2]);
            group.add(m);
        });

        // === GROSSES DREITEILIGES FENSTER ===
        const winCx = (WIN.x1 + WIN.x2) / 2;
        const winMidY = (WIN.y1 + WIN.yTop) / 2;

        // Waldsicht: mehrere weiche, gemalte Tiefenebenen HINTER der
        // Wand - hintere volle Ebene (Himmel + Nebel + Wald), davor zwei
        // grösstenteils transparente Baumkronen-Ebenen für Räumlichkeit.
        const viewFar = new THREE.Mesh(
            new THREE.PlaneGeometry(winW + 3.4, WIN.yTop + 3.2),
            new THREE.MeshBasicMaterial({ map: makeForestWindowTexture(shell.windowSky, 1) })
        );
        viewFar.position.set(winCx, winMidY + 0.4, WALL_Z - 1.9);
        group.add(viewFar);

        const viewMid = new THREE.Mesh(
            new THREE.PlaneGeometry(winW + 2.0, WIN.yTop + 1.4),
            new THREE.MeshBasicMaterial({ map: makeForestCanopy(7, 0.55), transparent: true, depthWrite: false })
        );
        viewMid.position.set(winCx, winMidY - 0.1, WALL_Z - 1.05);
        group.add(viewMid);

        const viewNear = new THREE.Mesh(
            new THREE.PlaneGeometry(winW + 1.2, WIN.yTop + 0.6),
            new THREE.MeshBasicMaterial({ map: makeForestCanopy(3, 0.9), transparent: true, depthWrite: false })
        );
        viewNear.position.set(winCx, winMidY - 0.35, WALL_Z - 0.5);
        group.add(viewNear);

        // aeussere Laibung: dunkle Flaechen, laufen NACH HINTEN (nicht in den Raum)
        const outerMat = new THREE.MeshStandardMaterial({ color: 0x594732, roughness: 1 });
        const oRev = 0.7;
        [
            { g: [winW + 0.06, 0.05, oRev], p: [winCx, WIN.y1, WALL_Z - oRev / 2] },
            { g: [0.05, WIN.yTop - WIN.y1 + 0.5, oRev], p: [WIN.x1, winMidY + 0.2, WALL_Z - oRev / 2] },
            { g: [0.05, WIN.yTop - WIN.y1 + 0.5, oRev], p: [WIN.x2, winMidY + 0.2, WALL_Z - oRev / 2] }
        ].forEach(function (c) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(c.g[0], c.g[1], c.g[2]), outerMat);
            m.position.set(c.p[0], c.p[1], c.p[2]);
            group.add(m);
        });

        // zwei schlanke Trennsaeulen (in der Wandebene, ragen ~0.05)
        for (let k = 1; k <= 2; k++) {
            const colX = WIN.x1 + k * BAYW + (k - 0.5) * COLW;
            const col = new THREE.Mesh(new THREE.BoxGeometry(COLW, WIN.yTop - WIN.y1 + 0.15, 0.13), frameMat);
            col.position.set(colX, (WIN.y1 + WIN.yTop) / 2, WALL_Z + 0.05);
            group.add(col);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(COLW + 0.12, 0.09, 0.17), frameMat);
            cap.position.set(colX, BAY_SPRING, WALL_Z + 0.06);
            group.add(cap);
        }

        // schlanker Wulst an jedem Bogen + duenne Laibungspfosten
        for (let b = 0; b < 3; b++) {
            const cx = WIN.x1 + b * (BAYW + COLW) + BAYW / 2;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(BAYW / 2, 0.045, 6, 22, Math.PI), frameMat);
            ring.position.set(cx, BAY_SPRING, WALL_Z + 0.05);
            group.add(ring);
            [-1, 1].forEach(function (s) {
                const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.055, BAY_SPRING - WIN.y1, 0.1), frameMat);
                jamb.position.set(cx + s * BAYW / 2, (WIN.y1 + BAY_SPRING) / 2, WALL_Z + 0.05);
                group.add(jamb);
            });
        }

        // schmale Fensterbank (ragt nur ~0.05 vor)
        const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, 0.08, 0.12), frameMat);
        sill.position.set(winCx, WIN.y1 - 0.03, WALL_Z + 0.02);
        group.add(sill);

        dustAnchor.set(winCx, winMidY, WALL_Z + 0.6);

        // === HOHE HOLZTUER MIT SCHLANKEM STEINBOGEN (linke Wand) ===
        const doorGroup = new THREE.Group();
        const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x5f3a20, roughness: 0.82 });
        const grooveMat = new THREE.MeshStandardMaterial({ color: 0x3a2212, roughness: 1 });
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b2521, roughness: 0.5, metalness: 0.3 });
        const DW = 1.3, DH = 2.55, DR = DW / 2, DSPRING = DH - DR;

        const dBack = new THREE.Mesh(new THREE.PlaneGeometry(DW + 0.7, DH + 0.9), wallMat);
        dBack.position.set(0, DH / 2 - 0.15, -0.03);
        doorGroup.add(dBack);

        const leafShape = new THREE.Shape();
        leafShape.moveTo(-DR, 0);
        leafShape.lineTo(-DR, DSPRING);
        leafShape.absarc(0, DSPRING, DR, Math.PI, 0, true);
        leafShape.lineTo(DR, 0);
        leafShape.lineTo(-DR, 0);
        const leaf = new THREE.Mesh(
            new THREE.ExtrudeGeometry(leafShape, { depth: 0.08, bevelEnabled: false }),
            doorWoodMat
        );
        leaf.position.set(0, 0, 0.0);
        leaf.castShadow = !isMobile;
        doorGroup.add(leaf);

        for (let i = -1; i <= 1; i++) {
            const gr = new THREE.Mesh(new THREE.BoxGeometry(0.03, DH - 0.25, 0.11), grooveMat);
            gr.position.set(i * 0.38, DSPRING / 2 + 0.1, 0.082);
            doorGroup.add(gr);
        }
        [DH * 0.24, DH * 0.62].forEach(function (y) {
            const band = new THREE.Mesh(new THREE.BoxGeometry(DW, 0.09, 0.12), ironMat);
            band.position.set(0, y, 0.05);
            doorGroup.add(band);
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.017, 6, 16), ironMat);
        ring.position.set(0.42, DH * 0.42, 0.11);
        doorGroup.add(ring);

        [-1, 1].forEach(function (s) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, DSPRING + 0.1, 0.11), frameMat);
            post.position.set(s * (DR + 0.05), (DSPRING + 0.1) / 2, 0.04);
            doorGroup.add(post);
        });
        const archBand = new THREE.Mesh(new THREE.TorusGeometry(DR + 0.05, 0.065, 6, 24, Math.PI), frameMat);
        archBand.position.set(0, DSPRING, 0.04);
        doorGroup.add(archBand);

        doorGroup.rotation.y = Math.PI / 2;
        doorGroup.position.set(-HW, 0, -0.7);
        group.add(doorGroup);

        // === TIEF EINGELASSENER KAMIN (Rueckwand rechts) ===
        // Kaminmaul ist bereits als Rundbogen aus der Rueckwand
        // geschnitten. Dahinter eine echte, geschlossene Feuerkammer aus
        // dunklen Steinen (Rueckwand + Seiten + Rundbogen-Decke + Boden);
        // davor nur ein dezenter Holz-Mantel und eine flache Herdplatte.
        const CAV = 0.62;
        const cavH = FP.yTop - FP.y1;
        darkStoneMat.side = THREE.DoubleSide;

        const cavBack = new THREE.Mesh(new THREE.PlaneGeometry(FP.w + 0.2, cavH + 0.6), darkStoneMat);
        cavBack.position.set(fpCx, FP.y1 + cavH / 2 + 0.1, WALL_Z - CAV);
        group.add(cavBack);
        [-1, 1].forEach(function (s) {
            const side = new THREE.Mesh(new THREE.PlaneGeometry(CAV + 0.1, cavH + 0.6), darkStoneMat);
            side.rotation.y = s * Math.PI / 2;
            side.position.set(fpCx + s * (FP.w / 2 - 0.01), FP.y1 + cavH / 2 + 0.1, WALL_Z - CAV / 2);
            group.add(side);
        });
        // dunkle Decke der Kammer (flach, doppelseitig - so gibt es aus
        // keinem Kamerawinkel einen hellen Spalt oben in der Öffnung)
        const cavTop = new THREE.Mesh(new THREE.PlaneGeometry(FP.w + 0.1, CAV + 0.1), darkStoneMat);
        cavTop.rotation.x = Math.PI / 2;
        cavTop.position.set(fpCx, FP.yTop - 0.03, WALL_Z - CAV / 2);
        group.add(cavTop);
        const cavFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(FP.w + 0.1, CAV + 0.05),
            new THREE.MeshStandardMaterial({ color: 0x18110a, roughness: 1 })
        );
        cavFloor.rotation.x = -Math.PI / 2;
        cavFloor.position.set(fpCx, FP.y1 + 0.012, WALL_Z - CAV / 2 + 0.02);
        cavFloor.receiveShadow = true;
        group.add(cavFloor);

        // dezenter Holz-Mantel (Balken) direkt auf dem Bogenscheitel
        const fMantel = new THREE.Mesh(new THREE.BoxGeometry(FP.w + 0.55, 0.17, 0.24), beamMat);
        fMantel.position.set(fpCx, FP.yTop + 0.04, WALL_Z + 0.09);
        fMantel.castShadow = !isMobile;
        group.add(fMantel);

        // flache Herdplatte direkt vor der Öffnung (nur 0.05 hoch,
        // ~0.34 tief - liegt vor der Wand, hinter der Möbelzone)
        const fHearth = new THREE.Mesh(new THREE.BoxGeometry(FP.w + 0.24, 0.05, 0.36), frameMat);
        fHearth.position.set(fpCx, 0.026, WALL_Z + 0.22);
        fHearth.receiveShadow = true;
        group.add(fHearth);

    }

    // Vordere, grösstenteils transparente Baumkronen-Ebene: eine weiche,
    // lumpige Silhouette am UNTEREN Rand (Blick über die Wipfel ins Tal),
    // oben transparent. Zusammen mit makeForestWindowTexture ergibt das
    // die "mehreren weichen Tiefenebenen" hinter der Rückwand.
    function makeForestCanopy(seed, alpha) {

        const a = alpha == null ? 1 : alpha;
        const w = 384, h = 300;
        const el = document.createElement("canvas");
        el.width = w;
        el.height = h;
        const ctx = el.getContext("2d");
        const rng = mulberry32(61 + seed * 47);

        // eine geschlossene, weich gewölbte Kronen-Masse unten
        function blobRow(baseY, amp, col) {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(-16, h + 16);
            ctx.lineTo(-16, baseY);
            let x = -16;
            while (x < w + 16) {
                const nx = x + 30 + rng() * 46;
                const cy = baseY - amp * (0.4 + rng() * 0.9);
                ctx.quadraticCurveTo((x + nx) / 2, cy, nx, baseY - amp * (0.1 + rng() * 0.35));
                x = nx;
            }
            ctx.lineTo(w + 16, h + 16);
            ctx.closePath();
            ctx.fill();
        }
        blobRow(h * 0.80, 34, "rgba(70, 100, 62, " + (a * 0.85).toFixed(2) + ")");
        blobRow(h * 0.92, 40, "rgba(52, 80, 48, " + a + ")");

        // ein paar rundliche Einzelkronen, die etwas höher ragen
        ctx.fillStyle = "rgba(58, 86, 52, " + a + ")";
        for (let i = 0; i < 4; i++) {
            const cx = rng() * w;
            const cy = h * (0.62 + rng() * 0.16);
            const r = 26 + rng() * 30;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r, r * (0.7 + rng() * 0.3), 0, 0, Math.PI * 2);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(el);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;

    }

    // Kaminfeuer (kein GLB): glimmende Glutfläche + gekreuzte Holzscheite
    // + mehrere weich transparente, additiv gemischte Flammen-Ebenen.
    // Die Bewegung passiert im Render-Loop (animate()).
    function buildFireMesh() {

        const group = new THREE.Group();

        // Glut-/Kohlenfläche flach auf dem Feuerraumboden
        const embers = new THREE.Mesh(
            new THREE.PlaneGeometry(0.95, 0.5),
            new THREE.MeshBasicMaterial({
                map: makeEmberTexture(),
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        embers.rotation.x = -Math.PI / 2;
        embers.position.y = 0.015;
        group.add(embers);
        group.userData.embers = embers;

        // Zwei gekreuzte Holzscheite
        const logMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 1 });
        const logGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.82, 7);
        const log1 = new THREE.Mesh(logGeo, logMat);
        log1.rotation.z = Math.PI / 2;
        log1.rotation.y = 0.35;
        log1.position.set(0, 0.08, 0.03);
        const log2 = new THREE.Mesh(logGeo, logMat);
        log2.rotation.z = Math.PI / 2;
        log2.rotation.y = -0.5;
        log2.position.set(0.01, 0.15, -0.04);
        group.add(log1, log2);

        // Flammen-Ebenen (zur Kamera, +Z, gerichtet)
        const flameTex = makeFlameTexture();
        const specs = [
            { x: 0.0, s: 1.0, c: 0xff7a26 },
            { x: -0.17, s: 0.72, c: 0xffab48 },
            { x: 0.18, s: 0.68, c: 0xffab48 },
            { x: 0.02, s: 0.46, c: 0xffe39a }
        ];
        const flames = [];
        specs.forEach(function (spec, i) {
            const fl = new THREE.Mesh(
                new THREE.PlaneGeometry(0.52, 0.78),
                new THREE.MeshBasicMaterial({
                    map: flameTex,
                    color: spec.c,
                    transparent: true,
                    opacity: 0.85,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide
                })
            );
            fl.position.set(spec.x, 0.16 + spec.s * 0.22, 0.02 + i * 0.012);
            fl.scale.setScalar(spec.s);
            fl.userData.baseX = spec.x;
            fl.userData.s0 = spec.s;
            fl.userData.phase = i * 1.9;
            flames.push(fl);
            group.add(fl);
        });
        group.userData.flames = flames;

        return group;

    }

    // Weiche, tropfenförmige Flammen-Textur (hell im Kern, transparent
    // zum Rand) - für die additiv gemischten Flammen-Ebenen.
    function makeFlameTexture() {

        const w = 64, h = 96;
        const el = document.createElement("canvas");
        el.width = w;
        el.height = h;
        const ctx = el.getContext("2d");

        const g = ctx.createRadialGradient(w / 2, h * 0.64, 2, w / 2, h * 0.6, h * 0.5);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.32, "rgba(255,224,150,0.92)");
        g.addColorStop(0.66, "rgba(255,140,60,0.4)");
        g.addColorStop(1, "rgba(255,110,40,0)");
        ctx.fillStyle = g;

        ctx.beginPath();
        ctx.moveTo(w / 2, 3);
        ctx.quadraticCurveTo(w * 0.98, h * 0.55, w / 2, h - 3);
        ctx.quadraticCurveTo(w * 0.02, h * 0.55, w / 2, 3);
        ctx.fill();

        const tex = new THREE.CanvasTexture(el);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;

    }

    // Glimmende Kohlen: verstreute warme Punkte + weicher Zentralglanz.
    function makeEmberTexture() {

        const size = 64;
        const el = document.createElement("canvas");
        el.width = el.height = size;
        const ctx = el.getContext("2d");

        const rng = mulberry32(42);
        for (let i = 0; i < 44; i++) {
            const x = rng() * size;
            const y = rng() * size;
            const r = 1 + rng() * 3;
            ctx.fillStyle = "rgba(255," + Math.floor(80 + rng() * 110) + ",40," + (0.3 + rng() * 0.6).toFixed(2) + ")";
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
        g.addColorStop(0, "rgba(255,150,60,0.55)");
        g.addColorStop(1, "rgba(255,150,60,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);

        const tex = new THREE.CanvasTexture(el);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;

    }

    // Echte kleine Punktlichtquelle für leuchtende Möbel (Waldlampe).
    // Kein Schatten (Performance). EIN klarer, warmer Leuchtkern - keine
    // zweite Kugel, die "doppelt" wirkt.
    function addLampLight(group, lightSpec) {

        const color = new THREE.Color(lightSpec.color || "#ffdca6");
        const lamp = new THREE.PointLight(color, lightSpec.intensity || 6.5, lightSpec.distance || 3.8, 2);
        lamp.position.set(0, lightSpec.height || 1.35, 0);
        group.add(lamp);
        group.userData.light = lamp;

        const core = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 10, 10),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff2d4") })
        );
        core.position.copy(lamp.position);
        group.add(core);
        group.userData.core = core;

    }

    // An/Aus für eine platzierte Lampe. Aus = keine Licht-Emission und
    // kein Kern, das Möbelstück selbst bleibt sichtbar.
    function setLampState(group, on) {
        if (group.userData.light) { group.userData.light.visible = on; }
        if (group.userData.core) { group.userData.core.visible = on; }
    }

    // Kleiner, deterministischer Pseudo-Zufallsgenerator für die
    // Stein-Textur (kein Math.random() nötig, gleiches Ergebnis bei
    // jedem Laden - Texturen bleiben zwischen Sitzungen visuell stabil).
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

}
