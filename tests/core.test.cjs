const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../desktop/core.js');

test('idle pet grows drowsy, sleeps, and wakes on interaction', () => {
  const brain = new core.PetBrain(0, () => 0.5);
  assert.equal(brain.tick(61000).state, 'drowsy');
  assert.equal(brain.tick(91000).state, 'sleeping');
  brain.interact('pet', 92000);
  assert.equal(brain.tick(92000).state, 'waking');
  assert.equal(brain.tick(94001).state, 'idle');
});

test('dragging outranks sleep and release returns to ordinary behavior', () => {
  const brain = new core.PetBrain(0, () => 0.5);
  brain.interact('drag-start', 100000);
  assert.deepEqual(brain.tick(200000), { state: 'dragging', roam: false });
  brain.interact('drag-end', 200001);
  assert.equal(brain.tick(200002).state, 'bouncing');
  assert.equal(brain.tick(203000).state, 'idle');
});

test('interaction has a cooldown before roaming and disabling roam is respected', () => {
  const brain = new core.PetBrain(0, () => 0.99);
  brain.interact('pet', 1000);
  assert.equal(brain.tick(2000).state, 'happy');
  assert.equal(brain.tick(4000).roam, false);
  assert.equal(brain.tick(20000, true).roam, true);
  assert.equal(brain.tick(20000, false).roam, false);
  assert.equal(brain.tick(100000, true).roam, false);
});

test('clamps lost/offscreen bounds into negative-coordinate monitor work area', () => {
  const area = { x: -1920, y: 0, width: 1920, height: 1040 };
  assert.deepEqual(core.clampBounds({ x: -2500, y: 1100, width: 360, height: 360 }, area),
    { x: -1920, y: 680, width: 360, height: 360 });
  assert.deepEqual(core.clampBounds({ x: 40, y: 20, width: 360, height: 360 }, { x: 0, y: 0, width: 300, height: 250 }),
    { x: 0, y: 0, width: 300, height: 250 });
});

test('untrusted settings cannot inject invalid shapes, colors, positions or sizes', () => {
  const s = core.normalizeSettings({ size: 9999, color: 'url(evil)', shape: 'unknown', x: Infinity, roam: 'false', alwaysOnTop: false });
  assert.equal(s.size, 128);
  assert.equal(s.color, 'black');
  assert.equal(s.shape, 'blob');
  assert.equal(s.x, null);
  assert.equal(s.roam, true);
  assert.equal(s.alwaysOnTop, false);
  assert.equal(core.normalizeSettings(null).size, 128);
});

test('transparent margins pass through and the real pet rectangle stays interactive', () => {
  const bounds = { width: 360, height: 360 };
  assert.equal(core.hitTest({ x: 110, y: 216 }, bounds, 128), false);
  assert.equal(core.hitTest({ x: 180, y: 146 }, bounds, 128), false);
  assert.equal(core.hitTest({ x: 180, y: 216 }, bounds, 128), true);
  assert.equal(core.hitTest({ x: 240, y: 216 }, bounds, 128), true);
  assert.equal(core.hitTest({ x: 100, y: 216 }, bounds, 192), true);
});
