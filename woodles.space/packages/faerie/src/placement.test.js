import assert from 'node:assert/strict';
import test from 'node:test';
import { placeFaerie } from './placement.js';

const viewport = { width: 1024, height: 768 };
const rect = (left, top, right, bottom) => ({ left, top, right, bottom });

function effectiveDimensions(view, options = {}) {
  const size = Math.min(options.size ?? 56, view.width, view.height);
  const padding = Math.min(options.padding ?? 16, Math.max(0, (Math.min(view.width, view.height) - size) / 2));
  return { radius: size / 2, padding, bubbleWidth: Math.min(options.bubbleWidth ?? 280, view.width - padding * 2), bubbleHeight: Math.min(options.bubbleHeight ?? 130, view.height - padding * 2) };
}

function assertFits(result, view, options = {}) {
  const { radius, padding, bubbleWidth, bubbleHeight } = effectiveDimensions(view, options);
  for (const key of ['x', 'y', 'bubbleX', 'bubbleY']) assert.ok(Number.isFinite(result[key]), `${key} must be finite`);
  assert.ok(result.x - radius >= padding - 1e-9, 'orb left edge fits');
  assert.ok(result.y - radius >= padding - 1e-9, 'orb top edge fits');
  assert.ok(result.x + radius <= view.width - padding + 1e-9, 'orb right edge fits');
  assert.ok(result.y + radius <= view.height - padding + 1e-9, 'orb bottom edge fits');
  assert.ok(result.bubbleX >= padding - 1e-9, 'hint left edge fits');
  assert.ok(result.bubbleY >= padding - 1e-9, 'hint top edge fits');
  assert.ok(result.bubbleX + bubbleWidth <= view.width - padding + 1e-9, 'hint right edge fits');
  assert.ok(result.bubbleY + bubbleHeight <= view.height - padding + 1e-9, 'hint bottom edge fits');
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function assertBubbleAvoids(result, target, view, options = {}) {
  const { bubbleWidth, bubbleHeight } = effectiveDimensions(view, options);
  const bubble = rect(result.bubbleX, result.bubbleY, result.bubbleX + bubbleWidth, result.bubbleY + bubbleHeight);
  assert.equal(overlaps(bubble, target), false, 'hint leaves the target readable when space permits');
}

test('automatic placement stays inside each corner and leaves its target readable', () => {
  for (const target of [rect(0, 0, 48, 48), rect(976, 0, 1024, 48), rect(0, 720, 48, 768), rect(976, 720, 1024, 768)]) {
    const result = placeFaerie(target, viewport);
    assert.equal(result.visible, true);
    assertFits(result, viewport);
    assertBubbleAvoids(result, target, viewport);
    assert.deepEqual(placeFaerie(target, viewport), result, 'repeating the same geometry is stable');
  }
});

test('a requested side is honored when its orb fits, with the requested separation', () => {
  const target = rect(420, 310, 520, 390);
  const options = { placement: 'right', gap: 24 };
  const result = placeFaerie(target, viewport, options);
  assert.equal(result.placement, 'right');
  assert.equal(result.x - 28, target.right + 24);
  assert.equal(result.y, 350);
  assertFits(result, viewport, options);
  assertBubbleAvoids(result, target, viewport, options);
});

test('an impossible requested side falls back to an available side', () => {
  const target = rect(900, 310, 1024, 390);
  const result = placeFaerie(target, viewport, { placement: 'right' });
  assert.notEqual(result.placement, 'right');
  assertFits(result, viewport);
  assertBubbleAvoids(result, target, viewport);
  const orb = rect(result.x - 28, result.y - 28, result.x + 28, result.y + 28);
  assert.equal(overlaps(orb, target), false);
});

test('a narrow viewport caps the hint and keeps the orb fully visible', () => {
  const view = { width: 240, height: 740 };
  const target = rect(60, 330, 190, 385);
  const result = placeFaerie(target, view);
  assert.ok(['top', 'bottom'].includes(result.placement));
  assertFits(result, view);
  assertBubbleAvoids(result, target, view);
});

test('a viewport smaller than the requested orb adapts without nonfinite coordinates', () => {
  const view = { width: 24, height: 18 };
  assertFits(placeFaerie(rect(10, 8, 10, 8), view), view);
});

test('a large target uses the remaining vertical space', () => {
  const target = rect(10, 275, 1014, 520);
  const result = placeFaerie(target, viewport);
  assert.ok(['top', 'bottom'].includes(result.placement));
  assertFits(result, viewport);
  assertBubbleAvoids(result, target, viewport);
});

test('a target filling the viewport still produces a bounded cue', () => {
  const target = rect(-50, -80, 1100, 860);
  const result = placeFaerie(target, viewport);
  assert.equal(result.visible, true);
  assertFits(result, viewport);
});

test('a partially visible target anchors to its visible portion', () => {
  const target = rect(-150, 230, 50, 360);
  const result = placeFaerie(target, viewport, { placement: 'right' });
  assert.equal(result.visible, true);
  assert.equal(result.placement, 'right');
  assert.equal(result.x, 50 + 24 + 28);
  assert.equal(result.y, 295);
  assertFits(result, viewport);
  assertBubbleAvoids(result, target, viewport);
});

test('fully offscreen targets on every side return an invisible finite result', () => {
  for (const target of [rect(-200, 20, -10, 80), rect(1030, 20, 1100, 80), rect(20, -200, 80, -10), rect(20, 780, 80, 900), rect(-200, 20, 0, 80), rect(1024, 20, 1100, 80), rect(20, -200, 80, 0), rect(20, 768, 80, 900)]) {
    const result = placeFaerie(target, viewport);
    assert.equal(result.visible, false);
    assertFits(result, viewport);
  }
});

test('point targets include viewport boundaries and support a hint-free cue', () => {
  const options = { bubbleWidth: 0, bubbleHeight: 0 };
  for (const [x, y] of [[0, 0], [1024, 768], [512, 384]]) {
    const result = placeFaerie(rect(x, y, x, y), viewport, options);
    assert.equal(result.visible, true);
    assertFits(result, viewport, options);
  }
});

test('bubble can choose another side to avoid covering a target', () => {
  const target = rect(400, 250, 860, 500);
  const result = placeFaerie(target, viewport, { placement: 'right' });
  assert.equal(result.placement, 'right');
  assertFits(result, viewport);
  assertBubbleAvoids(result, target, viewport);
});

test('invalid numeric geometry is rejected instead of leaking NaN into styles', () => {
  const target = rect(10, 10, 20, 20);
  assert.throws(() => placeFaerie({ ...target, left: NaN }, viewport), TypeError);
  assert.throws(() => placeFaerie(target, { width: Infinity, height: 768 }), TypeError);
  assert.throws(() => placeFaerie(target, { width: 0, height: 768 }), RangeError);
  assert.throws(() => placeFaerie(rect(20, 10, 10, 20), viewport), RangeError);
  assert.throws(() => placeFaerie(target, viewport, { size: -1 }), RangeError);
  assert.throws(() => placeFaerie(target, viewport, { gap: -1 }), RangeError);
  assert.throws(() => placeFaerie(target, viewport, { bubbleHeight: NaN }), TypeError);
  assert.throws(() => placeFaerie(target, viewport, { placement: 'diagonal' }), RangeError);
  assert.throws(() => placeFaerie(null, viewport), TypeError);
});
