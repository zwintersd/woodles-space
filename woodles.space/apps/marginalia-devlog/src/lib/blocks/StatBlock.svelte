<script lang="ts">
	import type { StatBlock } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';

	let { block, entryId }: { block: StatBlock; entryId: string } = $props();

	function update<K extends keyof StatBlock>(key: K, value: StatBlock[K]) {
		devlog.updateBlock(entryId, block.id, { [key]: value });
	}

	function autoresize(node: HTMLTextAreaElement) {
		function resize() { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px'; }
		resize();
		node.addEventListener('input', resize);
		return { destroy() { node.removeEventListener('input', resize); } };
	}

	const textareaFields: Array<[keyof StatBlock, string, string]> = [
		['narrativeMeaning',       'narrative meaning',       'what this stat represents thematically…'],
		['highExamples',           'high examples',           'creatures/archetypes that run high…'],
		['lowExamples',            'low examples',            'creatures/archetypes that run low…'],
		['crossRpgEquivalents',    'cross-RPG equivalents',   'this is basically Constitution in D&D…'],
		['operationalizationIdeas','operationalization ideas', 'design intent — how this could matter mechanically…']
	];
</script>

<div class="block-card stat">
	<div class="card-header">
		<span class="type-icon">▲</span>
		<span class="type-label">stat</span>
	</div>

	<div class="fields">
		<label class="field">
			<span class="field-label">name</span>
			<input
				class="field-input"
				value={block.name}
				placeholder="Resonance"
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
	.stat { border-top: 2px solid var(--d-stat); }

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--d-space-sm);
		padding: var(--d-space-sm) var(--d-space-md);
		background: var(--d-stat-soft);
		border-bottom: 1px solid var(--d-border);
	}
	.type-icon { color: var(--d-stat); font-size: 12px; }
	.type-label {
		font-family: var(--d-font-pixel);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--d-stat);
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
		border-color: var(--d-stat);
		box-shadow: 0 0 0 3px var(--d-stat-glow);
	}
	.field-input::placeholder,
	.field-textarea::placeholder { color: var(--d-placeholder); }
	.field-textarea { resize: none; overflow: hidden; min-height: 60px; line-height: 1.6; }
</style>
