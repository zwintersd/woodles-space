const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_SOURCE_BYTES = 1024 * 1024;
const SAFE_GEOMETRY = ['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'];
const SAFE_ATTRIBUTES = {
  path: ['d'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polygon: ['points'],
  polyline: ['points']
};
const RECIPE_VERBS = ['draw', 'style', 'checkpoint', 'transform', 'restore', 'fade', 'wait'];
const EASINGS = ['smooth', 'linear', 'there_and_back'];
const MOTION_LABELS = {
  draw: { title: 'Draw it on', choice: 'draw it on' },
  style: { title: 'Add color', choice: 'add color' },
  checkpoint: { title: 'Remember this pose', choice: 'remember this pose' },
  transform: { title: 'Move, turn, or resize', choice: 'move, turn, or resize' },
  restore: { title: 'Return to a saved pose', choice: 'return to a saved pose' },
  fade: { title: 'Fade away', choice: 'fade away' },
  wait: { title: 'Pause', choice: 'pause' }
};
const EASING_LABELS = {
  smooth: 'soft and smooth',
  linear: 'steady',
  there_and_back: 'out and back'
};
const MODE_LABELS = {
  together: 'move as one',
  radial: 'spread the pieces outward'
};
const CSS_EASINGS = {
  smooth: 'cubic-bezier(0.45, 0, 0.55, 1)',
  linear: 'linear',
  there_and_back: 'cubic-bezier(0.45, 0, 0.55, 1)'
};

const elements = {
  sampleSelect: document.getElementById('sample-select'),
  loadSample: document.getElementById('load-sample'),
  svgFile: document.getElementById('svg-file'),
  fileControl: document.querySelector('.file-control'),
  svgPaste: document.getElementById('svg-paste'),
  loadPaste: document.getElementById('load-paste'),
  clearSource: document.getElementById('clear-source'),
  sourceStatus: document.getElementById('source-status'),
  sourceError: document.getElementById('source-error'),
  sourcePath: document.getElementById('source-path'),
  sourceHash: document.getElementById('source-hash'),
  sourceAnatomy: document.getElementById('source-anatomy'),
  sourceViewBox: document.getElementById('source-viewbox'),
  safetyWarnings: document.getElementById('safety-warnings'),
  partList: document.getElementById('part-list'),
  includeOmitted: document.getElementById('include-omitted'),
  omittedNote: document.getElementById('omitted-note'),
  previewStage: document.getElementById('preview-stage'),
  previewSvg: document.getElementById('preview-svg'),
  previewGeometry: document.getElementById('preview-geometry'),
  previewMarkers: document.getElementById('preview-markers'),
  emptyStage: document.getElementById('empty-stage'),
  playbackStatus: document.getElementById('playback-status'),
  motionPreference: document.getElementById('motion-preference'),
  backgroundControls: document.getElementById('background-controls'),
  sizeControls: document.getElementById('size-controls'),
  showNumbers: document.getElementById('show-numbers'),
  playPreview: document.getElementById('play-preview'),
  pausePreview: document.getElementById('pause-preview'),
  replayPreview: document.getElementById('replay-preview'),
  selectedTitle: document.getElementById('selected-title'),
  selectedPanel: document.getElementById('selected-panel'),
  toggleSelectedPart: document.getElementById('toggle-selected-part'),
  partLabel: document.getElementById('part-label'),
  partGroup: document.getElementById('part-group'),
  groupList: document.getElementById('group-list'),
  groupsPanel: document.getElementById('groups-panel'),
  addGroup: document.getElementById('add-group'),
  timelineList: document.getElementById('timeline-list'),
  newStepVerb: document.getElementById('new-step-action'),
  addStep: document.getElementById('add-step'),
  recipeJson: document.getElementById('recipe-json'),
  jsonStatus: document.getElementById('json-status'),
  applyJson: document.getElementById('apply-json'),
  undoChange: document.getElementById('undo-change'),
  resetRecipe: document.getElementById('reset-recipe'),
  downloadRecipe: document.getElementById('download-recipe'),
  downloadSvg: document.getElementById('download-svg'),
  saveStatus: document.getElementById('save-status'),
  renderPlan: document.getElementById('render-plan'),
  renderCommand: document.getElementById('render-command'),
  copyRenderCommand: document.getElementById('copy-render-command')
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const state = {
  recipe: null,
  baseline: null,
  recipePath: '',
  source: null,
  selectedKey: null,
  history: [],
  removedParts: new Map(),
  runtime: new Map(),
  animations: [],
  checkpoints: new Map(),
  runToken: 0,
  running: false,
  paused: false,
  expandedSteps: new Set(),
  background: 'checker',
  size: 256
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function degreesFromRadians(value) {
  return Number((Number(value || 0) * 180 / Math.PI).toFixed(2));
}

function radiansFromDegrees(value) {
  return Number((Number(value || 0) * Math.PI / 180).toFixed(8));
}

function displayName(value) {
  const cleaned = String(value || 'picture')
    .replace(/\.svg$/i, '')
    .replace(/\bsvg\s+(?:lab|study)\b/gi, '')
    .replace(/\bsvg\b/gi, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return (cleaned || 'picture').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceKey(source) {
  return `${source.element}:${source.subpath == null ? 'whole' : source.subpath}`;
}

function partForKey(key) {
  return state.recipe?.parts.find((part) => sourceKey(part.source) === key) || null;
}

function candidateForKey(key) {
  return state.source?.candidates.find((candidate) => candidate.key === key) || null;
}

function slugify(value, fallback = 'svg-study') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/\.svg$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function uniquePartId(label) {
  const stem = slugify(label, 'part');
  let id = stem;
  let suffix = 2;
  const ids = new Set(state.recipe.parts.map((part) => part.id));
  while (ids.has(id)) id = `${stem}-${suffix++}`;
  return id;
}

function setError(message = '') {
  elements.sourceError.hidden = !message;
  elements.sourceError.textContent = message;
}

function setStatus(message) {
  elements.sourceStatus.textContent = message;
}

function setPlaybackStatus(message) {
  elements.playbackStatus.textContent = message;
}

function canonicalText(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\n+$/g, '');
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(canonicalText(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseViewBox(root) {
  const raw = root.getAttribute('viewBox');
  if (raw) {
    const values = raw.trim().split(/[\s,]+/).map(Number);
    if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
      return values;
    }
  }
  const width = Number.parseFloat(root.getAttribute('width'));
  const height = Number.parseFloat(root.getAttribute('height'));
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return [0, 0, width, height];
  }
  throw new Error("I couldn't work out this picture's size. Add a viewBox, or a numeric width and height, then try again.");
}

function splitPathData(data) {
  const pieces = data.match(/[Mm](?:(?![Mm])[\s\S])*/g)?.map((piece) => piece.trim()).filter(Boolean) || [];
  let current = [0, 0];
  const number = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][-+]?\\d+)?';
  const movePattern = new RegExp(`^([Mm])\\s*(${number})[\\s,]+(${number})`);
  return pieces.map((piece) => {
    const match = piece.match(movePattern);
    if (!match) return piece;
    const relative = match[1] === 'm';
    const start = [
      Number(match[2]) + (relative ? current[0] : 0),
      Number(match[3]) + (relative ? current[1] : 0)
    ];
    const normalized = `M${start[0]} ${start[1]}${piece.slice(match[0].length)}`;
    // Explicitly split candidates are expected to be closed. After Z, SVG's
    // current point returns to that subpath's start, which is the base for a
    // following relative moveto. Keeping that base prevents compound parts
    // from collapsing toward 0,0 in the browser preview.
    current = start;
    return normalized;
  });
}

function inheritedTransform(element, root) {
  const transforms = [];
  let current = element;
  while (current && current !== root) {
    const transform = current.getAttribute?.('transform');
    if (transform) transforms.unshift(transform);
    current = current.parentElement;
  }
  return transforms.join(' ');
}

function inspectSafety(root) {
  const warnings = [];
  const forbidden = root.querySelectorAll(
    'script, foreignObject, iframe, object, embed, image, use, animate, animateMotion, animateTransform, set, style'
  );
  if (forbidden.length) warnings.push(`Ignored ${forbidden.length} active, linked, or unsupported element${forbidden.length === 1 ? '' : 's'}.`);

  let eventAttributes = 0;
  let externalReferences = 0;
  let styleAttributes = 0;
  root.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name)) eventAttributes += 1;
      if (/^(?:href|xlink:href)$/i.test(attribute.name) && !attribute.value.startsWith('#')) externalReferences += 1;
      if (attribute.name === 'style') styleAttributes += 1;
    });
  });
  if (eventAttributes) warnings.push(`Removed ${eventAttributes} event-handler attribute${eventAttributes === 1 ? '' : 's'}.`);
  if (externalReferences) warnings.push(`Removed ${externalReferences} external reference${externalReferences === 1 ? '' : 's'}.`);
  if (styleAttributes) warnings.push(`Ignored ${styleAttributes} source style attribute${styleAttributes === 1 ? '' : 's'}; recipe colors stay authoritative.`);
  return warnings;
}

