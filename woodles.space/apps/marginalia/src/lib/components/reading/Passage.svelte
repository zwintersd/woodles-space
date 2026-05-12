<script lang="ts">
	import {
		passageHtml,
		stampLiveAnchors,
		paragraphsFromDom,
		sanitizePassageHtml,
		type Paragraph
	} from '$lib/reading/text';

	interface Props {
		// Initial paragraphs. The DOM is the source of truth after mount.
		// To remount with a fresh set, wrap the component in `{#key docKey}`.
		paragraphs: Paragraph[];
		onChange?: (paragraphs: Paragraph[]) => void;
		onAnchorsChanged?: () => void;
		rootEl?: HTMLElement;
	}

	let { paragraphs, onChange, onAnchorsChanged, rootEl = $bindable() }: Props = $props();

	function setInitial(node: HTMLElement) {
		node.innerHTML = passageHtml(paragraphs);
		stampLiveAnchors(node);
	}

	function emitChange(node: HTMLElement) {
		stampLiveAnchors(node);
		onChange?.(paragraphsFromDom(node));
		onAnchorsChanged?.();
	}

	function onInput(e: Event) {
		const node = e.currentTarget as HTMLElement;
		emitChange(node);
	}

	// Force plain-text paste so users don't drag in styles and class noise.
	// Anything richer can still be built up inside the room using the toolbar.
	function onPaste(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		if (!text) return;
		document.execCommand('insertText', false, text);
	}

	// One more safety net: re-sanitize on blur, in case the browser produced
	// something unexpected. (We sanitize for storage on every input via the
	// serializer, but blur lets us clean up any inline noise that survived.)
	function onBlur(e: FocusEvent) {
		const node = e.currentTarget as HTMLElement;
		const cleaned = sanitizePassageHtml(node.innerHTML);
		if (cleaned !== node.innerHTML) {
			node.innerHTML = cleaned;
			stampLiveAnchors(node);
		}
		emitChange(node);
	}
</script>

<div
	class="passage"
	bind:this={rootEl}
	contenteditable="true"
	spellcheck="true"
	role="textbox"
	tabindex="0"
	aria-multiline="true"
	aria-label="reading text — editable"
	use:setInitial
	oninput={onInput}
	onpaste={onPaste}
	onblur={onBlur}
></div>

<style>
	.passage {
		font-family: var(--font-body);
		font-size: 1.02rem;
		line-height: 1.7;
		color: var(--text);
		outline: none;
		min-height: 4rem;
	}
	.passage:focus-visible {
		outline: 1px dashed var(--rule);
		outline-offset: 4px;
		border-radius: 2px;
	}
	.passage :global(p),
	.passage :global(blockquote),
	.passage :global(ul),
	.passage :global(ol),
	.passage :global(pre) {
		margin: 0 0 1.1em;
	}
	.passage :global(p:last-child) {
		margin-bottom: 0;
	}
	.passage :global(p) {
		white-space: pre-wrap;
	}
	.passage :global(h1),
	.passage :global(h2),
	.passage :global(h3),
	.passage :global(h4),
	.passage :global(h5),
	.passage :global(h6) {
		font-family: var(--font-display);
		font-weight: 400;
		color: var(--cream);
		margin: 1.2em 0 0.4em;
		line-height: 1.25;
	}
	.passage :global(h1) {
		font-size: 1.5rem;
	}
	.passage :global(h2) {
		font-size: 1.28rem;
	}
	.passage :global(h3) {
		font-size: 1.12rem;
	}
	.passage :global(blockquote) {
		border-left: 2px solid var(--periwinkle);
		padding-left: 0.9rem;
		color: var(--muted);
		font-style: italic;
	}
	.passage :global(ul),
	.passage :global(ol) {
		padding-left: 1.4rem;
	}
	.passage :global(mark) {
		background: rgba(240, 143, 184, 0.28);
		color: inherit;
		padding: 0 0.1em;
		border-radius: 2px;
	}
	.passage :global(a) {
		color: var(--cyan);
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}
	.passage :global(a:hover) {
		color: var(--leafeon-pink);
	}
	.passage :global(pre),
	.passage :global(code) {
		font-family: var(--font-counter);
		background: var(--panel-accent);
		padding: 0.05rem 0.3rem;
		border-radius: 2px;
	}
	.passage :global(::selection) {
		background: rgba(108, 229, 232, 0.28);
	}
</style>
