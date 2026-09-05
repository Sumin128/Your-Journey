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
// Für spätere echte .glb-Möbelmodelle vorbereitet (images/schloss/models/) -
// noch nicht genutzt, Phase 1 rendert Möbel als Bild-Cutouts.
// eslint-disable-next-line no-unused-vars
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
    const ROOM_HEIGHT = 3.2;
    const WALL_MARGIN = 0.15; // Sicherheitsabstand zur Wand, damit Möbel nicht "einwächst"

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


    /* --- Grundgerüst --- */

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a1c12);
    scene.fog = new THREE.Fog(0x2a1c12, 9, 16);

    const camera = new THREE.PerspectiveCamera(isMobile ? 50 : 42, 1, 0.1, 100);
    camera.position.set(0, 5.4, 8.2);
    camera.lookAt(0, 1, -0.4);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    function resize() {

        const width = canvas.clientWidth || 1;
        const height = canvas.clientHeight || 1;

        renderer.setSize(width, height, false);
        renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

    }

    window.addEventListener("resize", resize);


    /* --- Licht: warmes Fensterlicht + Kaminglühen + sanftes Umgebungslicht --- */

    scene.add(new THREE.AmbientLight(0xffe3bd, 0.5));

    const windowLight = new THREE.DirectionalLight(0xfff1d6, 0.85);
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

    const fireLight = new THREE.PointLight(0xff9c4a, 1.4, 6.5, 2);
    fireLight.position.set(3.1, 1.05, -ROOM_DEPTH / 2 + 0.6);
    scene.add(fireLight);


    /* --- Boden --- */

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
        new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);


    /* --- Wände + Fenster + Kamin --- */

    const wallMaterial = new THREE.MeshStandardMaterial({ map: makeStoneTexture(), roughness: 1 });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT), wallMaterial);
    backWall.position.set(0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMaterial.clone());
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Waldfenster (Blickfang links) - warmes Canvas-Gemälde statt Foto,
    // damit kein zusätzliches Bild-Asset nötig ist.
    const windowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.3, 1.7),
        new THREE.MeshBasicMaterial({ map: makeForestWindowTexture() })
    );
    windowMesh.position.set(-2.3, 1.95, -ROOM_DEPTH / 2 + 0.03);
    scene.add(windowMesh);

    // Kamin (Blickfang rechts) - einfache, klar lesbare Boxen.
    const fireplace = buildFireplace();
    fireplace.position.set(3.1, 0, -ROOM_DEPTH / 2 + 0.35);
    scene.add(fireplace);

    // Decke - ohne sie wirkt der Raum nach oben offen/leer statt wie
    // ein richtiges Zimmer. Dunkler als die Wände (bekommt kaum Licht
    // ab), damit sie nicht mit der Kamera konkurriert.
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
        new THREE.MeshStandardMaterial({ color: 0x40301f, roughness: 1 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ROOM_HEIGHT;
    scene.add(ceiling);


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
        const group = createFurnitureCutout(furniture, design, instance.color);

        group.position.set(instance.x, 0, instance.z);
        group.rotation.y = instance.rotationY || 0;
        group.userData.instanceId = instance.instanceId;
        group.userData.footprint = furniture.footprint || { w: 0.6, d: 0.6 };
        group.userData.furniture = furniture;

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

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    resize();
    animate();


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

    function createFurnitureCutout(furniture, design, initialColor) {

        const group = new THREE.Group();
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

        return group;

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

    function makeFloorTexture() {

        const size = 512;
        const el = document.createElement("canvas");
        el.width = el.height = size;
        const ctx = el.getContext("2d");

        ctx.fillStyle = "#a9793f";
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
        texture.repeat.set(3, 2.2);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;

    }

    function makeStoneTexture() {

        const size = 512;
        const el = document.createElement("canvas");
        el.width = el.height = size;
        const ctx = el.getContext("2d");

        ctx.fillStyle = "#a9855f";
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
        texture.repeat.set(2.4, 1.4);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;

    }

    function makeForestWindowTexture() {

        const w = 300, h = 220;
        const el = document.createElement("canvas");
        el.width = w;
        el.height = h;
        const ctx = el.getContext("2d");

        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, "#ffe2a0");
        sky.addColorStop(0.55, "#ffb877");
        sky.addColorStop(1, "#dd8a4e");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "rgba(70,45,20,0.55)";
        for (let i = 0; i < 6; i++) {
            const x = (i / 6) * w + 10;
            const treeH = h * (0.45 + (i % 2) * 0.15);
            ctx.beginPath();
            ctx.moveTo(x, h);
            ctx.lineTo(x + 24, h - treeH);
            ctx.lineTo(x + 48, h);
            ctx.closePath();
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(el);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;

    }

    function buildFireplace() {

        const group = new THREE.Group();
        const stone = new THREE.MeshStandardMaterial({ color: 0x7a5638, roughness: 1 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 });
        const glow = new THREE.MeshBasicMaterial({ color: 0xffb15c });

        const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.5), stone);
        base.position.y = 0.7;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const opening = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.3), dark);
        opening.position.set(0, 0.55, 0.15);
        group.add(opening);

        const fire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 8), glow);
        fire.position.set(0, 0.42, 0.2);
        group.add(fire);

        return group;

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
