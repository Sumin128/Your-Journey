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
    const FIRE_ANCHOR = new THREE.Vector3(2.7, 0, -ROOM_DEPTH / 2 + 0.45);

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
    scene.fog = new THREE.Fog(shell.fogColor, 14, 30);

    // PerspectiveCamera.fov ist der VERTIKALE Blickwinkel. Bei einem
    // hohen, schmalen Wrapper (Handy im Hochformat) würde damit der
    // horizontale Ausschnitt schrumpfen und die Seitenwände/der Kamin
    // aus dem Bild fallen. resize() rechnet deshalb den vertikalen fov
    // aus einem konstant gehaltenen HORIZONTALEN Zielwinkel zurück.
    const TARGET_HORIZONTAL_FOV = isMobile ? 60 : 50;

    // Feste, leicht erhöhte Bühnenkamera (keine freie Navigation) - so
    // weit hinten/tief, dass Boden, alle drei Wände, Fenster und Kamin
    // ins Bild passen, aber nicht so steil, dass der Raum wie eine
    // Grube wirkt. Wird bei geladener GLB-Hülle nachjustiert.
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    if (isMobile) {
        // Hochformat: näher dran und flacher, sonst nimmt der dunkle
        // Dachraum oben zu viel Bild ein.
        camera.position.set(0, 5.0, 8.8);
        camera.lookAt(0, 1.9, -0.6);
    } else {
        camera.position.set(0, 6.0, 9.9);
        camera.lookAt(0, 1.7, -0.7);
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
        camera.fov = Math.min(64, vFovRad * 180 / Math.PI);

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
    fireLight.position.set(FIRE_ANCHOR.x, 1.1, FIRE_ANCHOR.z + 0.35);
    scene.add(fireLight);

    // Dezentes Fülllicht von der Kameraseite, ohne Schatten - hebt die
    // Schattenseite von 3D-Möbelmodellen an, damit sie nicht zu dunkel
    // absaufen (Cutouts brauchen das nicht, schadet ihnen aber nicht).
    const fillLight = new THREE.DirectionalLight(0xffe9cf, 0.35);
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
    fireMesh.position.set(FIRE_ANCHOR.x, 0.18, FIRE_ANCHOR.z + 0.12);
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

        // Leuchtende Möbel (furniture.light, z. B. Waldlampe) bekommen
        // eine echte kleine Punktlichtquelle + sichtbaren Glühkern.
        // Vorerst immer an; ein- / ausschaltbar und speicherbar wird der
        // Zustand in einem späteren Schritt (instance.lightOn).
        if (furniture.light) {
            addLampLight(group, furniture.light);
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
            content: null
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

    let selected = null;

    function selectGroup(group) {

        selected = group;

        if (group) {
            selectionRing.visible = true;
            selectionRing.position.x = group.position.x;
            selectionRing.position.z = group.position.z;
            if (rotateControls) { rotateControls.hidden = false; }
            renderColorSwatches(group);
        } else {
            selectionRing.visible = false;
            if (rotateControls) { rotateControls.hidden = true; }
        }

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

        // Einfache, verzeihende Überlappungsprüfung: kein hartes
        // Blockieren, sondern ein sanftes Auseinanderschieben, falls
        // sich zwei Möbel-"Kreise" zu stark überschneiden.
        placedGroups.forEach(function (other) {

            if (other === selected) {
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

        // Kaminfeuer: leicht flackerndes Punktlicht + sanft zuckende
        // Flammen. Rein zeitgesteuert (zwei überlagerte Sinus), kein
        // Partikelsystem - das Feuer gehört bewusst nicht ins GLB.
        const flick = 0.82 + Math.sin(t * 9) * 0.09 + Math.sin(t * 17.3) * 0.05;
        fireLight.intensity = shell.fireLight.intensity * flick;

        for (let i = 0; i < fireMesh.children.length; i++) {
            const flame = fireMesh.children[i];
            const s = 0.78 + Math.sin(t * (7 + i * 2) + i) * 0.18 + (flick - 0.82);
            flame.scale.set(0.9 + (s - 0.9) * 0.45, s, 0.9 + (s - 0.9) * 0.45);
            flame.rotation.y = Math.sin(t * 3 + i) * 0.25;
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
            plane.position.y = 0.01; // knapp über dem Boden, kein Z-Fighting
            plane.receiveShadow = true;
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

    function makeStoneTexture(baseColor) {

        const size = 512;
        const el = document.createElement("canvas");
        el.width = el.height = size;
        const ctx = el.getContext("2d");

        ctx.fillStyle = baseColor || "#a9855f";
        ctx.fillRect(0, 0, size, size);

        const rng = mulberry32(7);
        for (let i = 0; i < 90; i++) {
            const w = 40 + rng() * 60;
            const h = 26 + rng() * 30;
            const x = rng() * size;
            const y = rng() * size;
            const tone = 150 + Math.floor(rng() * 60);
            ctx.fillStyle = "rgba(" + tone + "," + (tone - 30) + "," + (tone - 65) + ",0.5)";
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = "rgba(60,38,20,0.4)";
            ctx.strokeRect(x, y, w, h);
        }

        const texture = new THREE.CanvasTexture(el);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2.4, 2.0);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;

    }

    // Waldsicht durchs Fenster: warmer Himmel oben, weiche grüne
    // Baumkronen dahinter, ein paar hellere Lichtflecken. Bewusst
    // ruhig/gemalt (keine harten Zacken - die lasen sich vorher wie
    // Feuer statt wie Wald).
    function makeForestWindowTexture(skyColors) {

        const colors = (skyColors && skyColors.length === 3) ? skyColors : ["#ffe2a0", "#ffb877", "#dd8a4e"];

        const w = 300, h = 260;
        const el = document.createElement("canvas");
        el.width = w;
        el.height = h;
        const ctx = el.getContext("2d");

        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, colors[0]);
        sky.addColorStop(0.5, "#cfe3a8");
        sky.addColorStop(1, "#7fae63");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        const rng = mulberry32(19);

        // hintere, dunklere Baumreihe
        function canopy(baseY, fill) {
            ctx.fillStyle = fill;
            for (let i = 0; i < 7; i++) {
                const cx = rng() * w;
                const r = 26 + rng() * 30;
                ctx.beginPath();
                ctx.arc(cx, baseY + rng() * 20, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        canopy(h * 0.55, "rgba(58, 92, 52, 0.9)");
        canopy(h * 0.72, "rgba(84, 120, 66, 0.95)");
        canopy(h * 0.9, "rgba(108, 142, 78, 1)");

        // ein paar warme Lichtflecken zwischen den Blättern
        ctx.fillStyle = "rgba(255, 240, 190, 0.5)";
        for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.arc(rng() * w, h * (0.45 + rng() * 0.4), 3 + rng() * 4, 0, Math.PI * 2);
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

    // Prozedurale Raumhülle (technischer Fallback, solange keine echte
    // waldzimmer-shell.glb vorliegt): U-Form mit Boden-Andockung, hohe
    // Natursteinwände, Decke mit sichtbaren Holzbalken, zwei hohe
    // Fensterbögen mit Waldsicht, hoher Türbogen in der linken Wand,
    // integrierter Kamin (ohne Feuer - das lebt separat), Wandnischen
    // und Sockel-/Kranzleisten für Tiefe. Setzt dustAnchor auf das
    // erste Fenster.
    function buildProceduralShell(group, dustAnchor) {

        const wallMat = new THREE.MeshStandardMaterial({ map: makeStoneTexture(shell.wallBaseColor), roughness: 1 });
        const beamMat = new THREE.MeshStandardMaterial({ color: 0x3f2c1a, roughness: 0.95 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0x6d5133, roughness: 1 });
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 1 });
        const nicheMat = new THREE.MeshStandardMaterial({ color: 0x5f4830, roughness: 1 });

        // --- Wände (Innenseiten zugewandt) ---
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT), wallMat);
        backWall.position.set(0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2);
        backWall.receiveShadow = true;
        group.add(backWall);

        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
        leftWall.receiveShadow = true;
        group.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
        rightWall.receiveShadow = true;
        group.add(rightWall);

        // --- Decke + sichtbare Holzbalken ---
        // Bewusst niedriger als die Wände (CEILING_Y < ROOM_HEIGHT): von
        // der leicht erhöhten Bühnenkamera füllt so die Deckenuntersicht
        // den oberen Bildrand, statt dass dort ein schwarzer Streifen
        // Hintergrund zwischen Wandkrone und Decke durchscheint.
        // Decke: nach unten weisende Fläche (FrontSide) - von der leicht
        // erhöhten Bühnenkamera füllt ihre Untersicht den oberen
        // Bildrand und schliesst den Raum optisch nach oben ab.
        const CEILING_Y = 4.4;
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(ROOM_WIDTH + 8, ROOM_DEPTH + 10),
            new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, CEILING_Y, 1.5);
        group.add(ceiling);

        for (let i = 0; i < 4; i++) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_WIDTH + 0.4, 0.2, 0.26), beamMat);
            beam.position.set(0, CEILING_Y - 0.12, -ROOM_DEPTH / 2 + 0.9 + i * ((ROOM_DEPTH - 1.8) / 3));
            group.add(beam);
        }
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, ROOM_DEPTH), beamMat);
        ridge.position.set(0, CEILING_Y - 0.11, 0);
        group.add(ridge);

        // --- Sockel- + Kranzleiste (macht aus "Ebenen" einen Raum) ---
        [0.1, CEILING_Y - 0.12].forEach(function (y) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(ROOM_WIDTH, 0.2, 0.14), trimMat);
            b.position.set(0, y, -ROOM_DEPTH / 2 + 0.07);
            group.add(b);
            [-1, 1].forEach(function (side) {
                const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, ROOM_DEPTH), trimMat);
                s.position.set(side * (ROOM_WIDTH / 2 - 0.07), y, 0);
                group.add(s);
            });
        });

        // --- Zwei hohe Fensterbögen mit Waldsicht (Rückwand) ---
        const winTex = makeForestWindowTexture(shell.windowSky);
        [-2.8, -1.1].forEach(function (x, idx) {
            const w = new THREE.Mesh(
                new THREE.PlaneGeometry(1.4, 2.1),
                new THREE.MeshBasicMaterial({ map: winTex })
            );
            w.position.set(x, 1.95, -ROOM_DEPTH / 2 + 0.04);
            group.add(w);

            const archTop = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.12, 8, 16, Math.PI), frameMat);
            archTop.position.set(x, 3.0, -ROOM_DEPTH / 2 + 0.06);
            group.add(archTop);
            [-0.73, 0.73].forEach(function (dx) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.16), frameMat);
                post.position.set(x + dx, 1.9, -ROOM_DEPTH / 2 + 0.06);
                group.add(post);
            });

            if (idx === 0) { dustAnchor.set(x, 2.1, -ROOM_DEPTH / 2 + 0.35); }
        });

        // --- Hoher Türbogen (linke Wand) ---
        const door = new THREE.Mesh(
            new THREE.PlaneGeometry(1.6, 2.7),
            new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 1 })
        );
        door.rotation.y = Math.PI / 2;
        door.position.set(-ROOM_WIDTH / 2 + 0.05, 1.35, -0.4);
        group.add(door);

        const doorArch = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.16, 8, 18, Math.PI), frameMat);
        doorArch.rotation.y = Math.PI / 2;
        doorArch.position.set(-ROOM_WIDTH / 2 + 0.07, 2.7, -0.4);
        group.add(doorArch);
        [-0.82, 0.82].forEach(function (dz) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.7, 0.2), frameMat);
            post.rotation.y = Math.PI / 2;
            post.position.set(-ROOM_WIDTH / 2 + 0.07, 1.35, -0.4 + dz);
            group.add(post);
        });

        // --- Wandnischen: flache, dunkle Einlassungen mit Steinrahmen
        // in der Rückwand (Tiefe, ohne aufwändige Kastengeometrie) ---
        function niche(x) {
            const recess = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.15, 0.3), nicheMat);
            recess.position.set(x, 1.75, -ROOM_DEPTH / 2 + 0.02);
            group.add(recess);
            const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 6, 14, Math.PI), frameMat);
            rim.position.set(x, 2.28, -ROOM_DEPTH / 2 + 0.18);
            group.add(rim);
            [-0.42, 0.42].forEach(function (dx) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.14), frameMat);
                post.position.set(x + dx, 1.72, -ROOM_DEPTH / 2 + 0.18);
                group.add(post);
            });
        }
        niche(0.5);

        // --- Integrierter Kamin (Rückwand rechts), OHNE Feuer ---
        const fp = new THREE.Group();
        const stoneMat = new THREE.MeshStandardMaterial({ map: makeStoneTexture(shell.wallBaseColor), roughness: 1 });
        const sootMat = new THREE.MeshStandardMaterial({ color: 0x1a1108, roughness: 1 });

        const breast = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.9, 0.7), stoneMat);
        breast.position.y = 1.95;
        breast.receiveShadow = true;
        fp.add(breast);

        const firebox = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.1, 0.42), sootMat);
        firebox.position.set(0, 0.6, 0.2);
        fp.add(firebox);

        const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.28, 0.66), stoneMat);
        lintel.position.set(0, 1.32, 0.22);
        fp.add(lintel);

        const mantel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 1.0), stoneMat);
        mantel.position.set(0, 1.62, 0.14);
        mantel.castShadow = !isMobile;
        fp.add(mantel);

        const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.85), stoneMat);
        hearth.position.set(0, 0.07, 0.62);
        hearth.receiveShadow = true;
        fp.add(hearth);

        fp.position.set(FIRE_ANCHOR.x, 0, -ROOM_DEPTH / 2);
        group.add(fp);

    }

    // Kleines, animiertes Kaminfeuer (drei ineinander liegende Kegel).
    // Skalierung/Drehung passiert im Render-Loop (animate()).
    function buildFireMesh() {

        const group = new THREE.Group();
        const colors = [0xff7b2c, 0xffb14a, 0xffe08a];

        for (let i = 0; i < 3; i++) {
            const flame = new THREE.Mesh(
                new THREE.ConeGeometry(0.24 - i * 0.05, 0.55 - i * 0.11, 8),
                new THREE.MeshBasicMaterial({
                    color: colors[i],
                    transparent: true,
                    opacity: 0.85 - i * 0.16,
                    depthWrite: false
                })
            );
            flame.position.y = 0.26 - i * 0.04;
            group.add(flame);
        }

        return group;

    }

    // Echte kleine Punktlichtquelle für leuchtende Möbel (Waldlampe).
    // Kein Schatten (Performance). Sichtbarer Glühkern, damit das Licht
    // klar "aus der Lampe" kommt.
    function addLampLight(group, lightSpec) {

        const color = new THREE.Color(lightSpec.color || "#ffd9a8");
        const lamp = new THREE.PointLight(color, lightSpec.intensity || 6, lightSpec.distance || 3.4, 2);
        lamp.position.set(0, lightSpec.height || 1.5, 0);
        group.add(lamp);
        group.userData.light = lamp;

        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 8, 8),
            new THREE.MeshBasicMaterial({ color: color })
        );
        bulb.position.copy(lamp.position);
        group.add(bulb);
        group.userData.bulb = bulb;

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