function parseSvg(text) {
  if (new TextEncoder().encode(text).byteLength > MAX_SOURCE_BYTES) {
    throw new Error('That picture is larger than the 1 MB limit. Try a smaller SVG.');
  }
  const documentValue = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (documentValue.querySelector('parsererror')) throw new Error("I couldn't read that as an SVG picture. Check the pasted text and try again.");
  const root = documentValue.documentElement;
  if (root.localName.toLowerCase() !== 'svg') throw new Error('That file does not begin with an SVG picture.');

  const viewBox = parseViewBox(root);
  const warnings = inspectSafety(root);
  const candidates = [];
  const geometry = [...root.querySelectorAll(SAFE_GEOMETRY.join(','))];
  geometry.forEach((element, elementIndex) => {
    const tag = element.localName.toLowerCase();
    const attributes = {};
    SAFE_ATTRIBUTES[tag].forEach((name) => {
      if (element.hasAttribute(name)) attributes[name] = element.getAttribute(name);
    });
    const transform = inheritedTransform(element, root);
    if (tag === 'path') {
      const subpaths = splitPathData(attributes.d || '');
      if (!subpaths.length) return;
      if (subpaths.length > 1) warnings.push(`Drawable ${elementIndex + 1} exposes ${subpaths.length} path candidates; splitting remains an explicit recipe choice.`);
      subpaths.forEach((data, subpath) => {
        candidates.push({
          key: sourceKey({ element: elementIndex, subpath }),
          source: { element: elementIndex, subpath },
          tag,
          attributes: { d: data },
          transform,
          label: `piece ${candidates.length + 1}`
        });
      });
      return;
    }
    candidates.push({
      key: sourceKey({ element: elementIndex, subpath: null }),
      source: { element: elementIndex, subpath: null },
      tag,
      attributes,
      transform,
      label: `piece ${candidates.length + 1}`
    });
  });
  if (!candidates.length) throw new Error("I couldn't find any shapes I can animate in that picture.");
  return { viewBox, drawableCount: geometry.length, candidates, warnings: [...new Set(warnings)] };
}

function validateRecipe(recipe) {
  if (!recipe || recipe.schemaVersion !== 1) throw new Error('Recipe JSON must use schemaVersion 1.');
  if (typeof recipe.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id)) throw new Error('Recipe id must be lowercase and hyphenated.');
  if (!recipe.source || typeof recipe.source.path !== 'string') throw new Error('Recipe source.path is required.');
  if (!Array.isArray(recipe.source.viewBox) || recipe.source.viewBox.length !== 4) throw new Error('Recipe source.viewBox must contain four numbers.');
  if (!Array.isArray(recipe.parts) || !recipe.parts.length) throw new Error('A recipe needs at least one explicit part.');
  if (!Array.isArray(recipe.groups) || !recipe.groups.length) throw new Error('A recipe needs at least one color group.');
  if (!Array.isArray(recipe.timeline) || !recipe.timeline.length) throw new Error('A recipe needs at least one timeline step.');
  const groups = new Set(recipe.groups.map((group) => group.id));
  const partIds = new Set();
  recipe.parts.forEach((part) => {
    if (!part.id || partIds.has(part.id)) throw new Error(`Duplicate or missing part id: ${part.id || 'unknown'}.`);
    partIds.add(part.id);
    if (!groups.has(part.group)) throw new Error(`Part ${part.id} uses an unknown group.`);
    if (!part.source || !Number.isInteger(part.source.element)) throw new Error(`Part ${part.id} needs a source element.`);
  });
  recipe.timeline.forEach((step, index) => {
    if (!RECIPE_VERBS.includes(step.verb)) throw new Error(`Timeline step ${index + 1} uses an unsupported verb.`);
    if (step.verb !== 'checkpoint' && (!Number.isFinite(Number(step.duration)) || Number(step.duration) < 0)) {
      throw new Error(`Timeline step ${index + 1} needs a non-negative duration.`);
    }
  });
  return recipe;
}

function defaultRecipe(name, hash, parsed) {
  const id = slugify(name);
  return {
    schemaVersion: 1,
    id,
    name: id.replace(/-/g, ' '),
    source: {
      path: `assets/${name || `${id}.svg`}`,
      sha256: hash,
      expectedElements: parsed.drawableCount,
      viewBox: parsed.viewBox
    },
    omitted: [],
    parts: parsed.candidates.map((candidate, index) => ({
      id: `part-${String(index + 1).padStart(2, '0')}`,
      label: candidate.label,
      source: clone(candidate.source),
      group: 'artwork'
    })),
    groups: [{ id: 'artwork', label: 'picture', color: '#a7d9cf' }],
    style: {
      height: 4.2,
      initialFill: '#f3ecda',
      fillOpacity: 0.96,
      stroke: '#34281d',
      strokeWidth: 1.9,
      strokeOpacity: 0.88
    },
    timeline: [
      { id: 'draw', verb: 'draw', target: 'all', duration: 0.9, ease: 'smooth', staggerRatio: 0.04 },
      { id: 'color', verb: 'style', target: 'all', duration: 0.45, ease: 'smooth', staggerRatio: 0.04 },
      { id: 'assembled', verb: 'checkpoint', target: 'all', name: 'assembled' },
      { id: 'lift', verb: 'transform', target: 'all', mode: 'together', duration: 0.55, ease: 'smooth', shift: [0, 0.45, 0], scale: 0.9, rotate: 0.12 },
      { id: 'settle', verb: 'restore', target: 'all', name: 'assembled', duration: 0.5, ease: 'smooth' },
      { id: 'clear', verb: 'fade', target: 'all', duration: 0.4, ease: 'smooth', scale: 0.9 },
      { id: 'breath', verb: 'wait', target: 'all', duration: 0.06 }
    ]
  };
}

