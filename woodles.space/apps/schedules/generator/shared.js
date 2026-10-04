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
  // Whether an offered video or option is familiar to the learner or novel.
  const FAMILIARITY = { again: { label: 'Again', symbol: '↻' }, new: { label: 'New', symbol: '✦' } };
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
    return typeof value === 'string' && value.length <= 100000 && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value);
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

  function symbolFields(value = {}) {
    return { symbolAssetId: cleanText(value.symbolAssetId, 100, ''), symbolStillAssetId: cleanText(value.symbolStillAssetId, 100, ''),
      symbolName: cleanText(value.symbolName, 40, ''), symbolPixelated: value.symbolPixelated === true,
      symbolCredit: cleanText(value.symbolCredit, 200, '') };
  }

  function sanitizeCustomSymbol(value) {
    if (!value || typeof value !== 'object' || !value.symbolAssetId || !/^[a-z0-9_]{1,40}$/.test(value.symbolName || '')) return null;
    return { id: cleanText(value.id, 100, makeId('symbol')), ...symbolFields(value), group: cleanText(value.group, 60, 'My symbols') };
  }

  function customSymbolMarkup(item, images, size) {
    const source = images.find((image) => image.id === item.symbolAssetId)?.data;
    if (!isLocalImageData(source)) return '';
    const still = images.find((image) => image.id === item.symbolStillAssetId)?.data;
    return '<picture class="custom-symbol-art">' + (isLocalImageData(still) ? '<source media="print, (prefers-reduced-motion: reduce)" srcset="' + esc(still) + '">' : '') +
      '<img src="' + esc(source) + '" alt="" width="' + size + '" height="' + size + '" style="object-fit:contain;' + (item.symbolPixelated ? 'image-rendering:pixelated;' : '') + '"></picture>';
  }

  function customSymbolCredits(visuals) {
    const credits = [...new Set(visuals.filter((item) => item.symbolAssetId && item.symbolCredit).map((item) => item.symbolCredit))];
    return credits.length ? 'Custom symbols: ' + credits.map(esc).join(' · ') : '';
  }

  function sanitizeActivity(value, depth = 0) {
    if (!value || typeof value !== 'object' || !String(value.title || '').trim()) return null;
    return {
      ...symbolFields(value),
      id: cleanText(value.id, 100, makeId('activity')),
      title: cleanText(value.title, 100, 'Activity'),
      category: cleanText(value.category, 60, 'Other'),
      duration: validDuration(value.duration, 15),
      icon: cleanText(value.icon, 16, '⭐'),
      pictogram: cleanText(value.pictogram, 300, ''),
      imageAssetId: cleanText(value.imageAssetId, 100, ''),
      credit: cleanText(value.credit, 200, ''),
      color: validColor(value.color),
      note: cleanText(value.note, 500, ''),
      steps: (Array.isArray(value.steps) ? value.steps : []).slice(0, 20).map((step) => sanitizeActivityStep(step, depth)).filter(Boolean)
    };
  }

  function validFamiliarity(value) {
    return Object.prototype.hasOwnProperty.call(FAMILIARITY, value) ? value : '';
  }

  function sanitizeActivityStep(value, depth = 0) {
    const step = sanitizeChoiceOption(value, depth);
    if (!step) return null;
    if (value.kind === 'suggestion' && depth < 3) return { ...step, ...sanitizeSuggestion(value, depth + 1), kind: 'suggestion', poolId: cleanText(value.poolId, 100, '') };
    return { ...step, kind: value.kind === 'choice' ? 'choice' : 'task',
      options: (Array.isArray(value.options) ? value.options : []).map((option) => sanitizeChoiceOption(option, depth)).filter(Boolean).slice(0, MAX_CHOICE_OPTIONS) };
  }

  function activityStepsMarkup(item, visual) {
    if (!item.steps || !item.steps.length) return '';
    return '<ol class="activity-steps">' + item.steps.map((step) => '<li><span class="step-heading">' + visual(step, 24) + '<strong>' + esc(step.title) + '</strong></span>' +
      (step.kind === 'choice' ? '<span class="step-options">Pick one: ' + step.options.map((option) => '<span>' + visual(option, 24) + esc(option.title) + '</span>').join('<b aria-hidden="true">or</b>') + '</span>' : step.kind === 'suggestion' ? '<span class="step-options">Suggestion pool: ' + step.candidates.filter((candidate) => candidate.enabled && candidate.duration <= Math.min(step.duration, item.duration)).map((candidate) => esc(candidate.title)).join(' · ') + '</span>' : '') + '</li>').join('') + '</ol>';
  }

  function familiarityMarkup(value) {
    const tag = FAMILIARITY[validFamiliarity(value)];
    return tag ? '<span class="familiarity is-' + value + '"><span aria-hidden="true">' + tag.symbol + '</span> ' + tag.label + '</span>' : '';
  }

  function sanitizeChoiceOption(value, depth = 0) {
    if (!value || typeof value !== 'object' || !String(value.title || '').trim()) return null;
    return {
      ...symbolFields(value),
      id: cleanText(value.id, 100, makeId('option')),
      title: cleanText(value.title, 60, 'Option'),
      icon: cleanText(value.icon, 16, '⭐'),
      pictogram: cleanText(value.pictogram, 300, ''),
      imageAssetId: cleanText(value.imageAssetId, 100, ''),
      color: validColor(value.color),
      familiarity: validFamiliarity(value.familiarity),
      ...(value.kind === 'suggestion' && depth < 3 ? { ...sanitizeSuggestion(value, depth + 1), kind: 'suggestion', title: cleanText(value.title, 60, 'Category'), poolId: cleanText(value.poolId, 100, ''), allowCategoryChoice: false } : {})
    };
  }

  function validVideoUrl(value) {
    if (!/^https?:\/\/\S+$/i.test(String(value || ''))) return false;
    try { return Boolean(new URL(value)); } catch { return false; }
  }

  function youTubeId(value) {
    let url;
    try { url = new URL(value); } catch { return ''; }
    const host = url.hostname.replace(/^(?:www|m|music)\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/')[1] || '';
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') id = url.searchParams.get('v') || (url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/) || [])[1] || '';
    return /^[\w-]{11}$/.test(id) ? id : '';
  }

  // YouTube serves a 16:9 still for every video, used until a thumbnail is uploaded.
  function youTubeThumbnail(value) {
    const id = youTubeId(value);
    return id ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : '';
  }

  // Two links to one video (youtu.be/ID and youtube.com/watch?v=ID&list=…) share a key.
  function videoKey(value) {
    const id = youTubeId(value);
    if (id) return 'youtube:' + id;
    try {
      const url = new URL(value);
      return url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/+$/, '') + url.search;
    } catch {
      return String(value || '');
    }
  }

  function sanitizeVideo(value) {
    if (!value || typeof value !== 'object' || !String(value.title || '').trim()) return null;
    const url = cleanText(value.url, 500, '');
    if (!validVideoUrl(url)) return null;
    return {
      id: cleanText(value.id, 100, makeId('video')),
      title: cleanText(value.title, 80, 'Video'),
      url,
      imageAssetId: cleanText(value.imageAssetId, 100, ''),
      familiarity: validFamiliarity(value.familiarity)
    };
  }

  function boundedInteger(value, min, max, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
  }

  function sanitizeSuggestionCandidate(value, depth = 0) {
    const activity = sanitizeActivity(value, depth);
    if (!activity) return null;
    return { ...activity, enabled: value.enabled !== false,
      weight: boundedInteger(value.weight, 1, 10, 1),
      url: validVideoUrl(value.url) ? cleanText(value.url, 500, '') : '' };
  }

  function sanitizeSuggestion(value, depth = 0) {
    const ids = new Set();
    const candidates = (Array.isArray(value.candidates) ? value.candidates : [])
      .slice(0, 60).map((candidate) => sanitizeSuggestionCandidate(candidate, depth)).filter((candidate) => {
        if (!candidate || ids.has(candidate.id)) return false;
        ids.add(candidate.id);
        return true;
      });
    return {
      title: cleanText(value.title, 100, 'Activity surprise'),
      prompt: cleanText(value.prompt, 200, 'Let’s find something to do!'),
      duration: validDuration(value.duration, 15),
      rerollMode: ['none', 'limited', 'unlimited'].includes(value.rerollMode) ? value.rerollMode : 'none',
      maxRerolls: boundedInteger(value.maxRerolls, 0, 1000, 2),
      avoidRepeats: value.avoidRepeats !== false,
      allowCategoryChoice: value.allowCategoryChoice === true,
      allowSkip: value.allowSkip === true,
      animation: value.animation === 'instant' ? 'instant' : 'spin',
      candidates
    };
  }

  function sanitizeSuggestionPool(value) {
    if (!value || typeof value !== 'object' || !value.title) return null;
    return { id: cleanText(value.id, 100, makeId('pool')), ...sanitizeSuggestion(value) };
  }

  function sanitizeSuggestionState(value = {}) {
    if (!value || typeof value !== 'object') value = {};
    return { spins: boundedInteger(value.spins, 0, 1000000, 0),
      selected: cleanText(value.selected, 100, ''),
      seen: [...new Set((Array.isArray(value.seen) ? value.seen : []).filter((id) => typeof id === 'string').slice(0, 60))],
      accepted: value.accepted === true, skipped: value.skipped === true,
      category: cleanText(value.category, 60, '') };
  }

  // One first draw, then the maker's reroll allowance. Changing categories does
  // not create another first draw. Only available candidates that fit may win.
  function suggestionStatus(item, rawState, category = '') {
    const state = sanitizeSuggestionState(rawState);
    const pool = item.candidates.filter((candidate) => candidate.enabled && candidate.duration <= item.duration);
    const selected = pool.find((candidate) => candidate.id === state.selected) || null;
    const eligible = pool.filter((candidate) => (!item.allowCategoryChoice || !category || candidate.category === category)
      && (!item.avoidRepeats || !state.seen.includes(candidate.id)));
    const candidates = !item.avoidRepeats && eligible.length > 1
      ? eligible.filter((candidate) => candidate.id !== state.selected) : eligible;
    const remaining = item.rerollMode === 'unlimited' ? Infinity
      : Math.max(0, (item.rerollMode === 'limited' ? item.maxRerolls : 0) + 1 - state.spins);
    const locked = (state.accepted && Boolean(selected)) || state.skipped;
    let reason = '';
    if (locked) reason = state.skipped ? 'Skipped. Choose a plan with your helper.' : 'You chose this. Let’s do it!';
    else if (!pool.length) reason = 'No activities are available for this time slot. Ask your helper.';
    else if (!remaining) reason = 'No rerolls left. Use this suggestion or ask your helper.';
    else if (!candidates.length) reason = 'No more suggestions in this category. Try another category or ask your helper.';
    return { state, pool, selected, candidates, remaining, locked, canDraw: !locked && remaining > 0 && candidates.length > 0, reason };
  }

  function drawSuggestion(item, rawState, category = '', random = Math.random) {
    const status = suggestionStatus(item, rawState, category);
    if (!status.canDraw) return null;
    const total = status.candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let target = random() * total;
    const selected = status.candidates.find((candidate) => { target -= candidate.weight; return target < 0; }) || status.candidates[status.candidates.length - 1];
    return { ...status.state, selected: selected.id, spins: status.state.spins + 1,
      seen: [...new Set([...status.state.seen, selected.id])], accepted: false,
      category: item.allowCategoryChoice ? category : '' };
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
          if (entry && entry.kind === 'suggestion') {
            return { ...sanitizeSuggestion(entry), kind: 'suggestion',
              occurrenceId: cleanText(entry.occurrenceId, 100, makeId('scheduled')),
              sourceId: '', poolId: cleanText(entry.poolId, 100, ''),
              start: validTime(entry.start, '09:00'), color: validColor(entry.color) };
          }
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
              options: (Array.isArray(entry.options) ? entry.options : []).map((option) => sanitizeChoiceOption(option)).filter(Boolean).slice(0, MAX_CHOICE_OPTIONS)
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
          deletedPlans: Array.isArray(value.deletedPlans) ? value.deletedPlans.map(sanitizePlan).filter(Boolean) : [],
          activities: Array.isArray(value.activities) ? value.activities.map((activity) => sanitizeActivity(activity)).filter(Boolean) : [],
          suggestionPools: Array.isArray(value.suggestionPools) ? value.suggestionPools.map(sanitizeSuggestionPool).filter(Boolean) : [],
          customSymbols: Array.isArray(value.customSymbols) ? value.customSymbols.map(sanitizeCustomSymbol).filter(Boolean).slice(0, 256) : [],
          images: Array.isArray(value.images) ? value.images.map(sanitizeImage).filter(Boolean) : []
        };
      }
    } catch {}
    return { plans: [], deletedPlans: [], activities: [], images: [], suggestionPools: [], customSymbols: [] };
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
    if (item.kind === 'activity' || item.kind === 'suggestion') return item.title;
    return item.kind === 'video' ? videoTitle(item, learner) : choiceTitle(item, learner);
  }

  // The things on a scheduled item that carry a picture: an activity itself,
  // each option of a choice, or each video's thumbnail. Open slots have none.
  function itemVisuals(item) {
    if (Array.isArray(item.candidates)) return [item, ...item.candidates.flatMap((candidate) => itemVisuals(candidate))];
    if (item.kind === 'choice') return [item, ...item.options.flatMap(itemVisuals)];
    if (item.kind === 'video') return item.videos;
    return item.kind === 'open-slot' ? [] : [item, ...(item.steps || []).flatMap(itemVisuals), ...(item.options || []).flatMap(itemVisuals)];
  }

  // Stable paths distinguish suggestion steps in each activity occurrence,
  // including steps inside an accepted candidate. All fit their parent budget.
  function suggestionItems(item, key = item.occurrenceId, duration = item.duration) {
    const budget = Math.min(item.duration || duration, duration);
    const own = item.kind === 'suggestion' ? [{ ...item, occurrenceId: key, duration: budget, nested: item.occurrenceId !== key }] : [];
    return [...own, ...(item.steps || []).flatMap((step) => suggestionItems(step, key + ':' + step.id, budget)),
      ...(item.candidates || []).flatMap((candidate) => suggestionItems(candidate, key + ':' + candidate.id, budget)),
      ...(item.options || []).flatMap((option) => suggestionItems(option, key + ':' + option.id, budget))];
  }

  function itemImageIds(item) {
    return itemVisuals(item).flatMap((visual) => [visual.imageAssetId, visual.symbolAssetId, visual.symbolStillAssetId]).filter(Boolean);
  }

  function visualScheduleUrl(planId, dayKey) {
    return '/schedules/view?plan=' + encodeURIComponent(planId) + (dayKey ? '&day=' + encodeURIComponent(dayKey) : '');
  }

  return {
    STORAGE_KEY, DAY_KEYS, COLORS, MAX_CHOICE_OPTIONS, MAX_VIDEOS, FAMILIARITY,
    makeId, esc, cleanText, validTime, validDuration, validColor, timeMinutes,
    isLocalImageData, pictogramSource, openMojiCodepoint, symbolMarkup,
    sanitizeImage, sanitizeActivity, sanitizeActivityStep, activityStepsMarkup, sanitizeChoiceOption, sanitizeVideo, sanitizePlan, readWorkspace,
    symbolFields, sanitizeCustomSymbol, customSymbolMarkup, customSymbolCredits,
    sanitizeSuggestion, sanitizeSuggestionCandidate, sanitizeSuggestionPool, sanitizeSuggestionState, suggestionStatus, drawSuggestion,
    validVideoUrl, youTubeThumbnail, videoKey, validFamiliarity, familiarityMarkup, choiceTitle, videoTitle, videoPrompt, itemLabel,
    itemVisuals, itemImageIds, suggestionItems, visualScheduleUrl
  };
})();
