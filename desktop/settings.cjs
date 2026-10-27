'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { normalizeSettings } = require('./core.js');

class SettingsStore {
  constructor(file) { this.file = file; }
  load() {
    try {
      return normalizeSettings(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch (error) {
      if (error instanceof SyntaxError) fs.copyFileSync(this.file, this.file + '.broken');
      else if (error.code !== 'ENOENT') throw error;
      return normalizeSettings({});
    }
  }
  save(settings) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(normalizeSettings(settings), null, 2) + '\n', 'utf8');
    fs.renameSync(this.file + '.tmp', this.file);
  }
}
module.exports = { SettingsStore };
