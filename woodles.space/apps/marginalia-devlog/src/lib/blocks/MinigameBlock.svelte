<script lang="ts">
	import type { MinigameBlock, SmartLink } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';
	import SmartLinkChip from './SmartLinkChip.svelte';

	let { block, entryId }: { block: MinigameBlock; entryId: string } = $props();

	function update<K extends keyof MinigameBlock>(key: K, value: MinigameBlock[K]) {
		devlog.updateBlock(entryId, block.id, { [key]: value });
	}

	let statInput = $state('');

	function addStat() {
		const label = statInput.trim();
		if (!label) return;
		update('statsOperationalized', [
			...block.statsOperationalized,
			{ kind: 'stat', label } satisfies SmartLink
		]);
		statInput = '';
	}

	function removeStat(i: number) {
		update('statsOperationalized', block.statsOperationalized.filter((_, idx) => idx !== i));
	}

	function autoresize(node: HTMLTextAreaElement) {
		function resize() { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px'; }
		resize();
		node.addEventListener('input', resize);
		return { destroy() { node.removeEventListener('input', resize); } };
	}

	const textareaFields: Array<[keyof MinigameBlock, string, string]> = [
		['purpose',      'purpose',       'which moment/mechanic this serves…'],
		['coreLoop',     'core loop',     'what the player does, repeated…'],
		['winFailState', 'win/fail state', 'what success and failure look like…'],
		['feelsLike',    'feels like',    'Wordle · Tarot pull · rhythm game · …'],
		['openQuestions','open questions', 'what still needs solving…']
	];
</script>

<div class="block-card minigame">
	<div class="card-header">
		<span class="type-icon">●</span>
		<span class="type-label">minigame</span>
	</div>

	<div class="fields">
		<label class="field">
			<span class="field-label">name</span>
			<input
				class="field-input"
				value={block.name}
				placeholder="The Star Pull"
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
			<span class="field-label">stats operationalized</span>
			<p class="field-hint">realized — stats with actual mechanical expression in this game</p>
			<div class="link-row">
				{#each block.statsOperationalized as link, i}
					<SmartLinkChip {link} onremove={() => removeStat(i)} />
				{/each}
				<input
					class="field-input link-input"
					bind:value={statInput}
					placeholder="stat name…"
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStat(); } }}
					onblur={addStat}
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
	.minigame { border-top: 2px solid var(--d-minigame); }

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--d-space-sm);
		padding: var(--d-space-sm) var(--d-space-md);
		background: var(--d-minigame-soft);
		border-bottom: 1px solid var(--d-border);
	}
	.type-icon { color: var(--d-minigame); font-size: 12px; }
	.type-label {
		font-family: var(--d-font-pixel);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--d-minigame);
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

	.field-hint {
		font-size: 11px;
		color: var(--d-text-faint);
		font-style: italic;
		margin-top: -2px;
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
		border-color: var(--d-minigame);
		box-shadow: 0 0 0 2px rgba(122, 184, 245, 0.15);
	}
	.field-input::placeholder,
	.field-textarea::placeholder { color: var(--d-placeholder); }
	.field-textarea { resize: none; overflow: hidden; min-height: 60px; line-height: 1.6; }

	.link-row { display: flex; flex-wrap: wrap; gap: var(--d-space-xs); align-items: center; }
	.link-input { width: auto; flex: 1; min-width: 140px; }
</style>
