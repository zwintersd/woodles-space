<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { MarginGroup } from './types';

	let {
		columnEl = $bindable(),
		groups,
		confirmingId,
		hidden,
		onInput,
		onPaste,
		onStartConfirmDelete,
		onCancelConfirmDelete,
		onConfirmDelete
	}: {
		columnEl: HTMLElement | undefined;
		groups: MarginGroup[];
		confirmingId: string | null;
		hidden: boolean;
		onInput: (id: string, e: Event) => void;
		onPaste: (e: ClipboardEvent) => void;
		onStartConfirmDelete: (id: string) => void;
		onCancelConfirmDelete: () => void;
		onConfirmDelete: (id: string) => void;
	} = $props();

	function marginBody(node: HTMLElement, html: string) {
		node.innerHTML = html ?? '';
		return {};
	}
</script>

<aside
	class="margin-column"
	class:hidden
	bind:this={columnEl}
	aria-label="margin notes"
>
	{#each groups as group (group.anchorId)}
		<div class="margin-group" style:top="{group.offsetTop}px">
			{#each group.notes as note (note.id)}
				<div
					class="margin-note"
					in:fly={{ y: 6, duration: 220, easing: cubicOut }}
					out:fly={{ y: -3, duration: 140, easing: cubicOut }}
				>
					<span class="margin-anchor-ref" title="anchored to {group.anchorId}">
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
					></div>
					<div class="margin-controls">
						{#if confirmingId === note.id}
							<button
								class="margin-confirm"
								onclick={() => onConfirmDelete(note.id)}
								onblur={onCancelConfirmDelete}
							>remove?</button>
						{:else}
							<button
								class="margin-x"
								onclick={() => onStartConfirmDelete(note.id)}
								title="remove margin note"
								aria-label="remove margin note"
							>×</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/each}
</aside>

<style>
	.margin-column {
		position: relative;
		width: 280px;
		flex-shrink: 0;
		padding-top: 84px;
		padding-bottom: 96px;
		min-height: 100vh;
	}
	.margin-column.hidden { visibility: hidden; }

	.margin-group {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		transition: top 0.18s ease;
	}
	.margin-note {
		position: relative;
		padding: 0.7rem 2rem 0.7rem 0.9rem;
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: color-mix(in srgb, var(--surface) 50%, transparent);
		transition: border-color 0.22s ease, background 0.22s ease, box-shadow 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.margin-note:focus-within {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--surface) 80%, transparent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 18%, transparent);
	}
	.margin-anchor-ref {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.48rem;
		letter-spacing: 0.16em;
		text-transform: lowercase;
		color: var(--muted);
		opacity: 0.45;
		display: block;
		margin-bottom: 0.35rem;
	}
	.margin-body {
		font-family: var(--editor-body, var(--font-body));
		font-size: 0.86rem;
		line-height: 1.55;
		color: var(--muted);
		font-style: italic;
		outline: none;
		caret-color: var(--accent-deep);
		min-height: 1.2em;
	}
	.margin-body :global(*) { font-family: var(--editor-body, var(--font-body)); }
	.margin-body :global(strong) { font-weight: 600; font-style: italic; }
	.margin-body :global(em) { font-style: normal; }
	.margin-body:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
		opacity: 0.3;
		pointer-events: none;
	}
	.margin-controls {
		position: absolute;
		top: 0.25rem;
		right: 0.35rem;
	}
	.margin-x {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.78rem;
		line-height: 1;
		color: var(--muted);
		background: none;
		border: none;
		padding: 3px 6px;
		border-radius: 50%;
		cursor: pointer;
		opacity: 0.3;
		transition: color 0.18s ease, background 0.18s ease, opacity 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.margin-x:hover {
		opacity: 0.95;
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		transform: rotate(90deg);
	}
	.margin-confirm {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		padding: 2px 8px;
		border-radius: 12px;
		cursor: pointer;
		font-style: italic;
		transition: background 0.2s ease, border-color 0.2s ease;
	}
	.margin-confirm:hover {
		background: color-mix(in srgb, var(--accent) 40%, transparent);
		border-color: var(--accent-strong);
	}

	@media (max-width: 1100px) {
		.margin-column {
			width: 100%;
			max-width: 680px;
			min-height: 0;
			padding-top: 0;
			padding-bottom: 1rem;
		}
		.margin-column.hidden { display: none; visibility: visible; }
		.margin-group {
			position: static;
			margin: 0 clamp(1.5rem, 5vw, 2.5rem) 0.6rem;
		}
	}
</style>
