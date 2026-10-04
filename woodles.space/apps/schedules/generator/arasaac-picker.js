// Uses the same public word-search endpoint as the existing /schedules/9-25 builder.
window.ScheduleArasaacPicker = {
  create() {
    const S = window.ScheduleStudio;
    const dialog = document.createElement('dialog');
    dialog.id = 'arasaacDialog';
    dialog.className = 'dialog activity-dialog arasaac-dialog';
    dialog.setAttribute('aria-labelledby', 'arasaacHeading');
    dialog.innerHTML = '<div class="dialog-heading dialog-content"><div><h2 id="arasaacHeading">Search ARASAAC symbols</h2><p class="muted">Search a word or short phrase, then choose a picture.</p></div><button class="icon-button" type="button" data-arasaac-close aria-label="Close ARASAAC search">×</button></div>' +
      '<div class="arasaac-content"><form id="arasaacSearchForm" class="arasaac-search"><label class="field"><span>Find a symbol</span><input id="arasaacSearch" type="search" maxlength="100" autocomplete="off" placeholder="e.g., wash hands, toys, snack"></label><button class="button primary" type="submit">Search</button></form>' +
      '<p id="arasaacStatus" role="status" aria-live="polite"></p><div id="arasaacResults" class="arasaac-results" role="group" aria-label="ARASAAC search results"></div>' +
      '<p class="arasaac-credit">Pictograms by Sergio Palao · <a href="https://arasaac.org" target="_blank" rel="noopener noreferrer">ARASAAC</a> · Government of Aragón · <a href="https://aulaabierta.arasaac.org/en/terms-of-use" target="_blank" rel="noopener noreferrer">CC BY-NC-SA</a>.</p></div>';
    document.body.appendChild(dialog);
    const input = dialog.querySelector('#arasaacSearch');
    const results = dialog.querySelector('#arasaacResults');
    const status = dialog.querySelector('#arasaacStatus');
    let target = null;
    let request = null;
    let timer;
    let version = 0;
    let symbols = [];
    const cache = new Map();
    function cancelSearch() {
      clearTimeout(timer);
      request?.abort();
      version++;
      results.setAttribute('aria-busy', 'false');
    }
    function render(items, total) {
      symbols = items;
      results.innerHTML = items.map((item) => '<button class="arasaac-result" type="button" data-arasaac-id="' + item.id + '" aria-label="Use ' + S.esc(item.label) + ' (ARASAAC ' + item.id + ')"><img src="' + S.pictogramSource(item.id) + '" width="72" height="72" alt="" loading="lazy"><span>' + S.esc(item.label) + '</span></button>').join('');
      status.textContent = items.length ? (total > items.length ? 'Showing the first ' + items.length + ' matches. Narrow your search for more specific pictures.' : items.length + ' pictograms. Choose one to use it.') : 'No pictograms found. Try a shorter word or another name.';
    }
    async function search() {
      cancelSearch();
      const query = input.value.trim();
      results.replaceChildren(); symbols = [];
      if (query.length < 2) { status.textContent = 'Type at least two letters to search.'; return; }
      const cacheKey = query.toLowerCase();
      if (cache.has(cacheKey)) { const saved = cache.get(cacheKey); render(saved.items, saved.total); return; }
      const current = version;
      const controller = new AbortController(); request = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      status.textContent = 'Searching ARASAAC…'; results.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch('https://api.arasaac.org/v1/pictograms/en/bestsearch/' + encodeURIComponent(query), { signal: controller.signal });
        // ARASAAC returns 404 with [] when a word or phrase has no matches.
        if (!response.ok && response.status !== 404) throw new Error('Search returned ' + response.status);
        const data = await response.json();
        if (current !== version || !dialog.open) return;
        if (!Array.isArray(data)) throw new Error('Invalid search response');
        const ids = new Set();
        const matches = data.flatMap((result) => {
          if (!result || typeof result !== 'object') return [];
          const id = String(result._id ?? result.id ?? '');
          if (!/^\d{1,10}$/.test(id) || ids.has(id)) return [];
          ids.add(id);
          const keywords = Array.isArray(result.keywords) ? result.keywords : [];
          const label = S.cleanText(keywords.find((word) => word?.type === 'noun' || Number(word?.type) === 2)?.keyword || keywords[0]?.keyword || result.name, 100, 'Pictogram ' + id);
          return [{ id, label }];
        });
        const saved = { items: matches.slice(0, 40), total: matches.length };
        if (cache.size >= 50) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, saved); render(saved.items, saved.total);
      } catch {
        if (current !== version || !dialog.open) return;
        status.textContent = 'ARASAAC search is unavailable right now. Try Search again, or enter an ID or image URL in the editor.';
        results.innerHTML = '<a class="button secondary" href="https://arasaac.org/pictograms/search/' + encodeURIComponent(query) + '" target="_blank" rel="noopener noreferrer">Browse ARASAAC ↗</a>';
      } finally {
        clearTimeout(timeout);
        if (current === version) results.setAttribute('aria-busy', 'false');
      }
    }
    function open(pickTarget) {
      cancelSearch(); target = pickTarget;
      input.value = S.cleanText(pickTarget.query, 100, '');
      results.replaceChildren(); symbols = [];
      status.textContent = 'Type a word or short phrase to search.';
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      input.focus(); input.select();
      if (input.value.trim().length >= 2) search();
    }
    dialog.querySelector('#arasaacSearchForm').addEventListener('submit', (event) => { event.preventDefault(); search(); });
    input.addEventListener('input', () => {
      cancelSearch(); symbols = []; results.replaceChildren();
      status.textContent = input.value.trim().length >= 2 ? 'Searching ARASAAC…' : 'Type at least two letters to search.';
      if (input.value.trim().length >= 2) timer = setTimeout(search, 350);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-arasaac-close]')) { dialog.close(); return; }
      const button = event.target.closest('[data-arasaac-id]');
      const symbol = symbols.find((item) => item.id === button?.dataset.arasaacId);
      if (symbol && target) { target.choose(symbol.id); dialog.close(); }
    });
    // Cancel synchronously as well as on close, so stale responses cannot reach a reopened picker.
    dialog.addEventListener('cancel', cancelSearch);
    dialog.addEventListener('close', () => { cancelSearch(); target = null; });
    return { open };
  }
};
