// ui.js
// Matrix UI + multi-point graph editor for A[i][j] curves.
// Assumes globals from sim.js: speciesCount, colors, matrix, rMax, dt, damp,
// and helpers: makeColors(n), makeMatrix(n), resetParticles()

const matrixDiv = document.getElementById('matrix');
const graph = document.getElementById('graph');
const gctx = graph.getContext('2d');

const speciesInput = document.getElementById('speciesCount');
const countInput = document.getElementById('particleCount');
const rMaxInput = document.getElementById('rMax');
const dtInput = document.getElementById('dt');
const dampInput = document.getElementById('damp');
const randomizeBtn = document.getElementById('randomize');
const resetBtn = document.getElementById('reset');
const clearBtn = document.getElementById('clear');

const mlabel = document.getElementById('mlabel');
const glabel = document.getElementById('glabel');
const exitBtn = document.getElementById('exitMatrix');

let selected = [0, 0];
let draggingPointIndex = null;
let hoverPointIndex = null;

// Initial visibility
graph.style.display = "none";
glabel.style.display = "none";
exitBtn.style.display = "none";
mlabel.style.display = "block";
matrixDiv.style.display = "block";

// ---------- Matrix UI ----------
function buildMatrixUI() {
  matrixDiv.innerHTML = '';
  const table = document.createElement('table');

  // Header row
  const headerRow = document.createElement('tr');
  const corner = document.createElement('th');
  headerRow.appendChild(corner);
  for (let j = 0; j < speciesCount; j++) {
    const th = document.createElement('th');
    th.textContent = j;
    th.className = 'species-label';
    th.style.color = colors[j];
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  // Body rows
  for (let i = 0; i < speciesCount; i++) {
    const tr = document.createElement('tr');

    const rowTh = document.createElement('th');
    rowTh.textContent = i;
    rowTh.className = 'species-label';
    rowTh.style.color = colors[i];
    tr.appendChild(rowTh);

    for (let j = 0; j < speciesCount; j++) {
      const td = document.createElement('td');
      td.style.padding = "0";
      const btn = document.createElement('button');
      btn.className = 'matrix-btn';
      btn.title = `Edit ${i}'s attraction to ${j}`;
      btn.addEventListener('click', () => {
        selected = [i, j];
        document.querySelectorAll('.matrix-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        drawGraph();

        // Toggle UI
        matrixDiv.style.display = "none";
        mlabel.style.display = "none";
        glabel.style.display = "block";
        graph.style.display = "block";
        exitBtn.style.display = "block";
      });
      if (i === selected[0] && j === selected[1]) btn.classList.add('selected');
      td.appendChild(btn);
      tr.appendChild(td);
    }

    table.appendChild(tr);
  }

  matrixDiv.appendChild(table);
}

// Exit button handler
exitBtn.addEventListener('click', () => {
  matrixDiv.style.display = "block";
  mlabel.style.display = "block";
  graph.style.display = "none";
  glabel.style.display = "none";
  exitBtn.style.display = "none";
  document.querySelectorAll('.matrix-btn').forEach(b => b.classList.remove('selected'));
});

// ---------- Curve utilities ----------
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function sortCurve(curve) { curve.sort((a, b) => a.x - b.x); }
function dedupeCurve(curve) {
  for (let i = curve.length - 2; i >= 0; i--) {
    if (Math.abs(curve[i].x - curve[i + 1].x) < 1e-6) curve.splice(i, 1);
  }
}
function ensureEndpoints(curve) {
  sortCurve(curve);
  if (curve.length === 0) {
    curve.push({ x: 0, y: 0 }, { x: 1, y: 0 });
    return;
  }
  if (curve[0].x > 0) curve.unshift({ x: 0, y: curve[0].y });
  if (curve[curve.length - 1].x < 1) curve.push({ x: 1, y: curve[curve.length - 1].y });
}
function addPoint(curve, x, y) {
  x = clamp(x, 0, 1);
  y = clamp(y, -1, 1);
  curve.push({ x, y });
  sortCurve(curve);
  dedupeCurve(curve);
}
function removePoint(curve, index) {
  if (index <= 0 || index >= curve.length - 1) return;
  curve.splice(index, 1);
}
function nearestPointIndex(curve, xPx, yPx, graphRect) {
  const threshold = 10;
  let bestIdx = null, bestDist = Infinity;
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    const px = graphXtoPx(p.x, graphRect);
    const py = graphYtoPx(p.y, graphRect);
    const d = Math.hypot(px - xPx, py - yPx);
    if (d < threshold && d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ---------- Graph transforms ----------
function graphXtoPx(x) { return x * graph.width; }
function graphYtoPx(y) { return graph.height * (1 - (y + 1) / 2); }
function pxToGraphX(px) { return clamp(px / graph.width, 0, 1); }
function pxToGraphY(py) { return clamp(1 - (py / graph.height) * 2, -1, 1); }

// ---------- Graph rendering ----------
function drawGraph() {
  const curve = matrix[selected[0]][selected[1]];
  ensureEndpoints(curve);

  gctx.fillStyle = '#000';
  gctx.fillRect(0, 0, graph.width, graph.height);

  gctx.strokeStyle = '#444';
  gctx.beginPath();
  gctx.moveTo(0, graph.height / 2);
  gctx.lineTo(graph.width, graph.height / 2);
  gctx.stroke();

  gctx.strokeStyle = '#4aa3ff';
  gctx.lineWidth = 2;
  gctx.beginPath();
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    const x = graphXtoPx(p.x);
    const y = graphYtoPx(p.y);
    if (i === 0) gctx.moveTo(x, y);
    else gctx.lineTo(x, y);
  }
  gctx.stroke();

  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    const x = graphXtoPx(p.x);
    const y = graphYtoPx(p.y);
    const isEndpoint = (i === 0 || i === curve.length - 1);
    gctx.fillStyle = isEndpoint ? '#777' : colors[selected[1]];
    gctx.beginPath();
    gctx.arc(x, y, 6, 0, Math.PI * 2);
    gctx.fill();
  }
}

// ---------- Graph interactions ----------
graph.addEventListener('mousemove', e => {
  const rect = graph.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const curve = matrix[selected[0]][selected[1]];
  hoverPointIndex = nearestPointIndex(curve, x, y, rect);

  if (draggingPointIndex != null) {
    const prevX = draggingPointIndex > 0 ? curve[draggingPointIndex - 1].x : 0;
    const nextX = draggingPointIndex < curve.length - 1 ? curve[draggingPointIndex + 1].x : 1;
    let gx = pxToGraphX(x);
    let gy = pxToGraphY(y);
    // Prevent crossing neighbors; keep within (prevX, nextX)
    const margin = 0.01;
    gx = clamp(gx, prevX + margin, nextX - margin);

    // Lock endpoints X
    const isEndpoint = draggingPointIndex === 0 || draggingPointIndex === curve.length - 1;
    if (isEndpoint) gx = curve[draggingPointIndex].x;

    curve[draggingPointIndex].x = gx;
    curve[draggingPointIndex].y = gy;

    sortCurve(curve);
  }

  drawGraph();
});

graph.addEventListener('mousedown', (e) => {
  const rect = graph.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const curve = matrix[selected[0]][selected[1]];
  const idx = nearestPointIndex(curve, x, y, rect);

  if (e.button === 2) {
    // Right-click: delete nearest interior point
    if (idx != null) removePoint(curve, idx);
    drawGraph();
    return;
  }

  if (idx != null) {
    draggingPointIndex = idx;
  } else {
    // Click empty space: add a new point
    const gx = pxToGraphX(x, rect);
    const gy = pxToGraphY(y, rect);
    addPoint(curve, gx, gy);
    // Start dragging the newly inserted point
    for (let i = 0; i < curve.length; i++) {
      if (Math.abs(curve[i].x - gx) < 1e-6) {
        draggingPointIndex = i;
        break;
      }
    }
  }
  drawGraph();
});

graph.addEventListener('mouseup', () => {
  draggingPointIndex = null;
});

graph.addEventListener('mouseleave', () => {
  draggingPointIndex = null;
  hoverPointIndex = null;
  drawGraph();
});

// Prevent context menu on graph (for right-click delete UX)
graph.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Control wiring ----------

speciesInput.addEventListener('change', (e) => {
  speciesCount = +e.target.value;
  makeColors(speciesCount);
  matrix = makeMatrix(speciesCount); // default curves
  resetParticles();
  selected = [0, 0];
  buildMatrixUI();
  drawGraph();
});

countInput.addEventListener('change', (e) => {
  window.particleCount = +e.target.value;
  resetParticles();
});

rMaxInput.addEventListener('input', (e) => { rMax = +e.target.value; });
dtInput.addEventListener('input', (e) => { dt = +e.target.value; });
dampInput.addEventListener('input', (e) => { damp = +e.target.value; });

randomizeBtn.addEventListener('click', () => {
  for (let i = 0; i < speciesCount; i++) {
    for (let j = 0; j < speciesCount; j++) {
      matrix[i][j] = [
        { x: 0.0,  y: (Math.random() * 2 - 1) * 0.5 },
        { x: 0.33, y: (Math.random() * 2 - 1) },
        { x: 0.66, y: (Math.random() * 2 - 1) },
        { x: 1.0,  y: (Math.random() * 2 - 1) * 0.5 },
      ];
      sortCurve(matrix[i][j]);
      ensureEndpoints(matrix[i][j]);
    }
  }
  buildMatrixUI();
  drawGraph();
});

clearBtn.addEventListener('click', () => {
  for (let i = 0; i < speciesCount; i++) {
    for (let j = 0; j < speciesCount; j++) {
      matrix[i][j] = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    }
  }
  buildMatrixUI();
  drawGraph();
});

resetBtn.addEventListener('click', resetParticles);

// ---------- Init on load ----------
buildMatrixUI();
drawGraph();