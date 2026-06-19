<script lang="ts">
	import type { BiomeBlock, SmartLink } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';
	import SmartLinkChip from './SmartLinkChip.svelte';

	let { block, entryId }: { block: BiomeBlock; entryId: string } = $props();

	function update<K extends keyof BiomeBlock>(key: K, value: BiomeBlock[K]) {
		devlog.updateBlock(entryId, block.id, { [key]: value });
	}

	let creatureInput = $state('');

	function addCreature() {
		const label = creatureInput.trim();
		if (!label) return;
		update('nativeCreatures', [...block.nativeCreatures, { kind: 'creature', label } satisfies SmartLink]);
		creatureInput = '';
	}

	function removeCreature(i: number) {
		update('nativeCreatures', block.nativeCreatures.filter((_, idx) => idx !== i));
	}

	function autoresize(node: HTMLTextAreaElement) {
		function resize() { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px'; }
		resize();
		node.addEventListener('input', resize);
		return { destroy() { node.removeEventListener('input', resize); } };
	}

	const textareaFields: Array<[keyof BiomeBlock, string, string]> = [
		['hexGridPosition', 'hex grid position', 'tier/position in the hex-grid…'],
		['climateMood',     'climate mood',       'feels like…'],
		['mechanicExpression', 'mechanic expression', 'how "reading for the stars" manifests here…'],
		['atmosphereNotes',  'atmosphere notes',  'sensory tone, light quality, sound…']
	];
</script>

<div class="block-card biome">
	<div class="card-header">
		<span class="type-icon">◈</span>
		<span class="type-label">biome</span>
	</div>

	<div class="fields">
		<label class="field">
			<span class="field-label">name</span>
			<input
				class="field-input"
				value={block.name}
				placeholder="The Verdant Margin"
				oninput={(e) => update('name', e.currentTarget.value)}
			/>
		</label>

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

		<div class="field">
			<span class="field-label">native creatures</span>
			<div class="link-row">
				{#each block.nativeCreatures as link, i}
					<SmartLinkChip {link} onremove={() => removeCreature(i)} />
				{/each}
				<input
					class="field-input link-input"
					bind:value={creatureInput}
					placeholder="creature name…"
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCreature(); } }}
					onblur={addCreature}
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
	.biome { border-top: 2px solid var(--d-biome); }

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--d-space-sm);
		padding: var(--d-space-sm) var(--d-space-md);
		background: var(--d-biome-soft);
		border-bottom: 1px solid var(--d-border);
	}
	.type-icon { color: var(--d-biome); font-size: 12px; }
	.type-label {
		font-family: var(--d-font-pixel);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--d-biome);
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
		border-color: var(--d-biome);
		box-shadow: 0 0 0 3px var(--d-biome-glow);
	}
	.field-input::placeholder,
	.field-textarea::placeholder { color: var(--d-placeholder); }

	.field-textarea { resize: none; overflow: hidden; min-height: 60px; line-height: 1.6; }

	.link-row { display: flex; flex-wrap: wrap; gap: var(--d-space-xs); align-items: center; }
	.link-input { width: auto; flex: 1; min-width: 140px; }
</style>
