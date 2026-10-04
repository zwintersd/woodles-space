type RecordValue = Record<string, unknown>;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, max = 100) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function uniqueIds(values: unknown[]) {
  const ids = values.map(value => text(record(value).id));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error('Options, steps and candidates need unique IDs.');
}
const minutes = (value: unknown) => {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use valid schedule times.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
};
const duration = (value: unknown) => {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 480) throw new Error('Use item lengths from 1 to 480 minutes.');
  return Number(value);
};
const url = (value: unknown) => {
  const input = text(value, 500);
  if (!input) return '';
  try { if (['https:', 'http:'].includes(new URL(input).protocol)) return input; } catch { /* reject invalid links */ }
  throw new Error('An activity link is invalid.');
};
function visual(value: RecordValue): RecordValue {
  const pictogram = text(value.pictogram, 300);
  if (pictogram && !/^\d{1,10}$/.test(pictogram) && !/^https:\/\/\S+$/.test(pictogram)) throw new Error('A picture link is invalid.');
  return {
    title: text(value.title), icon: text(value.icon, 16), pictogram,
    color: /^#[a-f\d]{6}$/i.test(String(value.color)) ? value.color : '#3978c7',
    imageAssetId: text(value.imageAssetId), symbolAssetId: text(value.symbolAssetId), symbolStillAssetId: text(value.symbolStillAssetId),
    symbolName: text(value.symbolName), symbolCredit: text(value.symbolCredit, 300),
    symbolPixelated: value.symbolPixelated === true,
    credit: text(value.credit, 200), note: text(value.note, 500), category: text(value.category, 60),
    familiarity: ['new', 'again'].includes(String(value.familiarity)) ? value.familiarity : ''
  };
}
function content(raw: unknown, depth = 0): RecordValue {
  if (depth > 8) throw new Error('Nested activities are too deep to publish.');
  const value = record(raw);
  const kind = ['choice', 'suggestion', 'video', 'open-slot'].includes(String(value.kind)) ? String(value.kind) : 'activity';
  if ((kind === 'activity' || kind === 'suggestion') && !text(value.title)) throw new Error('Name each activity before publishing.');
  const result: RecordValue = { ...visual(value), kind, id: text(value.id), prompt: text(value.prompt, 200) };
  if (kind === 'suggestion' || kind === 'activity' && value.duration !== undefined) result.duration = duration(value.duration);
  if (kind === 'choice') {
    const options = array(value.options);
    if (options.length < 2 || options.length > 6) throw new Error('A choice needs two to six options.');
    uniqueIds(options);
    result.options = options.map(option => content(option, depth + 1));
  }
  if (kind === 'video') {
    const videos = array(value.videos);
    if (!videos.length || videos.length > 4) throw new Error('A video item needs one to four videos.');
    uniqueIds(videos);
    result.videos = videos.map(rawVideo => { const video = record(rawVideo); const href = url(video.url); if (!href || !text(video.title)) throw new Error('Add a video title and link.'); return { ...visual(video), id: text(video.id), url: href }; });
  }
  if (kind === 'suggestion') {
    const candidates = array(value.candidates).filter(candidate => record(candidate).enabled !== false);
    if (!candidates.length || candidates.length > 60) throw new Error('A suggestion needs enabled candidates.');
    uniqueIds(candidates);
    result.candidates = candidates.map(candidate => {
      const input = record(candidate);
      return { ...content({ ...input, kind: 'activity' }, depth + 1), duration: duration(input.duration), enabled: true,
        weight: Math.max(1, Math.min(10, Number(input.weight) || 1)), url: url(input.url) };
    });
    if (!(result.candidates as RecordValue[]).some(candidate => Number(candidate.duration) <= Number(result.duration))) throw new Error('A suggestion has no idea that fits its length.');
    Object.assign(result, { rerollMode: ['limited', 'unlimited'].includes(String(value.rerollMode)) ? value.rerollMode : 'none',
      maxRerolls: Math.max(0, Math.min(1000, Number(value.maxRerolls) || 0)), avoidRepeats: value.avoidRepeats !== false,
      allowCategoryChoice: value.allowCategoryChoice === true, allowSkip: value.allowSkip === true, animation: value.animation === 'instant' ? 'instant' : 'spin' });
  }
  const steps = array(value.steps);
  if (steps.length > 20) throw new Error('An activity can have up to 20 steps.');
  uniqueIds(steps);
  result.steps = steps.map(step => { const input = record(step); return { ...content(input, depth + 1), kind: input.kind === 'choice' || input.kind === 'suggestion' ? input.kind : 'task' }; });
  if (value.url) result.url = url(value.url);
  return result;
}
function checkBudget(value: RecordValue, budget: number) {
  const available = Math.min(Number(value.duration) || budget, budget);
  if (value.kind === 'suggestion' && !(value.candidates as RecordValue[]).some(candidate => Number(candidate.duration) <= available)) throw new Error('A nested suggestion has no idea that fits its time block.');
  for (const field of ['steps', 'options']) for (const child of (value[field] || []) as RecordValue[]) checkBudget(child, available);
  for (const candidate of (value.candidates || []) as RecordValue[]) checkBudget(candidate, Number(candidate.duration));
}
export function schedulePayload(raw: unknown, id: string) {
  const input = record(raw); const source = record(input.plan);
  if (!text(source.learner)) throw new Error('Add a learner label before publishing.');
  const sourceDays = array(source.days);
  if (sourceDays.length > 7) throw new Error('A plan can have up to seven days.');
  const seen = new Set();
  let count = 0;
  const days = sourceDays.filter(rawDay => record(rawDay).removed !== true).map(rawDay => {
    const day = record(rawDay); const key = text(day.key);
    if (!DAYS.includes(key) || seen.has(key)) throw new Error('Check the days in this plan.');
    seen.add(key);
    const start = minutes(day.start); const end = minutes(day.end);
    if (start >= end) throw new Error('A session must end after it starts.');
    const rawItems = array(day.activities).filter(item => record(item).ghost !== true);
    if (rawItems.length > 100) throw new Error('A day can have up to 100 items.');
    const ids = new Set();
    const activities = rawItems.map(rawItem => {
      const item = record(rawItem); const occurrenceId = text(item.occurrenceId);
      if (!occurrenceId || ids.has(occurrenceId)) throw new Error('Item IDs must be unique within each day.');
      ids.add(occurrenceId);
      return { ...content(item), occurrenceId, start: text(item.start, 5), duration: duration(item.duration), sourceId: '', ghost: false };
    }).sort((a, b) => minutes(a.start) - minutes(b.start));
    let cursor = start;
    for (const item of activities) { const at = minutes(item.start); if (at < cursor || at + item.duration > end) throw new Error('Resolve overlapping or out-of-session items before publishing.'); checkBudget(item, item.duration); cursor = at + item.duration; }
    count += activities.length;
    return { key, start: text(day.start, 5), end: text(day.end, 5), removed: false, activities };
  });
  if (!count) throw new Error('Include at least one scheduled item. Ghosts and hidden days are excluded.');
  const referenced = new Set<string>();
  const collect = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { if (['imageAssetId', 'symbolAssetId', 'symbolStillAssetId'].includes(key) && typeof item === 'string' && item) referenced.add(item); else if (typeof item === 'object') collect(item); }
  };
  collect(days);
  const images = array(input.images).map(record).filter(image => referenced.has(text(image.id))).map(image => {
    if (typeof image.data !== 'string' || image.data.length > 100000 || !/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(image.data)) throw new Error('An uploaded image is invalid.');
    return { id: text(image.id), data: image.data };
  });
  const imageIds = new Set(images.map(image => image.id));
  if (imageIds.size !== images.length || [...referenced].some(id => !imageIds.has(id))) throw new Error('An uploaded picture is missing or duplicated. Attach it again before publishing.');
  const payload = { schemaVersion: 1, plan: { id, learner: text(source.learner), name: text(source.name) || 'Weekly plan', days }, images };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 3_500_000) throw new Error('This plan is too large to publish. Use smaller uploaded pictures.');
  return payload;
}
