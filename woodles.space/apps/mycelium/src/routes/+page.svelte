<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { entityHref } from '@woodles/app-manifest';
  import { createPerson, updatePerson, deletePerson, loadPeople, subscribePeople, exportPeople, importPeople, personRef, defaultCardStyle, type Person } from '@woodles/mycelium';
  import { modal } from '@shared/modal';
  import PersonCard from '$lib/components/PersonCard.svelte';
  import AppearancePanel from '$lib/components/AppearancePanel.svelte';
  import ContactChannels from '$lib/components/ContactChannels.svelte';
  import { readPortrait } from '$lib/portrait';
  import CelestialMark from '$lib/components/CelestialMark.svelte';

  let people = $state<Person[]>([]);
  let ready = $state(false);
  let storageBlocked = $state(false);
  let issue = $state('');
  let notice = $state('');
  let query = $state('');
  let filter = $state('all');
  let sort = $state('name');
  let layout = $state('grid');
  let compact = $state(false);
  let calm = $state(false);
  let still = $state(false);
  let comfort = $state(false);
  let activeId = $state<string | null>(null);
  let creating = $state(false);
  let editing = $state(false);
  let draft = $state<Person | null>(null);
  let baseline = $state('');
  let tab = $state('details');
  let deleteOpen = $state(false);
  let portraitBusy = $state(false);
  let importInput: HTMLInputElement;
  let selected = $derived(people.find((person) => person.id === activeId) ?? null);
  let missing = $derived(!storageBlocked && !!activeId && !selected && !creating);
  let dirty = $derived(editing && !!draft && JSON.stringify(draft) !== baseline);
  let tags = $derived([...new Set(people.flatMap((person) => person.tags))].sort((a, b) => a.localeCompare(b)));
  let visible = $derived(people.filter((person) => {
    if (filter === 'favorites' && !person.favorite) return false;
    if (filter.startsWith('tag:') && !person.tags.includes(filter.slice(4))) return false;
    const text = [person.name, person.pronouns, person.role, person.organization, person.location, ...person.tags, ...person.emails.map((entry) => entry.value), ...person.phones.map((entry) => entry.value)].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }).sort((a, b) => sort === 'recent' ? b.updatedAt.localeCompare(a.updatedAt) : a.name.localeCompare(b.name)));

  function refresh() {
    const result = loadPeople();
    people = result.people;
    issue = result.issue?.message ?? '';
    storageBlocked = !!result.issue;
  }
  function error(err: unknown) { issue = err instanceof Error ? err.message : 'That change could not be saved.'; }
  function announce(message: string) { notice = message; }
  function setUrl(id: string | null) {
    const url = new URL(location.href);
    if (id) url.searchParams.set('person', id); else url.searchParams.delete('person');
    history.pushState({}, '', url);
  }
  function canLeave() { return !dirty || window.confirm('Leave these unsaved contact changes?'); }
  function shelf() {
    if (!canLeave()) return false;
    editing = false; creating = false; draft = null; activeId = null; setUrl(null);
    return true;
  }
  function openPerson(person: Person, fromHistory = false) {
    if (!canLeave()) return;
    activeId = person.id; creating = false; editing = false; draft = null; tab = 'details';
    if (!fromHistory) setUrl(person.id);
  }
  function edit(person: Person) {
    draft = structuredClone($state.snapshot(person));
    baseline = JSON.stringify(draft); editing = true; tab = 'details'; issue = '';
    void tick().then(() => document.querySelector<HTMLInputElement>('[data-autofocus]')?.focus());
  }
  function newPerson() {
    if (storageBlocked) return;
    if (!canLeave()) return;
    const stamp = new Date().toISOString();
    draft = { id: '', name: '', pronouns: '', role: '', organization: '', emails: [], phones: [], links: [], location: '', birthday: '', tags: [], notes: '', portrait: null, favorite: false, cardStyle: defaultCardStyle(), createdAt: stamp, updatedAt: stamp };
    baseline = JSON.stringify(draft); creating = true; editing = true; activeId = null; tab = 'details'; issue = ''; setUrl(null);
    void tick().then(() => document.querySelector<HTMLInputElement>('[data-autofocus]')?.focus());
  }
  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!draft || portraitBusy) return;
    try {
      if (draft.tags.length > 100 || draft.tags.some((tag) => tag.length > 100)) throw new Error('Use up to 100 circles, with no more than 100 characters in each name.');
      const { id, createdAt, updatedAt, ...input } = $state.snapshot(draft);
      input.name = input.name.trim();
      const original = JSON.parse(baseline) as Person;
      const changes = Object.fromEntries(Object.entries(input).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key as keyof Person])));
      const person = creating ? createPerson(input) : updatePerson(id, changes);
      refresh(); editing = false; creating = false; draft = null; activeId = person.id; setUrl(person.id);
      announce('contact saved');
    } catch (err) { error(err); }
  }
  function cancelEdit() {
    if (!canLeave()) return;
    editing = false; draft = null;
    if (creating) { creating = false; activeId = null; }
  }
  function toggleFavorite(person: Person) {
    try { updatePerson(person.id, { favorite: !person.favorite }); refresh(); } catch (err) { error(err); }
  }
  async function copy(kind: 'link' | 'reference', person: Person) {
    try {
      await navigator.clipboard.writeText(kind === 'reference' ? JSON.stringify(personRef(person.id)) : new URL(entityHref('mycelium', 'person', person.id), location.origin).href);
      announce(kind === 'link' ? 'contact link copied' : 'Woodles reference copied');
    } catch { issue = 'The clipboard is unavailable. Try copying from the address bar.'; }
  }
  function remove() {
    if (!selected) return;
    try { deletePerson(selected.id); deleteOpen = false; activeId = null; editing = false; draft = null; setUrl(null); refresh(); announce('contact deleted'); } catch (err) { error(err); }
  }
  function download(text: string, name: string, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function backup() {
    try { download(exportPeople(), `mycelium-${new Date().toISOString().slice(0, 10)}.json`); announce('backup downloaded'); } catch (err) { error(err); }
  }
  async function importBackup(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose a Mycelium backup smaller than 20 MB.');
      const result = importPeople(await file.text()); refresh();
      announce(`backup merged · ${result.added} added · ${result.updated} updated`);
    } catch (err) { error(err); } finally { input.value = ''; }
  }
  async function portrait(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0]; if (!file || !draft) return;
    const target = draft;
    portraitBusy = true;
    try { const data = await readPortrait(file); if (draft === target) draft.portrait = data; } catch (err) { error(err); }
    finally { portraitBusy = false; input.value = ''; }
  }
  function preferences() {
    try { localStorage.setItem('mycelium.preferences.v1', JSON.stringify({ compact, calm, still, layout })); } catch { /* Contact writes report their own storage errors. */ }
  }
  function tabKey(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    tab = event.key === 'Home' ? 'details' : event.key === 'End' ? 'appearance' : tab === 'details' ? 'appearance' : 'details';
    void tick().then(() => document.getElementById(`${tab}-tab`)?.focus());
  }
  async function printCards() {
    const previous = layout;
    layout = 'grid'; await tick(); window.print(); layout = previous;
  }
  function historyChanged() {
    if (!canLeave()) { setUrl(activeId); return; }
    activeId = new URLSearchParams(location.search).get('person'); editing = false; creating = false; draft = null;
  }
  function beforeUnload(event: BeforeUnloadEvent) { if (dirty) event.preventDefault(); }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (deleteOpen) deleteOpen = false;
      else if (comfort) comfort = false;
      else if (editing) cancelEdit();
      else if (activeId) shelf();
    }
  }
  onMount(() => {
    refresh(); ready = true;
    activeId = new URLSearchParams(location.search).get('person');
    try {
      const prefs = JSON.parse(localStorage.getItem('mycelium.preferences.v1') ?? '{}');
      compact = prefs.compact === true; calm = prefs.calm === true; still = prefs.still === true; layout = prefs.layout === 'list' ? 'list' : 'grid';
    } catch { /* Cosmetic preferences can reset safely. */ }
    return subscribePeople(() => refresh());
  });
