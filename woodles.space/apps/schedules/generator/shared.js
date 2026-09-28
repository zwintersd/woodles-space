// The weekly planner's saved format and the helpers that read it, shared by the
// planner (generator/app.js) and the visual schedule it opens (view/app.js).
window.ScheduleStudio = (() => {
  'use strict';

  const STORAGE_KEY = 'woodles.schedule-planner.v1';
  const DAY_KEYS = [
    ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'],
    ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday']
  ];
  const COLORS = ['#3978c7', '#32845f', '#d27b32', '#a16ab5', '#d05c66', '#458d98', '#7c8797'];
  const OPENMOJI_FILES = new Set([
    '23E9', '2696', '2705', '2728', '2B50', '1F308', '1F319', '1F330', '1F331', '1F338', '1F33B',
    '1F33C', '1F33E', '1F33F', '1F340', '1F344', '1F347', '1F34E', '1F36F', '1F3AF', '1F3C6',
    '1F40C', '1F41A', '1F41D', '1F48E', '1F4A0', '1F4A7', '1F4C8', '1F4CB', '1F4DC', '1F512',
    '1F513', '1F525', '1F5D1', '1F98B', '1FA99', '1FAB5', '1FAE7'
  ]);

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

  function timeMinutes(value) {
    const parts = String(value || '00:00').split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }

  function isLocalImageData(value) {
    return typeof value === 'string' && value.length <= 100000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value);
  }

  function pictogramSource(value) {
    const text = String(value || '').trim();
    if (/^\d{1,10}$/.test(text)) return 'https://static.arasaac.org/pictograms/' + text + '/' + text + '_300.png';
    if (/^https:\/\//i.test(text)) return text;
    return '';
  }

  function openMojiCodepoint(value) {
    const points = Array.from(String(value || '').trim()).map((character) => character.codePointAt(0)).filter((point) => point !== 0xfe0f);
    if (points.length !== 1) return '';
    const codepoint = points[0].toString(16).toUpperCase();
    return OPENMOJI_FILES.has(codepoint) ? codepoint : '';
  }

  function symbolMarkup(value, size) {
    const symbol = String(value || '⭐');
    const codepoint = openMojiCodepoint(symbol);
    if (codepoint) return '<img class="symbol-artwork" src="/schedules/generator/assets/openmoji/' + codepoint + '.svg" alt="" width="' + size + '" height="' + size + '" loading="lazy">';
    return '<span class="symbol-fallback" aria-hidden="true" style="font-size:' + size + 'px">' + esc(symbol) + '</span>';
  }

  function sanitizeImage(value) {
    if (!value || typeof value !== 'object' || !isLocalImageData(value.data)) return null;
    return { id: cleanText(value.id, 100, makeId('image')), data: value.data };
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
      imageAssetId: cleanText(value.imageAssetId, 100, ''),
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
        removed: source.removed === true,
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

  function readWorkspace() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (value && typeof value === 'object') {
        return {
          plans: Array.isArray(value.plans) ? value.plans.map(sanitizePlan).filter(Boolean) : [],
          activities: Array.isArray(value.activities) ? value.activities.map(sanitizeActivity).filter(Boolean) : [],
          images: Array.isArray(value.images) ? value.images.map(sanitizeImage).filter(Boolean) : []
        };
      }
    } catch {}
    return { plans: [], activities: [], images: [] };
  }

  function visualScheduleUrl(planId, dayKey) {
    return '/schedules/view?plan=' + encodeURIComponent(planId) + (dayKey ? '&day=' + encodeURIComponent(dayKey) : '');
  }

  return {
    STORAGE_KEY, DAY_KEYS, COLORS,
    makeId, esc, cleanText, validTime, validDuration, validColor, timeMinutes,
    isLocalImageData, pictogramSource, openMojiCodepoint, symbolMarkup,
    sanitizeImage, sanitizeActivity, sanitizePlan, readWorkspace, visualScheduleUrl
  };
})();
