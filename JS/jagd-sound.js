/* Leichte prozedurale Spielsounds – keine externen Audiodateien. */
(function () {
    "use strict";

    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    var context = null;
    var master = null;
    var muted = localStorage.getItem("mirelon-jagd-sound-muted") === "1";

    function ensureContext() {
        if (!AudioCtx || muted) { return null; }
        if (!context) {
            context = new AudioCtx();
            master = context.createGain();
            master.gain.value = 0.34;
            master.connect(context.destination);
        }
        if (context.state === "suspended") { context.resume(); }
        return context;
    }

    function tone(frequency, delay, duration, type, volume, endFrequency) {
        var ctx = ensureContext();
        if (!ctx) { return; }
        var start = ctx.currentTime + (delay || 0);
        var oscillator = ctx.createOscillator();
        var gain = ctx.createGain();
        oscillator.type = type || "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        if (endFrequency) {
            oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
        }
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume || 0.12, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }

    function noise(delay, duration, volume) {
        var ctx = ensureContext();
        if (!ctx) { return; }
        var start = ctx.currentTime + (delay || 0);
        var length = Math.max(1, Math.floor(ctx.sampleRate * duration));
        var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
        var source = ctx.createBufferSource();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();
        filter.type = "bandpass";
        filter.frequency.value = 720;
        filter.Q.value = 0.8;
        gain.gain.value = volume || 0.08;
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start(start);
    }

    function roll() {
        for (var i = 0; i < 7; i++) {
            noise(i * 0.045, 0.035, 0.055 + i * 0.004);
            tone(190 + Math.random() * 90, i * 0.045, 0.04, "triangle", 0.045);
        }
        tone(135, 0.34, 0.13, "triangle", 0.11, 92);
    }

    function move() {
        tone(360, 0, 0.075, "sine", 0.075, 285);
        tone(165, 0.015, 0.085, "triangle", 0.045, 125);
    }

    function capture() {
        noise(0, 0.12, 0.12);
        tone(330, 0, 0.2, "sawtooth", 0.08, 92);
        tone(105, 0.06, 0.22, "triangle", 0.13, 64);
    }

    function win() {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (frequency, index) {
            tone(frequency, index * 0.13, 0.32, "sine", 0.11);
            tone(frequency / 2, index * 0.13, 0.26, "triangle", 0.045);
        });
    }

    function setMuted(value) {
        muted = Boolean(value);
        localStorage.setItem("mirelon-jagd-sound-muted", muted ? "1" : "0");
        if (!muted) {
            ensureContext();
            tone(660, 0, 0.09, "sine", 0.07);
        }
        return muted;
    }

    window.JagdSound = {
        roll: roll,
        move: move,
        capture: capture,
        win: win,
        isMuted: function () { return muted; },
        setMuted: setMuted
    };
})();
