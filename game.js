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

// ---- Skins (temas visuales del canvas) ----
// Cada skin define su paleta (1-indexada, null en 0) y una función drawBlock.
// La skin activa se cambia sin recargar y se guarda en localStorage.
const SKIN_STORAGE_KEY = 'tetris-skin';

// Estilo clásico: cuadrado plano con highlight superior translúcido.
function drawBlockRetro(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Neón: efecto glow usando shadowBlur/shadowColor.
function drawBlockNeon(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.fillStyle = color;
  context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

// Helper: traza un rectángulo con esquinas redondeadas.
function roundRectPath(context, rx, ry, rw, rh, radius) {
  context.beginPath();
  context.moveTo(rx + radius, ry);
  context.arcTo(rx + rw, ry, rx + rw, ry + rh, radius);
  context.arcTo(rx + rw, ry + rh, rx, ry + rh, radius);
  context.arcTo(rx, ry + rh, rx, ry, radius);
  context.arcTo(rx, ry, rx + rw, ry, radius);
  context.closePath();
}

// Pastel: colores suaves y esquinas redondeadas.
function drawBlockPastel(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.shadowBlur = 0;
  const radius = Math.max(2, Math.floor(size * 0.22));
  context.fillStyle = color;
  roundRectPath(context, x * size + 1, y * size + 1, size - 2, size - 2, radius);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.20)';
  roundRectPath(context, x * size + 3, y * size + 3, size - 6, Math.max(3, size * 0.28), Math.max(2, radius - 1));
  context.fill();
  context.globalAlpha = 1;
}

// Pixel art: bordes biselados y patrón de textura punteado.
function drawBlockPixel(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.shadowBlur = 0;
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  // bisel: luz arriba/izquierda, sombra abajo/derecha
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.fillRect(px, py, s, 3);
  context.fillRect(px, py, 3, s);
  context.fillStyle = 'rgba(0,0,0,0.30)';
  context.fillRect(px, py + s - 3, s, 3);
  context.fillRect(px + s - 3, py, 3, s);
  // textura de píxeles
  context.fillStyle = 'rgba(0,0,0,0.15)';
  const dot = Math.max(2, Math.floor(size / 8));
  for (let dy = py + dot; dy < py + s - dot; dy += dot * 2)
    for (let dx = px + dot; dx < px + s - dot; dx += dot * 2)
      context.fillRect(dx, dy, dot, dot);
  context.globalAlpha = 1;
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    drawBlock: drawBlockRetro,
  },
  neon: {
    name: 'Neon',
    colors: [
      null,
      '#00e5ff', '#ffe600', '#d500f9', '#00e676',
      '#ff1744', '#2979ff', '#ff9100', '#b0bec5',
    ],
    drawBlock: drawBlockNeon,
  },
  pastel: {
    name: 'Pastel',
    colors: [
      null,
      '#a8e6e6', '#fdf6b2', '#e0bbe4', '#bde6c3',
      '#f7b7b7', '#bcd4f0', '#fcd9a8', '#d6dade',
    ],
    drawBlock: drawBlockPastel,
  },
  pixel: {
    name: 'Pixel art',
    colors: COLORS,
    drawBlock: drawBlockPixel,
  },
};

let activeSkin = SKINS.retro;

function setSkin(key) {
  if (!SKINS[key]) key = 'retro';
  activeSkin = SKINS[key];
  try { localStorage.setItem(SKIN_STORAGE_KEY, key); } catch (e) { /* localStorage no disponible */ }
}

function loadSkin() {
  let key = 'retro';
  try { key = localStorage.getItem(SKIN_STORAGE_KEY) || 'retro'; } catch (e) { /* ignore */ }
  if (!SKINS[key]) key = 'retro';
  activeSkin = SKINS[key];
  return key;
}

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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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
    updateHUD();
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
  const color = activeSkin.colors[colorIndex] || COLORS[colorIndex];
  activeSkin.drawBlock(context, x, y, color, size, alpha);
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
  ctx.shadowBlur = 0;
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
  nextCtx.shadowBlur = 0;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
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
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
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

document.getElementById('theme-toggle').addEventListener('change', e => {
  document.body.classList.toggle('light', e.target.checked);
});

// ---- Selector de skin ----
const skinSelect = document.getElementById('skin-select');
const initialSkin = loadSkin();
skinSelect.value = initialSkin;
skinSelect.addEventListener('change', e => {
  setSkin(e.target.value);
  // Redibuja al instante (el bucle no corre en pausa / game over).
  draw();
  drawNext();
});

init();
