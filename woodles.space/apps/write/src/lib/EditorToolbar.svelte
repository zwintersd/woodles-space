<script lang="ts">
	let {
		bold,
		italic,
		underline,
		onCommand,
		onInsertLink
	}: {
		bold: boolean;
		italic: boolean;
		underline: boolean;
		onCommand: (cmd: string, val?: string | null) => void;
		onInsertLink: () => void;
	} = $props();
</script>

<div class="toolbar">
	<button class="tool-btn" class:active={bold}
		onmousedown={(e) => { e.preventDefault(); onCommand('bold'); }} title="Bold"><b>B</b></button>
	<button class="tool-btn" class:active={italic}
		onmousedown={(e) => { e.preventDefault(); onCommand('italic'); }} title="Italic"><em>I</em></button>
	<button class="tool-btn" class:active={underline}
		onmousedown={(e) => { e.preventDefault(); onCommand('underline'); }} title="Underline"><u>U</u></button>
	<span class="tool-sep"></span>
	<button class="tool-btn"
		onmousedown={(e) => { e.preventDefault(); onCommand('formatBlock', 'h1'); }} title="Heading 1">H1</button>
	<button class="tool-btn"
		onmousedown={(e) => { e.preventDefault(); onCommand('formatBlock', 'h2'); }} title="Heading 2">H2</button>
	<button class="tool-btn"
		onmousedown={(e) => { e.preventDefault(); onCommand('formatBlock', 'p'); }} title="Paragraph">¶</button>
	<span class="tool-sep"></span>
	<button class="tool-btn"
		onmousedown={(e) => { e.preventDefault(); onCommand('formatBlock', 'blockquote'); }} title="Blockquote">❝</button>
	<span class="tool-sep"></span>
	<button class="tool-btn"
		onmousedown={(e) => { e.preventDefault(); onCommand('insertUnorderedList'); }} title="Bullet list">· —</button>
	<button class="tool-btn"
		onmousedown={(e) => { e.preventDefault(); onCommand('insertOrderedList'); }} title="Numbered list">1.</button>
	<span class="tool-sep"></span>
	<button class="tool-btn"
		onmousedown={(e) => { e.preventDefault(); onInsertLink(); }} title="Insert link">link</button>
	<span class="tool-sep"></span>
	<button class="tool-btn"
		onmousedown={(e) => { e.preventDefault(); onCommand('removeFormat'); }} title="Clear formatting">×</button>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 1px;
		padding-bottom: 0.75rem;
		margin-bottom: 1.6rem;
		border-bottom: 1px solid var(--rule);
		flex-wrap: wrap;
		row-gap: 4px;
	}
	.tool-btn {
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		letter-spacing: 0.05em;
		color: var(--muted);
		background: none;
		border: 1px solid transparent;
		padding: 4px 9px;
		border-radius: 5px;
		cursor: pointer;
		transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
		line-height: 1.2;
		user-select: none;
	}
	.tool-btn:hover {
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.tool-btn.active {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.tool-sep {
		width: 1px;
		height: 13px;
		background: var(--rule);
		margin: 0 5px;
		flex-shrink: 0;
	}
</style>
