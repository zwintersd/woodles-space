import { placeFaerie } from './placement.js';
import { styles } from './styles.js';

const tones = {
  moonlight: '#98eaf5',
  lilac: '#c9b4ff',
  rose: '#ffb9ca',
  leaf: '#caeaa1'
};
const placements = new Set(['auto', 'top', 'right', 'bottom', 'left']);
const clamp = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));

function appearance(options, previous = { tone: 'moonlight', motion: 'auto', size: 56 }) {
  const next = { ...previous, ...options };
  if (!Object.hasOwn(tones, next.tone)) throw new TypeError('Unknown Faerie tone.');
  if (!['auto', 'reduced'].includes(next.motion)) throw new TypeError('Unknown Faerie motion preference.');
  if (!Number.isFinite(next.size) || next.size < 40 || next.size > 88) {
    throw new RangeError('Faerie size must be between 40 and 88 pixels.');
  }
  return { tone: next.tone, motion: next.motion, size: next.size };
}

function hintOptions(options) {
  if (options.duration !== undefined && (!Number.isFinite(options.duration) || options.duration < 0)) {
    throw new RangeError('Hint duration must be a nonnegative number of milliseconds.');
  }
  if (options.action && (typeof options.action.label !== 'string' || !options.action.label.trim() || typeof options.action.onSelect !== 'function')) {
    throw new TypeError('A Faerie action needs a label and an onSelect callback.');
  }
}

