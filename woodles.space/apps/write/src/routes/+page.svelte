<script lang="ts">
	import { onMount } from 'svelte';
	import Clock from '$lib/Clock.svelte';

	const DRAFT_KEY = 'woodles_write_draft';
	const PUBLISHED_KEY = 'woodles_published';
	const ISSUE_KEY = 'woodles_issue_count';

	let title = $state('');
	let bodyEl: HTMLDivElement | undefined = $state();
	let titleEl: HTMLInputElement | undefined = $state();
	let saveStatus = $state<'saved' | 'saving'>('saved');
	let wordCount = $state(0);
	let bold = $state(false);
	let italic = $state(false);
	let underline = $state(false);
	let publishing = $state(false);

	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (raw && bodyEl) {
				const d = JSON.parse(raw);
				title = d.title || '';
				bodyEl.innerHTML = d.content || '';
				updateWordCount();
			}
		} catch (e) {
			// ignore corrupt draft
		}
	});

	function updateWordCount() {
		const text = bodyEl?.innerText || '';
		const n = text.trim().split(/\s+/).filter((w) => w.length).length;
		wordCount = n;
	}

	function scheduleSave() {
		saveStatus = 'saving';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			try {
				localStorage.setItem(
					DRAFT_KEY,
					JSON.stringify({
						title,
						content: bodyEl?.innerHTML ?? '',
						savedAt: new Date().toISOString()
					})
				);
			} catch (e) {
				// quota or disabled — surface as still-saving and stop
			}
			saveStatus = 'saved';
		}, 700);
	}

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

