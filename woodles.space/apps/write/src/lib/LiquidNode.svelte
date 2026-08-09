<script lang="ts">
	// One row in a Liquid list, and its children — recursive by rendering
	// itself. All state (the board, drag/hover tracking) lives in Liquid.svelte;
	// this component is deliberately dumb, acting only through the callbacks
	// it's given, so there is exactly one place that touches the tree.
	import { tick } from 'svelte';
	import type { DropZone, LiquidItem } from './liquid';
	import LiquidNode from './LiquidNode.svelte';

	let {
		item,
		listId,
		depth,
		dragItem,
		hoverItem,
		focusItemId,
		onKeydown,
		onInput,
		onToggleCollapse,
		onDelete,
		onDragStart,
		onDragOver,
		onDrop,
		onDragEnd,
		onFocused
	}: {
		item: LiquidItem;
		listId: string;
		depth: number;
		dragItem: { listId: string; itemId: string } | null;
		hoverItem: { listId: string; itemId: string; zone: DropZone } | null;
		focusItemId: string | null;
		onKeydown: (e: KeyboardEvent, itemId: string) => void;
		onInput: (itemId: string, text: string) => void;
		onToggleCollapse: (itemId: string) => void;
		onDelete: (itemId: string) => void;
		onDragStart: (e: DragEvent, itemId: string) => void;
		onDragOver: (e: DragEvent, itemId: string) => void;
		onDrop: (e: DragEvent, itemId: string) => void;
		onDragEnd: () => void;
		onFocused: () => void;
	} = $props();

	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (focusItemId === item.id && inputEl) {
			const el = inputEl;
			tick().then(() => {
				el.focus();
				const end = el.value.length;
				el.setSelectionRange(end, end);
			});
			onFocused();
		}
	});

	const zoneHere = $derived(hoverItem?.itemId === item.id ? hoverItem.zone : null);
</script>

<div
	class="liquid-row"
	style="--depth: {depth}"
	draggable="true"
	role="group"
	aria-label={item.text || 'untitled item'}
	class:dragging={dragItem?.itemId === item.id}
	class:drop-nest={zoneHere === 'nest'}
	class:drop-before={zoneHere === 'before'}
	class:drop-after={zoneHere === 'after'}
	ondragstart={(e) => onDragStart(e, item.id)}
	ondragover={(e) => {
		e.stopPropagation();
		onDragOver(e, item.id);
	}}
	ondrop={(e) => {
		e.stopPropagation();
		onDrop(e, item.id);
	}}
	ondragend={onDragEnd}
>
	<span class="liquid-handle" aria-hidden="true">⠿</span>
	<button
		class="liquid-toggle"
		class:leaf={item.children.length === 0}
		onclick={() => onToggleCollapse(item.id)}
		disabled={item.children.length === 0}
		aria-label={item.children.length === 0 ? undefined : item.collapsed ? 'expand' : 'collapse'}
	>{item.children.length === 0 ? '·' : item.collapsed ? '▸' : '▾'}</button>
	<input
		bind:this={inputEl}
		type="text"
		class="liquid-input"
		value={item.text}
		data-item-id={item.id}
		placeholder="…"
		oninput={(e) => onInput(item.id, e.currentTarget.value)}
		onkeydown={(e) => onKeydown(e, item.id)}
	/>
	<button class="liquid-delete" onclick={() => onDelete(item.id)} aria-label="delete item">×</button>
</div>

{#if !item.collapsed}
	{#each item.children as child (child.id)}
		<LiquidNode
			item={child}
			{listId}
			depth={depth + 1}
			{dragItem}
			{hoverItem}
			{focusItemId}
			{onKeydown}
			{onInput}
			{onToggleCollapse}
			{onDelete}
			{onDragStart}
			{onDragOver}
			{onDrop}
			{onDragEnd}
			{onFocused}
		/>
	{/each}
{/if}

<style>
	.liquid-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.4rem 0.25rem calc(0.4rem + var(--depth) * 1.1rem);
		border-radius: 6px;
		border-top: 2px solid transparent;
		border-bottom: 2px solid transparent;
		transition: background 0.12s ease, opacity 0.12s ease;
	}
	.liquid-row:hover {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}
	.liquid-row.dragging {
		opacity: 0.4;
	}
	.liquid-row.drop-before {
		border-top-color: var(--accent-strong);
	}
	.liquid-row.drop-after {
		border-bottom-color: var(--accent-strong);
	}
	.liquid-row.drop-nest {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-radius: 6px;
	}
	.liquid-handle {
		flex: none;
		font-size: 0.7rem;
		color: var(--muted);
		opacity: 0.5;
		cursor: grab;
		user-select: none;
	}
	.liquid-toggle {
		flex: none;
		width: 1.1rem;
		height: 1.1rem;
		font-size: 0.65rem;
		color: var(--muted);
		background: none;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.liquid-toggle.leaf {
		cursor: default;
		opacity: 0.4;
	}
	.liquid-toggle:not(.leaf):hover {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--accent-strong);
	}
	.liquid-input {
		flex: 1 1 auto;
		min-width: 0;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.8rem;
		color: var(--text);
		background: none;
		border: none;
		padding: 0.15rem 0.2rem;
		border-radius: 4px;
	}
	.liquid-input:focus {
		outline: none;
		background: var(--surface);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.liquid-delete {
		flex: none;
		width: 1.2rem;
		height: 1.2rem;
		font-size: 0.8rem;
		line-height: 1;
		color: var(--muted);
		background: none;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.12s ease;
	}
	.liquid-row:hover .liquid-delete,
	.liquid-input:focus ~ .liquid-delete {
		opacity: 0.6;
	}
	.liquid-delete:hover {
		opacity: 1;
		color: var(--danger, #b3454f);
	}
</style>