/** A browser-only factory; the module itself is safe to import during SSR. */
export function createFaerie(options = {}) {
  const doc = options.container?.ownerDocument ?? globalThis.document;
  const win = doc?.defaultView;
  if (!win || !doc.body) throw new Error('Create Faerie after the page has mounted in a browser.');
  const container = options.container ?? doc.body;
  if (!(container instanceof win.HTMLElement) || !container.isConnected) throw new TypeError('Faerie container must be a connected HTML element.');
  if (options.zIndex !== undefined && !Number.isFinite(options.zIndex)) throw new TypeError('Faerie zIndex must be finite.');
  let look = appearance(options);
  let state = 'idle';
  let destroyed = false;
  let target = null;
  let cue = null;
  let frameId = 0;
  let timerId = 0;
  let focusTarget = null;
  let lastPosition = '';
  let home = null;
  let pointer = null;
  let drag = null;
  let suppressClick = false;
  const abort = new win.AbortController();
  const media = win.matchMedia('(prefers-reduced-motion: reduce)');
  const element = doc.createElement('div');
  element.dataset.faerie = '';
  element.dataset.state = state;
  element.style.zIndex = String(options.zIndex ?? 2147483000);
  const shadow = element.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${styles}</style>
    <div class="ring" hidden aria-hidden="true"></div>
    <div class="flight">
      <button class="orb" type="button" aria-label="Faerie" title="Faerie — click for a hello, or drag to perch">
        <span class="body" aria-hidden="true">
          <svg class="wings" viewBox="0 0 100 90" aria-hidden="true">
            <path class="wing" d="M49 55C36 50 13 26 12 12C11 2 27 7 39 20C49 32 51 46 49 55Z"/>
            <path class="wing right" d="M51 55C64 50 87 26 88 12C89 2 73 7 61 20C51 32 49 46 51 55Z"/>
            <path class="wing small" d="M46 56C31 54 13 63 18 72C25 80 41 65 46 56Z"/>
            <path class="wing small right" d="M54 56C69 54 87 63 82 72C75 80 59 65 54 56Z"/>
            <path class="vein" d="M48 51Q29 28 18 13M52 51Q71 28 82 13M44 58L22 70M56 58L78 70"/>
          </svg>
          <span class="core"></span>
          <span class="dust"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </span>
      </button>
    </div>
    <div class="hint" role="group" aria-label="Faerie’s hint" hidden>
      <div class="hint-header"><span class="name">Faerie</span><button class="close" type="button" aria-label="Dismiss Faerie’s hint">×</button></div>
      <p class="message"></p><div class="actions"></div>
    </div>
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
  const flight = shadow.querySelector('.flight');
  const orb = shadow.querySelector('.orb');
  const ring = shadow.querySelector('.ring');
  const hint = shadow.querySelector('.hint');
  const messageNode = shadow.querySelector('.message');
  const actions = shadow.querySelector('.actions');
  const live = shadow.querySelector('[role="status"]');
  container.append(element);

  function emit(name, detail = {}) {
    element.dispatchEvent(new win.CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  function setState(next) {
    if (destroyed) return;
    const changed = state !== next;
    state = next;
    element.dataset.state = state;
    element.hidden = state === 'hidden';
    orb.setAttribute('aria-label', state === 'idle' ? 'Faerie' : `Faerie, ${state}. Click to rest.`);
    if (changed) emit('faerie-statechange', { state });
  }

  function viewport() {
    // VisualViewport includes the space left when a phone keyboard is open.
    return {
      width: Math.max(1, win.visualViewport?.width ?? win.innerWidth),
      height: Math.max(1, win.visualViewport?.height ?? win.innerHeight),
      left: win.visualViewport?.offsetLeft ?? 0,
      top: win.visualViewport?.offsetTop ?? 0
    };
  }

  function dimensions() {
    const view = viewport();
    const size = Math.min(look.size, view.width, view.height);
    const padding = Math.min(16, Math.max(0, (Math.min(view.width, view.height) - size) / 2));
    element.style.setProperty('--faerie-size', `${size}px`);
    hint.style.maxWidth = `${view.width - 2 * padding}px`;
    hint.style.maxHeight = `${view.height - 2 * padding}px`;
    return { ...view, size, padding };
  }

  function move(x, y, view) {
    const next = `${x},${y},${view.size},${view.left},${view.top}`;
    if (lastPosition === next) return;
    lastPosition = next;
    flight.style.transform = `translate3d(${x + view.left - view.size / 2}px, ${y + view.top - view.size / 2}px, 0)`;
  }

  function parked(view) {
    const inset = Math.min(72, view.width / 2, view.height / 2);
    return {
      x: clamp(home ? home.x * view.width : view.width - inset, view.size / 2 + view.padding, view.width - view.size / 2 - view.padding),
      y: clamp(home ? home.y * view.height : view.height - inset, view.size / 2 + view.padding, view.height - view.size / 2 - view.padding)
    };
  }

  function resolveTarget(source, includeClipped = false) {
    let value;
    try {
      value = typeof source === 'function' ? source() : source;
      if (typeof value === 'string') value = doc.querySelector(value);
    } catch {
      return null;
    }
    if (!value) return null;
    if (value instanceof win.Element) {
      if (!value.isConnected || value.ownerDocument !== doc || value.getClientRects().length === 0) return null;
      const rect = value.getBoundingClientRect();
      const clipped = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      let ancestor = value;
      while (ancestor && ancestor !== doc.documentElement) {
        const style = win.getComputedStyle(ancestor);
        if (style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return null;
        if (!includeClipped && ancestor !== value && ancestor !== doc.body) {
          const bounds = ancestor.getBoundingClientRect();
          const left = bounds.left + (ancestor.clientLeft ?? 0);
          const top = bounds.top + (ancestor.clientTop ?? 0);
          if (style.overflowX !== 'visible') {
            clipped.left = Math.max(clipped.left, left);
            clipped.right = Math.min(clipped.right, left + ancestor.clientWidth);
          }
          if (style.overflowY !== 'visible') {
            clipped.top = Math.max(clipped.top, top);
            clipped.bottom = Math.min(clipped.bottom, top + ancestor.clientHeight);
          }
        }
        ancestor = ancestor.parentElement ?? ancestor.getRootNode()?.host;
      }
      if (!includeClipped && (clipped.right <= clipped.left || clipped.bottom <= clipped.top)) return null;
      return { element: value, rect: includeClipped ? rect : clipped };
    }
    if (Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return { element: null, rect: { left: value.x, right: value.x, top: value.y, bottom: value.y } };
    }
    return null;
  }

  function position() {
    if (destroyed || state === 'hidden') return;
    const view = dimensions();
    if (state === 'attending') {
      const resolved = resolveTarget(target);
      if (!resolved) { rest(); return; }
      const r = resolved.rect;
      const rect = { left: r.left - view.left, right: r.right - view.left, top: r.top - view.top, bottom: r.bottom - view.top };
      const placed = placeFaerie(rect, view, {
        size: view.size, padding: view.padding, placement: cue.placement,
        bubbleWidth: hint.hidden ? 0 : hint.offsetWidth,
        bubbleHeight: hint.hidden ? 0 : hint.offsetHeight
      });
      if (!placed.visible) { rest(); return; }
      focusTarget = resolved.element;
      move(placed.x, placed.y, view);
      hint.style.left = `${placed.bubbleX + view.left}px`;
      hint.style.top = `${placed.bubbleY + view.top}px`;
      const l = clamp(rect.left - 5, 3, view.width - 3);
      const t = clamp(rect.top - 5, 3, view.height - 3);
      const rEdge = clamp(rect.right + 5, l, view.width - 3);
      const bEdge = clamp(rect.bottom + 5, t, view.height - 3);
      ring.style.left = `${l + view.left}px`;
      ring.style.top = `${t + view.top}px`;
      ring.style.width = `${rEdge - l}px`;
      ring.style.height = `${bEdge - t}px`;
      ring.hidden = !resolved.element;
    } else {
      const point = state === 'following' && pointer ? {
        x: clamp(pointer.x - view.left + 48, view.size / 2 + view.padding, view.width - view.size / 2 - view.padding),
        y: clamp(pointer.y - view.top - 26, view.size / 2 + view.padding, view.height - view.size / 2 - view.padding)
      } : parked(view);
      move(point.x, point.y, view);
      if (!hint.hidden) {
        const width = hint.offsetWidth;
        const height = hint.offsetHeight;
        const gap = view.size / 2 + 22;
        let x = point.x - gap - width;
        let y = point.y - height / 2;
        if (x < view.padding) {
          x = point.x + gap;
          if (x + width > view.width - view.padding) {
            x = point.x - width / 2;
            y = point.y - gap - height;
          }
        }
        hint.style.left = `${clamp(x, view.padding, view.width - width - view.padding) + view.left}px`;
        hint.style.top = `${clamp(y, view.padding, view.height - height - view.padding) + view.top}px`;
      }
    }
  }

  function track() {
    frameId = 0;
    position();
    if (state === 'attending' && !destroyed) frameId = win.requestAnimationFrame(track);
  }

  function schedule() {
    if (!frameId && !destroyed && state !== 'hidden') frameId = win.requestAnimationFrame(track);
  }

  function clear() {
    win.clearTimeout(timerId);
    win.cancelAnimationFrame(frameId);
    timerId = frameId = 0;
    target = cue = focusTarget = null;
    ring.hidden = hint.hidden = true;
    messageNode.textContent = live.textContent = '';
    actions.replaceChildren();
  }

  function renderHint(message, options = {}, focusable = false) {
    if (typeof message !== 'string') throw new TypeError('Faerie hints must be plain text.');
    messageNode.textContent = message;
    live.textContent = message;
    hint.hidden = !message && !options.action && !focusable;
    if (options.action) {
      const button = doc.createElement('button');
      button.className = 'action primary';
      button.type = 'button';
      button.textContent = options.action.label;
      button.addEventListener('click', () => {
        if (destroyed) return;
        const callback = options.action.onSelect;
        emit('faerie-action', { label: options.action.label });
        callback();
      });
      actions.append(button);
    }
    if (focusable) {
      const button = doc.createElement('button');
      button.className = 'action';
      button.type = 'button';
      button.textContent = 'Focus target';
      button.addEventListener('click', () => {
        const node = focusTarget;
        if (!node?.isConnected) { rest(); return; }
        const focusNode = node.matches('button,a[href],input,select,textarea,[tabindex]') ? node : node.querySelector('button,a[href],input,select,textarea,[tabindex]');
        if (focusNode && typeof focusNode.focus === 'function') focusNode.focus({ preventScroll: true });
      });
      actions.append(button);
    }
    if (options.duration > 0) timerId = win.setTimeout(rest, Math.min(options.duration, 2147483647));
  }

  function hintHasFocus() {
    return Boolean(shadow.activeElement && hint.contains(shadow.activeElement));
  }

  function continueHintFocus(hadFocus) {
    // A selected tour action may replace its own button. Keep that interaction
    // inside the hint, while leaving all focus elsewhere on the page alone.
    if (hadFocus) (hint.hidden ? orb : actions.querySelector('button') ?? shadow.querySelector('.close')).focus({ preventScroll: true });
  }

  function rest() {
    if (destroyed) return;
    const returnFocus = hintHasFocus();
    clear();
    pointer = null;
    setState('idle');
    position();
    if (returnFocus) orb.focus({ preventScroll: true });
  }

  function dismiss() {
    if (destroyed || state === 'hidden' || state === 'idle') return;
    // If a hint button held focus, return it to the stable companion button.
    rest();
    emit('faerie-dismiss');
  }

  function attend(source, settings = {}) {
    if (destroyed) return false;
    hintOptions(settings);
    const placement = settings.placement ?? 'auto';
    if (!placements.has(placement)) throw new TypeError('Unknown Faerie placement.');
    const message = settings.message ?? '';
    if (typeof message !== 'string') throw new TypeError('Faerie hints must be plain text.');
    let resolved = resolveTarget(source, Boolean(settings.scroll));
    if (settings.scroll && resolved?.element) {
      resolved.element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
      resolved = resolveTarget(source);
    }
    const keepFocus = hintHasFocus();
    clear();
    if (!resolved) {
      rest();
      if (keepFocus) orb.focus({ preventScroll: true });
      return false;
    }
    target = source;
    cue = { ...settings, placement };
    const canFocus = Boolean(resolved.element && (resolved.element.matches('button,a[href],input,select,textarea,[tabindex]') || resolved.element.querySelector('button,a[href],input,select,textarea,[tabindex]')));
    renderHint(message, settings, canFocus);
    setState('attending');
    position();
    if (state !== 'attending') {
      if (keepFocus) orb.focus({ preventScroll: true });
      return false;
    }
    continueHintFocus(keepFocus);
    schedule();
    return true;
  }

  function say(message, settings = {}) {
    if (destroyed) return;
    hintOptions(settings);
    if (typeof message !== 'string') throw new TypeError('Faerie hints must be plain text.');
    const keepFocus = hintHasFocus();
    clear();
    renderHint(message, settings);
    setState('speaking');
    position();
    continueHintFocus(keepFocus);
  }

  function applyAppearance() {
    element.style.setProperty('--faerie-color', tones[look.tone]);
    element.dataset.tone = look.tone;
    element.dataset.motion = look.motion === 'reduced' || media.matches ? 'reduced' : 'full';
    position();
  }

  function configure(settings) {
    if (destroyed) return;
    look = appearance(settings, look);
    applyAppearance();
  }

  function follow(enabled = true) {
    if (destroyed) return;
    if (!enabled) { rest(); return; }
    clear();
    setState('following');
    position();
  }

  function celebrate(message = 'A little moment worth celebrating.') {
    if (destroyed) return;
    say(message, { duration: 3200 });
    setState('celebrating');
  }

  function hide() {
    if (destroyed) return;
    clear();
    setState('hidden');
  }

  function show() {
    if (destroyed) return;
    if (state === 'hidden') rest();
  }

  function destroy() {
    if (destroyed) return;
    clear();
    abort.abort();
    media.removeEventListener('change', applyAppearance);
    element.remove();
    destroyed = true;
    state = 'hidden';
    element.dataset.state = state;
  }

  const listen = (node, name, handler, settings = {}) => node.addEventListener(name, handler, { ...settings, signal: abort.signal });
  listen(shadow.querySelector('.close'), 'click', dismiss);
  listen(orb, 'click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (state === 'idle') say('I’m here. Show me where to help.');
    else dismiss();
  });
  listen(win, 'keydown', event => {
    if (event.key === 'Escape') dismiss();
  });
  listen(win, 'resize', schedule, { passive: true });
  listen(doc, 'scroll', schedule, { capture: true, passive: true });
  if (win.visualViewport) {
    listen(win.visualViewport, 'resize', schedule, { passive: true });
    listen(win.visualViewport, 'scroll', schedule, { passive: true });
  }
  listen(win, 'pointermove', event => {
    if (state !== 'following' || event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  }, { passive: true });
  listen(orb, 'pointerdown', event => {
    if (event.button !== 0) return;
    suppressClick = false;
    drag = { x: event.clientX, y: event.clientY, moved: false };
    orb.setPointerCapture(event.pointerId);
  });
  listen(orb, 'pointermove', event => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    drag.moved = true;
    const view = viewport();
    home = { x: (event.clientX - view.left) / view.width, y: (event.clientY - view.top) / view.height };
    rest();
  });
  listen(orb, 'pointerup', () => {
    suppressClick = Boolean(drag?.moved);
    drag = null;
  });
  listen(orb, 'pointercancel', () => { drag = null; });
  media.addEventListener('change', applyAppearance);
  applyAppearance();

  return {
    element,
    get state() { return state; },
    attend, say, celebrate, follow, rest, hide, show, configure, destroy
  };
}
