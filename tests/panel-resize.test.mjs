import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');
const start = source.indexOf('            _initResize() {');
const end = source.indexOf('            /**\n             * 面板展开/折叠切换', start);
assert.ok(start > 0 && end > start, '_initResize not found');
const BOUNDS = { minW: 236, maxW: 440, minH: 260, maxH: 900, margin: 8 };

function setup({ alignRight = false, rect = { left: 400, top: 200, width: 300, height: 400 }, vw = 1280, vh = 1000 } = {}) {
  const listeners = {};
  const style = { width: `${rect.width}px`, maxHeight: `${rect.height}px`, left: `${rect.left}px`, right: 'auto', top: `${rect.top}px`, props: {},
    setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] || ''; } };
  const classes = new Set();
  const el = { style, classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), },
    getBoundingClientRect() {
      const left = parseFloat(style.left); const width = parseFloat(style.width);
      const top = parseFloat(style.top); const height = Math.min(parseFloat(style.maxHeight), rect.height);
      return { left, top, width, height, right: left + width, bottom: top + height };
    } };
  const handles = ['e', 's', 'se', 'w', 'n', 'nw', 'ne', 'sw'].map(d => {
    const h = { dir: d, classList: new Set([`ldsp-resize-handle`, `ldsp-resize-${d}`]), listeners: {} };
    h.classList.contains = c => h.classList.has(c);
    h.addEventListener = (t, f) => { h.listeners[t] = f; };
    return h;
  });
  el.querySelectorAll = () => handles;
  const saved = {};
  const context = vm.createContext({
    window: { matchMedia: () => ({ matches: true }), innerWidth: vw, innerHeight: vh },
    document: { addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: t => { delete listeners[t]; } },
    Screen: { getConfig: () => ({}) }, Math, Date, parseFloat, Number,
  });
  const panel = vm.runInContext(`(class { ${source.slice(start, end)} })`, context);
  const inst = new panel();
  Object.assign(inst, { el,
    storage: { getGlobal: k => (k === 'position' ? { alignRight } : saved[k] ?? null), setGlobalNow: (k, v) => { saved[k] = v; } },
    _getPanelSizeBounds: () => BOUNDS, _scheduleIndicatorRefresh() {}, _applyPanelSize() {}, _savePositionKeepAlign() {} });
  inst._initResize();
  const drag = (dir, dx, dy) => {
    const h = handles.find(x => x.dir === dir);
    h.listeners.mousedown({ preventDefault() {}, stopPropagation() {}, clientX: 500, clientY: 500 });
    listeners.mousemove({ preventDefault() {}, clientX: 500 + dx, clientY: 500 + dy });
    listeners.mouseup();
    const w = parseFloat(style.width), h2 = parseFloat(style.maxHeight);
    return { w, h: h2, left: parseFloat(style.left), right: parseFloat(style.right), top: parseFloat(style.top) };
  };
  const dblclick = dir => handles.find(x => x.dir === dir).listeners.dblclick({ preventDefault() {}, stopPropagation() {} });
  return { drag, dblclick, saved, style };
}

test('every edge and corner has a handle direction', () => {
  assert.ok(/ldsp-resize-\(n\|s\|e\|w\|ne\|nw\|se\|sw\)/.test(source));
  for (const d of ['w', 'n', 'nw', 'ne', 'sw']) assert.ok(source.includes(`ldsp-resize-${d}"></div>`), d);
});

test('east/south/southeast still grow right and down (left/top fixed)', () => {
  assert.deepEqual(pick(setup().drag('se', 40, 30)), { w: 340, h: 430, left: 400, top: 200 });
});

test('west edge: right edge stays fixed, panel grows to the left', () => {
  const r = setup().drag('w', -60, 0);
  assert.equal(r.w, 360); assert.equal(r.left, 340); assert.equal(r.left + r.w, 700);
});

test('north edge: bottom edge stays fixed, panel grows upward', () => {
  const r = setup().drag('n', 0, -50);
  assert.equal(r.h, 450); assert.equal(r.top, 150); assert.equal(r.top + r.h, 600);
});

test('north-west corner moves both axes while the south-east corner stays put', () => {
  const r = setup().drag('nw', -30, -20);
  assert.equal(r.left + r.w, 700); assert.equal(r.top + r.h, 600);
  assert.equal(r.w, 330); assert.equal(r.h, 420);
});

