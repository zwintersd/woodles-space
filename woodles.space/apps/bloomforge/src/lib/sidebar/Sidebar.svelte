<script lang="ts">
	import {
		ENTITY_KIND_LABELS,
		ENTITY_KIND_SINGULAR,
		ENTITY_KINDS,
		entityIndex,
		type EntityKind,
		type EntityRef
	} from '@woodles/incremental-core';
	import ContextMenu, { type ContextMenuItem } from '../ContextMenu.svelte';
	import EmojiIcon from '../EmojiIcon.svelte';
	import { ENTITY_KIND_GLOSSARY } from '../glossary.js';
	import InfoTip from '../InfoTip.svelte';
	import { studio } from '../studio.svelte.js';
	import { tour } from '../tour.svelte.js';

	interface Props {
		onadd: (kind: EntityKind) => void;
	}

	let { onadd }: Props = $props();

	const ICONS: Record<EntityKind, string> = {
		currency: '🪙',
		generator: '🌱',
		upgrade: '✨',
		prestige: '💎',
		unlock: '🔒',
		milestone: '🏆'
	};

	let query = $state('');

	const groups = $derived.by(() => {
		const all = [...entityIndex(studio.def).values()];
		const needle = query.trim().toLowerCase();
		const matching = needle ? all.filter((ref) => ref.name.toLowerCase().includes(needle)) : all;

		return ENTITY_KINDS.map((kind) => ({
			kind,
			label: ENTITY_KIND_LABELS[kind],
			// The count is of everything, not of what survived the filter — a
			// search shouldn't make you think entities vanished.
			total: all.filter((ref) => ref.kind === kind).length,
			entries: matching.filter((ref) => ref.kind === kind)
		}));
	});

	// ── context menu ─────────────────────────────────────────────────────

	let menu = $state<{ id: string; x: number; y: number } | null>(null);
	let renamingId = $state<string | null>(null);

	// A menu (or a rename box) that outlives the entity it points at — the
	// entity removed from another tab via sync, or by the Delete key firing
	// while the menu happens to hold focus — is worse than closing early.
	$effect(() => {
		if (menu && !entityIndex(studio.def).has(menu.id)) menu = null;
	});
	$effect(() => {
		if (renamingId && !entityIndex(studio.def).has(renamingId)) renamingId = null;
	});

	function openMenu(event: MouseEvent, entry: EntityRef): void {
		event.preventDefault();
		studio.select(entry.id);
		// A `contextmenu` event fired by a keyboard (the Menu key, Shift+F10)
		// reports (0, 0) rather than a real point — anchor to the row instead of
		// the corner of the screen.
		const fromKeyboard = event.clientX === 0 && event.clientY === 0;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		menu = {
			id: entry.id,
			x: fromKeyboard ? rect.left : event.clientX,
			y: fromKeyboard ? rect.bottom + 4 : event.clientY
		};
	}

	function menuItems(id: string): ContextMenuItem[] {
		return [
			{ label: 'Rename', onSelect: () => (renamingId = id) },
			{ label: 'Duplicate', onSelect: () => studio.duplicate(id) },
			{ label: 'Delete', danger: true, onSelect: () => studio.remove(id) }
		];
	}

	function commitRename(id: string, value: string): void {
		if (renamingId !== id) return;
		renamingId = null;
		const name = value.trim();
		if (name) studio.rename(id, name);
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
</script>

<aside class="sidebar">
	<header>
		<h2>Systems</h2>
		<span class="sparkle"><EmojiIcon char="✨" size={12} /></span>
	</header>

	<div class="search">
		<label class="sr-only" for="bf-search">Search entities</label>
		<input id="bf-search" class="bf-input" type="search" placeholder="Search…" bind:value={query} />
	</div>

	<div class="groups">
		{#each groups as group (group.kind)}
			<section>
				<div class="group-head">
					<span class="group-icon"><EmojiIcon char={ICONS[group.kind]} size={12} /></span>
					<h3>{group.label}</h3>
					<InfoTip text={ENTITY_KIND_GLOSSARY[group.kind]} placement="bottom" />
					<span class="count">{group.total}</span>
					<button
						class="add"
						class:bf-spotlight={tour.spotlight === `sidebar-${group.kind}`}
						type="button"
						onclick={() => onadd(group.kind)}
						title="Add {ENTITY_KIND_SINGULAR[group.kind]}"
						aria-label="Add {ENTITY_KIND_SINGULAR[group.kind]}"
					>
						+
					</button>
				</div>

				{#if group.entries.length}
					<ul>
						{#each group.entries as entry (entry.id)}
							{@const issues = studio.issuesFor(entry.id)}
							<li>
								{#if renamingId === entry.id}
									<input
										class="rename-input"
										value={entry.name}
										use:autofocus
										onblur={(e) => commitRename(entry.id, e.currentTarget.value)}
										onkeydown={(e) => onRenameKeydown(e, entry.id)}
									/>
								{:else}
									<button
										type="button"
										class:active={studio.selectedId === entry.id}
										onclick={() => studio.select(entry.id)}
										oncontextmenu={(e) => openMenu(e, entry)}
									>
										<span class="entry-name">{entry.name}</span>
										{#if issues.length}
											<span
												class="dot"
												data-severity={issues.some((issue) => issue.severity === 'error') ? 'error' : 'warning'}
												title={issues.map((issue) => issue.message).join('\n')}
											></span>
										{/if}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{:else if query.trim() && group.total > 0}
					<p class="none">no match</p>
				{/if}
			</section>
		{/each}
	</div>

	{#if menu}
		<ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.id)} onclose={() => (menu = null)} />
	{/if}
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 14px 12px;
		border-right: 1px solid var(--bf-rule);
		background: var(--bf-bg-tint);
	}

	header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 12px;
	}

	h2 {
		margin: 0;
		font-family: var(--bf-font-display);
		font-size: 19px;
		font-weight: 600;
	}

	.sparkle {
		display: inline-flex;
	}

	.search {
		margin-bottom: 12px;
	}

	.groups {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: grid;
		gap: 14px;
		align-content: start;
	}

	.group-head {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 0 2px 5px;
	}

	.group-icon {
		display: inline-flex;
	}

	h3 {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--bf-ink-soft);
	}

	.count {
		display: grid;
		place-items: center;
		min-width: 19px;
		height: 18px;
		padding: 0 5px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-surface);
		color: var(--bf-muted);
		font-size: 10px;
		font-weight: 700;
	}

	.add {
		margin-left: auto;
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: var(--bf-radius-sm);
		background: none;
		color: var(--bf-muted);
		font-size: 15px;
		line-height: 1;
		cursor: pointer;
	}

	.add:hover {
		background: var(--bf-surface);
		border-color: var(--bf-rule-strong);
		color: var(--bf-accent);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 2px;
	}

	li button {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 5px 9px;
		border: 0;
		border-radius: var(--bf-radius-sm);
		background: none;
		text-align: left;
		font-size: 12.5px;
		color: var(--bf-ink-soft);
		cursor: pointer;
	}

	li button:hover {
		background: var(--bf-surface);
	}

	li button.active {
		background: var(--bf-surface);
		color: var(--bf-accent-strong);
		font-weight: 600;
		box-shadow: var(--bf-shadow-soft);
	}

	.rename-input {
		width: 100%;
		padding: 4px 8px;
		border: 1px solid var(--bf-accent);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface);
		color: var(--bf-ink);
		font-size: 12.5px;
		box-shadow: 0 0 0 3px var(--bf-accent-soft);
	}

	.rename-input:focus {
		outline: none;
	}

	.entry-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dot {
		width: 6px;
		height: 6px;
		flex: none;
		border-radius: var(--bf-radius-pill);
		cursor: help;
	}

	.dot[data-severity='error'] {
		background: var(--bf-danger);
	}

	.dot[data-severity='warning'] {
		background: var(--bf-warn);
	}

	.none {
		margin: 0 0 0 4px;
		font-size: 11px;
		color: var(--bf-faint);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
