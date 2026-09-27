(() => {
  'use strict';

  const STORAGE_KEY = 'woodles.schedule-planner.v1';
  const DAY_KEYS = [
    ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'],
    ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday']
  ];
  const CATEGORIES = ['Instruction', 'Communication', 'Play / leisure', 'Daily living', 'Movement', 'Sensory', 'Break', 'Transition', 'Other'];
  const COLORS = ['#3978c7', '#32845f', '#d27b32', '#a16ab5', '#d05c66', '#458d98', '#7c8797'];
  const COLOR_NAMES = { '#3978c7': 'Blue', '#32845f': 'Green', '#d27b32': 'Orange', '#a16ab5': 'Purple', '#d05c66': 'Rose', '#458d98': 'Teal', '#7c8797': 'Slate' };
  const ICONS = ['⭐', '🧩', '💬', '📚', '🧸', '🎨', '🎵', '🏃', '🍎', '🪥', '🧼', '🧺', '🚶', '🧘', '🌿', '💧', '🏠', '🎯'];
  const app = document.getElementById('app');
  const planDialog = document.getElementById('planDialog');
  const activityDialog = document.getElementById('activityDialog');
  const activityDialogBody = document.getElementById('activityDialogBody');
  const toast = document.getElementById('toast');
  const saveStatus = document.getElementById('saveStatus');

  function readWorkspace() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (value && typeof value === 'object') {
        return {
          plans: Array.isArray(value.plans) ? value.plans.map(sanitizePlan).filter(Boolean) : [],
          activities: Array.isArray(value.activities) ? value.activities.map(sanitizeActivity).filter(Boolean) : []
        };
      }
    } catch {}
    return { plans: [], activities: [] };
  }

  let workspace = readWorkspace();
  let currentPlanId = new URLSearchParams(location.search).get('plan') || '';
  let activeDayKey = DAY_KEYS.some((day) => day[0] === new URLSearchParams(location.search).get('day'))
    ? new URLSearchParams(location.search).get('day')
    : 'monday';
  let activityMode = 'new';
  let editingActivityId = '';
  let toastTimer;

  function makeId(prefix) {
    const random = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix + '-' + random;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function cleanText(value, max, fallback) {
    const text = String(value == null ? '' : value).trim().slice(0, max);
    return text || fallback || '';
  }

  function validTime(value, fallback) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? value : fallback;
  }

  function validDuration(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 480 ? number : fallback;
  }

  function validColor(value) {
    return COLORS.includes(value) ? value : COLORS[0];
  }

  function sanitizeActivity(value) {
    if (!value || typeof value !== 'object' || !String(value.title || '').trim()) return null;
    return {
      id: cleanText(value.id, 100, makeId('activity')),
      title: cleanText(value.title, 100, 'Activity'),
      category: cleanText(value.category, 60, 'Other'),
      duration: validDuration(value.duration, 15),
      icon: cleanText(value.icon, 16, '⭐'),
      pictogram: cleanText(value.pictogram, 300, ''),
      credit: cleanText(value.credit, 200, ''),
      color: validColor(value.color),
      note: cleanText(value.note, 500, '')
    };
  }

  function sanitizePlan(value) {
    if (!value || typeof value !== 'object' || !String(value.id || '').trim()) return null;
    const sourceDays = Array.isArray(value.days) ? value.days : [];
    const days = DAY_KEYS.map(([key, label]) => {
      const source = sourceDays.find((entry) => entry && (entry.key === key || entry.label === label)) || {};
      return {
        key,
        label,
        start: validTime(source.start, '09:00'),
        end: validTime(source.end, '12:00'),
        printLayout: ['timeline', 'cards'].includes(source.printLayout) ? source.printLayout : 'timeline',
        printTimes: source.printTimes !== false,
        printSpacing: ['standard', 'cut', 'laminate'].includes(source.printSpacing) ? source.printSpacing : 'standard',
        activities: (Array.isArray(source.activities) ? source.activities : []).map((entry) => {
          if (entry && entry.kind === 'open-slot') {
            return {
              kind: 'open-slot',
              occurrenceId: cleanText(entry.occurrenceId, 100, makeId('scheduled')),
              sourceId: '',
              start: validTime(entry.start, '09:00'),
              duration: validDuration(entry.duration, 10),
              color: validColor(entry.color)
            };
          }
          const activity = sanitizeActivity(entry);
          if (!activity) return null;
          const snapshot = { ...activity };
          delete snapshot.id;
          return {
            ...snapshot,
            kind: 'activity',
            occurrenceId: cleanText(entry.occurrenceId, 100, makeId('scheduled')),
            sourceId: cleanText(entry.sourceId, 100, ''),
            start: validTime(entry.start, '09:00')
          };
        }).filter(Boolean)
      };
    });
    return {
      id: cleanText(value.id, 100, makeId('plan')),
      learner: cleanText(value.learner, 100, 'Learner'),
      name: cleanText(value.name, 100, 'Weekly plan'),
      createdAt: cleanText(value.createdAt, 40, new Date().toISOString()),
      updatedAt: cleanText(value.updatedAt, 40, new Date().toISOString()),
      days
    };
  }

  function persist() {
    const now = new Date().toISOString();
    const plan = getPlan();
    if (plan) plan.updatedAt = now;
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
    history.replaceState({}, '', url);
    render();
    if (currentPlanId) app.querySelector('.day-tab[aria-pressed="true"]')?.focus();
  }

  function timeMinutes(value) {
    const parts = String(value || '00:00').split(':').map(Number);
    return parts[0] * 60 + parts[1];
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
    const activities = day.activities.filter((item) => item.kind !== 'open-slot').length;
    const openSlots = day.activities.length - activities;
    return {
      count: activities,
      openSlots,
      minutes: day.activities.reduce((total, item) => total + item.duration, 0)
    };
  }

  function dayItemSummary(stats) {
    const parts = [];
    if (stats.count) parts.push(stats.count + ' activit' + (stats.count === 1 ? 'y' : 'ies'));
    if (stats.openSlots) parts.push(stats.openSlots + ' open slot' + (stats.openSlots === 1 ? '' : 's'));
    return parts.join(' · ') || 'No items';
  }

  function planStats(plan) {
    return plan.days.reduce((result, day) => {
      result.days += day.activities.length > 0 ? 1 : 0;
      result.activities += day.activities.filter((item) => item.kind !== 'open-slot').length;
      result.openSlots += day.activities.filter((item) => item.kind === 'open-slot').length;
      return result;
    }, { days: 0, activities: 0, openSlots: 0 });
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

  function pictogramSource(value) {
    const text = String(value || '').trim();
    if (/^\d{1,10}$/.test(text)) return 'https://static.arasaac.org/pictograms/' + text + '/' + text + '_300.png';
    if (/^https:\/\//i.test(text)) return text;
    return '';
  }

  function visualMarkup(item) {
    const source = pictogramSource(item.pictogram);
    const background = validColor(item.color);
    const inside = source
      ? '<img src="' + esc(source) + '" alt="" loading="lazy">'
      : esc(item.icon || '⭐');
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
          '<span class="plan-meta">' + stats.days + ' day' + (stats.days === 1 ? '' : 's') + ' planned · ' + stats.activities + ' activities' + (stats.openSlots ? ' · ' + stats.openSlots + ' open slot' + (stats.openSlots === 1 ? '' : 's') : '') + ' · ' + esc(formatDate(plan.updatedAt)) + '</span>' +
        '</button><div class="plan-actions">' +
          '<button class="icon-button" type="button" data-action="duplicate-plan" data-plan="' + esc(plan.id) + '" aria-label="Duplicate ' + esc(plan.learner) + ' plan" title="Duplicate plan">⧉</button>' +
          '<button class="icon-button" type="button" data-action="delete-plan" data-plan="' + esc(plan.id) + '" aria-label="Delete ' + esc(plan.learner) + ' plan" title="Delete plan">×</button>' +
        '</div></article>';
    }).join('');
    app.innerHTML =
      '<div class="page-heading"><div><span class="eyebrow">Schedule studio · weekly planner</span><h1>Learner plans</h1>' +
      '<p>Organize a separate schedule for each day. Plans start blank, and your activity library can be reused across the week.</p></div>' +
      '<div class="heading-actions"><button class="button primary" type="button" data-action="new-plan">＋ New learner plan</button><button class="button secondary" type="button" data-action="import-plan">Import plan</button></div></div>' +
      (plans.length
        ? '<section class="library-grid" aria-label="Saved learner plans">' + cards + '</section>'
        : '<section class="empty-card"><span class="eyebrow">A blank start</span><h2>Your plans live here</h2><p>Create a learner plan, then add activities to the days that need them. Nothing is prefilled. Plans are saved in this browser and can be exported as JSON.</p><button class="button primary" type="button" data-action="new-plan">＋ Create first learner plan</button></section>') +
      '<a class="reference-card" href="/schedules/9-25"><span><strong>Finished example · September 25</strong><span>A polished afternoon visual schedule with choices, activities, and a live Now / Next view.</span></span><span class="reference-arrow" aria-hidden="true">→</span></a>';
  }

  function renderDayTabs(plan) {
    return DAY_KEYS.map(([key, label]) => {
      const day = getDay(plan, key);
      const stats = dayStats(day);
      const countText = dayItemSummary(stats);
      return '<button class="day-tab" type="button" data-action="select-day" data-day="' + key + '" aria-pressed="' + String(key === activeDayKey) + '">' +
        '<strong>' + label.slice(0, 3) + '</strong><span class="day-count">' + countText + '</span><span>' + esc(formatTime(day.start)) + '–' + esc(formatTime(day.end)) + '</span></button>';
    }).join('');
  }

  function renderActivity(day, item, index, items) {
    if (item.kind === 'open-slot') {
      return '<article class="activity-card open-slot-card" aria-label="Open slot, ' + esc(formatTime(item.start)) + ', ' + item.duration + ' minutes">' +
        '<div class="activity-time">' + esc(formatTime(item.start)) + '<small>' + item.duration + ' min</small></div>' +
        '<div class="open-slot-symbol" aria-hidden="true">＋</div>' +
        '<div class="activity-copy"><h3>Open slot</h3><p class="open-slot-hint">Flexible time for a choice, transition, or break</p></div>' +
        '<div class="activity-actions">' +
          '<button class="icon-button" type="button" data-action="move-activity" data-id="' + esc(item.occurrenceId) + '" data-direction="-1" aria-label="Move open slot earlier" title="Move earlier" ' + (index === 0 ? 'disabled' : '') + '>↑</button>' +
          '<button class="icon-button" type="button" data-action="move-activity" data-id="' + esc(item.occurrenceId) + '" data-direction="1" aria-label="Move open slot later" title="Move later" ' + (index === items.length - 1 ? 'disabled' : '') + '>↓</button>' +
          '<button class="icon-button" type="button" data-action="edit-open-slot" data-id="' + esc(item.occurrenceId) + '" aria-label="Edit open slot" title="Edit">✎</button>' +
          '<button class="icon-button delete" type="button" data-action="remove-activity" data-id="' + esc(item.occurrenceId) + '" aria-label="Remove open slot" title="Remove">×</button>' +
        '</div></article>';
    }
    return '<article class="activity-card" style="--activity-bg:color-mix(in srgb,' + validColor(item.color) + ' 14%,white)">' +
      '<div class="activity-time">' + esc(formatTime(item.start)) + '<small>' + item.duration + ' min</small></div>' +
      visualMarkup(item) +
      '<div class="activity-copy"><h3>' + esc(item.title) + '</h3><div class="activity-tags"><span class="activity-tag">' + esc(item.category) + '</span></div>' +
      (item.note ? '<p class="activity-note">' + esc(item.note) + '</p>' : '') +
      (item.credit ? '<p class="image-credit">' + esc(item.credit) + '</p>' : '') + '</div>' +
      '<div class="activity-actions">' +
        '<button class="icon-button" type="button" data-action="move-activity" data-id="' + esc(item.occurrenceId) + '" data-direction="-1" aria-label="Move ' + esc(item.title) + ' earlier" title="Move earlier" ' + (index === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button class="icon-button" type="button" data-action="move-activity" data-id="' + esc(item.occurrenceId) + '" data-direction="1" aria-label="Move ' + esc(item.title) + ' later" title="Move later" ' + (index === items.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button class="icon-button" type="button" data-action="edit-activity" data-id="' + esc(item.occurrenceId) + '" aria-label="Edit ' + esc(item.title) + '" title="Edit">✎</button>' +
        '<button class="icon-button delete" type="button" data-action="remove-activity" data-id="' + esc(item.occurrenceId) + '" aria-label="Remove ' + esc(item.title) + '" title="Remove">×</button>' +
      '</div></article>';
  }

  function renderWeekSummary(plan) {
    return plan.days.map((day) => {
      const stats = dayStats(day);
      return '<div class="week-summary-row"><span>' + esc(day.label) + '</span><span>' + esc(dayItemSummary(stats)) + ' · ' + esc(formatTime(day.start)) + '</span></div>';
    }).join('');
  }

  function renderPlan() {
    const plan = getPlan();
    if (!plan) return renderLibrary();
    const day = getDay(plan, activeDayKey) || plan.days[0];
    activeDayKey = day.key;
    const items = sortedActivities(day);
    const stats = dayStats(day);
    const capacity = timeMinutes(day.end) - timeMinutes(day.start);
    const hasArasaac = items.some((item) => /^\d{1,10}$/.test(String(item.pictogram || '').trim()));
    const destinationOptions = DAY_KEYS.filter((entry) => entry[0] !== day.key).map((entry) =>
      '<option value="' + entry[0] + '">' + entry[1] + '</option>').join('');
    document.title = plan.learner + ' · ' + plan.name + ' · Schedule studio';
    app.innerHTML =
      '<a class="back-link" href="/schedules" data-action="back-library">← All learner plans</a>' +
      '<div class="page-heading plan-heading"><div class="plan-heading-main"><span class="eyebrow">Weekly learner plan · saved locally</span>' +
        '<input id="planTitle" class="plan-title" aria-label="Plan name" maxlength="100" value="' + esc(plan.name) + '">' +
        '<input id="planLearner" class="plan-learner" aria-label="Learner label" maxlength="100" value="' + esc(plan.learner) + '">' +
      '</div><div class="heading-actions"><button class="button secondary" type="button" data-action="print-day">Print selected day</button><button class="button secondary" type="button" data-action="export-plan">Export JSON</button>' +
        '<button class="button secondary" type="button" data-action="import-plan">Import plan</button></div></div>' +
      '<div class="week-heading"><h2>Week overview</h2><p>Choose a day to build or update its schedule.</p></div>' +
      '<nav class="day-tabs" aria-label="Days of the week">' + renderDayTabs(plan) + '</nav>' +
      '<div class="day-panel"><section class="day-main" aria-labelledby="dayTitle">' +
        '<div class="day-main-header"><div><span class="eyebrow">' + esc(plan.learner) + ' · weekly schedule</span><h2 id="dayTitle">' + esc(day.label) + '</h2><p>Plan this day’s session, then copy it to another day when the pattern fits.</p></div>' +
          '<div class="button-row"><button class="button secondary" type="button" data-action="add-open-slot">＋ Open slot</button><button class="button primary" type="button" data-action="add-activity">＋ Add activity</button></div></div>' +
        '<div class="time-window"><span class="time-window-label">Session time</span><label class="field"><span>Starts</span><input type="time" data-day-time="start" value="' + esc(day.start) + '" aria-label="' + esc(day.label) + ' session start"></label>' +
          '<label class="field"><span>Ends</span><input type="time" data-day-time="end" value="' + esc(day.end) + '" aria-label="' + esc(day.label) + ' session end"></label>' +
          '<span class="time-summary">' + stats.minutes + ' scheduled minutes · ' + Math.max(0, capacity - stats.minutes) + ' unassigned minutes</span></div>' +
        '<div class="print-options" aria-label="Print settings"><span class="print-options-title">Print setup</span>' +
          '<label><span>Layout</span><select data-print-setting="layout" aria-label="Print layout"><option value="timeline" ' + (day.printLayout === 'timeline' ? 'selected' : '') + '>Schedule list</option><option value="cards" ' + (day.printLayout === 'cards' ? 'selected' : '') + '>Cut cards</option></select></label>' +
          '<label class="print-time-toggle"><input type="checkbox" data-print-setting="times" ' + (day.printTimes ? 'checked' : '') + '><span>Show times on print</span></label>' +
          '<label><span>Card spacing</span><select data-print-setting="spacing" aria-label="Printed card spacing"><option value="standard" ' + (day.printSpacing === 'standard' ? 'selected' : '') + '>Standard</option><option value="cut" ' + (day.printSpacing === 'cut' ? 'selected' : '') + '>Room to cut</option><option value="laminate" ' + (day.printSpacing === 'laminate' ? 'selected' : '') + '>Cut and laminate</option></select><small class="muted">Used with cut cards</small></label>' +
        '</div>' +
        '<div class="copy-row"><label for="copyDestination">Reuse this day:</label><select id="copyDestination">' + destinationOptions + '</select><button class="button small secondary" type="button" data-action="copy-day">Copy day</button><button class="button small secondary danger" type="button" data-action="clear-day">Clear day</button></div>' +
        '<div class="activity-list" aria-label="' + esc(day.label) + ' scheduled items">' +
          (items.length ? items.map((item, index) => renderActivity(day, item, index, items)).join('') :
            '<div class="empty-day"><span class="empty-icon" aria-hidden="true">＋</span><h3>No activities planned yet</h3><p>Add a session activity or an open slot, or copy a day with a schedule you want to reuse. Times and items remain editable on every day.</p><div class="button-row"><button class="button secondary" type="button" data-action="add-open-slot">＋ Add open slot</button><button class="button secondary" type="button" data-action="add-activity">＋ Add first activity</button></div></div>') +
        '</div>' + (hasArasaac ? '<p class="print-credit">ARASAAC pictograms by Sergio Palao · Government of Aragón · CC BY-NC-SA. <a href="https://aulaabierta.arasaac.org/en/terms-of-use">Terms of use</a>.</p>' : '') + '</section>' +
        '<aside class="day-side"><section class="side-card"><h3>This week</h3><p>Each day can use its own session window and activity sequence.</p><div class="week-summary">' + renderWeekSummary(plan) + '</div>' +
          '<div class="side-actions"><button class="button secondary" type="button" data-action="duplicate-plan">Duplicate this learner plan</button><button class="button secondary danger" type="button" data-action="delete-current-plan">Delete this plan</button></div></section></aside>' +
      '</div>';
    document.body.dataset.printLayout = day.printLayout;
    document.body.dataset.printTimes = day.printTimes ? 'true' : 'false';
    document.body.dataset.printSpacing = day.printSpacing;
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
          '<label class="field"><span>Visual symbol (emoji)</span><input name="icon" maxlength="16" value="' + esc(activity.icon || '⭐') + '" list="symbolSuggestions" aria-describedby="symbolHelp"><datalist id="symbolSuggestions">' + ICONS.map((icon) => '<option value="' + esc(icon) + '">').join('') + '</datalist></label>' +
          '<label class="field"><span>Color</span><select name="color">' + COLORS.map((color) => '<option value="' + color + '" ' + (color === activity.color ? 'selected' : '') + '>' + COLOR_NAMES[color] + '</option>').join('') + '</select></label>' +
          '<label class="field full"><span>ARASAAC pictogram ID or HTTPS image URL (optional)</span><input name="pictogram" maxlength="300" value="' + esc(activity.pictogram || '') + '" placeholder="e.g., 1234"><small class="muted" id="symbolHelp">An ARASAAC ID loads its pictogram. Add a credit below for other image sources.</small></label>' +
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
    const pictogram = cleanText(data.get('pictogram'), 300, '');
    if (pictogram && !/^\d{1,10}$/.test(pictogram) && !/^https:\/\//i.test(pictogram)) {
      throw new Error('Use a pictogram number or a direct HTTPS image URL.');
    }
    const activity = sanitizeActivity({
      id: makeId('activity'),
      title: data.get('title'),
      category: data.get('category'),
      duration: data.get('duration'),
      icon: data.get('icon'),
      pictogram,
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
    destination.activities = source.activities.map((item) => ({ ...item, occurrenceId: makeId('scheduled') }));
    persist();
    render();
    app.querySelector('.day-tab[aria-pressed="true"]')?.focus();
    showToast(source.label + ' copied to ' + destination.label + '.');
  }

  function clearDay() {
    const plan = getPlan();
    const day = getDay(plan, activeDayKey);
    if (!day || !day.activities.length) return;
    if (!window.confirm('Clear all activities and open slots from ' + day.label + '?')) return;
    day.activities = [];
    persist();
    render();
    focusAddActivity();
    showToast(day.label + ' is clear.');
  }

  function removeActivity(occurrenceId) {
    const day = getDay(getPlan(), activeDayKey);
    if (!day) return;
    const item = day.activities.find((entry) => entry.occurrenceId === occurrenceId);
    const label = item && item.kind === 'open-slot' ? 'this open slot' : item && '“' + item.title + '”';
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
    const content = JSON.stringify({ format: 'woodles.schedule-week.v1', exportedAt: new Date().toISOString(), plan, activityLibrary }, null, 2);
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
        const plan = sanitizePlan({ ...rawPlan, id: makeId('plan'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        if (!plan) throw new Error('The selected file does not contain a usable weekly plan.');
        for (const day of plan.days) {
          const issue = validateDay(day);
          if (issue) throw new Error(day.label + ': ' + issue);
        }
        const importedActivities = Array.isArray(data.activityLibrary) ? data.activityLibrary.map(sanitizeActivity).filter(Boolean) : [];
        const activityIds = new Set(workspace.activities.map((item) => item.id));
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
    } else if (name === 'remove-activity') removeActivity(action.dataset.id);
    else if (name === 'move-activity') moveActivity(action.dataset.id, action.dataset.direction);
    else if (name === 'copy-day') copyDay();
    else if (name === 'clear-day') clearDay();
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
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-day-time]')) changeDayWindow(event.target);
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

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(location.search);
    currentPlanId = params.get('plan') || '';
    activeDayKey = DAY_KEYS.some((day) => day[0] === params.get('day')) ? params.get('day') : 'monday';
    render();
  });

  render();
})();
