<script lang="ts">
	import type { AbilityBlock, SmartLink } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';
	import SmartLinkChip from './SmartLinkChip.svelte';

	let { block, entryId }: { block: AbilityBlock; entryId: string } = $props();

	function update<K extends keyof AbilityBlock>(key: K, value: AbilityBlock[K]) {
		devlog.updateBlock(entryId, block.id, { [key]: value });
	}

	let tiedInput = $state('');
	let tiedKind = $state<'creature' | 'biome'>('creature');

	function addTied() {
		const label = tiedInput.trim();
		if (!label) return;
		update('tiedTo', [...block.tiedTo, { kind: tiedKind, label } satisfies SmartLink]);
		tiedInput = '';
	}

	function removeTied(i: number) {
		update('tiedTo', block.tiedTo.filter((_, idx) => idx !== i));
	}

	const textareaFields: Array<[keyof AbilityBlock, string, string]> = [
		['mechanicalEffect',       'mechanical effect',       'what it does in-game…'],
		['narrativeJustification', 'narrative justification', 'why this exists in the fiction…'],
		['costLimitation',         'cost / limitation',       'what it costs or prevents…']
	];

	function autoresize(node: HTMLTextAreaElement) {
		function resize() { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px'; }
		resize();
		node.addEventListener('input', resize);
		return { destroy() { node.removeEventListener('input', resize); } };
	}
</script>

<div class="block-card ability">
	<div class="card-header">
		<span class="type-icon">◆</span>
		<span class="type-label">ability</span>
	</div>

	<div class="fields">
		<label class="field">
			<span class="field-label">name</span>
			<input
				class="field-input"
				value={block.name}
				placeholder="Thornweave"
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
			<span class="field-label">tied to</span>
			<div class="link-row">
				{#each block.tiedTo as link, i}
					<SmartLinkChip {link} onremove={() => removeTied(i)} />
				{/each}
				<div class="link-input-group">
					<select bind:value={tiedKind} class="kind-select">
						<option value="creature">creature</option>
						<option value="biome">biome</option>
					</select>
					<input
						class="field-input link-input"
						bind:value={tiedInput}
						placeholder="name…"
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTied(); } }}
						onblur={addTied}
					/>
				</div>
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
	.ability { border-top: 2px solid var(--d-ability); }

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--d-space-sm);
		padding: var(--d-space-sm) var(--d-space-md);
		background: var(--d-ability-soft);
		border-bottom: 1px solid var(--d-border);
	}
	.type-icon { color: var(--d-ability); font-size: 12px; }
	.type-label {
		font-family: var(--d-font-pixel);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--d-ability);
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
		border-color: var(--d-ability);
		box-shadow: 0 0 0 3px var(--d-ability-glow);
	}
	.field-input::placeholder,
	.field-textarea::placeholder { color: var(--d-placeholder); }
	.field-textarea { resize: none; overflow: hidden; min-height: 60px; line-height: 1.6; }

	.link-row { display: flex; flex-wrap: wrap; gap: var(--d-space-xs); align-items: center; }
	.link-input-group { display: flex; gap: 4px; flex: 1; min-width: 200px; }
	.link-input { flex: 1; }

	.kind-select {
		background: var(--d-surface-2);
		border: 1px solid var(--d-border);
		border-radius: var(--d-radius-sm);
		padding: var(--d-space-xs) var(--d-space-sm);
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-dim);
		cursor: pointer;
		white-space: nowrap;
	}
	.kind-select:focus { outline: none; border-color: var(--d-ability); }
</style>
