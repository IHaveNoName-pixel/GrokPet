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
test('taller information window preserves the pet hit target at y216',()=>{
  assert.equal(core.hitTest({x:180,y:160},{width:360,height:480},128),true);
  assert.equal(core.hitTest({x:180,y:350},{width:360,height:480},128),false);
});
test('HUD defaults to readable hover mode and accepts only valid display options', () => {
  const defaults = core.normalizeSettings({});
  assert.equal(defaults.hudMode,'hover');
  assert.equal(defaults.hudFontSize,14);
  const selected = core.normalizeSettings({hudMode:'always',hudFontSize:16,hudItems:{codex:false,network:false,cpu:true}});
  assert.equal(selected.hudMode,'always');
  assert.equal(selected.hudFontSize,16);
  assert.equal(selected.hudItems.codex,false);
  assert.equal(selected.hudItems.network,false);
  assert.equal(selected.hudItems.cpu,true);
  assert.equal(core.normalizeSettings({hudMode:'invalid',hudFontSize:300}).hudMode,'hover');
  assert.equal(core.normalizeSettings({hudMode:'invalid',hudFontSize:300}).hudFontSize,14);
});
test('assistant placement avoids pet where space allows, including negative monitor coordinates',()=>{const {placeAssistant}=require('../desktop/core.js');const area={x:-1920,y:0,width:1920,height:1040};const pet={x:-450,y:500,width:360,height:480};const r=placeAssistant(pet,{width:500,height:700},area);assert.ok(r.x+r.width<=pet.x||r.x>=pet.x+pet.width);assert.ok(r.x>=area.x&&r.y+r.height<=area.height);});
test('interactive hit testing includes visible bubble without making empty margins clickable',()=>{const {interactiveHit}=require('../desktop/core.js');const bounds={width:360,height:480},bubble={x:40,y:20,width:280,height:120},dock={x:20,y:320,width:320,height:130};assert.equal(interactiveHit({x:100,y:80},bounds,128,[bubble,dock]),true);assert.equal(interactiveHit({x:10,y:80},bounds,128,[bubble,dock]),false);assert.equal(interactiveHit({x:100,y:80},bounds,128,[null,dock]),false);});
