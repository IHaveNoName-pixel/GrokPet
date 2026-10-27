const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SettingsStore } = require('../desktop/settings.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-settings-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'settings.json');
}

test('save and reopen preserves negative monitor position and user preferences', t => {
  const file = fixture(t);
  new SettingsStore(file).save({ x: -1200, y: 300, size: 160, color: 'cyan', roam: false, alwaysOnTop: false });
  const loaded = new SettingsStore(file).load();
  assert.equal(loaded.x, -1200);
  assert.equal(loaded.size, 160);
  assert.equal(loaded.color, 'cyan');
  assert.equal(loaded.roam, false);
  assert.equal(loaded.alwaysOnTop, false);
  assert.equal(fs.existsSync(file + '.tmp'), false);
});

test('malformed JSON is retained for recovery and defaults are usable', t => {
  const file = fixture(t);
  fs.writeFileSync(file, '{broken');
  const loaded = new SettingsStore(file).load();
  assert.equal(loaded.size, 128);
  assert.equal(fs.readFileSync(file + '.broken', 'utf8'), '{broken');
});
