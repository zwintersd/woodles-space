<script lang="ts">
	interface Props {
		onCommand: (cmd: string, value?: string) => void;
	}

	let { onCommand }: Props = $props();

	// `formatBlock` takes a tag name. Browsers historically wanted "<h1>"; modern
	// implementations accept "h1" too. We send the bare tag.
	const blocks: { label: string; tag: string; title: string }[] = [
		{ label: 'P', tag: 'p', title: 'paragraph' },
		{ label: 'H1', tag: 'h1', title: 'heading 1' },
		{ label: 'H2', tag: 'h2', title: 'heading 2' },
		{ label: 'H3', tag: 'h3', title: 'heading 3' },
		{ label: '"', tag: 'blockquote', title: 'blockquote' }
	];

	// onmousedown with preventDefault — keeps the passage's selection alive so
	// the command applies to where the caret is.
	function press(cb: () => void) {
		return (e: MouseEvent) => {
			e.preventDefault();
			cb();
		};
	}
</script>

<div class="toolbar" role="toolbar" aria-label="text formatting">
	<div class="group">
		{#each blocks as b (b.tag)}
			<button
				type="button"
				class="tool"
				title={b.title}
				onmousedown={press(() => onCommand('formatBlock', b.tag))}
			>{b.label}</button>
		{/each}
	</div>

	<div class="sep" aria-hidden="true"></div>

	<div class="group">
		<button
			type="button"
			class="tool"
			title="bulleted list"
			onmousedown={press(() => onCommand('insertUnorderedList'))}
		>•</button>
		<button
			type="button"
			class="tool"
			title="numbered list"
			onmousedown={press(() => onCommand('insertOrderedList'))}
		>1.</button>
	</div>

	<div class="sep" aria-hidden="true"></div>

	<div class="group">
		<button
			type="button"
			class="tool"
			title="undo"
			onmousedown={press(() => onCommand('undo'))}
		>↶</button>
		<button
			type="button"
			class="tool"
			title="redo"
			onmousedown={press(() => onCommand('redo'))}
		>↷</button>
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding: 0.3rem 0.4rem;
		margin-bottom: 0.5rem;
		background: var(--panel-accent);
		border: 1px solid var(--rule);
		border-radius: 3px;
	}
	.group {
		display: flex;
		gap: 0.15rem;
	}
	.sep {
		width: 1px;
		height: 1rem;
		background: var(--rule);
	}
	.tool {
		font-family: var(--font-counter);
		font-size: 0.86rem;
		min-width: 1.7rem;
		padding: 0.2rem 0.4rem;
		color: var(--periwinkle);
		border-radius: 2px;
		line-height: 1;
		transition: color 120ms, background 120ms;
	}
	.tool:hover {
		color: var(--leafeon-pink);
		background: rgba(154, 150, 201, 0.08);
	}
	.tool:active {
		color: var(--cyan);
	}
</style>
