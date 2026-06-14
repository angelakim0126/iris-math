'use strict';

// ===========================
// Cosmic Math — Iris's times tables (1×–12×)
// ===========================
const TABLES = 12;          // 1× through 12×
const LADDER_END = 12;      // each ladder goes ×1 .. ×12
const SPEED_SECONDS = 60;

// Planet decorations per table (purely cosmetic)
const PLANETS = {
  1:  { emoji: '⭐', color: '#ffd700' },
  2:  { emoji: '☄️', color: '#ff8a3c' },
  3:  { emoji: '🌙', color: '#c5b8e3' },
  4:  { emoji: '☀️', color: '#ffe066' },
  5:  { emoji: '🪐', color: '#fbb454' },
  6:  { emoji: '🌍', color: '#4dc6ff' },
  7:  { emoji: '🌌', color: '#a78bfa' },
  8:  { emoji: '🌠', color: '#ff6ec4' },
  9:  { emoji: '🛸', color: '#7be3c8' },
  10: { emoji: '👽', color: '#90ee90' },
  11: { emoji: '🚀', color: '#ff4d6d' },
  12: { emoji: '🌟', color: '#ffec5c' },
};

// ===========================
// State (persisted in localStorage)
// ===========================
const state = {
  mastered: loadMastered(),       // Set of table numbers that have been cleared with 0 errors
  speedBest: parseInt(localStorage.getItem('imth_speed_best') || '0', 10),
  soundEnabled: localStorage.getItem('imth_sound') !== 'off',
  currentMode: null,
  ladder: null,
  speed: null,
};

function loadMastered() {
  try { return new Set(JSON.parse(localStorage.getItem('imth_mastered') || '[]')); }
  catch (e) { return new Set(); }
}
function saveMastered() {
  localStorage.setItem('imth_mastered', JSON.stringify(Array.from(state.mastered).sort((a,b) => a-b)));
}
function save() {
  localStorage.setItem('imth_speed_best', String(state.speedBest));
  localStorage.setItem('imth_sound', state.soundEnabled ? 'on' : 'off');
}

const $ = id => document.getElementById(id);
const homeEl = $('home');
const gameEl = $('game');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ===========================
// Audio (Web Audio API tones)
// ===========================
let audioCtx = null;
function tone(freq, duration, type = 'sine', volume = 0.08) {
  if (!state.soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = freq; osc.type = type;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}
const sounds = {
  correct: () => { tone(1320, 0.06, 'sine', 0.07); setTimeout(() => tone(1760, 0.08, 'sine', 0.06), 50); },
  wrong:   () => tone(220, 0.18, 'triangle', 0.06),
  milestone: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.09), i * 70)),
  tick: () => tone(880, 0.04, 'sine', 0.04),
};

// ===========================
// Confetti (canvas)
// ===========================
const canvas = $('confetti-canvas');
const cctx = canvas.getContext('2d');
let particles = [];
let animRunning = false;
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function confetti(intensity = 50) {
  const colors = ['#00f0ff', '#ff45e6', '#ffd700', '#a78bfa', '#7be3c8', '#ffffff'];
  for (let i = 0; i < intensity; i++) {
    particles.push({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 220,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 1) * 14 - 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 7 + 3,
      life: 1.0,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.3,
    });
  }
  if (!animRunning) { animRunning = true; requestAnimationFrame(animateConfetti); }
}
function animateConfetti() {
  cctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.life > 0 && p.y < canvas.height + 50);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.vx *= 0.99;
    p.life -= 0.012; p.rot += p.vRot;
    cctx.save();
    cctx.globalAlpha = Math.max(0, p.life);
    cctx.translate(p.x, p.y); cctx.rotate(p.rot);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.5);
    cctx.restore();
  });
  if (particles.length > 0) requestAnimationFrame(animateConfetti);
  else { animRunning = false; cctx.clearRect(0,0,canvas.width,canvas.height); }
}

