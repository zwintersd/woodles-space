// Publishing metadata is local; passwords, sessions and protected snapshots
// are never written to localStorage. The server owns publication state.
window.SchedulePublishing = (() => {
  'use strict';
  const { esc, DAY_KEYS, itemImageIds } = window.ScheduleStudio;
  const LINKS_KEY = 'woodles.schedule-publications.v1';
  let hooks, dialog, draft, selected, publications = [], days = [], message = '', busy = false, ready = false, authenticated = false, history = [], preview = null, withdrawal = false;
  const link = (id) => location.origin + '/schedules/p/' + id;
  async function request(query, body) {
    const encoded = body ? JSON.stringify(body) : '';
    if (encoded && new TextEncoder().encode(encoded).length > 3750000) throw new Error('This plan is too large to publish. Use smaller uploaded pictures.');
    const response = await fetch('/api/schedules' + (query ? '?' + new URLSearchParams(query) : ''), {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      ...(body ? { headers: { 'content-type': 'application/json' }, body: encoded } : {})
    });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Could not reach publishing.'); error.status = response.status; throw error; }
    return result;
  }
  function snapshot(plan, workspace, selectedDays) {
    const chosen = new Set(selectedDays);
    const clean = (item) => {
      const value = JSON.parse(JSON.stringify(item));
      delete value.sourceId; delete value.poolId; delete value._placementIssue;
      for (const field of ['steps', 'options', 'videos', 'candidates']) if (value[field]) value[field] = value[field].filter(entry => field !== 'candidates' || entry.enabled !== false).map(clean);
      return value;
    };
    const shown = plan.days.filter(day => !day.removed && chosen.has(day.key)).map(day => ({ key: day.key, start: day.start, end: day.end,
      activities: day.activities.filter(item => !item.ghost).map(clean) }));
    const ids = new Set(shown.flatMap(day => day.activities.flatMap(itemImageIds)));
    return { schemaVersion: 1, plan: { id: plan.id, learner: plan.learner, name: plan.name, days: shown },
      images: workspace.images.filter(image => ids.has(image.id)).map(image => ({ id: image.id, data: image.data })) };
  }
  function savedLinks() {
    try {
      const value = JSON.parse(localStorage.getItem(LINKS_KEY) || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry && /^[a-f0-9]{32}$/.test(entry.id) && Number.isInteger(entry.version) && Array.isArray(entry.days)));
    } catch { return {}; }
  }
  async function fingerprint(payload) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function remember(publication, hash) {
    if (!draft) return;
    const entries = savedLinks();
    entries[draft.id] = { id: publication.id, version: publication.version, days: [...days], fingerprint: hash || '' };
    try { localStorage.setItem(LINKS_KEY, JSON.stringify(entries)); } catch { /* the cloud publication is still saved */ }
  }
  function summary(payload) {
    return '<div class="publish-preview">' + payload.plan.days.map(day => '<details><summary>' + esc(DAY_KEYS.find(entry => entry[0] === day.key)?.[1] || day.key) + ' · ' + esc(day.start) + '–' + esc(day.end) + ' · ' + day.activities.length + ' item' + (day.activities.length === 1 ? '' : 's') + '</summary><ol>' + day.activities.map(item => '<li><span>' + esc(item.start) + ' · ' + item.duration + ' min</span> ' + esc(item.title || ({ choice: 'Choice', video: 'Video', 'open-slot': 'Open time' }[item.kind]) || 'Activity') + '</li>').join('') + '</ol></details>').join('') + '</div>';
  }
  function localExpiry(value) { return value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''; }
  function accessFields() {
    return '<div class="publish-fields"><label>Learner password<input name="learnerPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" ' + (!selected ? 'required' : '') + ' placeholder="' + (selected ? 'Leave blank to keep the current password' : 'At least 8 characters') + '"></label><label>Link expires (optional)<input name="expiresAt" type="datetime-local" value="' + esc(localExpiry(selected?.expiresAt)) + '"></label></div><p class="publish-hint">Every learner link needs a password. Share the password separately. Changing it locks existing learner sessions.</p>';
  }
  function render() {
    if (!dialog?.open) return;
    const disclosures = [...dialog.querySelectorAll('.publish-access[open], .publish-history[open]')].map(node => node.className);
    const title = draft ? 'Publish ' + draft.learner + '’s plan' : selected ? 'Manage published plan' : 'Published plans';
    let body;
    if (!ready) body = '<p>Publishing needs the site database and a publisher passphrase. See the publishing setup guide for this site.</p>';
    else if (!authenticated) body = '<form data-publish-form="login"><p>Use the site owner’s publisher passphrase to manage protected learner links.</p><label>Publisher passphrase<input name="password" type="password" required maxlength="256" autocomplete="current-password"></label><button class="button primary" type="submit">Unlock publishing</button></form>';
    else if (draft || selected) {
      const expired = selected?.expiresAt && Date.parse(selected.expiresAt) <= Date.now();
      const status = selected ? !selected.active ? 'Withdrawn · learners cannot open this link' : expired ? 'Expired · learners cannot open this link' : 'Live · password protected' : 'Draft · no learner link yet';
      let payload;
      if (draft) payload = snapshot(draft, hooks.getWorkspace(), days);
      body = '<p class="publish-status">' + esc(status) + (selected ? ' · Version ' + selected.version : '') + '</p>' +
        (selected ? '<label>Learner link<input class="publish-link" readonly value="' + esc(link(selected.id)) + '"></label><div class="publish-actions"><button class="button secondary" data-pub="copy">Copy learner link</button><a class="button secondary" href="' + esc(link(selected.id)) + '" target="_blank" rel="noopener">Open learner view</a></div>' : '') +
        (draft ? '<form data-publish-form="publish"><fieldset class="publish-days"><legend>Days to publish</legend>' + draft.days.filter(day => !day.removed).map(day => '<label><input type="checkbox" name="day" value="' + day.key + '" ' + (days.includes(day.key) ? 'checked' : '') + '>' + esc(day.label) + '</label>').join('') + '</fieldset><p class="publish-hint">Only these days and their active items are shared. Ghosts, hidden days, other plans and library content are excluded.</p><div id="publishPreview">' + summary(payload) + '</div><p id="publishDifference" class="publish-hint"></p>' + accessFields() + '<div class="publish-actions"><button class="button primary" type="submit">' + (selected ? 'Publish updated plan' : 'Publish learner link') + '</button></div><p class="publish-hint">Local edits stay on this device until you publish again.</p></form>' : '<h3>' + esc(selected.learner) + ' · ' + esc(selected.name) + '</h3><p>' + selected.days + ' days · ' + selected.items + ' items</p><button class="button secondary" data-pub="import">Make an editable local copy</button>') +
        (selected ? '<details class="publish-access"><summary>Password and expiry</summary><form data-publish-form="access">' + accessFields() + '<button class="button secondary" type="submit">Save access settings</button></form></details><details class="publish-history"><summary>Published versions</summary><button class="button secondary" data-pub="history">Load version history</button><div>' + history.map(entry => '<div class="publish-version"><span>Version ' + entry.version + ' · ' + esc(new Date(entry.publishedAt).toLocaleString()) + '</span><button class="button secondary" data-pub="preview-version" data-version="' + entry.version + '">Preview version ' + entry.version + '</button></div>').join('') + '</div>' + (preview ? '<h4>Version ' + preview.version + '</h4>' + summary(preview.payload) + '<button class="button primary" data-pub="restore" data-version="' + preview.version + '">Publish version ' + preview.version + ' again</button><p class="publish-hint">This restores the published content on the same link. Your local draft stays as it is.</p>' : '') + '</details>' +
          (selected.active ? '<div class="publish-withdraw">' + (withdrawal ? '<p>Withdraw this link? Learners will lose access, and the saved versions will remain here.</p><button class="button danger" data-pub="confirm-withdraw">Yes, withdraw learner link</button><button class="button secondary" data-pub="cancel-withdraw">Keep link live</button>' : '<button class="button secondary danger" data-pub="withdraw">Withdraw learner link</button>') + '</div>' : '') : '') +
      '<div class="publish-actions"><button class="button secondary" data-pub="catalogue">All published plans</button></div>';
    } else body = '<p>Protected learner links and their saved versions. Make a local copy to edit a plan on this device.</p>' + (publications.length ? '<div class="publish-catalogue">' + publications.map(entry => '<button data-pub="select" data-id="' + entry.id + '"><strong>' + esc(entry.learner) + '</strong><span>' + esc(entry.name) + '</span><small>' + (entry.active ? entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now() ? 'Expired' : 'Live' : 'Withdrawn') + ' · Version ' + entry.version + '</small></button>').join('') + '</div>' : '<p>No plans have been published yet. Open a local plan and choose Publish.</p>');
    dialog.innerHTML = '<div class="publish-shell"><div class="publish-heading"><h2 id="publishingTitle">' + esc(title) + '</h2><button class="icon-button" data-pub="close" aria-label="Close publishing">×</button></div>' +
      '<p class="publish-message" role="status" tabindex="-1">' + esc(message) + '</p><div class="publish-body" ' + (busy ? 'inert' : '') + '>' + body + '</div>' + (authenticated ? '<div class="publish-session"><span>Publisher access lasts up to 8 hours.</span><button class="button secondary" data-pub="logout">Lock publishing</button></div>' : '') + '</div>';
    dialog.setAttribute('aria-busy', String(busy));
    disclosures.forEach(name => { const node = dialog.querySelector('.' + name); if (node) node.open = true; });
    if (draft && authenticated && ready) updateDifference();
  }
  async function updateDifference() {
    const node = dialog.querySelector('#publishDifference'); if (!node || !draft) return;
    const payload = snapshot(draft, hooks.getWorkspace(), days);
    const cached = savedLinks()[draft.id];
    const hash = await fingerprint(payload);
    if (!node.isConnected) return;
    node.textContent = cached && selected && cached.id === selected.id && cached.version < selected.version ? 'This link was updated elsewhere. Review the current Published version before replacing it.' : cached && selected && cached.id === selected.id && cached.version === selected.version && cached.fingerprint === hash ? 'This draft matches the version you last published here.' : selected ? 'Review this draft before replacing the live version.' : 'Review the days and items above before publishing.';
  }
  async function refresh() {
    publications = (await request({ action: 'list' })).publications;
    selected = selected ? publications.find(entry => entry.id === selected.id) || null : draft ? publications.find(entry => entry.id === savedLinks()[draft.id]?.id) || publications.find(entry => entry.sourceId === draft.id) || null : null;
  }
  async function run(work, success) {
    if (busy) return;
    busy = true; message = 'Working…'; render();
    try { await work(); message = success || ''; }
    catch (error) { message = error.message; if (error.status === 401) authenticated = false; if (error.status === 409) await refresh().catch(() => {}); }
    finally { busy = false; render(); dialog.querySelector('.publish-message')?.focus(); }
  }
  function setup(options) {
    hooks = options;
    dialog = document.createElement('dialog'); dialog.className = 'publishing-dialog'; dialog.setAttribute('aria-labelledby', 'publishingTitle'); document.body.append(dialog);
    dialog.addEventListener('close', () => { dialog.innerHTML = ''; draft = null; preview = null; });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('change', event => {
      if (event.target.name !== 'day') return;
      days = [...dialog.querySelectorAll('[name="day"]:checked')].map(input => input.value);
      dialog.querySelector('#publishPreview').innerHTML = summary(snapshot(draft, hooks.getWorkspace(), days)); updateDifference();
    });
    dialog.addEventListener('submit', event => {
      const form = event.target.closest('[data-publish-form]'); if (!form) return; event.preventDefault();
      const action = form.dataset.publishForm;
      const password = form.elements[action === 'login' ? 'password' : 'learnerPassword'].value;
      form.elements[action === 'login' ? 'password' : 'learnerPassword'].value = '';
      const expiresAt = form.elements.expiresAt?.value ? new Date(form.elements.expiresAt.value).toISOString() : null;
      const payload = action === 'publish' ? snapshot(draft, hooks.getWorkspace(), days) : null;
      run(async () => {
        if (action === 'login') { await request(null, { action, password }); authenticated = true; await refresh(); return; }
        const result = await request(null, { action, id: selected?.id, baseVersion: selected?.version || 0, sourceId: draft?.id, password, expiresAt, ...(payload ? { payload } : {}) });
        selected = result.publication; remember(selected, payload ? await fingerprint(payload) : savedLinks()[draft?.id]?.fingerprint); history = []; preview = null; await refresh();
      }, action === 'login' ? 'Publishing unlocked.' : action === 'publish' ? 'Published. The learner link requires its password.' : 'Access settings saved.');
    });
    dialog.addEventListener('click', event => {
      const button = event.target.closest('[data-pub]'); if (!button) return;
      const action = button.dataset.pub;
      if (busy) return;
      if (action === 'close') { dialog.close(); return; }
      if (action === 'withdraw' || action === 'cancel-withdraw') { withdrawal = action === 'withdraw'; render(); return; }
      run(async () => {
        if (action === 'copy') { await navigator.clipboard.writeText(link(selected.id)); return; }
        if (action === 'logout') { await request(null, { action: 'logout' }); authenticated = false; publications = []; selected = null; preview = null; history = []; return; }
        if (action === 'catalogue') { draft = null; selected = null; history = []; preview = null; await refresh(); return; }
        if (action === 'select') { selected = publications.find(entry => entry.id === button.dataset.id); history = []; preview = null; withdrawal = false; return; }
        if (action === 'history') { history = (await request({ action: 'history', id: selected.id })).revisions; return; }
        if (action === 'preview-version') { const detail = await request({ action: 'detail', id: selected.id, revision: button.dataset.version }); preview = { version: Number(button.dataset.version), payload: detail.payload }; return; }
        if (action === 'import') {
          const detail = await request({ action: 'detail', id: selected.id }); draft = hooks.importDraft(detail.payload);
          days = detail.payload.plan.days.map(day => day.key); remember(selected, await fingerprint(snapshot(draft, hooks.getWorkspace(), days)));
          dialog.close(); return;
        }
        if (action === 'confirm-withdraw' || action === 'restore') {
          selected = (await request(null, { action: action === 'restore' ? 'restore' : 'unpublish', id: selected.id, baseVersion: selected.version, ...(action === 'restore' ? { revision: Number(button.dataset.version) } : {}) })).publication;
          withdrawal = false; preview = null; history = []; remember(selected); await refresh();
        }
      }, ({ copy: 'Learner link copied. Share its password separately.', 'confirm-withdraw': 'Learner link withdrawn.', restore: 'Saved version published again.' })[action]);
    });
  }
  async function open(plan) {
    if (!dialog || dialog.open) return;
    draft = plan ? JSON.parse(JSON.stringify(plan)) : null; selected = null; publications = []; history = []; preview = null; withdrawal = false;
    days = draft ? savedLinks()[draft.id]?.days?.filter(key => draft.days.some(day => day.key === key && !day.removed)) || draft.days.filter(day => !day.removed).map(day => day.key) : [];
    message = 'Connecting to publishing…'; ready = false; authenticated = false; dialog.showModal(); render();
    await run(async () => { const status = await request({ action: 'status' }); ready = status.configured; authenticated = status.authenticated; if (authenticated) await refresh(); });
    dialog.querySelector('input')?.focus();
  }
  return { request, snapshot, setup, open, link };
})();
