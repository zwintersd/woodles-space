<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { game } from '$lib/state/game.svelte';
	import { createReadingTimer } from '$lib/reading/timer';
	import {
		splitParagraphs,
		newNoteId,
		type Paragraph,
		type MarginNote
	} from '$lib/reading/text';
	import Star from './Star.svelte';
	import StarShelf from './StarShelf.svelte';
	import Passage from './Passage.svelte';
	import MarginNotes from './MarginNotes.svelte';

	const POINT_MS = 20 * 60 * 1000;
	const PASTE_CAP = 500_000;
	const WPM = 230;
	const PERSIST_INTERVAL_MS = 3_000;
	const DOC_KEY = 'marginalia.reading.doc.v2';
	const LEGACY_PASTE_KEY = 'marginalia.reading.paste.v1';
	const PDF_CAP_BYTES = 32 * 1024 * 1024;

	interface ReadingDoc {
		text: string;
		paragraphs: Paragraph[];
		notes: MarginNote[];
	}

	let paneEl: HTMLElement | undefined = $state();
	let passageEl: HTMLElement | undefined = $state();
	let marginColumnEl: HTMLElement | undefined = $state();
	let pasteText = $state('');
	let mode = $state<'paste' | 'read'>('paste');
	let truncated = $state(false);

	// Current reading document.
	let paragraphs = $state<Paragraph[]>([]);
	let notes = $state<MarginNote[]>([]);
	let anchorOffsets = $state<Record<string, number>>({});

	// Selection state for the popover.
	let selectionRect = $state<{ top: number; left: number; width: number } | null>(null);
	let selectionAnchorId = $state<string | null>(null);

	// PDF ingestion
	let pdfLoading = $state(false);
	let pdfProgress = $state<{ page: number; totalPages: number } | null>(null);
	let pdfError = $state<string | null>(null);
	let fileInputEl: HTMLInputElement | undefined = $state();

	// Live counters
	let sessionMs = $state(0);
	let nowTick = $state(0);

	let committedWordCount = $state(0);

	const timer = createReadingTimer({
		onAccrueMs: (dt) => {
			game.creditReadingMs(dt);
			sessionMs += dt;
			nowTick++;
		}
	});

	const progress = $derived.by(() => {
		void nowTick;
		return game.readingMsTowardNextPoint / POINT_MS;
	});

	const estimatedReadingMin = $derived(committedWordCount > 0 ? committedWordCount / WPM : 0);

	function countWords(s: string): number {
		const trimmed = s.trim();
		if (!trimmed) return 0;
		return trimmed.split(/\s+/).length;
	}

	function formatHms(ms: number): string {
		const s = Math.floor(ms / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		const mm = String(m).padStart(2, '0');
		const ss = String(sec).padStart(2, '0');
		if (h > 0) return `${h}:${mm}:${ss}`;
		return `${mm}:${ss}`;
	}

	function formatMin(min: number): string {
		if (min < 1) return '< 1 min';
		const m = Math.round(min);
		if (m < 60) return `${m} min`;
		const h = Math.floor(m / 60);
		const r = m % 60;
		return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
	}

	function persistDoc() {
		try {
			const doc: ReadingDoc = { text: pasteText, paragraphs, notes };
			sessionStorage.setItem(DOC_KEY, JSON.stringify(doc));
		} catch {
			// ignore quota
		}
	}

	function loadDoc(): boolean {
		try {
			const raw = sessionStorage.getItem(DOC_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as ReadingDoc;
				if (parsed?.text && Array.isArray(parsed.paragraphs)) {
					pasteText = parsed.text;
					paragraphs = parsed.paragraphs;
					notes = Array.isArray(parsed.notes) ? parsed.notes : [];
					committedWordCount = countWords(parsed.text);
					return true;
				}
			}
			// Legacy v1 — a raw string. Migrate by splitting paragraphs, no notes.
			const legacy = sessionStorage.getItem(LEGACY_PASTE_KEY);
			if (legacy) {
				pasteText = legacy;
				paragraphs = splitParagraphs(legacy);
				notes = [];
				committedWordCount = countWords(legacy);
				sessionStorage.removeItem(LEGACY_PASTE_KEY);
				persistDoc();
				return true;
			}
		} catch {
			// ignore
		}
		return false;
	}

	async function commitText() {
		let t = pasteText;
		truncated = false;
		if (t.length > PASTE_CAP) {
			t = t.slice(0, PASTE_CAP);
			truncated = true;
			pasteText = t;
		}
		const words = countWords(t);
		committedWordCount = words;
		game.addReadingWords(words);
		paragraphs = splitParagraphs(t);
		notes = [];
		mode = 'read';
		persistDoc();
		await tick();
		measureAnchors();
	}

	function newText() {
		mode = 'paste';
		pasteText = '';
		paragraphs = [];
		notes = [];
		anchorOffsets = {};
		committedWordCount = 0;
		truncated = false;
		pdfError = null;
		pdfProgress = null;
		selectionRect = null;
		selectionAnchorId = null;
		try {
			sessionStorage.removeItem(DOC_KEY);
		} catch {
			// ignore
		}
	}

	async function handlePdfFile(file: File) {
		pdfError = null;
		if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
			pdfError = 'that does not look like a pdf.';
			return;
		}
		if (file.size > PDF_CAP_BYTES) {
			pdfError = `the pdf is larger than ${Math.round(PDF_CAP_BYTES / 1024 / 1024)} mb. try a smaller file.`;
			return;
		}
		pdfLoading = true;
		pdfProgress = { page: 0, totalPages: 0 };
		try {
			const { extractPdfText } = await import('$lib/reading/pdf');
			const result = await extractPdfText(file, (p) => {
				pdfProgress = p;
			});
			pasteText = result.text;
			pdfProgress = { page: result.pageCount, totalPages: result.pageCount };
		} catch (err) {
			console.error(err);
			pdfError = 'could not read that pdf. it may be scanned, encrypted, or malformed.';
			pdfProgress = null;
		} finally {
			pdfLoading = false;
			if (fileInputEl) fileInputEl.value = '';
		}
	}

	function onPdfPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handlePdfFile(file);
	}

	function onEnter() {
		timer.setPresent(true);
	}

	function onLeave() {
		timer.setPresent(false);
	}

	function onUnload() {
		game.persist();
		persistDoc();
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
		// Drop the active text selection so the popover doesn't reappear.
		window.getSelection()?.removeAllRanges();
		persistDoc();
		await tick();
		measureAnchors();
		const el = document.querySelector<HTMLElement>(`[data-margin-id="${note.id}"]`);
		el?.focus();
	}

	function onNoteChange(id: string, html: string) {
		const next = notes.map((n) =>
			n.id === id ? { ...n, html, updatedAt: new Date().toISOString() } : n
		);
		notes = next;
		persistDoc();
	}

	function onNoteDelete(id: string) {
		notes = notes.filter((n) => n.id !== id);
		persistDoc();
	}

	// Click on the popover button: prevent the mousedown from clearing the
	// selection before we have a chance to read it.
	function onPopoverMouseDown(e: MouseEvent) {
		e.preventDefault();
		if (selectionAnchorId) addNoteFor(selectionAnchorId);
	}

	onMount(() => {
		const hadDoc = loadDoc();
		if (hadDoc) mode = 'read';
		timer.start();
		const id = setInterval(() => {
			game.persist();
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

		// After we've mounted with a restored doc, measure once we have the DOM.
		tick().then(measureAnchors);

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
		game.persist();
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
		<p class="sub">a quiet room. read at your own pace — the timer follows your cursor.</p>
	</header>

	<div class="board" class:read={mode === 'read'}>
		<div class="active-star">
			<Star points={game.readingStarPoints} progress={progress} active size={120} />
			<p class="points">
				<span class="num">{game.readingStarPoints}</span> / 5 points
				{#if game.readingCompletedStars > 0}
					· <span class="num">{game.readingCompletedStars}</span>
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
				<label class="paste-label">
					<span>paste a text, or open a pdf. word count and reading time will appear once you begin.</span>
					<textarea
						bind:value={pasteText}
						placeholder="paste here — anything you want to read."
						rows="10"
						disabled={pdfLoading}
					></textarea>
				</label>
				<div class="pdf-row">
					<input
						bind:this={fileInputEl}
						type="file"
						accept="application/pdf,.pdf"
						id="reading-room-pdf"
						onchange={onPdfPick}
						disabled={pdfLoading}
					/>
					<label for="reading-room-pdf" class="pdf-button" class:loading={pdfLoading}>
						{pdfLoading ? '— extracting —' : '— open a pdf —'}
					</label>
					{#if pdfLoading && pdfProgress && pdfProgress.totalPages > 0}
						<span class="pdf-status">
							page <span class="num">{pdfProgress.page}</span> / {pdfProgress.totalPages}
						</span>
					{:else if pdfLoading}
						<span class="pdf-status">opening…</span>
					{:else if pdfProgress && !pdfError}
						<span class="pdf-status">
							<span class="num">{pdfProgress.totalPages}</span>
							pages extracted — edit if you'd like, then begin.
						</span>
					{/if}
				</div>
				{#if pdfError}
					<p class="notice">— {pdfError}</p>
				{/if}
				<div class="paste-actions">
					<button
						class="commit"
						type="button"
						disabled={!pasteText.trim() || pdfLoading}
						onclick={commitText}
					>
						— begin reading —
					</button>
				</div>
			{:else}
				<div class="text-meta">
					<span><span class="num">{committedWordCount.toLocaleString()}</span> words</span>
					<span>· about <span class="num">{formatMin(estimatedReadingMin)}</span></span>
					<button class="ghost" type="button" onclick={newText}>new text</button>
				</div>
				{#if truncated}
					<p class="notice">— text was longer than 500k characters; the rest was set aside.</p>
				{/if}
				<div class="passage-and-margin">
					<Passage {paragraphs} bind:rootEl={passageEl} />
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
		<StarShelf count={game.readingCompletedStars} />
	</footer>
</section>

{#if selectionRect && selectionAnchorId && mode === 'read'}
	<div
		class="selection-popover"
		style:top="{selectionRect.top - 38}px"
		style:left="{selectionRect.left + selectionRect.width / 2}px"
	>
		<button class="popover-btn" onmousedown={onPopoverMouseDown} title="add margin note">
			+ note in the margin
		</button>
	</div>
{/if}

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
		max-width: 60rem;
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
	.paste-label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.paste-label span {
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
	}
	textarea {
		width: 100%;
		background: var(--panel-accent);
		color: var(--text);
		border: 1px solid var(--rule);
		border-radius: 3px;
		font-family: var(--font-body);
		font-size: 1rem;
		padding: 0.6rem;
		resize: vertical;
		line-height: 1.6;
	}
	.pdf-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}
	.pdf-row input[type='file'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.pdf-button {
		display: inline-block;
		font-family: var(--font-display);
		font-size: 0.92rem;
		color: var(--cream);
		background: var(--panel-accent);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
	}
	.pdf-button:hover {
		border-color: var(--leafeon-pink);
		color: var(--leafeon-pink);
	}
	.pdf-button.loading {
		color: var(--cyan);
		border-color: var(--cyan);
		cursor: progress;
	}
	.pdf-status {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
	}
	.paste-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.6rem;
	}
	.commit {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--cream);
		background: var(--panel-accent);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.4rem 0.8rem;
	}
	.commit:hover:not(:disabled) {
		border-color: var(--leafeon-pink);
		color: var(--leafeon-pink);
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

	/* ── selection popover ─────────────────────────────────────── */
	.selection-popover {
		position: fixed;
		transform: translateX(-50%);
		z-index: 50;
		pointer-events: auto;
	}
	.popover-btn {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.12em;
		color: var(--cream);
		background: var(--panel-accent);
		border: 1px solid var(--periwinkle);
		border-radius: 3px;
		padding: 0.3rem 0.6rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
		white-space: nowrap;
	}
	.popover-btn:hover {
		border-color: var(--leafeon-pink);
		color: var(--leafeon-pink);
	}
</style>
