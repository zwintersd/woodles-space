<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { book } from '$lib/witch/book.svelte';
	import { createReadingTimer } from '$lib/reading/timer';
	import {
		paragraphsFromText,
		paragraphsFromDom,
		paragraphsFromLetterHtml,
		stampLiveAnchors,
		newNoteId,
		countWordsInText,
		type Paragraph,
		type MarginNote
	} from '$lib/reading/text';
	import { loadDoc, persistDoc as persistDocToStorage, wipeDoc } from '$lib/reading/doc';
	import { formatHms, formatMin } from '$lib/reading/format';
	import { echoesLibrary } from '$lib/reading/echoesLibrary.svelte';
	import type { PublicLetter } from '@woodles/sync';
	import Star from './Star.svelte';
	import StarShelf from './StarShelf.svelte';
	import Passage from './Passage.svelte';
	import MarginNotes from './MarginNotes.svelte';
	import EditorToolbar from './EditorToolbar.svelte';
	import Intake from './Intake.svelte';
	import SelectionBubble, { type BubbleAction } from './SelectionBubble.svelte';

	const POINT_MS = 20 * 60 * 1000;
	const WPM = 230;
	const PERSIST_INTERVAL_MS = 3_000;

	let paneEl: HTMLElement | undefined = $state();
	let passageEl: HTMLElement | undefined = $state();
	let marginColumnEl: HTMLElement | undefined = $state();
	let pasteText = $state('');
	let mode = $state<'paste' | 'read'>('paste');
	let truncated = $state(false);

	// Reading document — paragraphs and notes.
	let paragraphs = $state<Paragraph[]>([]);
	let notes = $state<MarginNote[]>([]);
	let anchorOffsets = $state<Record<string, number>>({});
	let docKey = $state(0); // bumped to force-remount Passage on a new doc

	// Selection state for the bubble popover.
	let selectionRect = $state<{ top: number; left: number; width: number } | null>(null);
	let selectionAnchorId = $state<string | null>(null);

	// Live counters
	let sessionMs = $state(0);
	let nowTick = $state(0);

	let liveWordCount = $state(0);

	const timer = createReadingTimer({
		onAccrueMs: (dt) => {
			book.creditReadingMs(dt);
			sessionMs += dt;
			nowTick++;
		}
	});

	const progress = $derived.by(() => {
		void nowTick;
		return book.readingMsTowardNextPoint / POINT_MS;
	});

	const estimatedReadingMin = $derived(liveWordCount > 0 ? liveWordCount / WPM : 0);

	function persistDoc() {
		persistDocToStorage({ text: pasteText, paragraphs, notes });
	}

	function hydrateFromStorage(): boolean {
		const doc = loadDoc();
		if (!doc) return false;
		pasteText = doc.text;
		paragraphs = doc.paragraphs;
		notes = doc.notes;
		liveWordCount = doc.wordCount;
		return true;
	}

	async function onPdfCommit(text: string, wasTruncated: boolean) {
		truncated = wasTruncated;
		pasteText = text;
		paragraphs = paragraphsFromText(text);
		notes = [];
		liveWordCount = countWordsInText(text);
		book.addReadingWords(liveWordCount);
		mode = 'read';
		docKey++;
		persistDoc();
		await tick();
		measureAnchors();
	}

	// Epub chapters arrive as already-structured HTML (headings, emphasis,
	// lists), so this skips the plain-text pasteText step entirely and reuses
	// the same sanitize-to-paragraphs pipeline as `readLetter` below rather
	// than flattening a book down to paragraphsFromText's blank-line guessing.
	async function onEpubCommit(
		html: string,
		meta: { title?: string; author?: string; truncated: boolean }
	) {
		truncated = meta.truncated;
		paragraphs = paragraphsFromLetterHtml(html);
		notes = [];
		// Persisted as `text` too (not '') so a refreshed tab still finds a
		// truthy `doc.text` and recomputes the right word count on reload —
		// see loadDoc()'s `parsed?.text` check in doc.ts.
		const plain = passageTextOf(paragraphs);
		pasteText = plain;
		liveWordCount = countWordsInText(plain);
		book.addReadingWords(liveWordCount);
		mode = 'read';
		docKey++;
		persistDoc();
		await tick();
		measureAnchors();
	}

	// Reads one of Z's published letters instead of pasted-in text
	// (ROADMAP.md week 7) — same downstream pipeline (paragraphs, anchors,
	// annotation, persistence) as paste/PDF intake; only the source differs.
	async function readLetter(letter: PublicLetter) {
		truncated = false;
		pasteText = '';
		const html = letter.layers?.foreground?.html || letter.content || '';
		paragraphs = paragraphsFromLetterHtml(html);
		notes = [];
		liveWordCount = countWordsInText(passageTextOf(paragraphs));
		book.addReadingWords(liveWordCount);
		mode = 'read';
		docKey++;
		persistDoc();
		await tick();
		measureAnchors();
	}

	function passageTextOf(paras: Paragraph[]): string {
		return paras.map((p) => p.html.replace(/<[^>]+>/g, ' ')).join(' ');
	}

	function newText() {
		mode = 'paste';
		pasteText = '';
		paragraphs = [];
		notes = [];
		anchorOffsets = {};
		liveWordCount = 0;
		truncated = false;
		selectionRect = null;
		selectionAnchorId = null;
		docKey++;
		wipeDoc();
	}

	function onEnter() {
		timer.setPresent(true);
	}

	function onLeave() {
		timer.setPresent(false);
	}

	function onUnload() {
		book.persist();
		persistDoc();
	}

	// ── editor commands ─────────────────────────────────────────────────────

	function focusPassage() {
		if (passageEl && document.activeElement !== passageEl) {
			passageEl.focus();
		}
	}

	function runCommand(cmd: string, value?: string) {
		focusPassage();
		try {
			document.execCommand(cmd, false, value);
		} catch {
			// some browsers throw on legacy execCommand; ignore
		}
		// Recount + re-measure after any block change.
		afterEdit();
	}

	function applyInlineFormat(cmd: string) {
		runCommand(cmd);
	}

	function applyHighlight() {
		// Wrap the current selection in <mark>. Done manually so we don't rely
		// on hiliteColor (which would emit a style attribute that our sanitizer
		// strips, dropping the highlight on next save).
		focusPassage();
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
		const range = sel.getRangeAt(0);
		if (!passageEl || !passageEl.contains(range.commonAncestorContainer)) return;

		// If the selection is entirely inside an existing <mark>, unwrap it.
		const ancestor =
			range.commonAncestorContainer.nodeType === Node.TEXT_NODE
				? range.commonAncestorContainer.parentElement
				: (range.commonAncestorContainer as Element);
		const existingMark = ancestor?.closest('mark');
		if (existingMark && passageEl.contains(existingMark)) {
			const parent = existingMark.parentNode;
			if (parent) {
				while (existingMark.firstChild) parent.insertBefore(existingMark.firstChild, existingMark);
				parent.removeChild(existingMark);
			}
		} else {
			const mark = document.createElement('mark');
			try {
				mark.appendChild(range.extractContents());
				range.insertNode(mark);
				sel.removeAllRanges();
				const r = document.createRange();
				r.selectNodeContents(mark);
				sel.addRange(r);
			} catch {
				// selection spans non-contiguous nodes — bail
			}
		}
		afterEdit();
	}

	function applyLink() {
		focusPassage();
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
		const url = window.prompt('link url:');
		if (!url) return;
		if (!/^(https?:|mailto:|#)/i.test(url.trim())) return;
		document.execCommand('createLink', false, url.trim());
		afterEdit();
	}

	function afterEdit() {
		// Passage emits onChange on input, but execCommand-driven edits don't
		// always trigger input events in older engines. Force a re-read.
		if (!passageEl) return;
		stampLiveAnchors(passageEl);
		paragraphs = paragraphsFromDom(passageEl);
		updateWordCount();
		persistDoc();
		measureAnchors();
	}

	function updateWordCount() {
		if (!passageEl) return;
		liveWordCount = countWordsInText(passageEl.innerText ?? '');
	}

	// ── passage change wiring ───────────────────────────────────────────────

	function onPassageChange(next: Paragraph[]) {
		paragraphs = next;
		updateWordCount();
		persistDoc();
	}

	function onPassageAnchorsChanged() {
		// Schedule a measure pass after the DOM settles.
		queueMicrotask(measureAnchors);
	}

	// ── annotation flow ─────────────────────────────────────────────────────

	function measureAnchors() {
		if (!passageEl) return;
		const top = passageEl.getBoundingClientRect().top;
		const next: Record<string, number> = {};
		passageEl.querySelectorAll('[data-anchor]').forEach((el) => {
			const id = el.getAttribute('data-anchor');
			if (!id) return;
			next[id] = (el as HTMLElement).getBoundingClientRect().top - top;
		});
		anchorOffsets = next;
	}

	function onSelectionChange() {
		if (typeof window === 'undefined') return;
		if (mode !== 'read' || !passageEl) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		const range = sel.getRangeAt(0);
		const container =
			range.commonAncestorContainer.nodeType === Node.TEXT_NODE
				? range.commonAncestorContainer.parentElement
				: (range.commonAncestorContainer as Element);
		if (!container || !passageEl.contains(container)) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		let block: Element | null = container;
		while (block && block !== passageEl) {
			if (block instanceof HTMLElement && block.hasAttribute('data-anchor')) break;
			block = block.parentElement;
		}
		if (!block || block === passageEl) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		const r = range.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) {
			selectionRect = null;
			selectionAnchorId = null;
			return;
		}
		selectionAnchorId = (block as HTMLElement).getAttribute('data-anchor');
		selectionRect = { top: r.top, left: r.left, width: r.width };
	}

	async function addNoteFor(anchorId: string) {
		const now = new Date().toISOString();
		const note: MarginNote = {
			id: newNoteId(),
			anchorId,
			html: '',
			createdAt: now,
			updatedAt: now
		};
		notes = [...notes, note];
		selectionRect = null;
		selectionAnchorId = null;
		window.getSelection()?.removeAllRanges();
		persistDoc();
		await tick();
		measureAnchors();
		const el = document.querySelector<HTMLElement>(`[data-margin-id="${note.id}"]`);
		el?.focus();
	}

	function onNoteChange(id: string, html: string) {
		notes = notes.map((n) =>
			n.id === id ? { ...n, html, updatedAt: new Date().toISOString() } : n
		);
		persistDoc();
	}

	function onNoteDelete(id: string) {
		notes = notes.filter((n) => n.id !== id);
		persistDoc();
	}

	// SelectionBubble.preventDefault() has already fired before this is called,
	// so the selection survives the dispatch.
	function onBubbleAction(action: BubbleAction) {
		switch (action) {
			case 'bold':
			case 'italic':
			case 'underline':
			case 'strikethrough':
				applyInlineFormat(action);
				return;
			case 'highlight':
				applyHighlight();
				return;
			case 'link':
				applyLink();
				return;
			case 'note':
				if (selectionAnchorId) addNoteFor(selectionAnchorId);
				return;
		}
	}

	onMount(() => {
		const hadDoc = hydrateFromStorage();
		if (hadDoc) mode = 'read';
		void echoesLibrary.load();
		timer.start();
		const id = setInterval(() => {
			book.persist();
			persistDoc();
		}, PERSIST_INTERVAL_MS);
		window.addEventListener('beforeunload', onUnload);
		document.addEventListener('selectionchange', onSelectionChange);
		window.addEventListener('resize', measureAnchors);
		window.addEventListener('scroll', measureAnchors, { passive: true });

		if (
			typeof window !== 'undefined' &&
			window.location.hash === '#reading-room' &&
			paneEl
		) {
			paneEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}

		tick().then(() => {
			measureAnchors();
			updateWordCount();
		});

		return () => {
			clearInterval(id);
			window.removeEventListener('beforeunload', onUnload);
			document.removeEventListener('selectionchange', onSelectionChange);
			window.removeEventListener('resize', measureAnchors);
			window.removeEventListener('scroll', measureAnchors);
		};
	});

	onDestroy(() => {
		timer.stop();
		book.persist();
		persistDoc();
	});

	const accruing = $derived.by(() => {
		void nowTick;
		return timer.isAccruing();
	});

	const hasNotes = $derived(notes.length > 0);
</script>

<section
	id="reading-room"
	class="reading-room"
	class:wide={mode === 'read'}
	bind:this={paneEl}
	onpointerenter={onEnter}
	onpointerleave={onLeave}
	aria-labelledby="reading-room-title"
>
	<header class="head">
		<h3 id="reading-room-title">reading for the stars</h3>
		<p class="sub">a quiet room. read at your own pace — the timer follows your cursor. write back into the text or out into the margin.</p>
	</header>

	<div class="board" class:read={mode === 'read'}>
		<div class="active-star">
			<Star points={book.readingStarPoints} progress={progress} active size={120} />
			<p class="points">
				<span class="num">{book.readingStarPoints}</span> / 5 points
				{#if book.readingCompletedStars > 0}
					· <span class="num">{book.readingCompletedStars}</span>
					completed
				{/if}
			</p>
			<p class="time" class:idle={!accruing}>
				{formatHms(sessionMs)} this session
				{#if !accruing && mode === 'read'}
					<span class="paused">— paused</span>
				{/if}
			</p>
			{#if mode === 'read' && hasNotes}
				<p class="notes-count">
					<span class="num">{notes.length}</span>
					note{notes.length === 1 ? '' : 's'} in the margin
				</p>
			{/if}
		</div>

		<div class="reader">
			{#if mode === 'paste'}
				<Intake bind:pasteText onCommit={onPdfCommit} {onEpubCommit} />

				{#if echoesLibrary.status === 'ready'}
					<div class="echoes-picker">
						<p class="echoes-picker-label">or read one of Z's letters</p>
						<ul class="echoes-picker-list">
							{#each echoesLibrary.letters as letter (letter.id)}
								<li>
									<button class="echoes-picker-item" onclick={() => readLetter(letter)}>
										<span class="echoes-picker-title">{letter.title || 'untitled letter'}</span>
										<span class="echoes-picker-issue">№ {String(letter.issue).padStart(3, '0')}</span>
									</button>
								</li>
							{/each}
						</ul>
						<a class="echoes-picker-link" href="/letter">read these (and more) at echoes →</a>
					</div>
				{:else if echoesLibrary.status === 'error'}
					<p class="echoes-picker-note">
						couldn't reach Z's letters right now — paste your own text instead.
					</p>
				{/if}
			{:else}
				<div class="text-meta">
					<span><span class="num">{liveWordCount.toLocaleString()}</span> words</span>
					<span>· about <span class="num">{formatMin(estimatedReadingMin)}</span></span>
					<button class="ghost" type="button" onclick={newText}>new text</button>
				</div>
				{#if truncated}
					<p class="notice">— text was longer than 500k characters; the rest was set aside.</p>
				{/if}
				<EditorToolbar onCommand={runCommand} />
				<div class="passage-and-margin">
					{#key docKey}
						<Passage
							{paragraphs}
							onChange={onPassageChange}
							onAnchorsChanged={onPassageAnchorsChanged}
							bind:rootEl={passageEl}
						/>
					{/key}
					<div class="margin-wrap">
						<MarginNotes
							{notes}
							{anchorOffsets}
							onChange={onNoteChange}
							onDelete={onNoteDelete}
							bind:columnEl={marginColumnEl}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<footer class="shelf-wrap">
		<h4>the shelf</h4>
		<StarShelf count={book.readingCompletedStars} />
	</footer>
</section>

<SelectionBubble
	rect={selectionRect && selectionAnchorId && mode === 'read' ? selectionRect : null}
	onAction={onBubbleAction}
/>

<style>
	.reading-room {
		max-width: 44rem;
		margin: 1.2rem auto 0;
		padding: 1rem 1rem 1.2rem;
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel);
		transition: max-width 240ms ease;
	}
	.reading-room.wide {
		max-width: 64rem;
	}
	.head {
		text-align: center;
		margin-bottom: 0.8rem;
	}
	h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.2rem;
		color: var(--periwinkle);
		margin: 0 0 0.15rem;
	}
	.sub {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
		margin: 0;
	}
	.board {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1.2rem;
		align-items: start;
	}
	@media (max-width: 600px) {
		.board {
			grid-template-columns: 1fr;
			justify-items: center;
		}
	}
	.active-star {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}
	.notes-count {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		color: var(--muted);
		margin: 0;
	}
	.points {
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0;
	}
	.time {
		font-family: var(--font-counter);
		font-size: 0.95rem;
		color: var(--cyan);
		margin: 0;
		transition: opacity 220ms;
	}
	.time.idle {
		color: var(--muted);
		opacity: 0.65;
	}
	.paused {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--print-pink);
		margin-left: 0.4rem;
	}
	.num {
		font-family: var(--font-counter);
		color: var(--leafeon-pink);
	}
	.reader {
		min-width: 0;
	}
	.text-meta {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
		margin-bottom: 0.6rem;
		flex-wrap: wrap;
	}
	.ghost {
		margin-left: auto;
		font-family: var(--font-ui);
		font-size: 0.76rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.ghost:hover {
		color: var(--leafeon-pink);
	}
	.notice {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--print-pink);
		margin: 0 0 0.5rem;
	}
	.echoes-picker {
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px dashed var(--rule);
	}
	.echoes-picker-label {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.5rem;
	}
	.echoes-picker-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.echoes-picker-item {
		width: 100%;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 0.45rem 0.65rem;
		text-align: left;
		transition: border-color 120ms, background 120ms;
	}
	.echoes-picker-item:hover {
		border-color: var(--cyan);
		background: var(--panel-accent);
	}
	.echoes-picker-title {
		font-family: var(--font-hand);
		font-size: 1rem;
		color: var(--cream);
	}
	.echoes-picker-issue {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		color: var(--muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.echoes-picker-note {
		margin-top: 0.8rem;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.echoes-picker-link {
		display: inline-block;
		margin-top: 0.55rem;
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		color: var(--periwinkle);
		text-decoration: none;
	}
	.echoes-picker-link:hover {
		color: var(--cyan);
	}
	.passage-and-margin {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 16rem;
		gap: 1.2rem;
		align-items: start;
		padding: 0.4rem 0;
	}
	.margin-wrap {
		position: relative;
		border-left: 1px dashed var(--rule);
		padding-left: 0.6rem;
		min-height: 6rem;
	}
	@media (max-width: 760px) {
		.passage-and-margin {
			grid-template-columns: 1fr;
		}
		.margin-wrap {
			border-left: none;
			border-top: 1px dashed var(--rule);
			padding-left: 0;
			padding-top: 0.6rem;
		}
	}
	.shelf-wrap {
		margin-top: 1.1rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--rule);
	}
	h4 {
		font-family: var(--font-ui);
		font-weight: 500;
		font-size: 0.74rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.5rem;
	}

</style>
