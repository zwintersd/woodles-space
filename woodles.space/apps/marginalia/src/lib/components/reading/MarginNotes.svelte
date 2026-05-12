<script lang="ts">
	import { sanitizeNoteHtml, type MarginNote } from '$lib/reading/text';

	interface Props {
		notes: MarginNote[];
		anchorOffsets: Record<string, number>;
		onChange: (id: string, html: string) => void;
		onDelete: (id: string) => void;
		columnEl?: HTMLElement;
	}

	let {
		notes,
		anchorOffsets,
		onChange,
		onDelete,
		columnEl = $bindable()
	}: Props = $props();

	interface Group {
		anchorId: string;
		offsetTop: number;
		notes: MarginNote[];
	}

	const groups = $derived.by<Group[]>(() => {
		const m = new Map<string, MarginNote[]>();
		for (const n of notes) {
			if (!Object.prototype.hasOwnProperty.call(anchorOffsets, n.anchorId)) continue;
			const arr = m.get(n.anchorId) ?? [];
			arr.push(n);
			m.set(n.anchorId, arr);
		}
		return Array.from(m.entries()).map(([anchorId, notes]) => ({
			anchorId,
			offsetTop: anchorOffsets[anchorId] ?? 0,
			notes
		}));
	});

	// Set initial HTML on a contenteditable once, so re-renders don't blow
	// away the user's caret position. Mirrors the `marginBody` action in /write.
	function marginBody(node: HTMLElement, initial: string) {
		if (initial) node.innerHTML = initial;
		return {
			// Intentionally no `update` — once mounted, the contenteditable
			// owns its own DOM. Sanitization happens on input.
		};
	}

	function onInput(id: string, e: Event) {
		const target = e.currentTarget as HTMLElement;
		const cleaned = sanitizeNoteHtml(target.innerHTML);
		onChange(id, cleaned);
	}

	function onPaste(e: ClipboardEvent) {
		// Force plain-text paste — notes are handwriting, not formatted prose.
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount) return;
		sel.deleteFromDocument();
		sel.getRangeAt(0).insertNode(document.createTextNode(text));
		sel.collapseToEnd();
	}
</script>

<div class="margin-column" bind:this={columnEl}>
	{#if notes.length === 0}
		<p class="empty">select a passage to add a note in the margin.</p>
	{:else}
		{#each groups as group (group.anchorId)}
			<div class="margin-group" style:top="{group.offsetTop}px">
				{#each group.notes as note (note.id)}
					<div class="margin-note">
						<span class="anchor-ref" title="anchored to paragraph {group.anchorId}">
							{group.anchorId}
						</span>
						<div
							class="margin-body"
							contenteditable="true"
							spellcheck="true"
							use:marginBody={note.html}
							oninput={(e) => onInput(note.id, e)}
							onpaste={onPaste}
							data-margin-id={note.id}
							data-placeholder="margin note…"
							role="textbox"
							tabindex="0"
							aria-label="margin note"
						></div>
						<button
							class="delete"
							type="button"
							onclick={() => onDelete(note.id)}
							title="remove note"
							aria-label="remove note">×</button>
					</div>
				{/each}
			</div>
		{/each}
	{/if}
</div>

<style>
	.margin-column {
		position: relative;
		min-height: 100%;
	}
	.empty {
		font-family: var(--font-ui);
		font-size: 0.76rem;
		font-style: italic;
		color: var(--muted);
		margin: 0.4rem 0 0;
		opacity: 0.7;
	}
	.margin-group {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	@media (max-width: 760px) {
		.margin-column {
			min-height: auto;
		}
		.margin-group {
			position: static;
			margin-bottom: 0.8rem;
		}
	}
	.margin-note {
		position: relative;
		padding: 0.4rem 1.4rem 0.4rem 0.5rem;
		border-left: 1px solid var(--rule);
	}
	.anchor-ref {
		font-family: var(--font-counter);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		color: var(--periwinkle);
		opacity: 0.6;
		display: block;
		margin-bottom: 0.15rem;
		user-select: none;
	}
	.margin-body {
		font-family: var(--font-hand);
		font-size: 1.05rem;
		line-height: 1.35;
		color: var(--text);
		min-height: 1.4em;
		outline: none;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.margin-body:focus {
		outline: 1px solid var(--rule);
		outline-offset: 2px;
		border-radius: 2px;
	}
	.margin-body[data-placeholder]:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		font-style: italic;
		opacity: 0.5;
		pointer-events: none;
	}
	.delete {
		position: absolute;
		top: 0.3rem;
		right: 0.2rem;
		width: 1.1rem;
		height: 1.1rem;
		font-family: var(--font-ui);
		font-size: 0.95rem;
		line-height: 1;
		color: var(--muted);
		opacity: 0;
		transition: opacity 120ms, color 120ms;
	}
	.margin-note:hover .delete {
		opacity: 0.7;
	}
	.delete:hover {
		color: var(--print-pink);
		opacity: 1;
	}
</style>
