/* =====================================================
   SCHLOSS-3D.JS
   "Mein Schloss" - 3D-Raumansicht (Three.js).

   SCHRITT 2 (aktueller Stand): funktionierender Prototyp - ein Raum
   mit Boden, Wänden, Fenster, Kamin, warmem Licht und Schatten, feste
   leicht schräge Kamera, EIN Platzhalter-Möbel (Box-Geometrie), das
   sich per Ziehen frei auf dem Boden verschieben und über zwei
   Buttons drehen lässt. Bewegung ist auf den Raum begrenzt, eine
   einfache Abstandsprüfung schiebt überlappende Möbel sanft
   auseinander (keine starre Physik).

   NOCH NICHT angeschlossen (folgt in Schritt 3): echtes Inventar/
   Katalog (JS/schloss-data.js), Speichern/Laden in player.schloss,
   Kauf-Flow, Entfernen aus dem Inventar heraus. Diese Funktionen
   laufen bis dahin unverändert weiter in JS/schloss.js (dort auch der
   Grund, warum #schloss-room im Markup vorerst nur versteckt statt
   gelöscht ist).

   Datenmodell-Zielrichtung (Schritt 3): player.schloss.rooms.<id>.
   placedItems[] bekommt statt {x, y, flipped} künftig
   {x, z, rotationY} (echte 3D-Koordinaten in Metern + Gieren in
   Radiant) - design/color/customVariantId/scale/content bleiben
   unverändert. Migration alter 2D-Spielstände: siehe
   JS/schloss-migration.js (kommt mit Schritt 3).

   Feature-Spezifikation: docs/mein-schloss.md
   ===================================================== */

import * as THREE from "three";

const canvas = document.getElementById("schloss-canvas");

if (canvas) {
    initSchloss3D(canvas);
}

function initSchloss3D(canvas) {

    const ROOM_WIDTH = 8;
    const ROOM_DEPTH = 6;
    const ROOM_HEIGHT = 3.2;
    const WALL_MARGIN = 0.15; // Sicherheitsabstand zur Wand, damit Möbel nicht "einwächst"

    const isMobile = window.matchMedia("(max-width: 700px)").matches;

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
    // damit kein zusätzliches Bild-Asset für den Prototyp nötig ist.
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


    /* --- Platzhalter-Möbel (Schritt 2: nur EIN Stück, hart codiert) --- */

    const placeholder = buildPlaceholderChair();
    placeholder.position.set(0, 0, 0.6);
    placeholder.userData.footprint = { w: 0.9, d: 0.9 };
    scene.add(placeholder);

    const placedGroups = [placeholder];

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

    let selected = null;

    function selectGroup(group) {

        selected = group;

        if (group) {
            selectionRing.visible = true;
            selectionRing.position.x = group.position.x;
            selectionRing.position.z = group.position.z;
            if (rotateControls) { rotateControls.hidden = false; }
        } else {
            selectionRing.visible = false;
            if (rotateControls) { rotateControls.hidden = true; }
        }

    }

    if (rotateLeftBtn) {
        rotateLeftBtn.addEventListener("click", function () {
            if (selected) { selected.rotation.y += Math.PI / 8; }
        });
    }

    if (rotateRightBtn) {
        rotateRightBtn.addEventListener("click", function () {
            if (selected) { selected.rotation.y -= Math.PI / 8; }
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener("click", function () {
            // Schritt 2: Entfernen betrifft nur die Szene (kein
            // Inventar-Rückfluss/Speichern - folgt in Schritt 3).
            if (!selected) { return; }
            scene.remove(selected);
            const index = placedGroups.indexOf(selected);
            if (index !== -1) { placedGroups.splice(index, 1); }
            selectGroup(null);
        });
    }

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let dragging = false;
    let dragPointerId = null;

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
                dragPointerId = event.pointerId;
                canvas.setPointerCapture(event.pointerId);
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
        if (event.pointerId === dragPointerId) {
            dragging = false;
            dragPointerId = null;
        }
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
       Hilfsfunktionen: Canvas-Texturen + einfache Geometrie-Gruppen.
       Alles rein prozedural (kein Bild-Asset nötig) - passend zum
       Platzhalter-Charakter dieses Schritts. Echte, gemalte
       Materialien/Modelle folgen später (siehe images/schloss/models/).
       ===================================================== */

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

    function buildPlaceholderChair() {

        const group = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ color: 0xc08a4e, roughness: 0.8 });

        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), wood);
        seat.position.y = 0.42;
        seat.castShadow = true;
        group.add(seat);

        const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.12), wood);
        back.position.set(0, 0.78, -0.29);
        back.castShadow = true;
        group.add(back);

        [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(function (pos) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), wood);
            leg.position.set(pos[0], 0.21, pos[1]);
            leg.castShadow = true;
            group.add(leg);
        });

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
