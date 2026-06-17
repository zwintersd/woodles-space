<script lang="ts">
	import type { DevlogEntry, BlockType } from '$lib/types';
	import { devlog } from '$lib/devlog.svelte';
	import { syncState, flushSync } from '$lib/sync.svelte';
	import ProseBlock from '$lib/blocks/ProseBlock.svelte';
	import CreatureBlock from '$lib/blocks/CreatureBlock.svelte';
	import BiomeBlock from '$lib/blocks/BiomeBlock.svelte';
	import AbilityBlock from '$lib/blocks/AbilityBlock.svelte';
	import StatBlock from '$lib/blocks/StatBlock.svelte';
	import MinigameBlock from '$lib/blocks/MinigameBlock.svelte';
	import LoreBlock from '$lib/blocks/LoreBlock.svelte';

	let { entry }: { entry: DevlogEntry } = $props();

	let pickerOpen = $state(false);
	let insertAfterIndex = $state<number | undefined>(undefined);

	const BLOCK_TYPES: Array<{ type: BlockType; icon: string; label: string; desc: string }> = [
		{ type: 'prose',    icon: '¶',  label: 'prose',    desc: 'freeform text' },
		{ type: 'creature', icon: '✦',  label: 'creature', desc: 'a written beast' },
		{ type: 'biome',    icon: '◈',  label: 'biome',    desc: 'a world-terrain' },
		{ type: 'ability',  icon: '◆',  label: 'ability',  desc: 'a power exercised' },
		{ type: 'stat',     icon: '▲',  label: 'stat',     desc: 'a measured quality' },
		{ type: 'minigame', icon: '●',  label: 'minigame', desc: 'a played loop' },
		{ type: 'lore',     icon: '◐',  label: 'lore',     desc: 'the recorded past' }
	];

	function openPicker(afterIndex?: number) {
		insertAfterIndex = afterIndex;
		pickerOpen = true;
	}

	function closePicker() { pickerOpen = false; }

	function pickBlock(type: BlockType) {
		devlog.addBlock(entry.id, type, insertAfterIndex);
		pickerOpen = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (pickerOpen) { closePicker(); return; }
			devlog.closeEntry();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="editor">
	<!-- header -->
	<header class="editor-header">
		<button class="back-btn" onclick={() => devlog.closeEntry()} aria-label="back to devlog">
			← devlog
		</button>
		<div class="header-right">
			{#if syncState.connected}
				<button
					class="sync-btn"
					class:syncing={syncState.syncing}
					class:error={syncState.status === 'error'}
					onclick={flushSync}
					disabled={syncState.syncing}
					title={syncState.errorMessage ?? (syncState.lastSyncedAt ? `last synced ${syncState.lastSyncedAt.toLocaleTimeString()}` : 'sync')}
				>
					{syncState.syncing ? '⟳' : syncState.status === 'error' ? '!' : '↑'}
				</button>
			{/if}
		</div>
	</header>

	<!-- entry meta -->
	<div class="entry-meta">
		<input
			class="title-input"
			value={entry.title}
			placeholder="entry title"
			oninput={(e) => devlog.updateEntry(entry.id, { title: e.currentTarget.value })}
		/>
		<input
			type="date"
			class="date-input"
			value={entry.date}
			onchange={(e) => devlog.updateEntry(entry.id, { date: e.currentTarget.value })}
		/>
	</div>

	<!-- blocks -->
	<div class="blocks">
		{#each entry.blocks as block, i (block.id)}
			<div class="block-wrapper">
				<div class="block-controls">
					<button
						class="ctrl-btn"
						onclick={() => devlog.moveBlock(entry.id, block.id, 'up')}
						disabled={i === 0}
						aria-label="move block up"
					>↑</button>
					<button
						class="ctrl-btn"
						onclick={() => devlog.moveBlock(entry.id, block.id, 'down')}
						disabled={i === entry.blocks.length - 1}
						aria-label="move block down"
					>↓</button>
					<button
						class="ctrl-btn danger"
						onclick={() => devlog.deleteBlock(entry.id, block.id)}
						aria-label="delete block"
					>×</button>
				</div>

				<div class="block-content">
					{#if block.type === 'prose'}
						<ProseBlock {block} entryId={entry.id} />
					{:else if block.type === 'creature'}
						<CreatureBlock {block} entryId={entry.id} />
					{:else if block.type === 'biome'}
						<BiomeBlock {block} entryId={entry.id} />
					{:else if block.type === 'ability'}
						<AbilityBlock {block} entryId={entry.id} />
					{:else if block.type === 'stat'}
						<StatBlock {block} entryId={entry.id} />
					{:else if block.type === 'minigame'}
						<MinigameBlock {block} entryId={entry.id} />
					{:else if block.type === 'lore'}
						<LoreBlock {block} entryId={entry.id} />
					{/if}
				</div>

				<button
					class="add-between"
					onclick={() => openPicker(i)}
					aria-label="add block after this one"
				>+ add block</button>
			</div>
		{/each}

		{#if entry.blocks.length === 0}
			<button class="add-first" onclick={() => openPicker()}>+ add a block</button>
		{/if}
	</div>

	<!-- end-of-entry add -->
	{#if entry.blocks.length > 0}
		<div class="add-end">
			<button class="add-btn" onclick={() => openPicker(entry.blocks.length - 1)}>
				+ add block
			</button>
		</div>
	{/if}
</div>

<!-- block picker overlay -->
{#if pickerOpen}
	<div class="picker-backdrop" role="presentation" onclick={closePicker} onkeydown={closePicker}></div>
	<div class="picker" role="dialog" aria-label="choose block type">
		<p class="picker-title">insert block</p>
		<div class="picker-grid">
			{#each BLOCK_TYPES as bt}
				<button
					class="picker-item"
					data-type={bt.type}
					onclick={() => pickBlock(bt.type)}
				>
					<span class="picker-icon">{bt.icon}</span>
					<span class="picker-label">{bt.label}</span>
					<span class="picker-desc">{bt.desc}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.editor {
		max-width: var(--d-max-width);
		margin: 0 auto;
		padding: var(--d-space-lg) var(--d-space-md);
		padding-bottom: var(--d-space-2xl);
	}

	/* ── header ─────────────────────────────────────────────────────── */
	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--d-space-lg);
	}

	.back-btn {
		font-family: var(--d-font-mono);
		font-size: 12px;
		color: var(--d-text-dim);
		letter-spacing: 0.04em;
		padding: 4px 0;
		transition: color var(--d-transition-fast);
	}
	.back-btn:hover { color: var(--d-accent); }

	.header-right { display: flex; align-items: center; gap: var(--d-space-sm); }

	.sync-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--d-radius-sm);
		border: 1px solid var(--d-border-mid);
		font-size: 14px;
		color: var(--d-text-dim);
		transition: all var(--d-transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.sync-btn:hover { color: var(--d-accent); border-color: var(--d-accent); }
	.sync-btn.syncing { animation: spin 1s linear infinite; }
	.sync-btn.error { color: var(--d-ability); border-color: var(--d-ability); }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ── entry meta ─────────────────────────────────────────────────── */
	.entry-meta {
		margin-bottom: var(--d-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--d-space-sm);
	}

	.title-input {
		font-family: var(--d-font-display);
		font-size: clamp(1.6rem, 4vw, 2.4rem);
		font-weight: 600;
		color: var(--d-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--d-border);
		padding: 0 0 var(--d-space-xs) 0;
		width: 100%;
		transition: border-color var(--d-transition-fast);
	}
	.title-input:focus { outline: none; border-color: var(--d-accent); }
	.title-input::placeholder { color: var(--d-placeholder); }

	.date-input {
		font-family: var(--d-font-mono);
		font-size: 12px;
		color: var(--d-text-faint);
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.date-input:focus { outline: none; color: var(--d-text-dim); }

	/* ── blocks ─────────────────────────────────────────────────────── */
	.blocks {
		display: flex;
		flex-direction: column;
		gap: var(--d-space-xs);
	}

	.block-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.block-controls {
		display: flex;
		justify-content: flex-end;
		gap: 2px;
		padding-bottom: var(--d-space-xs);
		opacity: 0;
		transition: opacity var(--d-transition-fast);
	}
	.block-wrapper:hover .block-controls,
	.block-wrapper:focus-within .block-controls { opacity: 1; }

	.ctrl-btn {
		width: 22px;
		height: 22px;
		border-radius: var(--d-radius-sm);
		border: 1px solid var(--d-border);
		font-size: 12px;
		color: var(--d-text-faint);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--d-transition-fast);
	}
	.ctrl-btn:hover { color: var(--d-text); border-color: var(--d-border-mid); }
	.ctrl-btn:disabled { opacity: 0.2; cursor: not-allowed; }
	.ctrl-btn.danger:hover { color: var(--d-ability); border-color: var(--d-ability); }

	.block-content { width: 100%; }

	/* ── add between blocks ─────────────────────────────────────────── */
	.add-between {
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-faint);
		padding: var(--d-space-xs) 0;
		opacity: 0;
		transition: opacity var(--d-transition-fast);
		text-align: left;
		letter-spacing: 0.04em;
	}
	.block-wrapper:hover .add-between,
	.block-wrapper:focus-within .add-between { opacity: 1; }
	.add-between:hover { color: var(--d-accent); opacity: 1; }

	.add-first,
	.add-btn {
		font-family: var(--d-font-mono);
		font-size: 12px;
		color: var(--d-text-dim);
		letter-spacing: 0.04em;
		padding: var(--d-space-sm) 0;
		transition: color var(--d-transition-fast);
	}
	.add-first:hover,
	.add-btn:hover { color: var(--d-accent); }

	.add-end {
		margin-top: var(--d-space-md);
		border-top: 1px solid var(--d-border);
		padding-top: var(--d-space-md);
	}

	/* ── block picker ───────────────────────────────────────────────── */
	.picker-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--d-z-picker);
		background: rgba(0, 0, 0, 0.4);
	}

	.picker {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: calc(var(--d-z-picker) + 1);
		background: var(--d-surface-2);
		border: 1px solid var(--d-border-mid);
		border-radius: var(--d-radius-lg);
		padding: var(--d-space-md);
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
		min-width: 320px;
		max-width: 420px;
	}

	.picker-title {
		font-family: var(--d-font-mono);
		font-size: 11px;
		color: var(--d-text-faint);
		letter-spacing: 0.08em;
		text-transform: lowercase;
		margin-bottom: var(--d-space-md);
	}

	.picker-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--d-space-sm);
	}

	.picker-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--d-space-sm) var(--d-space-md);
		border-radius: var(--d-radius-md);
		border: 1px solid var(--d-border);
		background: var(--d-surface-3);
		text-align: left;
		transition: all var(--d-transition-fast);
	}
	.picker-item:hover {
		background: var(--d-surface-4);
		border-color: var(--d-border-mid);
		transform: translateY(-1px);
	}

	.picker-item[data-type='prose']:hover    { border-color: var(--d-prose); }
	.picker-item[data-type='creature']:hover { border-color: var(--d-creature); }
	.picker-item[data-type='biome']:hover    { border-color: var(--d-biome); }
	.picker-item[data-type='ability']:hover  { border-color: var(--d-ability); }
	.picker-item[data-type='stat']:hover     { border-color: var(--d-stat); }
	.picker-item[data-type='minigame']:hover { border-color: var(--d-minigame); }
	.picker-item[data-type='lore']:hover     { border-color: var(--d-lore); }

	.picker-icon {
		font-size: 16px;
		margin-bottom: 2px;
	}
	.picker-item[data-type='prose']    .picker-icon { color: var(--d-prose); }
	.picker-item[data-type='creature'] .picker-icon { color: var(--d-creature); }
	.picker-item[data-type='biome']    .picker-icon { color: var(--d-biome); }
	.picker-item[data-type='ability']  .picker-icon { color: var(--d-ability); }
	.picker-item[data-type='stat']     .picker-icon { color: var(--d-stat); }
	.picker-item[data-type='minigame'] .picker-icon { color: var(--d-minigame); }
	.picker-item[data-type='lore']     .picker-icon { color: var(--d-lore); }

	.picker-label {
		font-family: var(--d-font-pixel);
		font-size: 12px;
		color: var(--d-text);
		letter-spacing: 0.04em;
	}
	.picker-desc {
		font-family: var(--d-font-mono);
		font-size: 10px;
		color: var(--d-text-faint);
	}
</style>
