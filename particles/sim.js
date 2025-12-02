let wrapMode = false; // false = walls, true = wrap
document.getElementById('toggleMode').addEventListener('click', () => {
  wrapMode = !wrapMode;
  console.log("Wrap mode:", wrapMode);
  document.getElementById('toggleMode').textContent = wrapMode ? "Wrap Mode" : "Wall Mode";
});
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
resize(); window.addEventListener('resize', resize);
// IndexedDB setup
let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("SimulationDB", 2);
    request.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains("clipboard")) {
        db.createObjectStore("clipboard", { keyPath: "id" });
      }
    };
    request.onsuccess = e => { db = e.target.result; resolve(db); };
    request.onerror = e => reject(e);
  });
}

async function saveClipboard(particles, matrix, speciesCount) {
  await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("clipboard", "readwrite");
    const store = tx.objectStore("clipboard");
    store.put({ id: "current", particles, matrix, speciesCount });
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e);
  });
}

async function loadClipboard() {
  await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("clipboard", "readonly");
    const store = tx.objectStore("clipboard");
    const req = store.get("current");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = e => reject(e);
  });
}


function resize() {
  canvas.width = window.innerWidth - 340;
  canvas.height = window.innerHeight;
}

let speciesCount = +document.getElementById('speciesCount').value;
let particleCount = +document.getElementById('particleCount').value;
let rMax = +document.getElementById('rMax').value;
let dt = +document.getElementById('dt').value;
let damp = +document.getElementById('damp').value;
let trail = +document.getElementById('trail').value;

let particleSize = +document.getElementById('particleSize').value;
document.getElementById('particleSize').addEventListener('input', e => {
  particleSize = +e.target.value;
});
document.getElementById('damp').addEventListener('input', e => {
  damp = +e.target.value;
});
document.getElementById('rMax').addEventListener('input', e => {
  rMax = +e.target.value;
});
document.getElementById('dt').addEventListener('input', e => {
  dt = +e.target.value;
});
document.getElementById('particleCount').addEventListener('input', e => {
  particleCount = +e.target.value;
});
document.getElementById('trail').addEventListener('input', e => {
  trail = +e.target.value;
});


let colors = [];
let matrix = [];
let particles = [];

function makeColors(n) {
  colors = Array.from({ length: n }, (_, i) => `hsl(${360 * i / n},70%,60%)`);
}
function makeMatrix(n) {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => [
      { x: 0, y: -0.5 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 }
    ])
  );
}
function resetParticles() {
  particles = Array.from({ length: particleCount }, (_, k) => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    s: k % speciesCount,
  }));
}

function interpCurve(curve, rNorm) {
  for (let i = 0; i < curve.length - 1; i++) {
    const p1 = curve[i], p2 = curve[i + 1];
    if (rNorm >= p1.x && rNorm <= p2.x) {
      const t = (rNorm - p1.x) / (p2.x - p1.x);
      return p1.y * (1 - t) + p2.y * t;
    }
  }
  return 0;
}

function step() {
  for (let p = 0; p < particles.length; p++) {
    const a = particles[p];
    if (a.paused) continue;
    let fx = 0, fy = 0;
    for (let q = 0; q < particles.length; q++) {
      if (p === q) continue;
      const b = particles[q];
      if (b.paused) continue;

      let dx = b.x - a.x;
      let dy = b.y - a.y;

      if (wrapMode) {
        // wrap-aware distances
        if (dx > canvas.width/2) dx -= canvas.width;
        if (dx < -canvas.width/2) dx += canvas.width;
        if (dy > canvas.height/2) dy -= canvas.height;
        if (dy < -canvas.height/2) dy += canvas.height;
      }

      let r2 = dx*dx + dy*dy;
      if (r2 === 0) continue;
      let r = Math.sqrt(r2);
      if (r > rMax) continue;
      dx /= r; dy /= r;
      const curve = matrix[a.s][b.s];
      const val = interpCurve(curve, r / rMax);
      fx += val * dx;
      fy += val * dy;
    }
    a.vx = (a.vx + dt * fx) * (1 - damp);
    a.vy = (a.vy + dt * fy) * (1 - damp);
  }

  for (const a of particles) {
    if (a.paused) continue;
    a.x += dt * a.vx;
    a.y += dt * a.vy;

    if (wrapMode) {
      // teleport across edges
      if (a.x < 0) a.x += canvas.width;
      if (a.x >= canvas.width) a.x -= canvas.width;
      if (a.y < 0) a.y += canvas.height;
      if (a.y >= canvas.height) a.y -= canvas.height;
    } else {
      // stop at walls
      if (a.x < 0) { a.x = 0; a.vx = 0; }
      if (a.x > canvas.width) { a.x = canvas.width; a.vx = 0; }
      if (a.y < 0) { a.y = 0; a.vy = 0; }
      if (a.y > canvas.height) { a.y = canvas.height; a.vy = 0; }
    }
  }
}

