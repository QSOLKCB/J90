import test from 'node:test';
import assert from 'node:assert/strict';

test('nonlinear browser portrait renders and switches model/parameters without a network', async () => {
  const prev = { document: globalThis.document };
  const defaults = { 'fractal-model': 'mandelbrot', 'fractal-budget': '32',
    'julia-real': '-0.8', 'julia-imag': '0.156' };
  const nodes = new Map();
  let draws = 0;
  const ctx = {
    createImageData(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
    putImageData(img) { draws++; assert.equal(img.data.length, 200 * 134 * 4); }
  };
  const element = id => {
    if (!nodes.has(id)) {
      const handlers = new Map();
      nodes.set(id, {
        value: defaults[id] ?? '',
        textContent: '',
        disabled: false,
        width: 200, height: 134,
        getContext: () => ctx,
        addEventListener(name, cb) { handlers.set(name, cb); },
        emit(name) { assert.ok(handlers.has(name)); handlers.get(name)(); }
      });
    }
    return nodes.get(id);
  };
  globalThis.document = { getElementById: element };
  try {
    await import('../src/fractal-browser.mjs');
    assert.equal(draws, 1);
    assert.equal(element('julia-real').disabled, true);
    const count = () => Number(element('fractal-escaped').textContent) +
      Number(element('fractal-bounded').textContent);
    assert.equal(count(), 26800);
    element('fractal-model').value = 'julia';
    element('fractal-model').emit('change');
    assert.equal(draws, 2);
    assert.equal(element('julia-real').disabled, false);
    assert.equal(count(), 26800);
    assert.match(element('fractal-summary').textContent, /Julia/);
    element('julia-real').value = '-0.4';
    element('julia-real').emit('input');
    assert.equal(element('julia-real-value').textContent, '-0.400');
    element('fractal-budget').value = '48';
    element('fractal-budget').emit('input');
    assert.equal(element('fractal-budget-value').textContent, '48');
    assert.equal(count(), 26800);
    assert.ok(draws >= 4);
  } finally {
    if (prev.document === undefined) delete globalThis.document;
    else globalThis.document = prev.document;
  }
});
