const SIDES = ['right', 'bottom', 'left', 'top'];

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function dimension(value, name, zeroAllowed = false) {
  finite(value, name);
  if (zeroAllowed ? value < 0 : value <= 0) {
    throw new RangeError(`${name} must be ${zeroAllowed ? 'nonnegative' : 'positive'}`);
  }
  return value;
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function overlapFraction(box, target) {
  const width = Math.max(0, Math.min(box.right, target.right) - Math.max(box.left, target.left));
  const height = Math.max(0, Math.min(box.bottom, target.bottom) - Math.max(box.top, target.top));
  const boxWidth = box.right - box.left;
  const boxHeight = box.bottom - box.top;
  return boxWidth > 0 && boxHeight > 0 ? (width / boxWidth) * (height / boxHeight) : 0;
}

function compare(a, b) {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

/**
 * Place a viewport-sized attention cue and its hint around an axis-aligned target.
 * x/y are the orb center; bubbleX/bubbleY are the hint's upper-left corner.
 * Geometry uses viewport CSS pixels. The helper has no DOM or browser dependencies.
 */
export function placeFaerie(rect, viewport, options = {}) {
  if (!rect || !viewport || !options || typeof options !== 'object') {
    throw new TypeError('rect, viewport, and options must be objects');
  }
  const target = {
    left: finite(rect.left, 'rect.left'),
    top: finite(rect.top, 'rect.top'),
    right: finite(rect.right, 'rect.right'),
    bottom: finite(rect.bottom, 'rect.bottom'),
  };
  if (target.right < target.left || target.bottom < target.top) {
    throw new RangeError('rect edges must be ordered');
  }
  const width = dimension(viewport.width, 'viewport.width');
  const height = dimension(viewport.height, 'viewport.height');
  const size = dimension(options.size ?? 56, 'size');
  const gap = dimension(options.gap ?? 24, 'gap', true);
  const padding = dimension(options.padding ?? 16, 'padding', true);
  const requestedWidth = dimension(options.bubbleWidth ?? 280, 'bubbleWidth', true);
  const requestedHeight = dimension(options.bubbleHeight ?? 130, 'bubbleHeight', true);
  const requestedSide = options.placement ?? 'auto';
  if (requestedSide !== 'auto' && !SIDES.includes(requestedSide)) {
    throw new RangeError('placement must be auto, top, right, bottom, or left');
  }

  // The renderer uses these same size limits in very small viewports.
  const diameter = Math.min(size, width, height);
  const radius = diameter / 2;
  const inset = Math.min(padding, Math.max(0, (Math.min(width, height) - diameter) / 2));
  const bounds = { left: inset, top: inset, right: width - inset, bottom: height - inset };
  const bubbleWidth = Math.min(requestedWidth, width - 2 * inset);
  const bubbleHeight = Math.min(requestedHeight, height - 2 * inset);
  const hasBubble = bubbleWidth > 0 && bubbleHeight > 0;
  const bubbleGap = Math.min(12, gap);
  const visibleX = target.left === target.right
    ? target.left >= 0 && target.left <= width
    : target.right > 0 && target.left < width;
  const visibleY = target.top === target.bottom
    ? target.top >= 0 && target.top <= height
    : target.bottom > 0 && target.top < height;
  const visible = visibleX && visibleY;
  const anchor = {
    left: clamp(target.left, 0, width), top: clamp(target.top, 0, height),
    right: clamp(target.right, 0, width), bottom: clamp(target.bottom, 0, height),
  };
  const center = { x: anchor.left / 2 + anchor.right / 2, y: anchor.top / 2 + anchor.bottom / 2 };
  const fitX = (value) => clamp(value, bounds.left + radius, bounds.right - radius);
  const fitY = (value) => clamp(value, bounds.top + radius, bounds.bottom - radius);
  const fitBubbleX = (value) => clamp(value, bounds.left, bounds.right - bubbleWidth);
  const fitBubbleY = (value) => clamp(value, bounds.top, bounds.bottom - bubbleHeight);

  if (!visible) {
    const x = fitX(center.x);
    const y = fitY(center.y);
    return { x, y, bubbleX: fitBubbleX(x - bubbleWidth / 2), bubbleY: fitBubbleY(y - bubbleHeight / 2), placement: requestedSide === 'auto' ? 'right' : requestedSide, visible: false };
  }

  function placeBubble(side, orb) {
    const outward = {
      right: [orb.right + bubbleGap, orb.y - bubbleHeight / 2],
      bottom: [orb.x - bubbleWidth / 2, orb.bottom + bubbleGap],
      left: [orb.left - bubbleGap - bubbleWidth, orb.y - bubbleHeight / 2],
      top: [orb.x - bubbleWidth / 2, orb.top - bubbleGap - bubbleHeight],
    };
    const preferred = outward[side];
    if (!hasBubble) return { x: fitBubbleX(orb.x), y: fitBubbleY(orb.y), overlap: 0 };

    const candidates = [preferred, ...SIDES.filter((other) => other !== side).map((other) => outward[other])];
    const horizontal = [center.x - bubbleWidth / 2, anchor.left, anchor.right - bubbleWidth];
    const vertical = [center.y - bubbleHeight / 2, anchor.top, anchor.bottom - bubbleHeight];
    for (const y of vertical) {
      candidates.push([anchor.right + gap, y], [anchor.left - gap - bubbleWidth, y]);
    }
    for (const x of horizontal) {
      candidates.push([x, anchor.bottom + gap], [x, anchor.top - gap - bubbleHeight]);
    }
    candidates.push(
      [bounds.left, bounds.top], [bounds.right - bubbleWidth, bounds.top],
      [bounds.left, bounds.bottom - bubbleHeight], [bounds.right - bubbleWidth, bounds.bottom - bubbleHeight],
    );

    let best;
    candidates.forEach(([rawX, rawY], index) => {
      const x = fitBubbleX(rawX);
      const y = fitBubbleY(rawY);
      const box = { left: x, top: y, right: x + bubbleWidth, bottom: y + bubbleHeight };
      const overlap = overlapFraction(box, anchor);
      const besideTarget = side === 'right' ? x >= anchor.right
        : side === 'left' ? box.right <= anchor.left
          : side === 'bottom' ? y >= anchor.bottom : box.bottom <= anchor.top;
      const distance = Math.abs(x - fitBubbleX(preferred[0])) / width + Math.abs(y - fitBubbleY(preferred[1])) / height;
      const score = [overlap, overlapFraction(box, orb), besideTarget ? 0 : 1, distance, index];
      if (!best || compare(score, best.score) < 0) best = { x, y, overlap, score };
    });
    return best;
  }

  const room = {
    right: bounds.right - anchor.right,
    bottom: bounds.bottom - anchor.bottom,
    left: anchor.left - bounds.left,
    top: anchor.top - bounds.top,
  };
  const candidates = SIDES.map((side, index) => {
    const x = fitX(side === 'right' ? anchor.right + gap + radius : side === 'left' ? anchor.left - gap - radius : center.x);
    const y = fitY(side === 'bottom' ? anchor.bottom + gap + radius : side === 'top' ? anchor.top - gap - radius : center.y);
    const orb = { x, y, left: x - radius, top: y - radius, right: x + radius, bottom: y + radius };
    const bubble = placeBubble(side, orb);
    const needed = gap + diameter + (hasBubble ? bubbleGap + (side === 'left' || side === 'right' ? bubbleWidth : bubbleHeight) : 0);
    const score = [overlapFraction(orb, anchor), bubble.overlap, room[side] >= needed ? 0 : 1, -(room[side] / Math.max(width, height) - needed / Math.max(width, height)), index];
    return { x, y, bubbleX: bubble.x, bubbleY: bubble.y, placement: side, visible: true, fits: room[side] >= gap + diameter, score };
  });

  const preferred = candidates.find((candidate) => candidate.placement === requestedSide);
  const chosen = preferred?.fits ? preferred : candidates.sort((a, b) => compare(a.score, b.score))[0];
  return { x: chosen.x, y: chosen.y, bubbleX: chosen.bubbleX, bubbleY: chosen.bubbleY, placement: chosen.placement, visible: chosen.visible };
}
