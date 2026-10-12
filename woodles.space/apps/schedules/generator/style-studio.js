// The style studio: pick a theme for a learner's visual schedule, then tune its
// colours, fonts, sizes, timeline, stickers, words and celebrations. Edits a
// draft against a live preview; nothing is saved until "Save look".
window.ScheduleStyleStudio = (() => {
  'use strict';
  const { esc } = window.ScheduleStudio;
  const Themes = window.ScheduleThemes;
  const { FONTS, READING_FONTS, THEMES, GROUPS, COLOR_ROLES, OPTIONS, WORDS, EXTRA_STICKERS } = Themes;
  let hooks, dialog, planId = '', draft = null, saved = '', afterSave = null;

  const plan = () => hooks.plans().find((entry) => entry.id === planId) || null;
  const learner = () => plan()?.learner || 'Learner';

  function segmented(name, options, value, label) {
    return '<fieldset class="studio-segmented"><legend>' + esc(label) + '</legend>' + options.map(([key, text]) =>
      '<label><input type="radio" name="' + name + '" value="' + esc(key) + '"' + (key === value ? ' checked' : '') + '><span>' + esc(text) + '</span></label>').join('') + '</fieldset>';
  }
  function select(name, options, value, label, themeLabel) {
    return '<label class="studio-field"><span>' + esc(label) + '</span><select name="' + name + '">' + options.map(([key, text]) =>
      '<option value="' + esc(key) + '"' + (key === value ? ' selected' : '') + '>' + esc(key === '' && themeLabel ? 'Theme default · ' + themeLabel : text) + '</option>').join('') + '</select></label>';
  }
  const optionLabel = (list, key) => (list.find(([value]) => value === key) || [, key])[1];

  function themeCard(theme, current) {
    const c = theme.colors;
    return '<button type="button" class="theme-card" data-studio="theme" data-theme="' + theme.id + '" aria-pressed="' + (theme.id === current) + '">' +
      '<span class="theme-card-art" style="background:linear-gradient(120deg,' + c.heroA + ',' + c.heroB + ')"><span>' + esc(theme.emoji) + '</span></span>' +
      '<span class="theme-card-copy"><strong>' + esc(theme.name) + '</strong><small>' + esc(theme.blurb) + '</small>' +
      '<span class="theme-swatches" aria-hidden="true">' + [c.accent, c.now, c.done, c.pageA, c.card].map((color) => '<i style="background:' + color + '"></i>').join('') + '</span></span></button>';
  }

  function stickerButtons(list, target) {
    return '<div class="sticker-shelf" role="group" aria-label="Quick stickers">' + list.map((value) =>
      '<button type="button" data-studio="sticker" data-target="' + target + '" data-value="' + esc(value) + '" aria-label="Use ' + esc(value) + '">' + esc(value) + '</button>').join('') + '</div>';
  }

  function stickerChoice(name, value, base, plain, plainLabel, look) {
    const stickers = [...new Set([...look.stickers, ...EXTRA_STICKERS])];
    const current = value === 'theme' || value === plain ? '' : value;
    const options = [['theme', 'Theme default · ' + (base === plain ? plainLabel : base)], [plain, plainLabel], ...stickers.map((entry) => [entry, entry])];
    if (current && !stickers.includes(current)) options.push([current, current]);
    return '<select name="' + name + '">' + options.map(([key, text]) => '<option value="' + esc(key) + '"' + (key === value ? ' selected' : '') + '>' + esc(text) + '</option>').join('') + '</select>';
  }

  function controls() {
    const look = Themes.resolve(draft);
    const base = look.theme;
    const c = base.colors;
    const fallback = { accent: c.accent, hero: c.heroA, page: c.pageA, card: c.card, ink: c.ink, now: c.now, done: c.done, track: c.track };
    const current = Object.fromEntries(COLOR_ROLES.map(([role]) => [role, draft.colors[role] || fallback[role]]));
    const others = hooks.plans().filter((entry) => entry.id !== planId && entry.style);
    const warnings = Themes.warnings(look);
    const fontButton = (key, label, sample) => '<button type="button" class="font-card" data-studio="heading-font" data-font="' + esc(key) + '" aria-pressed="' + (draft.headingFont === key) + '">' +
      '<span class="font-sample" style="font-family:' + esc(key ? fontFamily(key) : fontFamily(base.heading)) + '">' + esc(sample) + '</span><small>' + esc(label) + '</small></button>';
    return '' +
      '<section class="studio-section" aria-labelledby="studioThemes"><div class="studio-section-heading"><h3 id="studioThemes">Theme</h3><div class="studio-inline">' +
        '<button type="button" class="button secondary small" data-studio="surprise">🎲 Surprise me</button>' +
        (others.length ? '<label class="studio-copy"><span class="visually-hidden">Copy a look from another plan</span><select data-studio-copy><option value="">Copy a look from…</option>' + others.map((entry) => '<option value="' + esc(entry.id) + '">' + esc(entry.learner + ' · ' + entry.name + ' (' + Themes.theme(entry.style.theme).name + ')') + '</option>').join('') + '</select></label>' : '') +
        '</div></div><p class="muted">Start from something ' + esc(learner()) + ' loves. Every choice below can then be changed.</p>' +
        GROUPS.map(([group, label]) => '<h4>' + esc(label) + '</h4><div class="theme-grid">' + THEMES.filter((theme) => theme.group === group).map((theme) => themeCard(theme, draft.theme)).join('') + '</div>').join('') +
      '</section>' +

      '<section class="studio-section" aria-labelledby="studioColours"><h3 id="studioColours">Colours</h3><div class="colour-grid">' +
        COLOR_ROLES.map(([role, label]) => '<div class="colour-field"><label><input type="color" data-colour="' + role + '" value="' + current[role] + '"><span>' + esc(label) + '</span></label>' +
          (draft.colors[role] ? '<button type="button" class="link-button" data-studio="reset-colour" data-role="' + role + '">Use theme colour</button>' : '<small class="muted">Theme colour</small>') + '</div>').join('') +
        '</div><label class="studio-check"><input type="checkbox" name="highContrast"' + (draft.highContrast ? ' checked' : '') + '><span><strong>High contrast</strong> · black text on white, strong outlines, no background pattern</span></label>' +
        '<div class="studio-warnings" role="status">' + warnings.map((warning) => '<p>⚠ ' + esc(warning) + '</p>').join('') + '</div>' +
      '</section>' +

      '<section class="studio-section" aria-labelledby="studioFonts"><h3 id="studioFonts">Fonts</h3><p class="muted">The banner, times and finish card use the heading font. Activity names and notes use the reading font.</p>' +
        '<div class="font-grid" role="group" aria-label="Heading font">' + fontButton('', 'Theme default · ' + FONTS[base.heading].label, 'Hi ' + learner().slice(0, 12) + '!') +
          Object.entries(FONTS).filter(([key]) => key !== 'system').map(([key, font]) => fontButton(key, font.label, 'Hi ' + learner().slice(0, 12) + '!')).join('') + '</div>' +
        '<label class="studio-field"><span>Reading font</span><select name="bodyFont"><option value="">Theme default · ' + esc(FONTS[base.body].label) + '</option>' +
          '<optgroup label="Designed for easy reading">' + READING_FONTS.map((key) => '<option value="' + key + '"' + (draft.bodyFont === key ? ' selected' : '') + '>' + esc(FONTS[key].label) + '</option>').join('') + '</optgroup>' +
          '<optgroup label="Friendly and rounded">' + Object.entries(FONTS).filter(([key, font]) => font.body && !READING_FONTS.includes(key)).map(([key, font]) => '<option value="' + key + '"' + (draft.bodyFont === key ? ' selected' : '') + '>' + esc(font.label) + '</option>').join('') + '</optgroup></select></label>' +
      '</section>' +

      '<section class="studio-section" aria-labelledby="studioSize"><h3 id="studioSize">Size and shape</h3><div class="studio-two">' +
        segmented('textSize', OPTIONS.textSize, draft.textSize, 'Text size') + segmented('pictureSize', OPTIONS.pictureSize, draft.pictureSize, 'Picture size') +
        select('shape', OPTIONS.shape, draft.shape, 'Card corners', optionLabel(OPTIONS.shape, base.shape)) + segmented('borders', OPTIONS.borders, draft.borders, 'Outlines') +
      '</div></section>' +

      '<section class="studio-section" aria-labelledby="studioTrack"><h3 id="studioTrack">Background and timeline</h3><div class="studio-two">' +
        select('pattern', OPTIONS.pattern, draft.pattern, 'Background pattern', optionLabel(OPTIONS.pattern, base.pattern)) + segmented('patternStrength', OPTIONS.patternStrength, draft.patternStrength, 'Pattern strength') +
        select('track', OPTIONS.track, draft.track, 'Timeline track', optionLabel(OPTIONS.track, base.track)) +
        '<label class="studio-field"><span>Marker on the current activity</span>' + stickerChoice('marker', draft.marker, base.marker, 'dot', 'A plain dot', look) + '</label>' +
      '</div></section>' +

      '<section class="studio-section" aria-labelledby="studioStickers"><h3 id="studioStickers">Stickers</h3>' +
        segmented('scene', OPTIONS.scene, draft.scene, 'Banner stickers') +
        (draft.scene === 'custom' ? '<div class="mascot-fields">' + [0, 1, 2].map((index) => '<label class="studio-field"><span>Sticker ' + (index + 1) + '</span><input data-mascot="' + index + '" maxlength="16" value="' + esc(draft.mascots[index] || '') + '" placeholder="' + esc(base.mascots[index] || '⭐') + '"></label>').join('') + '</div>' +
          stickerButtons([...new Set([...look.stickers, ...EXTRA_STICKERS])], 'mascot') + '<p class="muted">Type or paste any emoji, or tap one above to fill the next sticker.</p>' : '') +
        '<label class="studio-field"><span>Stamp when an activity is done</span>' + stickerChoice('stamp', draft.stamp, base.stamp, 'check', 'A check mark', look) + '</label>' +
      '</section>' +

      '<section class="studio-section" aria-labelledby="studioWords"><h3 id="studioWords">Words</h3><p class="muted">Leave blank for the theme’s words. <code>{name}</code> becomes “' + esc(learner()) + '”.</p><div class="studio-two">' +
        WORDS.map(([key, label, max]) => '<label class="studio-field"><span>' + esc(label) + '</span><input data-word="' + key + '" maxlength="' + max + '" value="' + esc(draft.words[key]) + '" placeholder="' + esc(base.words[key]) + '"></label>').join('') +
      '</div></section>' +

      '<section class="studio-section" aria-labelledby="studioMotion"><h3 id="studioMotion">Movement and celebrations</h3><div class="studio-two">' +
        select('celebrate', OPTIONS.celebrate, draft.celebrate, 'When an activity is checked off', optionLabel(OPTIONS.celebrate, base.celebrate)) +
        select('motion', OPTIONS.motion, draft.motion, 'Banner stickers and markers', optionLabel(OPTIONS.motion, base.motion)) +
      '</div><p class="muted">Devices set to reduce motion always stay still.</p></section>';
  }

  function fontFamily(key) {
    const font = FONTS[key] || FONTS.nunito;
    return (font.family ? '"' + font.family + '", ' : '') + font.fallback;
  }

  function previewMarkup(look) {
    const name = learner();
    const w = look.words;
    const step = (time, icon, title, color, state) => '<li class="lp-step' + (state ? ' is-' + state : '') + '"><span class="lp-time">' + time +
      (state === 'now' && look.marker ? '<i class="lp-marker">' + esc(look.marker) + '</i>' : '<i class="lp-dot"></i>') + '</span>' +
      '<span class="lp-box" style="--activity-color:' + color + '">' + (state === 'now' ? '<span class="lp-nowtag">' + esc(w.now) + '</span>' : '') +
      '<span class="lp-visual">' + icon + '</span><span class="lp-title">' + title + '</span><span class="lp-done">' + (state === 'done' ? (look.stamp ? esc(look.stamp) : '✓') : '') + '</span></span></li>';
    return '<div class="lp-hero"><div class="lp-hero-copy"><small>' + esc(w.kicker) + '</small><strong>' + esc(Themes.fill(w.greeting, name)) + '</strong><span class="lp-clock">Now: 9:20</span></div>' +
      '<div class="lp-scene" aria-hidden="true">' + (look.scene === 'tickets' ? '<span class="mascot mascot-1">🎟️</span><span class="mascot mascot-2">⭐</span>' : Themes.mascotMarkup(look)) + '</div></div>' +
      '<div class="lp-nownext"><span class="lp-nn now"><small>' + esc(w.now) + '</small><b>Read a book</b></span><span class="lp-nn"><small>' + esc(w.next) + '</small><b>9:40 Snack</b></span></div>' +
      '<ol class="lp-timeline">' + step('9:00', '🧩', 'Puzzle', '#32845f', 'done') + step('9:15', '📖', 'Read a book', '#3978c7', 'now') + step('9:40', '🍎', 'Snack', '#d27b32', '') +
      '<li class="lp-step lp-finish"><span class="lp-time">10:00<i class="lp-dot"></i></span><span class="lp-box"><strong>' + esc(w.finishTitle) + '</strong><small>' + esc(Themes.fill(w.finishMessage, name)) + '</small></span></li></ol>';
  }

  function renderPreview() {
    const node = dialog.querySelector('.look-preview');
    if (!node) return;
    const look = Themes.resolve(draft);
    Themes.paint(node, look);
    node.innerHTML = previewMarkup(look);
    const warnings = dialog.querySelector('.studio-warnings');
    if (warnings) warnings.innerHTML = Themes.warnings(look).map((warning) => '<p>⚠ ' + esc(warning) + '</p>').join('');
    const dirty = JSON.stringify(draft) !== saved;
    dialog.querySelector('[data-studio="save"]').disabled = !dirty;
  }

  function render(focusSelector) {
    const scroller = dialog.querySelector('.studio-controls');
    const top = scroller ? scroller.scrollTop : 0;
    const name = learner();
    dialog.innerHTML = '<div class="studio-shell"><div class="studio-heading"><div><span class="eyebrow">Visual schedule · ' + esc(plan()?.name || '') + '</span><h2 id="styleStudioTitle">Style ' + esc(name) + '’s schedule</h2></div><button class="icon-button" type="button" data-studio="close" aria-label="Close style studio">×</button></div>' +
      '<div class="studio-layout"><div class="studio-controls">' + controls() + '</div>' +
      '<aside class="studio-preview-wrap" aria-label="Preview"><div class="look-preview"></div><p class="muted">A preview of ' + esc(name) + '’s view. Published links pick up the new look the next time you publish.</p></aside></div>' +
      '<div class="studio-actions"><button type="button" class="button secondary danger" data-studio="reset-all">Start over with Bright sky</button><span></span><button type="button" class="button secondary" data-studio="close">Cancel</button><button type="button" class="button primary" data-studio="save">Save look</button></div></div>';
    dialog.querySelector('.studio-controls').scrollTop = top;
    renderPreview();
    if (focusSelector) dialog.querySelector(focusSelector)?.focus({ preventScroll: true });
  }

  function setTheme(id) {
    // A new theme brings its own colours and words; sizes, fonts and comfort settings stay.
    draft = Themes.sanitizeStyle({ ...draft, theme: id, colors: {}, words: {}, scene: draft.scene === 'none' ? 'none' : 'theme', mascots: [], stamp: 'theme', marker: 'theme', pattern: '', track: '', shape: '' });
  }

  function setup(options) {
    hooks = options;
    dialog = document.createElement('dialog');
    dialog.className = 'style-studio-dialog';
    dialog.setAttribute('aria-labelledby', 'styleStudioTitle');
    document.body.append(dialog);
    dialog.addEventListener('close', () => { dialog.innerHTML = ''; draft = null; });
    dialog.addEventListener('cancel', (event) => {
      if (draft && JSON.stringify(draft) !== saved && !window.confirm('Close without saving this look?')) event.preventDefault();
    });
    dialog.addEventListener('click', (event) => {
      const button = event.target.closest('[data-studio]');
      if (!button || !draft) return;
      const action = button.dataset.studio;
      if (action === 'close') {
        if (JSON.stringify(draft) !== saved && !window.confirm('Close without saving this look?')) return;
        dialog.close(); return;
      }
      if (action === 'save') {
        const style = Themes.sanitizeStyle(draft);
        if (hooks.save(planId, style)) { saved = JSON.stringify(style); const done = afterSave; dialog.close(); done?.(style); }
        return;
      }
      if (action === 'theme') { setTheme(button.dataset.theme); render('[data-theme="' + button.dataset.theme + '"]'); return; }
      if (action === 'surprise') {
        const choices = THEMES.filter((theme) => theme.id !== draft.theme);
        setTheme(choices[Math.floor(Math.random() * choices.length)].id);
        render('[data-studio="surprise"]'); return;
      }
      if (action === 'reset-colour') { draft.colors[button.dataset.role] = ''; render('[data-colour="' + button.dataset.role + '"]'); return; }
      if (action === 'heading-font') { draft.headingFont = button.dataset.font; render('[data-studio="heading-font"][data-font="' + button.dataset.font + '"]'); return; }
      if (action === 'reset-all') {
        if (!window.confirm('Reset every style choice for this plan?')) return;
        draft = Themes.sanitizeStyle({}); render('[data-studio="reset-all"]'); return;
      }
      if (action === 'sticker') {
        const slots = [...draft.mascots];
        if (slots.length >= 3) slots.shift();
        slots.push(button.dataset.value);
        draft.mascots = slots;
        render('[data-studio="sticker"][data-value="' + CSS.escape(button.dataset.value) + '"]');
      }
    });
    // Typing and dragging colour pickers only repaint the preview, so focus and the caret stay put.
    dialog.addEventListener('input', (event) => {
      const input = event.target;
      if (!draft) return;
      if (input.dataset.colour) { draft.colors[input.dataset.colour] = input.value.toLowerCase(); renderPreview(); }
      else if (input.dataset.word) { draft.words[input.dataset.word] = input.value; renderPreview(); }
      else if (input.dataset.mascot) {
        const slots = [0, 1, 2].map((index) => index === Number(input.dataset.mascot) ? input.value : draft.mascots[index] || '');
        draft.mascots = slots.map((value) => value.trim()).filter(Boolean);
        renderPreview();
      }
    });
    dialog.addEventListener('change', (event) => {
      const input = event.target;
      if (!draft) return;
      if (input.matches('[data-studio-copy]')) {
        const source = hooks.plans().find((entry) => entry.id === input.value);
        if (source?.style) { draft = Themes.sanitizeStyle(source.style); render('[data-studio-copy]'); }
        return;
      }
      if (input.dataset.colour) { render('[data-colour="' + input.dataset.colour + '"]'); return; }
      if (input.dataset.word || input.dataset.mascot) { draft = Themes.sanitizeStyle(draft); return; }
      if (!input.name) return;
      draft[input.name] = input.type === 'checkbox' ? input.checked : input.value;
      draft = Themes.sanitizeStyle(draft);
      render(input.type === 'radio' ? '[name="' + input.name + '"]:checked' : '[name="' + input.name + '"]');
    });
  }

  function open(id, onSaved) {
    const target = hooks.plans().find((entry) => entry.id === id);
    if (!target || !dialog || dialog.open) return;
    planId = id; afterSave = onSaved || null;
    draft = Themes.sanitizeStyle(target.style || {});
    saved = JSON.stringify(draft);
    Themes.loadFonts(Object.keys(FONTS), 'styleStudioFonts');
    dialog.showModal();
    render('[data-theme="' + draft.theme + '"]');
  }

  return { setup, open };
})();
