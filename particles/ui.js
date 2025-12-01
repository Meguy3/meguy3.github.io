// ui.js
// Matrix with colored circle headers + multi-point graph editor for A[i][j] curves.
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

let selected = [0, 0];          // currently edited pair (i,j)
let draggingPointIndex = null;  // index in curve being dragged
let hoverPointIndex = null;     // index for hover highlight

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
    th.style.color = colors[j]; // color-coded text
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  // Body rows
  for (let i = 0; i < speciesCount; i++) {
    const tr = document.createElement('tr');

    // Row header
    const rowTh = document.createElement('th');
    rowTh.textContent = i;
    rowTh.className = 'species-label';
    rowTh.style.color = colors[i]; // color-coded text
    tr.appendChild(rowTh);

    for (let j = 0; j < speciesCount; j++) {
      const td = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = 'matrix-btn';
      btn.title = `Edit A[${i}][${j}] curve`;
      btn.addEventListener('click', () => {
        selected = [i, j];
        document.querySelectorAll('.matrix-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        drawGraph();
      });
      if (i === selected[0] && j === selected[1]) btn.classList.add('selected');
      td.appendChild(btn);
      tr.appendChild(td);
    }

    table.appendChild(tr);
  }

  matrixDiv.appendChild(table);
}

// ---------- Curve utilities ----------

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function sortCurve(curve) {
  curve.sort((a, b) => a.x - b.x);
}

function dedupeCurve(curve) {
  // Remove points with identical x (keep latest)
  for (let i = curve.length - 2; i >= 0; i--) {
    if (Math.abs(curve[i].x - curve[i + 1].x) < 1e-6) curve.splice(i, 1);
  }
}

function ensureEndpoints(curve) {
  // Ensure points at x=0 and x=1 exist
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
  // Keep endpoints; allow removal of interior points
  if (index <= 0 || index >= curve.length - 1) return;
  curve.splice(index, 1);
}

function nearestPointIndex(curve, xPx, yPx, graphRect) {
  // Find nearest control point in pixel space
  const threshold = 10; // pixels
  let bestIdx = null;
  let bestDist = Infinity;

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

// ---------- Graph coordinate transforms ----------

function graphXtoPx(x, rect) {
  // x in [0,1] to pixel inside graph canvas
  return x * graph.width;
}
function graphYtoPx(y, rect) {
  // y in [-1,1] to pixel; top=+1, bottom=-1
  return graph.height * (1 - (y + 1) / 2);
}
function pxToGraphX(px, rect) {
  return clamp(px / graph.width, 0, 1);
}
function pxToGraphY(py, rect) {
  const y = 1 - (py / graph.height) * 2;
  return clamp(y, -1, 1);
}

// ---------- Graph rendering ----------

function drawGraph() {
  const curve = matrix[selected[0]][selected[1]];
  ensureEndpoints(curve);

  // Background
  gctx.fillStyle = '#000';
  gctx.fillRect(0, 0, graph.width, graph.height);

  // Zero line
  gctx.strokeStyle = '#444';
  gctx.beginPath();
  gctx.moveTo(0, graph.height / 2);
  gctx.lineTo(graph.width, graph.height / 2);
  gctx.stroke();

  // Grid (optional light verticals)
  gctx.strokeStyle = '#222';
  for (let t = 0.25; t < 1; t += 0.25) {
    gctx.beginPath();
    gctx.moveTo(graphXtoPx(t), 0);
    gctx.lineTo(graphXtoPx(t), graph.height);
    gctx.stroke();
  }

  // Curve path
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

  // Control points
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    const x = graphXtoPx(p.x);
    const y = graphYtoPx(p.y);
    const isEndpoint = (i === 0 || i === curve.length - 1);

    gctx.fillStyle = isEndpoint ? '#777' : colors[selected[1]];
    gctx.beginPath();
    gctx.arc(x, y, 6, 0, Math.PI * 2);
    gctx.fill();

    // Hover or dragging highlight
    if (i === hoverPointIndex || i === draggingPointIndex) {
      gctx.strokeStyle = '#fff';
      gctx.lineWidth = 2;
      gctx.beginPath();
      gctx.arc(x, y, 8, 0, Math.PI * 2);
      gctx.stroke();
    }
  }

  // Label
  gctx.fillStyle = '#bbb';
  gctx.font = '12px system-ui';
  gctx.fillText(`A[${selected[0]}][${selected[1]}] curve`, 8, 16);
}

// ---------- Graph interactions ----------

graph.addEventListener('mousemove', (e) => {
  const rect = graph.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const curve = matrix[selected[0]][selected[1]];
  hoverPointIndex = nearestPointIndex(curve, x, y, rect);

  if (draggingPointIndex != null) {
    // Drag point with constraints
    const prevX = draggingPointIndex > 0 ? curve[draggingPointIndex - 1].x : 0;
    const nextX = draggingPointIndex < curve.length - 1 ? curve[draggingPointIndex + 1].x : 1;

    let gx = pxToGraphX(x, rect);
    let gy = pxToGraphY(y, rect);

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
    // Start dragging the newly inserted point (find its index)
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
  // particleCount is read in sim.js; we just trigger reset
  window.particleCount = +e.target.value; // expose to sim.js loop if needed
  resetParticles();
});

rMaxInput.addEventListener('input', (e) => { rMax = +e.target.value; });
dtInput.addEventListener('input', (e) => { dt = +e.target.value; });
dampInput.addEventListener('input', (e) => { damp = +e.target.value; });

randomizeBtn.addEventListener('click', () => {
  // For each pair, create a 4-point curve with random y; fixed x at 0, ~0.33, ~0.66, 1
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
  // Set all curves to flat zero line (two endpoints)
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
// --- IGNORE ---