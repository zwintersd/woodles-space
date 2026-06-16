<script lang="ts">
	// Ten cells filled left-to-right in the stat's accent color. At zero the
	// cells stay visible as empty outlines — a 0 should read as chosen, not
	// as "not yet filled in".
	// When onpick is provided the bar becomes interactive: click to set,
	// drag to scrub, hover previews the target value.
	let {
		value,
		colorVar,
		onpick
	}: { value: number; colorVar: string; onpick?: (n: number) => void } = $props();

	const cells = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	let hover = $state(-1);
	let dragging = $state(false);

	function pick(n: number) {
		onpick?.(n);
	}

	function startDrag(n: number) {
		dragging = true;
		pick(n);
	}

	function handleEnter(n: number) {
		hover = n;
		if (dragging) pick(n);
	}

	function handleLeave() {
		if (!dragging) hover = -1;
	}

	function stopDrag() {
		dragging = false;
		hover = -1;
	}

	$effect(() => {
		if (dragging) {
			window.addEventListener('mouseup', stopDrag);
			return () => window.removeEventListener('mouseup', stopDrag);
		}
	});

	function cellClass(n: number) {
		if (hover >= 0) {
			if (n <= hover && n <= value) return 'filled';
			if (n <= hover && n > value) return 'preview';
			if (n > hover && n <= value) return 'removing';
			return '';
		}
		return n <= value ? 'filled' : '';
	}
</script>

<div
	class="bar"
	class:interactive={!!onpick}
	style="--c: var({colorVar})"
	aria-hidden="true"
	onmouseleave={handleLeave}
>
	{#each cells as n (n)}
		<span
			class="cell {cellClass(n)}"
			role="presentation"
			onmouseenter={() => handleEnter(n)}
			onmousedown={onpick ? () => startDrag(n) : undefined}
		></span>
	{/each}
</div>

<style>
	.bar {
		display: flex;
		gap: 2px;
		align-items: center;
	}
	.cell {
		width: 0.5rem;
		height: 0.72rem;
		border-radius: 2px;
		border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
		background: transparent;
		transition: background var(--b-transition-fast), border-color var(--b-transition-fast);
	}
	.cell.filled {
		background: var(--c);
		border-color: var(--c);
	}
	.cell.preview {
		background: color-mix(in srgb, var(--c) 35%, transparent);
		border-color: color-mix(in srgb, var(--c) 65%, transparent);
	}
	.cell.removing {
		background: color-mix(in srgb, var(--c) 20%, transparent);
		border-color: color-mix(in srgb, var(--c) 30%, transparent);
	}
	.interactive {
		cursor: pointer;
		user-select: none;
	}
	.interactive .cell {
		transition:
			background 60ms ease,
			border-color 60ms ease;
	}
</style>
