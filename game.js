'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#5b9bd5', // J - blue
  '#ffb74d', // L - orange
  '#90a4ae', // Tuerca - gris metálico
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (reto)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

// --- Records / tabla de puntuaciones ---
const STORAGE_KEY = 'tetris-records';
const MAX_SCORES = 5;

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const startRecords = document.getElementById('start-records');
const startStats = document.getElementById('start-stats');
const startResetBtn = document.getElementById('start-reset-btn');
const overlayRecords = document.getElementById('overlay-records');
const overlayStats = document.getElementById('overlay-stats');
const overlayResetBtn = document.getElementById('overlay-reset-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxComboGame;

// Estructura persistida: { scores: [{name, score}], maxCombo, maxLines }
function defaultData() {
  return { scores: [], maxCombo: 0, maxLines: 0 };
}

function loadScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const data = JSON.parse(raw);
    return {
      scores: Array.isArray(data.scores) ? data.scores : [],
      maxCombo: data.maxCombo || 0,
      maxLines: data.maxLines || 0,
    };
  } catch (e) {
    return defaultData();
  }
}

function saveScores(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    /* modo privado u otro fallo: ignorar */
  }
}

function resetScores() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignorar */
  }
  renderRecords(startRecords, startStats, -1);
  renderRecords(overlayRecords, overlayStats, -1);
}

// Devuelve true si `value` entra en el top MAX_SCORES.
function qualifiesForTop(value) {
  if (value <= 0) return false;
  const data = loadScores();
  if (data.scores.length < MAX_SCORES) return true;
  return value > data.scores[data.scores.length - 1].score;
}

// Inserta una nueva puntuación y devuelve su índice en el top (o -1).
function addScore(name, value) {
  const data = loadScores();
  const entry = { name: name || 'Anónimo', score: value };
  data.scores.push(entry);
  data.scores.sort((a, b) => b.score - a.score);
  let index = data.scores.indexOf(entry);
  data.scores = data.scores.slice(0, MAX_SCORES);
  if (index >= MAX_SCORES) index = -1;
  saveScores(data);
  return index;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Pinta la tabla de records y las estadísticas globales. `highlightIndex`
// resalta la entrada de la partida actual (o -1 para no resaltar nada).
function renderRecords(listEl, statsEl, highlightIndex) {
  const data = loadScores();
  if (listEl) {
    if (data.scores.length === 0) {
      listEl.innerHTML = '<li class="record-empty">Sin records todavía</li>';
    } else {
      listEl.innerHTML = data.scores.map((s, i) => {
        const cls = i === highlightIndex ? ' class="record-highlight"' : '';
        return `<li${cls}><span class="record-rank">${i + 1}.</span>` +
          `<span class="record-name">${escapeHtml(s.name)}</span>` +
          `<span class="record-score">${s.score.toLocaleString()}</span></li>`;
      }).join('');
    }
  }
  if (statsEl) {
    statsEl.innerHTML =
      `<span>Mejor combo: <strong>${data.maxCombo}</strong></span>` +
      `<span>Líneas máx.: <strong>${data.maxLines}</strong></span>`;
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    if (combo > maxComboGame) maxComboGame = combo;
    updateHUD();
  } else {
    // Una pieza se fijó sin limpiar líneas: se rompe el combo.
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// Persiste las estadísticas globales (mejor combo y líneas máximas).
function persistGlobalStats() {
  const data = loadScores();
  let changed = false;
  if (maxComboGame > data.maxCombo) { data.maxCombo = maxComboGame; changed = true; }
  if (lines > data.maxLines) { data.maxLines = lines; changed = true; }
  if (changed) saveScores(data);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  persistGlobalStats();

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  overlayResetBtn.classList.add('hidden');

  if (qualifiesForTop(score)) {
    // Pedir nombre antes de mostrar la tabla.
    nameForm.classList.remove('hidden');
    overlayRecords.classList.add('hidden');
    overlayStats.classList.add('hidden');
    restartBtn.classList.add('hidden');
    nameInput.value = '';
    nameInput.focus();
  } else {
    nameForm.classList.add('hidden');
    restartBtn.classList.remove('hidden');
    showOverlayRecords(-1);
  }
}

// Muestra la tabla de records dentro del overlay de game over.
function showOverlayRecords(highlightIndex) {
  renderRecords(overlayRecords, overlayStats, highlightIndex);
  overlayRecords.classList.remove('hidden');
  overlayStats.classList.remove('hidden');
  overlayResetBtn.classList.remove('hidden');
}

// Confirma el nombre del jugador y guarda la puntuación en el top.
function confirmName() {
  const name = nameInput.value.trim().slice(0, 12);
  const index = addScore(name, score);
  nameForm.classList.add('hidden');
  restartBtn.classList.remove('hidden');
  showOverlayRecords(index);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  maxComboGame = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  if (startScreen) startScreen.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// Muestra la pantalla de inicio con la tabla de records.
function showStartScreen() {
  cancelAnimationFrame(animId);
  gameOver = true; // evita que el loop siga corriendo
  overlay.classList.add('hidden');
  renderRecords(startRecords, startStats, -1);
  startScreen.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

playBtn.addEventListener('click', init);

startResetBtn.addEventListener('click', resetScores);
overlayResetBtn.addEventListener('click', resetScores);

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  confirmName();
});

document.getElementById('theme-toggle').addEventListener('change', e => {
  document.body.classList.toggle('light', e.target.checked);
});

showStartScreen();
