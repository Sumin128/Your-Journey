(function () {
  'use strict';

  const puzzleApp = document.querySelector('.puzzle-app');

  const Sound = {
    ctx: null,
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    snap() {
      if (
        document.getElementById('audioToggle').dataset.enabled !== 'true'
      )
        return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        40,
        this.ctx.currentTime + 0.08
      );
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        this.ctx.currentTime + 0.08
      );
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    },
    win() {
      if (
        document.getElementById('audioToggle').dataset.enabled !== 'true'
      )
        return;
      this.init();
      if (!this.ctx) return;
      const notes = [261.63, 329.63, 392.0, 523.25];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + i * 0.1 + 0.3
        );
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.1);
        osc.stop(this.ctx.currentTime + i * 0.1 + 0.3);
      });
    },
  };

  let sourceImg = null;
  let sourceCanvas = null;
  let boardW = 0,
    boardH = 0;
  let rows = 0,
    cols = 0;
  let cellW = 0,
    cellH = 0;
  let pieces = [];
  let placedCount = 0;
  let zTop = 10;
  let activePiece = null;
  let hasWon = false;
  let puzzleStartTime = null;

  const fileInput = document.getElementById('fileInput');
  const uploadStatus = document.getElementById('uploadStatus');
  const thumbPrev = document.getElementById('thumbPreview');
  const thumbImg = document.getElementById('thumbImg');
  const pieceSlider = document.getElementById('pieceSlider');
  const pieceCountLabel = document.getElementById('pieceCountLabel');
  const gridLabel = document.getElementById('gridLabel');
  const buildBtn = document.getElementById('buildBtn');
  const resetBtn = document.getElementById('resetBtn');
  const boardEl = document.getElementById('board');
  const boardFrameEl = document.querySelector('.board-frame');
  const ghostImg = document.getElementById('ghostImg');
  const emptyMsg = document.getElementById('emptyMsg');
  const trayEl = document.getElementById('tray');
  const progressWrap = document.getElementById('progressWrap');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const vorlageBtn = document.getElementById('vorlageToggleBtn');
  const ghostBtn = document.getElementById('ghostToggleBtn');
  const vorlagePanel = document.getElementById('vorlagePanel');
  const vorlageImg = document.getElementById('vorlageImg');
  const winOverlay = document.getElementById('winOverlay');
  const winAgainBtn = document.getElementById('winAgainBtn');
  const winPieceCount = document.getElementById('winPieceCount');
  const nozzleSelect = document.getElementById('nozzleSelect');
  const themeSelect = document.getElementById('themeSelect');
  const difficultySelect = document.getElementById('difficultySelect');
  const audioToggle = document.getElementById('audioToggle');
  const edgeToggle = document.getElementById('edgeToggle');

  themeSelect.addEventListener('change', (e) => {
    puzzleApp.setAttribute('data-theme', e.target.value);
  });

  audioToggle.addEventListener('click', () => {
    const enabled = audioToggle.dataset.enabled !== 'true';
    audioToggle.dataset.enabled = String(enabled);
    audioToggle.textContent = enabled ? '🔊' : '🔇';
    audioToggle.classList.toggle('muted', !enabled);
    audioToggle.setAttribute('aria-pressed', String(enabled));
    audioToggle.setAttribute(
      'aria-label',
      enabled ? 'Audio-Effekte an' : 'Audio-Effekte aus'
    );
    audioToggle.title = enabled ? 'Audio-Effekte an' : 'Audio-Effekte aus';
  });

  edgeToggle.addEventListener('click', () => {
    const enabled = edgeToggle.dataset.enabled !== 'true';
    edgeToggle.dataset.enabled = String(enabled);
    edgeToggle.classList.toggle('muted', !enabled);
    edgeToggle.setAttribute('aria-pressed', String(enabled));
    edgeToggle.setAttribute(
      'aria-label',
      enabled ? 'Nur Randteile an' : 'Nur Randteile aus'
    );
    edgeToggle.title = enabled ? 'Nur Randteile an' : 'Nur Randteile aus';
    updateEdgeVisibility();
  });

  const maxImageSize = 6000;
  const maxRenderSize = 2500;

  const rejectImage = (message) => {
    fileInput.value = '';
    uploadStatus.textContent = message;
    uploadStatus.classList.remove('ready');
  };

  // Merkt sich, ob und welches der 5 festen Galerie-Bilder gerade als
  // Vorlage dient - fuer den Erfolg "Puzzle-Weltenbummler" (siehe
  // player.js). Bleibt null bei eigenem Upload oder einem eigenen,
  // in der Malstube gemalten Bild.
  let sourceGalleryLabel = null;

  // Gemeinsame Ladepipeline fuer ein Bild, egal ob es vom eigenen
  // Rechner hochgeladen (dataURL) oder aus der Galerie gewaehlt wurde
  // (lokaler Seiten-Pfad oder signierte Supabase-URL fuer eigene Bilder).
  function useImageAsSource(rawSrc, label, options) {
    const isGalleryImage = Boolean(options && options.isGalleryImage);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (
        img.naturalWidth > maxImageSize ||
        img.naturalHeight > maxImageSize
      ) {
        rejectImage('Das Bild darf höchstens 6000 × 6000 Pixel groß sein.');
        return;
      }

      let imageSource = rawSrc;
      const scale = Math.min(
        1,
        maxRenderSize / Math.max(img.naturalWidth, img.naturalHeight)
      );
      if (scale < 1) {
        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = Math.round(img.naturalWidth * scale);
        resizeCanvas.height = Math.round(img.naturalHeight * scale);
        resizeCanvas
          .getContext('2d')
          .drawImage(img, 0, 0, resizeCanvas.width, resizeCanvas.height);
        try {
          imageSource = resizeCanvas.toDataURL('image/png', 0.9);
        } catch (err) {
          rejectImage('Dieses Bild kann leider nicht verwendet werden.');
          return;
        }
      }

      const preparedImg = new Image();
      preparedImg.crossOrigin = 'anonymous';
      preparedImg.onload = () => {
        sourceImg = preparedImg;
        sourceGalleryLabel = isGalleryImage ? label : null;
        difficultySelect.disabled = false;
        nozzleSelect.disabled = false;
        thumbImg.src = imageSource;
        ghostImg.src = imageSource;
        thumbPrev.classList.add('show');
        vorlageImg.src = imageSource;
        buildBtn.disabled = false;
        uploadStatus.textContent = 'Bild bereit: ' + label;
        uploadStatus.classList.add('ready');
        updateGridLabel();
      };
      preparedImg.src = imageSource;
    };
    img.onerror = () => {
      rejectImage('Bild konnte nicht geladen werden.');
    };
    img.src = rawSrc;
  }

  window.MirelonPuzzle = {
    setSourceImage: useImageAsSource,
  };

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxFileSize = 10 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      rejectImage('Bitte JPG, PNG oder WEBP auswählen.');
      return;
    }
    if (file.size > maxFileSize) {
      rejectImage('Das Bild darf höchstens 10 MB groß sein.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      useImageAsSource(ev.target.result, file.name);
    };
    reader.readAsDataURL(file);
  });

  function computeGrid(count, aspect) {
    let best = null;
    for (let r = 2; r <= 16; r++) {
      if (count % r !== 0) continue;
      const c = count / r;
      if (c < 2) continue;
      const ratioDiff = Math.abs(c / r - aspect);
      if (!best || ratioDiff < best.ratioDiff) {
        best = { rows: r, cols: c, ratioDiff, total: count };
      }
    }
    return best;
  }

  function currentAspect() {
    return sourceImg ? sourceImg.naturalWidth / sourceImg.naturalHeight : 4 / 3;
  }

  function updateGridLabel() {
    const stageIndex = parseInt(pieceSlider.value, 10);
    const count = pieceStages[stageIndex] || pieceStages[0];
    pieceSlider.style.setProperty(
      '--fill',
      (stageIndex / (pieceStages.length - 1)) * 100 + '%'
    );
    const g = computeGrid(count, 1);
    pieceCountLabel.textContent = g.total + ' Teile';
    gridLabel.textContent = g.cols + ' × ' + g.rows;
  }
  const pieceStages = [12, 20, 35, 48, 63, 88, 108];
  pieceSlider.addEventListener('input', updateGridLabel);
  updateGridLabel();

  function appendEdge(cmds, P1, P2, sign, jitter, flat, forward) {
    if (flat) {
      const target = forward ? P2 : P1;
      cmds.push('L ' + target.x.toFixed(2) + ' ' + target.y.toFixed(2));
      return;
    }

    const type = nozzleSelect.value;
    const dx = P2.x - P1.x,
      dy = P2.y - P1.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len,
      uy = dy / len;
    const nx = -uy,
      ny = ux;

    const lerp = (t) => ({
      x: P1.x + ux * len * t,
      y: P1.y + uy * len * t,
    });
    const off = (pt, d) => ({ x: pt.x + nx * d, y: pt.y + ny * d });

    if (type === 'spiky') {
      const bulge = sign * len * 0.28 * jitter.amp;
      const Q0 = lerp(0.35);
      const Q1 = lerp(0.42);
      const Q2 = lerp(0.58);
      const Q3 = lerp(0.65);
      const Pk1 = off(Q1, bulge);
      const Pk2 = off(Q2, bulge);

      if (forward) {
        cmds.push(`L ${Q0.x.toFixed(2)} ${Q0.y.toFixed(2)}`);
        cmds.push(`L ${Pk1.x.toFixed(2)} ${Pk1.y.toFixed(2)}`);
        cmds.push(`L ${Pk2.x.toFixed(2)} ${Pk2.y.toFixed(2)}`);
        cmds.push(`L ${Q3.x.toFixed(2)} ${Q3.y.toFixed(2)}`);
        cmds.push(`L ${P2.x.toFixed(2)} ${P2.y.toFixed(2)}`);
      } else {
        cmds.push(`L ${Q3.x.toFixed(2)} ${Q3.y.toFixed(2)}`);
        cmds.push(`L ${Pk2.x.toFixed(2)} ${Pk2.y.toFixed(2)}`);
        cmds.push(`L ${Pk1.x.toFixed(2)} ${Pk1.y.toFixed(2)}`);
        cmds.push(`L ${Q0.x.toFixed(2)} ${Q0.y.toFixed(2)}`);
        cmds.push(`L ${P1.x.toFixed(2)} ${P1.y.toFixed(2)}`);
      }
    } else if (type === 'wavy') {
      const bulge = sign * len * 0.25 * jitter.amp;
      const cp1 = off(lerp(0.25), bulge);
      const cp2 = off(lerp(0.75), -bulge);

      if (forward) {
        cmds.push(
          `C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${P2.x.toFixed(2)} ${P2.y.toFixed(2)}`
        );
      } else {
        cmds.push(
          `C ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${P1.x.toFixed(2)} ${P1.y.toFixed(2)}`
        );
      }
    } else {
      const bulge = sign * len * 0.3 * jitter.amp;
      const posOff = jitter.posOff;
      const Q0 = lerp(0.35 + posOff);
      const Q3 = lerp(0.65 + posOff);
      const mid = lerp(0.5 + posOff);
      const Peak = off(mid, bulge);
      const cp1 = off(Q0, bulge * 0.72);
      const cp2 = {
        x: Peak.x - ux * len * 0.11,
        y: Peak.y - uy * len * 0.11,
      };
      const cp3 = {
        x: Peak.x + ux * len * 0.11,
        y: Peak.y + uy * len * 0.11,
      };
      const cp4 = off(Q3, bulge * 0.72);

      if (forward) {
        cmds.push(`L ${Q0.x.toFixed(2)} ${Q0.y.toFixed(2)}`);
        cmds.push(
          `C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${Peak.x.toFixed(2)} ${Peak.y.toFixed(2)}`
        );
        cmds.push(
          `C ${cp3.x.toFixed(2)} ${cp3.y.toFixed(2)}, ${cp4.x.toFixed(2)} ${cp4.y.toFixed(2)}, ${Q3.x.toFixed(2)} ${Q3.y.toFixed(2)}`
        );
        cmds.push(`L ${P2.x.toFixed(2)} ${P2.y.toFixed(2)}`);
      } else {
        cmds.push(`L ${Q3.x.toFixed(2)} ${Q3.y.toFixed(2)}`);
        cmds.push(
          `C ${cp4.x.toFixed(2)} ${cp4.y.toFixed(2)}, ${cp3.x.toFixed(2)} ${cp3.y.toFixed(2)}, ${Peak.x.toFixed(2)} ${Peak.y.toFixed(2)}`
        );
        cmds.push(
          `C ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${Q0.x.toFixed(2)} ${Q0.y.toFixed(2)}`
        );
        cmds.push(`L ${P1.x.toFixed(2)} ${P1.y.toFixed(2)}`);
      }
    }
  }

  function randJitter() {
    return {
      amp: 0.82 + Math.random() * 0.36,
      posOff: (Math.random() - 0.5) * 0.05,
    };
  }

  function buildPuzzle() {
    if (!sourceImg) return;
    puzzleStartTime = Date.now();
    difficultySelect.disabled = true;
    difficultySelect.title = 'Während eines laufenden Puzzles gesperrt';
    nozzleSelect.disabled = true;
    nozzleSelect.title = 'Während eines laufenden Puzzles gesperrt';
    const count =
      pieceStages[parseInt(pieceSlider.value, 10)] || pieceStages[0];
    const g = computeGrid(count, 1);
    rows = g.rows;
    cols = g.cols;

    const availW = Math.min(
      window.innerWidth - (window.innerWidth > 880 ? 360 : 56),
      760
    );
    boardW = Math.max(300, availW);
    boardH = boardW;
    cellW = boardW / cols;
    cellH = boardH / rows;

    sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = Math.round(boardW);
    sourceCanvas.height = Math.round(boardH);
    const sctx = sourceCanvas.getContext('2d');
    sctx.fillStyle = getComputedStyle(boardEl).backgroundColor;
    sctx.fillRect(0, 0, boardW, boardH);
    const imageAspect = currentAspect();
    let imageWidth = boardW;
    let imageHeight = boardW / imageAspect;
    if (imageHeight < boardH) {
      imageHeight = boardH;
      imageWidth = boardH * imageAspect;
    }
    const imageX = (boardW - imageWidth) / 2;
    const imageY = (boardH - imageHeight) / 2;
    sctx.drawImage(sourceImg, imageX, imageY, imageWidth, imageHeight);

    const tabsH = [];
    for (let r = 0; r < rows - 1; r++) {
      const row = [];
      for (let c = 0; c < cols; c++)
        row.push({
          sign: Math.random() < 0.5 ? 1 : -1,
          jitter: randJitter(),
        });
      tabsH.push(row);
    }
    const tabsV = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols - 1; c++)
        row.push({
          sign: Math.random() < 0.5 ? 1 : -1,
          jitter: randJitter(),
        });
      tabsV.push(row);
    }

    const oldPieces = document.querySelectorAll('canvas.piece');
    oldPieces.forEach((p) => p.remove());
    trayEl.innerHTML = '';
    pieces = [];
    placedCount = 0;
    hasWon = false;

    boardEl.style.width = boardW + 'px';
    boardEl.style.height = boardH + 'px';
    boardEl.style.aspectRatio = 'auto';
    boardFrameEl.style.width = boardW + 16 + 'px';
    boardFrameEl.style.height = boardH + 16 + 'px';

    // Bounding-box-Puffer für jedes Puzzleteil, damit die Nase (Tab)
    // niemals vom eigenen Canvas abgeschnitten wird.
    //
    // BUG (vorher): pad basierte auf Math.min(cellW, cellH). Bei nicht
    // quadratischen Zellen (z.B. mehr Spalten als Zeilen) ist eine
    // horizontale Kante aber cellW lang, die Nasenbreite skaliert mit
    // dieser Kantenlänge - der Puffer war dann kleiner als die
    // tatsächliche Nase und der Canvas-Clip hat die Spitze abgeschnitten
    // (die weißen/leeren Ecken, die auf den Screenshots zu sehen waren).
    //
    // FIX: Puffer an der LÄNGEREN Kante ausrichten (Math.max statt
    // Math.min), plus ein kleiner fester Zuschlag für die Kontur-Linie
    // (lineWidth 4 -> 2px Überstand je Seite).
    const maxBulgeFraction = 0.3 * 1.18; // größter Nasen-Faktor (classic) * max. Jitter-Amplitude
    const pad = Math.max(cellW, cellH) * (maxBulgeFraction + 0.05) + 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const cellPts = (r, c) => ({
      tl: { x: c * cellW, y: r * cellH },
      tr: { x: (c + 1) * cellW, y: r * cellH },
      br: { x: (c + 1) * cellW, y: (r + 1) * cellH },
      bl: { x: c * cellW, y: (r + 1) * cellH },
    });

    const allowRotation = difficultySelect.value === 'schwierig';
    const list = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const P = cellPts(r, c);
        const cmds = ['M ' + P.tl.x.toFixed(2) + ' ' + P.tl.y.toFixed(2)];

        if (r === 0)
          appendEdge(cmds, P.tl, P.tr, 0, { amp: 0, posOff: 0 }, true, true);
        else
          appendEdge(
            cmds,
            { x: c * cellW, y: r * cellH },
            { x: (c + 1) * cellW, y: r * cellH },
            tabsH[r - 1][c].sign,
            tabsH[r - 1][c].jitter,
            false,
            true
          );

        if (c === cols - 1)
          appendEdge(cmds, P.tr, P.br, 0, { amp: 0, posOff: 0 }, true, true);
        else
          appendEdge(
            cmds,
            { x: (c + 1) * cellW, y: r * cellH },
            { x: (c + 1) * cellW, y: (r + 1) * cellH },
            tabsV[r][c].sign,
            tabsV[r][c].jitter,
            false,
            true
          );

        if (r === rows - 1)
          appendEdge(cmds, P.br, P.bl, 0, { amp: 0, posOff: 0 }, true, true);
        else
          appendEdge(
            cmds,
            { x: c * cellW, y: (r + 1) * cellH },
            { x: (c + 1) * cellW, y: (r + 1) * cellH },
            tabsH[r][c].sign,
            tabsH[r][c].jitter,
            false,
            false
          );

        if (c === 0)
          appendEdge(cmds, P.bl, P.tl, 0, { amp: 0, posOff: 0 }, true, true);
        else
          appendEdge(
            cmds,
            { x: c * cellW, y: r * cellH },
            { x: c * cellW, y: (r + 1) * cellH },
            tabsV[r][c - 1].sign,
            tabsV[r][c - 1].jitter,
            false,
            false
          );

        cmds.push('Z');
        const dStr = cmds.join(' ');

        const bx0 = Math.max(0, c * cellW - pad);
        const by0 = Math.max(0, r * cellH - pad);
        const bx1 = Math.min(boardW, (c + 1) * cellW + pad);
        const by1 = Math.min(boardH, (r + 1) * cellH + pad);
        const bw = bx1 - bx0,
          bh = by1 - by0;

        const canvas = document.createElement('canvas');
        canvas.className = 'piece in-tray';
        canvas.width = Math.round(bw * dpr);
        canvas.height = Math.round(bh * dpr);
        canvas.style.width = bw + 'px';
        canvas.style.height = bh + 'px';
        canvas.style.filter = 'drop-shadow(0 3px 5px rgba(0,0,0,0.15))';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.save();
        ctx.translate(-bx0, -by0);
        const path = new Path2D(dStr);
        ctx.clip(path);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(-bx0, -by0);
        ctx.strokeStyle = 'rgba(30,20,10,0.38)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke(path);
        ctx.restore();

        const initialAngle = allowRotation
          ? Math.floor(Math.random() * 4) * 90
          : 0;

        const mx = Math.random() * 20 - 10 + 'px';
        const my = Math.random() * 20 - 10 + 'px';
        canvas.style.margin = `${my} ${mx}`;

        const piece = {
          r,
          c,
          el: canvas,
          bx0,
          by0,
          bw,
          bh,
          locked: false,
          angle: initialAngle,
        };

        canvas.style.transform = `rotate(${initialAngle}deg)`;

        pieces.push(piece);
        list.push(piece);
        attachDragAndRotate(piece);
      }
    }

    list.sort(() => Math.random() - 0.5);
    list.forEach((p) => trayEl.appendChild(p.el));
    layoutTrayPieces(list);
    updateEdgeVisibility();

    emptyMsg.style.display = 'none';
    resetBtn.style.display = 'block';
    vorlageBtn.style.display = 'flex';
    ghostBtn.style.display = 'flex';
    progressWrap.style.display = 'block';
    updateProgress();
  }

  function layoutTrayPieces(list) {
    const padding = 12;
    const width = Math.max(1, trayEl.clientWidth - padding * 2);
    const columns = Math.max(4, Math.ceil(Math.sqrt(list.length * 1.6)));
    const rowsInTray = Math.ceil(list.length / columns);
    const columnStep = width / columns;
    const largestPieceHeight = Math.max(
      ...list.map((piece) => piece.bh),
      80
    );
    const rowStep = Math.max(70, largestPieceHeight * 0.58);
    const trayHeight = Math.max(
      320,
      padding * 2 +
        largestPieceHeight +
        rowStep * Math.max(0, rowsInTray - 1)
    );
    trayEl.style.height = Math.ceil(trayHeight) + 'px';
    const height = trayHeight - padding * 2;

    list.forEach((piece, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const jitterX = (Math.random() - 0.5) * columnStep * 0.45;
      const jitterY = (Math.random() - 0.5) * rowStep * 0.45;
      const maxX = Math.max(padding, trayEl.clientWidth - piece.bw - padding);
      const maxY = Math.max(
        padding,
        trayEl.clientHeight - piece.bh - padding
      );
      const left = Math.min(
        maxX,
        Math.max(padding, padding + column * columnStep + jitterX)
      );
      const top = Math.min(
        maxY,
        Math.max(padding, padding + row * rowStep + jitterY)
      );

      piece.el.style.left = left + 'px';
      piece.el.style.top = top + 'px';
      piece.el.style.zIndex = index + 1;
    });
  }

  function updateEdgeVisibility() {
    const showOnlyEdges = edgeToggle.dataset.enabled === 'true';
    pieces.forEach((piece) => {
      const isEdge = isEdgePiece(piece);
      piece.el.style.display = showOnlyEdges && !isEdge ? 'none' : '';
    });
  }

  function isEdgePiece(piece) {
    return (
      piece.r === 0 ||
      piece.r === rows - 1 ||
      piece.c === 0 ||
      piece.c === cols - 1
    );
  }

  function revealInnerPiecesAfterEdges(piece) {
    if (edgeToggle.dataset.enabled !== 'true' || !isEdgePiece(piece)) return;
    const edgePieces = pieces.filter(isEdgePiece);
    const placedEdges = edgePieces.filter((edgePiece) => edgePiece.locked)
      .length;
    if (placedEdges !== edgePieces.length) return;

    edgeToggle.dataset.enabled = 'false';
    edgeToggle.classList.add('muted');
    edgeToggle.setAttribute('aria-pressed', 'false');
    edgeToggle.setAttribute('aria-label', 'Nur Randteile aus');
    edgeToggle.title = 'Nur Randteile aus';
    updateEdgeVisibility();
  }

  function attachDragAndRotate(piece) {
    const el = piece.el;
    let grabDX = 0,
      grabDY = 0;
    let isDragging = false;
    let originalParent = null;
    let originalNextSibling = null;
    let originalCssText = '';
    let originalClassName = '';

    function doRotate() {
      if (piece.locked || difficultySelect.value !== 'schwierig') return;
      piece.angle = (piece.angle + 90) % 360;
      el.style.transform = `rotate(${piece.angle}deg)`;
    }

    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      doRotate();
    });

    function onMove(e) {
      isDragging = true;
      el.style.left = e.clientX - grabDX + 'px';
      el.style.top = e.clientY - grabDY + 'px';
    }

    function onUp(e) {
      activePiece = null;
      el.removeEventListener('pointermove', onMove);
      el.classList.remove('dragging');
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (!isDragging) {
        el.style.cssText = originalCssText;
        el.className = originalClassName;
        if (originalParent) {
          originalParent.insertBefore(el, originalNextSibling);
        }
        return;
      }

      const boardRect = boardEl.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const relX = elRect.left - boardRect.left;
      const relY = elRect.top - boardRect.top;
      const dist = Math.hypot(relX - piece.bx0, relY - piece.by0);
      const tol = Math.min(cellW, cellH) * 0.45;

      if (dist < tol && piece.angle === 0) {
        el.className = 'piece';
        el.style.margin = '0';
        el.style.position = 'absolute';
        el.style.left = piece.bx0 + 'px';
        el.style.top = piece.by0 + 'px';
        el.style.zIndex = 1;
        el.style.cursor = 'default';
        el.style.transform = 'rotate(0deg)';
        boardEl.appendChild(el);
        piece.locked = true;
        placedCount++;

        Sound.snap();
        if (navigator.vibrate) navigator.vibrate(40);

        revealInnerPiecesAfterEdges(piece);
        updateProgress();

        el.style.transform = 'scale(1.05)';
        setTimeout(() => {
          el.style.transition = 'transform .15s ease';
          el.style.transform = 'scale(1)';
        }, 10);

        if (placedCount === pieces.length) onWin();
      } else {
        el.className = 'piece';
        el.style.margin = '0';
        el.style.position = 'absolute';
        el.style.left = relX + 'px';
        el.style.top = relY + 'px';
        el.style.zIndex = ++zTop;
        el.style.transform = `rotate(${piece.angle}deg)`;
        boardEl.appendChild(el);
      }
    }

    function onDown(e) {
      if (piece.locked) return;
      Sound.init();
      e.preventDefault();
      isDragging = false;
      activePiece = piece;
      originalParent = el.parentElement;
      originalNextSibling = el.nextSibling;
      originalCssText = el.style.cssText;
      originalClassName = el.className;

      const rect = el.getBoundingClientRect();
      grabDX = e.clientX - rect.left;
      grabDY = e.clientY - rect.top;

      el.style.position = 'fixed';
      el.style.left = rect.left + 'px';
      el.style.top = rect.top + 'px';
      el.style.zIndex = ++zTop;

      document.body.appendChild(el);
      el.classList.add('dragging');

      el.setPointerCapture(e.pointerId);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp, { once: true });
    }

    el.addEventListener('pointerdown', onDown);
  }

  window.addEventListener('keydown', (e) => {
    if (
      (e.key === 'r' || e.key === 'R') &&
      activePiece &&
      !activePiece.locked &&
      difficultySelect.value === 'schwierig'
    ) {
      activePiece.angle = (activePiece.angle + 90) % 360;
      activePiece.el.style.transform = `rotate(${activePiece.angle}deg)`;
    }
  });

  function updateProgress() {
    progressText.textContent = placedCount + ' / ' + pieces.length;
    progressFill.style.width = pieces.length
      ? (placedCount / pieces.length) * 100 + '%'
      : '0%';
  }

  // Traegt eine gewonnene Runde in die globale Bestenliste ein (Tabelle
  // puzzle_scores in Supabase, siehe JS/highscore.js). Nur fuer angemeldete
  // Nutzer moeglich - fuer Gaeste bleibt es beim rein lokalen Fortschritt
  // oben. Fehler hier duerfen das Spiel nie stoeren, daher nur ein
  // stilles catch.
  async function submitHighscore(pieceCount, difficulty, durationMs) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
    try {
      const sessionResult = await supabaseClient.auth.getSession();
      const session = sessionResult.data.session;
      if (!session) return;

      const playerName =
        (typeof player !== 'undefined' && player.name) || 'Abenteurer';

      await supabaseClient.from('puzzle_scores').insert({
        user_id: session.user.id,
        player_name: playerName,
        pieces: pieceCount,
        difficulty: difficulty,
        duration_ms: durationMs,
      });
    } catch (error) {
      // Bestenliste ist ein Bonus-Feature - darf das Spiel nicht stoeren.
    }
  }

  function recordPuzzleCompletion() {
    const durationMs = puzzleStartTime ? Date.now() - puzzleStartTime : null;
    const completion = {
      completedAt: new Date().toISOString(),
      difficulty: difficultySelect.value,
      pieces: pieces.length,
      durationMs: durationMs,
    };
    const storageKey = 'mirelonPuzzleCompletions';
    let completions = [];
    try {
      completions = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(completions)) completions = [];
      completions.push(completion);
      localStorage.setItem(storageKey, JSON.stringify(completions));
    } catch (error) {
      // Storage may be unavailable in private or restricted browser contexts.
    }
    if (durationMs) {
      submitHighscore(pieces.length, difficultySelect.value, durationMs);
    }
    if (typeof registerPuzzleCompletion === 'function') {
      registerPuzzleCompletion(sourceGalleryLabel);
    }
    window.dispatchEvent(
      new CustomEvent('mirelon:puzzle-completed', { detail: completion })
    );
  }

  function onWin() {
    if (hasWon) return;
    hasWon = true;
    difficultySelect.disabled = false;
    difficultySelect.title = 'Schwierigkeit für das nächste Puzzle wählen';
    nozzleSelect.disabled = false;
    nozzleSelect.title = 'Puzzle-Form für das nächste Puzzle wählen';
    winPieceCount.textContent = pieces.length;
    recordPuzzleCompletion();
    Sound.win();
    setTimeout(() => winOverlay.classList.add('show'), 300);
  }

  window.MirelonTest = {
    solvePuzzle() {
      if (!pieces.length) {
        console.warn('Erst ein Bild laden und das Puzzle erstellen.');
        return;
      }

      edgeToggle.dataset.enabled = 'false';
      updateEdgeVisibility();
      pieces.forEach((piece, index) => {
        piece.locked = true;
        piece.angle = 0;
        piece.el.className = 'piece snapped';
        piece.el.style.position = 'absolute';
        piece.el.style.margin = '0';
        piece.el.style.left = piece.bx0 + 'px';
        piece.el.style.top = piece.by0 + 'px';
        piece.el.style.zIndex = index + 1;
        piece.el.style.transform = 'rotate(0deg)';
        boardEl.appendChild(piece.el);
      });

      placedCount = pieces.length;
      updateProgress();
      winOverlay.classList.remove('show');
      console.info('Testansicht geladen: Alle Puzzle-Teile wurden platziert.');
    },
  };

  buildBtn.addEventListener('click', () => {
    winOverlay.classList.remove('show');
    buildPuzzle();
  });
  resetBtn.addEventListener('click', () => {
    winOverlay.classList.remove('show');
    buildPuzzle();
  });
  winAgainBtn.addEventListener('click', () => {
    winOverlay.classList.remove('show');
    buildPuzzle();
  });
  vorlageBtn.addEventListener('click', () => {
    vorlagePanel.classList.toggle('hidden');
  });
  ghostBtn.addEventListener('click', () => {
    ghostImg.classList.toggle('show');
  });
})();
