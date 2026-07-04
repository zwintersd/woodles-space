<script lang="ts">
	import { READING_TEXT_CAP } from '$lib/reading/text';

	const PDF_CAP_BYTES = 32 * 1024 * 1024;
	const EPUB_CAP_BYTES = 50 * 1024 * 1024;

	let {
		pasteText = $bindable(),
		onCommit,
		onEpubCommit
	}: {
		pasteText: string;
		onCommit: (text: string, truncated: boolean) => void;
		onEpubCommit: (
			html: string,
			meta: { title?: string; author?: string; truncated: boolean }
		) => void;
	} = $props();

	let pdfLoading = $state(false);
	let pdfProgress = $state<{ page: number; totalPages: number } | null>(null);
	let pdfError = $state<string | null>(null);
	let pdfFileInputEl: HTMLInputElement | undefined = $state();

	let epubLoading = $state(false);
	let epubProgress = $state<{ chapter: number; totalChapters: number } | null>(null);
	let epubError = $state<string | null>(null);
	let epubFileInputEl: HTMLInputElement | undefined = $state();

	const anyLoading = $derived(pdfLoading || epubLoading);

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
			console.error('[marginalia] pdf extraction failed', err);
			const msg = err instanceof Error ? err.message.toLowerCase() : '';
			if (msg.includes('password') || msg.includes('encrypted')) {
				pdfError = 'this pdf is password-protected. try an unlocked copy.';
			} else if (msg.includes('invalid') || msg.includes('corrupt')) {
				pdfError = 'this pdf appears to be malformed.';
			} else {
				pdfError = 'could not read that pdf. it may be scanned, encrypted, or malformed.';
			}
			pdfProgress = null;
		} finally {
			pdfLoading = false;
			if (pdfFileInputEl) pdfFileInputEl.value = '';
		}
	}

	function onPdfPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handlePdfFile(file);
	}

	// Unlike the pdf path, a successful epub extraction commits straight into
	// the room (mirroring `readLetter` in ReadingRoom.svelte) instead of
	// landing in the textarea for a pre-read edit — the content is already
	// structured HTML, not raw text to proofread, so there's nothing an
	// intermediate paste-box step would add.
	async function handleEpubFile(file: File) {
		epubError = null;
		if (!file.name.toLowerCase().endsWith('.epub') && file.type !== 'application/epub+zip') {
			epubError = 'that does not look like an epub.';
			return;
		}
		if (file.size > EPUB_CAP_BYTES) {
			epubError = `the epub is larger than ${Math.round(EPUB_CAP_BYTES / 1024 / 1024)} mb. try a smaller file.`;
			return;
		}
		epubLoading = true;
		epubProgress = { chapter: 0, totalChapters: 0 };
		try {
			const { extractEpubHtml } = await import('$lib/reading/epub');
			const result = await extractEpubHtml(file, (p) => {
				epubProgress = p;
			});
			onEpubCommit(result.html, {
				title: result.title,
				author: result.author,
				truncated: result.truncated
			});
		} catch (err) {
			console.error('[marginalia] epub extraction failed', err);
			const msg = err instanceof Error ? err.message.toLowerCase() : '';
			if (msg.includes('drm')) {
				epubError = 'this epub is drm-protected. try an unlocked copy.';
			} else {
				epubError = 'could not read that epub. it may be drm-protected or malformed.';
			}
			epubProgress = null;
		} finally {
			epubLoading = false;
			if (epubFileInputEl) epubFileInputEl.value = '';
		}
	}

	function onEpubPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleEpubFile(file);
	}

	function commit() {
		let t = pasteText;
		let truncated = false;
		if (t.length > READING_TEXT_CAP) {
			t = t.slice(0, READING_TEXT_CAP);
			truncated = true;
			pasteText = t;
		}
		onCommit(t, truncated);
	}
</script>

<label class="paste-label">
	<span
		>paste a text, open a pdf, or open an epub. once you begin you can keep editing — the room is
		a working desk, not a glass case.</span
	>
	<textarea
		bind:value={pasteText}
		placeholder="paste here — anything you want to read."
		rows="10"
		disabled={anyLoading}
	></textarea>
</label>
<div class="file-row">
	<input
		bind:this={pdfFileInputEl}
		type="file"
		accept="application/pdf,.pdf"
		id="reading-room-pdf"
		onchange={onPdfPick}
		disabled={anyLoading}
	/>
	<label for="reading-room-pdf" class="file-button" class:loading={pdfLoading}>
		{pdfLoading ? '— extracting —' : '— open a pdf —'}
	</label>
	{#if pdfLoading && pdfProgress && pdfProgress.totalPages > 0}
		<span class="file-status">
			page <span class="num">{pdfProgress.page}</span> / {pdfProgress.totalPages}
		</span>
	{:else if pdfLoading}
		<span class="file-status">opening…</span>
	{:else if pdfProgress && !pdfError}
		<span class="file-status">
			<span class="num">{pdfProgress.totalPages}</span>
			pages extracted — edit if you'd like, then begin.
		</span>
	{/if}
</div>
{#if pdfError}
	<p class="notice">— {pdfError}</p>
{/if}
<div class="file-row">
	<input
		bind:this={epubFileInputEl}
		type="file"
		accept="application/epub+zip,.epub"
		id="reading-room-epub"
		onchange={onEpubPick}
		disabled={anyLoading}
	/>
	<label for="reading-room-epub" class="file-button" class:loading={epubLoading}>
		{epubLoading ? '— extracting —' : '— open an epub —'}
	</label>
	{#if epubLoading && epubProgress && epubProgress.totalChapters > 0}
		<span class="file-status">
			chapter <span class="num">{epubProgress.chapter}</span> / {epubProgress.totalChapters}
		</span>
	{:else if epubLoading}
		<span class="file-status">opening…</span>
	{/if}
</div>
{#if epubError}
	<p class="notice">— {epubError}</p>
{/if}
<div class="paste-actions">
	<button class="commit" type="button" disabled={!pasteText.trim() || anyLoading} onclick={commit}>
		— begin reading —
	</button>
</div>

<style>
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
	.file-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}
	.file-row input[type='file'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.file-button {
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
	.file-button:hover {
		border-color: var(--leafeon-pink);
		color: var(--leafeon-pink);
	}
	.file-button.loading {
		color: var(--cyan);
		border-color: var(--cyan);
		cursor: progress;
	}
	.file-status {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--muted);
	}
	.notice {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		color: var(--print-pink);
		margin: 0 0 0.5rem;
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
</style>
