'use strict';

const COLORS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'magenta', 'gray'];
const SHAPES = ['blob', 'pebble', 'squircle', 'tablet', 'wedge', 'hex', 'cloud', 'teardrop'];

function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const coord = v => Number.isFinite(v) && Math.abs(v) < 100000 ? Math.round(v) : null;
  return {
    version: 1,
    x: coord(s.x), y: coord(s.y),
    size: [96, 128, 160, 192].includes(s.size) ? s.size : 128,
    color: COLORS.includes(s.color) ? s.color : 'black',
    shape: SHAPES.includes(s.shape) ? s.shape : 'blob',
    roam: typeof s.roam === 'boolean' ? s.roam : true,
    alwaysOnTop: typeof s.alwaysOnTop === 'boolean' ? s.alwaysOnTop : true,
    bubbles: typeof s.bubbles === 'boolean' ? s.bubbles : true,
  };
}

function clampBounds(bounds, area) {
  const width = Math.min(bounds.width, area.width);
  const height = Math.min(bounds.height, area.height);
  return {
    x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))),
    width, height,
  };
}

function hitTest(point, bounds, size) {
  return point.x >= bounds.width / 2 - size / 2 && point.x <= bounds.width / 2 + size / 2
    && point.y >= bounds.height * 0.60 - size / 2 && point.y <= bounds.height * 0.60 + size / 2;
}

class PetBrain {
  constructor(now = Date.now(), random = Math.random) {
    this.lastInteraction = now;
    this.until = now;
    this.state = 'idle';
    this.dragging = false;
    this.nextIdle = now + 12000;
    this.random = random;
    this.strokes = 0;
  }

  interact(action, now = Date.now()) {
    if (!['pet', 'drag-start', 'drag-end', 'wake'].includes(action)) return;
    if (this.dragging && action !== 'drag-end') return;
    this.lastInteraction = now;
    this.nextIdle = now + 12000;
    if (action === 'drag-start') {
      this.dragging = true;
      this.state = 'dragging';
      return;
    }
    if (action === 'drag-end') {
      this.dragging = false;
      this.state = 'bouncing';
      this.until = now + 1600;
    } else if (this.state === 'sleeping' || this.state === 'drowsy' || action === 'wake') {
      this.state = 'waking';
      this.until = now + 1800;
    } else {
      this.strokes++;
      this.state = this.strokes % 5 === 0 ? 'laughing' : this.strokes % 3 === 0 ? 'shy' : 'happy';
      this.until = now + 2400;
    }
  }

  tick(now = Date.now(), roamEnabled = true) {
    if (this.dragging) return { state: 'dragging', roam: false };
    const idleFor = Math.max(0, now - this.lastInteraction);
    if (now < this.until) return { state: this.state, roam: false };
    if (idleFor >= 90000) this.state = 'sleeping';
    else if (idleFor >= 60000) this.state = 'drowsy';
    else if (now >= this.nextIdle) {
      this.state = ['curious', 'playful', 'bored', 'idle'][Math.floor(this.random() * 4) % 4];
      this.until = now + 3500;
      this.nextIdle = now + 12000 + this.random() * 10000;
    } else this.state = 'idle';
    return { state: this.state, roam: !!roamEnabled && idleFor > 8000 && idleFor < 60000 && this.state === 'idle' };
  }
}

module.exports = { COLORS, SHAPES, normalizeSettings, clampBounds, hitTest, PetBrain };
