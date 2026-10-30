import test from 'node:test';
import assert from 'node:assert/strict';

// Regression: HTML range inputs with step=1 round assigned fractional values.
// Browser animation must not read this rounded value back as its phase clock.
test('fractional phase accumulates at 144 Hz and 240 Hz, with manual edits and pause', async () => {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    requestAnimationFrame: globalThis.requestAnimationFrame
  };
  const noop = () => {};
  const ctx = {
    clearRect: noop, beginPath: noop, arc: noop, stroke: noop,
    moveTo: noop, lineTo: noop, fill: noop, fillText: noop
  };
  const initial = { phase: '45', omega: '1', damping: '.05', gap: '2' };
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) {
      let value = initial[id] ?? '';
      const handlers = new Map();
      const el = {
        textContent: '',
        width: id === 'orbit' ? 600 : 1100,
        height: id === 'orbit' ? 600 : 340,
        get value() { return value; },
        set value(next) {
          // Model integer-step range-input value sanitization.
          value = id === 'phase' ? String(Math.round(Number(next))) : String(next);
        },
        addEventListener(type, callback) { handlers.set(type, callback); },
        emit(type) {
          assert.ok(handlers.has(type), 'missing ' + type + ' listener on ' + id);
          handlers.get(type)();
        },
        setAttribute: noop,
        getContext: () => ctx
      };
      elements.set(id, el);
    }
    return elements.get(id);
  };
  let nextFrame = null;
  globalThis.document = { getElementById: getElement };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.requestAnimationFrame = callback => { nextFrame = callback; };
  const frame = t => {
    assert.equal(typeof nextFrame, 'function');
    const callback = nextFrame;
    nextFrame = null;
    callback(t);
  };
  const phaseText = () => parseFloat(getElement('phase-value').textContent);
  const animateButton = getElement('animate');
  try {
    await import('../src/browser.mjs');
    assert.equal(phaseText(), 45);
    animateButton.emit('click');
    for (let i = 0; i <= 144; i++) frame(i * 1000 / 144);
    assert.ok(Math.abs(phaseText() - 105) < 0.11,
      '144 Hz should advance 60 degrees, got ' + phaseText());
    assert.equal(Number(getElement('phase').value), 105);

    // A real manual slider input must replace the accumulated phase.
    animateButton.emit('click');
    getElement('phase').value = '180';
    getElement('phase').emit('input');
    assert.equal(phaseText(), 180);
    animateButton.emit('click');
    for (let i = 0; i <= 240; i++) frame(10000 + i * 1000 / 240);
    assert.ok(Math.abs(phaseText() - 240) < 0.11,
      '240 Hz should also advance 60 degrees, got ' + phaseText());

    // Time spent paused must not be accidentally integrated on resume.
    animateButton.emit('click');
    frame(50000);
    assert.equal(phaseText(), 240);
    animateButton.emit('click');
    frame(70000);
    assert.equal(phaseText(), 240);
    frame(70000 + 1000 / 144);
    assert.ok(phaseText() > 240);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});
