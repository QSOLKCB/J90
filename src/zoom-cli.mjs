#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonical } from './checkpoint.mjs';
import { state } from './core.mjs';
import { defaultViewport, renderZoom, compareBoundary, zoomAt } from './zoom.mjs';

function hash(content) { return createHash('sha256').update(content).digest('hex'); }
// Explicit little-endian encoding; do not hash platform-native Uint16Array bytes.
function pixelBytes(values) {
  const b = Buffer.alloc(values.length * 2);
  values.forEach((value, i) => b.writeUInt16LE(value, i * 2));
  return b;
}
const FIXTURES = [
  { id: 'mandelbrot-wide', ...defaultViewport('mandelbrot', 32, 24) },
  { id: 'julia-wide', ...defaultViewport('julia', 32, 24) },
  { id: 'mandelbrot-zoom', ...defaultViewport('mandelbrot', 32, 24),
    centre: state(-0.7435, 0.1314), span: 0.3 }
];
const args = process.argv.slice(2);
if (args.length) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: npm run zoom — fixed deterministic zoom receipts and Python verification');
  } else {
    console.error('J90 zoom: unexpected arguments'); process.exitCode = 1;
  }
} else {
  try {
    const cases = FIXTURES.map(({ id, ...view }) => {
      const result = renderZoom(view);
      return { id, view, maxIterations: result.maxIterations, escaped: result.escaped,
        notEscaped: result.notEscaped, precision: result.precision,
        pixelsSHA256: hash(pixelBytes(result.pixels)),
        pixels: result.pixels };
    });
    const request = { protocol: 'j90-zoom-crosscheck-v1',
      cases: cases.map(row => ({ id: row.id, model: row.view.model, width: row.view.width,
        height: row.view.height, centre: row.view.centre, span: row.view.span,
        c: row.view.c, iterations: row.maxIterations })) };
    const script = fileURLToPath(new URL('../scripts/zoom_oracle.py', import.meta.url));
    const proc = spawnSync('python3', [script], {
      input: JSON.stringify(request), encoding: 'utf8', shell: false,
      maxBuffer: 1024 * 1024, timeout: 10000
    });
    if (proc.status !== 0 || proc.error || proc.signal)
      throw new Error('Python verification failed: ' + (proc.error?.message || proc.stderr || proc.signal || proc.status));
    const response = JSON.parse(proc.stdout);
    if (response.protocol !== request.protocol || response.runtime !== 'python-stdlib' ||
        !Array.isArray(response.cases) || response.cases.length !== cases.length)
      throw new TypeError('bad Python response');
    const comparisons = cases.map((row, i) => {
      const other = response.cases[i];
      if (other.id !== row.id || !Array.isArray(other.pixels) ||
          other.pixels.length !== row.pixels.length) throw new TypeError('Python case identity/size mismatch');
      let differences = 0;
      for (let k = 0; k < other.pixels.length; k++) {
        if (!Number.isSafeInteger(other.pixels[k]) || other.pixels[k] < 0 ||
            other.pixels[k] > 65535) throw new TypeError('invalid Python pixel');
        differences += Number(other.pixels[k] !== row.pixels[k]);
      }
      return { id: row.id, comparedPixels: row.pixels.length, differences,
        passed: differences === 0 };
    });
    const zoomed = zoomAt(defaultViewport('mandelbrot', 48, 32), 24, 16, 1.6);
    const boundary = compareBoundary(zoomed);
    const report = {
      protocol: 'j90-precision-zoom-v1', version: '0.3.2',
      crossRuntime: { runtime: 'python-stdlib', comparisons,
        totalComparedPixels: comparisons.reduce((n, x) => n + x.comparedPixels, 0),
        totalMismatches: comparisons.reduce((n, x) => n + x.differences, 0) },
      fixtures: cases.map(({ pixels, ...meta }) => meta),
      sensitivity: { classificationChanges: boundary.classificationChanges,
        iterationChanges: boundary.iterationChanges, comparedPixels: boundary.comparedPixels },
      constraints: { coordinateCollisionsReject: true, minSpan: 1e-15, maxIterations: 192,
        pixelEncoding: 'uint16-little-endian' },
      caveat: 'Numerical classification differences are not proof of mathematical chaos, consciousness or new physics.'
    };
    const output = { ...report, reportSHA256: hash(canonical(report)) };
    console.log(JSON.stringify(output, null, 2));
    if (comparisons.some(x => !x.passed)) process.exitCode = 1;
  } catch (error) {
    console.error('J90 zoom: ' + error.message);
    process.exitCode = 1;
  }
}
