/* =====================================================
   TESSA-ZAHLENHUEPFER.JS
   Rechenspiel für Tessas Hasenschule: Tessa hüpft über einen
   Zahlenweg, Karotten zeigen den Rechenweg, Blitzrunde mit
   Zeitdruck, Gartenfortschritt über Runden hinweg.

   Ursprünglich als eigenständiger Prototyp entwickelt und dort
   ausführlich getestet - siehe
   _preview/tessas-zahlenhuepfer/NOTIZEN.md für die vollständige
   Konzept-/Test-Historie. Diese Datei ist die reale Integration:
   - player.tessaZahlenhuepfer + savePlayer() statt localStorage
     (Default/Nachrüstung: JS/player.js, defaultTessaZahlenhuepfer()).
   - echte playCorrectSound()/playWrongSound() (JS/sounds.js).
   - echte mirelon:earn-coins/mirelon:earn-xp Events (siehe
     dispatchRoundRewards()) - die Reasons "zahlenhuepfer_uebung"/
     "zahlenhuepfer_blitz" sind auch in JS/level-data.js
     (mirelonXpFor) hinterlegt. Serverseitige Beträge/Cooldowns/
     erlaubte Reasons in Supabase ergänzt Codex separat.
   - Bewusst KEIN window.MirelonConfetti.play(): dieses Overlay wird
     im Projekt nur für seltene, große Momente (Level-up-Konsumgut)
     verwendet (einziger Aufrufer: JS/sidebar.js), nicht für häufige
     Mini-Erfolge wie "nächste Übungsstufe frei". Ein eigenes,
     leichtes DOM-Partikel-Konfetti (wie im Prototyp) passt besser
     zur Aufruf-Häufigkeit hier.
   ===================================================== */
