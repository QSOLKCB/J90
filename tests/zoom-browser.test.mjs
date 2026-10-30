import test from 'node:test';
import assert from 'node:assert/strict';

test('precision explorer renders, zooms by pointer, drags, toggles mask and resets', async () => {
  const previous = globalThis.document;
  const nodes = new Map();
  let renders = 0;
  const ctx = {
    createImageData(width, height) {
      assert.equal(width, 176); assert.equal(height, 112);
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData(value) {
      assert.equal(value.data.length, 176 * 112 * 4);
      renders++;
    }
  };
  function node(id) {
    if (!nodes.has(id)) {
      const handlers = new Map();
      const defaults = { 'zoom-model': 'mandelbrot', 'zoom-julia-real': '-0.8',
        'zoom-julia-imag': '0.156' };
      nodes.set(id, {
        width: 176, height: 112, value: defaults[id] || '', textContent: '',
        attributes: {},
        getContext: () => ctx,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 352, height: 224 }),
        setPointerCapture() {}, releasePointerCapture() {},
        setAttribute(key, value) { this.attributes[key] = value; },
        addEventListener(type, cb) { handlers.set(type, cb); },
        emit(type, data = {}) {
          assert.ok(handlers.has(type), 'missing handler: ' + id + ':' + type);
          handlers.get(type)({ preventDefault() {}, clientX: 176,
            clientY: 112, button: 0, pointerId: 1, ...data });
        }
      });
    }
    return nodes.get(id);
  }
  globalThis.document = { getElementById: node };
  try {
    await import('../src/zoom-browser.mjs');
    assert.ok(renders >= 1);
    assert.match(node('zoom-precision').textContent, /RESOLVED/);
    assert.equal(node('zoom-iterations').textContent, '64');
    node('zoom-in').emit('click');
    assert.ok(Number(node('zoom-span').textContent) < 3.2);
    const beforePan = node('zoom-centre').textContent;
    node('zoom-view').emit('pointerdown', {clientX:150,clientY:112});
    node('zoom-view').emit('pointerup', {clientX:200,clientY:112});
    assert.notEqual(node('zoom-centre').textContent, beforePan);
    node('zoom-overlay').emit('click');
    assert.equal(node('zoom-overlay').attributes['aria-pressed'], 'true');
    assert.match(node('zoom-sensitive').textContent, /class/);
    node('zoom-view').emit('wheel', {deltaY:-100});
    node('zoom-view').emit('keydown', {key:'ArrowLeft'});
    node('zoom-model').value = 'julia';
    node('zoom-model').emit('change');
    assert.match(node('zoom-centre').textContent, /^0/);
    node('zoom-julia-real').value = '-0.4';
    node('zoom-julia-real').emit('input');
    assert.ok(renders > 5);
    node('zoom-reset').emit('click');
    assert.equal(Number(node('zoom-span').textContent), 3.2);
    node('zoom-overlay').emit('click');
    assert.equal(node('zoom-overlay').attributes['aria-pressed'], 'false');
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
