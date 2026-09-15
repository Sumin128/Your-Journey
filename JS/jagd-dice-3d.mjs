import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Wiederverwendbare 3D-Würfel-Fabrik: Mirelons Jagd UND Miros Startwurf
// teilen sich dasselbe Modell und dieselbe Logik (kein zweites GLB, keine
// zweite 3D-Erzeugung - siehe Bericht). Jede Instanz bekommt ihr eigenes
// Canvas/ihre eigene Szene, laedt aber dasselbe wuerfel.glb.
export function createDice3D(shell, resultBadge) {
    if (!shell) { return null; }
    const canvas = shell.querySelector("canvas");
    if (!canvas) { return null; }

    let pointerStart = null;
    let dragged = false;
    let suppressClickUntil = 0;
    shell.addEventListener("pointerdown", (event) => {
        pointerStart = { x: event.clientX, y: event.clientY };
        dragged = false;
    }, true);
    shell.addEventListener("pointermove", (event) => {
        if (!pointerStart) { return; }
        if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 7) {
            dragged = true;
        }
    }, true);
    shell.addEventListener("pointerup", () => {
        pointerStart = null;
        if (dragged) { suppressClickUntil = performance.now() + 250; }
    }, true);
    shell.addEventListener("pointercancel", () => {
        pointerStart = null;
        dragged = false;
        suppressClickUntil = 0;
    }, true);
    shell.addEventListener("click", (event) => {
        if (performance.now() < suppressClickUntil) {
            event.preventDefault();
            event.stopImmediatePropagation();
            dragged = false;
            suppressClickUntil = 0;
        }
    }, true);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(2.4, 2.15, 2.65);

    scene.add(new THREE.HemisphereLight(0xfff6da, 0x6b421f, 2.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 4, 4);
    scene.add(key);

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.7;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.15;

    let die = null;
    let rollState = null;
    const faceNormals = {
        1: new THREE.Vector3(0, 1, 0),
        2: new THREE.Vector3(1, 0, 0),
        3: new THREE.Vector3(0, 0, 1),
        4: new THREE.Vector3(0, 0, -1),
        5: new THREE.Vector3(-1, 0, 0),
        6: new THREE.Vector3(0, -1, 0)
    };

    function resize() {
        const width = Math.max(1, shell.clientWidth);
        const height = Math.max(1, shell.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function targetFor(value) {
        // Entscheidend ist die Seite, die der Spieler anschaut – nicht die
        // technisch nach oben zeigende Würfelseite. Dadurch stimmen sichtbare
        // Zahl und feststehendes Ergebnis auch bei der schrägen Kamera überein.
        const diePosition = new THREE.Vector3();
        if (die) { die.getWorldPosition(diePosition); }
        const towardCamera = camera.position.clone().sub(diePosition).normalize();
        return new THREE.Quaternion().setFromUnitVectors(faceNormals[value], towardCamera);
    }

    function roll(value) {
        if (resultBadge) { resultBadge.textContent = String(value); }
        if (!die) { return; }
        rollState = {
            start: performance.now(),
            target: targetFor(value),
            settleFrom: null
        };
    }

    new GLTFLoader().load(
        "images/mirelons-jagd/wuerfel.glb",
        (gltf) => {
            die = gltf.scene;
            die.scale.setScalar(1.28);
            die.rotation.set(0.3, 0.48, 0.08);
            scene.add(die);
        },
        undefined,
        () => shell.classList.add("is-fallback")
    );

    function frame(now) {
        resize();
        if (die && rollState) {
            const t = Math.min(1, (now - rollState.start) / 900);
            if (t < 0.7) {
                die.rotation.x += 0.23;
                die.rotation.y += 0.31;
                die.rotation.z += 0.17;
            } else {
                if (!rollState.settleFrom) { rollState.settleFrom = die.quaternion.clone(); }
                const settle = (t - 0.7) / 0.3;
                const eased = 1 - Math.pow(1 - settle, 3);
                die.quaternion.slerpQuaternions(rollState.settleFrom, rollState.target, eased);
            }
            if (t >= 1) { rollState = null; }
        }
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }

    resize();
    requestAnimationFrame(frame);

    return { roll };
}

// Rückwärtskompatibler Auto-Start für Mirelons Jagd eigenen Würfel - das
// bestehende Markup/jagd-ui.js braucht dafür keine Anpassung.
const jagdShell = document.getElementById("jagd-dice-btn");
if (jagdShell) {
    window.JagdDice3D = createDice3D(jagdShell, document.getElementById("jagd-dice-face"));
}
