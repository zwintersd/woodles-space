<script lang="ts">
	import { onMount } from 'svelte';
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

	let title = $state('');
	let theme = $state('cream');
	let motif = $state('blobs');
	let font = $state('classic');
	let bodyEl: HTMLDivElement | undefined = $state();
	let titleEl: HTMLInputElement | undefined = $state();
	let saveStatus = $state<'saved' | 'saving'>('saved');
	let wordCount = $state(0);
	let bold = $state(false);
	let italic = $state(false);
	let underline = $state(false);
	let publishing = $state(false);

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let hydrated = $state(false);

	onMount(() => {
		// Templates take precedence over the saved draft so /write?template=
		// is always a fresh start.
		const params = new URLSearchParams(window.location.search);
		const tid = params.get('template');
		if (tid) {
			const t = findTemplate(tid);
			if (t && bodyEl) {
				title = t.sampleTitle;
				theme = t.palette;
				motif = t.motif;
				font = t.font;
				bodyEl.innerHTML = t.sampleContent;
				updateWordCount();
				history.replaceState(null, '', window.location.pathname);
				hydrated = true;
				scheduleSave();
				return;
			}
		}

		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (raw && bodyEl) {
				const d = JSON.parse(raw);
				title = d.title || '';
				bodyEl.innerHTML = d.content || '';
				if (d.theme) theme = d.theme;
				if (d.motif) motif = d.motif;
				if (d.font) font = d.font;
				updateWordCount();
			}
		} catch (e) {
			// ignore corrupt draft
		}
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

	function updateWordCount() {
		const text = bodyEl?.innerText || '';
		const n = text.trim().split(/\s+/).filter((w) => w.length).length;
		wordCount = n;
	}

	function scheduleSave() {
		if (!hydrated) return;
		saveStatus = 'saving';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			try {
				localStorage.setItem(
					DRAFT_KEY,
					JSON.stringify({
						title,
						content: bodyEl?.innerHTML ?? '',
						theme,
						motif,
						font,
						savedAt: new Date().toISOString()
					})
				);
			} catch (e) {
				// ignore quota / disabled storage
			}
			saveStatus = 'saved';
		}, 700);
	}

	$effect(() => {
		// re-save whenever the chosen tokens change (after hydration)
		void theme;
		void motif;
		void font;
		if (hydrated) scheduleSave();
	});

	function exec(cmd: string, val: string | null = null) {
		document.execCommand(cmd, false, val ?? undefined);
		bodyEl?.focus();
		updateToolbarState();
	}

	function insertLink() {
		const url = prompt('URL:');
		if (url) exec('createLink', url);
	}

	function updateToolbarState() {
		bold = document.queryCommandState('bold');
		italic = document.queryCommandState('italic');
		underline = document.queryCommandState('underline');
	}

	function publish() {
		const issue = parseInt(localStorage.getItem(ISSUE_KEY) || '0') + 1;
		localStorage.setItem(ISSUE_KEY, String(issue));
		try {
			localStorage.setItem(
				PUBLISHED_KEY,
				JSON.stringify({
					title: title.trim() || 'untitled letter',
					content: bodyEl?.innerHTML ?? '',
					theme,
					motif,
					font,
					issue,
					publishedAt: new Date().toISOString()
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
</script>

<div class="motif-grain"></div>
<div class="motif-blob motif-blob-1"></div>
<div class="motif-blob motif-blob-2"></div>
<div class="motif-blob motif-blob-3"></div>
<div class="motif-blob motif-blob-4"></div>

<header class="topbar">
	<a href="/" class="topbar-brand">.space</a>
	<span class="topbar-label">echoes · write</span>
	<div class="topbar-clock"><Clock /></div>
</header>

<div class="overlay" class:active={publishing}>
	<p class="overlay-word">published.</p>
	<p class="overlay-sub">woodles.space / echoes</p>
</div>

<div class="editor-wrap">
	<p class="doc-eyebrow">echoes</p>
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

	<div
		bind:this={bodyEl}
		class="doc-body"
		contenteditable="true"
		spellcheck="true"
		data-placeholder="Begin writing your letter…"
		oninput={() => {
			updateWordCount();
			scheduleSave();
		}}
		onkeyup={updateToolbarState}
		onmouseup={updateToolbarState}
		role="textbox"
		tabindex="0"
	></div>
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
	<button class="publish-btn" onclick={publish}>Publish →</button>
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
		0% {
			background-position: 0% 0;
		}
		50% {
			background-position: 100% 0;
		}
		100% {
			background-position: 0% 0;
		}
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
	.topbar-brand:hover {
		color: var(--accent-strong);
	}
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
	}

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
	.doc-title::placeholder {
		color: var(--muted);
		opacity: 0.28;
	}

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

	.doc-body {
		font-family: var(--editor-body, var(--font-body));
		font-size: 1.05rem;
		line-height: 1.9;
		color: var(--text);
		min-height: 52vh;
		outline: none;
		caret-color: var(--accent-deep);
	}
	.doc-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		opacity: 0.3;
		pointer-events: none;
		font-style: italic;
	}
	.doc-body :global(h1) {
		font-family: var(--editor-display, var(--font-display));
		font-size: 2rem;
		font-weight: 300;
		color: var(--accent-strong);
		line-height: 1.15;
		margin: 1.8em 0 0.4em;
	}
	.doc-body :global(h2) {
		font-family: var(--editor-display, var(--font-display));
		font-size: 1.35rem;
		font-weight: 300;
		font-style: italic;
		color: var(--accent-deep);
		line-height: 1.2;
		margin: 1.4em 0 0.35em;
	}
	.doc-body :global(p) {
		margin-bottom: 1em;
	}
	.doc-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.doc-body :global(blockquote) {
		border-left: 2px solid var(--accent);
		padding: 0.1em 0 0.1em 1.2em;
		margin: 1.3em 0;
		font-style: italic;
		color: var(--muted);
	}
	.doc-body :global(ul),
	.doc-body :global(ol) {
		padding-left: 1.4em;
		margin: 0.8em 0;
	}
	.doc-body :global(li) {
		margin-bottom: 0.2em;
	}
	.doc-body :global(a) {
		color: var(--accent-strong);
		text-decoration: none;
		border-bottom: 1px solid color-mix(in srgb, var(--accent-strong) 22%, transparent);
	}
	.doc-body :global(a:hover) {
		border-bottom-color: var(--accent-strong);
	}
	.doc-body :global(strong) {
		font-weight: 600;
	}
	.doc-body :global(em) {
		font-style: italic;
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
	.save-status.saving {
		color: var(--accent-deep);
		opacity: 0.9;
	}
	.word-count {
		color: var(--muted);
		opacity: 0.45;
	}
	.picker-sep {
		color: var(--muted);
		opacity: 0.3;
	}
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
		background-size:
			4px 4px,
			4px 4px;
		background-repeat: no-repeat;
	}
	.picker-select:focus {
		outline: none;
		border-color: var(--accent);
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
	.publish-btn:active {
		transform: translateY(0);
	}

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
	.overlay.active .overlay-word {
		opacity: 1;
		transform: translateY(0);
	}
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
	.overlay.active .overlay-sub {
		opacity: 0.5;
	}
</style>
