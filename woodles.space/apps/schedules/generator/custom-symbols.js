// Reusable local sprite library. Chosen symbols carry their own saved image
// references so removing a library entry never breaks a schedule that uses it.
window.ScheduleSymbolLibrary = {
  create({ workspace, save }) {
    const S = window.ScheduleStudio;
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog activity-dialog custom-symbol-dialog';
    dialog.id = 'customSymbolDialog';
    dialog.setAttribute('aria-labelledby', 'customSymbolHeading');
    document.body.appendChild(dialog);
    let target = null;
    let editing = '';
    let busy = false;
    const status = (message) => { dialog.querySelector('#customSymbolStatus').textContent = message; };
    const uniqueName = (raw, symbols) => {
      const base = String(raw).toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 34) || 'symbol';
      let name = base;
      for (let n = 2; symbols.some((entry) => entry.symbolName === name); n++) name = base + '_' + n;
      return name;
    };
    function commit(symbols, images) {
      const state = workspace();
      const oldSymbols = state.customSymbols;
      const oldImages = state.images;
      state.customSymbols = symbols;
      state.images = images;
      if (save()) return true;
      state.customSymbols = oldSymbols;
      state.images = oldImages;
      status('This browser could not save the library. Export a backup or free storage before adding more symbols.');
      return false;
    }
    function renderGrid() {
      const state = workspace();
      const query = dialog.querySelector('#customSymbolSearch').value.toLowerCase().trim().replace(/^:|:$/g, '');
      const group = dialog.querySelector('#customSymbolGroup').value;
      const groups = [...new Set(state.customSymbols.map((entry) => entry.group))].sort();
      dialog.querySelector('#customSymbolGroup').innerHTML = '<option value="">All groups</option>' + groups.map((name) => '<option' + (name === group ? ' selected' : '') + '>' + S.esc(name) + '</option>').join('');
      const activeGroup = groups.includes(group) ? group : '';
      const symbols = state.customSymbols.filter((entry) => (!activeGroup || entry.group === activeGroup) && (!query || (entry.symbolName + ' ' + entry.group).toLowerCase().includes(query)));
      dialog.querySelector('#customSymbolGrid').innerHTML = symbols.map((entry) => '<article class="custom-symbol-card"><button class="custom-symbol-pick" type="button" data-library-action="' + (target ? 'pick' : 'edit') + '" data-id="' + S.esc(entry.id) + '" aria-label="' + (target ? 'Use' : 'Edit') + ' :' + S.esc(entry.symbolName) + ':"><span class="custom-symbol-checker" aria-hidden="true">' + S.customSymbolMarkup(entry, state.images, 48) + '</span><strong>:' + S.esc(entry.symbolName) + ':</strong><small>' + S.esc(entry.group) + '</small></button><div class="custom-symbol-card-actions"><button class="button secondary" type="button" data-library-action="edit" data-id="' + S.esc(entry.id) + '" aria-label="Edit :' + S.esc(entry.symbolName) + ':">Edit</button><button class="button secondary" type="button" data-library-action="remove" data-id="' + S.esc(entry.id) + '" aria-label="Remove :' + S.esc(entry.symbolName) + ': from library">Remove</button></div></article>').join('') || '<p class="custom-symbol-empty">' + (state.customSymbols.length ? 'No symbols match. Try another name or group.' : 'Your custom symbols will appear here. Upload one sprite or several at once.') + '</p>';
      dialog.querySelector('#customSymbolCount').textContent = symbols.length + ' shown · ' + state.customSymbols.length + ' in your library';
      dialog.querySelector('#customSymbolExport').disabled = !state.customSymbols.length;
      dialog.querySelectorAll('[data-library-action], #customSymbolUpload, #customSymbolImport').forEach((node) => { node.disabled = busy; });
    }
    function renderEditor() {
      const entry = workspace().customSymbols.find((symbol) => symbol.id === editing);
      const host = dialog.querySelector('#customSymbolEdit');
      host.innerHTML = entry ? '<form id="customSymbolEditor" class="custom-symbol-edit"><h3>Edit :' + S.esc(entry.symbolName) + ':</h3><div class="suggestion-settings"><label class="field"><span>Symbol name</span><input name="symbolName" maxlength="40" pattern="[a-z0-9_]+" required value="' + S.esc(entry.symbolName) + '"><small class="muted">Lowercase letters, numbers, and underscores.</small></label><label class="field"><span>Group</span><input name="group" maxlength="60" value="' + S.esc(entry.group) + '"></label><label class="field full"><span>Artist or image credit (optional)</span><input name="symbolCredit" maxlength="200" value="' + S.esc(entry.symbolCredit) + '"></label></div><label class="check-field"><input name="symbolPixelated" type="checkbox"' + (entry.symbolPixelated ? ' checked' : '') + '><span>Keep pixel art crisp</span></label><div class="button-row"><button class="button primary" type="submit">Save symbol</button><button class="button secondary" type="button" data-library-action="cancel-edit">Cancel edit</button></div><small class="muted">These settings apply the next time you choose this symbol. Saved activities keep their current symbol.</small></form>' : '';
    }
    function open(pickTarget) {
      target = pickTarget || null;
      editing = '';
      dialog.innerHTML = '<div class="dialog-heading dialog-content"><div><span class="eyebrow">Your sprite library</span><h2 id="customSymbolHeading">' + (target ? 'Choose a custom symbol' : 'Custom symbols') + '</h2><p class="muted">Named sprites you can reuse across activities, steps, choices, and suggestion pools. Saved on this device.</p></div><button class="icon-button" type="button" data-library-action="close" aria-label="Close custom symbols">×</button></div><div class="custom-symbol-content"><fieldset class="choice-composer"><legend>Add your sprites</legend><div class="suggestion-settings"><label class="field"><span>Upload sprites</span><input id="customSymbolUpload" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif"><small class="muted">PNG, WebP, JPG, or GIF. Images become transparent square symbols up to 128 px. Animated GIFs must be 65 KB or smaller.</small></label><label class="field"><span>Group for new uploads</span><input id="customSymbolUploadGroup" maxlength="60" value="My symbols"></label></div><label class="check-field"><input id="customSymbolUploadPixelated" type="checkbox" checked><span>Keep pixel art crisp</span></label></fieldset><div class="custom-symbol-filters"><label class="field"><span>Search your symbols</span><input id="customSymbolSearch" type="search" placeholder="Name or group…"></label><label class="field"><span>Filter by group</span><select id="customSymbolGroup"><option value="">All groups</option></select></label></div><p id="customSymbolCount" class="muted"></p><div id="customSymbolGrid" class="custom-symbol-grid"></div><div id="customSymbolEdit"></div><p id="customSymbolStatus" role="status" aria-live="polite"></p><div class="button-row"><button id="customSymbolExport" class="button secondary" type="button" data-library-action="export">Export symbol library</button><label class="button secondary custom-symbol-import">Import symbol library<input id="customSymbolImport" type="file" accept=".json,application/json"></label></div><small class="muted">GIFs use a still image for printing and reduced-motion preferences. Removing a symbol from this library keeps it in saved schedules.</small></div>';
      renderGrid();
      if (!dialog.open) dialog.showModal();
      dialog.querySelector('#customSymbolSearch').focus();
    }
    function fileData(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the image.'));
        reader.readAsDataURL(file);
      });
    }
    async function compactSprite(file, pixelated) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a PNG, WebP, JPG, or GIF image.');
      if (file.size > 8000000) throw new Error('Images must be smaller than 8 MB.');
      if (file.type === 'image/gif' && file.size > 65000) throw new Error('Animated GIF sprites must be 65 KB or smaller.');
      const data = await fileData(file);
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This image could not be decoded.')); image.src = data; });
      if (Math.max(image.naturalWidth, image.naturalHeight) > 4096) throw new Error('Use an image no larger than 4096 px on either side.');
      const size = Math.min(128, Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = !pixelated;
      const scale = size / Math.max(image.naturalWidth, image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      const still = canvas.toDataURL('image/png');
      const display = file.type === 'image/gif' ? data : still;
      if (!S.isLocalImageData(display) || !S.isLocalImageData(still)) throw new Error('This sprite is too detailed to save compactly. Use a simpler image.');
      return { display, still: file.type === 'image/gif' ? still : '' };
    }
    async function upload(files) {
      if (busy || !files.length) return;
      busy = true; renderGrid();
      const state = workspace(); const symbols = [...state.customSymbols]; const images = [...state.images];
      const group = S.cleanText(dialog.querySelector('#customSymbolUploadGroup').value, 60, 'My symbols');
      const pixelated = dialog.querySelector('#customSymbolUploadPixelated').checked;
      const failures = []; let added = 0;
      for (const file of files) {
        try {
          if (symbols.length >= 256) throw new Error('The library can contain up to 256 symbols.');
          const sprite = await compactSprite(file, pixelated);
          const image = { id: S.makeId('image'), data: sprite.display }; images.push(image);
          const still = sprite.still ? { id: S.makeId('image'), data: sprite.still } : null;
          if (still) images.push(still);
          symbols.push({ id: S.makeId('symbol'), symbolName: uniqueName(file.name, symbols), group,
            symbolAssetId: image.id, symbolStillAssetId: still?.id || '', symbolPixelated: pixelated, symbolCredit: '' });
          added++;
        } catch (error) { failures.push(file.name + ': ' + error.message); }
      }
      busy = false;
      if (!added || commit(symbols, images)) status((added ? added + ' symbol' + (added === 1 ? '' : 's') + ' added. ' : '') + failures.join(' '));
      renderGrid();
      dialog.querySelector('#customSymbolUpload').value = '';
    }
    function exportLibrary() {
      const state = workspace();
      const ids = new Set(state.customSymbols.flatMap(S.itemImageIds));
      const blob = new Blob([JSON.stringify({ format: 'woodles.custom-symbols.v1', symbols: state.customSymbols, images: state.images.filter((image) => ids.has(image.id)) }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'my-custom-symbols.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function importLibrary(file) {
      if (!file || busy) return;
      try {
        if (file.size > 15000000) throw new Error('Choose a symbol library smaller than 15 MB.');
        const data = JSON.parse(await file.text());
        if (data.format !== 'woodles.custom-symbols.v1' || !Array.isArray(data.symbols) || !Array.isArray(data.images)) throw new Error('This is not a custom symbol library export.');
        const state = workspace(); const symbols = [...state.customSymbols]; const images = [...state.images];
        const imageMap = new Map();
        data.images.slice(0, 512).map(S.sanitizeImage).filter(Boolean).forEach((image) => { const id = S.makeId('image'); imageMap.set(image.id, id); images.push({ ...image, id }); });
        let added = 0;
        for (const raw of data.symbols.slice(0, 256)) {
          const symbol = S.sanitizeCustomSymbol(raw);
          if (!symbol || !imageMap.has(symbol.symbolAssetId)) continue;
          if (symbols.length >= 256) throw new Error('Import would exceed 256 symbols. Remove unused library entries first.');
          symbols.push({ ...symbol, id: S.makeId('symbol'), symbolName: uniqueName(symbol.symbolName, symbols), symbolAssetId: imageMap.get(symbol.symbolAssetId), symbolStillAssetId: imageMap.get(symbol.symbolStillAssetId) || '' }); added++;
        }
        if (!added) throw new Error('No usable symbols were found in this file.');
        if (commit(symbols, images)) { renderGrid(); status(added + ' symbols imported.'); }
      } catch (error) { status(error.message || 'Could not import the library.'); }
    }
    dialog.addEventListener('click', (event) => {
      const button = event.target.closest('[data-library-action]'); if (!button || busy) return;
      const action = button.dataset.libraryAction;
      const entry = workspace().customSymbols.find((symbol) => symbol.id === button.dataset.id);
      if (action === 'close') dialog.close();
      else if (action === 'export') exportLibrary();
      else if (action === 'edit' && entry) { editing = entry.id; renderEditor(); dialog.querySelector('#customSymbolEditor input').focus(); }
      else if (action === 'cancel-edit') { editing = ''; renderEditor(); }
      else if (action === 'pick' && entry && target) { target.choose(S.symbolFields(entry)); dialog.close(); }
      else if (action === 'remove' && entry) {
        const state = workspace();
        if (commit(state.customSymbols.filter((symbol) => symbol.id !== entry.id), [...state.images])) {
          if (editing === entry.id) { editing = ''; renderEditor(); }
          renderGrid(); status('Removed :' + entry.symbolName + ': from the library. Saved schedules keep their symbol.');
        }
      }
    });
    dialog.addEventListener('submit', (event) => {
      if (event.target.id !== 'customSymbolEditor') return;
      event.preventDefault(); const form = event.target; const data = new FormData(form); const state = workspace();
      const name = S.cleanText(data.get('symbolName'), 40, '');
      if (state.customSymbols.some((symbol) => symbol.id !== editing && symbol.symbolName === name)) { status('That name is already used. Choose a different symbol name.'); return; }
      const symbols = state.customSymbols.map((symbol) => symbol.id === editing ? { ...symbol, symbolName: name, group: S.cleanText(data.get('group'), 60, 'My symbols'), symbolPixelated: data.has('symbolPixelated'), symbolCredit: S.cleanText(data.get('symbolCredit'), 200, '') } : symbol);
      if (commit(symbols, [...state.images])) { editing = ''; renderEditor(); renderGrid(); status('Symbol updated.'); }
    });
    dialog.addEventListener('input', (event) => { if (event.target.id === 'customSymbolSearch') renderGrid(); });
    dialog.addEventListener('change', (event) => {
      if (event.target.id === 'customSymbolGroup') renderGrid();
      else if (event.target.id === 'customSymbolUpload') upload([...event.target.files]);
      else if (event.target.id === 'customSymbolImport') importLibrary(event.target.files[0]);
    });
    dialog.addEventListener('close', () => { target = null; });
    dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
    return { open };
  }
};
