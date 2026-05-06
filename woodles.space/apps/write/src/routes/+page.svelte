<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Clock from '$lib/Clock.svelte';
	import {
		palettes,
		motifs as motifList,
		fontPairs,
		findTemplate,
		findFont
	} from '@shared/library.js';

	const DRAFT_KEY = 'woodles_write_draft';
	const PUBLISHED_KEY = 'woodles_published';
	const ISSUE_KEY = 'woodles_issue_count';
	const POCKETS_ORDER_KEY = 'woodles_pockets_order';

	type LayerId = 'foreground' | 'midground' | 'background';
	type PocketLayer = 'midground' | 'background';
	const LAYER_IDS: LayerId[] = ['foreground', 'midground', 'background'];
	const LAYER_LABELS: Record<LayerId, string> = {
		foreground: 'fg',
		midground: 'mg',
		background: 'bg'
	};
	const LAYER_PLACEHOLDERS: Record<LayerId, string> = {
		foreground: 'Begin writing your letter…',
		midground: 'thinking, working notes, what shaped this…',
		background: 'the impulse. the thing only you know.'
	};

	type PocketNote = {
		id: string;
		html: string;
		layer: PocketLayer;
		createdAt: string;
		updatedAt: string;
	};
	type PocketsOrder = 'oldest' | 'newest';

	let title = $state('');
	let theme = $state('cream');
	let motif = $state('blobs');
	let font = $state('classic');

	let fgEl: HTMLDivElement | undefined = $state();
	let mgEl: HTMLDivElement | undefined = $state();
	let bgEl: HTMLDivElement | undefined = $state();
	let titleEl: HTMLInputElement | undefined = $state();

	let activeLayer = $state<LayerId>('foreground');
	let saveStatus = $state<'saved' | 'saving'>('saved');
	let wordCount = $state(0);
	let bold = $state(false);
	let italic = $state(false);
	let underline = $state(false);
	let publishing = $state(false);
	let fgIsEmpty = $state(true);

	let pockets = $state<PocketNote[]>([]);
	let pocketsOpen = $state(false);
	let pocketsOrder = $state<PocketsOrder>('oldest');
	let confirmingId = $state<string | null>(null);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let hydrated = $state(false);

	const sortedPockets = $derived(
		pocketsOrder === 'oldest'
			? [...pockets].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
			: [...pockets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	);

	const nextPocketLayer = $derived<PocketLayer>(
		activeLayer === 'background' ? 'background' : 'midground'
	);

	function elFor(layer: LayerId): HTMLDivElement | undefined {
		return layer === 'foreground' ? fgEl : layer === 'midground' ? mgEl : bgEl;
	}

	// Strip inline font/style attributes from HTML so the document's font
	// system always wins. Preserves structural and semantic markup
	// (headings, lists, links, bold/italic) but drops <font>/<span>
	// wrappers and `style`/`color`/`face`/`size` attributes.
	function sanitizeHtml(html: string): string {
		if (typeof DOMParser === 'undefined' || !html) return html;
		const doc = new DOMParser().parseFromString('<div id="__r">' + html + '</div>', 'text/html');
		const root = doc.getElementById('__r');
		if (!root) return html;
		root.querySelectorAll('*').forEach((el) => {
			el.removeAttribute('style');
			el.removeAttribute('color');
			el.removeAttribute('face');
			el.removeAttribute('size');
			el.removeAttribute('bgcolor');
			if (el.tagName === 'FONT' || el.tagName === 'SPAN') {
				const parent = el.parentNode;
				if (!parent) return;
				while (el.firstChild) parent.insertBefore(el.firstChild, el);
				parent.removeChild(el);
			}
		});
		return root.innerHTML;
	}

	function handlePaste(e: ClipboardEvent) {
		const data = e.clipboardData;
		if (!data) return;
		const html = data.getData('text/html');
		const text = data.getData('text/plain');
		e.preventDefault();
		if (html) {
			const cleaned = sanitizeHtml(html);
			document.execCommand('insertHTML', false, cleaned);
		} else if (text) {
			document.execCommand('insertText', false, text);
		}
	}

	function loadIntoLayers(d: {
		title?: string;
		theme?: string;
		motif?: string;
		font?: string;
		layers?: Partial<Record<LayerId, { html?: string }>>;
		content?: string;
		annotations?: { pocketNotes?: PocketNote[] };
	}) {
		title = d.title || '';
		if (d.theme) theme = d.theme;
		if (d.motif) motif = d.motif;
		if (d.font) font = d.font;
		const layers = d.layers ?? {};
		const fgHtml = sanitizeHtml(layers.foreground?.html ?? d.content ?? '');
		const mgHtml = sanitizeHtml(layers.midground?.html ?? '');
		const bgHtml = sanitizeHtml(layers.background?.html ?? '');
		if (fgEl) fgEl.innerHTML = fgHtml;
		if (mgEl) mgEl.innerHTML = mgHtml;
		if (bgEl) bgEl.innerHTML = bgHtml;
		const notes = d.annotations?.pocketNotes;
		pockets = Array.isArray(notes)
			? notes.map((n) => ({
					...n,
					layer: n.layer === 'background' ? 'background' : 'midground',
					html: sanitizeHtml(n.html ?? '')
				}))
			: [];
	}

	onMount(() => {
		try {
			const order = localStorage.getItem(POCKETS_ORDER_KEY);
			if (order === 'newest' || order === 'oldest') pocketsOrder = order;
		} catch (e) {
			// ignore
		}

		// Templates take precedence over the saved draft so /write?template=
		// is always a fresh start.
		const params = new URLSearchParams(window.location.search);
		const tid = params.get('template');
		if (tid) {
			const t = findTemplate(tid);
			if (t) {
				loadIntoLayers({
					title: t.sampleTitle,
					theme: t.palette,
					motif: t.motif,
					font: t.font,
					content: t.sampleContent
				});
				updateMeta();
				history.replaceState(null, '', window.location.pathname);
				hydrated = true;
				scheduleSave();
				return;
			}
		}

		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (raw) loadIntoLayers(JSON.parse(raw));
		} catch (e) {
			// ignore corrupt draft
		}
		updateMeta();
		hydrated = true;
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		document.body.dataset.theme = theme;
		Array.from(document.body.classList).forEach((c) => {
			if (c.startsWith('motif-') && !c.startsWith('motif-blob') && c !== 'motif-grain') {
				document.body.classList.remove(c);
			}
		});
		document.body.classList.add('motif-' + motif);
		const f = findFont(font);
		document.body.style.setProperty('--editor-display', f.display);
		document.body.style.setProperty('--editor-body', f.body);
		document.body.style.setProperty('--editor-mono', f.mono);
	});

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(POCKETS_ORDER_KEY, pocketsOrder);
		} catch (e) {
			// ignore
		}
	});

	function isEmptyHtml(html: string): boolean {
		const stripped = html.replace(/<br\s*\/?>(\s*)/gi, '').replace(/<[^>]+>/g, '').trim();
		return stripped.length === 0;
	}

	function updateMeta() {
		const el = elFor(activeLayer);
		const text = el?.innerText || '';
		wordCount = text.trim().split(/\s+/).filter((w) => w.length).length;
		fgIsEmpty = isEmptyHtml(fgEl?.innerHTML ?? '');
	}

	function scheduleSave() {
		if (!hydrated) return;
		saveStatus = 'saving';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			try {
				const now = new Date().toISOString();
				localStorage.setItem(
					DRAFT_KEY,
					JSON.stringify({
						title,
						theme,
						motif,
						font,
						layers: {
							foreground: { html: fgEl?.innerHTML ?? '', updatedAt: now },
							midground: { html: mgEl?.innerHTML ?? '', updatedAt: now },
							background: { html: bgEl?.innerHTML ?? '', updatedAt: now }
						},
						annotations: { pocketNotes: pockets },
						content: fgEl?.innerHTML ?? '',
						savedAt: now
					})
				);
			} catch (e) {
				// ignore quota / disabled storage
			}
			saveStatus = 'saved';
		}, 700);
	}

	$effect(() => {
		void theme;
		void motif;
		void font;
		if (hydrated) scheduleSave();
	});

	async function setActiveLayer(next: LayerId) {
		if (next === activeLayer) return;
		activeLayer = next;
		await tick();
		const el = elFor(next);
		el?.focus();
		updateMeta();
		if (next === 'foreground') updateToolbarState();
	}

	function exec(cmd: string, val: string | null = null) {
		if (activeLayer !== 'foreground') return;
		document.execCommand(cmd, false, val ?? undefined);
		fgEl?.focus();
		updateToolbarState();
	}

	function insertLink() {
		const url = prompt('URL:');
		if (url) exec('createLink', url);
	}

	function updateToolbarState() {
		if (activeLayer !== 'foreground') {
			bold = italic = underline = false;
			return;
		}
		bold = document.queryCommandState('bold');
		italic = document.queryCommandState('italic');
		underline = document.queryCommandState('underline');
	}

	function stampAnchors(html: string): string {
		if (typeof DOMParser === 'undefined') return html;
		const doc = new DOMParser().parseFromString('<div id="__root">' + html + '</div>', 'text/html');
		const root = doc.getElementById('__root');
		if (!root) return html;
		const blocks = root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,blockquote,li,ul,ol,pre');
		let i = 1;
		blocks.forEach((b) => {
			b.setAttribute('data-anchor', 'a-' + String(i++).padStart(3, '0'));
		});
		return root.innerHTML;
	}

	function publish() {
		const issue = parseInt(localStorage.getItem(ISSUE_KEY) || '0') + 1;
		localStorage.setItem(ISSUE_KEY, String(issue));
		try {
			const now = new Date().toISOString();
			const fgHtml = stampAnchors(sanitizeHtml(fgEl?.innerHTML ?? ''));
			const mgHtml = sanitizeHtml(mgEl?.innerHTML ?? '');
			const bgHtml = sanitizeHtml(bgEl?.innerHTML ?? '');
			const cleanedPockets = pockets.map((p) => ({ ...p, html: sanitizeHtml(p.html) }));
			localStorage.setItem(
				PUBLISHED_KEY,
				JSON.stringify({
					title: title.trim() || 'untitled letter',
					theme,
					motif,
					font,
					issue,
					publishedAt: now,
					layers: {
						foreground: { html: fgHtml, updatedAt: now },
						midground: { html: mgHtml, updatedAt: now },
						background: { html: bgHtml, updatedAt: now }
					},
					annotations: { pocketNotes: cleanedPockets },
					content: fgHtml
				})
			);
		} catch (e) {
			// ignore
		}
		publishing = true;
		setTimeout(() => {
			window.location.href = '/letter';
		}, 1800);
	}

	// ── pocket notes ──
	function newPocketId() {
		return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
	}

	async function addPocket() {
		if (!pocketsOpen) pocketsOpen = true;
		const now = new Date().toISOString();
		const note: PocketNote = {
			id: newPocketId(),
			html: '',
			layer: nextPocketLayer,
			createdAt: now,
			updatedAt: now
		};
		pockets = [...pockets, note];
		scheduleSave();
		await tick();
		const el = document.querySelector<HTMLElement>('[data-pocket-body="' + note.id + '"]');
		el?.focus();
	}

	function pocketBody(node: HTMLElement, html: string) {
		node.innerHTML = html ?? '';
		return {};
	}

	function onPocketInput(id: string, e: Event) {
		const html = (e.currentTarget as HTMLElement).innerHTML;
		const idx = pockets.findIndex((p) => p.id === id);
		if (idx < 0) return;
		const now = new Date().toISOString();
		pockets[idx] = { ...pockets[idx], html, updatedAt: now };
		scheduleSave();
	}

	function startConfirmDelete(id: string) {
		confirmingId = id;
		clearTimeout(confirmTimer);
		confirmTimer = setTimeout(() => {
			if (confirmingId === id) confirmingId = null;
		}, 3000);
	}

	function cancelConfirmDelete() {
		confirmingId = null;
		clearTimeout(confirmTimer);
	}

	function confirmDelete(id: string) {
		pockets = pockets.filter((p) => p.id !== id);
		confirmingId = null;
		clearTimeout(confirmTimer);
		scheduleSave();
	}

	function flipPocketsOrder() {
		pocketsOrder = pocketsOrder === 'oldest' ? 'newest' : 'oldest';
	}

	function pocketLayerLabel(layer: PocketLayer) {
		return layer === 'midground' ? 'mg' : 'bg';
	}
