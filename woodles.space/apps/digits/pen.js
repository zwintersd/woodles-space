/* woodles.space · pen.js
 *
 * SVG pen-stroke animation for handwritten digits 0-9.
 * Zero dependencies, framework-agnostic — drop it into anything that has a DOM.
 *
 * The technique: every stroke is an SVG <path>. We set stroke-dasharray to the
 * path's full length and stroke-dashoffset to that same length, which hides it.
 * Animating stroke-dashoffset down to 0 reveals the stroke progressively, so it
 * reads as a pen drawing the line. Multi-stroke digits play their strokes one
 * after another, in the order a teacher would form them.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Every glyph is authored inside a 100 x 140 cell. The digit body sits between
 * y≈27 (top line) and y≈116 (baseline), leaving headroom for jitter. */
export const CELL = { w: 100, h: 140 };

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

const reducedMotion =
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Stroke data. Each digit is an ordered list of path `d` strings — the order
 * is the pedagogically correct stroke order (the way you teach a child). */
export const DIGIT_STROKES = {
  // one counter-clockwise oval, opened at the top
  '0': ['M50,28 C33,28 24,49 24,72 C24,98 35,116 50,116 C65,116 76,95 76,71 C76,46 67,28 50,28 Z'],
  // a short lead-in flag, then the long trunk straight down
  '1': ['M33,46 L53,30', 'M53,30 L53,116'],
  // top hook, a long diagonal down to the left, then the base
  '2': ['M29,48 C29,32 45,24 58,28 C72,32 78,46 70,59 C62,72 42,89 27,115 L78,115'],
  // upper bump in to the middle, then the lower bump curling back
  '3': ['M30,41 C36,28 58,25 66,36 C73,46 60,60 45,60 C62,60 76,72 70,91 C63,110 38,114 27,98'],
  // diagonal down-left into a crossbar, then the vertical leg
  '4': ['M59,28 L24,86 L82,86', 'M64,43 L64,117'],
  // down the spine into the belly loop, then the hat across the top
  '5': ['M39,33 L36,66 C58,55 79,69 73,92 C67,113 42,118 28,103', 'M38,32 L71,31'],
  // a sweep down from the top-right that curls into a closed lower loop
  '6': ['M69,34 C50,38 32,58 30,83 C28,105 44,116 56,113 C70,110 77,95 71,83 C65,71 46,68 36,80'],
  // a flat top, then a long diagonal falling away to the left
  '7': ['M27,34 L78,34 C69,43 49,74 42,116'],
  // a single figure-eight crossing through the middle
  '8': ['M50,68 C37,62 31,46 41,35 C51,25 67,29 69,43 C71,56 56,64 50,68 C39,73 27,90 35,104 C43,119 68,119 74,103 C81,87 63,73 50,68 Z'],
  // a closed loop up top, then a tail dropping down to the left
  '9': ['M71,56 C71,39 56,29 44,33 C32,37 28,54 37,64 C46,75 66,72 71,57 C71,83 65,105 43,117'],
};

/* Animate a single stroke. Returns a promise that resolves when it finishes.
 * `path` must already be in the document so getTotalLength() is meaningful. */
export function animateStroke(path, duration = 480, easing = 'cubic-bezier(.42,.045,.32,1)') {
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length}`;
  path.getBoundingClientRect(); // flush style so the animation starts hidden

  const anim = path.animate(
    [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
    { duration: reducedMotion ? 1 : duration, easing, fill: 'forwards' },
  );
  return anim.finished.then(() => {
    path.style.strokeDashoffset = '0';
  });
}

let filterSeq = 0;

/* A per-mark ink filter: feTurbulence + displacement gives the stroke an
 * organically wobbly edge so nothing looks machine-perfect. */
function attachInkTexture(svg, group) {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  const id = `pen-ink-${++filterSeq}`;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '-30%');
  filter.setAttribute('y', '-30%');
  filter.setAttribute('width', '160%');
  filter.setAttribute('height', '160%');

  const turb = document.createElementNS(SVG_NS, 'feTurbulence');
  turb.setAttribute('type', 'fractalNoise');
  turb.setAttribute('baseFrequency', '0.013 0.018');
  turb.setAttribute('numOctaves', '2');
  turb.setAttribute('seed', String(Math.floor(rand(0, 9999))));
  turb.setAttribute('result', 'noise');

  const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
  disp.setAttribute('in', 'SourceGraphic');
  disp.setAttribute('in2', 'noise');
  disp.setAttribute('scale', '2.6');

  filter.appendChild(turb);
  filter.appendChild(disp);
  defs.appendChild(filter);
  group.setAttribute('filter', `url(#${id})`);
}

/* The composable core: animate an arbitrary ordered list of stroke `d` strings
 * into `target` (an <svg> or a <g>). Strokes play in sequence. Returns the
 * created <g> once every stroke has finished. */
