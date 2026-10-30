// Pure real-axis numerical experiment, separate from the linear oscillator clock.
import { state } from './core.mjs';
import { realAxisSweep, realOrbit, derivativeTrace } from './stability.mjs';
const $ = id => document.getElementById(id);
const canvas = $('stability-plot');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas unsupported for stability plot');
const sweep = realAxisSweep({ steps: 240, samples: 32, burnIn: 160 });
const width = canvas.width, height = canvas.height;
function xFor(c) { return (c - sweep.cMin) * width / (sweep.cMax - sweep.cMin); }
function yFor(value) { return height * (2 - value) / 4; }
function plot() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1420'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#344657'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  ctx.fillStyle = '#71ffd3';
  for (const row of sweep.rows) {
    for (const value of row.tail) {
      const x = xFor(row.c), y = yFor(value);
      if (y >= 0 && y < height) ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
}
function renderSelection() {
  const c = Number($('stability-c').value);
  const orbit = realOrbit({ c, burnIn: 160, samples: 32 });
  const trace = derivativeTrace({ initial: state(0.5, 0), c: state(c, 0), steps: 5 });
  const maxError = trace.rows.reduce((m, row) => Math.max(m, row.absoluteDifference), 0);
  plot();
  ctx.strokeStyle = '#ffbd77'; ctx.lineWidth = 2;
  const x = xFor(c);
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  $('stability-c-value').textContent = c.toFixed(3);
  $('stability-period').textContent = orbit.escaped
    ? 'Escaped' : orbit.candidatePeriod === null ? 'Undetermined' : String(orbit.candidatePeriod);
  $('stability-escaped').textContent = String(orbit.escaped);
  $('stability-count').textContent = String(sweep.steps);
  $('stability-residual').textContent = maxError.toExponential(2);
  $('stability-explanation').textContent = 'Finite-window candidate periods are not exact proofs. An absent candidate is not proof of chaos. Sensitivity uses a bounded tangent versus finite-difference comparison.';
}
$('stability-c').addEventListener('input', renderSelection);
renderSelection();
