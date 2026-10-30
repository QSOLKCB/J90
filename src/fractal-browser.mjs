// Independent, deterministic view for the quadratic complex map.
// No relationship to the v0.1 oscillator's animation clock.
import { state } from './core.mjs';
import { gridEscapeTimes, compareSensitivity } from './nonlinear.mjs';
const $ = id => document.getElementById(id);
const canvas = $('fractal-view');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas unsupported for nonlinear portrait');

function draw() {
  const model = $('fractal-model').value;
  const maxIterations = Number($('fractal-budget').value);
  const c = state(Number($('julia-real').value), Number($('julia-imag').value));
  const data = gridEscapeTimes({ model, c, width: canvas.width, height: canvas.height,
    maxIterations, centre: model === 'julia' ? state(0, 0) : state(-0.5, 0),
    span: model === 'julia' ? 3.3 : 3.2 });
  const image = ctx.createImageData(data.width, data.height);
  for (let k = 0; k < data.pixels.length; k++) {
    const escaped = data.pixels[k] < maxIterations;
    const t = escaped ? data.pixels[k] / maxIterations : 0;
    const i = k * 4;
    image.data[i] = escaped ? Math.floor(32 + 182 * Math.sqrt(t)) : 7;
    image.data[i + 1] = escaped ? Math.floor(58 + 149 * (1 - t)) : 17;
    image.data[i + 2] = escaped ? Math.floor(94 + 145 * Math.sin(Math.PI * t)) : 30;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const sensitivity = compareSensitivity();
  $('fractal-budget-value').textContent = String(maxIterations);
  $('julia-real-value').textContent = c.x.toFixed(3);
  $('julia-imag-value').textContent = c.y.toFixed(3);
  $('fractal-escaped').textContent = String(data.escaped);
  $('fractal-bounded').textContent = String(data.notEscaped);
  $('fractal-linear-ratio').textContent = sensitivity.linearRatio.toFixed(3);
  $('fractal-quadratic-ratio').textContent = sensitivity.quadraticRatio.toFixed(3);
  $('fractal-summary').textContent = model === 'mandelbrot'
    ? 'Mandelbrot: sample c per pixel, start z at zero. Dark means only non-escape within this finite budget.'
    : 'Julia: sample starting z per pixel, hold c fixed. The 90° oscillator remains a separate model.';
  const julia = model === 'julia';
  for (const id of ['julia-real', 'julia-imag']) $(id).disabled = !julia;
}
for (const id of ['fractal-model', 'fractal-budget', 'julia-real', 'julia-imag']) {
  $(id).addEventListener('input', draw);
  $(id).addEventListener('change', draw);
}
draw();