<div class="blob blob-1"></div>
<div class="blob blob-2"></div>
<div class="blob blob-3"></div>

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
	:global(:root) {
		--lavender: #c9bfee;
		--aqua: #8eddd4;
		--peach: #f5c8a8;
		--lilac: #dbb8e8;
		--cream: #faf6f0;
		--lapis: #3a2d72;
		--plum: #5c3464;
		--text: #2e2040;
		--muted: #7a6b90;
	}
	:global(html),
	:global(body) {
		height: 100%;
	}
	:global(body) {
		background: var(--cream);
		color: var(--text);
		font-family: var(--font-mono);
		font-weight: 300;
		min-height: 100vh;
		overflow-x: hidden;
		position: relative;
	}
	:global(body)::before {
		content: '';
		position: fixed;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
		opacity: 0.04;
		pointer-events: none;
		z-index: 1;
	}

	.blob {
		position: fixed;
		border-radius: 50%;
		filter: blur(100px);
		opacity: 0.14;
		animation: drift 24s ease-in-out infinite alternate;
		pointer-events: none;
		z-index: 0;
	}
	.blob-1 {
		width: 500px;
		height: 500px;
		background: var(--lavender);
		top: -100px;
		left: -120px;
		animation-delay: 0s;
	}
	.blob-2 {
		width: 360px;
		height: 360px;
		background: var(--aqua);
		bottom: 8%;
		right: -80px;
		animation-delay: -9s;
	}
	.blob-3 {
		width: 260px;
		height: 260px;
		background: var(--lilac);
		top: 55%;
		left: 68%;
		animation-delay: -16s;
	}
	@keyframes drift {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(18px, -16px) scale(1.03);
		}
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
		background: rgba(250, 246, 240, 0.6);
		backdrop-filter: blur(22px);
		-webkit-backdrop-filter: blur(22px);
		overflow: hidden;
	}
	.topbar::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			105deg,
			rgba(201, 191, 238, 0.22) 0%,
			rgba(142, 221, 212, 0.14) 40%,
			rgba(219, 184, 232, 0.18) 80%,
			rgba(201, 191, 238, 0.22) 100%
		);
		background-size: 260% 100%;
		animation: bar-shimmer 11s ease-in-out infinite;
		pointer-events: none;
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
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.18em;
		text-decoration: none;
		position: relative;
		z-index: 1;
		animation: brand-hue 16s ease-in-out infinite;
	}
	@keyframes brand-hue {
		0%,
		100% {
			color: var(--muted);
		}
		30% {
			color: var(--lapis);
		}
		65% {
			color: var(--plum);
		}
	}
	.topbar-label {
		font-family: var(--font-mono);
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
		font-family: var(--font-mono);
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
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--muted);
		opacity: 0.45;
		margin-bottom: 1rem;
	}

	.doc-title {
		font-family: var(--font-display);
		font-size: clamp(2rem, 6vw, 3.4rem);
		font-weight: 300;
		font-style: italic;
		color: var(--lapis);
		background: none;
		border: none;
		outline: none;
		width: 100%;
		padding: 0;
		margin-bottom: 2.4rem;
		caret-color: var(--plum);
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
		border-bottom: 1px solid rgba(201, 191, 238, 0.2);
		flex-wrap: wrap;
		row-gap: 4px;
	}
	.tool-btn {
		font-family: var(--font-mono);
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
		background: rgba(201, 191, 238, 0.18);
		color: var(--lapis);
		border-color: rgba(201, 191, 238, 0.32);
	}
	.tool-btn.active {
		background: rgba(201, 191, 238, 0.22);
		color: var(--lapis);
		border-color: rgba(201, 191, 238, 0.4);
	}
	.tool-sep {
		width: 1px;
		height: 13px;
		background: rgba(201, 191, 238, 0.32);
		margin: 0 5px;
		flex-shrink: 0;
	}

	.doc-body {
		font-family: var(--font-body);
		font-size: 1.05rem;
		line-height: 1.9;
		color: var(--text);
		min-height: 52vh;
		outline: none;
		caret-color: var(--plum);
	}
	.doc-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		opacity: 0.3;
		pointer-events: none;
		font-style: italic;
	}
	.doc-body :global(h1) {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 300;
		color: var(--lapis);
		line-height: 1.15;
		margin: 1.8em 0 0.4em;
	}
	.doc-body :global(h2) {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 300;
		font-style: italic;
		color: var(--plum);
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
		border-left: 2px solid var(--lavender);
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
		color: var(--lapis);
		text-decoration: none;
		border-bottom: 1px solid rgba(58, 45, 114, 0.22);
	}
	.doc-body :global(a:hover) {
		border-bottom-color: var(--lapis);
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
		height: 46px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.8rem;
		background: rgba(250, 246, 240, 0.88);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
		border-top: 1px solid rgba(201, 191, 238, 0.16);
		z-index: 20;
	}
	.bottom-meta {
		display: flex;
		align-items: center;
		gap: 1.6rem;
		font-family: var(--font-mono);
		font-size: 0.57rem;
		letter-spacing: 0.1em;
	}
	.save-status {
		transition:
			color 0.3s ease,
			opacity 0.3s ease;
		color: var(--muted);
		opacity: 0.5;
	}
	.save-status.saving {
		color: var(--plum);
		opacity: 0.9;
	}
	.word-count {
		color: var(--muted);
		opacity: 0.45;
	}

	.publish-btn {
		font-family: var(--font-mono);
		font-weight: 300;
		font-size: 0.62rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--cream);
		background: var(--lapis);
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
		background: var(--plum);
		transform: translateY(-1px);
		box-shadow: 0 4px 18px rgba(92, 52, 100, 0.22);
	}
	.publish-btn:active {
		transform: translateY(0);
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(250, 246, 240, 0);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 100;
		pointer-events: none;
		transition: background 0.5s ease;
	}
	.overlay.active {
		background: rgba(250, 246, 240, 0.94);
		pointer-events: all;
	}
	.overlay-word {
		font-family: var(--font-display);
		font-size: clamp(2.5rem, 7vw, 4.5rem);
		font-weight: 300;
		font-style: italic;
		color: var(--lapis);
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
		font-family: var(--font-mono);
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
