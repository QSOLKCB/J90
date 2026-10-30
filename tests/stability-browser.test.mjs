import test from 'node:test';
import assert from 'node:assert/strict';
test('real-axis canvas renders and responds to changes', async () => {
  const prior = globalThis.document;
  const controls = new Map();
  let draws = 0;
  function element(id) {
    if (!controls.has(id)) {
      const events = new Map();
      controls.set(id, {
        value: id === 'stability-c' ? '-1' : '',
        textContent: '', width: 640, height: 300,
        getContext: () => ({
          clearRect() {}, fillRect() { draws++; },
          beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
          set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}
        }),
        addEventListener(kind, cb) { events.set(kind, cb); },
        emit(kind) { assert.ok(events.has(kind)); events.get(kind)(); }
      });
    }
    return controls.get(id);
  }
  globalThis.document = { getElementById: element };
  try {
    await import('../src/stability-browser.mjs');
    assert.ok(draws > 100);
    assert.equal(element('stability-period').textContent, '2');
    assert.equal(element('stability-escaped').textContent, 'false');
    element('stability-c').value = '0.35';
    element('stability-c').emit('input');
    assert.equal(element('stability-period').textContent, 'Escaped');
    assert.equal(element('stability-escaped').textContent, 'true');
    assert.equal(element('stability-count').textContent, '240');
    assert.match(element('stability-explanation').textContent, /Finite-window/);
  } finally {
    if (prior === undefined) delete globalThis.document;
    else globalThis.document = prior;
  }
});