async function installSource({ text, name, origin, path, recipe, recipePath }) {
  setError('');
  const parsed = parseSvg(text);
  const hash = await sha256(text);
  const nextRecipe = recipe ? validateRecipe(clone(recipe)) : defaultRecipe(name, hash, parsed);
  if (recipe && nextRecipe.source.sha256 !== hash) {
    throw new Error(`Source hash mismatch for ${name}. The SVG changed after this recipe was made.`);
  }
  if (recipe && nextRecipe.source.expectedElements !== parsed.drawableCount) {
    throw new Error(`Source anatomy mismatch: recipe expects ${nextRecipe.source.expectedElements} drawables, but the SVG exposes ${parsed.drawableCount}.`);
  }

  state.recipe = nextRecipe;
  state.baseline = clone(nextRecipe);
  state.recipePath = recipePath || `svg-recipes/${nextRecipe.id}.json`;
  state.source = {
    text,
    name,
    origin,
    path: path || nextRecipe.source.path,
    bytes: new TextEncoder().encode(text).byteLength,
    hash,
    ...parsed
  };
  state.selectedKey = null;
  state.history = [];
  state.removedParts.clear();
  state.expandedSteps.clear();
  stopRuntime();
  refreshAll();
  setStatus(`${displayName(nextRecipe.name || name)} is ready. Choose a numbered piece to name it or change its color.`);
  elements.saveStatus.textContent = 'Your draft is ready whenever you want to download it.';
}

async function loadRecipeUrl(recipeUrl) {
  if (!/^\/animations\/svg-recipes\/[a-z0-9-]+\.json$/i.test(recipeUrl)) {
    throw new Error('Only checked-in SVG workshop recipes can be opened by URL.');
  }
  setStatus('Opening the example…');
  setError('');
  const recipeResponse = await fetch(recipeUrl);
  if (!recipeResponse.ok) throw new Error(`Recipe request returned ${recipeResponse.status}.`);
  const recipe = validateRecipe(await recipeResponse.json());
  if (!/^assets\/[a-z0-9._-]+\.svg$/i.test(recipe.source.path)) throw new Error('Recipe source must stay under animations/assets.');
  const assetUrl = `/animations/${recipe.source.path}`;
  const sourceResponse = await fetch(assetUrl);
  if (!sourceResponse.ok) throw new Error(`SVG request returned ${sourceResponse.status}.`);
  const text = await sourceResponse.text();
  await installSource({
    text,
    name: recipe.source.path.split('/').pop(),
    origin: 'checked-in workshop sample',
    path: recipe.source.path,
    recipe,
    recipePath: recipeUrl.replace(/^\/animations\//, '')
  });
}

function selectedCandidateIsIncluded() {
  return Boolean(state.selectedKey && partForKey(state.selectedKey));
}

function snapshotRecipe() {
  return JSON.stringify(state.recipe);
}

function captureFocus() {
  const active = document.activeElement;
  if (!active || active === document.body) return null;
  return {
    id: active.id || '',
    key: active.getAttribute('data-focus-key') || '',
    label: active.getAttribute('aria-label') || ''
  };
}

function restoreFocus(snapshot) {
  if (!snapshot) return;
  const selector = snapshot.id
    ? `#${CSS.escape(snapshot.id)}`
    : snapshot.key
      ? `[data-focus-key="${CSS.escape(snapshot.key)}"]`
      : snapshot.label
        ? `[aria-label="${CSS.escape(snapshot.label)}"]`
        : '';
  const next = selector ? document.querySelector(selector) : null;
  if (next && !next.disabled && !next.closest('[hidden]')) next.focus({ preventScroll: true });
}

function mutateRecipe(mutator, message = 'Your motion changed.') {
  if (!state.recipe) return;
  const focusedControl = captureFocus();
  state.history.push(snapshotRecipe());
  if (state.history.length > 60) state.history.shift();
  mutator(state.recipe);
  stopRuntime();
  refreshAll();
  restoreFocus(focusedControl);
  elements.jsonStatus.textContent = message;
  elements.saveStatus.textContent = message;
}

function refreshAll() {
  renderProvenance();
  renderPartMap();
  renderSelectedPart();
  renderGroups();
  renderTimeline();
  renderPreview(true);
  renderRecipeJson();
  renderPlan();
  elements.selectedPanel.hidden = !state.selectedKey;
  elements.groupsPanel.hidden = !state.recipe;
  elements.undoChange.disabled = !state.history.length;
  elements.resetRecipe.disabled = !state.recipe;
  elements.downloadRecipe.disabled = !state.recipe;
  elements.downloadSvg.disabled = !state.recipe;
  elements.copyRenderCommand.disabled = !state.recipe;
  elements.addGroup.disabled = !state.recipe;
  elements.addStep.disabled = !state.recipe;
}

function renderProvenance() {
  if (!state.source || !state.recipe) {
    elements.sourcePath.textContent = '—';
    elements.sourceHash.textContent = '—';
    elements.sourceAnatomy.textContent = '—';
    elements.sourceViewBox.textContent = '—';
    elements.safetyWarnings.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'No source inspected yet.' }));
    return;
  }
  elements.sourcePath.textContent = `${state.recipe.source.path} · ${state.source.origin}`;
  elements.sourceHash.textContent = state.source.hash;
  elements.sourceAnatomy.textContent = `${state.source.drawableCount} drawable${state.source.drawableCount === 1 ? '' : 's'} · ${state.source.candidates.length} candidate${state.source.candidates.length === 1 ? '' : 's'} · ${state.recipe.parts.length} included`;
  elements.sourceViewBox.textContent = state.source.viewBox.join(' ');
  const warnings = state.source.warnings.length ? state.source.warnings : ['No active or unsupported content reached the preview.'];
  elements.safetyWarnings.replaceChildren(...warnings.map((warning) => Object.assign(document.createElement('li'), { textContent: warning })));
}

function renderPartMap() {
  elements.partList.replaceChildren();
  if (!state.recipe || !state.source) {
    elements.omittedNote.textContent = 'Open a picture to see the pieces we can move.';
    elements.includeOmitted.disabled = true;
    return;
  }
  state.recipe.parts.forEach((part, index) => {
    const group = state.recipe.groups.find((candidate) => candidate.id === part.group);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'part-button';
    button.dataset.sourceKey = sourceKey(part.source);
    button.setAttribute('aria-pressed', String(sourceKey(part.source) === state.selectedKey));
    button.setAttribute('aria-label', `Part ${index + 1}: ${part.label}`);
    const number = document.createElement('strong');
    number.textContent = String(index + 1).padStart(2, '0');
    const dot = document.createElement('span');
    dot.className = 'part-dot';
    dot.style.background = group?.color || '#aaa';
    const label = document.createElement('span');
    label.textContent = part.label;
    button.append(number, dot, label);
    button.addEventListener('click', () => selectPart(sourceKey(part.source)));
    elements.partList.appendChild(button);
  });
  const included = new Set(state.recipe.parts.map((part) => sourceKey(part.source)));
  const omitted = state.source.candidates.filter((candidate) => !included.has(candidate.key));
  elements.omittedNote.textContent = omitted.length
    ? `${omitted.length} extra piece${omitted.length === 1 ? ' is' : 's are'} tucked away. Add ${omitted.length === 1 ? 'it' : 'them'} when you want.`
    : 'Every piece we found is part of this motion.';
  elements.includeOmitted.disabled = !omitted.length;
}

