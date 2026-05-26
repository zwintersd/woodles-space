<script lang="ts">
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { pocketLayerLabel, type PocketLayer, type PocketNote, type PocketsOrder } from './types';

	let {
		pockets,
		order = $bindable(),
		confirmingId,
		nextLayer,
		onAdd,
		onInput,
		onPaste,
		onStartConfirmDelete,
		onCancelConfirmDelete,
		onConfirmDelete
	}: {
		pockets: PocketNote[];
		order: PocketsOrder;
		confirmingId: string | null;
		nextLayer: PocketLayer;
		onAdd: () => void;
		onInput: (id: string, e: Event) => void;
		onPaste: (e: ClipboardEvent) => void;
		onStartConfirmDelete: (id: string) => void;
		onCancelConfirmDelete: () => void;
		onConfirmDelete: (id: string) => void;
	} = $props();

	const sorted = $derived(
		order === 'oldest'
			? [...pockets].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
			: [...pockets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	);

	function pocketBody(node: HTMLElement, html: string) {
		node.innerHTML = html ?? '';
		return {};
	}

	function flipOrder() {
		order = order === 'oldest' ? 'newest' : 'oldest';
	}
</script>

<section
	class="pockets-panel"
	aria-label="pockets"
	transition:slide={{ duration: 320, easing: cubicOut }}
>
	<div class="pockets-divider" aria-hidden="true"></div>
	<div class="pockets-header">
		<span class="pockets-eyebrow">inside cover</span>
		<button class="pockets-order" onclick={flipOrder} title="flip ordering">
			{order === 'oldest' ? 'oldest first ↓' : 'newest first ↑'}
		</button>
	</div>
	<div class="pockets-list">
		{#each sorted as note (note.id)}
			<div
				class="pocket-card pocket-card-{note.layer}"
				in:fly={{ y: 8, duration: 240, easing: cubicOut }}
				out:fly={{ y: -4, duration: 160, easing: cubicOut }}
			>
				<span class="pocket-layer-chip" title="{note.layer} pocket">
					{pocketLayerLabel(note.layer)}
				</span>
				<div
					class="pocket-body"
					contenteditable="true"
					spellcheck="true"
					use:pocketBody={note.html}
					oninput={(e) => onInput(note.id, e)}
					onpaste={onPaste}
					data-pocket-body={note.id}
					data-placeholder="…"
					role="textbox"
					tabindex="0"
				></div>
				<div class="pocket-controls">
					{#if confirmingId === note.id}
						<button
							class="pocket-confirm"
							onclick={() => onConfirmDelete(note.id)}
							onblur={onCancelConfirmDelete}
						>remove?</button>
					{:else}
						<button
							class="pocket-x"
							onclick={() => onStartConfirmDelete(note.id)}
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
	<button class="pocket-add" onclick={onAdd} title="add a {nextLayer} pocket">
		<span class="pocket-add-plus">+</span>
		<span class="pocket-add-label">{nextLayer} pocket</span>
	</button>
</section>

<style>
	.pockets-panel { margin-top: 3.2rem; padding-top: 0; }
	.pockets-divider {
		height: 1px;
		width: 100%;
		background: linear-gradient(90deg, transparent 0%, var(--rule) 18%,
			color-mix(in srgb, var(--accent) 35%, transparent) 50%,
			var(--rule) 82%, transparent 100%);
		opacity: 0.7;
		margin-bottom: 1.4rem;
	}
	.pockets-header {
		display: flex; align-items: baseline; justify-content: space-between;
		margin-bottom: 1.2rem;
	}
	.pockets-eyebrow {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem; letter-spacing: 0.22em;
		text-transform: uppercase; color: var(--muted); opacity: 0.55;
	}
	.pockets-order {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem; letter-spacing: 0.14em;
		text-transform: lowercase; color: var(--muted);
		background: none; border: 1px dashed transparent;
		padding: 3px 8px; border-radius: 4px; cursor: pointer;
		opacity: 0.55;
		transition: color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pockets-order:hover {
		opacity: 0.95; color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
		transform: translateY(-1px);
	}
	.pockets-list { display: flex; flex-direction: column; gap: 0.9rem; }
	.pockets-empty {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.65rem; letter-spacing: 0.08em;
		color: var(--muted); opacity: 0.4;
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
		transition: border-color 0.22s ease, background 0.22s ease, box-shadow 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
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
		top: 0.5rem; left: 0.55rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem; letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		padding: 1px 5px; border-radius: 6px;
		opacity: 0.6; pointer-events: none;
	}
	.pocket-card-background .pocket-layer-chip {
		color: var(--accent-deep); opacity: 0.7;
	}
	.pocket-body {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.96rem; line-height: 1.65;
		color: var(--text);
		outline: none; caret-color: var(--accent-deep);
		min-height: 1.5em;
		margin-top: 0.6rem;
	}
	.pocket-body :global(*) { font-family: var(--editor-body, var(--font-body)); }
	.pocket-card-background .pocket-body {
		font-style: italic; color: var(--muted); font-size: 0.92rem;
	}
	.pocket-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted); opacity: 0.35;
		pointer-events: none; font-style: italic;
	}
	.pocket-body :global(strong) { font-weight: 600; }
	.pocket-body :global(em) { font-style: italic; }
	.pocket-controls { position: absolute; top: 0.4rem; right: 0.5rem; }
	.pocket-x {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.85rem; line-height: 1;
		color: var(--muted);
		background: none; border: none;
		padding: 4px 7px; border-radius: 50%;
		cursor: pointer; opacity: 0.35;
		transition: color 0.18s ease, background 0.18s ease, opacity 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-x:hover {
		opacity: 0.95; color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		transform: rotate(90deg);
	}
	.pocket-confirm {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.55rem; letter-spacing: 0.12em;
		text-transform: lowercase;
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		padding: 3px 10px; border-radius: 12px;
		cursor: pointer; font-style: italic;
		transition: background 0.2s ease, border-color 0.2s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-confirm:hover {
		background: color-mix(in srgb, var(--accent) 40%, transparent);
		border-color: var(--accent-strong);
		transform: translateY(-1px);
	}
	.pocket-add {
		display: inline-flex; align-items: center; gap: 0.55em;
		margin-top: 1.1rem;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem; letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		background: none; border: 1px dashed var(--rule);
		padding: 8px 16px; border-radius: 100px;
		cursor: pointer; opacity: 0.7;
		transition: color 0.22s ease, border-color 0.22s ease, background 0.22s ease, opacity 0.22s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.pocket-add:hover {
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		opacity: 1;
		transform: translateY(-1px);
	}
	.pocket-add-plus { font-size: 0.85rem; line-height: 1; font-weight: 400; }
</style>
