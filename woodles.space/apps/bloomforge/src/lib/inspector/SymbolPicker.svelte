<script lang="ts">
	import { CURRENCY_SYMBOL_PALETTE } from '@woodles/emoji';
	import EmojiIcon from '../EmojiIcon.svelte';

	/**
	 * Replaces free-typed emoji with a grid of OpenMoji choices — the currency
	 * symbol field used to be a plain text input, which meant whatever native
	 * emoji the visitor's OS offered (and however inconsistently it rendered
	 * everywhere else the symbol shows up). Picking from the bundled set
	 * guarantees the icon is one this app actually knows how to draw.
	 *
	 * Positioned like ContextMenu.svelte: `position: fixed`, computed from the
	 * trigger's own rect and clamped to the viewport, because the Inspector's
	 * `.body` scrolls and a `position: absolute` panel would be cropped by it.
	 */
	interface Props {
		value: string;
		onselect: (char: string) => void;
		id?: string;
	}

	let { value, onselect, id }: Props = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement | undefined;
	let panelEl: HTMLDivElement | undefined = $state();
	let optionEls: HTMLButtonElement[] = [];
	const columns = 6;

	let anchor = $state({ x: 0, y: 0 });
	let size = $state({ width: 0, height: 0 });

	function openPanel(): void {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		anchor = { x: rect.left, y: rect.bottom + 6 };
		open = true;
	}

	$effect(() => {
		if (!open || !panelEl) return;
		const rect = panelEl.getBoundingClientRect();
		size = { width: rect.width, height: rect.height };
	});

	const pos = $derived.by(() => {
		if (!open) return anchor;
		const margin = 6;
		return {
			x: Math.max(margin, Math.min(anchor.x, window.innerWidth - size.width - margin)),
			y: Math.max(margin, Math.min(anchor.y, window.innerHeight - size.height - margin))
		};
	});

	$effect(() => {
		if (open) optionEls[Math.max(0, CURRENCY_SYMBOL_PALETTE.indexOf(value))]?.focus();
	});

	$effect(() => {
		if (!open) return;
		const close = () => (open = false);
		const closeIfOutside = (event: PointerEvent) => {
			if (event.target instanceof Node && (panelEl?.contains(event.target) || triggerEl?.contains(event.target))) return;
			close();
		};
		window.addEventListener('pointerdown', closeIfOutside);
		window.addEventListener('scroll', close, true);
		window.addEventListener('resize', close);
		window.addEventListener('blur', close);
		return () => {
			window.removeEventListener('pointerdown', closeIfOutside);
			window.removeEventListener('scroll', close, true);
			window.removeEventListener('resize', close);
			window.removeEventListener('blur', close);
		};
	});

	function choose(char: string): void {
		open = false;
		onselect(char);
		triggerEl?.focus();
	}

	function moveFocus(delta: number): void {
		const count = optionEls.length;
		if (!count) return;
		const from = optionEls.indexOf(document.activeElement as HTMLButtonElement);
		const next = ((from < 0 ? 0 : from) + delta + count) % count;
		optionEls[next]?.focus();
	}

	function onKeydown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowRight':
				event.preventDefault();
				moveFocus(1);
				break;
			case 'ArrowLeft':
				event.preventDefault();
				moveFocus(-1);
				break;
			case 'ArrowDown':
				event.preventDefault();
				moveFocus(columns);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveFocus(-columns);
				break;
			case 'Escape':
				event.preventDefault();
				event.stopPropagation();
				open = false;
				triggerEl?.focus();
				break;
			case 'Tab':
				open = false;
				break;
		}
	}
</script>

<button
	bind:this={triggerEl}
	{id}
	type="button"
	class="trigger"
	aria-haspopup="listbox"
	aria-expanded={open}
	onclick={() => (open ? (open = false) : openPanel())}
>
	<EmojiIcon char={value} size={18} />
	<span class="chevron" aria-hidden="true">▾</span>
</button>

{#if open}
	<div
		bind:this={panelEl}
		class="panel"
		role="listbox"
		tabindex="-1"
		aria-label="Currency symbol"
		style:left="{pos.x}px"
		style:top="{pos.y}px"
		onkeydown={onKeydown}
	>
		{#each CURRENCY_SYMBOL_PALETTE as char, index (char)}
			<button
				bind:this={optionEls[index]}
				type="button"
				role="option"
				aria-selected={char === value}
				class:selected={char === value}
				tabindex="-1"
				onclick={() => choose(char)}
			>
				<EmojiIcon char={char} size={20} label={char} />
			</button>
		{/each}
	</div>
{/if}

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 10px;
		border: 1px solid var(--bf-rule-strong);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface);
		color: var(--bf-ink-soft);
		cursor: pointer;
	}

	.trigger:hover {
		border-color: var(--bf-accent);
	}

	.trigger[aria-expanded='true'] {
		border-color: var(--bf-accent);
		box-shadow: 0 0 0 3px var(--bf-accent-soft);
	}

	.chevron {
		margin-left: 2px;
		font-size: 10px;
		color: var(--bf-faint);
	}

	.panel {
		position: fixed;
		z-index: 50;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 2px;
		width: 216px;
		max-height: 240px;
		overflow-y: auto;
		padding: 6px;
		border: 1px solid var(--bf-rule-strong);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface);
		box-shadow: var(--bf-shadow-lift);
	}

	.panel button[role='option'] {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 1px solid transparent;
		border-radius: var(--bf-radius-sm);
		background: none;
		cursor: pointer;
	}

	.panel button[role='option']:hover,
	.panel button[role='option']:focus {
		background: var(--bf-accent-soft);
		outline: none;
	}

	.panel button[role='option'].selected {
		border-color: var(--bf-accent);
		background: var(--bf-accent-soft);
	}
</style>
