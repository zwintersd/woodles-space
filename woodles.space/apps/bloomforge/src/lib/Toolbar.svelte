<script lang="ts">
	import type { ProjectSummary } from './projects.js';
	import EmojiIcon from './EmojiIcon.svelte';
	import { playtest } from './playtest.svelte.js';
	import { studio } from './studio.svelte.js';
	import Tooltip from './Tooltip.svelte';
	import { tour } from './tour.svelte.js';
	import SyncPanel from './SyncPanel.svelte';

	interface Props {
		projects: ProjectSummary[];
		onmanage: () => void;
		onexport: () => void;
		onimport: () => void;
		onaddnote: () => void;
		ontour: () => void;
		onplay: () => void;
	}

	let { projects, onmanage, onexport, onimport, onaddnote, ontour, onplay }: Props = $props();

	const saveLabel = $derived(
		studio.saveState === 'error' ? 'Not saved' : studio.saveState === 'saving' ? 'Saving…' : 'Saved'
	);
</script>

<header class="toolbar">
	<div class="brand">
		<span class="mark"><EmojiIcon char="🌸" size={19} /></span>
		<span class="wordmark">Bloomforge <em>Studio</em></span>
	</div>

	<div class="project">
		<button class="title" type="button" onclick={onmanage} title="Open the projects view">
			{studio.def.meta.title}
			<span class="chevron" aria-hidden="true">▾</span>
		</button>
		{#if projects.length > 1}
			<span class="project-count">{projects.length} projects</span>
		{/if}

		<span class="save" data-state={studio.saveState}>{saveLabel}</span>
		{#if studio.errorCount > 0}
			<span class="errors" title="This game has validation errors and cannot be simulated.">
				{studio.errorCount} error{studio.errorCount === 1 ? '' : 's'}
			</span>
		{/if}
	</div>

	<div class="tools">
		<button class="bf-button" type="button" onclick={onaddnote}><EmojiIcon char="📋" size={13} /> Note</button>
		<button class="bf-button" type="button" onclick={() => studio.undo()} disabled={!studio.canUndo} title="Undo (⌘Z)">
			↶
		</button>
		<button
			class="bf-button"
			type="button"
			onclick={() => studio.redo()}
			disabled={!studio.canRedo}
			title="Redo (⇧⌘Z)"
		>
			↷
		</button>
		<span class="divider" aria-hidden="true"></span>
		<Tooltip
			text="Six short steps to the core loop, four more waiting after — start whenever you want a refresher."
			placement="bottom"
		>
			<button
				class="bf-button help"
				type="button"
				onclick={ontour}
				aria-pressed={tour.active}
				aria-label="Take the tour"
			>
				?
			</button>
		</Tooltip>
		<button class="bf-button" type="button" onclick={onimport}>Import</button>
		<button class="bf-button" type="button" onclick={onexport}>Export</button>
		<SyncPanel />
		<span class="divider" aria-hidden="true"></span>
		<button class="bf-button bf-button--primary play" type="button" onclick={() => playtest.toggle(studio.def)}>
			{playtest.running ? '❙❙ Pause' : playtest.stale && playtest.elapsed > 0 ? '▶ Restart' : '▶ Playtest'}
		</button>
		<!-- The playtest is a simulation of a player; this hands the real game to
		     a real one. Same engine, same def, no export step in between. -->
		<button class="bf-button publish" type="button" onclick={onplay} title="Open this game in the player">
			<EmojiIcon char="🌸" size={13} /> Play it
		</button>
	</div>
</header>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--bf-rule);
		background: var(--bf-surface);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: none;
	}

	.mark {
		font-size: 19px;
	}

	.wordmark {
		font-family: var(--bf-font-display);
		font-size: 18px;
		font-weight: 600;
		color: var(--bf-accent-strong);
		white-space: nowrap;
	}

	.wordmark em {
		font-style: normal;
		color: var(--bf-muted);
		font-weight: 400;
	}

	.project {
		position: relative;
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
	}

	.title {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		max-width: 260px;
		padding: 4px 10px;
		border: 1px solid transparent;
		border-radius: var(--bf-radius-sm);
		background: none;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title:hover {
		background: var(--bf-surface-sunk);
		border-color: var(--bf-rule);
	}

	.chevron {
		color: var(--bf-faint);
		font-size: 10px;
	}

	.project-count {
		flex: none;
		font-size: 10.5px;
		color: var(--bf-faint);
		white-space: nowrap;
	}

	.save {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--bf-faint);
		white-space: nowrap;
	}

	.save[data-state='error'] {
		color: var(--bf-danger);
	}

	.errors {
		padding: 2px 9px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
		font-size: 10.5px;
		font-weight: 650;
		cursor: help;
		white-space: nowrap;
	}

	.tools {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 5px;
		flex: none;
	}

	.divider {
		width: 1px;
		height: 20px;
		background: var(--bf-rule);
		margin: 0 3px;
	}

	.play {
		min-width: 104px;
		justify-content: center;
	}

	.publish {
		white-space: nowrap;
	}

	.help {
		width: 30px;
		justify-content: center;
		padding: 6px 0;
		font-weight: 700;
	}
</style>
