const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
resize(); window.addEventListener('resize', resize);

function resize() {
  canvas.width = window.innerWidth - 340;
  canvas.height = window.innerHeight;
}

let speciesCount = +document.getElementById('speciesCount').value;
let particleCount = +document.getElementById('particleCount').value;
let rMax = +document.getElementById('rMax').value;
let dt = +document.getElementById('dt').value;
let damp = +document.getElementById('damp').value;

let colors = [];
let matrix = [];
let particles = [];

function makeColors(n) {
  colors = Array.from({ length: n }, (_, i) => `hsl(${360 * i / n},70%,60%)`);
}
function makeMatrix(n) {
  // Each entry is an array of control points [{x:dist,y:value},...]
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => [{ x: 0, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }])
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
  // rNorm in [0,1], linear interpolate between control points
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
    let fx = 0, fy = 0;
    for (let q = 0; q < particles.length; q++) {
      if (p === q) continue;
      const b = particles[q];
      let dx = b.x - a.x, dy = b.y - a.y;
      let r2 = dx * dx + dy * dy;
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
    a.x += dt * a.vx;
    a.y += dt * a.vy;
    if (a.x < 0) a.x += canvas.width;
    if (a.x >= canvas.width) a.x -= canvas.width;
    if (a.y < 0) a.y += canvas.height;
    if (a.y >= canvas.height) a.y -= canvas.height;
  }
}

function draw() {
  ctx.fillStyle = 'rgba(17,17,17,0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    ctx.fillStyle = colors[p.s];
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}

function loop() { step(); draw(); requestAnimationFrame(loop); }

// Init
makeColors(speciesCount);
matrix = makeMatrix(speciesCount);
resetParticles();
loop();
// --- IGNORE ---