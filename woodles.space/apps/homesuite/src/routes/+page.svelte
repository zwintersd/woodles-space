<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		HOMESUITE_CHANNEL,
		isHomeSuiteSurfaceMessage,
		type HomeSuiteSurfaceState
	} from '@shared/homesuiteBridge';
	import {
		listArtifacts,
		listTrashedArtifacts,
		prepareSurfaceStorage,
		surfaceFor,
		surfaces,
		type HomeSuiteArtifact,
		type HomeSuiteSurfaceAdapter
	} from '$lib/surfaces';
	import { moveHomeSuiteArtifactToTrash, restoreHomeSuiteArtifact, forgetHomeSuiteArtifact } from '@shared/homesuiteTrash';
	import './homesuite.css';
	import type { CollectionTemplate } from '../../../data/src/lib/collections';

	type Filter = 'all' | 'document' | 'board' | 'collection';
	type PaletteItem = { id: string; label: string; detail: string; enabled: boolean; run: () => void };
	type ShellAction =
		| { action: 'undo' | 'redo' | 'inspect' | 'focus' }
		| { action: 'command'; commandId: string }
		| { action: 'inspector'; controlId: string; value: string }
		| { action: 'mode'; modeId: string };

	let artifacts = $state<HomeSuiteArtifact[]>([]);
	let ready = $state(false);
	let filter = $state<Filter>('all');
	let showingTrash = $state(false);
	let trashed = $state<ReturnType<typeof listTrashedArtifacts>>([]);
	let actionIssue = $state('');
	let permanentConfirmation = $state('');
	let search = $state('');
	let newOpen = $state(false);
	let collectionCreateOpen = $state(false);
	let createIssue = $state('');
	let paletteOpen = $state(false);
	let paletteSearch = $state('');
	let inspectorOpen = $state(true);
	let surfaceState = $state<HomeSuiteSurfaceState | null>(null);
	let surfaceFrame = $state<HTMLIFrameElement | null>(null);
	let paletteInput = $state<HTMLInputElement | null>(null);

	const requestedKind = $derived(page.url.searchParams.get('kind'));
	const requestedId = $derived(page.url.searchParams.get('id'));
	const adapter = $derived(requestedKind ? surfaceFor(requestedKind) : undefined);
	const activeArtifact = $derived(
		adapter && requestedId ? artifacts.find((item) => item.kind === adapter.kind && item.ref.id === requestedId) : undefined
	);
	const activeState = $derived(surfaceState);
	const filtered = $derived(artifacts.filter((artifact) =>
		(filter === 'all' || artifact.kind === filter) &&
		artifact.title.toLowerCase().includes(search.trim().toLowerCase())
	));
	const counts = $derived({
		document: artifacts.filter((item) => item.kind === 'document').length,
		board: artifacts.filter((item) => item.kind === 'board').length,
		collection: artifacts.filter((item) => item.kind === 'collection').length
	});
	const paletteItems = $derived.by((): PaletteItem[] => {
		const shell: PaletteItem[] = [
			{ id: 'shell:index', label: 'Go to HomeSuite', detail: 'Navigation', enabled: true, run: showIndex },
			{ id: 'shell:trash', label: 'Open Trash', detail: 'HomeSuite', enabled: true, run: showTrash },
			...surfaces.map((surface) => ({
				id: `shell:new:${surface.kind}`,
				label: `New ${surface.label.toLowerCase()}`,
				detail: 'Create',
				enabled: true,
				run: () => create(surface)
			}))
		];
		if (!activeArtifact) return shell;
		return [
			...shell,
			{ id: 'shell:move-trash', label: 'Move to Trash', detail: 'HomeSuite artifact', enabled: true, run: moveActiveToTrash },
			{ id: 'shell:inspect', label: inspectorOpen ? 'Hide inspector' : 'Show inspector', detail: 'View', enabled: true, run: () => { inspectorOpen = !inspectorOpen; } },
		...(activeState?.commands ?? []).map((command) => ({
				id: `surface:${command.id}`,
				label: command.label,
				detail: command.shortcut || 'Current surface',
				enabled: command.enabled !== false,
				run: () => sendAction({ action: 'command', commandId: command.id })
			}))
		];
	});
	const visibleCommands = $derived(paletteItems.filter((item) =>
		`${item.label} ${item.detail}`.toLowerCase().includes(paletteSearch.trim().toLowerCase())
	));

	function refresh(): void {
		artifacts = listArtifacts();
		trashed = listTrashedArtifacts();
	}

	function moveActiveToTrash(): void {
		if (!activeArtifact) return;
		moveHomeSuiteArtifactToTrash(activeArtifact);
		actionIssue = '';
		showIndex();
	}

	function restoreArtifact(entry: (typeof trashed)[number]): void {
		restoreHomeSuiteArtifact(entry.ref);
		refresh();
	}

	async function permanentlyDelete(entry: (typeof trashed)[number]): Promise<void> {
		const key = `${entry.ref.app}:${entry.ref.kind}:${entry.ref.id}`;
		if (permanentConfirmation !== key) { permanentConfirmation = key; return; }
		const owner = surfaceFor(entry.kind);
		if (!owner) return;
		try {
			await owner.permanentlyDelete(entry.ref.id);
			forgetHomeSuiteArtifact(entry.ref);
			permanentConfirmation = '';
			actionIssue = '';
			refresh();
		} catch (error) {
			actionIssue = error instanceof Error ? error.message : 'Could not delete this artifact permanently.';
		}
	}

	function artifactUrl(artifact: HomeSuiteArtifact): string {
		return `/homesuite?kind=${encodeURIComponent(artifact.kind)}&id=${encodeURIComponent(artifact.ref.id)}`;
	}

	async function openArtifact(artifact: HomeSuiteArtifact): Promise<void> {
		newOpen = false;
		paletteOpen = false;
		surfaceState = null;
		await goto(artifactUrl(artifact), { noScroll: true });
	}

	function showIndex(): void {
		newOpen = false;
		paletteOpen = false;
		surfaceState = null;
		showingTrash = false;
		refresh();
		void goto('/homesuite', { noScroll: true });
	}

	function showTrash(): void {
		showIndex();
		showingTrash = true;
		refresh();
	}

	function create(surface: HomeSuiteSurfaceAdapter, template?: CollectionTemplate): void {
		if (surface.kind === 'collection' && !template) { collectionCreateOpen = true; newOpen = false; return; }
		collectionCreateOpen = false;
		createIssue = '';
		try {
			const artifact = surface.create(template);
			refresh();
			void openArtifact(artifact);
		} catch (error) {
			createIssue = error instanceof Error ? error.message : 'Could not create that item.';
			collectionCreateOpen = surface.kind === 'collection';
		}
	}

	function sendAction(action: ShellAction): void {
		if (!surfaceFrame?.contentWindow) return;
		surfaceFrame.contentWindow.postMessage(
			{ channel: HOMESUITE_CHANNEL, source: 'shell', type: 'action', ...action },
			window.location.origin
		);
	}

	function handleMessage(event: MessageEvent): void {
		if (event.origin !== window.location.origin || event.source !== surfaceFrame?.contentWindow) return;
		if (!isHomeSuiteSurfaceMessage(event.data)) return;
		const message = event.data;
		if (message.type === 'state') {
			if (!message.state?.artifact?.id) return;
			surfaceState = message.state;
			refresh();
		} else if (message.type === 'request-palette') {
			openPalette();
		} else if (message.type === 'navigate' && message.target === 'index') {
			showIndex();
		}
	}

	function openPalette(): void {
		newOpen = false;
		paletteSearch = '';
		paletteOpen = true;
		setTimeout(() => paletteInput?.focus(), 0);
	}

	function runPaletteItem(item: PaletteItem): void {
		if (!item.enabled) return;
		paletteOpen = false;
		item.run();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			openPalette();
			return;
		}
		if (event.key === 'Escape') {
			paletteOpen = false;
			newOpen = false;
			return;
		}
		if (paletteOpen && event.key === 'Enter' && visibleCommands.length > 0) {
			event.preventDefault();
			runPaletteItem(visibleCommands.find((item) => item.enabled) ?? visibleCommands[0]);
			return;
		}
		if (activeArtifact && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
			const target = event.target as HTMLElement | null;
			if (target?.closest('input, textarea, [contenteditable="true"]')) return;
			event.preventDefault();
			sendAction({ action: event.shiftKey ? 'redo' : 'undo' });
		}
	}

	function formatDate(stamp: string): string {
		const date = new Date(stamp);
		return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	onMount(() => {
		prepareSurfaceStorage();
		refresh();
		ready = true;
		window.addEventListener('message', handleMessage);
		window.addEventListener('storage', refresh);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('message', handleMessage);
			window.removeEventListener('storage', refresh);
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<svelte:head>
	<title>HomeSuite · woodles.space</title>
</svelte:head>

<div class="suite-shell">
	<header class="suite-topbar">
		<div class="suite-navigation">
			<a class="woodles-link" href="/" aria-label="Woodles home">woodles<span>✳</span></a>
			<span class="crumb-separator" aria-hidden="true">/</span>
			<button class="suite-home" onclick={showIndex} aria-label="HomeSuite index">HomeSuite</button>
			{#if activeArtifact}
				<span class="crumb-separator" aria-hidden="true">/</span>
				<span class="kind-badge {activeArtifact.kind}">{activeArtifact.kind}</span>
				<strong class="artifact-title" title={activeState?.artifact.title || activeArtifact.title}>{activeState?.artifact.title || activeArtifact.title}</strong>
			{/if}
		</div>

		<div class="suite-actions">
			{#if activeArtifact}
				<div class="mode-slot" aria-label="Mode">
					{#if (activeState?.modes.length ?? 0) > 1}
						{#each activeState?.modes ?? [] as mode}
							<button class:active={mode.id === activeState?.activeMode} onclick={() => sendAction({ action: 'mode', modeId: mode.id })}>{mode.label}</button>
						{/each}
					{/if}
				</div>
				<div class="history-actions" aria-label="History">
					<button title="Undo" aria-label="Undo" disabled={!activeState?.canUndo} onclick={() => sendAction({ action: 'undo' })}>↶</button>
					<button title="Redo" aria-label="Redo" disabled={!activeState?.canRedo} onclick={() => sendAction({ action: 'redo' })}>↷</button>
				</div>
			{/if}
			<button class="toolbar-button palette-trigger" onclick={openPalette} title="Commands (Ctrl/⌘ K)">⌕ <span>Commands</span><kbd>⌘ K</kbd></button>
			{#if activeArtifact}
				<button class="toolbar-button inspector-trigger" class:pressed={inspectorOpen} aria-label={inspectorOpen ? 'Hide inspector' : 'Show inspector'} aria-pressed={inspectorOpen} onclick={() => { inspectorOpen = !inspectorOpen; }}>☷ <span>Inspector</span></button>
				<button class="toolbar-button trash-trigger" onclick={moveActiveToTrash}>Move to Trash</button>
			{/if}
			<div class="new-wrap">
				<button class="new-button" aria-expanded={newOpen} onclick={() => { newOpen = !newOpen; }}>＋ New <span aria-hidden="true">⌄</span></button>
				{#if newOpen}
					<div class="new-menu" role="menu" aria-label="Create in HomeSuite">
						{#each surfaces as surface}
							<button role="menuitem" onclick={() => create(surface)}><span class="menu-glyph">{surface.kind === 'document' ? '¶' : surface.kind === 'board' ? '▧' : '▦'}</span><span>{surface.label}</span></button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</header>

	{#if !ready}
		<main class="suite-loading" aria-live="polite">Opening HomeSuite…</main>
	{:else if activeArtifact && adapter}
		<div class="surface-layout">
			<div class="surface-main">
				<div class="surface-strip">
					<button class="back-link" onclick={showIndex}>← All things</button>
					{#if activeState?.selection}
						<span class="selection-pill"><span class="selection-dot"></span>{activeState.selection.count && activeState.selection.count > 1 ? `${activeState.selection.count} selected` : activeState.selection.label}</span>
					{:else}
						<span class="surface-hint">{activeArtifact.kind === 'board' ? 'Canvas' : activeArtifact.kind === 'collection' ? 'Table' : 'Writing surface'}</span>
					{/if}
				</div>
				{#key `${activeArtifact.kind}:${activeArtifact.ref.id}`}
					<iframe
						bind:this={surfaceFrame}
						title={`${activeArtifact.title} ${activeArtifact.kind} editor`}
						src={adapter.embedHref(activeArtifact.ref.id)}
						class="native-surface"
					></iframe>
				{/key}
			</div>
			{#if inspectorOpen}
				<aside class="inspector-slot" aria-label="Inspector">
					<div class="inspector-kicker">INSPECTOR</div>
					<h2>{activeState?.inspector?.title || (activeState?.selection ? activeState.selection.label : activeState?.artifact.title || activeArtifact.title)}</h2>
					<p class="inspector-kind">{activeState?.selection?.kind || activeArtifact.kind}</p>
					{#if activeState?.inspector?.rows.length}
						<dl>
							{#each activeState.inspector.rows as row}
								<div><dt>{row.label}</dt><dd>{row.value}</dd></div>
							{/each}
						</dl>
					{:else}
						<p class="inspector-empty">Select something on the {activeArtifact.kind === 'board' ? 'board' : activeArtifact.kind === 'collection' ? 'table' : 'page'} to see it here.</p>
					{/if}
					{#if activeState?.inspector?.controls?.length}
						<div class="inspector-controls">
							{#each activeState.inspector.controls as control (control.id)}
								<label>{control.label}<input value={control.value} disabled={control.id === 'field:type'} oninput={(event) => sendAction({ action: 'inspector', controlId: control.id, value: event.currentTarget.value })} /></label>
							{/each}
						</div>
					{/if}
					{#if activeState?.inspector?.actions?.length}
						<div class="inspector-actions">
							{#each activeState.inspector.actions as action}
								<button disabled={action.enabled === false} onclick={() => sendAction({ action: 'command', commandId: action.commandId })}>{action.label}</button>
							{/each}
						</div>
					{/if}
					{#if !activeState?.inspector?.actions?.length && activeState?.commands.some((command) => command.id === 'inspect' && command.enabled !== false)}
						<button class="inspector-detail" onclick={() => sendAction({ action: 'inspect' })}>Open details in {activeArtifact.kind === 'board' ? 'Whiteboard' : activeArtifact.kind === 'collection' ? 'Data' : 'Write'} ↗</button>
					{/if}
				</aside>
			{/if}
		</div>
		{:else if requestedId && ready}
		<main class="missing-artifact"><span>Nothing at that address</span><h1>This {requestedKind || 'thing'} is not in your HomeSuite yet.</h1><button onclick={showIndex}>Back to HomeSuite</button></main>
	{:else}
		<main class="suite-index">
				<div class="index-heading">
					<div><div class="eyebrow">{showingTrash ? 'HOME SUITE TRASH' : 'YOUR WORKSPACE'}</div><h1>{#if showingTrash}A little room to reconsider.{:else}All your things, <em>within reach.</em>{/if}</h1><p>{showingTrash ? 'Trashed items keep their identity and contents until you restore or permanently delete them.' : 'Documents, boards, and Collections share one place to begin. Each opens in the surface made for it.'}</p></div>
					<div class="index-count"><strong>{showingTrash ? trashed.length : artifacts.length}</strong><span>{showingTrash ? 'things in Trash' : 'things in HomeSuite'}</span></div>
			</div>
				<div class="index-toolbar">
					<nav class="index-views" aria-label="HomeSuite views"><button class:active={!showingTrash} onclick={() => { showingTrash = false; }}>Workspace</button><button class:active={showingTrash} onclick={() => { showingTrash = true; }}>Trash <span>{trashed.length}</span></button></nav>
					{#if !showingTrash}
				<div class="filters" aria-label="Filter artifacts">
					<button class:active={filter === 'all'} onclick={() => { filter = 'all'; }}>All <span>{artifacts.length}</span></button>
					<button class:active={filter === 'document'} onclick={() => { filter = 'document'; }}>Documents <span>{counts.document}</span></button>
					<button class:active={filter === 'board'} onclick={() => { filter = 'board'; }}>Boards <span>{counts.board}</span></button>
					<button class:active={filter === 'collection'} onclick={() => { filter = 'collection'; }}>Collections <span>{counts.collection}</span></button>
				</div>
				<label class="index-search"><span aria-hidden="true">⌕</span><input bind:value={search} aria-label="Find a thing" placeholder="Find a thing" /></label>
					{/if}
			</div>
				{#if actionIssue}<div class="trash-issue" role="alert">{actionIssue}</div>{/if}
				{#if showingTrash && trashed.length}
					<div class="artifact-list" aria-label="Trashed artifacts">
						{#each trashed as entry (entry.ref.app + entry.ref.id)}
							<div class="artifact-row trash-row">
								<span class="artifact-icon {entry.kind}" aria-hidden="true">{entry.kind === 'document' ? '¶' : entry.kind === 'board' ? '▧' : '▦'}</span>
								<span class="artifact-copy"><strong>{entry.title}</strong><small>{entry.kind} · moved {formatDate(entry.trashedAt)}</small></span>
								<button class="trash-action" onclick={() => restoreArtifact(entry)}>Restore</button>
								{#if permanentConfirmation === `${entry.ref.app}:${entry.ref.kind}:${entry.ref.id}`}
									<button class="trash-action permanent" onclick={() => permanentlyDelete(entry)}>Confirm permanent deletion</button>
									<button class="trash-action" onclick={() => permanentConfirmation = ''}>Cancel</button>
								{:else}
									<button class="trash-action permanent" onclick={() => permanentlyDelete(entry)}>Delete permanently</button>
								{/if}
							</div>
						{/each}
					</div>
				{:else if showingTrash}
					<div class="empty-list"><span>✳</span><h2>Trash is empty.</h2><p>Top-level documents, boards, and Collections you move to Trash will appear here.</p></div>
				{:else if filtered.length}
				<div class="artifact-list" aria-label="Recent artifacts">
					{#each filtered as artifact (artifact.ref.app + artifact.ref.id)}
						<button class="artifact-row" onclick={() => openArtifact(artifact)}>
							<span class="artifact-icon {artifact.kind}" aria-hidden="true">{artifact.kind === 'document' ? '¶' : artifact.kind === 'board' ? '▧' : '▦'}</span>
							<span class="artifact-copy"><strong>{artifact.title}</strong><small>{artifact.kind === 'document' ? 'Write' : artifact.kind === 'board' ? 'Whiteboard' : `${artifact.recordCount ?? 0} records`}</small></span>
							<span class="kind-badge {artifact.kind}">{artifact.kind}</span>
							<time datetime={artifact.updatedAt}>{formatDate(artifact.updatedAt)}</time>
							<span class="row-arrow" aria-hidden="true">↗</span>
						</button>
						{/each}
				</div>
			{:else}
				<div class="empty-list"><span>✳</span><h2>{search ? 'Nothing by that name yet.' : 'A place for your next thing.'}</h2><p>{search ? 'Try another word or clear the search.' : 'Use New to start a document, board, or Collection.'}</p></div>
			{/if}
		</main>
	{/if}
</div>

{#if collectionCreateOpen}
	<div class="template-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) collectionCreateOpen = false; }}>
		<div class="template-dialog" role="dialog" aria-modal="true" aria-label="New collection">
			<div class="eyebrow">START WITH A SHAPE</div><h2>New collection</h2><p>These are suggestions. Each one is a regular Collection you can change as you work.</p>
			{#if createIssue}<div class="create-issue" role="alert">{createIssue}</div>{/if}
			<div class="template-options">
				{#each [{ id: 'blank', name: 'Blank', detail: 'A Primary field, ready for records' }, { id: 'tracker', name: 'Simple tracker', detail: 'Name, status, and notes' }, { id: 'media', name: 'Media', detail: 'Title, medium, progress, rating, and more' }, { id: 'projects', name: 'Projects', detail: 'Status, priority, due date, and links' }, { id: 'research', name: 'Research / sources', detail: 'Sources, URLs, notes, and links' }, { id: 'living-world', name: 'Bestiary + Marginalia', detail: 'Pull creatures, discovered life, and field notes into one live table' }] as template}
					<button onclick={() => create(surfaces.find((surface) => surface.kind === 'collection')!, template.id as CollectionTemplate)}><span>{template.name}</span><small>{template.detail}</small><b>↗</b></button>
				{/each}
			</div><button class="template-cancel" onclick={() => collectionCreateOpen = false}>Cancel</button>
		</div>
	</div>
{/if}

{#if paletteOpen}
	<div class="palette-backdrop">
		<button class="palette-dismiss" aria-label="Close commands" onclick={() => { paletteOpen = false; }}></button>
		<div class="command-palette" role="dialog" aria-modal="true" aria-label="HomeSuite commands" tabindex="-1">
			<div class="palette-search"><span>⌕</span><input bind:this={paletteInput} bind:value={paletteSearch} aria-label="Search commands" placeholder="Type a command…" /><kbd>esc</kbd></div>
			<div class="palette-results">
				{#each visibleCommands as item}
					<button disabled={!item.enabled} onclick={() => runPaletteItem(item)}><span>{item.label}</span><small>{item.detail}</small></button>
				{:else}
					<p>No commands match.</p>
				{/each}
			</div>
		</div>
	</div>
{/if}