</script>

<div class="motif-grain"></div>
<div class="motif-blob motif-blob-1"></div>
<div class="motif-blob motif-blob-2"></div>
<div class="motif-blob motif-blob-3"></div>
<div class="motif-blob motif-blob-4"></div>

<header class="topbar">
	<a href="/" class="topbar-brand">.space</a>
	<span class="topbar-label">echoes · write</span>
	<div class="layer-switch" role="tablist" aria-label="layer">
		{#each LAYER_IDS as id}
			<button
				class="layer-btn"
				class:active={activeLayer === id}
				role="tab"
				aria-selected={activeLayer === id}
				onclick={() => setActiveLayer(id)}
				title={id}>{LAYER_LABELS[id]}</button
			>
		{/each}
	</div>
	<span class="topbar-divider" aria-hidden="true"></span>
	<button
		class="pockets-toggle"
		class:on={pocketsOpen}
		onclick={() => (pocketsOpen = !pocketsOpen)}
		aria-pressed={pocketsOpen}
		title="pockets"
	>
		pockets{#if pockets.length > 0}<span class="pockets-count">{pockets.length}</span>{/if}
	</button>
	<div class="topbar-clock"><Clock /></div>
</header>

<div class="overlay" class:active={publishing}>
	<p class="overlay-word">published.</p>
	<p class="overlay-sub">woodles.space / echoes</p>
</div>

<div class="editor-wrap" data-layer={activeLayer}>
	<p class="doc-eyebrow">echoes · {activeLayer}</p>
	<input
		bind:this={titleEl}
		bind:value={title}
		oninput={scheduleSave}
		class="doc-title"
		type="text"
		placeholder="untitled letter"
		spellcheck="true"
		autocomplete="off"
	/>

	{#if activeLayer === 'foreground'}
		<div class="toolbar">
			<button
				class="tool-btn"
				class:active={bold}
				onmousedown={(e) => {
					e.preventDefault();
					exec('bold');
				}}
				title="Bold"><b>B</b></button
			>
			<button
				class="tool-btn"
				class:active={italic}
				onmousedown={(e) => {
					e.preventDefault();
					exec('italic');
				}}
				title="Italic"><em>I</em></button
			>
			<button
				class="tool-btn"
				class:active={underline}
				onmousedown={(e) => {
					e.preventDefault();
					exec('underline');
				}}
				title="Underline"><u>U</u></button
			>
			<span class="tool-sep"></span>
			<button
				class="tool-btn"
				onmousedown={(e) => {
					e.preventDefault();
					exec('formatBlock', 'h1');
				}}
				title="Heading 1">H1</button
			>
			<button
				class="tool-btn"
				onmousedown={(e) => {
					e.preventDefault();
					exec('formatBlock', 'h2');
				}}
				title="Heading 2">H2</button
			>
			<button
				class="tool-btn"
				onmousedown={(e) => {
					e.preventDefault();
					exec('formatBlock', 'p');
				}}
				title="Paragraph">¶</button
			>
			<span class="tool-sep"></span>
			<button
				class="tool-btn"
				onmousedown={(e) => {
					e.preventDefault();
					exec('formatBlock', 'blockquote');
				}}
				title="Blockquote">❝</button
			>
			<span class="tool-sep"></span>
			<button
				class="tool-btn"
				onmousedown={(e) => {
					e.preventDefault();
					exec('insertUnorderedList');
				}}
				title="Bullet list">· —</button
			>
			<button
				class="tool-btn"
				onmousedown={(e) => {
					e.preventDefault();
					exec('insertOrderedList');
				}}
				title="Numbered list">1.</button
			>
			<span class="tool-sep"></span>
			<button
				class="tool-btn"
				onmousedown={(e) => {
					e.preventDefault();
					insertLink();
				}}
				title="Insert link">link</button
			>
			<span class="tool-sep"></span>
			<button
				class="tool-btn"
				onmousedown={(e) => {
					e.preventDefault();
					exec('removeFormat');
				}}
				title="Clear formatting">×</button
			>
		</div>
	{/if}

	<div
		bind:this={fgEl}
		class="doc-body layer-foreground"
		class:hidden={activeLayer !== 'foreground'}
		contenteditable="true"
		spellcheck="true"
		data-placeholder={LAYER_PLACEHOLDERS.foreground}
		oninput={() => {
			updateMeta();
			scheduleSave();
		}}
		onpaste={handlePaste}
		onkeyup={updateToolbarState}
		onmouseup={updateToolbarState}
		role="textbox"
		tabindex="0"
	></div>

	<div
		bind:this={mgEl}
		class="doc-body layer-midground"
		class:hidden={activeLayer !== 'midground'}
		contenteditable="true"
		spellcheck="true"
		data-placeholder={LAYER_PLACEHOLDERS.midground}
		oninput={() => {
			updateMeta();
			scheduleSave();
		}}
		onpaste={handlePaste}
		role="textbox"
		tabindex="0"
	></div>

	<div
		bind:this={bgEl}
		class="doc-body layer-background"
		class:hidden={activeLayer !== 'background'}
		contenteditable="true"
		spellcheck="true"
		data-placeholder={LAYER_PLACEHOLDERS.background}
		oninput={() => {
			updateMeta();
			scheduleSave();
		}}
		onpaste={handlePaste}
		role="textbox"
		tabindex="0"
	></div>

	{#if pocketsOpen}
		<section
			class="pockets-panel"
			aria-label="pockets"
			transition:slide={{ duration: 320, easing: cubicOut }}
		>
			<div class="pockets-divider" aria-hidden="true"></div>
			<div class="pockets-header">
				<span class="pockets-eyebrow">inside cover</span>
				<button
					class="pockets-order"
					onclick={flipPocketsOrder}
					title="flip ordering"
				>
					{pocketsOrder === 'oldest' ? 'oldest first ↓' : 'newest first ↑'}
				</button>
			</div>
			<div class="pockets-list">
				{#each sortedPockets as note (note.id)}
					<div
						class="pocket-card pocket-card-{note.layer}"
						in:fly={{ y: 8, duration: 240, easing: cubicOut }}
						out:fly={{ y: -4, duration: 160, easing: cubicOut }}
					>
						<span class="pocket-layer-chip" title="{note.layer} pocket">{pocketLayerLabel(note.layer)}</span>
						<div
							class="pocket-body"
							contenteditable="true"
							spellcheck="true"
							use:pocketBody={note.html}
							oninput={(e) => onPocketInput(note.id, e)}
							onpaste={handlePaste}
							data-pocket-body={note.id}
							data-placeholder="…"
							role="textbox"
							tabindex="0"
						></div>
						<div class="pocket-controls">
							{#if confirmingId === note.id}
								<button
									class="pocket-confirm"
									onclick={() => confirmDelete(note.id)}
									onblur={cancelConfirmDelete}
								>remove?</button>
							{:else}
								<button
									class="pocket-x"
									onclick={() => startConfirmDelete(note.id)}
									title="remove this pocket"
									aria-label="remove pocket note"
								>×</button>
							{/if}
						</div>
					</div>
				{/each}
				{#if pockets.length === 0}
					<p class="pockets-empty">a quiet place. tuck a thought in.</p>
				{/if}
			</div>
			<button class="pocket-add" onclick={addPocket} title="add a {nextPocketLayer} pocket">
				<span class="pocket-add-plus">+</span>
				<span class="pocket-add-label">{nextPocketLayer} pocket</span>
			</button>
		</section>
	{/if}
</div>

<div class="bottom-bar">
	<div class="bottom-meta">
		<span class="save-status" class:saving={saveStatus === 'saving'}>
			{saveStatus === 'saving' ? 'saving…' : 'saved'}
		</span>
		<span class="word-count">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
		<span class="picker-sep">·</span>
		<label class="picker">
			<span class="picker-label">palette</span>
			<select bind:value={theme} class="picker-select">
				{#each palettes as p}<option value={p.id}>{p.name}</option>{/each}
			</select>
		</label>
		<label class="picker">
			<span class="picker-label">motif</span>
			<select bind:value={motif} class="picker-select">
				{#each motifList as m}<option value={m.id}>{m.name}</option>{/each}
			</select>
		</label>
		<label class="picker">
			<span class="picker-label">font</span>
			<select bind:value={font} class="picker-select">
				{#each fontPairs as f}<option value={f.id}>{f.name}</option>{/each}
			</select>
		</label>
	</div>
	<div class="publish-cluster">
		{#if activeLayer === 'foreground' && fgIsEmpty}
			<span class="publish-warn">this letter will appear blank to others</span>
		{/if}
		{#if activeLayer === 'foreground'}
			<button class="publish-btn" onclick={publish}>Publish →</button>
		{:else}
			<span class="publish-hint">switch to fg to publish</span>
		{/if}
	</div>
</div>

<style>
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}
	:global(html),
	:global(body) {
		height: 100%;
	}
	:global(body) {
		background: var(--bg);
		color: var(--text);
		font-family: var(--editor-mono, var(--font-mono));
		font-weight: 300;
		min-height: 100vh;
		overflow-x: hidden;
		position: relative;
		transition:
			background 0.3s ease,
			color 0.3s ease;
	}

	.topbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 20;
		height: 42px;
		display: flex;
		align-items: center;
		padding: 0 1.6rem;
		background: var(--surface);
		backdrop-filter: blur(22px);
		-webkit-backdrop-filter: blur(22px);
		overflow: hidden;
	}
	.topbar::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--lavender) 20%,
			var(--aqua) 45%,
			var(--peach) 65%,
			var(--lilac) 80%,
			transparent 100%
		);
		background-size: 220% 100%;
		animation: bar-shimmer 11s ease-in-out infinite;
		opacity: 0.5;
	}
	@keyframes bar-shimmer {
		0% { background-position: 0% 0; }
		50% { background-position: 100% 0; }
		100% { background-position: 0% 0; }
	}
	.topbar-brand {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.68rem;
		letter-spacing: 0.18em;
		text-decoration: none;
		position: relative;
		z-index: 1;
		color: var(--muted);
	}
	.topbar-brand:hover { color: var(--accent-strong); }
	.topbar-label {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem;
		letter-spacing: 0.14em;
		color: var(--muted);
		opacity: 0.45;
		margin-left: 1.2rem;
		position: relative;
		z-index: 1;
	}
	.layer-switch {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: 1.4rem;
		position: relative;
		z-index: 1;
	}
	.layer-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.5;
		transition:
			color 0.18s ease,
			background 0.18s ease,
			border-color 0.18s ease,
			opacity 0.18s ease;
	}
	.layer-btn:hover { opacity: 0.9; color: var(--accent-strong); }
	.layer-btn.active {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.topbar-divider {
		display: inline-block;
		width: 1px;
		height: 14px;
		background: var(--rule);
		margin: 0 0.9rem;
		opacity: 0.6;
		position: relative;
		z-index: 1;
	}
	.pockets-toggle {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 3px 9px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.5;
		display: inline-flex;
		align-items: center;
		gap: 0.45em;
		position: relative;
		z-index: 1;
		transition:
			color 0.22s ease,
			background 0.22s ease,
			border-color 0.22s ease,
			opacity 0.22s ease,
			transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pockets-toggle:hover { opacity: 0.9; color: var(--accent-strong); }
	.pockets-toggle.on {
		color: var(--accent-strong);
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		transform: translateY(-1px);
	}
	.pockets-count {
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		padding: 1px 5px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--accent) 30%, transparent);
		color: var(--accent-strong);
		opacity: 0.85;
	}
	.topbar-clock {
		margin-left: auto;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		position: relative;
		z-index: 1;
	}

	.editor-wrap {
		position: relative;
		z-index: 2;
		max-width: 680px;
		margin: 0 auto;
		padding: 84px clamp(1.5rem, 5vw, 2.5rem) 96px;
		transition: max-width 0.3s ease;
	}
	.editor-wrap[data-layer='midground'] { max-width: 600px; }
	.editor-wrap[data-layer='background'] { max-width: 540px; }

	.doc-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.45;
		margin-bottom: 1rem;
	}

	.doc-title {
		font-family: var(--editor-display, var(--font-display));
		font-size: clamp(2rem, 6vw, 3.4rem);
		font-weight: 300;
		font-style: italic;
		color: var(--accent-strong);
		background: none;
		border: none;
		outline: none;
		width: 100%;
		padding: 0;
		margin-bottom: 2.4rem;
		caret-color: var(--accent-deep);
		line-height: 1.1;
	}
	.doc-title::placeholder { color: var(--muted); opacity: 0.28; }

	.toolbar {
		display: flex;
		align-items: center;
		gap: 1px;
		padding-bottom: 0.75rem;
		margin-bottom: 1.6rem;
		border-bottom: 1px solid var(--rule);
		flex-wrap: wrap;
		row-gap: 4px;
	}
	.tool-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.05em;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 4px 9px;
		border-radius: 5px;
		cursor: pointer;
		transition:
			background 0.14s ease,
			color 0.14s ease,
			border-color 0.14s ease;
		line-height: 1.2;
		user-select: none;
	}
	.tool-btn:hover {
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.tool-btn.active {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.tool-sep {
		width: 1px;
		height: 13px;
		background: var(--rule);
		margin: 0 5px;
		flex-shrink: 0;
	}

	/* Body fonts: high specificity to override any inline font-family from
	 * pasted content. The cascade-controlled var() still wins as long as
	 * pasted text doesn't bring its own inline style — which sanitizeHtml
	 * strips on paste/load/publish. */
	.doc-body,
	.doc-body :global(*) {
		font-family: var(--editor-body, var(--font-body));
	}
	.doc-body :global(h1),
	.doc-body :global(h2),
	.doc-body :global(h3) {
		font-family: var(--editor-display, var(--font-display));
	}

	.doc-body {
		font-size: 1.05rem;
		line-height: 1.9;
		color: var(--text);
		min-height: 52vh;
		outline: none;
		caret-color: var(--accent-deep);
	}
	.doc-body.hidden { display: none; }
	.doc-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		opacity: 0.3;
		pointer-events: none;
		font-style: italic;
	}
	.doc-body :global(h1) {
		font-size: 2rem;
		font-weight: 300;
		color: var(--accent-strong);
		line-height: 1.15;
		margin: 1.8em 0 0.4em;
	}
	.doc-body :global(h2) {
		font-size: 1.35rem;
		font-weight: 300;
		font-style: italic;
		color: var(--accent-deep);
		line-height: 1.2;
		margin: 1.4em 0 0.35em;
	}
	.doc-body :global(p) { margin-bottom: 1em; }
	.doc-body :global(p:last-child) { margin-bottom: 0; }
	.doc-body :global(blockquote) {
		border-left: 2px solid var(--accent);
		padding: 0.1em 0 0.1em 1.2em;
		margin: 1.3em 0;
		font-style: italic;
		color: var(--muted);
	}
	.doc-body :global(ul),
	.doc-body :global(ol) { padding-left: 1.4em; margin: 0.8em 0; }
	.doc-body :global(li) { margin-bottom: 0.2em; }
	.doc-body :global(a) {
		color: var(--accent-strong);
		text-decoration: none;
		border-bottom: 1px solid color-mix(in srgb, var(--accent-strong) 22%, transparent);
	}
	.doc-body :global(a:hover) { border-bottom-color: var(--accent-strong); }
	.doc-body :global(strong) { font-weight: 600; }
	.doc-body :global(em) { font-style: italic; }

	.layer-midground {
		font-size: 0.98rem;
		line-height: 1.78;
		color: var(--muted);
	}
	.layer-background {
		font-size: 0.9rem;
		line-height: 1.7;
		color: var(--muted);
		opacity: 0.78;
		font-style: italic;
	}

	/* ── pockets panel (inside cover) ── */
	.pockets-panel {
		margin-top: 3.2rem;
		padding-top: 0;
	}
	.pockets-divider {
		height: 1px;
		width: 100%;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--rule) 18%,
			color-mix(in srgb, var(--accent) 35%, transparent) 50%,
			var(--rule) 82%,
			transparent 100%
		);
		opacity: 0.7;
		margin-bottom: 1.4rem;
	}
	.pockets-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1.2rem;
	}
	.pockets-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.55;
	}
	.pockets-order {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px dashed transparent;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.55;
		transition:
			color 0.18s ease,
			border-color 0.18s ease,
			opacity 0.18s ease,
			transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pockets-order:hover {
		opacity: 0.95;
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
		transform: translateY(-1px);
	}
	.pockets-list {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.pockets-empty {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		color: var(--muted);
		opacity: 0.4;
		font-style: italic;
		padding: 1.2rem 0.4rem;
		text-align: center;
	}
	.pocket-card {
		position: relative;
		padding: 0.95rem 2.4rem 0.95rem 1.1rem;
		border: 1px solid var(--rule);
		border-radius: 8px;
		background: color-mix(in srgb, var(--surface) 55%, transparent);
		transition:
			border-color 0.22s ease,
			background 0.22s ease,
			box-shadow 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-card:focus-within {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--surface) 80%, transparent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 18%, transparent);
	}
	.pocket-card-background {
		background: color-mix(in srgb, var(--surface) 35%, transparent);
		border-style: dashed;
		opacity: 0.92;
	}
	.pocket-layer-chip {
		position: absolute;
		top: 0.5rem;
		left: 0.55rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		padding: 1px 5px;
		border-radius: 6px;
		opacity: 0.6;
		pointer-events: none;
	}
	.pocket-card-background .pocket-layer-chip {
		color: var(--accent-deep);
		opacity: 0.7;
	}
	.pocket-body {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.96rem;
		line-height: 1.65;
		color: var(--text);
		outline: none;
		caret-color: var(--accent-deep);
		min-height: 1.5em;
		margin-top: 0.6rem;
	}
	.pocket-body :global(*) { font-family: var(--editor-body, var(--font-body)); }
	.pocket-card-background .pocket-body {
		font-style: italic;
		color: var(--muted);
		font-size: 0.92rem;
	}
	.pocket-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		opacity: 0.35;
		pointer-events: none;
		font-style: italic;
	}
	.pocket-body :global(strong) { font-weight: 600; }
	.pocket-body :global(em) { font-style: italic; }
	.pocket-controls {
		position: absolute;
		top: 0.4rem;
		right: 0.5rem;
	}
	.pocket-x {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.85rem;
		line-height: 1;
		color: var(--muted);
		background: none;
		border: none;
		padding: 4px 7px;
		border-radius: 50%;
		cursor: pointer;
		opacity: 0.35;
		transition:
			color 0.18s ease,
			background 0.18s ease,
			opacity 0.18s ease,
			transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-x:hover {
		opacity: 0.95;
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		transform: rotate(90deg);
	}
	.pocket-confirm {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		padding: 3px 10px;
		border-radius: 12px;
		cursor: pointer;
		font-style: italic;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-confirm:hover {
		background: color-mix(in srgb, var(--accent) 40%, transparent);
		border-color: var(--accent-strong);
		transform: translateY(-1px);
	}
	.pocket-add {
		display: inline-flex;
		align-items: center;
		gap: 0.55em;
		margin-top: 1.1rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: none;
		border: 1px dashed var(--rule);
		padding: 8px 16px;
		border-radius: 100px;
		cursor: pointer;
		opacity: 0.7;
		transition:
			color 0.22s ease,
			border-color 0.22s ease,
			background 0.22s ease,
			opacity 0.22s ease,
			transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-add:hover {
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		opacity: 1;
		transform: translateY(-1px);
	}
	.pocket-add-plus {
		font-size: 0.85rem;
		line-height: 1;
		font-weight: 400;
	}

	.bottom-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		min-height: 46px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 1.8rem;
		background: var(--surface);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
		border-top: 1px solid var(--rule);
		z-index: 20;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.bottom-meta {
		display: flex;
		align-items: center;
		gap: 1.2rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.57rem;
		letter-spacing: 0.1em;
		flex-wrap: wrap;
	}
	.save-status {
		transition:
			color 0.3s ease,
			opacity 0.3s ease;
		color: var(--muted);
		opacity: 0.5;
	}
	.save-status.saving { color: var(--accent-deep); opacity: 0.9; }
	.word-count { color: var(--muted); opacity: 0.45; }
	.picker-sep { color: var(--muted); opacity: 0.3; }
	.picker {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.picker-label {
		color: var(--muted);
		opacity: 0.55;
		text-transform: uppercase;
	}
	.picker-select {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		color: var(--accent-strong);
		background: transparent;
		border: 1px solid var(--rule);
		padding: 3px 18px 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
			linear-gradient(-45deg, transparent 50%, var(--muted) 50%);
		background-position:
			calc(100% - 9px) 50%,
			calc(100% - 5px) 50%;
		background-size: 4px 4px, 4px 4px;
		background-repeat: no-repeat;
	}
	.picker-select:focus { outline: none; border-color: var(--accent); }

	.publish-cluster {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.publish-warn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		color: var(--muted);
		opacity: 0.7;
		font-style: italic;
	}
	.publish-hint {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		color: var(--muted);
		opacity: 0.5;
	}

	.publish-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-weight: 300;
		font-size: 0.62rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bg);
		background: var(--accent-strong);
		border: none;
		padding: 8px 24px;
		border-radius: 100px;
		cursor: pointer;
		transition:
			background 0.2s ease,
			transform 0.15s ease,
			box-shadow 0.2s ease;
	}
	.publish-btn:hover {
		background: var(--accent-deep);
		transform: translateY(-1px);
	}
	.publish-btn:active { transform: translateY(0); }

	.overlay {
		position: fixed;
		inset: 0;
		background: color-mix(in srgb, var(--bg) 0%, transparent);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 100;
		pointer-events: none;
		transition: background 0.5s ease;
	}
	.overlay.active {
		background: color-mix(in srgb, var(--bg) 94%, transparent);
		pointer-events: all;
	}
	.overlay-word {
		font-family: var(--editor-display, var(--font-display));
		font-size: clamp(2.5rem, 7vw, 4.5rem);
		font-weight: 300;
		font-style: italic;
		color: var(--accent-strong);
		opacity: 0;
		transform: translateY(12px);
		transition:
			opacity 0.55s ease 0.35s,
			transform 0.55s ease 0.35s;
	}
	.overlay.active .overlay-word { opacity: 1; transform: translateY(0); }
	.overlay-sub {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0;
		margin-top: 1rem;
		transition: opacity 0.4s ease 0.65s;
	}
	.overlay.active .overlay-sub { opacity: 0.5; }
</style>
