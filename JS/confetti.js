/* =====================================================
   KONFETTI
   Kleines, eigenständiges Konfetti-Overlay für Mirelon.
   Schwester von JS/fireworks.js - gleiche Struktur, gleicher
   Aufruf-Zeitpunkt (aus dem Inventar "Werfen", NACHDEM der
   Verbrauch bestätigt ist - bei Konten serverseitig über
   use_consumable_item("konfetti")).

       MirelonConfetti.play({ seconds: 8 })  -> Promise

   Feature-Spezifikation: docs/mein-schloss.md (Levelsystem)
   ===================================================== */

(function () {
    "use strict";

    var COLORS = [
        "#ff5964", "#ffd23f", "#7cf5a3", "#8bd3ff", "#c9b6ff",
        "#ff9ecd", "#ff8c42", "#d8ff9e", "#ffe5ec", "#a0e7e5"
    ];

    var running = false;
    var audioCtx = null;

    function soundOk() {
        return !(typeof isSoundOn === "function" && !isSoundOn());
    }

    /* kurzes, weiches "pop" beim Start - dieselbe AudioContext-Technik
       wie fireworks.js, nur höher und kürzer. */
    function pop() {
        if (!soundOk()) { return; }
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            var ctx = audioCtx;
            if (ctx.state === "suspended" && ctx.resume) { ctx.resume(); }
            var t = ctx.currentTime;
            var o = ctx.createOscillator();
            var g = ctx.createGain();
            o.type = "triangle";
            o.frequency.setValueAtTime(220, t);
            o.frequency.exponentialRampToValueAtTime(880, t + 0.12);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            o.connect(g);
            g.connect(ctx.destination);
            o.start(t);
            o.stop(t + 0.24);
        } catch (e) {
            /* egal */
        }
    }

    function play(opts) {
        opts = opts || {};
        var seconds = Math.max(3, Math.min(20, opts.seconds || 8));

        return new Promise(function (resolve) {
            if (running) { resolve(); return; }
            running = true;

            var overlay = document.createElement("div");
            overlay.id = "mirelon-confetti";
            overlay.innerHTML =
                '<canvas></canvas>' +
                '<button type="button" class="mc-skip">Fertig ✨</button>';
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

            var pieces = [];
            var startedAt = performance.now();
            var stopping = false;
            var rafId = null;

            function spawn(n, fromBurst) {
                for (var i = 0; i < n; i++) {
                    pieces.push({
                        x: fromBurst ? W / 2 : Math.random() * W,
                        y: fromBurst ? H * 0.35 : -20 - Math.random() * H * 0.3,
                        w: 6 + Math.random() * 7,
                        h: 8 + Math.random() * 8,
                        vx: fromBurst ? (Math.random() - 0.5) * 9 : (Math.random() - 0.5) * 2.2,
                        vy: fromBurst ? -(4 + Math.random() * 5) : 1.6 + Math.random() * 2.6,
                        rot: Math.random() * Math.PI,
                        vr: (Math.random() - 0.5) * 0.3,
                        color: COLORS[Math.floor(Math.random() * COLORS.length)],
                        sway: Math.random() * Math.PI * 2
                    });
                }
            }

            function frame(now) {
                var elapsed = (now - startedAt) / 1000;
                if (!stopping && elapsed > seconds) { stopping = true; }

                ctx.clearRect(0, 0, W, H);

                if (!stopping && pieces.length < 220 && Math.random() < 0.8) {
                    spawn(3 + Math.floor(Math.random() * 4));
                }

                for (var i = pieces.length - 1; i >= 0; i--) {
                    var p = pieces[i];
                    p.sway += 0.08;
                    p.x += p.vx + Math.sin(p.sway) * 0.8;
                    p.y += p.vy;
                    p.vy += 0.04;
                    p.vy *= 0.995;
                    p.rot += p.vr;

                    if (p.y > H + 30) { pieces.splice(i, 1); continue; }

                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = 0.95;
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                    ctx.restore();
                }
                ctx.globalAlpha = 1;

                if (stopping && pieces.length === 0) {
                    finish();
                    return;
                }
                rafId = requestAnimationFrame(frame);
            }

            function finish() {
                if (rafId) { cancelAnimationFrame(rafId); }
                window.removeEventListener("resize", resize);
                overlay.classList.add("mc-out");
                setTimeout(function () {
                    overlay.remove();
                    running = false;
                    resolve();
                }, 450);
            }

            overlay.querySelector(".mc-skip").addEventListener("click", function () {
                stopping = true;
                pieces.length = 0;
            });

            pop();
            spawn(60, true);
            spawn(40);
            rafId = requestAnimationFrame(frame);
        });
    }

    window.MirelonConfetti = { play: play };

    // Vorschau: eine beliebige Seite mit  #konfetti-test  aufrufen
    if (location.hash === "#konfetti-test") {
        setTimeout(function () { play({ seconds: 8 }); }, 400);
    }

})();
