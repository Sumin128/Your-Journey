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

    // Bewegungsgrenze getrennt von der Raumtiefe: hinten + seitlich sind
    // es echte Wände (ROOM_DEPTH/ROOM_WIDTH), VORNE gibt es keine Wand -
    // die offene Front reicht bis fast an die sichtbare Bodenkante der
    // Kamera. FLOOR_FRONT_LIMIT ist die z-Koordinate, bis zu der ein Möbel
    // (Kante) nach vorne gezogen werden darf; auf der schmalsten Desktop-
    // Ansicht liegt die sichtbare Bodenkante bei ~z 5.1, mobil weiter.
    const FLOOR_FRONT_LIMIT = 4.7;
    const FRONT_MARGIN = 0.2;

    // Möbelposition auf den begehbaren Boden begrenzen. Rückwand +
    // Seitenwände = echte Wände (WALL_MARGIN), vorne = FLOOR_FRONT_LIMIT.
    // footprint kann fehlen -> kleiner Default.
    function clampToFloor(x, z, footprint) {
        const fp = footprint || { w: 0.6, d: 0.6 };
        const halfW = ROOM_WIDTH / 2 - fp.w / 2 - WALL_MARGIN;
        const backZ = -ROOM_DEPTH / 2 + fp.d / 2 + WALL_MARGIN;
        const frontZ = FLOOR_FRONT_LIMIT - fp.d / 2 - FRONT_MARGIN;
        return {
            x: Math.max(-halfW, Math.min(halfW, x)),
            z: Math.max(backZ, Math.min(frontZ, z))
        };
    }

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
    const FIRE_ANCHOR = new THREE.Vector3(2.9, 0, -ROOM_DEPTH / 2 + 0.45);

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

    // Gemalte Mirelon-Texturserie (images/schloss/textures/). Kachelt mit
    // ruhiger, handgemalter Wirkung; das Licht bleibt dynamisch in
    // Three.js (die Texturen tragen keine eingebrannten Schatten).
    // repeatX/Y = wie oft die Kachel über die gesamte 0..1-UV läuft;
    // clamp = einmalige Bild-Ansicht (Waldpanorama).
    function roomTex(file, repeatX, repeatY, clamp) {
        const t = textureLoader.load("images/schloss/textures/" + file);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        if (clamp) {
            t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        } else {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(repeatX, repeatY);
        }
        return t;
    }

    // Innenausstattungs-Stil ("Theme"). Aktuell hat nur "wald" eine
    // shell; für alles andere (bewusst noch nicht fertige Themes)
    // fällt es sauber auf die Wald-Hülle zurück, damit die Szene nie
    // "kaputt" aussieht, während das Theme im UI als gesperrt gilt.
    const theme = getSchlossTheme(player.schloss.style);
    const shell = theme.shell || getSchlossTheme("wald").shell;


    /* --- Grundgerüst --- */

    const scene = new THREE.Scene();
    // Warmer, mittiger Grundton statt Creme: falls an einer Bildkante
    // doch einmal an der Raumhuelle vorbeigeschaut wird, liest sich das
    // als weicher Schatten, nicht als weisse Flaeche.
    scene.background = new THREE.Color(0x4b3a2a);
    scene.fog = new THREE.Fog(shell.fogColor, 20, 42);

    // PerspectiveCamera.fov ist der VERTIKALE Blickwinkel. Bei einem
    // hohen, schmalen Wrapper (Handy im Hochformat) würde damit der
    // horizontale Ausschnitt schrumpfen und die Seitenwände/der Kamin
    // aus dem Bild fallen. resize() rechnet deshalb den vertikalen fov
    // aus einem konstant gehaltenen HORIZONTALEN Zielwinkel zurück.
    // Schmales/Hochformat hält einen konstanten HORIZONTALEN Zielwinkel
    // (Tür/Fenster/Kamin bleiben nebeneinander); breites Querformat hält
    // stattdessen einen konstanten VERTIKALEN Winkel und lässt den
    // horizontalen Ausschnitt mit der Breite wachsen - so kommen auf
    // breiten Mirelon-Layouts Seitenwände und Raumtiefe ins Bild, statt
    // dass die Ansicht flach reinzoomt. Siehe resize().
    const TARGET_HORIZONTAL_FOV = isMobile ? 68 : 60;
    const TARGET_VERTICAL_FOV = isMobile ? 46 : 39;

    // Offene Frontansicht: leicht erhöht, sanft nach unten geneigt, die
    // Rückwand deutlich auf Distanz. Tür links, Fenster mittig, Kamin
    // rechts sind gleichzeitig im Bild; viel Boden als räumlicher
    // Vordergrund, die Seitenwände tragen die Tiefe.
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    if (isMobile) {
        camera.position.set(0, 3.2, 10.2);
        camera.lookAt(0, 1.05, -3.0);
    } else {
        camera.position.set(0, 3.7, 11.0);
        camera.lookAt(0, 0.6, -3.0);
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

        // Zwei Regime, damit dieselbe Kamera auf schmalem UND breitem
        // Layout dieselbe Raumtiefe zeigt:
        //  - breit (aspect >= 1.2): vertikalen Winkel konstant halten,
        //    der horizontale Ausschnitt waechst mit der Breite (mehr
        //    Seitenwand + Tiefe, kein flaches Reinzoomen). Nur gegen
        //    Fisheye auf Ultrawide gedeckelt.
        //  - schmal/Hochformat: horizontalen Zielwinkel halten, damit
        //    Tuer/Fenster/Kamin nebeneinander bleiben; vertikal gedeckelt.
        let vFovDeg;
        if (aspect >= 1.2) {
            const maxHFovRad = 86 * Math.PI / 180;
            const vFromHCap = 2 * Math.atan(Math.tan(maxHFovRad / 2) / aspect) * 180 / Math.PI;
            vFovDeg = Math.min(TARGET_VERTICAL_FOV, vFromHCap);
        } else {
            const hFovRad = TARGET_HORIZONTAL_FOV * Math.PI / 180;
            const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / Math.max(aspect, 0.5));
            vFovDeg = Math.min(isMobile ? 58 : 52, vFovRad * 180 / Math.PI);
        }
        camera.fov = vFovDeg;

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

    const fireLight = new THREE.PointLight(shell.fireLight.color, shell.fireLight.intensity, 8.5, 2);
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
    const floorW = ROOM_WIDTH + 14, floorD = ROOM_DEPTH + 24;
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(floorW, floorD),
        new THREE.MeshStandardMaterial({
            map: roomTex("wald-holzboden-storybook.png", floorW / 4.2, floorD / 3.0),
            roughness: 0.85
        })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 4;
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
    // Sitzt IN der tiefen Feuerraum-Nische, ein Stueck hinter der
    // Öffnungsebene auf dem Kammerboden.
    fireMesh.position.set(FIRE_ANCHOR.x, 0.075, -ROOM_DEPTH / 2 - 0.4);
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

        // Frisch platzierte Möbel gestaffelt nahe der gut sichtbaren
        // Raummitte (rein kosmetisch - Kind zieht sie danach frei an
        // ihren Platz, jetzt bis fast an die vordere Bodenkante).
        const index = room.placedItems.length;
        const col = index % 5;
        const row = Math.floor(index / 5) % 3;
        const spawn = clampToFloor(-2.6 + col * 1.3, 0.6 + row * 1.0,
            (getSchlossFurniture(furnitureId).footprint) || { w: 0.6, d: 0.6 });

        const instance = {
            instanceId: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            furnitureId: furnitureId,
            design: 0,
            color: null,
            customVariantId: null,
            x: spawn.x,
            z: spawn.z,
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

        let c = clampToFloor(point.x, point.z, footprint);
        let x = c.x, z = c.z;

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

            c = clampToFloor(x, z, footprint);
            x = c.x;
            z = c.z;

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

        // Gemalte Mirelon-Texturserie - alle Bauteile ziehen aus
        // denselben Bildern, damit Architektur und Möbel wie aus einer
        // Welt wirken. Block-/Dielenmass ist so gewählt, dass es ruhig
        // und handgemalt liest, nicht als gekacheltes Muster.
        const wallBackMat = new THREE.MeshStandardMaterial({ map: roomTex("wald-steinwand-storybook.png", ROOM_WIDTH / 3.4, ROOM_HEIGHT / 3.4), roughness: 0.95 });
        const wallSideMat = new THREE.MeshStandardMaterial({ map: roomTex("wald-steinwand-storybook.png", ROOM_DEPTH / 3.4, ROOM_HEIGHT / 3.4), roughness: 0.95 });
        const frameMat = new THREE.MeshStandardMaterial({ map: roomTex("wald-steinwand-storybook.png", 0.5, 0.6), roughness: 0.95 });
        // Deckenbalken + Fussleisten + Kaminsturz: dieselbe neue gemalte
        // Balkenholz-Textur, damit die Holz-Architektur eine Sprache spricht.
        const beamMat = new THREE.MeshStandardMaterial({ map: roomTex("wald-deckenbalken-storybook.png", 0.5, 3.0), roughness: 0.8 });
        const baseboardMat = new THREE.MeshStandardMaterial({ map: roomTex("wald-deckenbalken-storybook.png", 3.0, 0.4), roughness: 0.8 });
        const mantelMat = new THREE.MeshStandardMaterial({ map: roomTex("wald-deckenbalken-storybook.png", 1.6, 0.5), roughness: 0.8 });
        // Tuerblatt: gemalte Rundbogen-Tuer (Eisenbaender + Ring schon im
        // Bild), transparenter Rand -> alphaTest, damit nur die Tuerform
        // steht und dahinter die Steinlaibung sichtbar bleibt.
        const doorLeafMat = new THREE.MeshStandardMaterial({ map: roomTex("wald-tuer-storybook.png", 1, 1, true), transparent: true, alphaTest: 0.5, roughness: 0.75 });
        const firestoneMat = new THREE.MeshStandardMaterial({ map: roomTex("kamin-innenstein-storybook.png", 0.9, 0.9), roughness: 1 });

        const WALL_Z = -ROOM_DEPTH / 2;
        const HW = ROOM_WIDTH / 2;
        const CEILING_Y = 4.05;

        // --- Oeffnungen in der Rueckwand ---
        // Dreifachfenster mittig auf der Rueckwand (Zentrum x=0);
        // der Kamin sitzt rechts daneben mit ruhigem Steinpfeiler dazwischen.
        const WIN = { x1: -1.6, x2: 1.6, y1: 0.95, yTop: 3.5 };
        const winW = WIN.x2 - WIN.x1;
        const COLW = 0.16;
        const BAYW = (winW - 2 * COLW) / 3;
        const BAY_SPRING = WIN.yTop - BAYW / 2;
        const FP = { x1: 2.2, w: 1.4, y1: 0.05, yTop: 1.65 };
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
        const backWall = new THREE.Mesh(bwGeo, wallBackMat);
        backWall.position.z = WALL_Z;
        backWall.receiveShadow = true;
        group.add(backWall);

        // === Seitenwaende: tragen die Raumtiefe. Bewusst weit ueber die
        // 6-m-Raumtiefe hinaus nach vorne (an der Kamera vorbei) und nach
        // oben verlaengert, damit auf breiten Layouts kein leerer
        // Hintergrund links/rechts neben dem Raum sichtbar wird. Die
        // Moebelzone bleibt die inneren 8x6 m. ===
        const SIDE_D = 20, SIDE_H = 8;
        [-1, 1].forEach(function (s) {
            const sideMat = new THREE.MeshStandardMaterial({
                map: roomTex("wald-steinwand-storybook.png", SIDE_D / 3.4, SIDE_H / 3.4),
                roughness: 0.95
            });
            const w = new THREE.Mesh(new THREE.PlaneGeometry(SIDE_D, SIDE_H), sideMat);
            w.rotation.y = -s * Math.PI / 2;
            w.position.set(s * HW, SIDE_H / 2, WALL_Z + SIDE_D / 2 - 0.4);
            w.receiveShadow = true;
            group.add(w);
        });

        // === Decke: heller Putz (unbeleuchtet, damit sie nie dunkel
        // absäuft) + drei schlanke dunkle Balken als Akzent. Ebenfalls
        // grosszuegig ueber den Raum hinaus, damit die oberen Bildecken
        // auf breiten Layouts gedeckt sind. ===
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(ROOM_WIDTH + 22, ROOM_DEPTH + 34),
            new THREE.MeshBasicMaterial({ map: roomTex("wald-decke-kalkputz-storybook.png", 4.2, 5.4), color: 0xe3d4b4 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, CEILING_Y, 6);
        group.add(ceiling);

        // Deckenbalken wie im Konzeptbild: ein kraeftiger Querbalken als
        // "Sturz" ueber der offenen Vorderseite (BEAM_FRONT) + ein
        // Querbalken an der Rueckwand; dazwischen drei Laengsbalken, die
        // beidseitig sauber in einen Querbalken stossen - keine
        // schwebenden Enden. Kein Schatten (dekorativ). Neue Balkentextur.
        const BEAM_W = 0.16, BEAM_FRONT = 2.6;
        const beamTopY = CEILING_Y + 0.005;
        const beamRunLen = BEAM_FRONT - WALL_Z + BEAM_W;
        // Schmale Querbalken (flach an der Decke) vorne + an der Rueckwand
        // als sauberer Anschluss fuer die Laengsbalken.
        [WALL_Z + BEAM_W / 2, BEAM_FRONT].forEach(function (z) {
            const cross = new THREE.Mesh(new THREE.BoxGeometry(ROOM_WIDTH, 0.14, BEAM_W), beamMat);
            cross.position.set(0, beamTopY - 0.07, z);
            group.add(cross);
        });
        // Drei kraeftige Laengsbalken: Oberkante an der Decke, haengen als
        // sichtbare Balken ~0.32 herunter und stossen beidseitig in einen
        // Querbalken (vorne der Sturz, hinten die Rueckwand) - keine freien
        // Enden, in der Perspektive klar als Deckenbalken lesbar.
        [-2.5, 0, 2.5].forEach(function (x) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(BEAM_W, 0.32, beamRunLen), beamMat);
            beam.position.set(x, beamTopY - 0.16, WALL_Z + beamRunLen / 2);
            group.add(beam);
        });

        // === Durchgehende warme Holz-Fussleiste entlang aller Waende ===
        // Flach an der Wand (ragt nur ~0.04 in den Raum), Hoehe 0.16.
        // Segmentiert um Tuer und Kaminmaul herum, an den Ecken sauber
        // ueberlappt (kleiner Eckklotz deckt die Fuge).
        const SKIRT_H = 0.16, SKIRT_T = 0.05, sy = SKIRT_H / 2;
        function skirtRun(x1r, x2r, z, along) {
            // along "x": laeuft in X-Richtung an einer Wand mit Normale +/-Z
            // along "z": laeuft in Z-Richtung an einer Wand mit Normale +/-X
            const len = Math.abs(x2r - x1r);
            if (len < 0.02) { return; }
            const g = along === "x"
                ? new THREE.BoxGeometry(len, SKIRT_H, SKIRT_T)
                : new THREE.BoxGeometry(SKIRT_T, SKIRT_H, len);
            const m = new THREE.Mesh(g, baseboardMat);
            if (along === "x") { m.position.set((x1r + x2r) / 2, sy, z); }
            else { m.position.set(z, sy, (x1r + x2r) / 2); }
            m.receiveShadow = true;
            group.add(m);
        }
        // Rueckwand: links vom Kaminmaul und rechts davon (Kamin-Herdplatte
        // schliesst die Luecke sauber ab - keine rohe Kante).
        skirtRun(-HW + 0.02, FP.x1 - 0.04, WALL_Z + SKIRT_T / 2 + 0.01, "x");
        skirtRun(FP.x1 + FP.w + 0.04, HW - 0.02, WALL_Z + SKIRT_T / 2 + 0.01, "x");
        // Rechte Seitenwand: durchgehend ueber die sichtbare Tiefe.
        skirtRun(WALL_Z + 0.02, 6.0, HW - SKIRT_T / 2 - 0.01, "z");
        // Linke Seitenwand: um die buendige Tuer herum (Tuermitte z=-0.7).
        skirtRun(WALL_Z + 0.02, -0.7 - 0.72, -HW + SKIRT_T / 2 + 0.01, "z");
        skirtRun(-0.7 + 0.72, 6.0, -HW + SKIRT_T / 2 + 0.01, "z");
        // Eckkloetze decken die Stossfugen an den beiden hinteren Ecken.
        [-1, 1].forEach(function (s) {
            const corner = new THREE.Mesh(new THREE.BoxGeometry(SKIRT_T + 0.03, SKIRT_H, SKIRT_T + 0.03), baseboardMat);
            corner.position.set(s * (HW - SKIRT_T / 2 - 0.01), sy, WALL_Z + SKIRT_T / 2 + 0.01);
            group.add(corner);
        });

        // === GROSSES DREITEILIGES FENSTER ===
        const winCx = (WIN.x1 + WIN.x2) / 2;
        const winMidY = (WIN.y1 + WIN.yTop) / 2;

        // Waldsicht: das gemalte Waldpanorama HINTER der Rückwand, tief
        // genug zurückgesetzt, dass die drei Fensterbögen einen echten
        // Tiefenausschnitt zeigen. Eine zweite, näher stehende Kopie mit
        // leicht abgedunkeltem Vordergrund gibt zusätzlich Räumlichkeit.
        const panoTex = roomTex("waldpanorama-storybook.png", 1, 1, true);
        const viewFar = new THREE.Mesh(
            new THREE.PlaneGeometry(winW + 5.5, (winW + 5.5) * 941 / 1672),
            new THREE.MeshBasicMaterial({ map: panoTex })
        );
        viewFar.position.set(winCx, winMidY + 0.9, WALL_Z - 2.6);
        group.add(viewFar);

        const viewNear = new THREE.Mesh(
            new THREE.PlaneGeometry(winW + 2.6, (winW + 2.6) * 941 / 1672),
            new THREE.MeshBasicMaterial({ map: roomTex("waldpanorama-storybook.png", 1, 1, true), transparent: true, opacity: 0.55, color: 0xdfe8d4 })
        );
        viewNear.position.set(winCx, winMidY - 0.3, WALL_Z - 1.1);
        group.add(viewNear);

        // aeussere Laibung: dunkle Flaechen, laufen NACH HINTEN (nicht in den Raum)
        const outerMat = new THREE.MeshStandardMaterial({ map: roomTex("wald-steinwand-storybook.png", 0.6, 0.9), roughness: 1 });
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
        // Tuerblatt = eine gemalte Rundbogen-Tuer (wald-tuer-storybook.png,
        // Eisenbaender/Ring schon im Bild). Dahinter eine Steinflaeche, die
        // die Laibung fuellt -> kein weisser/schwarzer Spalt. Davor nur ein
        // schlanker Steinbogen + zwei schmale Pfosten. Als spaeterer
        // Uebergang in Flur/Aussenwelt vorbereitet (userData.portal).
        const doorGroup = new THREE.Group();
        const DW = 1.32, DR = DW / 2;
        const DH = DW * 1758 / 889;      // Bild-Seitenverhaeltnis der Tuer
        const DSPRING = DH - DR;

        const dBack = new THREE.Mesh(new THREE.PlaneGeometry(DW + 0.7, DH + 0.9), wallSideMat);
        dBack.position.set(0, DH / 2 - 0.15, -0.04);
        doorGroup.add(dBack);

        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), doorLeafMat);
        leaf.position.set(0, DH / 2, 0.0);
        leaf.castShadow = !isMobile;
        doorGroup.add(leaf);

        [-1, 1].forEach(function (s) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, DSPRING + 0.1, 0.12), frameMat);
            post.position.set(s * (DR + 0.05), (DSPRING + 0.1) / 2, 0.03);
            doorGroup.add(post);
        });
        const archBand = new THREE.Mesh(new THREE.TorusGeometry(DR + 0.05, 0.06, 6, 26, Math.PI), frameMat);
        archBand.position.set(0, DSPRING, 0.03);
        doorGroup.add(archBand);

        doorGroup.userData.portal = "flur"; // spaeterer Raumwechsel, jetzt inaktiv
        doorGroup.rotation.y = Math.PI / 2;
        doorGroup.position.set(-HW + 0.02, 0, -0.7);
        group.add(doorGroup);

        // === TIEF EINGELASSENER KAMIN (Rueckwand rechts) ===
        // Kaminmaul ist bereits als Rundbogen aus der Rueckwand
        // geschnitten. Dahinter eine echte, geschlossene Feuerkammer aus
        // dunklen Steinen (Rueckwand + Seiten + Rundbogen-Decke + Boden);
        // davor nur ein dezenter Holz-Mantel und eine flache Herdplatte.
        // Deutlich tiefere, fest eingebaute Feuerkammer: dunkle Innensteine
        // an Rueckwand, beiden Seiten, Rundbogen-Decke und Boden. Der Kamin
        // ist Architektur (Teil der Huelle), nicht verschiebbar.
        const CAV = 0.95;
        const cavH = FP.yTop - FP.y1;
        firestoneMat.side = THREE.DoubleSide;

        // Innenpaneele nur so hoch wie die Oeffnung (+ kleiner Ueberstand),
        // damit oben nichts ueber den Bogen hinausragt ("schwarze Reststaebe").
        const cavPanelH = cavH + 0.14;
        const cavPanelCy = FP.y1 + cavH / 2 + 0.02;
        const cavBack = new THREE.Mesh(new THREE.PlaneGeometry(FP.w + 0.2, cavPanelH), firestoneMat);
        cavBack.position.set(fpCx, cavPanelCy, WALL_Z - CAV);
        group.add(cavBack);
        [-1, 1].forEach(function (s) {
            const side = new THREE.Mesh(new THREE.PlaneGeometry(CAV + 0.1, cavPanelH), firestoneMat);
            side.rotation.y = s * Math.PI / 2;
            side.position.set(fpCx + s * (FP.w / 2 - 0.01), cavPanelCy, WALL_Z - CAV / 2);
            side.receiveShadow = true;
            group.add(side);
        });
        // Decke der Kammer (Feuerraumstein, doppelseitig - kein heller
        // Spalt oben aus irgendeinem Kamerawinkel). Leicht schraeg nach
        // hinten abfallend, damit die Tiefe der Nische lesbar ist.
        const cavTop = new THREE.Mesh(new THREE.PlaneGeometry(FP.w + 0.12, CAV + 0.12), firestoneMat);
        cavTop.rotation.x = Math.PI / 2 + 0.12;
        cavTop.position.set(fpCx, FP.yTop - 0.06, WALL_Z - CAV / 2);
        group.add(cavTop);
        const cavFloor = new THREE.Mesh(new THREE.PlaneGeometry(FP.w + 0.1, CAV + 0.05), firestoneMat);
        cavFloor.rotation.x = -Math.PI / 2;
        cavFloor.position.set(fpCx, FP.y1 + 0.012, WALL_Z - CAV / 2 + 0.02);
        cavFloor.receiveShadow = true;
        group.add(cavFloor);

        // Kraeftiger Holz-Sturzbalken: Unterkante greift ueber den
        // Bogenscheitel (kein Spalt zwischen Maul und Sturz), Oberkante
        // bildet ein flaches Sims.
        const MANT_H = 0.32;
        const fMantel = new THREE.Mesh(new THREE.BoxGeometry(FP.w + 0.64, MANT_H, 0.3), mantelMat);
        fMantel.position.set(fpCx, FP.yTop + MANT_H / 2 - 0.14, WALL_Z + 0.07);
        group.add(fMantel);

        // flache Steinstein-Herdplatte direkt vor der Öffnung (nur 0.05
        // hoch, ~0.4 tief - liegt vor der Wand, hinter der Möbelzone)
        const fHearth = new THREE.Mesh(new THREE.BoxGeometry(FP.w + 0.3, 0.05, 0.42), frameMat);
        fHearth.position.set(fpCx, 0.026, WALL_Z + 0.24);
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
            new THREE.PlaneGeometry(1.12, 0.62),
            new THREE.MeshBasicMaterial({
                map: makeEmberTexture(),
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        embers.rotation.x = -Math.PI / 2;
        embers.position.y = 0.014;
        group.add(embers);
        group.userData.embers = embers;

        // Drei gekreuzte, glimmende Holzscheite
        const logMat = new THREE.MeshStandardMaterial({
            color: 0x4a2f1c, roughness: 1,
            emissive: new THREE.Color(0x3a1600), emissiveIntensity: 0.5
        });
        const logGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.9, 8);
        [
            { ry: 0.32, p: [0, 0.075, 0.04] },
            { ry: -0.52, p: [0.01, 0.15, -0.05] },
            { ry: 0.9, p: [-0.05, 0.11, -0.01] }
        ].forEach(function (l) {
            const log = new THREE.Mesh(logGeo, logMat);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = l.ry;
            log.position.set(l.p[0], l.p[1], l.p[2]);
            group.add(log);
        });

        // Flammen-Ebenen (zur Kamera, +Z, gerichtet) - lebendiger: mehr
        // Zungen, groesser, kraeftigere Kernfarbe
        const flameTex = makeFlameTexture();
        const specs = [
            { x: 0.0, s: 1.18, c: 0xff6a1e },
            { x: -0.22, s: 0.82, c: 0xff9636 },
            { x: 0.24, s: 0.78, c: 0xff9636 },
            { x: -0.08, s: 0.6, c: 0xffc65e },
            { x: 0.12, s: 0.52, c: 0xffe39a },
            { x: 0.02, s: 0.34, c: 0xfff2cf }
        ];
        const flames = [];
        specs.forEach(function (spec, i) {
            const fl = new THREE.Mesh(
                new THREE.PlaneGeometry(0.56, 0.86),
                new THREE.MeshBasicMaterial({
                    map: flameTex,
                    color: spec.c,
                    transparent: true,
                    opacity: 0.88,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide
                })
            );
            fl.position.set(spec.x, 0.15 + spec.s * 0.24, 0.02 + i * 0.011);
            fl.scale.setScalar(spec.s);
            fl.userData.baseX = spec.x;
            fl.userData.s0 = spec.s;
            fl.userData.phase = i * 1.7;
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
