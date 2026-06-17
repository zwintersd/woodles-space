<script lang="ts">
	import type { ProseBlock } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';

	let { block, entryId }: { block: ProseBlock; entryId: string } = $props();

	function autoresize(node: HTMLTextAreaElement) {
		function resize() {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		}
		resize();
		node.addEventListener('input', resize);
		return { destroy() { node.removeEventListener('input', resize); } };
	}
</script>

<div class="prose-block">
	<textarea
		use:autoresize
		value={block.content}
		placeholder="write here…"
		oninput={(e) => devlog.updateBlock(entryId, block.id, { content: e.currentTarget.value })}
	></textarea>
</div>

<style>
	.prose-block { width: 100%; }

	textarea {
		width: 100%;
		min-height: 80px;
		resize: none;
		background: transparent;
		border: none;
		font-family: var(--d-font-body);
		font-size: 15px;
		line-height: 1.75;
		color: var(--d-text);
		padding: var(--d-space-sm) 0;
		overflow: hidden;
	}

	textarea::placeholder { color: var(--d-placeholder); }

	textarea:focus { outline: none; }
</style>