(function(){
"use strict";

/* Einstieg für JS/eulenschule.js (gleiches Muster wie
   showSymbolduellIntro()/showMemoryDifficultySelect()). */
window.showZahlenhuepferIntro = function(){ showMenu(); };

/* Echte Mirelon-Illustrationen. */
const IMG_DIR = "images/tessa-zahlenhuepfer/";
const TESSA_IMG = {
  idle:  IMG_DIR+"tessa_idle.png",
  jump:  IMG_DIR+"tessa_jump.png",
  land:  IMG_DIR+"tessa_land.png",
  cheer: IMG_DIR+"tessa_cheer.png",
  oops:  IMG_DIR+"tessa_oops.png"
};
const CARROT_IMG = { normal: IMG_DIR+"carrot_normal.png", golden: IMG_DIR+"carrot_golden.png" };
/* 4 eigenständige Wachstumsstufen, alle mit eigenem Gemälde. */
const GARDEN_IMG = [
  IMG_DIR+"garden_stage1.png",
  IMG_DIR+"garden_stage2.png",
  IMG_DIR+"garden_stage2_blossoms.png",
  IMG_DIR+"garden_stage3.png"
];

function tessaImgTag(frame){ return '<img class="nl-bunny-sprite" src="'+TESSA_IMG[frame]+'" alt="Tessa">'; }
function setBunnyFrame(frame){
  const bunny = document.getElementById("zh-bunny");
  const img = bunny && bunny.querySelector("img");
  if(img) img.src = TESSA_IMG[frame];
}

/* Spielstand: player.tessaZahlenhuepfer (Default + Nachrüstung für
   alte Speicherstände in JS/player.js, createDefaultPlayer()/
   loadPlayer()). DATA() gibt das aktuelle Objekt live zurück statt
   es einmalig zu cachen - player selbst kann bei Login/Logout/
   Cloud-Pull komplett neu zugewiesen werden. */
function DATA(){ return player.tessaZahlenhuepfer; }

/* Zentrale Konstanten - zentral, leicht anpassbar. */
const MASTERY_RATIO = 0.75;        // Stufe gilt als gemeistert ab dieser Trefferquote
const PROBLEMS_DEFAULT = 8;        // Aufgaben je Übungsrunde
const GARDEN_CYCLE_SIZE = 24;                  // ein Garten-Zyklus dauert so viele richtige Antworten
const GARDEN_STAGE_THRESHOLDS = [8, 16, 24];   // 0-7 / 8-15 / 16-23 / ab 24 (fertig)
const BLITZ_MAX_PROBLEMS = 16;
const BLITZ_START_MS = 2000;
const BLITZ_MIN_MS = 750;
const BLITZ_STEP_MS = 60;          // Zeitfenster wird je Treffer kürzer
/* Belohnung über die vorhandenen, projektweiten Events - siehe
   dispatchRoundRewards(). Beträge hier sind nur die CLIENTSEITIGE,
   optimistische Anzeige (genau wie amount bei memory_* in
   JS/player.js) - die serverseitig verbindlichen Beträge/Cooldowns/
   erlaubten Reasons ergänzt Codex in Supabase. */
const REWARDS = {
  uebung: { coins:5, xp:20, reason:"zahlenhuepfer_uebung" },
  blitz:  { coins:8, xp:30, reason:"zahlenhuepfer_blitz" }
};
/* Mindestleistung für eine Blitz-Belohnung - ein sofortiger Timeout
   oder zwei schnelle Fehler dürfen nicht dieselbe volle Belohnung wie
   ein ausgespielter Lauf geben. Übung hat keine solche Schwelle: dort
   zählt "vollständig beendet" allein (siehe endRound()). */
const MIN_BLITZ_PROBLEMS = 8;
const MIN_BLITZ_RATIO = 0.5;
function newRoundId(){ return "zahlenhuepfer_"+Date.now()+"_"+Math.random().toString(36).slice(2,9); }

/* Belohnung ausschließlich für eine RUNDE, die diesen Punkt hier
   tatsächlich erreicht (siehe endRound()) - abgebrochene Runden
   und ein Seiten-Reload (G lebt nur im Speicher) erreichen ihn nie.
   G.rewardsGranted schützt zusätzlich gegen einen versehentlichen
   Doppel-Aufruf innerhalb derselben Runde. */
function dispatchRoundRewards(mode, roundId){
  if(G && G.rewardsGranted) return { coins:0, xp:0 };
  if(G) G.rewardsGranted = true;
  const cfg = REWARDS[mode];
  window.dispatchEvent(new CustomEvent("mirelon:earn-coins", {
    detail: { amount: cfg.coins, reason: cfg.reason }
  }));
  window.dispatchEvent(new CustomEvent("mirelon:earn-xp", {
    detail: { reason: cfg.reason, difficulty: "normal", roundId: roundId }
  }));
  return { coins: cfg.coins, xp: cfg.xp };
}

/* Zusätzliche v1-Features laut Konzept: */
const VERHUEPFER_MIN_STAGE = 4;    // "Verhüpfer"-Twist erst ab dieser Übungsstufe
const VERHUEPFER_CHANCE = 0.32;
const GOLDEN_CHANCE = 0.14;        // Chance je RICHTIGER Antwort auf eine goldene Bonus-Karotte
const GOLDEN_GARDEN_BONUS = 1;     // zusätzlicher Gartenfortschritt bei goldener Karotte
const HOP_STEP_MS = 480;           // Dauer je Einzelsprung in der Schritt-für-Schritt-Animation

/* ============================================================
   STUFEN-LEITER
   carrots: "always" = immer sichtbar, kein Umschalter
            "toggle-on"/"toggle-off" = Umschalter, Startzustand wie benannt
            "button" = nur per Hilfe-Knopf, blendet bei jeder neuen
                       Aufgabe wieder aus (bewusste Hürde ab Stufe 4)
   ============================================================ */
const STAGES = {
  1: { icon:"➕", short:"Plus bis 5",              range:5,  ops:["+"],      carrots:"always" },
  2: { icon:"➕", short:"Plus bis 10",             range:10, ops:["+"],      carrots:"toggle-on" },
  3: { icon:"➕➖", short:"Plus & Minus bis 10",     range:10, ops:["+","-"],  carrots:"toggle-off" },
  4: { icon:"🔀", short:"Plus & Minus bis 20",      range:20, ops:["+","-"],  carrots:"button" },
  5: { icon:"🔟", short:"Zehnerübergang bis 20",    range:20, ops:["tens"],   carrots:"button" }
};

function randomInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function rnd(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function chance(p){ return Math.random() < p; }
function shuffled(values){
  const copy = values.slice();
  for(let i=copy.length-1;i>0;i-=1){
    const j = randomInt(0,i);
    const t = copy[i]; copy[i]=copy[j]; copy[j]=t;
  }
  return copy;
}

/* Eine Aufgabe {a,b,op,c,range} erzeugen. op ist "+" oder "-".
   Zehnerübergang (Stufe 5) erzwingt gezielt eine Überquerung von 10. */
function tenCrossAdd(){
  const a = randomInt(1,9);
  const minB = Math.max(1, 10-a);
  const maxB = 20-a;
  if(minB > maxB) return tenCrossAdd();
  const b = randomInt(minB, maxB);
  return { a, b, op:"+", c:a+b, range:20 };
}
function tenCrossSub(){
  const a = randomInt(11,20);
  const bMin = Math.max(1, a-9);
  const bMax = a;
  if(bMin > bMax) return tenCrossSub();
  const b = randomInt(bMin, bMax);
  return { a, b, op:"-", c:a-b, range:20 };
}
function generateProblem(stageNum){
  const stage = STAGES[stageNum];
  if(stage.ops[0] === "tens"){
    return chance(0.5) ? tenCrossAdd() : tenCrossSub();
  }
  const op = rnd(stage.ops);
  const range = stage.range;
  if(op === "+"){
    const a = randomInt(0, range-1);
    const b = randomInt(1, range-a);
    return { a, b, op:"+", c:a+b, range };
  }
  const a = randomInt(1, range);
  const b = randomInt(1, a);
  return { a, b, op:"-", c:a-b, range };
}

/* Blitzrunde: Aufgabe aus dem Pool bereits freigeschalteter Stufen. */
function generateBlitzProblem(pool){
  const stageNum = rnd(pool);
  return generateProblem(stageNum);
}

/* "Verhüpfer"-Twist: Tessa behauptet, an einer FALSCHEN Stelle zu
   landen - das Kind muss den Fehler erkennen und die richtige Zahl
   antippen (die Antwortprüfung bleibt unverändert gegen problem.c). */
function pickWrongClaim(problem){
  const options = [];
  for(let d=1; d<=3; d+=1){
    if(problem.c-d >= 0) options.push(problem.c-d);
    if(problem.c+d <= problem.range) options.push(problem.c+d);
  }
  return options.length ? rnd(options) : (problem.c === 0 ? 1 : problem.c-1);
}

/* Antwort-Blasen für die Blitzrunde: die richtige Zahl + 2-3 nahe,
   eindeutige Ablenker im gültigen Zahlenraum. */
function buildBubbleOptions(problem){
  const values = new Set([problem.c]);
  const range = problem.range;
  let guard = 0;
  while(values.size < 4 && guard < 40){
    guard++;
    const delta = randomInt(1,4) * (chance(0.5)?1:-1);
    const candidate = problem.c + delta;
    if(candidate >= 0 && candidate <= range) values.add(candidate);
  }
  return shuffled(Array.from(values));
}

/* Verständliche Fehlerhilfe: "Du startest bei 3. Zwei Sprünge nach
   rechts bringen dich zuerst zur 4 und dann zur 5." */
const NUMBER_WORDS = ["null","ein","zwei","drei","vier","fünf","sechs","sieben","acht","neun","zehn"];
function stepsWord(n, dir){
  const word = NUMBER_WORDS[n] || String(n);
  if(n === 1) return "Ein Sprung nach "+dir;
  return word.charAt(0).toUpperCase()+word.slice(1)+" Sprünge nach "+dir;
}
function explainSteps(p){
  const dir = p.op === "-" ? "links" : "rechts";
  const d = p.op === "-" ? -1 : 1;
  const stops = [];
  let v = p.a;
  for(let i=0;i<p.b;i+=1){ v += d; stops.push(v); }
  let path;
  if(stops.length === 1){
    path = "bringt dich zur "+stops[0]+".";
  } else if(stops.length === 2){
    path = "bringen dich zuerst zur "+stops[0]+" und dann zur "+stops[1]+".";
  } else {
    const last = stops.pop();
    path = "bringen dich über "+stops.join(", ")+" schließlich zur "+last+".";
  }
  return "Du startest bei "+p.a+". "+stepsWord(p.b, dir)+" "+path;
}

/* Garten: abgeschlossene Wachstumszyklen statt einer unbegrenzt
   wachsenden Zahl. addGardenProgress() lässt den Zähler bei
   Überschreiten von GARDEN_CYCLE_SIZE umlaufen und zählt den
   abgeschlossenen Garten mit - der Rest wandert ins nächste Beet. */
function addGardenProgress(amount){
  const d = DATA();
  d.gardenPlants += amount;
  while(d.gardenPlants > GARDEN_CYCLE_SIZE){
    d.gardenPlants -= GARDEN_CYCLE_SIZE;
    d.gardensCompleted += 1;
  }
}
function gardenStageIndex(plants){
  if(plants >= GARDEN_STAGE_THRESHOLDS[2]) return 3;
  if(plants >= GARDEN_STAGE_THRESHOLDS[1]) return 2;
  if(plants >= GARDEN_STAGE_THRESHOLDS[0]) return 1;
  return 0;
}

/* Leichtes, eigenständiges DOM-Partikel-Konfetti für häufige kleine
   Erfolge (Stufenaufstieg, neuer Blitz-Bestwert) - siehe Datei-Kopf-
   Kommentar für die Begründung gegen window.MirelonConfetti.play(). */
function fireZhConfetti(){
  const pieces = ["🎉","✨","🥕","🌟","🎊"];
  for(let i=0;i<22;i+=1){
    const p = el("span","confetti-piece", rnd(pieces));
    p.style.left = randomInt(2,96)+"vw";
    p.style.animationDuration = (900+randomInt(0,700))+"ms";
    p.style.fontSize = (1+Math.random()*0.8)+"rem";
    document.body.appendChild(p);
    later(()=> p.remove(), 1700);
  }
}

/* ============================================================
   UI-GRUNDGERÜST
   ============================================================ */
const app = document.getElementById("zahlenhuepfer-app");

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html != null) n.innerHTML = html;
  return n;
}
function clearApp(){ app.innerHTML = ""; }

function backToHaseMenu(){
  stopAll();
  const section = document.getElementById("zahlenhuepfer-game");
  const menu = document.getElementById("hase-game-menu");
  if(section) section.hidden = true;
  if(menu) menu.hidden = false;
}

/* ============================================================
   MENÜ (Modus + Stufe)
   ============================================================ */
function showMenu(){
  stopAll();
  clearApp();
  const c = el("div","card");
  c.appendChild(el("h2","center","Was möchtest du üben?"));

  const modes = el("div","mode-list");

  const mUeb = el("button","mode-card");
  mUeb.innerHTML = '<span class="ic">🌱</span><span><span class="t">Übungsmodus</span><br>'+
    '<span class="d">Ohne Zeitdruck. Zahlenweg hüpfen und Stufen freischalten.</span></span>';
  mUeb.addEventListener("click", showStagePicker);
  modes.appendChild(mUeb);

  const mBlitz = el("button","mode-card");
  const locked = !DATA().blitzrundeUnlocked;
  mBlitz.disabled = locked;
  mBlitz.innerHTML = '<span class="ic">⚡</span><span><span class="t">Blitzrunde</span><br>'+
    '<span class="d">Kopfrechnen-Sprint mit Zeitfenster und Kombo.</span></span>'+
    (locked ? '<span class="lock">🔒 ab Stufe 4 gemeistert</span>' : '<span class="lock">Best: '+DATA().bestScore.blitzrunde+'</span>');
  mBlitz.addEventListener("click", ()=> startBlitz());
  modes.appendChild(mBlitz);

  c.appendChild(modes);
  app.appendChild(c);
  app.appendChild(renderGardenCard());

  const back = el("button","btn btn--ghost btn--wide","← Spiel verlassen");
  back.style.marginTop = "4px";
  back.addEventListener("click", backToHaseMenu);
  app.appendChild(back);
}

/* Sichtbarer Fortschritt ÜBER Runden hinweg (persistiert in
   player.tessaZahlenhuepfer, wächst mit jeder richtigen Antwort egal
   in welchem Modus/welcher Stufe). Abgeschlossene Wachstumszyklen
   statt einer unbegrenzten Zahl: siehe addGardenProgress()/
   gardenStageIndex(). */
const GARDEN_STAGE_CAPTIONS = [
  "Das Beet wird vorbereitet.",
  "Die ersten Keimlinge zeigen sich.",
  "Blüten und erste Karotten wachsen heran.",
  "Ein fertiger, üppiger Garten!"
];
function renderGardenCard(prevStageIdx){
  const c = el("div","card garden-card center");
  c.appendChild(el("h2","center","🌻 Tessas Garten"));
  const row = el("div","garden-row");
  const stageIdx = gardenStageIndex(DATA().gardenPlants);
  row.innerHTML = '<img src="'+GARDEN_IMG[stageIdx]+'" alt="Tessas Gartenbeet">';
  if(prevStageIdx != null && stageIdx > prevStageIdx) row.classList.add("garden-grow-flash");
  c.appendChild(row);
  c.appendChild(el("p","garden-caption", GARDEN_STAGE_CAPTIONS[stageIdx]+" ("+DATA().gardenPlants+"/"+GARDEN_CYCLE_SIZE+")"));
  if(DATA().gardensCompleted > 0){
    c.appendChild(el("p","garden-badges", "🏅 "+DATA().gardensCompleted+" abgeschlossene"+(DATA().gardensCompleted===1?"r Garten":" Gärten")));
  }
  return c;
}

function showStagePicker(){
  clearApp();
  const c = el("div","card");
  c.appendChild(el("h2","center","Übungsmodus – welche Stufe?"));
  c.appendChild(el("p","center","Best-Punktzahl Übung: <b>"+DATA().bestScore.uebung+"</b>"));

  // Stufenauswahl als kleiner Hüpf-Pfad statt Liste: Tessa sitzt auf
  // der höchsten freigeschalteten Stufe, jede Station ist antippbar.
  const pathWrap = el("div","stage-path");
  pathWrap.appendChild(el("div","path-line"));
  const bunny = el("div","path-bunny",tessaImgTag("idle"));
  for(let s=1;s<=5;s++){
    const pct = ((s-1)/4*100).toFixed(2)+"%";
    const b = el("button","stage-stop"+(DATA().stageWins[s]>=1?" is-done":"")+(s===DATA().unlockedStage?" is-current":""));
    b.style.left = pct;
    b.disabled = s > DATA().unlockedStage;
    b.innerHTML = STAGES[s].icon+'<small>'+STAGES[s].short+(s>DATA().unlockedStage ? " 🔒" : "")+'</small>';
    b.addEventListener("click", ()=> startUebung(s));
    pathWrap.appendChild(b);
    if(s === DATA().unlockedStage) bunny.style.left = pct;
  }
  pathWrap.appendChild(bunny);
  const pathOuter = el("div","stage-path-outer");
  pathOuter.appendChild(pathWrap);
  c.appendChild(pathOuter);

  const back = el("button","btn btn--ghost","← Zurück");
  back.style.marginTop = "28px";
  back.addEventListener("click", showMenu);
  c.appendChild(back);
  app.appendChild(c);
}

/* ============================================================
   RUNDE (gemeinsame Basis für Übung + Blitz)
   ============================================================ */
let G = null;
let timers = [];
let rafId = null;
function later(fn, ms){ const t = setTimeout(fn, ms); timers.push(t); return t; }
function clearTimers(){ timers.forEach(clearTimeout); timers = []; }
function stopAll(){ clearTimers(); cancelAnimationFrame(rafId); G = null; }

/* ---------- ÜBUNGSMODUS ----------
   Keine Leben - falsche Antworten beenden die Runde nicht und kosten
   nichts, sie lösen nur die Erklär-Animation aus (siehe resolve()).
   Eine Stufe gilt stattdessen als gemeistert, wenn die Runde komplett
   gespielt UND die Trefferquote (MASTERY_RATIO) erreicht wurde. */
function startUebung(stage){
  stopAll();
  const stageDef = STAGES[stage];
  G = {
    mode:"uebung", stage, stageDef,
    total:PROBLEMS_DEFAULT, i:0, score:0, wrong:0, correctCount:0,
    streak:0, results:[], roundId:newRoundId(), rewardsGranted:false,
    gardenStageAtStart: gardenStageIndex(DATA().gardenPlants),
    showCarrots: stageDef.carrots === "always" || stageDef.carrots === "toggle-on"
  };
  renderRoundShell();
  showStageIntro();
}

function stageIntroText(stageNum){
  switch(stageNum){
    case 1: return "Tessa packt ihren Marktkorb und hüpft nach vorne! Tippe auf dem Zahlenweg auf die Zahl, bei der sie landet.";
    case 2: return "Weiter zum Markt, jetzt bis 10. Du kannst die Karotten oben jederzeit aus- und einblenden.";
    case 3: return "Manchmal muss Tessa auf dem Rückweg auch rückwärts hüpfen (Minus). Karotten gibt's nur, wenn du sie einschaltest.";
    case 4: return "Plus und Minus gemischt, bis 20. Karotten gibt es nur kurz über den Hilfe-Knopf - und pass auf, manchmal hüpft Tessa erst mal daneben!";
    case 5: return "Manchmal überspringt Tessa dabei die 10! Und manchmal hüpft sie absichtlich falsch - erkennst du es?";
  }
}

function showStageIntro(){
  const box = document.getElementById("zh-tessa");
  box.innerHTML = '<span class="fx">'+tessaImgTag("idle")+'</span><p>'+stageIntroText(G.stage)+'</p>';
  renderNumberline(null);
  const go = el("button","btn btn--wide","Los geht's →");
  go.style.marginTop = "10px";
  const holder = document.getElementById("zh-answers");
  holder.innerHTML = "";
  holder.appendChild(go);
  go.addEventListener("click", nextProblem);
  focusIfFocusLost(go);
}

/* ---------- BLITZRUNDE ---------- */
function startBlitz(){
  stopAll();
  const pool = [];
  for(let s=1;s<=Math.min(DATA().unlockedStage,5);s++) pool.push(s);
  G = {
    mode:"blitz", pool,
    total: BLITZ_MAX_PROBLEMS, i:0,
    lives:2, score:0, combo:1, wrong:0, correctCount:0,
    wrongStreak:0, results:[], roundId:newRoundId(), rewardsGranted:false,
    gardenStageAtStart: gardenStageIndex(DATA().gardenPlants),
    windowMs: BLITZ_START_MS,
    showCarrots:false, showLine:false
  };
  renderRoundShell();
  document.getElementById("zh-tessa").innerHTML =
    '<span class="fx">⚡</span><p>Kopfrechnen-Sprint! Tippe die richtige Zahl in der Blase. '+
    'Ein Fehler wird verziehen (🍃), dann ist Schluss.</p>';
  renderNumberline(null);
  document.getElementById("zh-line-outer").classList.add("hidden");
  const go = el("button","btn btn--wide","Blitz starten →");
  const holder = document.getElementById("zh-answers");
  holder.innerHTML = ""; holder.appendChild(go);
  go.addEventListener("click", nextProblem);
  focusIfFocusLost(go);
}

/* ---------- Rundengerüst rendern ---------- */
function renderRoundShell(){
  clearApp();
  const c = el("div","card");
  c.innerHTML =
    '<div class="hud">'+
      '<span class="lives" id="zh-lives"></span>'+
      '<span class="stage-badge" id="zh-stage-badge"></span>'+
      '<span class="score" id="zh-score"></span>'+
    '</div>'+
    '<div class="round-path-outer">'+
      '<div class="round-path" id="zh-roundpath">'+
        '<div class="round-path-line"></div>'+
        '<div class="round-path-slots" id="zh-roundpath-slots"></div>'+
        '<div class="round-path-goal"></div>'+
      '</div>'+
    '</div>'+
    '<div class="bonus-line" id="zh-bonus"></div>'+
    '<div class="tessa-line" id="zh-tessa"></div>'+
    '<div class="explain-box hidden" id="zh-explain"></div>'+
    '<div class="problem-line" id="zh-problem"></div>'+
    '<div class="timerbar hide" id="zh-timer"><i></i></div>'+
    '<div class="carrot-toolbar" id="zh-carrot-toolbar"></div>'+
    '<div class="carrot-row hidden" id="zh-carrots"></div>'+
    '<div class="carrot-toolbar hidden" id="zh-line-toolbar">'+
      '<button id="zh-line-toggle-btn">🔢 Zahlenweg zeigen</button>'+
    '</div>'+
    '<div class="numberline-outer" id="zh-line-outer">'+
      '<div class="numberline-wrap" id="zh-line-wrap">'+
        '<div class="numberline" id="zh-line"></div>'+
        '<div class="nl-moss" id="zh-moss-l"></div>'+
        '<div class="nl-moss right" id="zh-moss-r"></div>'+
        '<div class="nl-bunny-shadow" id="zh-bunny-shadow"></div>'+
        '<div class="nl-bunny" id="zh-bunny">'+tessaImgTag("idle")+'</div>'+
      '</div>'+
    '</div>'+
    '<div id="zh-answers"></div>'+
    '<button class="btn btn--ghost" id="zh-quit" style="margin-top:10px">Runde abbrechen</button>';
  app.appendChild(c);
  document.getElementById("zh-quit").addEventListener("click", ()=>{ stopAll(); showMenu(); });
  document.getElementById("zh-line-toolbar").classList.toggle("hidden", G.mode !== "blitz");
  const lineToggleBtn = document.getElementById("zh-line-toggle-btn");
  lineToggleBtn.addEventListener("click", function(){
    G.showLine = !G.showLine;
    lineToggleBtn.textContent = "🔢 Zahlenweg " + (G.showLine ? "ausblenden" : "zeigen");
    document.getElementById("zh-line-outer").classList.toggle("hidden", !G.showLine);
  });
  // Herzen/Leben nur in der Blitzrunde - Übungsmodus hat ausdrücklich
  // keinen Fehlerdruck.
  document.getElementById("zh-lives").classList.toggle("hidden", G.mode !== "blitz");
  renderCarrotToolbar();
  renderBonusLine();
  updateHud();
}

function updateHud(){
  if(!G) return;
  if(G.mode === "blitz"){
    document.getElementById("zh-lives").textContent = G.lives >= 2 ? "🍃 Schutz" : "🥀 kein Schutz";
  }
  const badge = document.getElementById("zh-stage-badge");
  badge.textContent = G.mode === "blitz" ? "⚡ Blitzrunde" : STAGES[G.stage].icon+" "+STAGES[G.stage].short;
  document.getElementById("zh-score").innerHTML =
    "★ " + G.score + (G.mode==="blitz" ? ' <span class="combo">x'+G.combo+'</span>' : "");
  renderRoundPath();
}

/* Rundenweg = zugleich die Korbplätze: jede ABGESCHLOSSENE Aufgabe
   rückt einen Abschnitt vor, richtige Antworten füllen ihren Platz
   mit einer Karotte, falsche mit einem neutralen Punkt - ohne jede
   Bestrafung. */
function renderRoundPath(){
  const box = document.getElementById("zh-roundpath-slots");
  if(!box) return;
  box.innerHTML = "";
  for(let i=0;i<G.total;i+=1){
    const done = i < G.results.length;
    const isCurrent = i === G.results.length && !G.answered;
    const cls = "round-path-slot"+(done ? (G.results[i] ? " is-correct" : " is-wrong") : "")+(isCurrent ? " is-current" : "");
    const slot = el("div", cls);
    if(done && G.results[i]) slot.innerHTML = '<img src="'+CARROT_IMG.normal+'" alt="">';
    box.appendChild(slot);
  }
}

function renderBonusLine(){
  const box = document.getElementById("zh-bonus");
  if(!box) return;
  box.innerHTML = '<img src="'+CARROT_IMG.golden+'" alt=""> '+DATA().goldenCarrots+' goldene '+(DATA().goldenCarrots===1?"Karotte":"Karotten")+' gefunden';
}

/* ---------- Karotten-Werkzeugleiste ---------- */
function renderCarrotToolbar(){
  const bar = document.getElementById("zh-carrot-toolbar");
  bar.innerHTML = "";
  if(G.mode === "blitz"){
    const btn = el("button", G.showCarrots ? "is-on" : "", "🥕 Karotten "+(G.showCarrots?"an":"aus"));
    btn.addEventListener("click", ()=>{ G.showCarrots = !G.showCarrots; renderCarrotToolbar(); renderCarrots(); });
    bar.appendChild(btn);
    return;
  }
  const mode = G.stageDef.carrots;
  if(mode === "always"){
    bar.appendChild(el("span","","🥕 Karotten helfen dir beim Zählen"));
    return;
  }
  if(mode === "toggle-on" || mode === "toggle-off"){
    const btn = el("button", G.showCarrots ? "is-on" : "", "🥕 Karotten "+(G.showCarrots?"an":"aus"));
    btn.addEventListener("click", ()=>{ G.showCarrots = !G.showCarrots; renderCarrotToolbar(); renderCarrots(); });
    bar.appendChild(btn);
    return;
  }
  // "button": nur kurzzeitige Hilfe, blendet bei der nächsten Aufgabe wieder aus
  const btn = el("button", G.showCarrots ? "is-on" : "", "🥕 Hilfe zeigen");
  btn.addEventListener("click", ()=>{ G.showCarrots = true; renderCarrotToolbar(); renderCarrots(); });
  bar.appendChild(btn);
}

/* Karotten zeigen den RECHENWEG, nicht nur das fertige Ergebnis: die
   Ausgangsmenge (p.a) steht sofort da, die Veränderung (p.b) wird von
   runSolutionDemo() Schritt für Schritt ergänzt/entfernt - siehe
   dort. Diese Funktion rendert nur den Ausgangszustand. */
function makeCarrotEl(extraCls){
  const img = document.createElement("img");
  img.src = CARROT_IMG.normal;
  img.alt = "Karotte";
  if(extraCls) img.className = extraCls;
  return img;
}
function renderCarrots(){
  const row = document.getElementById("zh-carrots");
  if(!G.current || !G.showCarrots){
    row.classList.add("hidden");
    row.innerHTML = "";
    return;
  }
  row.classList.remove("hidden");
  row.innerHTML = "";
  const p = G.current;
  for(let i=0;i<p.a;i+=1) row.appendChild(makeCarrotEl());
}

/* ---------- Aufgabenzeile + Zahlenweg ---------- */
function renderProblemLine(p){
  const box = document.getElementById("zh-problem");
  const opCls = p.op === "+" ? "op--plus" : "op--minus";
  const opTxt = p.op === "+" ? "+ →" : "− ←";
  box.innerHTML =
    '<span>'+p.a+'</span>'+
    '<span class="op '+opCls+'">'+opTxt+'</span>'+
    '<span>'+p.b+'</span>'+
    '<span class="eq">=</span>'+
    '<span class="q">?</span>';
}

/* Setzt Tessa UND ihren (eigenständigen, am Boden bleibenden)
   Schatten auf dieselbe Position. */
function positionBunny(value, range){
  const pct = (value/range*100).toFixed(3)+"%";
  document.getElementById("zh-bunny").style.left = pct;
  document.getElementById("zh-bunny-shadow").style.left = pct;
}

function renderNumberline(p, decorative){
  const line = document.getElementById("zh-line");
  const wrap = document.getElementById("zh-line-wrap");
  line.innerHTML = "";
  if(!p){
    wrap.style.width = "100%";
    document.getElementById("zh-bunny").style.left = "50%";
    document.getElementById("zh-bunny-shadow").style.left = "50%";
    setBunnyFrame("idle");
    return;
  }
  const range = p.range;
  // Trittsteine mind. 44x44px Tippfläche, unabhängig vom Zahlenraum.
  const dotSize = 44;
  // Trittsteine sitzen relativ zur (um je 44px eingerückten)
  // .numberline - die Randeinrückung muss hier mit eingerechnet
  // werden, sonst wären die Abstände zwischen den Steinen zu eng.
  wrap.style.width = Math.max(320, range * (dotSize+10) + 88) + "px";
  for(let i=0;i<=range;i+=1){
    const pct = (i/range*100).toFixed(3)+"%";
    const dot = el("button","nl-dot", String(i));
    dot.style.left = pct;
    dot.dataset.value = String(i);
    if(decorative){
      // Blitzrunde: der Weg ist hier nur Sichthilfe, Antwort läuft
      // über die Zahlen-Blasen - Punkte sind bewusst nicht antippbar.
      dot.disabled = true;
      dot.style.pointerEvents = "none";
    } else {
      dot.addEventListener("click", ()=> onLineTap(i, dot));
    }
    line.appendChild(dot);
  }
  positionBunny(p.a, range);
}

/* ---------- Schritt-für-Schritt-Rechenweg ----------
   Ein einzelner Rechenschritt: Tessa hüpft eine Zahl weiter/zurück
   (Sprungbogen nur in der ABGESETZTEN .nl-bunny-sprite, siehe CSS -
   der Schatten in #zh-bunny-shadow bewegt sich nur horizontal mit,
   bleibt aber am Boden), das Zielfeld leuchtet kurz warm-golden auf. */
function hopOneStep(value, range){
  positionBunny(value, range);
  const bunny = document.getElementById("zh-bunny");
  bunny.classList.remove("is-hopping"); void bunny.offsetWidth; bunny.classList.add("is-hopping");
  const dot = document.querySelector('.nl-dot[data-value="'+value+'"]');
  if(dot){ dot.classList.remove("is-landing"); void dot.offsetWidth; dot.classList.add("is-landing"); }
}

/* Macht den kompletten Rechenweg einer Aufgabe einmal sichtbar vor:
   Ausgangsmenge steht sofort da, dann wird je Einzelschritt eine
   Karotte ergänzt/ausgegraut UND Tessa hüpft ein Feld weiter - erst
   danach ist das Ergebnis vollständig erklärt. withCarrots steuert,
   ob die Zählreihe mitläuft (nur wenn sie für die aktuelle Aufgabe/
   Stufe ohnehin sichtbar ist) - der räumliche Hüpfweg selbst läuft
   immer, auch als Erklärung nach einer falschen Antwort, unabhängig
   von der Karotten-Sichtbarkeit der Stufe. */
function runSolutionDemo(p, opts){
  opts = opts || {};
  const withCarrots = !!opts.withCarrots;
  if(withCarrots){
    const row = document.getElementById("zh-carrots");
    row.classList.remove("hidden");
    row.innerHTML = "";
    for(let i=0;i<p.a;i+=1) row.appendChild(makeCarrotEl());
  }
  const dir = p.op === "-" ? -1 : 1;
  let step = 0;
  function doStep(){
    if(!G){ return; } // Runde kann zwischenzeitlich abgebrochen worden sein
    if(step >= p.b){ if(opts.onDone) opts.onDone(); return; }
    step += 1;
    const val = p.a + dir*step;
    if(withCarrots){
      const row = document.getElementById("zh-carrots");
      if(p.op === "-"){
        const remaining = row.querySelectorAll("img:not(.is-removed)");
        const t = remaining[remaining.length-1];
        if(t) t.classList.add("is-removed");
      } else {
        row.appendChild(makeCarrotEl("is-added"));
      }
    }
    hopOneStep(val, p.range);
    later(doStep, HOP_STEP_MS);
  }
  later(doStep, withCarrots ? 480 : 60);
}

/* ---------- Blitz: Antwort-Blasen ---------- */
function renderBubbles(p){
  const holder = document.getElementById("zh-answers");
  holder.innerHTML = "";
  const opts = buildBubbleOptions(p);
  const grid = el("div","bubbles");
  opts.forEach(function(value){
    const b = el("button","bubble", String(value));
    b.addEventListener("click", ()=> onBubbleTap(value, b));
    grid.appendChild(b);
  });
  holder.appendChild(grid);
  focusIfFocusLost(grid.firstChild);
}

/* Bedienbarkeit: wird der gerade fokussierte Button entfernt (z.B.
   "Los geht's" nach dem Klick, oder die deaktivierten Antwort-Buttons
   der letzten Aufgabe), setzt der Browser den Fokus auf <body>
   zurück - ein nachfolgendes Tab überspringt dann in Chrome oft die
   NEU eingefügten, eigentlich als nächstes sinnvollen Elemente (z.B.
   den kompletten Zahlenweg), weil die Tab-Reihenfolge an der alten
   DOM-Position des entfernten Buttons weitergezählt wird. Deshalb
   hier gezielt nachhelfen, aber nur wenn der Fokus wirklich verloren
   ist. */
function focusIfFocusLost(el){
  if(el && document.activeElement === document.body) el.focus();
}

/* ---------- Ablauf pro Aufgabe ---------- */
// Zufalls-Extra ab Stufe 4 im Übungsmodus: gelegentlich ein
// "Verhüpfer" (Tessa behauptet erst eine falsche Landestelle - siehe
// pickWrongClaim()). Die goldene Karotte ist kein Aufgaben-Merkmal,
// sondern ein Bonus NACH einer richtigen Antwort (siehe
// maybeAwardGoldenCarrot() in resolve()).
function decorateProblem(p, opts){
  p.verhuepfer = Boolean(opts && opts.allowVerhuepfer) && chance(VERHUEPFER_CHANCE);
  if(p.verhuepfer) p.wrongClaim = pickWrongClaim(p);
  return p;
}

function nextProblem(){
  if(!G) return;
  // Übungsmodus kennt keine Leben - eine Runde endet einzig nach der
  // eingestellten Aufgabenzahl. Blitz behält sein Schutzblatt.
  const outOfLives = G.mode === "blitz" && G.lives <= 0;
  if(G.i >= G.total || outOfLives){ return endRound(); }
  G.i += 1;
  G.answered = false;
  document.getElementById("zh-explain").classList.add("hidden");

  if(G.mode === "blitz"){
    G.current = decorateProblem(generateBlitzProblem(G.pool), { allowVerhuepfer:false });
    if(!G.showCarrots) document.getElementById("zh-carrots").classList.add("hidden");
  } else {
    G.current = decorateProblem(generateProblem(G.stage), { allowVerhuepfer: G.stage >= VERHUEPFER_MIN_STAGE });
    if(G.stageDef.carrots === "button") G.showCarrots = false; // Hilfe muss je Aufgabe neu geholt werden
  }

  renderProblemLine(G.current);
  renderCarrotToolbar();
  renderRoundPath();
  updateHud();

  const tessa = document.getElementById("zh-tessa");
  const verhuepferFlag = G.current.verhuepfer ? '<span class="verhuepfer-flag">Verhüpfer?</span>' : "";
  const tessaMsg = G.current.verhuepfer
    ? "Hoppla - ist Tessa hier wirklich richtig gelandet?"+verhuepferFlag
    : "Wo landet Tessa?";
  tessa.innerHTML = '<span class="fx">'+tessaImgTag(G.current.verhuepfer ? "oops" : "idle")+'</span><p>'+tessaMsg+'</p>';
  setBunnyFrame(G.current.verhuepfer ? "oops" : "idle");

  if(G.mode === "blitz"){
    document.getElementById("zh-line-outer").classList.toggle("hidden", !G.showLine);
    if(G.showLine) renderNumberline(G.current, true);
    renderBubbles(G.current);
    startBlitzTimer();
  } else {
    document.getElementById("zh-line-outer").classList.remove("hidden");
    renderNumberline(G.current, false);
    document.getElementById("zh-answers").innerHTML = "";
    focusIfFocusLost(document.querySelector(".nl-dot"));
    if(G.current.verhuepfer){
      // Tessa sitzt beim Verhüpfer schon (falsch) auf der Behauptung,
      // nicht auf dem Startwert - genau das soll dem Kind auffallen.
      // Kein Rechenweg-Vorführen in diesem Fall.
      positionBunny(G.current.wrongClaim, G.current.range);
    } else if(G.showCarrots){
      // Karotten sind für diese Aufgabe/Stufe ohnehin sichtbar: der
      // Rechenweg wird als Lernhilfe einmal komplett vorgeführt,
      // bevor das Kind die Zahl im Zahlenweg antippt.
      renderCarrots();
      runSolutionDemo(G.current, { withCarrots:true });
    } else {
      renderCarrots();
    }
  }
}

function onLineTap(value, dotEl){
  if(!G || G.answered || !G.current) return;
  resolve(value === G.current.c, dotEl, null);
}
function onBubbleTap(value, bubbleEl){
  if(!G || G.answered || !G.current) return;
  resolve(value === G.current.c, null, bubbleEl);
}

/* ---------- Blitz-Timer ---------- */
function startBlitzTimer(){
  const bar = document.getElementById("zh-timer");
  bar.classList.remove("hide");
  const fill = bar.querySelector("i");
  const total = G.windowMs;
  const t0 = performance.now();
  cancelAnimationFrame(rafId);
  function step(now){
    if(!G || G.mode !== "blitz") return;
    const left = Math.max(0, total - (now - t0));
    fill.style.width = (left/total*100) + "%";
    if(left <= 0){
      if(!G.answered) resolve(false, null, null, "Zu langsam!");
      return;
    }
    rafId = requestAnimationFrame(step);
  }
  rafId = requestAnimationFrame(step);
}
function stopBlitzTimer(){ cancelAnimationFrame(rafId); const b=document.getElementById("zh-timer"); if(b) b.classList.add("hide"); }

/* Fliegt eine verdiente Karotte in den nächsten Korbplatz auf dem
   Rundenweg. */
function flyEarnedCarrot(){
  const slots = document.querySelectorAll(".round-path-slot");
  const target = slots[G.results.length-1];
  if(!target) return;
  const row = document.getElementById("zh-carrots");
  const fromEl = (!row.classList.contains("hidden") && row.querySelector("img")) || document.getElementById("zh-tessa");
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = target.getBoundingClientRect();
  const fly = document.createElement("img");
  fly.src = CARROT_IMG.normal;
  fly.className = "flying-carrot";
  fly.style.left = fromRect.left+"px";
  fly.style.top = fromRect.top+"px";
  document.body.appendChild(fly);
  requestAnimationFrame(function(){
    fly.style.transform = "translate("+(toRect.left-fromRect.left)+"px,"+(toRect.top-fromRect.top)+"px) scale(.5)";
    fly.style.opacity = "0.3";
  });
  later(()=> fly.remove(), 550);
}

/* Die goldene Karotte ist ein Überraschungsbonus NACH einer richtigen
   Antwort, kein Teil der Rechenmenge - eigener Sammelplatz, verändert
   weder Aufgabe noch Zählreihe, und löst KEINE zusätzliche Coins/XP
   aus (nur dispatchRoundRewards() am Rundenende tut das). */
function maybeAwardGoldenCarrot(ok, cb){
  if(!ok || !chance(GOLDEN_CHANCE)){ cb(); return; }
  DATA().goldenCarrots += 1;
  addGardenProgress(GOLDEN_GARDEN_BONUS);
  savePlayer();
  renderBonusLine();
  playCorrectSound();
  const bonusBox = document.getElementById("zh-bonus");
  const toast = el("p","bonus-found-toast","✨ Du hast eine goldene Karotte gefunden!");
  bonusBox.insertAdjacentElement("afterend", toast);
  later(()=>{ toast.remove(); cb(); }, 900);
}

/* ---------- Antwort auswerten ---------- */
function resolve(ok, dotEl, bubbleEl, forcedMsg){
  if(!G || G.answered) return;
  G.answered = true;
  stopBlitzTimer();
  const p = G.current;

  if(dotEl){ dotEl.classList.add(ok ? "is-correct" : "is-wrong"); }
  if(bubbleEl){ bubbleEl.classList.add(ok ? "is-correct" : "is-wrong"); }
  document.querySelectorAll(".nl-dot, .bubble").forEach(function(b){ b.disabled = true; });

  G.results.push(ok);
  if(ok){ G.correctCount += 1; addGardenProgress(1); savePlayer(); }

  ok ? playCorrectSound() : playWrongSound();

  if(ok){
    if(G.mode === "blitz"){
      G.combo = Math.min(G.combo+1, 9);
      G.score += 10 * G.combo;
      G.windowMs = Math.max(BLITZ_MIN_MS, G.windowMs - BLITZ_STEP_MS);
    } else {
      G.streak = (G.streak||0) + 1;
      G.score += 10;
    }
  } else {
    G.wrong += 1;
    G.streak = 0;
    if(G.mode === "blitz"){ G.combo = 1; G.lives -= 1; }
  }
  renderRoundPath();
  updateHud();

  const tessa = document.getElementById("zh-tessa");

  if(G.mode === "blitz"){
    // Blitz bleibt bewusst schnell (Zeitdruck/Leben nur hier erlaubt)
    // - ein einzelner Hopser zur richtigen Zahl statt der vollen
    // Schritt-für-Schritt-Erklärung der Übungsrunde.
    const msg = forcedMsg || (ok ? "Richtig! ✨" : "Fast – die richtige Antwort ist "+p.c+".");
    tessa.innerHTML = '<span class="fx">'+tessaImgTag(ok ? "cheer" : "oops")+'</span><p>'+msg+'</p>';
    if(G.showLine){
      if(!dotEl) renderNumberline(p, true);
      later(()=> hopOneStep(p.c, p.range), 120);
      later(()=> setBunnyFrame(ok ? "cheer" : "land"), 120+HOP_STEP_MS);
      const correctDot = document.querySelector('.nl-dot[data-value="'+p.c+'"]');
      if(correctDot) correctDot.classList.add("is-correct");
    } else {
      setBunnyFrame(ok ? "cheer" : "oops");
    }
    if(ok) flyEarnedCarrot();
    maybeAwardGoldenCarrot(ok, function(){ later(nextProblem, ok ? 900 : 1150); });
    return;
  }

  // ---------- ÜBUNGSMODUS: der richtige Rechenweg wird IMMER einmal
  // gezeigt - bei einer richtigen Antwort als Bestätigung, bei einer
  // falschen als verständliche Erklärung samt Text. ----------
  document.getElementById("zh-answers").innerHTML = "";
  const explainBox = document.getElementById("zh-explain");
  if(ok){
    tessa.innerHTML = '<span class="fx">'+tessaImgTag("jump")+'</span><p>Richtig! Schauen wir uns den Weg nochmal an ...</p>';
    explainBox.classList.add("hidden");
  } else {
    tessa.innerHTML = '<span class="fx">'+tessaImgTag("oops")+'</span><p>Fast! Hier ist der richtige Weg:</p>';
    explainBox.textContent = explainSteps(p);
    explainBox.classList.remove("hidden");
  }
  // Vormachen startet immer bei p.a (auch nach einem Verhüpfer, wo
  // Tessa gerade noch auf der falschen Behauptung stand).
  positionBunny(p.a, p.range);
  setBunnyFrame(ok ? "jump" : "oops");
  runSolutionDemo(p, {
    withCarrots: G.showCarrots,
    onDone: function(){
      if(!G) return; // Runde könnte währenddessen abgebrochen worden sein
      setBunnyFrame(ok ? "cheer" : "land");
      const correctDot = document.querySelector('.nl-dot[data-value="'+p.c+'"]');
      if(correctDot) correctDot.classList.add(ok ? "is-correct" : "is-wrong");
      if(ok) flyEarnedCarrot();
      maybeAwardGoldenCarrot(ok, function(){ later(nextProblem, 900); });
    }
  });
}

/* ============================================================
   RUNDENENDE
   ============================================================ */
/* Eine Stufe gilt als gemeistert, wenn die Runde VOLLSTÄNDIG gespielt
   wurde (im Übungsmodus immer der Fall, es gibt keine Leben mehr)
   UND die Trefferquote MASTERY_RATIO erreicht wurde. Kein
   Fortschrittsverlust, keine Bestrafung bei Nichterreichen: die
   Stufe bleibt einfach spielbar. */
function endRound(){
  stopBlitzTimer(); clearTimers();
  const mode = G.mode;
  const stage = G.stage;
  const score = G.score;
  const roundId = G.roundId;
  const data = DATA();
  const ratio = G.total > 0 ? G.correctCount / G.total : 0;
  const mastered = mode === "uebung" && ratio >= MASTERY_RATIO;

  // Belohnung ausschließlich hier, für eine wirklich bis zum Ende
  // gespielte Runde. Übung: egal ob gemeistert - das Durchspielen
  // selbst ist die Leistung, die Meisterungsquote steuert nur die
  // Stufenfreischaltung. Blitz: ein sofortiger Timeout oder zwei
  // schnelle Fehler dürfen NICHT dieselbe volle Belohnung geben wie
  // ein ausgespielter Lauf - dafür zusätzlich eine Mindestleistung
  // (mind. MIN_BLITZ_PROBLEMS beantwortet UND mind. MIN_BLITZ_RATIO
  // Trefferquote unter den beantworteten Aufgaben, nicht unter den
  // ggf. gar nicht erreichten G.total).
  const blitzAnswered = G.i;
  const blitzRatio = blitzAnswered > 0 ? G.correctCount / blitzAnswered : 0;
  const blitzQualified = blitzAnswered >= MIN_BLITZ_PROBLEMS && blitzRatio >= MIN_BLITZ_RATIO;
  const rewardEligible = mode === "uebung" || blitzQualified;
  const earned = rewardEligible ? dispatchRoundRewards(mode, roundId) : { coins:0, xp:0 };

  let celebrate = false; // Konfetti: Stufenaufstieg ODER neuer Blitz-Bestwert
  if(mode === "uebung"){
    if(score > data.bestScore.uebung) data.bestScore.uebung = score;
    if(mastered){
      const stageBefore = data.unlockedStage;
      data.stageWins[stage] = (data.stageWins[stage]||0) + 1;
      if(stage < 5) data.unlockedStage = Math.max(data.unlockedStage, stage+1);
      if(data.unlockedStage > stageBefore) celebrate = true;
      if(stage === 4 && !data.blitzrundeUnlocked){
        data.blitzrundeUnlocked = true;
        celebrate = true;
      }
    }
  } else {
    const isBest = score > data.bestScore.blitzrunde;
    if(isBest) data.bestScore.blitzrunde = score;
    if(isBest && score > 0) celebrate = true;
  }
  savePlayer();
  if(celebrate) fireZhConfetti();

  clearApp();
  const c = el("div","card result center");
  const earnedLine = '<p class="mastery-pill '+(rewardEligible?"is-mastered":"is-practice")+'">'+
    '+'+earned.xp+' XP · +'+earned.coins+' Münzen</p>';
  if(mode === "uebung"){
    c.innerHTML =
      '<h2>'+(mastered ? "Geschafft! 🎉" : "Gut geübt!")+'</h2>'+
      '<p class="mastery-pill '+(mastered?"is-mastered":"is-practice")+'">'+
        (mastered ? "✓ Stufe gemeistert" : Math.round(ratio*100)+"% richtig – noch nicht ganz")+
      '</p>'+
      earnedLine+
      '<p>Punkte: <span class="big">'+score+'</span></p>'+
      (mastered
        ? '<p>'+(data.unlockedStage>stage ? '<b>Stufe '+(stage+1)+' frei!</b>' : 'Weiter so!')+
          (data.blitzrundeUnlocked && stage===4 ? ' · <b>⚡ Blitzrunde frei!</b>' : '')+'</p>'
        : '<p>Kein Problem - dein Fortschritt bleibt erhalten. Übe diese Stufe gern nochmal, dann klappt\'s!</p>');
  } else {
    c.innerHTML =
      '<h2>⚡ Blitzrunde vorbei</h2>'+
      earnedLine+
      (blitzQualified
        ? ''
        : '<p>Noch keine Belohnung diesmal - schaff mindestens '+MIN_BLITZ_PROBLEMS+
          ' Aufgaben mit mindestens der Hälfte richtig, dann gibt es XP und Münzen!</p>')+
      '<p>Punkte: <span class="big">'+score+'</span></p>'+
      '<p>Bestwert: <b>'+data.bestScore.blitzrunde+'</b></p>';
  }
  const again = el("button","btn btn--wide", mode==="uebung" ? "Nochmal (Stufe "+stage+")" : "Nochmal ⚡");
  again.style.marginTop = "10px";
  again.addEventListener("click", ()=> mode==="uebung" ? startUebung(stage) : startBlitz());
  const menu = el("button","btn btn--ghost btn--wide","Zum Menü");
  menu.style.marginTop = "8px";
  menu.addEventListener("click", showMenu);
  c.appendChild(again); c.appendChild(menu);
  app.appendChild(c);
  // Die Runde führt sichtbar bis zum Garten - Ergebnis zeigt seinen
  // aktuellen Stand (mit kurzem Aufleucht-Effekt, falls der Garten
  // während der Runde eine Stufe weitergewachsen ist).
  app.appendChild(renderGardenCard(G.gardenStageAtStart));
  G = null;
}

})();
