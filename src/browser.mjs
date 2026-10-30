import { state, rotate, evolve, distance, energy } from './core.mjs';

const $ = id => document.getElementById(id);
const fields = ['phase', 'omega', 'damping', 'gap'];
const colors = { x: '#ffbd77', y: '#aeb8ff', result: '#71ffd3' };
let animate = false;
// Preserve sub-degree motion independently of the integer-step range control.
let phaseDegrees = Number($('phase').value);
let last = null;
const circle = $('orbit');
const wave = $('wave');
const orbitCtx = circle.getContext('2d');
const waveCtx = wave.getContext('2d');
if (!orbitCtx || !waveCtx) throw new Error('2D canvas unsupported');

function line(ctx, x0, y0, x1, y1, color, width = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
function drawOrbit(s) {
  const ctx = orbitCtx, w = circle.width, h = circle.height;
  const cx = w / 2, cy = h / 2, radius = 190;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#254055'; ctx.lineWidth = 1.5;
  for (const r of [radius / 2, radius]) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  line(ctx, 54, cy, w - 54, cy, '#3d596d');
  line(ctx, cx, 54, cx, h - 54, '#3d596d');
  const x = cx + s.x * radius, y = cy - s.y * radius;
  line(ctx, cx, cy, x, cy, colors.x, 6);
  line(ctx, x, cy, x, y, colors.y, 6);
  line(ctx, cx, cy, x, y, colors.result, 4);
  ctx.fillStyle = colors.result; ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#91a9bc'; ctx.font = '17px monospace';
  ctx.fillText('X', w - 51, cy - 13); ctx.fillText('Y', cx + 14, 35);
  ctx.fillText('0', cx + 9, cy + 22);
}
function drawWave(initial, omega, damping) {
  const ctx = waveCtx, w = wave.width, h = wave.height, pad = 45;
  ctx.clearRect(0, 0, w, h);
  const sx = t => pad + (w - 2 * pad) * (t / 12);
  const sy = y => h / 2 - (h / 2 - 35) * y;
  for (const y of [-1, -.5, 0, .5, 1]) {
    line(ctx, pad, sy(y), w - pad, sy(y), '#273a4d');
    ctx.fillStyle = '#7893a5'; ctx.font = '13px monospace'; ctx.fillText(String(y), 8, sy(y) + 4);
  }
  for (const [key, color] of [['x', colors.x], ['y', colors.y]]) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 3;
    for (let i = 0; i <= 440; i++) {
      const t = 12 * i / 440;
      const v = evolve(initial, { omega, damping, duration: t })[key];
      if (i === 0) ctx.moveTo(sx(t), sy(v)); else ctx.lineTo(sx(t), sy(v));
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#9db6c8'; ctx.font = '13px monospace';
  ctx.fillText('t = 0', pad, h - 10); ctx.fillText('t = 12', w - 90, h - 10);
}
function render() {
  const deg = phaseDegrees;
  const omega = Number($('omega').value);
  const damping = Number($('damping').value);
  const gap = Number($('gap').value);
  const initial = rotate(state(1, 0), deg * Math.PI / 180);
  const pre = evolve(initial, { omega, damping, duration: 1 });
  const noGap = evolve(pre, { omega, damping, duration: 1 });
  const resumed = evolve(pre, { omega, damping, duration: 1 });
  const continuous = evolve(pre, { omega, damping, duration: gap + 1 });
  $('phase-value').textContent = deg.toFixed(1) + '°';
  $('omega-value').textContent = omega.toFixed(2);
  $('damping-value').textContent = damping.toFixed(2);
  $('gap-value').textContent = gap.toFixed(1);
  $('energy').textContent = energy(initial).toFixed(6);
  $('replay').textContent = distance(noGap, resumed).toFixed(6);
  $('continued').textContent = distance(continuous, resumed).toFixed(6);
  $('verdict').textContent = gap === 0 ? 'Null control: no gap exists; both arms have the same input.' :
    'The paused arm contains no gap signal. Continued evolution differs by ' +
    distance(continuous, resumed).toFixed(6) +
    ' state units; this is not a measure of life or awareness.';
  drawOrbit(initial);
  drawWave(initial, omega, damping);
}
for (const field of fields) $(field).addEventListener('input', () => {
  if (field === 'phase') phaseDegrees = Number($('phase').value);
  render();
});
$('animate').addEventListener('click', () => {
  animate = !animate;
  $('animate').setAttribute('aria-pressed', String(animate));
  $('animate').textContent = animate ? '❚❚ PAUSE ANIMATION' : '▶ ANIMATE PHASE';
  last = null;
});
function tick(now) {
  if (animate) {
    if (last !== null) {
      phaseDegrees = (phaseDegrees + (now - last) * .06) % 360;
      $('phase').value = String(phaseDegrees);
    }
    render();
  }
  last = now;
  requestAnimationFrame(tick);
}
render();
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) animate = false;
requestAnimationFrame(tick);
