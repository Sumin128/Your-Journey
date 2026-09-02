/* =====================================================
   FEUERWERK
   Kleines, eigenständiges Feuerwerks-Overlay für Mirelon.
   Keine externen Abhängigkeiten. Wird aus dem Inventar
   ("Zünden") aufgerufen, nachdem der Verbrauch bestätigt
   ist (bei Konten serverseitig über use_consumable_item).

       MirelonFireworks.play({ seconds: 12 })  -> Promise

   Feature-Spezifikation: docs/zauber-gefaehrte.md
   ===================================================== */

(function () {
    "use strict";

    var PALETTES = [
        ["#ff5964", "#ffd6a5", "#fff1a8"],
        ["#8bd3ff", "#c9b6ff", "#ffffff"],
        ["#7cf5a3", "#d8ff9e", "#fff4b8"],
        ["#ff9ecd", "#ffc8dd", "#ffe5ec"],
        ["#ffd23f", "#ff8c42", "#ff5964"]
    ];

    var running = false;
    var audioCtx = null;

    function soundOk() {
        return !(typeof isSoundOn === "function" && !isSoundOn());
    }

    function boom(delay, big) {
        if (!soundOk()) { return; }
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            var ctx = audioCtx;
            if (ctx.state === "suspended" && ctx.resume) { ctx.resume(); }
            var t = ctx.currentTime + (delay || 0);

            var noise = ctx.createBufferSource();
            var len = Math.floor(ctx.sampleRate * (big ? 0.5 : 0.3));
            var buf = ctx.createBuffer(1, len, ctx.sampleRate);
            var d = buf.getChannelData(0);
            for (var i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * (1 - i / len);
            }
            noise.buffer = buf;
            var lp = ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.setValueAtTime(big ? 900 : 1400, t);
            lp.frequency.exponentialRampToValueAtTime(120, t + (big ? 0.5 : 0.3));
            var g = ctx.createGain();
            g.gain.setValueAtTime(big ? 0.5 : 0.3, t);
            g.gain.exponentialRampToValueAtTime(0.01, t + (big ? 0.5 : 0.3));
            noise.connect(lp);
            lp.connect(g);
            g.connect(ctx.destination);
            noise.start(t);
            noise.stop(t + 0.55);
        } catch (e) {
            /* egal */
        }
    }

    function play(opts) {
        opts = opts || {};
        var seconds = Math.max(4, Math.min(30, opts.seconds || 12));

        return new Promise(function (resolve) {
            if (running) { resolve(); return; }
            running = true;

            var overlay = document.createElement("div");
            overlay.id = "mirelon-fireworks";
            overlay.innerHTML =
                '<canvas></canvas>' +
                '<button type="button" class="mf-skip">Fertig ✨</button>';
            document.body.appendChild(overlay);

            var canvas = overlay.querySelector("canvas");
            var ctx = canvas.getContext("2d");
            var W, H, dpr;

            function resize() {
                dpr = Math.min(2, window.devicePixelRatio || 1);
                W = canvas.clientWidth;
                H = canvas.clientHeight;
                canvas.width = W * dpr;
                canvas.height = H * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
            resize();
            window.addEventListener("resize", resize);

            var rockets = [];
            var sparks = [];
            var startedAt = performance.now();
            var lastLaunch = 0;
            var stopping = false;
            var rafId = null;

            function launch() {
                var pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
                rockets.push({
                    x: W * (0.15 + Math.random() * 0.7),
                    y: H,
                    vx: (Math.random() - 0.5) * 1.2,
                    vy: -(6.5 + Math.random() * 2.8),
                    pal: pal
                });
            }

            function burst(x, y, pal) {
                var n = 46 + Math.floor(Math.random() * 34);
                var speed = 2.6 + Math.random() * 2.2;
                boom(0, n > 66);
                for (var i = 0; i < n; i++) {
                    var a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
                    var s = speed * (0.55 + Math.random() * 0.7);
                    sparks.push({
                        x: x, y: y,
                        vx: Math.cos(a) * s,
                        vy: Math.sin(a) * s,
                        life: 1,
                        decay: 0.008 + Math.random() * 0.012,
                        color: pal[Math.floor(Math.random() * pal.length)]
                    });
                }
            }

            function frame(now) {
                var elapsed = (now - startedAt) / 1000;
                if (!stopping && elapsed > seconds) { stopping = true; }

                ctx.globalCompositeOperation = "source-over";
                var sky = ctx.createLinearGradient(0, 0, 0, H);
                sky.addColorStop(0, "rgba(8,10,28,0.34)");
                sky.addColorStop(1, "rgba(20,14,34,0.34)");
                ctx.fillStyle = sky;
                ctx.fillRect(0, 0, W, H);

                ctx.globalCompositeOperation = "lighter";

                if (!stopping && now - lastLaunch > 260 + Math.random() * 320) {
                    launch();
                    if (Math.random() < 0.3) { launch(); }
                    lastLaunch = now;
                }

                for (var r = rockets.length - 1; r >= 0; r--) {
                    var ro = rockets[r];
                    ro.x += ro.vx;
                    ro.y += ro.vy;
                    ro.vy += 0.08;
                    ctx.fillStyle = ro.pal[2];
                    ctx.beginPath();
                    ctx.arc(ro.x, ro.y, 2.2, 0, Math.PI * 2);
                    ctx.fill();
                    if (ro.vy >= -0.6) {
                        burst(ro.x, ro.y, ro.pal);
                        rockets.splice(r, 1);
                    }
                }

                for (var i = sparks.length - 1; i >= 0; i--) {
                    var p = sparks[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.045;
                    p.vx *= 0.985;
                    p.vy *= 0.985;
                    p.life -= p.decay;
                    if (p.life <= 0) { sparks.splice(i, 1); continue; }
                    ctx.globalAlpha = Math.max(0, p.life);
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;

                if (stopping && rockets.length === 0 && sparks.length === 0) {
                    finish();
                    return;
                }
                rafId = requestAnimationFrame(frame);
            }

            function finish() {
                if (rafId) { cancelAnimationFrame(rafId); }
                window.removeEventListener("resize", resize);
                overlay.classList.add("mf-out");
                setTimeout(function () {
                    overlay.remove();
                    running = false;
                    resolve();
                }, 500);
            }

            overlay.querySelector(".mf-skip").addEventListener("click", function () {
                stopping = true;
                rockets.length = 0;
                sparks.length = 0;
            });

            // erste Rakete sofort
            launch();
            rafId = requestAnimationFrame(frame);
        });
    }

    window.MirelonFireworks = { play: play };

    // Vorschau: eine beliebige Seite mit  #feuerwerk-test  aufrufen
    if (location.hash === "#feuerwerk-test") {
        setTimeout(function () { play({ seconds: 12 }); }, 400);
    }

})();
