<script lang="ts">
	export type BubbleAction =
		| 'bold'
		| 'italic'
		| 'underline'
		| 'strikethrough'
		| 'highlight'
		| 'link'
		| 'note';

	let {
		rect,
		onAction
	}: {
		rect: { top: number; left: number; width: number } | null;
		onAction: (action: BubbleAction) => void;
	} = $props();

	function fire(action: BubbleAction) {
		return (e: MouseEvent) => {
			// preventDefault so the selection survives the click
			e.preventDefault();
			onAction(action);
		};
	}
</script>

{#if rect}
	<div
		class="selection-popover"
		style:top="{rect.top - 42}px"
		style:left="{rect.left + rect.width / 2}px"
	>
		<div class="bubble">
			<button class="bub-btn bold" onmousedown={fire('bold')} title="bold (⌘b)">B</button>
			<button class="bub-btn italic" onmousedown={fire('italic')} title="italic (⌘i)">I</button>
			<button class="bub-btn under" onmousedown={fire('underline')} title="underline (⌘u)">U</button>
			<button class="bub-btn strike" onmousedown={fire('strikethrough')} title="strikethrough">S</button>
			<button class="bub-btn" onmousedown={fire('highlight')} title="highlight (toggle)">●</button>
			<button class="bub-btn" onmousedown={fire('link')} title="link">↗</button>
			<span class="bub-sep" aria-hidden="true"></span>
			<button class="bub-btn note" onmousedown={fire('note')} title="add margin note">+ note</button>
		</div>
	</div>
{/if}

<style>
	.selection-popover {
		position: fixed;
		transform: translateX(-50%);
		z-index: 50;
		pointer-events: auto;
	}
	.bubble {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.25rem 0.4rem;
		background: var(--panel-accent);
		border: 1px solid var(--periwinkle);
		border-radius: 3px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}
	.bub-btn {
		font-family: var(--font-counter);
		font-size: 0.86rem;
		color: var(--periwinkle);
		min-width: 1.5rem;
		padding: 0.15rem 0.35rem;
		border-radius: 2px;
		line-height: 1;
	}
	.bub-btn:hover {
		color: var(--leafeon-pink);
		background: rgba(154, 150, 201, 0.12);
	}
	.bub-btn.bold {
		font-weight: 700;
	}
	.bub-btn.italic {
		font-style: italic;
	}
	.bub-btn.under {
		text-decoration: underline;
	}
	.bub-btn.strike {
		text-decoration: line-through;
	}
	.bub-btn.note {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		color: var(--cream);
		padding: 0.18rem 0.5rem;
	}
	.bub-btn.note:hover {
		color: var(--leafeon-pink);
	}
	.bub-sep {
		width: 1px;
		height: 1rem;
		background: var(--rule);
		margin: 0 0.2rem;
	}
</style>