function draw() {
  ctx.fillStyle = `rgba(17,17,17,${1-trail})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    ctx.fillStyle = colors[p.s];
    ctx.beginPath();
    ctx.arc(p.x, p.y, particleSize, 0, Math.PI * 2);
    ctx.fill();
  }

  if (dragCircle) {
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.arc(dragCircle.x, dragCircle.y, dragCircle.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (selectionMode && selectionRect) {
  ctx.strokeStyle = '#0f0';
  ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
  }

}

let frozen = false;
document.getElementById('freeze').addEventListener('click', () => {
  frozen = !frozen;
});

document.getElementById('zap').addEventListener('click', () => {
  for (const p of particles) {
    p.vx = (Math.random() - 0.5) * 20;
    p.vy = (Math.random() - 0.5) * 20;
  }
});

// Drag circle
let dragCircle = null;
let draggedParticles = [];

// Selection box
let selectingBox = false;
let selectionStart = null;
let selectionRect = null;
let selectedParticles = [];
let copiedParticles = [];
let draggingSelection = false;   // dragging the box itself
let selectionMode = false;       // toggle with 'q' key
let keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

let lastMouseX = 0, lastMouseY = 0;
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'q') {
    selectionMode = !selectionMode;
    if (!selectionMode) {
      selectionRect = null;
      for (const p of selectedParticles) p.paused = false;
      selectedParticles = [];
    }
  }
});


document.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});
canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (selectionMode) {
    if (selectionRect) {
      // clicked inside existing box → drag it
      if (x >= selectionRect.x && x <= selectionRect.x + selectionRect.w &&
          y >= selectionRect.y && y <= selectionRect.y + selectionRect.h) {
        draggingSelection = true;
      }
    } else {
      // start new box
      selectionRect = { x, y, w: 0, h: 0 };
      selectedParticles = [];
    }
  } else {
    // normal drag circle
    dragCircle = { x, y, radius: 20 };
    draggedParticles = particles.filter(p => Math.hypot(p.x - x, p.y - y) <= dragCircle.radius);
    for (const p of draggedParticles) {
      p.vx = 0; p.vy = 0; p.paused = true;
    }
  }
});


canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // --- Drag circle mode ---
  if (dragCircle) {
    const dx = x - lastMouseX;
    const dy = y - lastMouseY;
    dragCircle.x = x;
    dragCircle.y = y;
    for (const p of draggedParticles) {
      p.x += dx;
      p.y += dy;
    }
  }

  // --- Selection box mode ---
  if (selectionMode) {
    if (draggingSelection && selectionRect) {
      // move the box and all selected particles together
      const dx = x - lastMouseX;
      const dy = y - lastMouseY;
      selectionRect.x += dx;
      selectionRect.y += dy;
      for (const p of selectedParticles) {
        p.x += dx;
        p.y += dy;
      }
    } else if (selectionRect && selectedParticles.length === 0) {
      // still drawing the initial box before mouseup
      selectionRect.w = x - selectionRect.x;
      selectionRect.h = y - selectionRect.y;
    }
  }

  lastMouseX = x;
  lastMouseY = y;
});

canvas.addEventListener('mouseup', () => {
  if (!selectionMode) {
    // release drag circle
    for (const p of draggedParticles) p.paused = false;
    dragCircle = null;
    draggedParticles = [];
  } else {
    // release selection drag
    draggingSelection = false;
    if (selectedParticles.length === 0 && selectionRect) {
      // finalize selection once
      selectedParticles = particles.filter(p =>
        p.x >= Math.min(selectionRect.x, selectionRect.x + selectionRect.w) &&
        p.x <= Math.max(selectionRect.x, selectionRect.x + selectionRect.w) &&
        p.y >= Math.min(selectionRect.y, selectionRect.y + selectionRect.h) &&
        p.y <= Math.max(selectionRect.y, selectionRect.y + selectionRect.h)
      );
      for (const p of selectedParticles) {
        p.vx = 0; p.vy = 0; p.paused = true;
      }
    }
  }
});

document.addEventListener('keydown', async e => {
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    let toCopy = [];
    if (dragCircle && draggedParticles.length > 0) {
      toCopy = draggedParticles.map(p => ({ x: p.x, y: p.y, s: p.s }));
    } else if (selectedParticles.length > 0) {
      toCopy = selectedParticles.map(p => ({ x: p.x, y: p.y, s: p.s }));
    }
    if (toCopy.length > 0) {
      await saveClipboard(toCopy, matrix, speciesCount);
      console.log("Copied", toCopy.length, "particles + matrix to IndexedDB");
    }
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'v') {
    const state = await loadClipboard();
    if (state) {
      // restore matrix and species count
      matrix = state.matrix;
      speciesCount = state.speciesCount;
      makeColors(speciesCount);

      // paste particles at cursor
      const dx = lastMouseX - state.particles[0].x;
      const dy = lastMouseY - state.particles[0].y;
      for (const cp of state.particles) {
        particles.push({
          x: cp.x + dx,
          y: cp.y + dy,
          vx: 0, vy: 0,
          s: cp.s
        });
      }
      console.log("Pasted", state.particles.length, "particles and restored matrix");
    }
  }
});



// Save & Load
document.getElementById('save').addEventListener('click', () => {
  const state = {
    speciesCount,
    particleCount,
    rMax,
    dt,
    damp,
    particleSize,
    matrix,
    particles
  };

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "simulation.json";
  a.click();

  URL.revokeObjectURL(url);
});
document.getElementById('load').addEventListener('click', () => {
  document.getElementById('loadFile').click();
});

document.getElementById('loadFile').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const state = JSON.parse(e.target.result);

    // Restore values
    speciesCount = state.speciesCount;
    particleCount = state.particleCount;
    rMax = state.rMax;
    dt = state.dt;
    damp = state.damp;
    particleSize = state.particleSize;
    matrix = state.matrix;
    particles = state.particles;

    // Update UI inputs
    document.getElementById('speciesCount').value = speciesCount;
    document.getElementById('particleCount').value = particleCount;
    document.getElementById('rMax').value = rMax;
    document.getElementById('dt').value = dt;
    document.getElementById('damp').value = damp;
    document.getElementById('particleSize').value = particleSize;

    makeColors(speciesCount);
    console.log("Simulation loaded from file");
  };
  reader.readAsText(file);
});
document.getElementById('loadExample').addEventListener('click', () => {
  fetch('triGlider.json')
  .then(response => response.json())
  .then(state => {
      // Restore values
      speciesCount = state.speciesCount;
      particleCount = state.particleCount;
      rMax = state.rMax;
      dt = state.dt;
      damp = state.damp;
      particleSize = state.particleSize;
      matrix = state.matrix;
      particles = state.particles;

      // Update UI inputs
      document.getElementById('speciesCount').value = speciesCount;
      document.getElementById('particleCount').value = particleCount;
      document.getElementById('rMax').value = rMax;
      document.getElementById('dt').value = dt;
      document.getElementById('damp').value = damp;
      document.getElementById('particleSize').value = particleSize;

      makeColors(speciesCount);
      console.log("Simulation loaded from example");
    });
});


function loop() {
  if (!frozen) step();
  draw();
  requestAnimationFrame(loop);
}

// Init
makeColors(speciesCount);
matrix = makeMatrix(speciesCount);
resetParticles();
loop();
