<script lang="ts">
	import type { LoreBlock } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';

	let { block, entryId }: { block: LoreBlock; entryId: string } = $props();

	function update<K extends keyof LoreBlock>(key: K, value: LoreBlock[K]) {
		devlog.updateBlock(entryId, block.id, { [key]: value });
	}

	let tagInput = $state('');

	function addTag() {
		const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
		if (!tag || block.tags.includes(tag)) { tagInput = ''; return; }
		update('tags', [...block.tags, tag]);
		tagInput = '';
	}

	function removeTag(i: number) {
		update('tags', block.tags.filter((_, idx) => idx !== i));
	}

	function autoresize(node: HTMLTextAreaElement) {
		function resize() { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px'; }
		resize();
		node.addEventListener('input', resize);
		return { destroy() { node.removeEventListener('input', resize); } };
	}
</script>

<div class="block-card lore">
	<div class="card-header">
		<span class="type-icon">◐</span>
		<span class="type-label">lore</span>
	</div>

	<div class="fields">
		<label class="field">
			<span class="field-label">title</span>
			<input
				class="field-input"
				value={block.title}
				placeholder="The First Writing"
				oninput={(e) => update('title', e.currentTarget.value)}
			/>
		</label>

		<label class="field">
			<span class="field-label">content</span>
			<textarea
				use:autoresize
				class="field-textarea lore-content"
				value={block.content}
				placeholder="history, factions, Brianna's voice, witch-mythology…"
				oninput={(e) => update('content', e.currentTarget.value)}
			></textarea>
		</label>

		<div class="field">
			<span class="field-label">tags</span>
			<div class="tags-row">
				{#each block.tags as tag, i}
					<span class="tag">
						{tag}
						<button class="tag-remove" onclick={() => removeTag(i)} aria-label="remove {tag}">×</button>
					</span>
				{/each}
				<input
					class="field-input tag-input"
					bind:value={tagInput}
					placeholder="faction, brianna-voice, …"
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
					onblur={addTag}
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.block-card {
		background: var(--d-surface-3);
		border: 1px solid var(--d-border);
		border-radius: var(--d-radius-md);
		overflow: hidden;
		box-shadow: var(--d-shadow-card);
	}
	.lore { border-top: 2px solid var(--d-lore); }

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--d-space-sm);
		padding: var(--d-space-sm) var(--d-space-md);
		background: var(--d-lore-soft);
		border-bottom: 1px solid var(--d-border);
	}
	.type-icon { color: var(--d-lore); font-size: 12px; }
	.type-label {
		font-family: var(--d-font-pixel);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--d-lore);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--d-space-md);
		padding: var(--d-space-md);
	}

	.field { display: flex; flex-direction: column; gap: var(--d-space-xs); }

	.field-label {
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-faint);
		letter-spacing: 0.06em;
	}

	.field-input,
	.field-textarea {
		background: var(--d-surface-2);
		border: 1px solid var(--d-border);
		border-radius: var(--d-radius-sm);
		padding: var(--d-space-xs) var(--d-space-sm);
		font-family: var(--d-font-body);
		font-size: 14px;
		color: var(--d-text);
		transition: border-color var(--d-transition-fast);
		width: 100%;
	}
	.field-input:focus,
	.field-textarea:focus {
		outline: none;
		border-color: var(--d-lore);
		box-shadow: 0 0 0 2px rgba(197, 168, 122, 0.15);
	}
	.field-input::placeholder,
	.field-textarea::placeholder { color: var(--d-placeholder); }
	.field-textarea { resize: none; overflow: hidden; min-height: 60px; line-height: 1.6; }

	.lore-content { min-height: 100px; font-style: italic; }

	.tags-row { display: flex; flex-wrap: wrap; gap: var(--d-space-xs); align-items: center; }

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--d-radius-pill);
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-lore);
		background: var(--d-lore-soft);
		border: 1px solid rgba(197, 168, 122, 0.3);
	}
	.tag-remove {
		opacity: 0.6;
		font-size: 13px;
		transition: opacity var(--d-transition-fast);
	}
	.tag-remove:hover { opacity: 1; }

	.tag-input { width: auto; flex: 1; min-width: 140px; }
</style>
