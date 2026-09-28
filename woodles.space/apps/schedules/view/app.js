(() => {
  'use strict';

  const {
    DAY_KEYS, STORAGE_KEY, esc, timeMinutes, validColor, isLocalImageData, pictogramSource,
    openMojiCodepoint, symbolMarkup, readWorkspace, choiceTitle, videoTitle, videoPrompt, itemLabel,
    youTubeThumbnail, FAMILIARITY, familiarityMarkup, itemVisuals, visualScheduleUrl
  } = window.ScheduleStudio;
  // Checks and picks belong to one calendar day, so a weekly plan starts fresh each time it comes round.
  const PROGRESS_KEY = 'woodles.schedule-planner.progress.v1';
  const OPEN_SLOT_SYMBOL = '✨';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const params = new URLSearchParams(location.search);
  const planId = params.get('plan') || '';
  const requestedDay = params.get('day') || '';
  const el = (id) => document.getElementById(id);

  let workspace = readWorkspace();
  let plan = null;
  let day = null;

  function todayKey(date) {
    return DAY_KEYS[(date.getDay() + 6) % 7][0];
  }

  function localDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function clockLabel(minutes) {
    const hour = Math.floor(minutes / 60) % 24;
    return (hour % 12 || 12) + ':' + String(minutes % 60).padStart(2, '0');
  }

  function chooseDay() {
    const shown = plan.days.filter((entry) => !entry.removed);
    const today = todayKey(new Date());
    return shown.find((entry) => entry.key === requestedDay)
      || shown.find((entry) => entry.key === today && entry.activities.length)
      || shown.find((entry) => entry.activities.length)
      || shown.find((entry) => entry.key === today)
      || shown[0]
      || null;
  }

  function steps() {
    const items = [...day.activities]
      .sort((a, b) => timeMinutes(a.start) - timeMinutes(b.start))
      .map((item) => ({ ...item, from: timeMinutes(item.start), to: timeMinutes(item.start) + item.duration }));
    items.push({ kind: 'finish', occurrenceId: 'finish', from: timeMinutes(day.end), to: Infinity });
    return items;
  }

  function stepLabel(step, picks) {
    if (step.kind === 'finish') return 'All done!';
    if (step.kind === 'video') {
      const video = step.videos.find((entry) => entry.id === picks[step.occurrenceId]) || (step.videos.length === 1 ? step.videos[0] : null);
      return video ? 'Watch ' + video.title : itemLabel(step, plan.learner);
    }
    const picked = step.kind === 'choice' && step.options.find((option) => option.id === picks[step.occurrenceId]);
    return picked ? picked.title : itemLabel(step, plan.learner);
  }

  function imageValue(item) {
    return workspace.images.find((image) => image.id === item.imageAssetId)?.data || String(item.pictogram || '').trim();
  }

  function imageSource(item) {
    const value = imageValue(item);
    return isLocalImageData(value) ? value : pictogramSource(value);
  }

  function visualMarkup(item, size) {
    const source = imageSource(item);
    return source ? '<img src="' + esc(source) + '" alt="">' : symbolMarkup(item.icon, size);
  }

  function readProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function progressKey() {
    return plan.id + ':' + day.key;
  }

  function readDayProgress() {
    const entry = readProgress()[progressKey()];
    const current = entry && entry.date === localDate(new Date()) ? entry : {};
    const picks = {};
    if (current.picks && typeof current.picks === 'object') {
      for (const [id, option] of Object.entries(current.picks)) if (typeof option === 'string') picks[id] = option;
    }
    return { done: new Set(Array.isArray(current.done) ? current.done.map(String) : []), picks };
  }

  function writeDayProgress(progress) {
    const today = localDate(new Date());
    const kept = {};
    for (const [key, entry] of Object.entries(readProgress())) {
      if (entry && entry.date === today && key !== progressKey()) kept[key] = entry;
    }
    if (progress.done.size || Object.keys(progress.picks).length) kept[progressKey()] = { date: today, done: [...progress.done], picks: progress.picks };
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(kept)); } catch {}
  }

  function doneButton(step, title, done) {
    return '<button class="done-btn" type="button" data-done="' + esc(step.occurrenceId) + '" aria-pressed="' + done + '" aria-label="Mark ' + esc(title) + ' done">' + CHECK + '</button>';
  }

  function choiceMarkup(step, progress) {
    const title = choiceTitle(step, plan.learner);
    const count = step.options.length;
    const done = progress.done.has(step.occurrenceId);
    const chips = step.options.map((option) =>
      '<button class="chip" type="button" data-choice="' + esc(step.occurrenceId) + '" data-option="' + esc(option.id) + '" aria-pressed="' + (progress.picks[step.occurrenceId] === option.id) + '" style="--activity-color:' + validColor(option.color) + '">' +
        '<span class="chip-art" aria-hidden="true">' + visualMarkup(option, 34) + '</span><span>' + esc(option.title) + '</span>' + familiarityMarkup(option.familiarity) + '</button>').join('');
    return '<li class="step choice' + (done ? ' is-done' : '') + '" data-id="' + esc(step.occurrenceId) + '">' +
      '<div class="time">' + clockLabel(step.from) + '<small>' + step.duration + ' min</small></div>' +
      '<article class="box"><span class="nowtag">NOW</span><div class="choice-layout">' +
        '<div class="copy"><h2>' + esc(title) + '</h2><p class="sub">' + esc(step.prompt || 'Pick what to do.') + '</p></div>' +
        (count ? '<div class="chips" role="group" aria-label="Options for ' + esc(title) + '" style="--chip-columns:' + (count <= 4 ? count : 3) + ';--chip-columns-narrow:' + (count === 4 ? 2 : Math.min(count, 3)) + '">' + chips + '</div>' : '') +
        doneButton(step, title, done) +
      '</div></article></li>';
  }

  function videoCardState(card, picked) {
    const pick = card.querySelector('.pick');
    card.classList.toggle('picked', picked === card.dataset.video);
    card.classList.toggle('dim', Boolean(picked) && picked !== card.dataset.video);
    if (!pick) return;
    pick.setAttribute('aria-pressed', String(picked === card.dataset.video));
    pick.textContent = picked === card.dataset.video ? 'Picked!' : 'Pick';
  }

  function videoMarkup(step, progress) {
    const title = videoTitle(step, plan.learner);
    const done = progress.done.has(step.occurrenceId);
    const picking = step.videos.length > 1;
    const cards = step.videos.map((video) => {
      const uploaded = imageValue(video);
      const source = isLocalImageData(uploaded) ? uploaded : youTubeThumbnail(video.url);
      return '<article class="vid" data-video="' + esc(video.id) + '">' +
        (source ? '<img class="art" src="' + esc(source) + '" alt="">' : '<span class="art art-empty" aria-hidden="true">▶</span>') +
        '<div class="vid-body">' + familiarityMarkup(video.familiarity) + '<h3>' + esc(video.title) + '</h3><div class="btns">' +
          (picking ? '<button class="pick" type="button" data-video-step="' + esc(step.occurrenceId) + '" data-video="' + esc(video.id) + '" aria-pressed="false" aria-label="Pick ' + esc(video.title) + (FAMILIARITY[video.familiarity] ? ', ' + FAMILIARITY[video.familiarity].label.toLowerCase() : '') + '">Pick</button>' : '') +
          '<a class="watch" href="' + esc(video.url) + '" target="_blank" rel="noopener noreferrer" aria-label="Watch ' + esc(video.title) + ' (opens in a new tab)">▶ Watch</a>' +
        '</div></div></article>';
    }).join('');
    return '<li class="step video' + (done ? ' is-done' : '') + '" data-id="' + esc(step.occurrenceId) + '">' +
      '<div class="time">' + clockLabel(step.from) + '<small>' + step.duration + ' min</small></div>' +
      '<article class="box"><span class="nowtag">NOW</span>' +
        '<div class="video-head"><div class="copy"><h2>' + esc(title) + '</h2><p class="sub">' + esc(videoPrompt(step)) + '</p></div>' + doneButton(step, title, done) + '</div>' +
        (step.videos.length ? '<div class="videos count-' + step.videos.length + '">' + cards + '</div>' : '') +
      '</article></li>';
  }

  function stepMarkup(step, progress) {
    if (step.kind === 'video') return videoMarkup(step, progress);
    if (step.kind === 'choice') return choiceMarkup(step, progress);
    const done = progress.done.has(step.occurrenceId);
    if (step.kind === 'finish') {
      return '<li class="step finish" data-id="finish"><div class="time">' + clockLabel(step.from) + '</div>' +
        '<article class="box"><span class="nowtag">NOW</span><h2>All done!</h2><p class="sub">Great job today, ' + esc(plan.learner) + '!</p></article></li>';
    }
    const open = step.kind === 'open-slot';
    const title = stepLabel(step, progress.picks);
    const visual = open ? symbolMarkup(OPEN_SLOT_SYMBOL, 46) : visualMarkup(step, 46);
    return '<li class="step' + (open ? ' open' : '') + (done ? ' is-done' : '') + '" data-id="' + esc(step.occurrenceId) + '">' +
      '<div class="time">' + clockLabel(step.from) + '<small>' + step.duration + ' min</small></div>' +
      '<article class="box" style="--activity-color:' + validColor(step.color) + '"><span class="nowtag">NOW</span><div class="activity">' +
        '<span class="visual" aria-hidden="true">' + visual + '</span>' +
        '<div class="copy">' + (open ? '' : '<span class="category">' + esc(step.category) + '</span>') + '<h2>' + esc(title) + '</h2>' +
          (open ? '<p class="sub">Pick what to do.</p>' : step.note ? '<p class="sub">' + esc(step.note) + '</p>' : '') +
          (!open && step.credit ? '<p class="image-credit">' + esc(step.credit) + '</p>' : '') +
        '</div>' +
        doneButton(step, title, done) +
      '</div></article></li>';
  }

  function creditsMarkup() {
    const visuals = day.activities.flatMap(itemVisuals);
    const hasArasaac = visuals.some((item) => /^\d{1,10}$/.test(imageValue(item)));
    const hasOpenMoji = day.activities.some((item) => item.kind === 'open-slot') || visuals.some((item) => !imageSource(item) && Boolean(openMojiCodepoint(item.icon)));
    return [
      hasArasaac ? 'Pictograms: Sergio Palao · <a href="https://arasaac.org" target="_blank" rel="noopener noreferrer">ARASAAC</a> · <a href="https://aulaabierta.arasaac.org/en/terms-of-use" target="_blank" rel="noopener noreferrer">CC BY-NC-SA</a> · Government of Aragón' : '',
      hasOpenMoji ? 'Emoji artwork: <a href="https://openmoji.org" target="_blank" rel="noopener noreferrer">OpenMoji</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>' : ''
    ].filter(Boolean).join('<br>');
  }

  function dayLinksMarkup(target, current) {
    return target.days.filter((entry) => !entry.removed && (entry.activities.length || entry === current)).map((entry) =>
      '<a href="' + esc(visualScheduleUrl(target.id, entry.key)) + '"' + (entry === current ? ' aria-current="page"' : '') + '>' + esc(entry.label.slice(0, 3)) + '</a>').join('');
  }

  function showNotice(title, message, withPicker) {
    const plans = withPicker ? [...workspace.plans].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) : [];
    const picks = plans.map((entry) => {
      const links = dayLinksMarkup(entry, null);
      return '<div class="plan-pick"><strong>' + esc(entry.learner) + ' <span>· ' + esc(entry.name) + '</span></strong>' +
        (links ? '<nav class="day-links" aria-label="' + esc(entry.learner) + ' days">' + links + '</nav>' : '<span class="sub">No activities planned yet.</span>') + '</div>';
    }).join('');
    el('notice').innerHTML = '<h2>' + esc(title) + '</h2><p>' + esc(message) + '</p>' +
      (picks ? '<div class="plan-picks">' + picks + '</div>' : '<a class="notice-button" href="/schedules/generator">Open the weekly planner</a>');
    el('notice').hidden = false;
  }

  function render() {
    plan = workspace.plans.find((entry) => entry.id === planId) || null;
    day = plan ? chooseDay() : null;
    ['nowNext', 'timeline', 'notice', 'footer'].forEach((id) => { el(id).hidden = true; });

    if (!plan) {
      document.title = 'Visual schedule · Schedule studio';
      el('editLink').href = '/schedules/generator';
      el('editLink').textContent = '✎ Weekly planner';
      el('greeting').textContent = 'Visual schedules';
      el('intro').textContent = 'Each planned day, the way the learner sees it.';
      if (!workspace.plans.length) showNotice('No plans on this device yet', 'Visual schedules come from weekly plans saved in this browser. Make a plan, add a few activities, then choose Visual schedule.', false);
      else if (planId) showNotice('That plan isn’t on this device', 'Plans are saved in the browser that made them. Choose one saved here, or import the plan into the weekly planner first.', true);
      else showNotice('Choose a schedule', 'Pick a learner and a day.', true);
      tick();
      return;
    }

    el('editLink').href = '/schedules/generator?plan=' + encodeURIComponent(plan.id) + (day ? '&day=' + day.key : '');
    el('editLink').textContent = '✎ Edit plan';
    el('greeting').textContent = 'Hi ' + plan.learner + '!';
    if (!day) {
      document.title = plan.learner + ' · Visual schedule';
      el('intro').textContent = plan.name;
      showNotice('No days in this plan', 'Every day was deleted from this weekly plan. Add a day back in the planner.', false);
      tick();
      return;
    }

    const isToday = day.key === todayKey(new Date());
    document.title = 'Hi ' + plan.learner + '! · ' + day.label;
    el('intro').textContent = 'Here’s our plan for ' + (isToday ? 'today' : day.label) + ', from ' + clockLabel(timeMinutes(day.start)) + ' to ' + clockLabel(timeMinutes(day.end)) + '.';
    el('dayLinks').innerHTML = dayLinksMarkup(plan, day);
    el('footer').hidden = false;

    if (!day.activities.length) {
      el('reset').hidden = true;
      el('credits').innerHTML = '';
      el('notice').innerHTML = '<h2>Nothing planned for ' + esc(day.label) + ' yet</h2><p>Add activities, choices, videos, or open slots to this day in the weekly planner, and they will show up here.</p>' +
        '<a class="notice-button" href="' + esc(el('editLink').href) + '">Plan ' + esc(day.label) + '</a>';
      el('notice').hidden = false;
      tick();
      return;
    }

    const progress = readDayProgress();
    el('reset').hidden = false;
    el('reset').textContent = day.activities.some((item) => item.kind === 'choice' || (item.kind === 'video' && item.videos.length > 1)) ? 'Clear choices and checks' : 'Clear checks';
    el('credits').innerHTML = creditsMarkup();
    el('timeline').setAttribute('aria-label', day.label + ' schedule');
    el('timeline').innerHTML = steps().map((step) => stepMarkup(step, progress)).join('');
    el('timeline').querySelectorAll('.videos').forEach((list) => {
      const picked = progress.picks[list.closest('.step').dataset.id];
      list.querySelectorAll('.vid').forEach((card) => videoCardState(card, picked));
    });
    el('timeline').hidden = false;
    el('nowNext').hidden = false;
    tick();
  }

  function tick() {
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();
    el('clock').textContent = 'Now: ' + clockLabel(minute);
    if (!day || !day.activities.length) return;
    const list = steps();
    const finish = list.length - 1;
    const live = day.key === todayKey(now);
    const { picks } = readDayProgress();
    const at = (step) => clockLabel(step.from) + ' ' + stepLabel(step, picks);
    let current = -1;
    let nowText;
    let nextText;
    if (!live) {
      nowText = at(list[0]);
      nextText = at(list[1]);
    } else if (minute < list[0].from) {
      nowText = 'Not started yet';
      nextText = at(list[0]);
    } else if (minute >= list[finish].from) {
      current = finish;
      nowText = 'All done!';
      nextText = 'Great job!';
    } else {
      current = list.findIndex((step) => minute >= step.from && minute < step.to);
      const next = current >= 0 ? list[current + 1] : list.find((step) => step.from > minute);
      nowText = current >= 0 ? stepLabel(list[current], picks) : 'Free time';
      nextText = at(next);
    }
    el('nowNext').classList.toggle('is-preview', !live);
    el('nowLabel').textContent = live ? 'NOW' : 'FIRST';
    el('nextLabel').textContent = live ? 'NEXT' : 'THEN';
    el('nowText').textContent = nowText;
    el('nextText').textContent = nextText;
    el('timeline').querySelectorAll('.step').forEach((node, index) => node.classList.toggle('is-now', index === current));
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !day) return;
    if (button.dataset.done) {
      const progress = readDayProgress();
      const id = button.dataset.done;
      if (progress.done.has(id)) progress.done.delete(id);
      else progress.done.add(id);
      writeDayProgress(progress);
      button.setAttribute('aria-pressed', String(progress.done.has(id)));
      button.closest('.step').classList.toggle('is-done', progress.done.has(id));
    } else if (button.dataset.choice) {
      const progress = readDayProgress();
      const id = button.dataset.choice;
      if (progress.picks[id] === button.dataset.option) delete progress.picks[id];
      else progress.picks[id] = button.dataset.option;
      writeDayProgress(progress);
      button.closest('.chips').querySelectorAll('.chip').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.option === progress.picks[id])));
      tick();
    } else if (button.dataset.videoStep) {
      const progress = readDayProgress();
      const id = button.dataset.videoStep;
      if (progress.picks[id] === button.dataset.video) delete progress.picks[id];
      else progress.picks[id] = button.dataset.video;
      writeDayProgress(progress);
      button.closest('.videos').querySelectorAll('.vid').forEach((card) => videoCardState(card, progress.picks[id]));
      tick();
    } else if (button.id === 'reset') {
      writeDayProgress({ done: new Set(), picks: {} });
      render();
    }
  });

  // The planner may be open in another tab; show its edits as they save.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== PROGRESS_KEY) return;
    workspace = readWorkspace();
    render();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  // A YouTube still that fails to load (offline, a removed video) falls back to the play tile.
  document.addEventListener('error', (event) => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.matches('.vid .art')) image.outerHTML = '<span class="art art-empty" aria-hidden="true">▶</span>';
  }, true);

  render();
  window.setInterval(tick, 20000);
})();