// ===========================
// Leaderboard (Speed Round)
// ===========================
function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem('imth_leaderboard') || '[]'); }
  catch (e) { return []; }
}
function saveLeaderboard(arr) {
  arr.sort((a, b) => (b.score - a.score) || ((a.ts || 0) - (b.ts || 0)));
  localStorage.setItem('imth_leaderboard', JSON.stringify(arr.slice(0, 50)));
}
function addLeaderboardEntry(name, score) {
  if (!score || score < 1) return null;
  const entry = { name: (name || 'Player').slice(0, 24), score, ts: Date.now() };
  const arr = loadLeaderboard();
  arr.push(entry);
  saveLeaderboard(arr);
  return entry;
}
function renderLeaderboardHtml(highlight) {
  const arr = loadLeaderboard();
  if (arr.length === 0) return '<div class="leaderboard-empty">No runs yet — be the first! ✨</div>';
  let html = '<table class="leaderboard"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>When</th></tr></thead><tbody>';
  arr.slice(0, 10).forEach((e, i) => {
    const isHi = highlight && e.ts === highlight.ts && e.name === highlight.name && e.score === highlight.score;
    const d = new Date(e.ts);
    const dateStr = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    html += `<tr class="${isHi ? 'highlight' : ''}"><td>${i+1}</td><td>${escapeHtml(e.name)}</td><td><b>${e.score}</b></td><td>${dateStr}</td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// ===========================
// Mission Log — record every clean ladder run (all 12 right)
// ===========================
function loadMissionLog() {
  try { return JSON.parse(localStorage.getItem('imth_mission_log') || '[]'); }
  catch (e) { return []; }
}
function saveMissionLog(arr) {
  // newest first; cap at 50
  localStorage.setItem('imth_mission_log', JSON.stringify(arr.slice(0, 50)));
}
function addMissionLogEntry(table, name, score, total) {
  const entry = {
    table,
    name: (name || 'Player').slice(0, 24),
    score: score != null ? score : total,
    total: total != null ? total : LADDER_END,
    ts: Date.now(),
  };
  const arr = loadMissionLog();
  arr.unshift(entry);
  saveMissionLog(arr);
  return entry;
}
function getCurrentName() {
  return (localStorage.getItem('imth_test_name') || '').trim() || 'Player';
}
function renderMissionLogHtml(highlight) {
  const arr = loadMissionLog();
  let html = '<h3>🚀 Mission Log</h3>';
  if (arr.length === 0) {
    html += '<div class="leaderboard-empty">No runs yet — pick a planet to start! ⭐</div>';
    return html;
  }
  html += '<table class="leaderboard"><thead><tr><th>Who</th><th>Planet</th><th>Score</th><th>When</th></tr></thead><tbody>';
  arr.slice(0, 10).forEach(e => {
    const isHi = highlight && e.ts === highlight.ts;
    const d = new Date(e.ts);
    const dateStr = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const p = PLANETS[e.table] || { emoji: '⭐' };
    // Backward compat: older entries may not have score/total; treat as perfect mastery
    const score = e.score != null ? e.score : LADDER_END;
    const total = e.total != null ? e.total : LADDER_END;
    const perfect = score === total;
    const scoreCell = perfect ? `⭐ <b>${score}/${total}</b>` : `<b>${score}/${total}</b>`;
    html += `<tr class="${isHi ? 'highlight' : ''}"><td>${escapeHtml(e.name)}</td><td>${p.emoji} ${e.table}×</td><td>${scoreCell}</td><td>${dateStr}</td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// ===========================
// Home screen
// ===========================
function renderHome() {
  $('mastered-stat').textContent = state.mastered.size;
  $('best-stat').textContent = state.speedBest;
  $('home-progress').style.width = `${(state.mastered.size / TABLES) * 100}%`;
  $('sound-toggle').checked = state.soundEnabled;
  $('player-name-home').value = localStorage.getItem('imth_test_name') || '';
  $('mission-log-section').innerHTML = renderMissionLogHtml();

  const grid = $('planets-grid');
  let html = '';
  for (let t = 1; t <= TABLES; t++) {
    const p = PLANETS[t];
    const isMastered = state.mastered.has(t);
    html += `
      <button class="planet-btn${isMastered ? ' mastered' : ''}" data-table="${t}" style="--planet-color:${p.color}">
        <span class="planet-emoji">${p.emoji}</span>
        <span class="planet-label">${t}×</span>
      </button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.planet-btn').forEach(b => {
    b.addEventListener('click', () => startStudy(parseInt(b.dataset.table, 10)));
  });
}

// ===========================
// STUDY MODE — show all 12 facts for a table, then offer the ladder
// ===========================
function startStudy(table) {
  state.currentMode = 'study';
  state.study = { table };
  homeEl.classList.add('hidden');
  gameEl.classList.remove('hidden');
  $('game-mode-title').textContent = `${PLANETS[table].emoji} ${table}× Times Table`;
  renderStudy();
}

function renderStudy() {
  const { table } = state.study;
  const isMastered = state.mastered.has(table);
  $('game-stat-display').textContent = isMastered ? '⭐ Mastered' : 'Study time';

  let html = '<div class="position-label">📖 Look at the facts. When you know them, tap the button below to play!</div>';
  html += '<div class="study-grid">';
  for (let i = 1; i <= LADDER_END; i++) {
    const ans = table * i;
    html += `
      <div class="fact-card">
        <span class="fact-eq">${table} × ${i}</span>
        <span class="fact-eq-eq">=</span>
        <span class="fact-ans">${ans}</span>
      </div>`;
  }
  html += '</div>';
  html += `<div class="btn-row"><button class="action-btn" id="study-play">🚀 I'm ready — play the ${table}× ladder</button></div>`;
  $('game-content').innerHTML = html;
  $('study-play').onclick = () => startLadder(table);
}

function showHome() {
  state.currentMode = null;
  if (state.speed && state.speed.timer) clearInterval(state.speed.timer);
  homeEl.classList.remove('hidden');
  gameEl.classList.add('hidden');
  renderHome();
}

// ===========================
// Problem generation
// ===========================
function makeChoices(correct, table) {
  // 3 distractors: same table neighbors + one off-by-near
  const distractors = new Set();
  // adjacent in same table
  for (const delta of [-1, 1, -2, 2]) {
    const candidate = correct + table * delta;
    if (candidate > 0 && candidate !== correct) distractors.add(candidate);
    if (distractors.size >= 2) break;
  }
  // off-by-one product (common mistake)
  const offByOne = [correct - 1, correct + 1, correct - 2, correct + 2].filter(v => v > 0 && v !== correct && !distractors.has(v));
  if (offByOne.length > 0) distractors.add(offByOne[Math.floor(Math.random() * offByOne.length)]);
  // top up if still short
  while (distractors.size < 3) {
    const v = correct + (Math.floor(Math.random() * 20) - 10);
    if (v > 0 && v !== correct && !distractors.has(v)) distractors.add(v);
  }
  const choices = [correct, ...Array.from(distractors).slice(0, 3)];
  // shuffle
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}

// ===========================
// LADDER mode — one table at a time, climb ×1 → ×12
// ===========================
function startLadder(table) {
  state.currentMode = 'ladder';
  state.ladder = {
    table,
    level: 1,
    errorsInRun: 0,
    locked: false,
    levelErrors: {},   // {level: count}
  };
  homeEl.classList.add('hidden');
  gameEl.classList.remove('hidden');
  $('game-mode-title').textContent = `${PLANETS[table].emoji} ${table}× Ladder`;
  renderLadder();
}

function renderLadder() {
  const s = state.ladder;
  if (!s) return;
  $('game-stat-display').textContent = `Level ${s.level} / ${LADDER_END}`;

  if (s.level > LADDER_END) {
    finishLadder();
    return;
  }

  const correct = s.table * s.level;
  const choices = makeChoices(correct, s.table);
  s.correct = correct;
  s.choices = choices;

  let html = '<div class="position-label">Pick the right answer 🚀</div>';
  // Ladder progress bar
  html += '<div class="ladder">';
  for (let i = 1; i <= LADDER_END; i++) {
    let cls = '';
    if (i < s.level) cls = (s.levelErrors[i] ? 'wrong' : 'done');
    else if (i === s.level) cls = 'current';
    html += `<div class="ladder-rung ${cls}"></div>`;
  }
  html += '</div>';
  html += `<div class="problem"><span>${s.table}</span> <span class="x">×</span> <span>${s.level}</span> <span class="equals">=</span> <span class="answer-slot">?</span></div>`;
  html += '<div class="choices">';
  choices.forEach(c => {
    html += `<button class="choice" data-val="${c}">${c}</button>`;
  });
  html += '</div>';
  html += '<div class="feedback" id="lad-feedback"></div>';

  $('game-content').innerHTML = html;
  $('game-content').querySelectorAll('.choice').forEach(b => {
    b.addEventListener('click', () => ladderHandleChoice(parseInt(b.dataset.val, 10), b));
  });
}

function ladderHandleChoice(val, btn) {
  const s = state.ladder;
  if (s.locked) return;
  s.locked = true;
  const correct = s.correct;
  const probEl = document.querySelector('.problem');
  const slot = document.querySelector('.answer-slot');

  if (val === correct) {
    sounds.correct();
    btn.classList.add('correct');
    if (slot) slot.textContent = correct;
    if (probEl) probEl.classList.add('correct');
    const fb = $('lad-feedback');
    if (fb) { fb.textContent = encouragement(); fb.className = 'feedback good'; }
    setTimeout(() => { s.level++; s.locked = false; renderLadder(); }, 700);
  } else {
    sounds.wrong();
    btn.classList.add('wrong');
    s.levelErrors[s.level] = (s.levelErrors[s.level] || 0) + 1;
    s.errorsInRun++;
    // Reveal the correct button
    $('game-content').querySelectorAll('.choice').forEach(b => {
      if (parseInt(b.dataset.val, 10) === correct) b.classList.add('correct');
      b.disabled = true;
    });
    if (slot) slot.textContent = correct;
    if (probEl) probEl.classList.add('wrong');
    const fb = $('lad-feedback');
    if (fb) { fb.textContent = `It's ${correct}. You'll get it next time! 💪`; fb.className = 'feedback bad'; }
    setTimeout(() => { s.level++; s.locked = false; renderLadder(); }, 1700);
  }
}

function encouragement() {
  const msgs = ['Great! 🌟', 'Nice! ⭐', 'Wow! 🚀', 'Excellent! ✨', 'Stellar! 🪐', 'Cosmic! 🌌', 'You got it! 💫'];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function finishLadder() {
  const s = state.ladder;
  const score = LADDER_END - s.errorsInRun;
  const allRight = s.errorsInRun === 0;
  if (allRight) {
    if (!state.mastered.has(s.table)) {
      state.mastered.add(s.table);
      saveMastered();
      confetti(120); sounds.milestone();
    } else {
      confetti(70); sounds.milestone();
    }
  } else {
    confetti(40);
  }
  // Log every completed run, not just 12/12 — practice counts!
  const logEntry = addMissionLogEntry(s.table, getCurrentName(), score, LADDER_END);
  s.completed = true;  // prevent double-log if Home is clicked from result screen

  const p = PLANETS[s.table];
  $('game-content').innerHTML = `
    <div class="result-card">
      <div class="result-emoji">${allRight ? '🏆' : '🚀'}</div>
      <h2>${allRight ? `${p.emoji} ${s.table}× planet mastered!` : `Good try on ${s.table}×!`}</h2>
      <p class="sub">${allRight ? `All 12 perfect — logged as <b>${escapeHtml(getCurrentName())}</b>.` : `You got ${score} of ${LADDER_END}. Logged as <b>${escapeHtml(getCurrentName())}</b>. Try again for the ⭐!`}</p>
      <div class="btn-row" style="margin-top: 16px;">
        <button class="action-btn" id="ladder-again">Try again</button>
        <button class="action-btn secondary" id="ladder-home">🏠 Home</button>
      </div>
      <div class="leaderboard-section">${renderMissionLogHtml(logEntry)}</div>
    </div>`;
  $('ladder-again').onclick = () => startLadder(s.table);
  $('ladder-home').onclick = showHome;
  $('game-stat-display').textContent = `${state.mastered.size} / ${TABLES}`;
}

// ===========================
// SPEED ROUND — 60 seconds of random 1-12 × 1-12
// ===========================
function startSpeed() {
  state.currentMode = 'speed';
  state.speed = {
    started: false,
    timer: null,
    timeLeft: SPEED_SECONDS,
    score: 0,
    name: localStorage.getItem('imth_test_name') || '',
    locked: false,
    correct: null,
    choices: null,
  };
  homeEl.classList.add('hidden');
  gameEl.classList.remove('hidden');
  $('game-mode-title').textContent = '⚡ Speed Round';
  renderSpeedStart();
}

function renderSpeedStart() {
  const cachedName = localStorage.getItem('imth_test_name') || '';
  $('game-stat-display').textContent = `Best: ${state.speedBest}`;
  $('game-content').innerHTML = `
    <div class="position-label">⚡ Speed Round</div>
    <div class="instruction">Answer as many times-table problems as you can in <b>${SPEED_SECONDS}</b> seconds!</div>
    <div class="name-row">
      <label for="player-name">Your name:</label>
      <input type="text" id="player-name" maxlength="24" value="${escapeHtml(cachedName)}" placeholder="Iris" autocomplete="off" />
    </div>
    <div class="btn-row"><button class="action-btn" id="speed-start-btn">🚀 Blast off!</button></div>
    <div class="leaderboard-section">
      <h3>🏆 Leaderboard</h3>
      ${renderLeaderboardHtml()}
    </div>`;
  $('speed-start-btn').onclick = () => {
    const nameVal = ($('player-name').value || '').trim().slice(0, 24) || 'Player';
    localStorage.setItem('imth_test_name', nameVal);
    state.speed.name = nameVal;
    state.speed.started = true;
    state.speed.timer = setInterval(speedTick, 1000);
    nextSpeedProblem();
  };
}

function speedTick() {
  const s = state.speed;
  if (!s || !s.started) return;
  s.timeLeft--;
  updateSpeedTimerUI();
  if (s.timeLeft <= 5 && s.timeLeft > 0) sounds.tick();
  if (s.timeLeft <= 0) {
    clearInterval(s.timer); s.timer = null;
    finishSpeed();
  }
}

function updateSpeedTimerUI() {
  const t = document.querySelector('.timer');
  if (t) {
    t.textContent = `⏱ ${state.speed.timeLeft}s`;
    t.classList.toggle('urgent', state.speed.timeLeft <= 10);
  }
  $('game-stat-display').textContent = `Score: ${state.speed.score}`;
}

function nextSpeedProblem() {
  const s = state.speed;
  s.locked = false;
  const a = 1 + Math.floor(Math.random() * TABLES);
  const b = 1 + Math.floor(Math.random() * TABLES);
  const correct = a * b;
  const choices = makeChoices(correct, Math.max(a, b));
  s.correct = correct;
  s.choices = choices;
  s.a = a; s.b = b;
  renderSpeedProblem();
}

function renderSpeedProblem() {
  const s = state.speed;
  let html = `<div class="timer">⏱ ${s.timeLeft}s</div>`;
  html += `<div class="problem"><span>${s.a}</span> <span class="x">×</span> <span>${s.b}</span> <span class="equals">=</span> <span class="answer-slot">?</span></div>`;
  html += '<div class="choices">';
  s.choices.forEach(c => {
    html += `<button class="choice" data-val="${c}">${c}</button>`;
  });
  html += '</div>';
  html += '<div class="feedback" id="sp-feedback"></div>';
  $('game-content').innerHTML = html;
  $('game-content').querySelectorAll('.choice').forEach(b => {
    b.addEventListener('click', () => speedHandleChoice(parseInt(b.dataset.val, 10), b));
  });
}

function speedHandleChoice(val, btn) {
  const s = state.speed;
  if (s.locked || s.timeLeft <= 0) return;
  s.locked = true;
  if (val === s.correct) {
    sounds.correct();
    btn.classList.add('correct');
    s.score++;
    setTimeout(nextSpeedProblem, 350);
  } else {
    sounds.wrong();
    btn.classList.add('wrong');
    $('game-content').querySelectorAll('.choice').forEach(b => {
      if (parseInt(b.dataset.val, 10) === s.correct) b.classList.add('correct');
      b.disabled = true;
    });
    const fb = $('sp-feedback');
    if (fb) { fb.textContent = `It's ${s.correct}!`; fb.className = 'feedback bad'; }
    setTimeout(nextSpeedProblem, 900);
  }
  updateSpeedTimerUI();
}

function finishSpeed() {
  const s = state.speed;
  s.ended = true;  // prevent double-log on result-screen Home click
  const score = s.score;
  const isNewBest = score > state.speedBest;
  if (isNewBest) { state.speedBest = score; save(); }
  const entry = addLeaderboardEntry(s.name || 'Player', score);

  $('game-content').innerHTML = `
    <div class="result-card">
      <div class="result-emoji">${isNewBest ? '🏆' : (score >= 20 ? '⭐' : '🚀')}</div>
      <h2>${escapeHtml(s.name || 'You')}: ${score} correct!</h2>
      <p class="sub">Best: ${state.speedBest}${isNewBest ? ' (new record!)' : ''}</p>
      <div class="btn-row" style="margin-top: 14px;">
        <button class="action-btn" id="speed-again">🚀 Blast off again</button>
        <button class="action-btn secondary" id="speed-home">🏠 Home</button>
      </div>
      <div class="leaderboard-section">
        <h3>🏆 Leaderboard</h3>
        ${renderLeaderboardHtml(entry)}
      </div>
    </div>`;
  $('speed-again').onclick = () => startSpeed();
  $('speed-home').onclick = showHome;
  if (isNewBest) { confetti(120); sounds.milestone(); }
}

// ===========================
// Event wiring
// ===========================
// Bail-aware Home button: log partial progress before returning home
$('back-btn').addEventListener('click', () => {
  bailCurrentGame();
  showHome();
});

function bailCurrentGame() {
  // Ladder: log how far she got (levels she actually answered, minus errors)
  if (state.currentMode === 'ladder' && state.ladder && !state.ladder.completed) {
    const completed = state.ladder.level - 1; // levels she advanced past
    if (completed > 0) {
      const score = Math.max(0, completed - state.ladder.errorsInRun);
      addMissionLogEntry(state.ladder.table, getCurrentName(), score, LADDER_END);
      state.ladder.completed = true;
    }
  }
  // Speed Round: log score so far if she's started and not already ended
  if (state.currentMode === 'speed' && state.speed && state.speed.started && !state.speed.ended) {
    if (state.speed.score > 0) {
      addLeaderboardEntry(state.speed.name || getCurrentName(), state.speed.score);
    }
    state.speed.ended = true;
    if (state.speed.timer) { clearInterval(state.speed.timer); state.speed.timer = null; }
  }
}
$('speed-btn').addEventListener('click', startSpeed);
$('sound-toggle').addEventListener('change', e => { state.soundEnabled = e.target.checked; save(); });
$('reset-btn').addEventListener('click', () => {
  if (confirm('Start over? This clears mastered planets, best speed, the leaderboard, and the mission log.')) {
    state.mastered = new Set();
    state.speedBest = 0;
    saveMastered(); save();
    localStorage.removeItem('imth_leaderboard');
    localStorage.removeItem('imth_mission_log');
    renderHome();
  }
});

// Name input wired on home (synced with cached imth_test_name, used by both ladder + speed)
$('player-name-home').addEventListener('input', e => {
  const v = (e.target.value || '').trim().slice(0, 24);
  if (v) localStorage.setItem('imth_test_name', v);
  else localStorage.removeItem('imth_test_name');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.currentMode) showHome();
});

renderHome();