test('shrinking from west/north clamps at minimum size and keeps the opposite edge fixed', () => {
  const r = setup().drag('nw', 500, 500);
  assert.equal(r.w, BOUNDS.minW); assert.equal(r.h, BOUNDS.minH);
  assert.equal(r.left + r.w, 700); assert.equal(r.top + r.h, 600);
});

test('growing is clamped to the viewport margin on the near side', () => {
  const r = setup({ rect: { left: 60, top: 40, width: 300, height: 400 } }).drag('nw', -500, -500);
  assert.equal(r.left, BOUNDS.margin); assert.equal(r.top, BOUNDS.margin);
});

test('right-anchored panel grows to the right on east drag and is re-anchored on release', () => {
  const a = setup({ alignRight: true }); const r = a.drag('e', 40, 0);
  // left edge stayed at 400, so the new right edge is 740 → right anchor = 1280 - 740
  assert.equal(r.w, 340); assert.equal(r.right, 540); assert.equal(a.style.left, 'auto');
});

test('customSize is persisted after a real drag and not after a click', () => {
  const a = setup(); a.drag('w', -60, 0);
  assert.equal(a.saved.customSize.width, 360);
  const b = setup(); b.drag('w', 0, 0);
  assert.equal(b.saved.customSize, undefined);
});

test('a vertical drag sets a real height and marks the size as fixedHeight; a horizontal one does not', () => {
  const a = setup(); a.drag('s', 0, 60);
  assert.equal(a.style.height, '460px'); assert.equal(a.saved.customSize.fixedHeight, true);
  const b = setup(); b.drag('e', 40, 0);
  assert.equal(b.style.height, undefined); assert.equal(b.saved.customSize.fixedHeight, false);
});

test('double-clicking a handle clears the custom size', () => {
  const a = setup(); a.drag('se', 40, 40);
  assert.ok(a.saved.customSize);
  a.dblclick('se');
  assert.equal(a.saved.customSize, null);
});

test('desktop width is limited by the viewport, phones and tablets keep their caps', () => {
  const s2 = source.indexOf('            _getPanelSizeBounds(cfg, vw, vh) {');
  const e2 = source.indexOf('            _getPanelSizeConfig', s2);
  const C = vm.runInNewContext(`(class { ${source.slice(s2, e2)} })`, { Math });
  const b = new C();
  assert.equal(b._getPanelSizeBounds({}, 1920, 1080).maxW, 1920 - 16);
  assert.equal(b._getPanelSizeBounds({ isTablet: true }, 1024, 768).maxW, 460);
  assert.equal(b._getPanelSizeBounds({ isMobile: true, isPhone: true }, 800, 400).maxW, 440);
  assert.equal(b._getPanelSizeBounds({ isMobile: true, isPhone: true }, 390, 800).maxW, 390 - 12);
});

test('restore applies a fixed height only for sizes saved with fixedHeight (legacy sizes stay content-sized)', () => {
  const s2 = source.indexOf('            _getPanelSizeBounds(cfg, vw, vh) {');
  const e2 = source.indexOf('            _onResize() {', s2);
  assert.ok(e2 > s2);
  const apply = custom => {
    const style = { setProperty() {} };
    const C = vm.runInNewContext(`(class { ${source.slice(s2, e2)} })`, {
      Math, String, Screen: { getConfig: () => ({ width: 320, maxHeight: 600 }), getViewport: () => ({ vw: 1440, vh: 900 }) },
      Utils: { toSafeNumber: (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d) },
    });
    const p = new C();
    Object.assign(p, { el: { style, classList: { toggle() {} } }, storage: { getGlobal: () => custom }, _getFontSizeScale: () => 1 });
    p._applyPanelSize();
    return style;
  };
  assert.deepEqual(pickSize(apply({ width: 700, height: 500, fixedHeight: true })), { width: '700px', maxHeight: '500px', height: '500px' });
  assert.deepEqual(pickSize(apply({ width: 700, height: 500 })), { width: '700px', maxHeight: '500px', height: '' });
  assert.deepEqual(pickSize(apply(null)), { width: '320px', maxHeight: '600px', height: '' });
});

function pickSize(s) { return { width: s.width, maxHeight: s.maxHeight, height: s.height }; }
function pick(r) { return { w: r.w, h: r.h, left: r.left, top: r.top }; }
