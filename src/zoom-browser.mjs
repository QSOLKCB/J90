// J90 v0.3.2: precision-aware, bounded pointer/keyboard zoom in a separate lab.
import { state } from './core.mjs';
import { NOT_ESCAPED } from './nonlinear.mjs';
import { defaultViewport, pixelPoint, zoomAt, panBy, centreAt,
  renderZoom, compareBoundary } from './zoom.mjs';

const $ = id => document.getElementById(id);
const canvas = $('zoom-view'), ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas unsupported for zoom lab');
let view = defaultViewport('mandelbrot', canvas.width, canvas.height);
let overlay = false;
let dragStart = null;
const coordinates = event => {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(view.width, (event.clientX - rect.left) * view.width / rect.width)),
    y: Math.max(0, Math.min(view.height, (event.clientY - rect.top) * view.height / rect.height)) };
};

function paint(grid, comparison) {
  const image = ctx.createImageData(grid.width, grid.height);
  for (let k = 0; k < grid.pixels.length; k++) {
    const n = grid.pixels[k], escaped = n !== NOT_ESCAPED;
    const t = escaped ? n / grid.maxIterations : 0;
    const i = k * 4;
    image.data[i] = escaped ? Math.floor(28 + 172 * Math.sqrt(t)) : 7;
    image.data[i + 1] = escaped ? Math.floor(58 + 150 * (1 - t)) : 18;
    image.data[i + 2] = escaped ? Math.floor(98 + 147 * Math.sin(Math.PI * t)) : 30;
    if (comparison && comparison.mask[k] === 2) {
      image.data[i] = 255; image.data[i+1] = 62; image.data[i+2] = 179;
    } else if (comparison && comparison.mask[k] === 1) {
      image.data[i] = 255; image.data[i+1] = 205; image.data[i+2] = 85;
    }
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}
function draw() {
  const grid = renderZoom(view);
  // Compare only when overlay enabled: same finite work budget per grid.
  const comparison = overlay ? compareBoundary(view, grid) : null;
  paint(grid, comparison);
  $('zoom-centre').textContent = view.centre.x.toPrecision(10) + ' + ' +
    view.centre.y.toPrecision(10) + 'i';
  $('zoom-span').textContent = view.span.toExponential(3);
  $('zoom-iterations').textContent = String(grid.maxIterations);
  $('zoom-precision').textContent = grid.precision.status +
    ' (pitch / ULP ≈ ' + grid.precision.pixelPitchToUlp.toPrecision(3) + ')';
  $('zoom-escaped').textContent = String(grid.escaped);
  $('zoom-sensitive').textContent = comparison
    ? String(comparison.classificationChanges) + ' class / ' +
      String(comparison.iterationChanges) + ' iteration'
    : 'Overlay disabled';
  $('zoom-alert').textContent = grid.precision.status === 'NEAR_FLOAT64_RESOLUTION'
    ? 'Warning: viewport is approaching Float64 pixel resolution.'
    : 'Pixel coordinates remain distinguishable at this magnification.';
}
function apply(callback) {
  try {
    const next = callback();
    // Validate and render before committing a new view.
    const old = view;
    view = next;
    try { draw(); } catch (err) { view = old; throw err; }
  } catch (err) {
    $('zoom-alert').textContent = 'Precision guard: ' + err.message;
  }
}
function switchModel() {
  apply(() => ({ ...defaultViewport($('zoom-model').value, canvas.width, canvas.height),
    c: state(Number($('zoom-julia-real').value), Number($('zoom-julia-imag').value)) }));
}
$('zoom-model').addEventListener('change', switchModel);
for (const id of ['zoom-julia-real', 'zoom-julia-imag']) {
  $(id).addEventListener('input', () => apply(() => ({ ...view,
    c: state(Number($('zoom-julia-real').value), Number($('zoom-julia-imag').value)) })));
}
$('zoom-in').addEventListener('click', () =>
  apply(() => zoomAt(view, view.width / 2, view.height / 2, 1.6)));
$('zoom-out').addEventListener('click', () =>
  apply(() => zoomAt(view, view.width / 2, view.height / 2, 1 / 1.6)));
$('zoom-reset').addEventListener('click', switchModel);
$('zoom-overlay').addEventListener('click', () => {
  overlay = !overlay;
  try {
    draw();
  } catch (err) {
    // A shifted view may exceed the domain at an edge; restore the valid view.
    overlay = false;
    draw();
    $('zoom-alert').textContent = 'Sensitivity overlay unavailable: ' + err.message;
  }
  $('zoom-overlay').setAttribute('aria-pressed', String(overlay));
  $('zoom-overlay').textContent = overlay ? 'Hide sensitivity overlay' : 'Show sensitivity overlay';
});
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const p = coordinates(event);
  apply(() => zoomAt(view, p.x, p.y, event.deltaY < 0 ? 1.6 : 1 / 1.6));
}, { passive: false });
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  dragStart = coordinates(event);
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointerup', event => {
  if (!dragStart) return;
  const end = coordinates(event), start = dragStart;
  dragStart = null;
  if (Math.hypot(end.x - start.x, end.y - start.y) < 3)
    apply(() => centreAt(view, end.x, end.y));
  else
    apply(() => panBy(view, end.x - start.x, end.y - start.y));
  canvas.releasePointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointercancel', () => { dragStart = null; });
canvas.addEventListener('keydown', event => {
  const key = event.key;
  const actions = {
    '+': () => zoomAt(view, view.width / 2, view.height / 2, 1.6),
    '=': () => zoomAt(view, view.width / 2, view.height / 2, 1.6),
    '-': () => zoomAt(view, view.width / 2, view.height / 2, 1 / 1.6),
    ArrowLeft: () => panBy(view, 16, 0),
    ArrowRight: () => panBy(view, -16, 0),
    ArrowUp: () => panBy(view, 0, 16),
    ArrowDown: () => panBy(view, 0, -16),
    Home: () => ({ ...defaultViewport(view.model, view.width, view.height),
      c: state(Number($('zoom-julia-real').value), Number($('zoom-julia-imag').value)) })
  };
  if (!actions[key]) return;
  event.preventDefault();
  apply(actions[key]);
});
draw();