function selectPart(key) {
  state.selectedKey = key;
  renderPartMap();
  renderSelectedPart();
  renderPreview(true);
  elements.partList.querySelector(`[data-source-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}

function renderSelectedPart() {
  const candidate = candidateForKey(state.selectedKey);
  const part = partForKey(state.selectedKey);
  elements.selectedPanel.hidden = !candidate || !state.recipe;
  if (!candidate || !state.recipe) {
    elements.selectedTitle.textContent = 'choose a piece';
    elements.partLabel.value = '';
    elements.partLabel.disabled = true;
    elements.partGroup.replaceChildren();
    elements.partGroup.disabled = true;
    elements.toggleSelectedPart.disabled = true;
    elements.toggleSelectedPart.textContent = 'Hide this piece';
    return;
  }
  elements.selectedTitle.textContent = part?.label || candidate.label;
  elements.toggleSelectedPart.disabled = Boolean(part && state.recipe.parts.length === 1);
  elements.toggleSelectedPart.textContent = part ? 'Hide this piece' : 'Bring this piece back';
  elements.partLabel.disabled = !part;
  elements.partLabel.value = part?.label || candidate.label;
  elements.partGroup.replaceChildren(...state.recipe.groups.map((group) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.label;
    option.selected = part?.group === group.id;
    return option;
  }));
  elements.partGroup.disabled = !part;
}

function renderGroups() {
  elements.groupList.replaceChildren();
  if (!state.recipe) {
    elements.groupList.appendChild(Object.assign(document.createElement('p'), { className: 'empty-copy', textContent: 'Open a picture to make color families.' }));
    return;
  }
  state.recipe.groups.forEach((group) => {
    const row = document.createElement('div');
    row.className = 'group-row';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = group.color;
    input.setAttribute('aria-label', `Color for ${group.label}`);
    const copy = document.createElement('div');
    const name = document.createElement('input');
    name.type = 'text';
    name.value = group.label;
    name.dataset.focusKey = `family-name:${group.id}`;
    name.setAttribute('aria-label', `Name for ${group.label} color family`);
    copy.append(name);
    input.addEventListener('change', () => {
      mutateRecipe((recipe) => {
        recipe.groups.find((candidate) => candidate.id === group.id).color = input.value;
      }, `${group.label} color changed.`);
    });
    name.addEventListener('change', () => {
      mutateRecipe((recipe) => {
        recipe.groups.find((candidate) => candidate.id === group.id).label = name.value.trim() || group.id;
      }, `${group.label} was renamed.`);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'group-remove';
    remove.textContent = 'remove family';
    remove.setAttribute('aria-label', `Remove ${group.label} color family`);
    remove.disabled = state.recipe.groups.length === 1 || state.recipe.parts.some((part) => part.group === group.id);
    remove.hidden = remove.disabled;
    remove.addEventListener('click', () => {
      mutateRecipe((recipe) => {
        recipe.groups = recipe.groups.filter((candidate) => candidate.id !== group.id);
      }, `${group.label} color family was removed.`);
    });
    row.append(input, copy, remove);
    elements.groupList.appendChild(row);
  });
}

function makeField(labelText, control) {
  const label = document.createElement('label');
  label.append(document.createTextNode(labelText), control);
  return label;
}

function numberInput(value, label, onChange, options = {}) {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = options.step || '0.01';
  if (options.min != null) input.min = String(options.min);
  if (options.max != null) input.max = String(options.max);
  input.value = String(value ?? 0);
  input.setAttribute('aria-label', label);
  input.addEventListener('change', () => onChange(Number(input.value)));
  return input;
}

function selectInput(value, label, options, onChange) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', label);
  options.forEach(({ value: optionValue, label: optionLabel }) => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    select.appendChild(option);
  });
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function targetOptions() {
  if (!state.recipe) return [];
  return [
    { value: 'all', label: 'everything' },
    ...state.recipe.groups.map((group) => ({ value: group.id, label: `the ${group.label} family` })),
    ...state.recipe.parts.map((part) => ({ value: part.id, label: `just ${part.label}` }))
  ];
}

function targetLabel(target = 'all') {
  if (!state.recipe || target === 'all') return 'everything';
  const group = state.recipe.groups.find((candidate) => candidate.id === target);
  if (group) return `the ${group.label} family`;
  const part = state.recipe.parts.find((candidate) => candidate.id === target);
  return part ? `just ${part.label}` : target;
}

function secondsLabel(value) {
  const seconds = Number(value || 0);
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function stepSummary(step) {
  if (step.verb === 'checkpoint') return `save this as “${step.name || 'assembled'}”`;
  if (step.verb === 'wait') return secondsLabel(step.duration);
  const pieces = targetLabel(step.target);
  if (step.verb === 'restore') return `${pieces} · “${step.name || 'assembled'}” · ${secondsLabel(step.duration)}`;
  if (step.verb === 'transform') return `${pieces} · ${MODE_LABELS[step.mode || 'together']} · ${secondsLabel(step.duration)}`;
  return `${pieces} · ${secondsLabel(step.duration)}`;
}

function updateStep(index, updater, message) {
  mutateRecipe((recipe) => updater(recipe.timeline[index]), message);
}

function renderTimeline() {
  elements.timelineList.replaceChildren();
  if (!state.recipe) {
    elements.timelineList.appendChild(Object.assign(document.createElement('li'), {
      className: 'empty-copy',
      textContent: 'Open a picture and its motion steps will appear here.'
    }));
    return;
  }
  state.recipe.timeline.forEach((step, index) => {
    const item = document.createElement('li');
    item.className = 'timeline-step';
    const stepKey = step.id || `${index}-${step.verb}`;
    const details = document.createElement('details');
    details.className = 'step-details';
    details.open = state.expandedSteps.has(stepKey);
    details.addEventListener('toggle', () => {
      if (details.open) state.expandedSteps.add(stepKey);
      else state.expandedSteps.delete(stepKey);
    });
    const summary = document.createElement('summary');
    const title = document.createElement('strong');
    const accessibleNumber = document.createElement('span');
    accessibleNumber.className = 'sr-only';
    accessibleNumber.textContent = `Step ${index + 1}: `;
    title.append(accessibleNumber, document.createTextNode(MOTION_LABELS[step.verb]?.title || step.verb));
    const overview = document.createElement('span');
    overview.className = 'step-summary';
    overview.textContent = stepSummary(step);
    summary.append(title, overview);
    const grid = document.createElement('div');
    grid.className = 'step-grid';

    if (step.verb !== 'wait') {
      grid.appendChild(makeField('Which pieces?', selectInput(step.target || 'all', `Step ${index + 1} pieces`, targetOptions(), (value) => updateStep(index, (draft) => { draft.target = value; }, `Step ${index + 1} now applies to ${targetLabel(value)}.`))));
    }
    if (step.verb !== 'checkpoint') {
      grid.appendChild(makeField('How long? (seconds)', numberInput(step.duration, `Step ${index + 1} length in seconds`, (value) => updateStep(index, (draft) => { draft.duration = value; }, `Step ${index + 1} length changed.`), { min: 0 })));
      if (step.verb !== 'wait') {
        grid.appendChild(makeField('Motion feel', selectInput(step.ease || 'smooth', `Step ${index + 1} motion feel`, EASINGS.map((value) => ({ value, label: EASING_LABELS[value] })), (value) => updateStep(index, (draft) => { draft.ease = value; }, `Step ${index + 1} now feels ${EASING_LABELS[value]}.`))));
      }
      if (!['wait', 'restore', 'fade'].includes(step.verb)) {
        grid.appendChild(makeField('Delay between pieces (%)', numberInput(Number(step.staggerRatio || 0) * 100, `Step ${index + 1} delay between pieces in percent`, (value) => updateStep(index, (draft) => { draft.staggerRatio = value / 100; }, `Step ${index + 1} piece delay changed.`), { min: 0, max: 100, step: 1 })));
      }
    }
    if (step.verb === 'checkpoint' || step.verb === 'restore') {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = step.name || 'assembled';
      input.setAttribute('aria-label', `Step ${index + 1} saved pose name`);
      input.addEventListener('change', () => updateStep(index, (draft) => { draft.name = input.value; }, `Step ${index + 1} saved pose changed.`));
      grid.appendChild(makeField('Saved pose name', input));
    }
    if (step.verb === 'transform') {
      grid.appendChild(makeField('Movement', selectInput(step.mode || 'together', `Step ${index + 1} movement`, [
        { value: 'together', label: MODE_LABELS.together },
        { value: 'radial', label: MODE_LABELS.radial }
      ], (value) => updateStep(index, (draft) => { draft.mode = value; }, `Step ${index + 1} will ${MODE_LABELS[value]}.`))));
      if ((step.mode || 'together') === 'together') {
        grid.appendChild(makeField('Size (1 = same)', numberInput(step.scale ?? 1, `Step ${index + 1} size`, (value) => updateStep(index, (draft) => { draft.scale = value; }, `Step ${index + 1} size changed.`))));
        grid.appendChild(makeField('Turn around the center (degrees)', numberInput(degreesFromRadians(step.rotate), `Step ${index + 1} turn in degrees`, (value) => updateStep(index, (draft) => { draft.rotate = radiansFromDegrees(value); }, `Step ${index + 1} turn changed.`), { step: 1 })));
        grid.appendChild(makeField('Sideways (− left, + right)', numberInput(step.shift?.[0] ?? 0, `Step ${index + 1} sideways movement`, (value) => updateStep(index, (draft) => { draft.shift = draft.shift || [0, 0, 0]; draft.shift[0] = value; }, `Step ${index + 1} sideways movement changed.`))));
        grid.appendChild(makeField('Up or down (− down, + up)', numberInput(step.shift?.[1] ?? 0, `Step ${index + 1} vertical movement`, (value) => updateStep(index, (draft) => { draft.shift = draft.shift || [0, 0, 0]; draft.shift[1] = value; }, `Step ${index + 1} vertical movement changed.`))));
      } else {
        grid.appendChild(makeField('Starting distance', numberInput(step.distance ?? 0.6, `Step ${index + 1} starting distance`, (value) => updateStep(index, (draft) => { draft.distance = value; }, `Step ${index + 1} starting distance changed.`))));
        grid.appendChild(makeField('Extra distance per piece', numberInput(step.distanceStep ?? 0, `Step ${index + 1} extra distance per piece`, (value) => updateStep(index, (draft) => { draft.distanceStep = value; }, `Step ${index + 1} extra distance changed.`))));
        grid.appendChild(makeField('Extra turn per piece (degrees)', numberInput(degreesFromRadians(step.rotationStep), `Step ${index + 1} extra turn per piece in degrees`, (value) => updateStep(index, (draft) => { draft.rotationStep = radiansFromDegrees(value); }, `Step ${index + 1} extra turn changed.`), { step: 1 })));
        grid.appendChild(makeField('Starting size (1 = same)', numberInput(step.scaleBase ?? 1, `Step ${index + 1} starting size`, (value) => updateStep(index, (draft) => { draft.scaleBase = value; }, `Step ${index + 1} starting size changed.`))));
        grid.appendChild(makeField('Extra size per piece', numberInput(step.scaleStep ?? 0, `Step ${index + 1} extra size per piece`, (value) => updateStep(index, (draft) => { draft.scaleStep = value; }, `Step ${index + 1} extra size changed.`))));
        grid.appendChild(makeField('First direction (degrees)', numberInput(step.centerAngleDegrees ?? 0, `Step ${index + 1} first direction in degrees`, (value) => updateStep(index, (draft) => { draft.centerAngleDegrees = value; }, `Step ${index + 1} first direction changed.`), { step: 1 })));
      }
    }
    if (step.verb === 'fade') {
      grid.appendChild(makeField('Ending size (1 = same)', numberInput(step.scale ?? 1, `Step ${index + 1} ending size`, (value) => updateStep(index, (draft) => { draft.scale = value; }, `Step ${index + 1} ending size changed.`))));
    }

    const actions = document.createElement('div');
    actions.className = 'step-actions';
    [['earlier', -1], ['later', 1]].forEach(([label, direction]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-label', `Move step ${index + 1} ${label}`);
      button.disabled = direction < 0 ? index === 0 : index === state.recipe.timeline.length - 1;
      button.addEventListener('click', () => mutateRecipe((recipe) => {
        const [moved] = recipe.timeline.splice(index, 1);
        recipe.timeline.splice(index + direction, 0, moved);
      }, `Step ${index + 1} moved ${label}.`));
      actions.appendChild(button);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'remove';
    remove.setAttribute('aria-label', `Remove step ${index + 1}`);
    remove.disabled = state.recipe.timeline.length === 1;
    remove.addEventListener('click', () => {
      state.expandedSteps.delete(stepKey);
      mutateRecipe((recipe) => recipe.timeline.splice(index, 1), `Step ${index + 1} was removed.`);
    });
    actions.appendChild(remove);
    details.append(summary, grid, actions);
    item.append(details);
    elements.timelineList.appendChild(item);
  });
}

function groupColor(groupId) {
  return state.recipe.groups.find((group) => group.id === groupId)?.color || state.recipe.style.initialFill;
}

function createSafeShape(candidate) {
  const shape = document.createElementNS(SVG_NS, candidate.tag);
  Object.entries(candidate.attributes).forEach(([name, value]) => shape.setAttribute(name, value));
  if (candidate.transform) shape.setAttribute('transform', candidate.transform);
  return shape;
}

function renderPreview(colored = true) {
  elements.previewGeometry.replaceChildren();
  elements.previewMarkers.replaceChildren();
  state.runtime = new Map();
  if (!state.recipe || !state.source) {
    elements.emptyStage.hidden = false;
    return;
  }
  elements.emptyStage.hidden = true;
  elements.previewSvg.setAttribute('viewBox', state.source.viewBox.join(' '));
  state.recipe.parts.forEach((part, index) => {
    const candidate = candidateForKey(sourceKey(part.source));
    if (!candidate) return;
    const wrapper = document.createElementNS(SVG_NS, 'g');
    wrapper.classList.add('preview-part');
    if (candidate.key === state.selectedKey) wrapper.classList.add('selected');
    wrapper.dataset.partId = part.id;
    wrapper.dataset.transform = '';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-label', `Select ${part.label}`);
    const shape = createSafeShape(candidate);
    shape.setAttribute('fill', colored ? groupColor(part.group) : state.recipe.style.initialFill);
    shape.setAttribute('fill-opacity', String(state.recipe.style.fillOpacity));
    shape.setAttribute('stroke', state.recipe.style.stroke);
    shape.setAttribute('stroke-width', String(state.recipe.style.strokeWidth));
    shape.setAttribute('stroke-opacity', String(state.recipe.style.strokeOpacity));
    shape.setAttribute('vector-effect', 'non-scaling-stroke');
    wrapper.appendChild(shape);
    wrapper.addEventListener('click', () => selectPart(candidate.key));
    wrapper.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectPart(candidate.key);
      }
    });
    elements.previewGeometry.appendChild(wrapper);
    state.runtime.set(part.id, { part, candidate, wrapper, shape });

    if (elements.showNumbers.checked) {
      try {
        const bounds = wrapper.getBBox();
        const marker = document.createElementNS(SVG_NS, 'g');
        marker.classList.add('part-marker');
        const circle = document.createElementNS(SVG_NS, 'circle');
        const radius = Math.max(state.source.viewBox[2], state.source.viewBox[3]) * 0.027;
        circle.setAttribute('cx', String(bounds.x + bounds.width / 2));
        circle.setAttribute('cy', String(bounds.y + bounds.height / 2));
        circle.setAttribute('r', String(radius));
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(bounds.x + bounds.width / 2));
        text.setAttribute('y', String(bounds.y + bounds.height / 2));
        text.textContent = String(index + 1);
        marker.append(circle, text);
        elements.previewMarkers.appendChild(marker);
      } catch {
        // A malformed geometry candidate is already excluded by the safe parser.
      }
    }
  });
}

function renderRecipeJson() {
  if (!state.recipe) {
    elements.recipeJson.value = '';
    return;
  }
  elements.recipeJson.value = `${JSON.stringify(state.recipe, null, 2)}\n`;
}

function renderPlan() {
  elements.renderPlan.replaceChildren();
  if (!state.recipe) {
    elements.renderPlan.appendChild(Object.assign(document.createElement('li'), { textContent: 'Load a recipe to see its ordered render plan.' }));
    elements.renderCommand.value = '';
    return;
  }
  const sourceItem = document.createElement('li');
  sourceItem.textContent = `Verify ${state.recipe.source.path} against ${state.recipe.source.sha256.slice(0, 12)}…`;
  const anatomyItem = document.createElement('li');
  anatomyItem.textContent = `Construct ${state.recipe.parts.length} named part${state.recipe.parts.length === 1 ? '' : 's'} from ${state.recipe.source.expectedElements} drawable element${state.recipe.source.expectedElements === 1 ? '' : 's'}.`;
  const timelineItem = document.createElement('li');
  timelineItem.textContent = `Run ${state.recipe.timeline.map((step) => step.verb).join(' → ')}.`;
  const boundaryItem = document.createElement('li');
  boundaryItem.textContent = 'From apps/animations, write motion and poster only to the ignored local draft folder.';
  elements.renderPlan.append(sourceItem, anatomyItem, timelineItem, boundaryItem);
  const recipeFile = state.recipePath.split('/').pop() || `${state.recipe.id}.json`;
  elements.renderCommand.value = `Set-Location apps\\animations\n.\\.venv\\Scripts\\python.exe tools\\render_svg_recipe.py svg-recipes\\${recipeFile}`;
}

function includedRuntime(step) {
  if (!state.recipe) return [];
  if (!step.target || step.target === 'all') return [...state.runtime.values()];
  const byPart = state.runtime.get(step.target);
  if (byPart) return [byPart];
  const ids = new Set(state.recipe.parts.filter((part) => part.group === step.target).map((part) => part.id));
  return [...state.runtime.values()].filter((entry) => ids.has(entry.part.id));
}

function stopRuntime() {
  state.runToken += 1;
  state.animations.forEach((animation) => animation.cancel());
  state.animations = [];
  state.checkpoints = new Map();
  state.running = false;
  state.paused = false;
  elements.previewStage.dataset.playing = 'false';
  elements.pausePreview.disabled = true;
  elements.playPreview.disabled = !state.recipe;
  setPlaybackStatus(
    state.recipe
      ? (reducedMotion.matches ? 'motion reduced · ready' : 'ready')
      : 'waiting'
  );
}

async function waitForAnimations(animations, token) {
  state.animations = animations;
  await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  if (token !== state.runToken) throw new Error('cancelled');
  state.animations = [];
}

function animateEntry(entry, keyframes, options) {
  return entry.wrapper.animate(keyframes, { fill: 'forwards', ...options });
}

async function runStep(step, token) {
  const duration = Math.max(1, Number(step.duration || 0) * 1000);
  const easing = CSS_EASINGS[step.ease] || CSS_EASINGS.smooth;
  const entries = includedRuntime(step);
  if (step.verb === 'checkpoint') {
    const snapshot = new Map();
    entries.forEach((entry) => snapshot.set(entry.part.id, {
      transform: entry.wrapper.dataset.transform || '',
      opacity: entry.wrapper.style.opacity || '1',
      fill: entry.shape.getAttribute('fill')
    }));
    state.checkpoints.set(step.name, snapshot);
    return;
  }
  if (step.verb === 'wait') {
    const animation = elements.previewSvg.animate([{ opacity: 1 }, { opacity: 1 }], { duration, easing: 'linear' });
    await waitForAnimations([animation], token);
    return;
  }
  if (!entries.length) return;
  const stagger = duration * Number(step.staggerRatio || 0);

  if (step.verb === 'draw') {
    const animations = entries.map((entry, index) => {
      let length = 800;
      try { length = entry.shape.getTotalLength(); } catch { /* geometry fallback */ }
      entry.shape.style.strokeDasharray = `${length}`;
      entry.shape.style.strokeDashoffset = `${length}`;
      entry.shape.style.fillOpacity = '0';
      return entry.shape.animate(
        [{ strokeDashoffset: length, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: state.recipe.style.fillOpacity }],
        { duration, delay: stagger * index, easing, fill: 'forwards' }
      );
    });
    await waitForAnimations(animations, token);
    entries.forEach((entry) => {
      entry.shape.style.strokeDasharray = 'none';
      entry.shape.style.strokeDashoffset = '0';
      entry.shape.style.fillOpacity = String(state.recipe.style.fillOpacity);
    });
    return;
  }
  if (step.verb === 'style') {
    const animations = entries.map((entry, index) => entry.shape.animate(
      [{ fill: entry.shape.getAttribute('fill') }, { fill: step.fill || groupColor(entry.part.group) }],
      { duration, delay: stagger * index, easing, fill: 'forwards' }
    ));
    await waitForAnimations(animations, token);
    entries.forEach((entry) => entry.shape.setAttribute('fill', step.fill || groupColor(entry.part.group)));
    return;
  }
  if (step.verb === 'restore') {
    const snapshot = state.checkpoints.get(step.name);
    if (!snapshot) return;
    const animations = entries.flatMap((entry) => {
      const saved = snapshot.get(entry.part.id);
      if (!saved) return [];
      const animation = animateEntry(entry, [
        { transform: entry.wrapper.dataset.transform || 'none', opacity: entry.wrapper.style.opacity || 1 },
        { transform: saved.transform || 'none', opacity: saved.opacity || 1 }
      ], { duration, easing });
      return [animation];
    });
    await waitForAnimations(animations, token);
    entries.forEach((entry) => {
      const saved = snapshot.get(entry.part.id);
      if (!saved) return;
      entry.wrapper.dataset.transform = saved.transform;
      entry.wrapper.style.transform = saved.transform;
      entry.wrapper.style.opacity = saved.opacity;
      entry.shape.setAttribute('fill', saved.fill);
    });
    return;
  }
  if (step.verb === 'transform') {
    const pxPerUnit = state.size / 6.4;
    const animations = entries.map((entry, index) => {
      const base = entry.wrapper.dataset.transform || 'none';
      let target;
      if ((step.mode || 'together') === 'radial') {
        const bounds = entry.wrapper.getBBox();
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        const viewCenterX = state.source.viewBox[0] + state.source.viewBox[2] / 2;
        const viewCenterY = state.source.viewBox[1] + state.source.viewBox[3] / 2;
        let dx = centerX - viewCenterX;
        let dy = centerY - viewCenterY;
        const length = Math.hypot(dx, dy);
        if (length < 0.001) {
          const angle = (Number(step.centerAngleDegrees || 0) * Math.PI / 180) + index * Math.PI * 2 / entries.length;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
        } else {
          dx /= length;
          dy /= length;
        }
        const distance = (Number(step.distance || 0) + Number(step.distanceStep || 0) * (index % 3)) * pxPerUnit;
        const rotation = ((index % 3) - 1) * Number(step.rotationStep || 0);
        const scale = Number(step.scaleBase ?? 1) + Number(step.scaleStep || 0) * (index % 3);
        target = `translate(${dx * distance}px, ${dy * distance}px) rotate(${rotation}rad) scale(${scale})`;
      } else {
        const shift = step.shift || [0, 0, 0];
        target = `translate(${Number(shift[0] || 0) * pxPerUnit}px, ${-Number(shift[1] || 0) * pxPerUnit}px) rotate(${Number(step.rotate || 0)}rad) scale(${Number(step.scale ?? 1)})`;
      }
      const thereAndBack = step.ease === 'there_and_back';
      const keyframes = thereAndBack ? [{ transform: base }, { transform: target }, { transform: base }] : [{ transform: base }, { transform: target }];
      entry.wrapper.dataset.nextTransform = thereAndBack ? base : target;
      return animateEntry(entry, keyframes, { duration, easing });
    });
    await waitForAnimations(animations, token);
    entries.forEach((entry) => {
      entry.wrapper.dataset.transform = entry.wrapper.dataset.nextTransform || '';
      entry.wrapper.style.transform = entry.wrapper.dataset.transform;
      delete entry.wrapper.dataset.nextTransform;
    });
    return;
  }
  if (step.verb === 'fade') {
    const animations = entries.map((entry) => {
      const base = entry.wrapper.dataset.transform || 'none';
      return animateEntry(entry, [
        { opacity: Number(entry.wrapper.style.opacity || 1), transform: base },
        { opacity: 0, transform: `${base === 'none' ? '' : base} scale(${Number(step.scale ?? 1)})` }
      ], { duration, easing });
    });
    await waitForAnimations(animations, token);
    entries.forEach((entry) => { entry.wrapper.style.opacity = '0'; });
  }
}

async function startPreview() {
  if (!state.recipe || !state.source) return;
  if (state.running && state.paused) {
    state.animations.forEach((animation) => animation.play());
    state.paused = false;
    elements.pausePreview.disabled = false;
    setPlaybackStatus('playing');
    return;
  }
  stopRuntime();
  const token = state.runToken;
  renderPreview(false);
  state.running = true;
  state.paused = false;
  elements.previewStage.dataset.playing = 'true';
  elements.pausePreview.disabled = false;
  setPlaybackStatus('playing');
  try {
    for (const step of state.recipe.timeline) await runStep(step, token);
    if (token !== state.runToken) return;
    state.running = false;
    elements.previewStage.dataset.playing = 'false';
    elements.pausePreview.disabled = true;
    setPlaybackStatus('done');
    renderPreview(true);
  } catch (error) {
    if (error.message !== 'cancelled') {
      setPlaybackStatus('could not play');
      setError(`The preview stopped: ${error.message}`);
    }
  }
}

function pausePreview() {
  if (!state.running || state.paused) return;
  state.animations.forEach((animation) => animation.pause());
  state.paused = true;
  elements.pausePreview.disabled = true;
  setPlaybackStatus('paused');
}

function buildSafeSvgText() {
  if (!state.recipe || !state.source) return '';
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('xmlns', SVG_NS);
  root.setAttribute('viewBox', state.source.viewBox.join(' '));
  state.recipe.parts.forEach((part) => {
    const candidate = candidateForKey(sourceKey(part.source));
    if (!candidate) return;
    const shape = createSafeShape(candidate);
    shape.setAttribute('fill', groupColor(part.group));
    shape.setAttribute('fill-opacity', String(state.recipe.style.fillOpacity));
    shape.setAttribute('stroke', state.recipe.style.stroke);
    shape.setAttribute('stroke-width', String(state.recipe.style.strokeWidth));
    shape.setAttribute('stroke-opacity', String(state.recipe.style.strokeOpacity));
    root.appendChild(shape);
  });
  return `${new XMLSerializer().serializeToString(root)}\n`;
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function defaultStep(verb) {
  const id = `${verb}-${Date.now().toString(36)}`;
  if (verb === 'checkpoint') return { id, verb, target: 'all', name: 'assembled' };
  if (verb === 'restore') return { id, verb, target: 'all', name: 'assembled', duration: 0.5, ease: 'smooth' };
  if (verb === 'transform') return { id, verb, target: 'all', mode: 'together', duration: 0.5, ease: 'smooth', shift: [0, 0, 0], scale: 1, rotate: 0 };
  if (verb === 'fade') return { id, verb, target: 'all', duration: 0.4, ease: 'smooth', scale: 0.9 };
  if (verb === 'wait') return { id, verb, target: 'all', duration: 0.1 };
  return { id, verb, target: 'all', duration: 0.5, ease: 'smooth', staggerRatio: 0.04 };
}

async function applyJson() {
  try {
    const parsed = validateRecipe(JSON.parse(elements.recipeJson.value));
    if (!state.source || parsed.source.path !== state.recipe?.source.path) {
      if (!/^assets\/[a-z0-9._-]+\.svg$/i.test(parsed.source.path)) throw new Error('Changed recipe sources must stay under animations/assets.');
      const response = await fetch(`/animations/${parsed.source.path}`);
      if (!response.ok) throw new Error(`SVG request returned ${response.status}.`);
      state.history.push(snapshotRecipe());
      await installSource({
        text: await response.text(),
        name: parsed.source.path.split('/').pop(),
        origin: 'recipe JSON source',
        path: parsed.source.path,
        recipe: parsed,
        recipePath: `svg-recipes/${parsed.id}.json`
      });
    } else {
      state.history.push(snapshotRecipe());
      state.recipe = clone(parsed);
      state.removedParts.clear();
      stopRuntime();
      refreshAll();
    }
    elements.jsonStatus.textContent = 'JSON applied to the visible controls.';
    elements.saveStatus.textContent = 'The exact motion data was applied.';
  } catch (error) {
    elements.jsonStatus.textContent = `JSON not applied: ${error.message}`;
    elements.recipeJson.focus();
  }
}

elements.loadSample.addEventListener('click', async () => {
  try { await loadRecipeUrl(elements.sampleSelect.value); } catch (error) { setError(error.message); setStatus("That example couldn't be opened."); }
});

elements.svgFile.addEventListener('change', async () => {
  const file = elements.svgFile.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_SOURCE_BYTES) throw new Error('That picture is larger than the 1 MB limit. Try a smaller SVG.');
    await installSource({ text: await file.text(), name: file.name, origin: 'local file' });
  } catch (error) { setError(error.message); }
});

['dragenter', 'dragover'].forEach((type) => elements.fileControl.addEventListener(type, (event) => {
  event.preventDefault();
  elements.fileControl.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((type) => elements.fileControl.addEventListener(type, (event) => {
  event.preventDefault();
  elements.fileControl.classList.remove('dragging');
}));
elements.fileControl.addEventListener('drop', async (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  try { await installSource({ text: await file.text(), name: file.name, origin: 'dropped local file' }); } catch (error) { setError(error.message); }
});

elements.loadPaste.addEventListener('click', async () => {
  try {
    if (!elements.svgPaste.value.trim()) throw new Error('Paste an SVG before trying to open it.');
    await installSource({ text: elements.svgPaste.value, name: 'pasted-svg.svg', origin: 'pasted in this browser tab' });
  } catch (error) { setError(error.message); }
});

elements.clearSource.addEventListener('click', () => {
  stopRuntime();
  state.recipe = null;
  state.baseline = null;
  state.source = null;
  state.selectedKey = null;
  state.history = [];
  state.removedParts.clear();
  state.expandedSteps.clear();
  state.recipePath = '';
  elements.svgFile.value = '';
  elements.svgPaste.value = '';
  setError('');
  setStatus('Try an example or choose a picture from your computer.');
  elements.saveStatus.textContent = 'Open a picture to begin.';
  refreshAll();
});

elements.includeOmitted.addEventListener('click', () => {
  if (!state.recipe || !state.source) return;
  const included = new Set(state.recipe.parts.map((part) => sourceKey(part.source)));
  const candidate = state.source.candidates.find((entry) => !included.has(entry.key));
  if (!candidate) return;
  state.selectedKey = candidate.key;
  mutateRecipe((recipe) => {
    recipe.parts.push({ id: uniquePartId(candidate.label), label: candidate.label, source: clone(candidate.source), group: recipe.groups[0].id });
    recipe.omitted = (recipe.omitted || []).filter((entry) => sourceKey(entry.source) !== candidate.key);
  }, `${candidate.label} was added to the picture.`);
});

elements.toggleSelectedPart.addEventListener('click', () => {
  const candidate = candidateForKey(state.selectedKey);
  if (!candidate || !state.recipe) return;
  const part = partForKey(state.selectedKey);
  if (part) state.removedParts.set(candidate.key, clone(part));
  mutateRecipe((recipe) => {
    if (part) {
      recipe.parts = recipe.parts.filter((entry) => sourceKey(entry.source) !== candidate.key);
      recipe.omitted = recipe.omitted || [];
      if (!recipe.omitted.some((entry) => sourceKey(entry.source) === candidate.key)) {
        recipe.omitted.push({ source: clone(candidate.source), reason: 'removed explicitly in SVG Motion Bench' });
      }
    } else {
      recipe.parts.push(state.removedParts.get(candidate.key) || { id: uniquePartId(candidate.label), label: candidate.label, source: clone(candidate.source), group: recipe.groups[0].id });
      recipe.omitted = (recipe.omitted || []).filter((entry) => sourceKey(entry.source) !== candidate.key);
      state.removedParts.delete(candidate.key);
    }
  }, part ? `${candidate.label} is hidden from this motion.` : `${candidate.label} is back in this motion.`);
});

elements.partLabel.addEventListener('change', () => {
  const key = state.selectedKey;
  mutateRecipe((recipe) => { recipe.parts.find((part) => sourceKey(part.source) === key).label = elements.partLabel.value.trim() || 'unnamed piece'; }, 'The piece has its new name.');
});
elements.partGroup.addEventListener('change', () => {
  const key = state.selectedKey;
  mutateRecipe((recipe) => { recipe.parts.find((part) => sourceKey(part.source) === key).group = elements.partGroup.value; }, 'The piece moved to its new color family.');
});
elements.addGroup.addEventListener('click', () => {
  if (!state.recipe) return;
  const palette = ['#c9b7ea', '#f2aa8a', '#8fc7bc', '#e8c468', '#b98aaa'];
  mutateRecipe((recipe) => {
    let number = recipe.groups.length + 1;
    let id = `group-${number}`;
    const ids = new Set(recipe.groups.map((group) => group.id));
    while (ids.has(id)) id = `group-${++number}`;
    recipe.groups.push({ id, label: `family ${number}`, color: palette[(number - 2) % palette.length] });
  }, 'A new color family was added.');
});

elements.backgroundControls.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-background]');
  if (!button) return;
  state.background = button.dataset.background;
  elements.previewStage.dataset.background = state.background;
  elements.backgroundControls.querySelectorAll('button').forEach((entry) => entry.setAttribute('aria-pressed', String(entry === button)));
});
elements.sizeControls.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-size]');
  if (!button) return;
  state.size = Number(button.dataset.size);
  document.documentElement.style.setProperty('--preview-size', `${state.size}px`);
  elements.sizeControls.querySelectorAll('button').forEach((entry) => entry.setAttribute('aria-pressed', String(entry === button)));
});
elements.showNumbers.addEventListener('change', () => renderPreview(true));
elements.playPreview.addEventListener('click', startPreview);
elements.pausePreview.addEventListener('click', pausePreview);
elements.replayPreview.addEventListener('click', () => { stopRuntime(); startPreview(); });

elements.addStep.addEventListener('click', () => {
  const step = defaultStep(elements.newStepVerb.value);
  state.expandedSteps.add(step.id);
  mutateRecipe((recipe) => recipe.timeline.push(step), `Added: ${MOTION_LABELS[step.verb].choice}.`);
});
elements.applyJson.addEventListener('click', applyJson);
elements.undoChange.addEventListener('click', () => {
  if (!state.history.length) return;
  state.recipe = JSON.parse(state.history.pop());
  stopRuntime();
  refreshAll();
  elements.jsonStatus.textContent = 'Last recipe change undone.';
  elements.saveStatus.textContent = 'Undid the last change.';
});
elements.resetRecipe.addEventListener('click', () => {
  if (!state.baseline || !window.confirm('Start over with the original drawing? This will undo every change from this visit.')) return;
  state.recipe = clone(state.baseline);
  state.history = [];
  state.removedParts.clear();
  state.expandedSteps.clear();
  stopRuntime();
  refreshAll();
  elements.jsonStatus.textContent = 'Recipe reset to the loaded source.';
  elements.saveStatus.textContent = 'Back to the original drawing and motion.';
});
elements.downloadRecipe.addEventListener('click', () => {
  if (!state.recipe) return;
  const filename = state.recipePath.split('/').pop() || `${state.recipe.id}.json`;
  downloadText(`${JSON.stringify(state.recipe, null, 2)}\n`, filename, 'application/json');
  elements.saveStatus.textContent = `Downloaded ${filename}.`;
});
elements.downloadSvg.addEventListener('click', () => {
  if (!state.recipe) return;
  const filename = state.recipe.source.path.split('/').pop();
  downloadText(buildSafeSvgText(), filename, 'image/svg+xml');
  elements.saveStatus.textContent = `Downloaded ${filename}.`;
});
elements.copyRenderCommand.addEventListener('click', async () => {
  if (!elements.renderCommand.value) return;
  try {
    await navigator.clipboard.writeText(elements.renderCommand.value);
    elements.jsonStatus.textContent = 'Local draft render command copied.';
  } catch {
    elements.renderCommand.select();
    document.execCommand('copy');
    elements.jsonStatus.textContent = 'Local draft render command selected and copied.';
  }
});

function motionPreferenceChanged() {
  if (reducedMotion.matches) {
    pausePreview();
    elements.motionPreference.textContent = 'motion is reduced on this device · the picture stays still until you press play';
  } else {
    elements.motionPreference.textContent = 'the picture stays still until you press play';
  }
}
if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', motionPreferenceChanged);
else reducedMotion.addListener(motionPreferenceChanged);

motionPreferenceChanged();
refreshAll();

const requestedRecipe = new URLSearchParams(window.location.search).get('recipe');
if (requestedRecipe && /^\/animations\/svg-recipes\/[a-z0-9-]+\.json$/i.test(requestedRecipe)) {
  if ([...elements.sampleSelect.options].some((option) => option.value === requestedRecipe)) elements.sampleSelect.value = requestedRecipe;
  loadRecipeUrl(requestedRecipe).catch((error) => { setError(error.message); setStatus("That linked example couldn't be opened."); });
}
