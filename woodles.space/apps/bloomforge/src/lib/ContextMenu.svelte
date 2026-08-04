<script lang="ts" module>
	export interface ContextMenuItem {
		label: string;
		onSelect: () => void;
		danger?: boolean;
	}
</script>

<script lang="ts">
	/**
	 * A floating menu anchored to a point — a right-click, usually. Everything
	 * here is what a native OS context menu gets for free and a hand-rolled
	 * `{#if open}<div>` does not: it dismisses on Escape, on a click or a second
	 * right-click anywhere outside itself, and on the page scrolling or losing
	 * focus out from under it, because a menu pointing at a row that has moved
	 * is worse than no menu. It clamps to the viewport so opening it near the
	 * sidebar's edge can't hang half of it off-screen. Arrow keys move through
	 * the items; Home/End jump to the ends; Enter or Space activates.
	 */
	interface Props {
		x: number;
		y: number;
		items: ContextMenuItem[];
		onclose: () => void;
	}

	let { x, y, items, onclose }: Props = $props();

	let menuEl: HTMLDivElement | undefined;
	let itemEls: HTMLButtonElement[] = [];

	// The menu's real size isn't known until it has rendered once, so it opens
	// at the raw point (size 0 clamps to no-op) and settles into a clamped spot
	// a beat later rather than guessing.
	let size = $state({ width: 0, height: 0 });
	$effect(() => {
		if (!menuEl) return;
		const rect = menuEl.getBoundingClientRect();
		size = { width: rect.width, height: rect.height };
	});

	const pos = $derived.by(() => {
		const margin = 6;
		return {
			x: Math.max(margin, Math.min(x, window.innerWidth - size.width - margin)),
			y: Math.max(margin, Math.min(y, window.innerHeight - size.height - margin))
		};
	});

	$effect(() => {
		itemEls[0]?.focus();
	});

	// Window-level listeners rather than a click-catching backdrop: a backdrop
	// would sit above the sidebar and eat the very right-click that should
	// replace this menu with a new one for a different row. `pointerdown`
	// rather than `contextmenu` for the outside check — a right-click fires
	// `pointerdown` first and `contextmenu` second, so closing on `pointerdown`
	// lets a right-click elsewhere close *this* menu before the target's own
	// `oncontextmenu` opens the next one, instead of racing it closed again.
	// `scroll` needs the capture phase — it doesn't bubble, and the sidebar's
	// own list scrolls independently of the window.
	$effect(() => {
		const closeIfOutside = (event: PointerEvent) => {
			if (event.target instanceof Node && menuEl?.contains(event.target)) return;
			onclose();
		};
		const close = () => onclose();
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

	function activate(item: ContextMenuItem): void {
		onclose();
		item.onSelect();
	}

	function focusBy(delta: number): void {
		const count = itemEls.length;
		if (!count) return;
		const from = itemEls.indexOf(document.activeElement as HTMLButtonElement);
		const next = ((from < 0 ? 0 : from) + delta + count) % count;
		itemEls[next]?.focus();
	}

	function onKeydown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				focusBy(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				focusBy(-1);
				break;
			case 'Home':
				event.preventDefault();
				itemEls[0]?.focus();
				break;
			case 'End':
				event.preventDefault();
				itemEls[itemEls.length - 1]?.focus();
				break;
			case 'Escape':
				event.preventDefault();
				event.stopPropagation();
				onclose();
				break;
			case 'Tab':
				// A transient menu, not a place to tab through.
				onclose();
				break;
		}
	}
</script>

<div
	bind:this={menuEl}
	class="bf-context-menu"
	role="menu"
	tabindex="-1"
	style:left="{pos.x}px"
	style:top="{pos.y}px"
	onkeydown={onKeydown}
	oncontextmenu={(event) => event.preventDefault()}
>
	{#each items as item, index (item.label)}
		<button
			bind:this={itemEls[index]}
			type="button"
			role="menuitem"
			tabindex="-1"
			class:danger={item.danger}
			onclick={() => activate(item)}
		>
			{item.label}
		</button>
	{/each}
</div>

<style>
	.bf-context-menu {
		position: fixed;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 148px;
		padding: 4px;
		border: 1px solid var(--bf-rule-strong);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface);
		box-shadow: var(--bf-shadow-lift);
	}

	button[role='menuitem'] {
		width: 100%;
		padding: 7px 10px;
		border: 0;
		border-radius: calc(var(--bf-radius-sm) - 3px);
		background: none;
		text-align: left;
		font-size: 12.5px;
		color: var(--bf-ink-soft);
		cursor: pointer;
	}

	button[role='menuitem']:hover,
	button[role='menuitem']:focus {
		background: var(--bf-accent-soft);
		color: var(--bf-accent-strong);
		outline: none;
	}

	button[role='menuitem'].danger {
		color: var(--bf-danger);
	}

	button[role='menuitem'].danger:hover,
	button[role='menuitem'].danger:focus {
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
	}
</style>
