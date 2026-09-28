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
  const MAX_CHOICE_OPTIONS = 6;
  const MAX_VIDEOS = 4;
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

  function sanitizeChoiceOption(value) {
    if (!value || typeof value !== 'object' || !String(value.title || '').trim()) return null;
    return {
      id: cleanText(value.id, 100, makeId('option')),
      title: cleanText(value.title, 60, 'Option'),
      icon: cleanText(value.icon, 16, '⭐'),
      pictogram: cleanText(value.pictogram, 300, ''),
      imageAssetId: cleanText(value.imageAssetId, 100, ''),
      color: validColor(value.color)
    };
  }

  function validVideoUrl(value) {
    if (!/^https?:\/\/\S+$/i.test(String(value || ''))) return false;
    try { return Boolean(new URL(value)); } catch { return false; }
  }

  // YouTube serves a 16:9 still for every video, used until a thumbnail is uploaded.
  function youTubeThumbnail(value) {
    let url;
    try { url = new URL(value); } catch { return ''; }
    const host = url.hostname.replace(/^(?:www|m|music)\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/')[1] || '';
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') id = url.searchParams.get('v') || (url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/) || [])[1] || '';
    return /^[\w-]{11}$/.test(id) ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : '';
  }

  function sanitizeVideo(value) {
    if (!value || typeof value !== 'object' || !String(value.title || '').trim()) return null;
    const url = cleanText(value.url, 500, '');
    if (!validVideoUrl(url)) return null;
    return {
      id: cleanText(value.id, 100, makeId('video')),
      title: cleanText(value.title, 80, 'Video'),
      url,
      imageAssetId: cleanText(value.imageAssetId, 100, '')
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
          if (entry && entry.kind === 'choice') {
            return {
              kind: 'choice',
              occurrenceId: cleanText(entry.occurrenceId, 100, makeId('scheduled')),
              sourceId: '',
              title: cleanText(entry.title, 100, ''),
              prompt: cleanText(entry.prompt, 200, ''),
              start: validTime(entry.start, '09:00'),
              duration: validDuration(entry.duration, 15),
              color: validColor(entry.color),
              options: (Array.isArray(entry.options) ? entry.options : []).map(sanitizeChoiceOption).filter(Boolean).slice(0, MAX_CHOICE_OPTIONS)
            };
          }
          if (entry && entry.kind === 'video') {
            return {
              kind: 'video',
              occurrenceId: cleanText(entry.occurrenceId, 100, makeId('scheduled')),
              sourceId: '',
              title: cleanText(entry.title, 100, ''),
              prompt: cleanText(entry.prompt, 200, ''),
              start: validTime(entry.start, '09:00'),
              duration: validDuration(entry.duration, 10),
              color: validColor(entry.color),
              videos: (Array.isArray(entry.videos) ? entry.videos : []).map(sanitizeVideo).filter(Boolean).slice(0, MAX_VIDEOS)
            };
          }
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

  // A choice without its own heading, and every open slot, is the learner's.
  function choiceTitle(item, learner) {
    return (item && item.title) || learner + '’s choice';
  }

  // One video is watched together; two or more are the learner's pick.
  function videoTitle(item, learner) {
    return item.title || (item.videos.length > 1 ? learner + ' picks a video' : 'Watch a video together');
  }

  function videoPrompt(item) {
    return item.prompt || (item.videos.length > 1 ? 'Pick one to watch.' : 'We watch this one together.');
  }

  function itemLabel(item, learner) {
    if (item.kind === 'activity') return item.title;
    return item.kind === 'video' ? videoTitle(item, learner) : choiceTitle(item, learner);
  }

  // The things on a scheduled item that carry a picture: an activity itself,
  // each option of a choice, or each video's thumbnail. Open slots have none.
  function itemVisuals(item) {
    if (item.kind === 'choice') return item.options;
    if (item.kind === 'video') return item.videos;
    return item.kind === 'open-slot' ? [] : [item];
  }

  function itemImageIds(item) {
    return itemVisuals(item).map((visual) => visual.imageAssetId).filter(Boolean);
  }

  function visualScheduleUrl(planId, dayKey) {
    return '/schedules/view?plan=' + encodeURIComponent(planId) + (dayKey ? '&day=' + encodeURIComponent(dayKey) : '');
  }

  return {
    STORAGE_KEY, DAY_KEYS, COLORS, MAX_CHOICE_OPTIONS, MAX_VIDEOS,
    makeId, esc, cleanText, validTime, validDuration, validColor, timeMinutes,
    isLocalImageData, pictogramSource, openMojiCodepoint, symbolMarkup,
    sanitizeImage, sanitizeActivity, sanitizeChoiceOption, sanitizeVideo, sanitizePlan, readWorkspace,
    validVideoUrl, youTubeThumbnail, choiceTitle, videoTitle, videoPrompt, itemLabel,
    itemVisuals, itemImageIds, visualScheduleUrl
  };
})();