export async function writeStrokes(target, strokeList, opts = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    rotate = 0,
    strokeDuration = 480,
    strokeGap = 120,
    ink = '#211d2e',
    weight = 7,
    weightJitter = 1,
    easing = 'cubic-bezier(.42,.045,.32,1)',
    texture = true,
    onStroke = null,
  } = opts;

  const svg = target.ownerSVGElement || target;
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute(
    'transform',
    `translate(${x} ${y}) scale(${scale}) rotate(${rotate} ${CELL.w / 2} ${CELL.h / 2})`,
  );
  if (texture) attachInkTexture(svg, group);
  target.appendChild(group);

  for (let i = 0; i < strokeList.length; i++) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', strokeList[i]);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', ink);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    // each stroke gets a slightly different weight — never uniform
    path.setAttribute('stroke-width', (weight + rand(-weightJitter, weightJitter)).toFixed(2));
    group.appendChild(path);

    await animateStroke(path, strokeDuration, easing);
    if (onStroke) onStroke(i + 1, strokeList.length);
    if (i < strokeList.length - 1) await wait(strokeGap);
  }
  return group;
}

/* Write a single digit (0-9). A small random tilt is applied per digit unless
 * an explicit `rotate` is passed. Returns the created <g>. */
export function writeDigit(target, digit, opts = {}) {
  const strokes = DIGIT_STROKES[String(digit)];
  if (!strokes) throw new Error(`pen.js: no stroke data for digit "${digit}"`);
  const rotate = opts.rotate ?? rand(-2.6, 2.6);
  return writeStrokes(target, strokes, { ...opts, rotate });
}

/* Stretch goal: animate a full two-digit addition problem onto `svg`.
 * Order is left-to-right, top-to-bottom: top number, plus sign, bottom
 * number, the rule line — with brief pauses between each element. The answer
 * space is left blank unless `revealAnswer` is set. */
export async function writeProblem(svg, a, b, opts = {}) {
  const {
    digitScale = 0.62,
    strokeDuration = 420,
    elementPause = 360,
    ink = '#211d2e',
    autoViewBox = true,
    revealAnswer = false,
  } = opts;

  const cw = CELL.w * digitScale; // column width
  const ch = CELL.h * digitScale; // column height
  const topDigits = String(a).split('');
  const botDigits = String(b).split('');
  const digitCols = Math.max(topDigits.length, botDigits.length);
  const answerCols = digitCols + 1; // leave room for a carried digit
  const signGutter = cw * 0.82; // left margin holding the + sign

  const totalW = signGutter + answerCols * cw;
  const rowGap = ch * 0.16;
  const topY = ch * 0.12;
  const botY = topY + ch + rowGap;
  const lineY = botY + ch + rowGap;
  const ansY = lineY + rowGap * 0.8;
  const totalH = ansY + ch + ch * 0.14;

  if (autoViewBox) svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

  const colX = (col) => signGutter + col * cw;

  // write a right-aligned row of digits, left-to-right
  const writeRow = async (digits, rowY) => {
    const offset = answerCols - digits.length;
    for (let i = 0; i < digits.length; i++) {
      await writeDigit(svg, digits[i], {
        x: colX(offset + i),
        y: rowY,
        scale: digitScale,
        strokeDuration,
        ink,
      });
    }
  };

  await writeRow(topDigits, topY);
  await wait(elementPause);

  // plus sign — lives in the left gutter, centered on the bottom row
  const arm = signGutter * 0.21;
  const px = signGutter * 0.44;
  const py = botY + ch * 0.52;
  await writeStrokes(
    svg,
    [`M${px - arm},${py} L${px + arm},${py}`, `M${px},${py - arm} L${px},${py + arm}`],
    { strokeDuration: strokeDuration * 0.7, ink, weight: 6, texture: true },
  );
  await wait(elementPause * 0.5);

  await writeRow(botDigits, botY);
  await wait(elementPause);

  // the rule line — a faintly wavy single stroke
  const lx1 = colX(0) - cw * 0.14;
  const lx2 = colX(answerCols) - cw * 0.14;
  await writeStrokes(
    svg,
    [`M${lx1},${lineY} Q${(lx1 + lx2) / 2},${lineY - 2.4} ${lx2},${lineY}`],
    { strokeDuration: strokeDuration * 1.15, ink, weight: 6.5, weightJitter: 0.5 },
  );

  if (revealAnswer) {
    await wait(elementPause * 1.6);
    await writeRow(String(Number(a) + Number(b)).split(''), ansY);
  }

  return {
    width: totalW,
    height: totalH,
    answer: Number(a) + Number(b),
    answerY: ansY,
    answerScale: digitScale,
  };
}
