(() => {
  'use strict';

  const {
    STORAGE_KEY, DAY_KEYS, COLORS, MAX_CHOICE_OPTIONS,
    makeId, esc, cleanText, validTime, validDuration, validColor, timeMinutes,
    isLocalImageData, pictogramSource, openMojiCodepoint, symbolMarkup,
    sanitizeImage, sanitizeActivity, sanitizePlan, readWorkspace,
    choiceTitle, itemVisuals, itemImageIds, visualScheduleUrl
  } = window.ScheduleStudio;
  const CATEGORIES = ['Instruction', 'Communication', 'Play / leisure', 'Daily living', 'Movement', 'Sensory', 'Break', 'Transition', 'Other'];
  const COLOR_NAMES = { '#3978c7': 'Blue', '#32845f': 'Green', '#d27b32': 'Orange', '#a16ab5': 'Purple', '#d05c66': 'Rose', '#458d98': 'Teal', '#7c8797': 'Slate' };
  const SYMBOL_RECENTS_KEY = 'woodles.schedule-planner.symbol-recents.v1';
  const SYMBOL_GROUPS = ['Popular', 'Recent', 'Learning', 'Daily routines', 'Movement', 'Play', 'Nature', 'All'];
  const SYMBOL_CATALOG = [
    { char: '⭐', label: 'Star', groups: ['Popular', 'Play'], keywords: 'favorite reward' },
    { char: '🧩', label: 'Puzzle', groups: ['Popular', 'Learning', 'Play'], keywords: 'problem solving' },
    { char: '💬', label: 'Talk', groups: ['Popular', 'Learning'], keywords: 'communication speech' },
    { char: '📚', label: 'Read', groups: ['Popular', 'Learning'], keywords: 'book story library' },
    { char: '🧸', label: 'Comfort', groups: ['Popular', 'Play'], keywords: 'teddy toy safe' },
    { char: '🎨', label: 'Art', groups: ['Popular', 'Play'], keywords: 'paint create craft' },
    { char: '🎵', label: 'Music', groups: ['Popular', 'Play'], keywords: 'song listen' },
    { char: '🪙', label: 'Token', groups: ['Play'], keywords: 'coin reward turn' },
    { char: '💎', label: 'Gem', groups: ['Play'], keywords: 'reward treasure' },
    { char: '🏃', label: 'Run', groups: ['Popular', 'Movement'], keywords: 'exercise race' },
    { char: '🍎', label: 'Snack', groups: ['Popular', 'Daily routines', 'Nature'], keywords: 'food eat apple' },
    { char: '🪥', label: 'Brush teeth', groups: ['Popular', 'Daily routines'], keywords: 'toothbrush bathroom' },
    { char: '🧼', label: 'Wash', groups: ['Popular', 'Daily routines'], keywords: 'soap clean hands' },
    { char: '🧺', label: 'Laundry', groups: ['Popular', 'Daily routines'], keywords: 'clothes basket' },
    { char: '🚶', label: 'Walk', groups: ['Popular', 'Movement'], keywords: 'stroll outside' },
    { char: '🧘', label: 'Calm', groups: ['Popular', 'Movement'], keywords: 'breathe meditation quiet' },
    { char: '🌿', label: 'Nature', groups: ['Popular', 'Nature'], keywords: 'plant garden outside' },
    { char: '💧', label: 'Water', groups: ['Popular', 'Daily routines'], keywords: 'drink thirsty' },
    { char: '🏠', label: 'Home', groups: ['Popular', 'Daily routines'], keywords: 'house arrive' },
    { char: '🎯', label: 'Goal', groups: ['Popular', 'Learning', 'Play'], keywords: 'focus target' },
    { char: '✏️', label: 'Write', groups: ['Learning'], keywords: 'pencil draw homework' },
    { char: '🔤', label: 'Letters', groups: ['Learning'], keywords: 'alphabet spelling' },
    { char: '🔢', label: 'Numbers', groups: ['Learning'], keywords: 'math count' },
    { char: '📋', label: 'Checklist', groups: ['Learning'], keywords: 'plan list' },
    { char: '✅', label: 'Finished', groups: ['Learning', 'Daily routines'], keywords: 'done complete success' },
    { char: '🔓', label: 'Open', groups: ['Learning', 'Play'], keywords: 'unlock ready' },
    { char: '🔒', label: 'Wait', groups: ['Learning', 'Daily routines'], keywords: 'locked pause stop' },
    { char: '📈', label: 'Progress', groups: ['Learning'], keywords: 'chart growing' },
    { char: '⚖️', label: 'Balance', groups: ['Movement'], keywords: 'scales steady' },
    { char: '⏩', label: 'Next', groups: ['Daily routines', 'Movement'], keywords: 'fast forward transition' },
    { char: '🗑️', label: 'Clean up', groups: ['Daily routines'], keywords: 'trash tidy put away' },
    { char: '💠', label: 'Diamond', groups: ['Play'], keywords: 'gem reward' },
    { char: '🧠', label: 'Think', groups: ['Learning'], keywords: 'brain focus' },
    { char: '🍽️', label: 'Meal', groups: ['Daily routines'], keywords: 'eat food lunch dinner' },
    { char: '🚽', label: 'Bathroom', groups: ['Daily routines'], keywords: 'toilet washroom' },
    { char: '👕', label: 'Get dressed', groups: ['Daily routines'], keywords: 'clothes shirt' },
    { char: '🛏️', label: 'Rest', groups: ['Daily routines', 'Movement'], keywords: 'sleep bed nap' },
    { char: '🚌', label: 'Bus', groups: ['Daily routines', 'Movement'], keywords: 'ride travel school' },
    { char: '🎧', label: 'Listen', groups: ['Movement', 'Play'], keywords: 'headphones audio sound' },
    { char: '🌙', label: 'Quiet time', groups: ['Movement', 'Nature'], keywords: 'moon calm rest' },
    { char: '🫧', label: 'Sensory break', groups: ['Movement', 'Play'], keywords: 'bubbles sensory' },
    { char: '🎲', label: 'Game', groups: ['Play'], keywords: 'dice play turn' },
    { char: '🏆', label: 'Celebrate', groups: ['Play'], keywords: 'trophy success win' },
    { char: '🌈', label: 'Rainbow', groups: ['Play', 'Nature'], keywords: 'color weather' },
    { char: '🦋', label: 'Butterfly', groups: ['Nature', 'Play'], keywords: 'bug insect' },
    { char: '🐝', label: 'Bee', groups: ['Nature'], keywords: 'insect bug' },
    { char: '🐌', label: 'Snail', groups: ['Nature'], keywords: 'slow garden' },
    { char: '🐚', label: 'Shell', groups: ['Nature'], keywords: 'beach ocean' },
    { char: '🌱', label: 'Seedling', groups: ['Nature'], keywords: 'plant grow garden' },
    { char: '🌸', label: 'Flower', groups: ['Nature', 'Play'], keywords: 'blossom' },
    { char: '🌻', label: 'Sunflower', groups: ['Nature'], keywords: 'flower' },
    { char: '🌼', label: 'Blossom', groups: ['Nature'], keywords: 'flower' },
    { char: '🍄', label: 'Mushroom', groups: ['Nature', 'Play'], keywords: 'forest' },
    { char: '🍀', label: 'Clover', groups: ['Nature'], keywords: 'leaf luck' },
    { char: '🍯', label: 'Honey', groups: ['Nature', 'Daily routines'], keywords: 'food snack sweet' },
    { char: '🌾', label: 'Harvest', groups: ['Nature'], keywords: 'grain field' },
    { char: '🪵', label: 'Wood', groups: ['Nature', 'Play'], keywords: 'log forest' },
    { char: '🌰', label: 'Acorn', groups: ['Nature'], keywords: 'nut tree' },
    { char: '🍇', label: 'Grapes', groups: ['Nature', 'Daily routines'], keywords: 'fruit snack food' },
    { char: '✨', label: 'Sparkle', groups: ['Play'], keywords: 'magic special' },
    { char: '🔥', label: 'Warm up', groups: ['Movement'], keywords: 'fire heat' },
    { char: '📜', label: 'Story', groups: ['Learning', 'Play'], keywords: 'scroll read' }
  ];
  const app = document.getElementById('app');
  const planDialog = document.getElementById('planDialog');
  const activityDialog = document.getElementById('activityDialog');
  const imageEditorDialog = document.getElementById('imageEditorDialog');
  const activityDialogBody = document.getElementById('activityDialogBody');
  const toast = document.getElementById('toast');
  const saveStatus = document.getElementById('saveStatus');

  let workspace = readWorkspace();
  let currentPlanId = new URLSearchParams(location.search).get('plan') || '';
  let activeDayKey = DAY_KEYS.some((day) => day[0] === new URLSearchParams(location.search).get('day'))
    ? new URLSearchParams(location.search).get('day')
    : 'monday';
  let activityMode = 'new';
  let editingActivityId = '';
  let toastTimer;
  let cropImage = null;
  let cropObjectUrl = '';
  let cropPanX = 0;
  let cropPanY = 0;
  let cropZoomFactor = 1;
  let cropPointer = null;
  let cropSourceName = 'image';
  let cropAttachEnabled = false;
  let activeSymbolGroup = 'Popular';
  let choiceDraft = [];
  let recentSymbols = readRecentSymbols();

  function readRecentSymbols() {
    try {
      const value = JSON.parse(localStorage.getItem(SYMBOL_RECENTS_KEY) || '[]');
      return Array.isArray(value) ? value.filter((symbol, index) => SYMBOL_CATALOG.some((entry) => entry.char === symbol) && value.indexOf(symbol) === index).slice(0, 8) : [];
    } catch {
      return [];
    }
  }

  function rememberSymbol(symbol) {
    recentSymbols = [symbol].concat(recentSymbols.filter((entry) => entry !== symbol)).slice(0, 8);
    try { localStorage.setItem(SYMBOL_RECENTS_KEY, JSON.stringify(recentSymbols)); } catch {}
  }

  function renderSymbolResults(form) {
    const query = cleanText(form.elements.symbolSearch.value, 80, '').toLowerCase();
    const current = form.elements.icon.value || '⭐';
    let choices = activeSymbolGroup === 'Recent'
      ? recentSymbols.map((symbol) => SYMBOL_CATALOG.find((entry) => entry.char === symbol)).filter(Boolean)
      : SYMBOL_CATALOG.filter((entry) => activeSymbolGroup === 'All' || entry.groups.includes(activeSymbolGroup));
    if (query) choices = SYMBOL_CATALOG.filter((entry) => [entry.label, entry.keywords, entry.char].join(' ').toLowerCase().includes(query));
    const results = form.querySelector('#symbolResults');
    const count = form.querySelector('#symbolResultCount');
    form.querySelectorAll('[data-action="filter-symbols"]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.group === activeSymbolGroup));
    });
    const recentButton = form.querySelector('[data-group="Recent"]');
    if (recentButton) recentButton.textContent = 'Recent' + (recentSymbols.length ? ' · ' + recentSymbols.length : '');
    count.textContent = choices.length ? choices.length + (choices.length === 1 ? ' symbol' : ' symbols') : (activeSymbolGroup === 'Recent' ? 'Your picked symbols will show up here.' : 'No symbols found. Try another search.');
    results.innerHTML = choices.map((entry) => '<button class="symbol-option' + (entry.char === current ? ' is-selected' : '') + '" type="button" data-action="select-symbol" data-symbol="' + esc(entry.char) + '" aria-label="Choose ' + esc(entry.label) + '" aria-pressed="' + String(entry.char === current) + '" title="' + esc(entry.label) + '">' +
      '<span class="symbol-option-art" aria-hidden="true">' + symbolMarkup(entry.char, 30) + '</span><span class="symbol-option-label">' + esc(entry.label) + '</span></button>').join('');
  }

  function updateSymbolPreview(form) {
    const preview = form.querySelector('.symbol-preview');
    if (preview) preview.innerHTML = symbolMarkup(form.elements.icon.value || '⭐', 30);
  }

  function persist() {
    const now = new Date().toISOString();
    const plan = getPlan();
    if (plan) plan.updatedAt = now;
    const usedImages = new Set(workspace.activities.map((item) => item.imageAssetId).concat(
      workspace.plans.flatMap((entry) => entry.days.flatMap((day) => day.activities.flatMap(itemImageIds)))
    ).filter(Boolean));
    workspace.images = workspace.images.filter((image) => usedImages.has(image.id));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      saveStatus.textContent = 'Saved on this device';
    } catch {
      saveStatus.textContent = 'Could not save';
      showToast('This browser could not save the plan. Export a copy before leaving this page.');
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function getPlan() {
    return workspace.plans.find((plan) => plan.id === currentPlanId) || null;
  }

  function visibleDays(plan) {
    return plan ? plan.days.filter((day) => !day.removed) : [];
  }

  function getDay(plan, key) {
    return plan && plan.days.find((day) => day.key === key);
  }

  function routeToPlan(planId, dayKey) {
    currentPlanId = planId || '';
    if (dayKey && DAY_KEYS.some((day) => day[0] === dayKey)) activeDayKey = dayKey;
    const url = new URL(location.href);
    if (currentPlanId) {
      url.searchParams.set('plan', currentPlanId);
      url.searchParams.set('day', activeDayKey);
    } else {
      url.searchParams.delete('plan');
      url.searchParams.delete('day');
    }
    url.searchParams.delete('tool');
    history.replaceState({}, '', url);
    render();
    if (currentPlanId) app.querySelector('.day-tab[aria-pressed="true"]')?.focus();
  }

  function timeString(minutes) {
    const safe = Math.max(0, Math.min(1439, Math.round(minutes)));
    return String(Math.floor(safe / 60)).padStart(2, '0') + ':' + String(safe % 60).padStart(2, '0');
  }

  function formatTime(value) {
    const minutes = timeMinutes(value);
    const hour = Math.floor(minutes / 60);
    return (hour % 12 || 12) + ':' + String(minutes % 60).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Saved recently';
    return 'Updated ' + new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  }

  function sortedActivities(day) {
    return [...day.activities].sort((a, b) => timeMinutes(a.start) - timeMinutes(b.start));
  }

  function dayStats(day) {
    const kinds = (kind) => day.activities.filter((item) => item.kind === kind).length;
    return {
      count: kinds('activity'),
      choices: kinds('choice'),
      openSlots: kinds('open-slot'),
      minutes: day.activities.reduce((total, item) => total + item.duration, 0)
    };
  }

  function dayItemSummary(stats) {
    const parts = [];
    if (stats.count) parts.push(stats.count + ' activit' + (stats.count === 1 ? 'y' : 'ies'));
    if (stats.choices) parts.push(stats.choices + ' choice' + (stats.choices === 1 ? '' : 's'));
    if (stats.openSlots) parts.push(stats.openSlots + ' open slot' + (stats.openSlots === 1 ? '' : 's'));
    return parts.join(' · ') || 'No items';
  }

  function planStats(plan) {
    return visibleDays(plan).reduce((result, day) => {
      const stats = dayStats(day);
      result.days += day.activities.length > 0 ? 1 : 0;
      result.activities += stats.count;
      result.choices += stats.choices;
      result.openSlots += stats.openSlots;
      return result;
    }, { days: 0, activities: 0, choices: 0, openSlots: 0 });
  }

  function nextFreeStart(day, duration, ignoreId) {
    const start = timeMinutes(day.start);
    const end = timeMinutes(day.end);
    const items = sortedActivities(day).filter((item) => item.occurrenceId !== ignoreId);
    let candidate = start;
    for (const item of items) {
      const itemStart = timeMinutes(item.start);
      const itemEnd = itemStart + item.duration;
      if (candidate + duration <= itemStart) return candidate + duration <= end ? candidate : null;
      candidate = Math.max(candidate, itemEnd);
    }
    return candidate + duration <= end ? candidate : null;
  }

  function validateDay(day) {
    const start = timeMinutes(day.start);
    const end = timeMinutes(day.end);
    if (start >= end) return 'The session must end after it starts.';
    const items = sortedActivities(day);
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const itemStart = timeMinutes(item.start);
      const itemEnd = itemStart + item.duration;
      if (itemStart < start || itemEnd > end) return 'A scheduled item falls outside this day’s session window.';
      if (index > 0) {
        const previous = items[index - 1];
        if (itemStart < timeMinutes(previous.start) + previous.duration) return 'Scheduled items overlap. Adjust their times before saving.';
      }
    }
    return '';
  }

  function imageAssetData(id) {
    return workspace.images.find((image) => image.id === id)?.data || '';
  }

  function activityImageValue(item) {
    return imageAssetData(item.imageAssetId) || item.pictogram || '';
  }

  function visualMarkup(item) {
    const imageValue = activityImageValue(item);
    const source = isLocalImageData(imageValue) ? imageValue : pictogramSource(imageValue);
    const background = validColor(item.color);
    const inside = source
      ? '<img src="' + esc(source) + '" alt="" loading="lazy">'
      : symbolMarkup(item.icon || '⭐', 36);
    return '<span class="activity-visual" style="--activity-bg:color-mix(in srgb,' + background + ' 14%,white)">' + inside + '</span>';
  }

  function renderLibrary() {
    currentPlanId = '';
    document.title = 'Weekly plans · Schedule studio';
    const plans = [...workspace.plans].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const cards = plans.map((plan) => {
      const stats = planStats(plan);
      return '<article class="plan-card">' +
        '<button class="plan-open" type="button" data-action="open-plan" data-plan="' + esc(plan.id) + '">' +
          '<strong>' + esc(plan.learner) + '</strong><span>' + esc(plan.name) + '</span>' +
          '<span class="plan-meta">' + stats.days + ' day' + (stats.days === 1 ? '' : 's') + ' planned · ' + stats.activities + ' activities' + (stats.choices ? ' · ' + stats.choices + ' choice' + (stats.choices === 1 ? '' : 's') : '') + (stats.openSlots ? ' · ' + stats.openSlots + ' open slot' + (stats.openSlots === 1 ? '' : 's') : '') + ' · ' + esc(formatDate(plan.updatedAt)) + '</span>' +
        '</button><div class="plan-actions">' +
          '<a class="icon-button visual-link" href="' + esc(visualScheduleUrl(plan.id)) + '" aria-label="Open ' + esc(plan.learner) + '’s visual schedule" title="Visual schedule">▶</a>' +
          '<button class="icon-button" type="button" data-action="duplicate-plan" data-plan="' + esc(plan.id) + '" aria-label="Duplicate ' + esc(plan.learner) + ' plan" title="Duplicate plan">⧉</button>' +
          '<button class="icon-button" type="button" data-action="delete-plan" data-plan="' + esc(plan.id) + '" aria-label="Delete ' + esc(plan.learner) + ' plan" title="Delete plan">×</button>' +
        '</div></article>';
    }).join('');
    app.innerHTML =
      '<div class="page-heading"><div><span class="eyebrow">Schedule studio · weekly planner</span><h1>Learner plans</h1>' +
      '<p>Organize a separate schedule for each day. Plans start blank, and your activity library can be reused across the week.</p></div>' +
      '<div class="heading-actions"><button class="button secondary" type="button" data-action="open-image-studio">Image studio</button><button class="button primary" type="button" data-action="new-plan">＋ New learner plan</button><button class="button secondary" type="button" data-action="import-plan">Import plan</button></div></div>' +
      (plans.length
        ? '<section class="library-grid" aria-label="Saved learner plans">' + cards + '</section>'
        : '<section class="empty-card"><span class="eyebrow">A blank start</span><h2>Your plans live here</h2><p>Create a learner plan, then add activities to the days that need them. Nothing is prefilled. Plans are saved in this browser and can be exported as JSON.</p><button class="button primary" type="button" data-action="new-plan">＋ Create first learner plan</button></section>') +
      '<a class="reference-card" href="/schedules/9-25"><span><strong>Finished example · September 25</strong><span>A polished afternoon visual schedule with choices, activities, and a live Now / Next view. Every day you plan opens in this style: choose ▶ Visual schedule.</span></span><span class="reference-arrow" aria-hidden="true">→</span></a>';
  }

  function renderDayTabs(plan) {
    const removed = plan.days.filter((day) => day.removed);
    return visibleDays(plan).map(({ key, label }) => {
      const day = getDay(plan, key);
      const stats = dayStats(day);
      const countText = dayItemSummary(stats);
      return '<button class="day-tab" type="button" data-action="select-day" data-day="' + key + '" aria-pressed="' + String(key === activeDayKey) + '">' +
        '<strong>' + label.slice(0, 3) + '</strong><span class="day-count">' + countText + '</span><span>' + esc(formatTime(day.start)) + '–' + esc(formatTime(day.end)) + '</span></button>';
    }).join('') + (removed.length ? '<div class="restore-days"><span>Add back:</span>' + removed.map((day) =>
      '<button class="button small secondary" type="button" data-action="restore-day" data-day="' + day.key + '">＋ ' + esc(day.label) + '</button>').join('') + '</div>' : '');
  }

  function optionVisual(option, size) {
    const imageValue = activityImageValue(option);
    const source = isLocalImageData(imageValue) ? imageValue : pictogramSource(imageValue);
    return source ? '<img src="' + esc(source) + '" alt="" width="' + size + '" height="' + size + '" loading="lazy">' : symbolMarkup(option.icon || '⭐', size);
  }

  function itemActions(item, index, items, name, editAction) {
    return '<div class="activity-actions">' +
      '<button class="icon-button" type="button" data-action="move-activity" data-id="' + esc(item.occurrenceId) + '" data-direction="-1" aria-label="Move ' + esc(name) + ' earlier" title="Move earlier" ' + (index === 0 ? 'disabled' : '') + '>↑</button>' +
      '<button class="icon-button" type="button" data-action="move-activity" data-id="' + esc(item.occurrenceId) + '" data-direction="1" aria-label="Move ' + esc(name) + ' later" title="Move later" ' + (index === items.length - 1 ? 'disabled' : '') + '>↓</button>' +
      '<button class="icon-button" type="button" data-action="' + editAction + '" data-id="' + esc(item.occurrenceId) + '" aria-label="Edit ' + esc(name) + '" title="Edit">✎</button>' +
      '<button class="icon-button delete" type="button" data-action="remove-activity" data-id="' + esc(item.occurrenceId) + '" aria-label="Remove ' + esc(name) + '" title="Remove">×</button>' +
    '</div>';
  }

  function renderActivity(day, item, index, items) {
    if (item.kind === 'choice') {
      const title = choiceTitle(item, getPlan().learner);
      return '<article class="activity-card choice-card">' +
        '<div class="activity-time">' + esc(formatTime(item.start)) + '<small>' + item.duration + ' min</small></div>' +
        '<div class="choice-symbol" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
        '<div class="activity-copy"><h3>' + esc(title) + '</h3><div class="activity-tags"><span class="activity-tag">Choice · ' + item.options.length + ' option' + (item.options.length === 1 ? '' : 's') + '</span></div>' +
          '<ul class="choice-options" aria-label="Options">' + item.options.map((option) => '<li class="choice-option" style="--activity-bg:color-mix(in srgb,' + validColor(option.color) + ' 14%,white)"><span class="choice-option-art" aria-hidden="true">' + optionVisual(option, 22) + '</span>' + esc(option.title) + '</li>').join('') + '</ul>' +
          (item.prompt ? '<p class="activity-note">' + esc(item.prompt) + '</p>' : '') + '</div>' +
        itemActions(item, index, items, title, 'edit-choice') + '</article>';
    }
    if (item.kind === 'open-slot') {
      return '<article class="activity-card open-slot-card" aria-label="Open slot, ' + esc(formatTime(item.start)) + ', ' + item.duration + ' minutes">' +
        '<div class="activity-time">' + esc(formatTime(item.start)) + '<small>' + item.duration + ' min</small></div>' +
        '<div class="open-slot-symbol" aria-hidden="true">＋</div>' +
        '<div class="activity-copy"><h3>Open slot</h3><p class="open-slot-hint">Flexible time for a free choice, transition, or break</p></div>' +
        itemActions(item, index, items, 'open slot', 'edit-open-slot') + '</article>';
    }
    return '<article class="activity-card" style="--activity-bg:color-mix(in srgb,' + validColor(item.color) + ' 14%,white)">' +
      '<div class="activity-time">' + esc(formatTime(item.start)) + '<small>' + item.duration + ' min</small></div>' +
      visualMarkup(item) +
      '<div class="activity-copy"><h3>' + esc(item.title) + '</h3><div class="activity-tags"><span class="activity-tag">' + esc(item.category) + '</span></div>' +
      (item.note ? '<p class="activity-note">' + esc(item.note) + '</p>' : '') +
      (item.credit ? '<p class="image-credit">' + esc(item.credit) + '</p>' : '') + '</div>' +
      itemActions(item, index, items, item.title, 'edit-activity') + '</article>';
  }

  function renderWeekSummary(plan) {
    return visibleDays(plan).map((day) => {
      const stats = dayStats(day);
      return '<div class="week-summary-row"><span>' + esc(day.label) + '</span><span>' + esc(dayItemSummary(stats)) + ' · ' + esc(formatTime(day.start)) + '</span></div>';
    }).join('');
  }

  function renderVisualCard(plan, day) {
    const rows = sortedActivities(day).slice(0, 3).map((item) =>
      '<span class="visual-preview-row"><b>' + esc(formatTime(item.start)) + '</b><span>' + esc(item.kind === 'activity' ? item.title : choiceTitle(item, plan.learner)) + '</span></span>').join('');
    return '<section class="visual-card" aria-labelledby="visualCardTitle">' +
      '<div class="visual-preview" aria-hidden="true"><span class="visual-preview-hero"><strong>Hi ' + esc(plan.learner) + '!</strong><small>' + esc(day.label) + ' · ' + esc(formatTime(day.start)) + '–' + esc(formatTime(day.end)) + '</small></span>' +
        (rows || '<span class="visual-preview-empty">Activities you add show up here</span>') + '</div>' +
      '<h3 id="visualCardTitle">Visual schedule</h3><p>' + esc(day.label) + ' as the learner sees it: big pictures, a live Now / Next, and check-offs, like the September 25 example.</p>' +
      '<a class="button visual" href="' + esc(visualScheduleUrl(plan.id, day.key)) + '">▶ Open ' + esc(day.label) + '’s schedule</a></section>';
  }

  function renderPlan() {
    const plan = getPlan();
    if (!plan) return renderLibrary();
    const shown = visibleDays(plan);
    if (!shown.length) return renderNoDays(plan);
    const day = shown.find((entry) => entry.key === activeDayKey) || shown[0];
    activeDayKey = day.key;
    const items = sortedActivities(day);
    const stats = dayStats(day);
    const capacity = timeMinutes(day.end) - timeMinutes(day.start);
    const visuals = items.flatMap(itemVisuals);
    const hasArasaac = visuals.some((item) => /^\d{1,10}$/.test(String(item.pictogram || '').trim()));
    const hasOpenMoji = visuals.some((item) => {
      const imageValue = activityImageValue(item);
      return !(isLocalImageData(imageValue) || pictogramSource(imageValue)) && Boolean(openMojiCodepoint(item.icon));
    });
    const printCredits = [
      hasArasaac ? 'ARASAAC pictograms by Sergio Palao · Government of Aragón · CC BY-NC-SA. <a href="https://aulaabierta.arasaac.org/en/terms-of-use">Terms of use</a>.' : '',
      hasOpenMoji ? 'Emoji artwork by <a href="https://openmoji.org">OpenMoji</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.' : ''
    ].filter(Boolean).join(' ');
    const destinationOptions = shown.filter((entry) => entry.key !== day.key).map((entry) =>
      '<option value="' + entry.key + '">' + esc(entry.label) + '</option>').join('');
    document.title = plan.learner + ' · ' + plan.name + ' · Schedule studio';
    app.innerHTML =
      '<a class="back-link" href="/schedules" data-action="back-library">← All learner plans</a>' +
      '<div class="page-heading plan-heading"><div class="plan-heading-main"><span class="eyebrow">Weekly learner plan · saved locally</span>' +
        '<input id="planTitle" class="plan-title" aria-label="Plan name" maxlength="100" value="' + esc(plan.name) + '">' +
        '<input id="planLearner" class="plan-learner" aria-label="Learner label" maxlength="100" value="' + esc(plan.learner) + '">' +
      '</div><div class="heading-actions"><a class="button visual" href="' + esc(visualScheduleUrl(plan.id, day.key)) + '">▶ Visual schedule</a><button class="button secondary" type="button" data-action="open-image-studio">Image studio</button><button class="button secondary" type="button" data-action="print-day">Print selected day</button><button class="button secondary" type="button" data-action="export-plan">Export JSON</button>' +
        '<button class="button secondary" type="button" data-action="import-plan">Import plan</button></div></div>' +
      '<div class="week-heading"><h2>Week overview</h2><p>Choose a day to build or update its schedule.</p></div>' +
      '<nav class="day-tabs" aria-label="Days of the week">' + renderDayTabs(plan) + '</nav>' +
      '<div class="day-panel"><section class="day-main" aria-labelledby="dayTitle">' +
        '<div class="day-main-header"><div><span class="eyebrow">' + esc(plan.learner) + ' · weekly schedule</span><h2 id="dayTitle">' + esc(day.label) + '</h2><p>Plan this day’s session, then copy it to another day when the pattern fits.</p></div>' +
          '<div class="button-row"><button class="button secondary" type="button" data-action="add-open-slot">＋ Open slot</button><button class="button secondary" type="button" data-action="add-choice">＋ Choice</button><button class="button primary" type="button" data-action="add-activity">＋ Add activity</button></div></div>' +
        '<div class="time-window"><span class="time-window-label">Session time</span><label class="field"><span>Starts</span><input type="time" data-day-time="start" value="' + esc(day.start) + '" aria-label="' + esc(day.label) + ' session start"></label>' +
          '<label class="field"><span>Ends</span><input type="time" data-day-time="end" value="' + esc(day.end) + '" aria-label="' + esc(day.label) + ' session end"></label>' +
          '<span class="time-summary">' + stats.minutes + ' scheduled minutes · ' + Math.max(0, capacity - stats.minutes) + ' unassigned minutes</span></div>' +
        '<div class="print-options" aria-label="Print settings"><span class="print-options-title">Print setup</span>' +
          '<label><span>Layout</span><select data-print-setting="layout" aria-label="Print layout"><option value="timeline" ' + (day.printLayout === 'timeline' ? 'selected' : '') + '>Schedule list</option><option value="cards" ' + (day.printLayout === 'cards' ? 'selected' : '') + '>Cut cards</option></select></label>' +
          '<label class="print-time-toggle"><input type="checkbox" data-print-setting="times" ' + (day.printTimes ? 'checked' : '') + '><span>Show times on print</span></label>' +
          '<label><span>Card spacing</span><select data-print-setting="spacing" aria-label="Printed card spacing"><option value="standard" ' + (day.printSpacing === 'standard' ? 'selected' : '') + '>Standard</option><option value="cut" ' + (day.printSpacing === 'cut' ? 'selected' : '') + '>Room to cut</option><option value="laminate" ' + (day.printSpacing === 'laminate' ? 'selected' : '') + '>Cut and laminate</option></select><small class="muted">Used with cut cards</small></label>' +
        '</div>' +
        '<div class="copy-row"><label for="copyDestination">Reuse this day:</label><select id="copyDestination">' + destinationOptions + '</select><button class="button small secondary" type="button" data-action="copy-day">Copy day</button><button class="button small secondary danger" type="button" data-action="clear-day">Clear day</button><button class="button small secondary danger" type="button" data-action="delete-day">Delete day</button></div>' +
        '<div class="activity-list" aria-label="' + esc(day.label) + ' scheduled items">' +
          (items.length ? items.map((item, index) => renderActivity(day, item, index, items)).join('') :
            '<div class="empty-day"><span class="empty-icon" aria-hidden="true">＋</span><h3>No activities planned yet</h3><p>Add a session activity, a choice between a few options, or an open slot, or copy a day with a schedule you want to reuse. Times and items remain editable on every day.</p><div class="button-row"><button class="button secondary" type="button" data-action="add-open-slot">＋ Add open slot</button><button class="button secondary" type="button" data-action="add-choice">＋ Add choice</button><button class="button secondary" type="button" data-action="add-activity">＋ Add first activity</button></div></div>') +
        '</div>' + (printCredits ? '<p class="print-credit">' + printCredits + '</p>' : '') + '</section>' +
        '<aside class="day-side">' + renderVisualCard(plan, day) + '<section class="side-card"><h3>This week</h3><p>Each day can use its own session window and activity sequence.</p><div class="week-summary">' + renderWeekSummary(plan) + '</div>' +
          '<div class="side-actions"><button class="button secondary" type="button" data-action="duplicate-plan">Duplicate this learner plan</button><button class="button secondary danger" type="button" data-action="delete-current-plan">Delete this plan</button></div></section></aside>' +
      '</div>';
    document.body.dataset.printLayout = day.printLayout;
    document.body.dataset.printTimes = day.printTimes ? 'true' : 'false';
    document.body.dataset.printSpacing = day.printSpacing;
  }

  function renderNoDays(plan) {
    document.title = plan.learner + ' · ' + plan.name + ' · Schedule studio';
    app.innerHTML =
      '<a class="back-link" href="/schedules" data-action="back-library">← All learner plans</a>' +
      '<section class="empty-card"><span class="eyebrow">' + esc(plan.learner) + ' · ' + esc(plan.name) + '</span><h2>No days in this plan</h2><p>Every day has been deleted from this weekly schedule. Add a day back to keep planning.</p>' +
      '<nav class="day-tabs" aria-label="Days of the week">' + renderDayTabs(plan) + '</nav></section>';
  }

  function render() {
    if (getPlan()) renderPlan();
    else renderLibrary();
  }

  function focusAddActivity() {
    app.querySelector('.day-main-header [data-action="add-activity"]')?.focus();
  }

  function focusActivityAction(action, occurrenceId, direction) {
    const button = [...app.querySelectorAll('[data-action="' + action + '"]')].find((entry) =>
      entry.dataset.id === occurrenceId && (direction === undefined || entry.dataset.direction === String(direction)));
    button?.focus();
  }

  function startNewPlan() {
    const form = document.getElementById('planForm');
    form.reset();
    form.elements.name.value = 'Weekly plan';
    planDialog.showModal();
    form.elements.learner.focus();
  }

  function createPlan(form) {
    const data = new FormData(form);
    const learner = cleanText(data.get('learner'), 100, '');
    const name = cleanText(data.get('name'), 100, 'Weekly plan');
    if (!learner) return;
    const now = new Date().toISOString();
    const plan = {
      id: makeId('plan'), learner, name, createdAt: now, updatedAt: now,
      days: DAY_KEYS.map(([key, label]) => ({ key, label, start: '09:00', end: '12:00', printLayout: 'timeline', printTimes: true, printSpacing: 'standard', activities: [] }))
    };
    workspace.plans.push(plan);
    persist();
    planDialog.close();
    routeToPlan(plan.id, 'monday');
    showToast('Blank weekly plan created.');
  }

  function duplicatePlan(planId) {
    const original = workspace.plans.find((plan) => plan.id === planId) || getPlan();
    if (!original) return;
    const copy = JSON.parse(JSON.stringify(original));
    copy.id = makeId('plan');
    copy.name = cleanText(copy.name, 94, 'Weekly plan') + ' copy';
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    copy.days.forEach((day) => day.activities.forEach((item) => { item.occurrenceId = makeId('scheduled'); }));
    workspace.plans.push(copy);
    persist();
    routeToPlan(copy.id, activeDayKey);
    showToast('Plan duplicated. You can change its learner label and days independently.');
  }

  function deletePlan(planId) {
    const plan = workspace.plans.find((entry) => entry.id === planId) || getPlan();
    if (!plan || !window.confirm('Delete the weekly plan for ' + plan.learner + '? This cannot be undone unless you exported a copy.')) return;
    workspace.plans = workspace.plans.filter((entry) => entry.id !== plan.id);
    persist();
    routeToPlan('', 'monday');
    showToast('Plan deleted.');
  }

  function renderSymbolPicker(icon) {
    return '<div class="field full symbol-field"><label for="activityIcon">Visual symbol or emoji</label>' +
      '<div class="symbol-entry"><span class="symbol-preview" aria-hidden="true">' + symbolMarkup(icon || '⭐', 30) + '</span>' +
        '<input id="activityIcon" name="icon" maxlength="16" value="' + esc(icon || '⭐') + '" autocomplete="off" aria-describedby="activityIconHelp" placeholder="Choose or type an emoji">' +
        '<button class="button secondary" type="button" data-action="toggle-symbol-picker" aria-expanded="false" aria-controls="symbolPicker">Browse symbols</button></div>' +
      '<small class="muted" id="activityIconHelp">Browse by name, or type any emoji. OpenMoji artwork is used where available.</small>' +
      '<section class="symbol-picker" id="symbolPicker" aria-label="Choose a visual symbol" hidden>' +
        '<label class="visually-hidden" for="symbolSearch">Search symbols by name</label><input class="symbol-search" id="symbolSearch" name="symbolSearch" type="search" placeholder="Search all symbols (book, snack, break…)" autocomplete="off">' +
        '<div class="symbol-groups" role="group" aria-label="Symbol categories">' + SYMBOL_GROUPS.map((group) => '<button class="symbol-group" type="button" data-action="filter-symbols" data-group="' + esc(group) + '" aria-pressed="' + String(group === 'Popular') + '">' + esc(group) + (group === 'Recent' && recentSymbols.length ? ' · ' + recentSymbols.length : '') + '</button>').join('') + '</div>' +
        '<p class="symbol-result-count" id="symbolResultCount" role="status" aria-live="polite"></p><div class="symbol-results" id="symbolResults" role="group" aria-label="Available symbols"></div>' +
        '<small class="symbol-credit">OpenMoji artwork for supported picks · <a href="https://openmoji.org" target="_blank" rel="noopener noreferrer">OpenMoji</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></small>' +
      '</section></div>';
  }

  function showActivityDialog(mode, item) {
    activityMode = mode;
    editingActivityId = item ? item.occurrenceId : '';
    activityDialogBody.innerHTML = '';
    if (mode === 'library') {
      activityDialogBody.innerHTML = '<div class="dialog-heading dialog-content"><div><span class="eyebrow">Reusable activities</span><h2>Add from your library</h2><p class="muted">Choose an activity to place it in ' + esc(DAY_KEYS.find((day) => day[0] === activeDayKey)[1]) + '.</p></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></div>' +
        '<div class="library-picker">' + renderLibraryPicker() + '</div>';
    } else {
      const editing = mode === 'edit';
      const activity = item || {};
      activityDialogBody.innerHTML = '<div class="dialog-heading dialog-content"><div><span class="eyebrow">' + (editing ? 'Edit this day' : 'Add to this day') + '</span><h2>' + (editing ? 'Edit activity' : 'Create an activity') + '</h2></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></div>' +
        (workspace.activities.length && !editing
          ? '<div class="dialog-tabs" role="tablist"><button class="dialog-tab" type="button" data-action="activity-tab" data-mode="new" aria-selected="true">New activity</button><button class="dialog-tab" type="button" data-action="activity-tab" data-mode="library" aria-selected="false">From library (' + workspace.activities.length + ')</button></div>'
          : '') +
        '<form class="edit-form" id="activityForm">' +
          (editing ? '<label class="field"><span>Start time</span><input name="start" type="time" value="' + esc(activity.start) + '" required></label>' : '') +
          '<label class="field"><span>Activity name</span><input name="title" maxlength="100" value="' + esc(activity.title || '') + '" placeholder="e.g., Choose a book" required></label>' +
          '<label class="field"><span>Category</span><input name="category" maxlength="60" value="' + esc(activity.category || 'Instruction') + '" list="categorySuggestions"><datalist id="categorySuggestions">' + CATEGORIES.map((category) => '<option value="' + esc(category) + '">').join('') + '</datalist></label>' +
          '<label class="field"><span>Duration (minutes)</span><input name="duration" type="number" min="1" max="480" value="' + esc(activity.duration || 15) + '" required></label>' +
          renderSymbolPicker(activity.icon || '⭐') +
          '<label class="field"><span>Color</span><select name="color">' + COLORS.map((color) => '<option value="' + color + '" ' + (color === activity.color ? 'selected' : '') + '>' + COLOR_NAMES[color] + '</option>').join('') + '</select></label>' +
          '<div class="field full"><span>Activity image (optional)</span><div class="image-reference-row"><input name="pictogramUrl" maxlength="300" value="' + esc(activity.pictogram || '') + '" placeholder="ARASAAC ID or HTTPS image URL" aria-describedby="imageHelp"><input type="hidden" name="imageAssetId" value="' + esc(activity.imageAssetId || '') + '"><button class="button secondary" type="button" data-action="open-image-editor">Upload and crop</button></div>' +
            '<div class="image-asset-preview" id="imageAssetPreview">' + renderImageAssetPreview(activity.pictogram || '', activity.imageAssetId || '') + '</div><small class="muted" id="imageHelp">Crop an image here or use an ARASAAC ID or direct HTTPS image URL. Add a credit below for other image sources.</small></div>' +
          '<label class="field full"><span>Image source or attribution (optional)</span><input name="credit" maxlength="200" value="' + esc(activity.credit || '') + '" placeholder="Artist, library, or license"></label>' +
          '<label class="field full"><span>Support cue or short note (optional)</span><textarea name="note" maxlength="500" placeholder="A short cue, material, or transition note">' + esc(activity.note || '') + '</textarea></label>' +
          (!editing ? '<label class="check-field full"><input type="checkbox" name="saveToLibrary" checked><span>Save this activity to the reusable library</span></label>' :
            (activity.sourceId ? '<label class="check-field full"><input type="checkbox" name="updateLibrary"><span>Also update the library card for future use</span></label>' : '')) +
          '<div class="error-text full" id="activityError" role="status" aria-live="polite"></div>' +
          '<div class="dialog-footer full"><button class="button secondary" type="button" data-close-dialog>Cancel</button><button class="button primary" type="submit">' + (editing ? 'Save activity' : 'Add to ' + esc(DAY_KEYS.find((day) => day[0] === activeDayKey)[1])) + '</button></div>' +
        '</form>';
    }
    if (!activityDialog.open) activityDialog.showModal();
    activityDialogBody.querySelector('input[name="title"]')?.focus();
  }

  function showOpenSlotDialog(mode, item) {
    const plan = getPlan();
    const day = getDay(plan, activeDayKey);
    if (!day) return;
    activityMode = mode === 'edit' ? 'slot-edit' : 'slot-new';
    editingActivityId = item ? item.occurrenceId : '';
    const editing = activityMode === 'slot-edit';
    let defaultDuration = item ? item.duration : 10;
    let defaultStart = item ? item.start : nextFreeStart(day, defaultDuration);
    if (!editing && defaultStart === null) {
      defaultDuration = 5;
      defaultStart = nextFreeStart(day, defaultDuration);
    }
    if (defaultStart === null) return showToast('There is no open session time for another slot.');
    const startValue = typeof defaultStart === 'number' ? timeString(defaultStart) : defaultStart;
    activityDialogBody.innerHTML = '<div class="dialog-heading dialog-content"><div><span class="eyebrow">' + (editing ? 'Edit this day' : 'Leave flexible time') + '</span><h2>' + (editing ? 'Edit open slot' : 'Add an open slot') + '</h2><p class="muted">This is a planning placeholder for a choice, transition, or break.</p></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></div>' +
      '<form class="edit-form" id="slotForm">' +
        '<label class="field"><span>Start time</span><input name="start" type="time" value="' + esc(startValue) + '" required></label>' +
        '<label class="field"><span>Length (minutes)</span><input name="duration" type="number" min="1" max="480" value="' + esc(defaultDuration) + '" required></label>' +
        '<div class="error-text full" id="slotError" role="status" aria-live="polite"></div>' +
        '<div class="dialog-footer full"><button class="button secondary" type="button" data-close-dialog>Cancel</button><button class="button primary" type="submit">' + (editing ? 'Save slot' : 'Add slot') + '</button></div>' +
      '</form>';
    if (!activityDialog.open) activityDialog.showModal();
    activityDialogBody.querySelector('input[name="start"]')?.focus();
  }

  function submitOpenSlot(form) {
    const day = getDay(getPlan(), activeDayKey);
    if (!day) return;
    const errorNode = form.querySelector('#slotError');
    const data = new FormData(form);
    const start = validTime(data.get('start'), '');
    const duration = validDuration(data.get('duration'), 0);
    if (!start || !duration) {
      errorNode.textContent = 'Enter a valid start time and a length from 1 to 480 minutes.';
      return;
    }
    let slot;
    if (activityMode === 'slot-edit') {
      slot = day.activities.find((item) => item.occurrenceId === editingActivityId && item.kind === 'open-slot');
      if (!slot) return activityDialog.close();
      const prior = { ...slot };
      Object.assign(slot, { start, duration });
      const message = validateDay(day);
      if (message) {
        Object.assign(slot, prior);
        errorNode.textContent = message;
        return;
      }
    } else {
      slot = { kind: 'open-slot', occurrenceId: makeId('scheduled'), sourceId: '', start, duration, color: COLORS[0] };
      day.activities.push(slot);
      const message = validateDay(day);
      if (message) {
        day.activities = day.activities.filter((item) => item.occurrenceId !== slot.occurrenceId);
        errorNode.textContent = message;
        return;
      }
    }
    persist();
    activityDialog.close();
    render();
    showToast(activityMode === 'slot-edit' ? 'Open slot updated.' : 'Open slot added to ' + day.label + '.');
  }

  function showChoiceDialog(mode, item) {
    const plan = getPlan();
    const day = getDay(plan, activeDayKey);
    if (!day) return;
    activityMode = mode === 'edit' ? 'choice-edit' : 'choice-new';
    editingActivityId = item ? item.occurrenceId : '';
    const editing = activityMode === 'choice-edit';
    let defaultDuration = item ? item.duration : 15;
    let defaultStart = item ? item.start : nextFreeStart(day, defaultDuration);
    if (!editing && defaultStart === null) {
      defaultDuration = 5;
      defaultStart = nextFreeStart(day, defaultDuration);
    }
    if (defaultStart === null) return showToast('There is no open session time for another choice.');
    const startValue = typeof defaultStart === 'number' ? timeString(defaultStart) : defaultStart;
    choiceDraft = item ? item.options.map((option) => ({ ...option })) : [];
    const library = workspace.activities.map((activity) =>
      '<button class="choice-library-item" type="button" data-action="add-library-option" data-id="' + esc(activity.id) + '" aria-label="Add ' + esc(activity.title) + ' as an option">' +
        '<span class="choice-option-art" style="--activity-bg:color-mix(in srgb,' + validColor(activity.color) + ' 14%,white)" aria-hidden="true">' + optionVisual(activity, 22) + '</span>' + esc(activity.title) + '</button>').join('');
    activityDialogBody.innerHTML = '<div class="dialog-heading dialog-content"><div><span class="eyebrow">' + (editing ? 'Edit this day' : 'Add to this day') + '</span><h2>' + (editing ? 'Edit choice' : 'Add a choice') + '</h2><p class="muted">Give ' + esc(plan.learner) + ' a few options. On the visual schedule they tap the one they want.</p></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></div>' +
      '<form class="edit-form" id="choiceForm">' +
        '<label class="field"><span>Start time</span><input name="start" type="time" value="' + esc(startValue) + '" required></label>' +
        '<label class="field"><span>Length (minutes)</span><input name="duration" type="number" min="1" max="480" value="' + esc(defaultDuration) + '" required></label>' +
        '<label class="field"><span>Heading (optional)</span><input name="title" maxlength="100" value="' + esc(item ? item.title : '') + '" placeholder="' + esc(choiceTitle(null, plan.learner)) + '"></label>' +
        '<label class="field"><span>Prompt (optional)</span><input name="prompt" maxlength="200" value="' + esc(item ? item.prompt : '') + '" placeholder="Pick what to do."></label>' +
        '<div class="field full"><span id="choiceOptionsLabel">Options · 2 to ' + MAX_CHOICE_OPTIONS + '</span><ul class="choice-draft" id="choiceOptions" aria-labelledby="choiceOptionsLabel"></ul></div>' +
        '<fieldset class="choice-composer full"><legend>Add an option</legend>' +
          '<label class="field"><span>Option name</span><span class="choice-composer-row"><input id="optionTitle" name="optionTitle" maxlength="60" placeholder="e.g., Blocks" autocomplete="off"><button class="button secondary" type="button" data-action="add-choice-option">＋ Add option</button></span></label>' +
          renderSymbolPicker('⭐') +
        '</fieldset>' +
        (library ? '<div class="field full"><span id="choiceLibraryLabel">Or add from your activity library (keeps its picture)</span><div class="choice-library" role="group" aria-labelledby="choiceLibraryLabel">' + library + '</div></div>' : '') +
        '<div class="error-text full" id="choiceError" role="status" aria-live="polite"></div>' +
        '<div class="dialog-footer full"><button class="button secondary" type="button" data-close-dialog>Cancel</button><button class="button primary" type="submit">' + (editing ? 'Save choice' : 'Add choice') + '</button></div>' +
      '</form>';
    renderChoiceDraft();
    if (!activityDialog.open) activityDialog.showModal();
    activityDialogBody.querySelector(editing ? 'input[name="start"]' : '#optionTitle')?.focus();
  }

  function renderChoiceDraft() {
    const list = document.getElementById('choiceOptions');
    if (!list) return;
    list.innerHTML = choiceDraft.length
      ? choiceDraft.map((option) => '<li class="choice-draft-item" style="--activity-bg:color-mix(in srgb,' + validColor(option.color) + ' 14%,white)"><span class="choice-option-art" aria-hidden="true">' + optionVisual(option, 26) + '</span><span class="choice-draft-title">' + esc(option.title) + '</span>' +
        '<button class="icon-button" type="button" data-action="remove-choice-option" data-id="' + esc(option.id) + '" aria-label="Remove option ' + esc(option.title) + '" title="Remove option">×</button></li>').join('')
      : '<li class="choice-draft-empty">No options yet. Add at least two below.</li>';
  }

  function addChoiceOption(option) {
    const errorNode = document.getElementById('choiceError');
    if (choiceDraft.length >= MAX_CHOICE_OPTIONS) {
      errorNode.textContent = 'A choice can have up to ' + MAX_CHOICE_OPTIONS + ' options.';
      return false;
    }
    choiceDraft.push({ id: makeId('option'), title: option.title, icon: option.icon || '⭐', pictogram: option.pictogram || '', imageAssetId: option.imageAssetId || '', color: option.color || COLORS[choiceDraft.length % COLORS.length] });
    errorNode.textContent = '';
    renderChoiceDraft();
    return true;
  }

  function addComposedOption(form) {
    const title = cleanText(form.elements.optionTitle.value, 60, '');
    if (!title) {
      document.getElementById('choiceError').textContent = 'Name the option first.';
      form.elements.optionTitle.focus();
      return false;
    }
    if (!addChoiceOption({ title, icon: cleanText(form.elements.icon.value, 16, '⭐') })) return false;
    form.elements.optionTitle.value = '';
    form.elements.icon.value = '⭐';
    updateSymbolPreview(form);
    form.elements.optionTitle.focus();
    return true;
  }

  function submitChoice(form) {
    const day = getDay(getPlan(), activeDayKey);
    if (!day) return;
    const errorNode = form.querySelector('#choiceError');
    if (form.elements.optionTitle.value.trim() && !addComposedOption(form)) return;
    const data = new FormData(form);
    const start = validTime(data.get('start'), '');
    const duration = validDuration(data.get('duration'), 0);
    if (!start || !duration) {
      errorNode.textContent = 'Enter a valid start time and a length from 1 to 480 minutes.';
      return;
    }
    if (choiceDraft.length < 2) {
      errorNode.textContent = 'Add at least two options so there is something to choose.';
      form.elements.optionTitle.focus();
      return;
    }
    const values = { start, duration, title: cleanText(data.get('title'), 100, ''), prompt: cleanText(data.get('prompt'), 200, ''), options: choiceDraft.map((option) => ({ ...option })) };
    let choice;
    if (activityMode === 'choice-edit') {
      choice = day.activities.find((item) => item.occurrenceId === editingActivityId && item.kind === 'choice');
      if (!choice) return activityDialog.close();
      const prior = { ...choice };
      Object.assign(choice, values);
      const message = validateDay(day);
      if (message) {
        Object.assign(choice, prior);
        errorNode.textContent = message;
        return;
      }
    } else {
      choice = { kind: 'choice', occurrenceId: makeId('scheduled'), sourceId: '', color: COLORS[0], ...values };
      day.activities.push(choice);
      const message = validateDay(day);
      if (message) {
        day.activities = day.activities.filter((item) => item.occurrenceId !== choice.occurrenceId);
        errorNode.textContent = message;
        return;
      }
    }
    persist();
    activityDialog.close();
    render();
    if (activityMode === 'choice-edit') focusActivityAction('edit-choice', choice.occurrenceId);
    else focusAddActivity();
    showToast(activityMode === 'choice-edit' ? 'Choice updated.' : 'Choice added to ' + day.label + '.');
  }

  function renderImageAssetPreview(value, imageAssetId) {
    const imageValue = activityImageValue({ pictogram: value, imageAssetId: imageAssetId || '' });
    const source = isLocalImageData(imageValue) ? imageValue : pictogramSource(imageValue);
    return source
      ? '<img src="' + esc(source) + '" alt=""><span>Image ready</span><button class="button small secondary" type="button" data-action="clear-activity-image">Remove</button>'
      : '<span class="muted">No image attached</span>';
  }

  function imageCropSize() {
    const sizes = {
      square: [512, 512],
      wide: [1280, 720],
      wide4k: [3840, 2160],
      vertical: [2160, 3840],
      portrait: [1080, 1350]
    };
    return sizes[document.getElementById('cropPreset').value] || sizes.square;
  }

  function cropCanvas() {
    return document.getElementById('cropCanvas');
  }

  function drawCrop() {
    const canvas = cropCanvas();
    const context = canvas.getContext('2d');
    const [width, height] = imageCropSize();
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.clearRect(0, 0, width, height);
    if (!cropImage) return;
    const scale = Math.max(width / cropImage.naturalWidth, height / cropImage.naturalHeight) * cropZoomFactor;
    const drawnWidth = cropImage.naturalWidth * scale;
    const drawnHeight = cropImage.naturalHeight * scale;
    const centerX = (width - drawnWidth) / 2;
    const centerY = (height - drawnHeight) / 2;
    const x = Math.max(width - drawnWidth, Math.min(0, centerX + cropPanX));
    const y = Math.max(height - drawnHeight, Math.min(0, centerY + cropPanY));
    cropPanX = x - centerX;
    cropPanY = y - centerY;
    context.drawImage(cropImage, x, y, drawnWidth, drawnHeight);
  }

  function updateCropControls() {
    const hasImage = Boolean(cropImage);
    document.getElementById('cropEmpty').hidden = hasImage;
    document.getElementById('cropZoom').disabled = !hasImage;
    document.getElementById('downloadCrop').disabled = !hasImage;
    document.getElementById('useActivityImage').hidden = !cropAttachEnabled;
    document.getElementById('useActivityImage').disabled = !hasImage || !cropAttachEnabled;
    document.getElementById('cropCanvas').classList.toggle('has-image', hasImage);
    drawCrop();
  }

  function setCropStatus(message) {
    document.getElementById('cropStatus').textContent = message;
  }

  function loadCropSource(source, name, nextObjectUrl) {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > 40000000) {
        if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
        setCropStatus('That image is very large. Choose an image under 40 megapixels.');
        return;
      }
      if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
      cropObjectUrl = nextObjectUrl || '';
      cropImage = image;
      cropSourceName = String(name || 'image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'image';
      cropPanX = 0;
      cropPanY = 0;
      cropZoomFactor = 1;
      document.getElementById('cropZoom').value = '1';
      updateCropControls();
      setCropStatus(image.naturalWidth + ' × ' + image.naturalHeight + ' image ready. Drag to reposition or adjust zoom.');
    };
    image.onerror = () => {
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
      setCropStatus('This file could not be opened as an image. Try JPEG, PNG, WebP, or GIF.');
    };
    image.src = source;
  }

  function openImageEditor(attachToActivity) {
    const form = attachToActivity ? document.getElementById('activityForm') : null;
    cropAttachEnabled = Boolean(form);
    document.getElementById('cropSubtitle').textContent = cropAttachEnabled
      ? 'Choose a crop, drag to frame it, then download it or attach a compact 512 px copy to this activity.'
      : 'Choose a crop, drag to frame it, then download the finished image for another app.';
    const attached = form ? imageAssetData(form.elements.imageAssetId.value) : '';
    if (cropAttachEnabled) activityDialog.appendChild(imageEditorDialog);
    else document.body.appendChild(imageEditorDialog);
    if (!imageEditorDialog.open) imageEditorDialog.showModal();
    document.getElementById('cropSource').value = '';
    if (isLocalImageData(attached)) loadCropSource(attached, 'activity-image', '');
    else {
      if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
      cropObjectUrl = '';
      cropImage = null;
      cropPanX = 0;
      cropPanY = 0;
      cropZoomFactor = 1;
      updateCropControls();
      setCropStatus('Choose an image to begin. It stays in this browser.');
    }
  }

  function loadCropFile(file) {
    if (!file) return;
    if (!/^image\/(?:png|jpeg|webp|gif)$/i.test(file.type)) {
      setCropStatus('Choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 30000000) {
      setCropStatus('Choose an image smaller than 30 MB.');
      return;
    }
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    cropObjectUrl = '';
    cropImage = null;
    updateCropControls();
    setCropStatus('Loading image…');
    const objectUrl = URL.createObjectURL(file);
    loadCropSource(objectUrl, file.name, objectUrl);
  }

  function cropBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      const output = document.createElement('canvas');
      output.width = canvas.width;
      output.height = canvas.height;
      const context = output.getContext('2d');
      if (mime === 'image/jpeg') {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, output.width, output.height);
      }
      context.drawImage(canvas, 0, 0);
      output.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the image file.')), mime, quality);
    });
  }

  function cropFormatDetails() {
    const select = document.getElementById('cropFormat');
    const mime = select.value;
    const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
    const quality = Number(document.getElementById('cropQuality').value) / 100;
    return { mime, extension, quality };
  }

  async function downloadImageCrop() {
    if (!cropImage) return;
    const { mime, extension, quality } = cropFormatDetails();
    try {
      const blob = await cropBlob(cropCanvas(), mime, quality);
      if (blob.type !== mime) throw new Error('This browser cannot create that format. Choose JPEG or PNG.');
      const [width, height] = imageCropSize();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = cropSourceName + '-' + width + 'x' + height + '.' + extension;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCropStatus('Downloaded ' + width + ' × ' + height + ' ' + extension.toUpperCase() + ' · ' + Math.ceil(blob.size / 1024) + ' KB.');
    } catch (error) {
      setCropStatus(error.message || 'Could not create the image file.');
    }
  }

  async function useCropOnActivity() {
    const form = document.getElementById('activityForm');
    if (!cropImage || !cropAttachEnabled || !form) return;
    const canvas = cropCanvas();
    const factor = Math.min(1, 512 / Math.max(canvas.width, canvas.height));
    const { mime, quality } = cropFormatDetails();
    try {
      const compact = document.createElement('canvas');
      compact.width = Math.max(1, Math.round(canvas.width * factor));
      compact.height = Math.max(1, Math.round(canvas.height * factor));
      const context = compact.getContext('2d');
      if (mime === 'image/jpeg') {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, compact.width, compact.height);
      }
      context.drawImage(canvas, 0, 0, compact.width, compact.height);
      const blob = await new Promise((resolve, reject) => compact.toBlob((result) => result ? resolve(result) : reject(new Error('Could not create the activity image.')), mime, quality));
      if (blob.type !== mime) throw new Error('This browser cannot create that format. Choose JPEG or PNG.');
      if (blob.size > 65000) throw new Error('The compact activity image is over 65 KB. Try JPEG or WebP with a simpler crop; you can still download the full-size image.');
      const reader = new FileReader();
      reader.onload = () => {
        if (!form.isConnected || !imageEditorDialog.open) return;
        const image = sanitizeImage({ id: makeId('image'), data: String(reader.result || '') });
        if (!image) {
          setCropStatus('Could not attach this image. Try another format.');
          return;
        }
        workspace.images.push(image);
        form.elements.imageAssetId.value = image.id;
        form.elements.pictogramUrl.value = '';
        document.getElementById('imageAssetPreview').innerHTML = renderImageAssetPreview('', image.id);
        imageEditorDialog.close();
      };
      reader.onerror = () => setCropStatus('Could not attach this image. Try another format.');
      reader.readAsDataURL(blob);
    } catch (error) {
      setCropStatus(error.message || 'Could not attach this image.');
    }
  }

  function renderLibraryPicker() {
    if (!workspace.activities.length) return '<div class="library-empty">Your reusable activity library is empty. Create an activity first.</div>';
    return workspace.activities.map((item) =>
      '<div class="activity-pick-wrap"><button class="activity-pick" type="button" data-action="add-library-activity" data-id="' + esc(item.id) + '">' +
        visualMarkup(item) + '<span><strong>' + esc(item.title) + '</strong><small>' + esc(item.category) + ' · ' + item.duration + ' min</small></span></button>' +
        '<button class="icon-button" type="button" data-action="remove-library-activity" data-id="' + esc(item.id) + '" aria-label="Remove ' + esc(item.title) + ' from activity library" title="Remove from library">×</button></div>'
    ).join('');
  }

  function createOccurrence(item, start) {
    return {
      kind: 'activity',
      occurrenceId: makeId('scheduled'),
      sourceId: item.id || '',
      title: item.title,
      category: item.category,
      duration: item.duration,
      icon: item.icon,
      pictogram: item.pictogram,
      imageAssetId: item.imageAssetId || '',
      credit: item.credit,
      color: item.color,
      note: item.note,
      start: timeString(start)
    };
  }

  function addFromLibrary(activityId) {
    const item = workspace.activities.find((entry) => entry.id === activityId);
    const plan = getPlan();
    const day = getDay(plan, activeDayKey);
    if (!item || !day) return;
    const start = nextFreeStart(day, item.duration);
    if (start === null) return showToast('There is not enough open time for this activity on ' + day.label + '.');
    day.activities.push(createOccurrence(item, start));
    persist();
    activityDialog.close();
    render();
    focusAddActivity();
    showToast(item.title + ' added to ' + day.label + '.');
  }

  function formActivityData(form) {
    const data = new FormData(form);
    const imageUrl = cleanText(data.get('pictogramUrl'), 300, '');
    const imageAssetId = cleanText(data.get('imageAssetId'), 100, '');
    const pictogram = imageUrl;
    if (imageAssetId && !workspace.images.some((image) => image.id === imageAssetId)) throw new Error('The cropped image is no longer available. Upload it again.');
    if (imageUrl && !/^\d{1,10}$/.test(imageUrl) && !/^https:\/\//i.test(imageUrl)) {
      throw new Error('Use a pictogram number or a direct HTTPS image URL.');
    }
    const activity = sanitizeActivity({
      id: makeId('activity'),
      title: data.get('title'),
      category: data.get('category'),
      duration: data.get('duration'),
      icon: data.get('icon'),
      pictogram,
      imageAssetId,
      credit: data.get('credit'),
      color: data.get('color'),
      note: data.get('note')
    });
    if (!activity) throw new Error('Add an activity name first.');
    const start = data.get('start') ? validTime(data.get('start'), '') : '';
    return { activity, start, saveToLibrary: data.has('saveToLibrary'), updateLibrary: data.has('updateLibrary') };
  }

  function submitActivity(form) {
    const plan = getPlan();
    const day = getDay(plan, activeDayKey);
    if (!day) return;
    const errorNode = form.querySelector('#activityError');
    try {
      const result = formActivityData(form);
      const activity = result.activity;
      let start = result.start ? timeMinutes(result.start) : nextFreeStart(day, activity.duration);
      if (start === null || start === undefined) throw new Error('No open time remains for an activity of this duration.');
      const startValue = timeString(start);
      const occurrence = activityMode === 'edit'
        ? day.activities.find((entry) => entry.occurrenceId === editingActivityId)
        : null;
      if (activityMode === 'edit' && !occurrence) return activityDialog.close();
      if (activityMode === 'edit') {
        const prior = { ...occurrence };
        Object.assign(occurrence, activity, { occurrenceId: prior.occurrenceId, sourceId: prior.sourceId, start: startValue });
        const validation = validateDay(day);
        if (validation) {
          Object.assign(occurrence, prior);
          throw new Error(validation);
        }
        if (result.updateLibrary && prior.sourceId) {
          const libraryItem = workspace.activities.find((entry) => entry.id === prior.sourceId);
          if (libraryItem) Object.assign(libraryItem, activity, { id: prior.sourceId });
        }
      } else {
        if (result.saveToLibrary) workspace.activities.push(activity);
        const added = createOccurrence(result.saveToLibrary ? activity : { ...activity, id: '' }, start);
        if (!result.saveToLibrary) added.sourceId = '';
        day.activities.push(added);
        const validation = validateDay(day);
        if (validation) {
          day.activities = day.activities.filter((entry) => entry.occurrenceId !== added.occurrenceId);
          if (result.saveToLibrary) workspace.activities = workspace.activities.filter((entry) => entry.id !== activity.id);
          throw new Error(validation);
        }
      }
      persist();
      activityDialog.close();
      render();
      if (activityMode === 'edit') focusActivityAction('edit-activity', editingActivityId);
      else focusAddActivity();
      showToast(activityMode === 'edit' ? 'Activity updated.' : 'Activity added to ' + day.label + '.');
    } catch (error) {
      if (errorNode) errorNode.textContent = error.message || 'Could not save this activity.';
    }
  }

  function changeDayWindow(input) {
    const plan = getPlan();
    const day = getDay(plan, activeDayKey);
    if (!day) return;
    const field = input.dataset.dayTime;
    const prior = day[field];
    day[field] = validTime(input.value, prior);
    const message = validateDay(day);
    if (message) {
      day[field] = prior;
      input.value = prior;
      showToast(message);
      return;
    }
    persist();
    const stats = dayStats(day);
    const capacity = timeMinutes(day.end) - timeMinutes(day.start);
    const summary = app.querySelector('.time-summary');
    if (summary) summary.textContent = stats.minutes + ' planned minutes · ' + Math.max(0, capacity - stats.minutes) + ' open minutes';
    const tabs = app.querySelector('.day-tabs');
    if (tabs) tabs.innerHTML = renderDayTabs(plan);
    const week = app.querySelector('.week-summary');
    if (week) week.innerHTML = renderWeekSummary(plan);
    const visualCard = app.querySelector('.visual-card');
    if (visualCard) visualCard.outerHTML = renderVisualCard(plan, day);
  }

  function copyDay() {
    const plan = getPlan();
    const source = getDay(plan, activeDayKey);
    const destinationKey = document.getElementById('copyDestination')?.value;
    const destination = getDay(plan, destinationKey);
    if (!source || !destination || destination.key === source.key) return;
    if (destination.activities.length && !window.confirm(destination.label + ' already has scheduled items. Replace its schedule with a copy of ' + source.label + '?')) return;
    destination.start = source.start;
    destination.end = source.end;
    destination.printLayout = source.printLayout;
    destination.printTimes = source.printTimes;
    destination.printSpacing = source.printSpacing;
    destination.activities = source.activities.map((item) => ({ ...JSON.parse(JSON.stringify(item)), occurrenceId: makeId('scheduled') }));
    persist();
    render();
    app.querySelector('.day-tab[aria-pressed="true"]')?.focus();
    showToast(source.label + ' copied to ' + destination.label + '.');
  }

  function clearDay() {
    const plan = getPlan();
    const day = getDay(plan, activeDayKey);
    if (!day || !day.activities.length) return;
    if (!window.confirm('Clear all activities, choices, and open slots from ' + day.label + '?')) return;
    day.activities = [];
    persist();
    render();
    focusAddActivity();
    showToast(day.label + ' is clear.');
  }

  function deleteDay() {
    const plan = getPlan();
    const day = getDay(plan, activeDayKey);
    if (!day || day.removed) return;
    const message = day.activities.length
      ? 'Delete ' + day.label + ' and its ' + day.activities.length + ' scheduled item' + (day.activities.length === 1 ? '' : 's') + ' from this week?'
      : 'Delete ' + day.label + ' from this week?';
    if (!window.confirm(message)) return;
    const next = visibleDays(plan).find((entry) => entry.key !== day.key);
    day.removed = true;
    day.activities = [];
    persist();
    routeToPlan(currentPlanId, next ? next.key : activeDayKey);
    showToast(day.label + ' deleted.');
  }

  function restoreDay(key) {
    const plan = getPlan();
    const day = getDay(plan, key);
    if (!day || !day.removed) return;
    day.removed = false;
    persist();
    routeToPlan(currentPlanId, key);
    showToast(day.label + ' added back.');
  }

  function removeActivity(occurrenceId) {
    const day = getDay(getPlan(), activeDayKey);
    if (!day) return;
    const item = day.activities.find((entry) => entry.occurrenceId === occurrenceId);
    const label = item && (item.kind === 'open-slot' ? 'this open slot' : item.kind === 'choice' ? 'this choice' : '“' + item.title + '”');
    if (!item || !window.confirm('Remove ' + label + ' from ' + day.label + '?')) return;
    day.activities = day.activities.filter((entry) => entry.occurrenceId !== occurrenceId);
    persist();
    render();
    focusAddActivity();
  }

  function moveActivity(occurrenceId, direction) {
    const day = getDay(getPlan(), activeDayKey);
    if (!day) return;
    const items = sortedActivities(day);
    const index = items.findIndex((entry) => entry.occurrenceId === occurrenceId);
    const target = index + Number(direction);
    if (index < 0 || target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    const totalMinutes = items.reduce((total, item) => total + item.duration, 0);
    if (timeMinutes(day.start) + totalMinutes > timeMinutes(day.end)) {
      return showToast('There is not enough session time to move items into this order.');
    }
    let cursor = timeMinutes(day.start);
    for (const item of items) {
      item.start = timeString(cursor);
      cursor += item.duration;
    }
    day.activities = items;
    persist();
    render();
    focusActivityAction('move-activity', occurrenceId, direction);
  }

  function exportPlan() {
    const plan = getPlan();
    if (!plan) return;
    const usedIds = new Set(plan.days.flatMap((day) => day.activities.map((item) => item.sourceId).filter(Boolean)));
    const activityLibrary = workspace.activities.filter((item) => usedIds.has(item.id));
    const usedImageIds = new Set(plan.days.flatMap((day) => day.activities.flatMap(itemImageIds))
      .concat(activityLibrary.map((item) => item.imageAssetId)).filter(Boolean));
    const images = workspace.images.filter((image) => usedImageIds.has(image.id));
    const content = JSON.stringify({ format: 'woodles.schedule-week.v1', exportedAt: new Date().toISOString(), plan, activityLibrary, images }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = (plan.learner + '-' + plan.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Plan exported as JSON.');
  }

  function importPlan() {
    const input = document.getElementById('importFile');
    input.value = '';
    input.click();
  }

  function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        const rawPlan = data && data.format === 'woodles.schedule-week.v1' ? data.plan : null;
        if (!rawPlan || !rawPlan.learner || !Array.isArray(rawPlan.days)) throw new Error('This file is not a supported weekly plan.');
        const imageIdMap = new Map();
        const importedImages = (Array.isArray(data.images) ? data.images : []).map(sanitizeImage).filter(Boolean).map((image) => {
          const id = makeId('image');
          imageIdMap.set(image.id, id);
          return { ...image, id };
        });
        const remapImage = (item) => ({
          ...item,
          imageAssetId: imageIdMap.get(item && item.imageAssetId) || '',
          ...(item && Array.isArray(item.options) ? { options: item.options.map(remapImage) } : {})
        });
        const planSource = {
          ...rawPlan,
          days: rawPlan.days.map((day) => ({ ...day, activities: (Array.isArray(day.activities) ? day.activities : []).map(remapImage) }))
        };
        const plan = sanitizePlan({ ...planSource, id: makeId('plan'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        if (!plan) throw new Error('The selected file does not contain a usable weekly plan.');
        for (const day of plan.days) {
          const issue = validateDay(day);
          if (issue) throw new Error(day.label + ': ' + issue);
        }
        const importedActivities = Array.isArray(data.activityLibrary)
          ? data.activityLibrary.map(sanitizeActivity).filter(Boolean).map(remapImage)
          : [];
        const activityIds = new Set(workspace.activities.map((item) => item.id));
        workspace.images.push(...importedImages);
        workspace.activities.push(...importedActivities.filter((item) => !activityIds.has(item.id)));
        plan.days.forEach((day) => day.activities.forEach((item) => { item.occurrenceId = makeId('scheduled'); }));
        workspace.plans.push(plan);
        persist();
        routeToPlan(plan.id, 'monday');
        showToast('Weekly plan imported.');
      } catch (error) {
        showToast(error.message || 'Could not read this plan file.');
      }
    };
    reader.onerror = () => showToast('Could not read the selected file.');
    reader.readAsText(file);
  }

  function removeLibraryActivity(activityId) {
    const item = workspace.activities.find((entry) => entry.id === activityId);
    if (!item || !window.confirm('Remove “' + item.title + '” from the reusable library? Activities already placed on days will stay in those plans.')) return;
    workspace.activities = workspace.activities.filter((entry) => entry.id !== activityId);
    persist();
    if (activityMode === 'library') showActivityDialog('library');
    else if (activityMode === 'new') showActivityDialog('new');
    showToast('Removed from the reusable library.');
  }

  document.addEventListener('click', (event) => {
    const closeButton = event.target.closest('[data-close-dialog]');
    if (closeButton) {
      closeButton.closest('dialog')?.close();
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const name = action.dataset.action;
    if (name === 'new-plan') startNewPlan();
    else if (name === 'open-plan') routeToPlan(action.dataset.plan, 'monday');
    else if (name === 'back-library') { event.preventDefault(); routeToPlan('', 'monday'); }
    else if (name === 'duplicate-plan') duplicatePlan(action.dataset.plan);
    else if (name === 'delete-plan' || name === 'delete-current-plan') deletePlan(action.dataset.plan);
    else if (name === 'select-day') routeToPlan(currentPlanId, action.dataset.day);
    else if (name === 'add-activity') showActivityDialog('new');
    else if (name === 'add-open-slot') showOpenSlotDialog('new');
    else if (name === 'add-choice') showChoiceDialog('new');
    else if (name === 'add-choice-option') addComposedOption(action.form);
    else if (name === 'add-library-option') {
      const activity = workspace.activities.find((entry) => entry.id === action.dataset.id);
      if (activity) addChoiceOption(activity);
    } else if (name === 'remove-choice-option') {
      choiceDraft = choiceDraft.filter((option) => option.id !== action.dataset.id);
      renderChoiceDraft();
      document.getElementById('optionTitle')?.focus();
    }
    else if (name === 'open-image-editor') openImageEditor(true);
    else if (name === 'open-image-studio') openImageEditor(false);
    else if (name === 'toggle-symbol-picker') {
      const form = action.closest('form');
      const picker = form && form.querySelector('#symbolPicker');
      if (form && picker) {
        picker.hidden = !picker.hidden;
        action.setAttribute('aria-expanded', String(!picker.hidden));
        if (!picker.hidden) {
          activeSymbolGroup = 'Popular';
          renderSymbolResults(form);
          form.elements.symbolSearch.focus();
        }
      }
    } else if (name === 'filter-symbols') {
      const form = action.closest('form');
      if (form) {
        activeSymbolGroup = action.dataset.group;
        form.elements.symbolSearch.value = '';
        renderSymbolResults(form);
      }
    } else if (name === 'select-symbol') {
      const form = action.closest('form');
      if (form) {
        form.elements.icon.value = action.dataset.symbol;
        rememberSymbol(action.dataset.symbol);
        updateSymbolPreview(form);
        form.querySelector('#symbolPicker').hidden = true;
        form.querySelector('[data-action="toggle-symbol-picker"]').setAttribute('aria-expanded', 'false');
        form.elements.icon.focus();
      }
    }
    else if (name === 'clear-activity-image') {
      const form = document.getElementById('activityForm');
      if (form) {
        form.elements.imageAssetId.value = '';
        form.elements.pictogramUrl.value = '';
        document.getElementById('imageAssetPreview').innerHTML = renderImageAssetPreview('');
      }
    }
    else if (name === 'activity-tab') showActivityDialog(action.dataset.mode);
    else if (name === 'add-library-activity') addFromLibrary(action.dataset.id);
    else if (name === 'remove-library-activity') removeLibraryActivity(action.dataset.id);
    else if (name === 'edit-activity') {
      const day = getDay(getPlan(), activeDayKey);
      const item = day && day.activities.find((entry) => entry.occurrenceId === action.dataset.id);
      if (item) showActivityDialog('edit', item);
    } else if (name === 'edit-open-slot') {
      const day = getDay(getPlan(), activeDayKey);
      const item = day && day.activities.find((entry) => entry.occurrenceId === action.dataset.id && entry.kind === 'open-slot');
      if (item) showOpenSlotDialog('edit', item);
    } else if (name === 'edit-choice') {
      const day = getDay(getPlan(), activeDayKey);
      const item = day && day.activities.find((entry) => entry.occurrenceId === action.dataset.id && entry.kind === 'choice');
      if (item) showChoiceDialog('edit', item);
    } else if (name === 'remove-activity') removeActivity(action.dataset.id);
    else if (name === 'move-activity') moveActivity(action.dataset.id, action.dataset.direction);
    else if (name === 'copy-day') copyDay();
    else if (name === 'clear-day') clearDay();
    else if (name === 'delete-day') deleteDay();
    else if (name === 'restore-day') restoreDay(action.dataset.day);
    else if (name === 'print-day') window.print();
    else if (name === 'export-plan') exportPlan();
    else if (name === 'import-plan') importPlan();
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'planForm') {
      event.preventDefault();
      createPlan(event.target);
    } else if (event.target.id === 'activityForm') {
      event.preventDefault();
      submitActivity(event.target);
    } else if (event.target.id === 'slotForm') {
      event.preventDefault();
      submitOpenSlot(event.target);
    } else if (event.target.id === 'choiceForm') {
      event.preventDefault();
      submitChoice(event.target);
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-day-time]')) changeDayWindow(event.target);
    if (event.target.id === 'cropSource') loadCropFile(event.target.files && event.target.files[0]);
    if (event.target.id === 'cropPreset') {
      cropZoomFactor = 1;
      cropPanX = 0;
      cropPanY = 0;
      document.getElementById('cropZoom').value = '1';
      updateCropControls();
      const [width, height] = imageCropSize();
      setCropStatus('Crop output: ' + width + ' × ' + height + '. Drag to reposition or adjust zoom.');
    }
    if (event.target.id === 'cropFormat') document.getElementById('cropQuality').disabled = event.target.value === 'image/png';
    if (event.target.matches('[data-print-setting]')) {
      const day = getDay(getPlan(), activeDayKey);
      if (!day) return;
      const setting = event.target.dataset.printSetting;
      if (setting === 'layout') day.printLayout = ['timeline', 'cards'].includes(event.target.value) ? event.target.value : 'timeline';
      else if (setting === 'times') day.printTimes = event.target.checked;
      else if (setting === 'spacing') day.printSpacing = ['standard', 'cut', 'laminate'].includes(event.target.value) ? event.target.value : 'standard';
      document.body.dataset.printLayout = day.printLayout;
      document.body.dataset.printTimes = day.printTimes ? 'true' : 'false';
      document.body.dataset.printSpacing = day.printSpacing;
      persist();
    }
    if (event.target.id === 'importFile') importFile(event.target.files && event.target.files[0]);
    if (event.target.id === 'planTitle' || event.target.id === 'planLearner') {
      const plan = getPlan();
      if (!plan) return;
      const key = event.target.id === 'planTitle' ? 'name' : 'learner';
      plan[key] = cleanText(event.target.value, 100, key === 'name' ? 'Weekly plan' : 'Learner');
      event.target.value = plan[key];
      persist();
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('input[name="icon"]')) updateSymbolPreview(event.target.form);
    if (event.target.id === 'symbolSearch') {
      activeSymbolGroup = 'All';
      renderSymbolResults(event.target.form);
    }
    if (event.target.matches('input[name="pictogramUrl"]')) {
      const form = event.target.form;
      form.elements.imageAssetId.value = '';
      document.getElementById('imageAssetPreview').innerHTML = event.target.value.trim()
        ? '<span class="muted">Image reference will load on the activity.</span>'
        : renderImageAssetPreview('');
    }
    if (event.target.id === 'cropQuality') document.getElementById('cropQualityLabel').textContent = event.target.value + '%';
    if (event.target.id === 'cropZoom') {
      cropZoomFactor = Number(event.target.value);
      drawCrop();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.id === 'optionTitle' && event.key === 'Enter') {
      event.preventDefault();
      addComposedOption(event.target.form);
      return;
    }
    if (event.target.id !== 'symbolSearch' || event.key !== 'Escape') return;
    const form = event.target.form;
    const picker = form && form.querySelector('#symbolPicker');
    if (!picker || picker.hidden) return;
    event.preventDefault();
    picker.hidden = true;
    form.querySelector('[data-action="toggle-symbol-picker"]').setAttribute('aria-expanded', 'false');
    form.querySelector('[data-action="toggle-symbol-picker"]').focus();
  });

  document.getElementById('cropCanvas').addEventListener('pointerdown', (event) => {
    if (!cropImage) return;
    const canvas = cropCanvas();
    canvas.setPointerCapture(event.pointerId);
    cropPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  document.getElementById('cropCanvas').addEventListener('pointermove', (event) => {
    if (!cropPointer || cropPointer.id !== event.pointerId) return;
    const canvas = cropCanvas();
    const bounds = canvas.getBoundingClientRect();
    cropPanX += (event.clientX - cropPointer.x) * canvas.width / bounds.width;
    cropPanY += (event.clientY - cropPointer.y) * canvas.height / bounds.height;
    cropPointer.x = event.clientX;
    cropPointer.y = event.clientY;
    drawCrop();
  });
  document.getElementById('cropCanvas').addEventListener('pointerup', () => { cropPointer = null; });
  document.getElementById('cropCanvas').addEventListener('pointercancel', () => { cropPointer = null; });
  document.getElementById('cropCanvas').addEventListener('keydown', (event) => {
    if (!cropImage || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const [width, height] = imageCropSize();
    const amount = Math.max(8, Math.round(Math.min(width, height) * (event.shiftKey ? 0.08 : 0.02)));
    if (event.key === 'ArrowLeft') cropPanX -= amount;
    else if (event.key === 'ArrowRight') cropPanX += amount;
    else if (event.key === 'ArrowUp') cropPanY -= amount;
    else cropPanY += amount;
    drawCrop();
  });
  document.getElementById('downloadCrop').addEventListener('click', downloadImageCrop);
  document.getElementById('useActivityImage').addEventListener('click', useCropOnActivity);

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(location.search);
    currentPlanId = params.get('plan') || '';
    activeDayKey = DAY_KEYS.some((day) => day[0] === params.get('day')) ? params.get('day') : 'monday';
    render();
  });

  render();
  if (new URLSearchParams(location.search).get('tool') === 'image') openImageEditor(false);
})();
