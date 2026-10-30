import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/core.mjs';
import { NOT_ESCAPED } from '../src/nonlinear.mjs';
import { defaultViewport, pixelPoint, precisionReport, adaptiveIterations,
  zoomAt, centreAt, panBy, renderZoom, compareBoundary } from '../src/zoom.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('viewport mapping has a deterministic rectangular aspect ratio', () => {
  const v = defaultViewport('mandelbrot', 32, 24);
  assert.deepEqual(pixelPoint(v, 16, 12), v.centre);
  assert.equal(pixelPoint(v, 0, 12).x, v.centre.x - v.span / 2);
  assert.equal(pixelPoint(v, 16, 0).y, v.span * 24 / 32 / 2);
  assert.equal(precisionReport(v).status, 'RESOLVED');
  const julia = precisionReport(defaultViewport('julia', 32, 24));
  assert.equal(Number.isFinite(julia.pixelPitchToUlp), true);
  assert.equal(julia.ratioSaturated, true);
  assert.equal(adaptiveIterations(v), 64);
});
test('zoom is anchored at the cursor, can pan and reset', () => {
  const v = defaultViewport('julia', 32, 24);
  const oldPoint = pixelPoint(v, 9, 7);
  const z = zoomAt(v, 9, 7, 2);
  const nextPoint = pixelPoint(z, 9, 7);
  assert.ok(Math.hypot(oldPoint.x - nextPoint.x, oldPoint.y - nextPoint.y) < 1e-12);
  assert.equal(z.span, 1.6);
  assert.deepEqual(panBy(z, 4, -2).centre,
    state(z.centre.x - 4 * z.span / z.width, z.centre.y - 2 * z.span / z.width));
  assert.deepEqual(centreAt(v, 16, 12).centre, v.centre);
  assert.deepEqual(defaultViewport('julia', 32, 24), v);
});
test('iteration budget grows with zoom but remains capped', () => {
  const v = defaultViewport('mandelbrot', 32, 24);
  assert.equal(adaptiveIterations({ ...v, span: 0.8 }), 80);
  assert.equal(adaptiveIterations({ ...v, span: 3.2 / 2 ** 30 }), 192);
  assert.equal(renderZoom({ ...v, span: 0.8 }).maxIterations, 80);
});
test('watchdog rejects actual adjacent-coordinate collisions', () => {
  const base = defaultViewport('mandelbrot');
  const deep = { ...base, centre: state(-0.7435, 0.1314), span: 1e-15 };
  const r = precisionReport(deep);
  assert.ok(r.duplicateX + r.duplicateY > 0);
  assert.equal(r.status, 'BLOCKED_COORDINATE_COLLISION');
  assert.throws(() => renderZoom(deep), /collide/);
  assert.throws(() => zoomAt({ ...deep, span: 1e-14 }, 88, 56, 4), /collide|range/);
});
test('vertical collision watchdog matches renderer float64 operation order', () => {
  const v = { ...defaultViewport('julia', 13, 21),
    centre: state(0, 1.25), span: 2.7422508708241366e-15 };
  const verticalSpan = v.span * v.height / v.width;
  let prev;
  let collisions = 0;
  for (let y = 0; y < v.height; y++) {
    const value = v.centre.y + (v.height / 2 - y - 0.5) * verticalSpan / v.height;
    if (y > 0 && value === prev) collisions++;
    prev = value;
  }
  assert.ok(collisions > 0, 'renderer must have at least one vertical collision');
  const report = precisionReport(v);
  assert.equal(report.duplicateY, collisions);
  assert.equal(report.status, 'BLOCKED_COORDINATE_COLLISION');
  assert.throws(() => renderZoom(v), /collide/);
});

test('unrepresentable quarter-pixel shift is not reported as sensitivity', () => {
  const v = { ...defaultViewport('mandelbrot', 32, 24),
    centre: state(-0.7435, 0.1314), span: 4e-15 };
  assert.equal(precisionReport(v).status, 'NEAR_FLOAT64_RESOLUTION');
  const unchanged = panBy(v, -0.25, 0);
  assert.deepEqual(unchanged.centre, v.centre);
  assert.throws(() => compareBoundary(v), /shift is unrepresentable/);
  assert.throws(() => compareBoundary(v, renderZoom(v)), /shift is unrepresentable/);
  const wide = defaultViewport('mandelbrot', 32, 24);
  assert.notDeepEqual(panBy(wide, -0.25, 0).centre, wide.centre);
  assert.equal(compareBoundary(wide).comparedPixels, wide.width * wide.height);
});

test('input ranges, outside domain and work budgets fail closed', () => {
  const base = defaultViewport();
  assert.throws(() => defaultViewport('bogus'));
  assert.throws(() => precisionReport({ ...base, span: 0 }));
  assert.throws(() => precisionReport({ ...base, width: 4 }));
  assert.throws(() => precisionReport({ ...base, centre: state(4, 0) }), /domain/);
  assert.throws(() => precisionReport({ ...base, c: state(5, 0) }));
  assert.throws(() => zoomAt(base, 400, 2, 1.5), /outside/);
  assert.throws(() => zoomAt(base, 10, 10, 0.2));
  assert.throws(() => panBy(base, 999, 0));
  assert.throws(() => renderZoom({ ...base, width: 320, height: 240, span: 3.2 / 2 ** 12 }), /budget/);
});
test('classification sensitivity mask is reproducible and never claims set membership', () => {
  const v = defaultViewport('mandelbrot', 48, 32);
  const grid = renderZoom(v);
  assert.equal(grid.escaped + grid.notEscaped, 48 * 32);
  assert.equal(grid.pixels.filter(v => v === NOT_ESCAPED).length, grid.notEscaped);
  const a = compareBoundary(v, grid), b = compareBoundary(v, grid);
  assert.deepEqual(a, b);
  assert.equal(a.mask.length, 48 * 32);
  assert.equal(a.comparedPixels, 48 * 32);
  assert.equal(a.mask.filter(v => v === 2).length, a.classificationChanges);
  assert.equal(a.mask.filter(v => v === 1).length, a.iterationChanges);
});
test('independent Python grid output agrees on fixed wide and zoomed views', () => {
  const fixtures = [
    { id: 'mandelbrot-wide', ...defaultViewport('mandelbrot', 24, 16) },
    { id: 'julia-wide', ...defaultViewport('julia', 24, 16) },
    { id: 'mandelbrot-zoom', ...defaultViewport('mandelbrot', 24, 16),
      centre: state(-0.7435, 0.1314), span: 0.3 }
  ];
  const request = { protocol: 'j90-zoom-crosscheck-v1', cases: fixtures.map(({id, ...v}) => ({
    id, model:v.model, width:v.width, height:v.height, centre:v.centre, span:v.span,
    c:v.c, iterations:adaptiveIterations(v)
  })) };
  const path = fileURLToPath(new URL('../scripts/zoom_oracle.py', import.meta.url));
  const result = spawnSync('python3', [path], { input:JSON.stringify(request),
    encoding:'utf8', shell:false, timeout:10000, maxBuffer:1024*1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const response = JSON.parse(result.stdout);
  for(let i=0;i<fixtures.length;i++) {
    const {id,...v} = fixtures[i];
    assert.equal(response.cases[i].id,id);
    assert.deepEqual(response.cases[i].pixels,Array.from(renderZoom(v).pixels));
  }
  const tampered = JSON.stringify(request).replace('"model":"mandelbrot"',
    '"model":"fake"');
  const bad = spawnSync('python3', [path], { input:tampered,encoding:'utf8', shell:false });
  assert.notEqual(bad.status,0);
});
