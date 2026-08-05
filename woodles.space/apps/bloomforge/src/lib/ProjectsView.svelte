<script lang="ts">
	import { serializeGameDef, type GameDef } from '@woodles/incremental-core';
	import ContextMenu, { type ContextMenuItem } from './ContextMenu.svelte';
	import {
		deleteProject,
		duplicateProject,
		loadProject,
		renameProject,
		type ProjectSummary
	} from './projects.js';
	import { studio } from './studio.svelte.js';

	/**
	 * The whole shelf, not a quick-switch list. Everything you'd otherwise need
	 * localStorage devtools for — renaming a game you're not in, duplicating
	 * one as a starting point, deleting an old experiment — lives here instead.
	 *
	 * A native `<dialog>`, same as Welcome: focus trapping and Escape come free.
	 */
	interface Props {
		projects: ProjectSummary[];
		onopen: (id: string) => void;
		oncreate: () => void;
		onclose: () => void;
		/** Something changed on disk outside the open project; go re-read the index. */
		onchange: () => void;
		onmessage: (message: string) => void;
	}

	let { projects, onopen, oncreate, onclose, onchange, onmessage }: Props = $props();

	let dialogEl: HTMLDialogElement;
	let renamingId = $state<string | null>(null);
	let confirmDeleteId = $state<string | null>(null);
	let menu = $state<{ project: ProjectSummary; x: number; y: number } | null>(null);

	$effect(() => {
		dialogEl?.showModal();
	});

	/** Entity counts per project, read fresh each time the shelf changes. The
	 *  open project reads from memory so a rename or edit shows immediately
	 *  rather than waiting on the next autosave. */
	const stats = $derived.by(() => {
		const map = new Map<string, { currencies: number; generators: number; upgrades: number }>();
		for (const project of projects) {
			const def = project.id === studio.projectId ? studio.def : loadProject(project.id);
			if (!def) continue;
			map.set(project.id, {
				currencies: def.currencies.length,
				generators: def.generators.length,
				upgrades: def.upgrades.length
			});
		}
		return map;
	});

	function relativeTime(iso: string): string {
		const diffMs = Date.now() - new Date(iso).getTime();
		const minutes = Math.round(diffMs / 60_000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
		const days = Math.round(hours / 24);
		if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
		return new Date(iso).toLocaleDateString();
	}

	function statsLabel(id: string): string {
		const s = stats.get(id);
		if (!s) return '';
		return `${s.currencies} currenc${s.currencies === 1 ? 'y' : 'ies'} · ${s.generators} generator${s.generators === 1 ? '' : 's'} · ${s.upgrades} upgrade${s.upgrades === 1 ? '' : 's'}`;
	}

	/**
	 * The open project's title, straight from memory rather than `project.title`
	 * off the index. A rename autosaves on the usual debounce, so reading the
	 * index right after would show the old title for up to 600ms.
	 */
	function titleOf(project: ProjectSummary): string {
		return project.id === studio.projectId ? studio.def.meta.title : project.title;
	}

	function open(id: string): void {
		// Already open — re-loading it from storage would risk clobbering
		// whatever hasn't autosaved yet with the copy still sitting on disk.
		if (id !== studio.projectId) onopen(id);
		onclose();
	}

	function openMenu(event: MouseEvent, project: ProjectSummary): void {
		event.stopPropagation();
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		menu = { project, x: rect.right, y: rect.bottom + 4 };
	}

	function menuItems(project: ProjectSummary): ContextMenuItem[] {
		return [
			{ label: 'Rename', onSelect: () => (renamingId = project.id) },
			{ label: 'Duplicate', onSelect: () => duplicate(project.id) },
			{ label: 'Export JSON', onSelect: () => exportOne(project.id) },
			{ label: 'Delete', danger: true, onSelect: () => (confirmDeleteId = project.id) }
		];
	}

	function commitRename(id: string, value: string): void {
		if (renamingId !== id) return;
		renamingId = null;
		const title = value.trim();
		if (!title) return;
		if (id === studio.projectId) studio.renameProject(title);
		else renameProject(id, title);
		onchange();
	}

	function onRenameKeydown(event: KeyboardEvent, id: string): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitRename(id, (event.currentTarget as HTMLInputElement).value);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			renamingId = null;
			(event.currentTarget as HTMLInputElement).blur();
		}
	}

	function autofocus(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}

	function duplicate(id: string): void {
		// `duplicateProject` reads the def back off disk. For the open project
		// that read can land inside the autosave debounce and pick up a version
		// that's a beat stale — flush first so it can't clone an edit away.
		if (id === studio.projectId) studio.flush();
		const copyId = duplicateProject(id);
		onchange();
		if (copyId) onmessage('Duplicated project');
	}

	function exportOne(id: string): void {
		const def = (id === studio.projectId ? studio.def : loadProject(id)) as GameDef | null;
		if (!def) return;
		const snapshot = $state.snapshot(def) as GameDef;
		const blob = new Blob([serializeGameDef(snapshot)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${snapshot.meta.id || 'game'}.bloomforge.json`;
		link.click();
		URL.revokeObjectURL(url);
		onmessage('Exported JSON');
	}

	function remove(id: string): void {
		const found = projects.find((project) => project.id === id);
		const title = found ? titleOf(found) : 'Project';
		const wasOpen = id === studio.projectId;
		const fallback = projects.find((project) => project.id !== id)?.id ?? null;
		deleteProject(id);
		confirmDeleteId = null;
		onchange();
		if (wasOpen) {
			if (fallback) onopen(fallback);
			else oncreate();
		}
		onmessage(`Deleted ${title}`);
	}
</script>

<dialog bind:this={dialogEl} onclose={() => onclose()} aria-labelledby="bf-projects-title">
	<header>
		<div>
			<h1 id="bf-projects-title">Projects</h1>
			<p class="count">{projects.length} project{projects.length === 1 ? '' : 's'} on this device</p>
		</div>
		<button class="bf-button" type="button" onclick={() => dialogEl.close()} aria-label="Close">✕</button>
	</header>

	<div class="grid">
		{#each projects as project (project.id)}
			<div class="card" class:current={project.id === studio.projectId}>
				{#if confirmDeleteId === project.id}
					<div class="confirm">
						<p>Delete <strong>{titleOf(project)}</strong>? This can't be undone.</p>
						<div class="confirm-actions">
							<button class="bf-button" type="button" onclick={() => (confirmDeleteId = null)}>Cancel</button>
							<button class="bf-button danger" type="button" onclick={() => remove(project.id)}>Delete</button>
						</div>
					</div>
				{:else}
					<div class="head">
						{#if renamingId === project.id}
							<input
								class="rename-input"
								value={titleOf(project)}
								use:autofocus
								onblur={(e) => commitRename(project.id, e.currentTarget.value)}
								onkeydown={(e) => onRenameKeydown(e, project.id)}
							/>
						{:else}
							<button class="open" type="button" onclick={() => open(project.id)}>
								<span class="title">{titleOf(project)}</span>
							</button>
							{#if project.id === studio.projectId}<span class="badge">Open</span>{/if}
						{/if}

						<button class="more" type="button" onclick={(e) => openMenu(e, project)} aria-label="Project actions">
							⋯
						</button>
					</div>

					<p class="meta">{statsLabel(project.id)}</p>
					<p class="updated">Updated {relativeTime(project.updatedAt)}</p>
				{/if}
			</div>
		{/each}

		<button
			class="card new"
			type="button"
			onclick={() => {
				onclose();
				oncreate();
			}}
		>
			<span class="plus">+</span>
			New project
		</button>
	</div>

	<!-- A dialog is promoted to the browser's top layer while open, which sits
	     above ordinary stacking contexts regardless of z-index — a menu
	     rendered as this component's sibling would paint above the backdrop
	     but never receive a click. Nesting it here keeps it in the same
	     top-layer box; `position: fixed` still measures from the viewport. -->
	{#if menu}
		<ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.project)} onclose={() => (menu = null)} />
	{/if}
</dialog>

<style>
	dialog {
		width: min(760px, calc(100vw - 32px));
		max-height: min(600px, calc(100vh - 64px));
		padding: 22px 26px 26px;
		border: 1px solid var(--bf-rule);
		border-radius: var(--bf-radius-lg);
		background: var(--bf-surface);
		box-shadow: var(--bf-shadow-lift);
		color: var(--bf-ink);
		font-family: var(--bf-font-sans);
	}

	dialog::backdrop {
		background: rgba(84, 62, 96, 0.32);
		backdrop-filter: blur(3px);
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
	}

	h1 {
		margin: 0 0 3px;
		font-family: var(--bf-font-display);
		font-size: 23px;
		font-weight: 600;
		color: var(--bf-accent-strong);
	}

	.count {
		margin: 0;
		font-size: 12px;
		color: var(--bf-muted);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(216px, 1fr));
		gap: 12px;
		overflow-y: auto;
		max-height: calc(min(600px, 100vh - 64px) - 90px);
		padding: 2px;
	}

	.card {
		display: flex;
		flex-direction: column;
		min-height: 92px;
		padding: 12px 14px;
		border: 1px solid var(--bf-rule);
		border-radius: var(--bf-radius);
		background: var(--bf-surface-sunk);
		text-align: left;
	}

	.card.current {
		border-color: var(--bf-accent);
		box-shadow: 0 0 0 3px var(--bf-accent-soft);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.open {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.title {
		display: block;
		font-size: 13.5px;
		font-weight: 650;
		color: var(--bf-ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.open:hover .title {
		color: var(--bf-accent-strong);
	}

	.badge {
		flex: none;
		padding: 1px 7px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-accent-soft);
		color: var(--bf-accent-strong);
		font-size: 9.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.rename-input {
		flex: 1;
		min-width: 0;
		padding: 4px 7px;
		border: 1px solid var(--bf-accent);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface);
		color: var(--bf-ink);
		font-size: 13.5px;
		font-weight: 650;
		box-shadow: 0 0 0 3px var(--bf-accent-soft);
	}

	.rename-input:focus {
		outline: none;
	}

	.meta {
		margin: 8px 0 0;
		font-size: 11px;
		color: var(--bf-muted);
	}

	.updated {
		margin: 3px 0 0;
		font-size: 10.5px;
		color: var(--bf-faint);
	}

	.more {
		flex: none;
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: var(--bf-radius-sm);
		background: none;
		color: var(--bf-faint);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
	}

	.more:hover {
		background: var(--bf-surface);
		color: var(--bf-ink-soft);
	}

	.confirm {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
		height: 100%;
	}

	.confirm p {
		margin: 0;
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--bf-ink-soft);
	}

	.confirm-actions {
		display: flex;
		gap: 6px;
	}

	.confirm-actions .bf-button {
		font-size: 11.5px;
		padding: 5px 10px;
	}

	.danger {
		background: var(--bf-danger-soft);
		border-color: var(--bf-danger-soft);
		color: var(--bf-danger);
	}

	.danger:hover {
		background: var(--bf-danger);
		border-color: var(--bf-danger);
		color: var(--bf-on-accent);
	}

	.card.new {
		align-items: center;
		justify-content: center;
		gap: 4px;
		border-style: dashed;
		border-color: var(--bf-rule-strong);
		background: none;
		color: var(--bf-muted);
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
	}

	.card.new:hover {
		border-color: var(--bf-accent);
		color: var(--bf-accent-strong);
		background: var(--bf-accent-soft);
	}

	.plus {
		font-size: 20px;
		font-weight: 400;
		line-height: 1;
	}
</style>