</script>

<svelte:window onpopstate={historyChanged} onbeforeunload={beforeUnload} onkeydown={keydown} />

<div class="page-layout" class:calm class:still>
  <nav class="sidebar" aria-label="Mycelium">
    <div class="nav-top">
      <button class="brand" onclick={shelf}><span class="brand-mark"><CelestialMark /></span> mycelium</button>
      <button class="nav-link" class:active={!activeId && !creating && filter === 'all'} onclick={() => { if (shelf()) filter = 'all'; }}>▧ all people <span>{people.length}</span></button>
      <button class="nav-link" class:active={filter === 'favorites'} onclick={() => { if (shelf()) filter = 'favorites'; }}>☆ favorites <span>{people.filter((person) => person.favorite).length}</span></button>
      <button class="new-button" disabled={storageBlocked} onclick={newPerson}>＋ new person</button>
      {#if tags.length}
        <div class="tag-nav"><p class="eyebrow">little circles</p>
          {#each tags as tag}<button class="nav-link" class:active={filter === `tag:${tag}`} onclick={() => { if (shelf()) filter = `tag:${tag}`; }}>· {tag}</button>{/each}
        </div>
      {/if}
    </div>
    <div class="nav-bottom">
      <p class="shelf-note">a little card for every<br />person in your world.</p>
      <button class="nav-link" onclick={backup}>↓ export backup</button>
      <button class="nav-link" onclick={() => importInput.click()}>↑ import backup</button>
      <button class="nav-link" onclick={() => comfort = true}>☾ comfort</button>
      <a class="nav-link" href="/homesuite">↩ homesuite</a>
      <a class="site-home" href="/">·space</a>
      <span class="local-state"><i></i> {issue ? 'check the storage message' : 'local browser storage'}</span>
    </div>
  </nav>
  <input hidden tabindex="-1" type="file" accept="application/json,.json" aria-label="Import Mycelium backup" bind:this={importInput} onchange={importBackup} />

  <main class="main-content">
    {#if issue}<div class="issue" role="alert">{issue}<button aria-label="Dismiss message" onclick={() => issue = ''}>×</button></div>{/if}
    <div class="notice" aria-live="polite" role="status">{notice}</div>
    {#if editing && draft}
      <form class="workshop" onsubmit={save}>
        <header class="workshop-header">
          <div><p class="eyebrow">the contact workshop</p><h1>{creating ? 'a new person' : draft.name || 'edit person'}</h1></div>
          <div class="actions"><button type="button" class="chip" onclick={cancelEdit}>cancel</button><button class="primary" type="submit" disabled={portraitBusy}>save contact</button></div>
        </header>
        <div class="workshop-body">
          <div class="preview-stage"><div class="preview-card"><PersonCard person={draft} preview={!still} /></div><p class="preview-caption">3 : 4 · a person, in a little frame</p></div>
          <section class="editor-panel" aria-label="Contact editor">
            <div class="tabs" role="tablist" aria-label="Contact workshop">
              <button id="details-tab" type="button" role="tab" tabindex={tab === 'details' ? 0 : -1} aria-selected={tab === 'details'} aria-controls="details-panel" onkeydown={tabKey} onclick={() => tab = 'details'}>the person</button>
              <button id="appearance-tab" type="button" role="tab" tabindex={tab === 'appearance' ? 0 : -1} aria-selected={tab === 'appearance'} aria-controls="appearance-panel" onkeydown={tabKey} onclick={() => tab = 'appearance'}>the card</button>
            </div>
            {#if tab === 'details'}
              <div class="editor-fields" id="details-panel" role="tabpanel" aria-labelledby="details-tab">
                <label>Name <input data-autofocus required maxlength="200" autocomplete="name" bind:value={draft.name} placeholder="what do you call them?" /></label>
                <div class="field-pair"><label>Pronouns <input maxlength="80" bind:value={draft.pronouns} placeholder="they / them" /></label><label>Birthday <input type="date" bind:value={draft.birthday} /></label></div>
                <div class="field-pair"><label>Role <input maxlength="200" bind:value={draft.role} placeholder="what they do" /></label><label>Organization <input maxlength="200" autocomplete="organization" bind:value={draft.organization} placeholder="their corner of the world" /></label></div>
                <label>Location <input maxlength="200" bind:value={draft.location} placeholder="where in the world" /></label>
                <fieldset class="portrait-controls"><legend>Portrait</legend><label class="chip upload">{portraitBusy ? 'preparing portrait…' : '↑ choose a picture'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={portraitBusy} onchange={portrait} /></label>{#if draft.portrait}<button type="button" class="text-button" onclick={() => { if (draft) draft.portrait = null; }}>remove portrait</button>{/if}<p class="field-hint">Optional. Initials make a lovely card too.</p></fieldset>
                <ContactChannels title="Email" type="email" items={draft.emails} onchange={(items) => { if (draft) draft.emails = items; }} />
                <ContactChannels title="Phone" type="tel" items={draft.phones} onchange={(items) => { if (draft) draft.phones = items; }} />
                <ContactChannels title="Link" type="url" items={draft.links} onchange={(items) => { if (draft) draft.links = items; }} />
                <label>Circles <input value={draft.tags.join(', ')} onchange={(e) => { if (draft) draft.tags = [...new Set(e.currentTarget.value.split(',').map((tag) => tag.trim()).filter(Boolean))]; }} placeholder="friends, family, the garden club" /><span class="field-hint">Separate with commas.</span></label>
                <label class="checkbox"><input type="checkbox" bind:checked={draft.favorite} /> keep in favorites</label>
                <label>Notes <textarea rows="5" maxlength="20000" bind:value={draft.notes} placeholder="the little things you want to remember"></textarea><span class="field-hint">Cards and reference pickers leave notes tucked away. Connected Data collections can include them.</span></label>
              </div>
            {:else}
              <div class="editor-fields" id="appearance-panel" role="tabpanel" aria-labelledby="appearance-tab"><AppearancePanel style={draft.cardStyle} onchange={(style) => { if (draft) draft.cardStyle = style; }} /></div>
            {/if}
          </section>
        </div>
      </form>
    {:else if selected}
      <div class="contact-detail">
        <header class="detail-header"><button class="text-button" onclick={shelf}>← the people shelf</button><div class="actions"><button class="chip" onclick={() => toggleFavorite(selected!)}>{selected.favorite ? '★ favorite' : '☆ favorite'}</button><button class="primary" onclick={() => edit(selected!)}>edit contact</button></div></header>
        <div class="detail-body">
          <div class="preview-stage"><div class="preview-card"><PersonCard person={selected} preview={!still} /></div></div>
          <section class="contact-info" aria-label="Contact details">
            <p class="eyebrow">one of your people</p><h1>{selected.name}</h1>
            {#if selected.pronouns}<p class="pronouns">{selected.pronouns}</p>{/if}
            {#if selected.role || selected.organization}<p class="role-line">{[selected.role, selected.organization].filter(Boolean).join(' · ')}</p>{/if}
            <dl>
              {#if selected.location}<div><dt>Location</dt><dd>{selected.location}</dd></div>{/if}
              {#if selected.birthday}<div><dt>Birthday</dt><dd>{selected.birthday}</dd></div>{/if}
              {#each selected.emails as entry}<div><dt>{entry.label || 'Email'}</dt><dd><a href={`mailto:${encodeURIComponent(entry.value)}`}>{entry.value}</a></dd></div>{/each}
              {#each selected.phones as entry}<div><dt>{entry.label || 'Phone'}</dt><dd><a href={`tel:${entry.value.replace(/[^+\d*#,;]/g, '')}`}>{entry.value}</a></dd></div>{/each}
              {#each selected.links as entry}<div><dt>{entry.label || 'Link'}</dt><dd><a href={/^https?:\/\//i.test(entry.value) ? entry.value : undefined} target="_blank" rel="noopener noreferrer">{entry.value}</a></dd></div>{/each}
            </dl>
            {#if selected.tags.length}<div class="tag-list">{#each selected.tags as tag}<span class="tag">{tag}</span>{/each}</div>{/if}
            {#if selected.notes}<div class="contact-notes"><h2>little things to remember</h2><p>{selected.notes}</p></div>{/if}
            <div class="connection-actions"><button class="chip" onclick={() => copy('link', selected!)}>⎘ copy contact link</button><button class="chip" onclick={() => copy('reference', selected!)}>⎘ copy Woodles reference</button></div>
            <p class="field-hint">Find this person in Write’s # picker or a connected Data collection. Changes to the contact stay here.</p>
            <button class="delete-button" onclick={() => deleteOpen = true}>delete contact…</button>
          </section>
        </div>
      </div>
    {:else if missing}
      <div class="empty"><span class="empty-glyph">♧</span><h1>This card isn’t on this shelf.</h1><p>The person may have been deleted, or saved in another browser.<br />A contact link opens a local record.</p><button class="primary" onclick={shelf}>back to people</button></div>
    {:else}
      <section class="collection">
        <header class="shelf-head"><div class="title-row"><div><p class="eyebrow">the threads between us</p><h1>the people shelf</h1></div><button class="primary" disabled={storageBlocked} onclick={newPerson}>＋ new person</button></div>{#if !storageBlocked}<p class="census">{people.length} {people.length === 1 ? 'person' : 'people'} <span>·</span> {people.filter((person) => person.favorite).length} favorites <span>·</span> a small, growing world</p>{/if}</header>
        {#if storageBlocked}
          <div class="empty"><span class="empty-glyph" aria-hidden="true">♧</span><h2>The shelf couldn’t be opened.</h2><p>Your saved contacts have been kept.<br />Mycelium won’t write over unreadable data.</p><button class="chip" onclick={refresh}>try reading the shelf again</button></div>
        {:else if people.length}
          <div class="controls">
            <input type="search" class="search" aria-label="Search people" bind:value={query} placeholder="search the people, find a thread…" />
            <div class="control-group" role="group" aria-label="Sort people"><button class="chip" class:active={sort === 'name'} onclick={() => sort = 'name'}>name</button><button class="chip" class:active={sort === 'recent'} onclick={() => sort = 'recent'}>recent</button></div>
            <div class="control-group" role="group" aria-label="Shelf view"><button class="chip" class:active={layout === 'grid'} onclick={() => { layout = 'grid'; preferences(); }}>⊞ grid</button><button class="chip" class:active={layout === 'list'} onclick={() => { layout = 'list'; preferences(); }}>☰ list</button><button class="chip" onclick={printCards}>⊟ print cards</button></div>
          </div>
          {#if filter !== 'all'}<p class="filter-note">showing {filter.startsWith('tag:') ? filter.slice(4) : filter} <button class="text-button" onclick={() => filter = 'all'}>show everyone ×</button></p>{/if}
          {#if visible.length}
            <div class="people-grid" class:compact class:list-view={layout === 'list'}>
              {#each visible as person (person.id)}
                <button class="person-open" aria-label={`Open ${person.name}`} onclick={() => openPerson(person)}>
                  {#if layout === 'grid'}<PersonCard {person} interactive={!still} />{:else}<span class="list-initial">{person.name.slice(0, 1)}</span><span class="list-name">{person.name}<small>{[person.role, person.organization].filter(Boolean).join(' · ')}</small></span><span class="list-email">{person.emails[0]?.value ?? person.location}</span><span aria-hidden="true">{person.favorite ? '★' : '↗'}</span>{/if}
                </button>
              {/each}
            </div>
          {:else}<div class="empty"><h2>No threads found here.</h2><p>Try another name, address, or circle.</p><button class="chip" onclick={() => { query = ''; filter = 'all'; }}>show everyone</button></div>{/if}
        {:else if ready}
          <div class="empty first-person"><div class="empty-card" aria-hidden="true"><span class="empty-mark"><CelestialMark /></span><div class="empty-initial">?</div><i>a familiar face goes here</i><div class="empty-rule"></div><small>one person · many little threads</small></div><h2>Every little world starts with someone.</h2><p>A face, a name, the things you want to remember.<br />Give your people a place on the shelf.</p><button class="primary" onclick={newPerson}>＋ make the first card</button></div>
        {/if}
      </section>
    {/if}
  </main>
</div>

{#if comfort}
  <div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="comfort-title" tabindex="-1" use:modal>
    <header><h2 id="comfort-title">comfort & quiet</h2><button class="icon-button" aria-label="Close comfort" onclick={() => comfort = false}>×</button></header>
    <label class="checkbox"><input type="checkbox" bind:checked={calm} onchange={preferences} /> calm the backdrop</label>
    <label class="checkbox"><input type="checkbox" bind:checked={still} onchange={preferences} /> still the cards</label>
    <label class="checkbox"><input type="checkbox" bind:checked={compact} onchange={preferences} /> smaller shelf cards</label>
    <p class="field-hint">Your browser’s reduced motion preference is always respected.</p>
    <button class="primary" onclick={() => comfort = false}>settled</button>
  </div></div>
{/if}
{#if deleteOpen && selected}
  <div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title" tabindex="-1" use:modal>
    <h2 id="delete-title">Delete {selected.name}?</h2><p>This removes their contact and portrait from Mycelium. References in your writing and collections remain, but won’t resolve to a contact.</p><div class="actions"><button class="chip" onclick={() => deleteOpen = false}>keep contact</button><button class="primary danger" onclick={remove}>delete contact</button></div>
  </div></div>
{/if}
