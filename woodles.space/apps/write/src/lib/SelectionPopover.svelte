<script lang="ts">
	let {
		rect,
		onAdd
	}: {
		rect: { top: number; left: number; width: number } | null;
		onAdd: () => void;
	} = $props();
</script>

{#if rect}
	<div
		class="selection-popover"
		style:top="{rect.top - 38}px"
		style:left="{rect.left + rect.width / 2}px"
	>
		<button
			class="selection-popover-btn"
			onmousedown={(e) => {
				// preventDefault so the selection survives the click
				e.preventDefault();
				onAdd();
			}}
			title="add margin note"
		>+ note</button>
	</div>
{/if}

<style>
	.selection-popover {
		position: absolute;
		z-index: 50;
		transform: translateX(-50%);
		animation: pop-rise 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes pop-rise {
		from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.96); }
		to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
	}
	.selection-popover-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--bg);
		background: var(--accent-strong);
		border: none;
		padding: 6px 14px;
		border-radius: 100px;
		cursor: pointer;
		box-shadow: 0 4px 14px color-mix(in srgb, var(--accent-deep) 35%, transparent);
		transition: background 0.18s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.selection-popover-btn:hover {
		background: var(--accent-deep);
		transform: translateY(-1px);
	}
</style>
