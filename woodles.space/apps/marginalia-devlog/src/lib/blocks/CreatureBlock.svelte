<script lang="ts">
	import type { CreatureBlock } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';
	import SmartLinkChip from './SmartLinkChip.svelte';

	let { block, entryId }: { block: CreatureBlock; entryId: string } = $props();

	function update<K extends keyof CreatureBlock>(key: K, value: CreatureBlock[K]) {
		devlog.updateBlock(entryId, block.id, { [key]: value });
	}

	let biomeInput = $state('');

	function addBiome() {
		const label = biomeInput.trim();
		if (!label) return;
		update('biome', { kind: 'biome', label });
		biomeInput = '';
	}

	function autoresize(node: HTMLTextAreaElement) {
		function resize() { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px'; }
		resize();
		node.addEventListener('input', resize);
		return { destroy() { node.removeEventListener('input', resize); } };
	}

	const textareaFields: Array<[keyof CreatureBlock, string, string]> = [
		['loreFragment',         'lore fragment',          "what it is in Brianna's world…"],
		['interventionBehavior', 'intervention behavior',  'how writing/reading acts on it…'],
		['visualNotes',          'visual notes',           'color, silhouette, vibe…'],
		['relationships',        'relationships',          'evolved from X, rivals Y…']
	];
</script>

<div class="block-card creature">
	<div class="card-header">
		<span class="type-icon">✦</span>
		<span class="type-label">creature</span>
	</div>

	<div class="fields">
		<label class="field">
			<span class="field-label">name</span>
			<input
				class="field-input"
				value={block.name}
				placeholder="Mossfang"
				oninput={(e) => update('name', e.currentTarget.value)}
			/>
		</label>

		<div class="field">
			<span class="field-label">biome</span>
			<div class="link-row">
				{#if block.biome}
					<SmartLinkChip link={block.biome} onremove={() => update('biome', null)} />
				{:else}
					<input
						class="field-input link-input"
						bind:value={biomeInput}
						placeholder="biome name…"
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBiome(); } }}
						onblur={addBiome}
					/>
				{/if}
			</div>
		</div>

		{#each textareaFields as [key, label, placeholder]}
			<label class="field">
				<span class="field-label">{label}</span>
				<textarea
					use:autoresize
					class="field-textarea"
					value={String(block[key] ?? '')}
					{placeholder}
					oninput={(e) => update(key, e.currentTarget.value)}
				></textarea>
			</label>
		{/each}
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
	.creature { border-top: 2px solid var(--d-creature); }

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--d-space-sm);
		padding: var(--d-space-sm) var(--d-space-md);
		background: var(--d-creature-soft);
		border-bottom: 1px solid var(--d-border);
	}
	.type-icon { color: var(--d-creature); font-size: 12px; }
	.type-label {
		font-family: var(--d-font-pixel);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--d-creature);
		text-transform: lowercase;
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
		text-transform: lowercase;
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
		border-color: var(--d-creature);
		box-shadow: 0 0 0 2px rgba(192, 126, 245, 0.15);
	}
	.field-input::placeholder,
	.field-textarea::placeholder { color: var(--d-placeholder); }

	.field-textarea { resize: none; overflow: hidden; min-height: 60px; line-height: 1.6; }

	.link-row { display: flex; flex-wrap: wrap; gap: var(--d-space-xs); align-items: center; }

	.link-input { width: auto; flex: 1; min-width: 140px; }
</style>
