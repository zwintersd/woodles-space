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
		prepareSurfaceStorage,
		surfaceFor,
		surfaces,
		type HomeSuiteArtifact,
		type HomeSuiteSurfaceAdapter
	} from '$lib/surfaces';
	import './homesuite.css';

	type Filter = 'all' | 'document' | 'board' | 'collection';
	type PaletteItem = { id: string; label: string; detail: string; enabled: boolean; run: () => void };
	type ShellAction =
		| { action: 'undo' | 'redo' | 'inspect' | 'focus' }
		| { action: 'command'; commandId: string }
		| { action: 'mode'; modeId: string };

	let artifacts = $state<HomeSuiteArtifact[]>([]);
	let ready = $state(false);
	let filter = $state<Filter>('all');
	let search = $state('');
	let newOpen = $state(false);
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
		board: artifacts.filter((item) => item.kind === 'board').length
	});
	const paletteItems = $derived.by((): PaletteItem[] => {
		const shell: PaletteItem[] = [
			{ id: 'shell:index', label: 'Go to HomeSuite', detail: 'Navigation', enabled: true, run: showIndex },
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
		refresh();
		void goto('/homesuite', { noScroll: true });
	}

	function create(surface: HomeSuiteSurfaceAdapter): void {
		const artifact = surface.create();
		refresh();
		void openArtifact(artifact);
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
			{/if}
			<div class="new-wrap">
				<button class="new-button" aria-expanded={newOpen} onclick={() => { newOpen = !newOpen; }}>＋ New <span aria-hidden="true">⌄</span></button>
				{#if newOpen}
					<div class="new-menu" role="menu" aria-label="Create in HomeSuite">
						{#each surfaces as surface}
							<button role="menuitem" onclick={() => create(surface)}><span class="menu-glyph">{surface.kind === 'document' ? '¶' : '▧'}</span><span>{surface.label}</span></button>
						{/each}
						<div class="menu-divider"></div>
						<div class="menu-coming"><span class="menu-glyph">▦</span><span>Collection <small>coming later</small></span></div>
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
						<span class="surface-hint">{activeArtifact.kind === 'board' ? 'Canvas' : 'Writing surface'}</span>
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
						<p class="inspector-empty">Select something on the {activeArtifact.kind === 'board' ? 'board' : 'page'} to see it here.</p>
					{/if}
					{#if activeState?.inspector?.actions?.length}
						<div class="inspector-actions">
							{#each activeState.inspector.actions as action}
								<button disabled={action.enabled === false} onclick={() => sendAction({ action: 'command', commandId: action.commandId })}>{action.label}</button>
							{/each}
						</div>
					{/if}
					{#if !activeState?.inspector?.actions?.length && activeState?.commands.some((command) => command.id === 'inspect' && command.enabled !== false)}
						<button class="inspector-detail" onclick={() => sendAction({ action: 'inspect' })}>Open details in {activeArtifact.kind === 'board' ? 'Whiteboard' : 'Write'} ↗</button>
					{/if}
				</aside>
			{/if}
		</div>
	{:else if requestedId && ready}
		<main class="missing-artifact"><span>Nothing at that address</span><h1>This {requestedKind || 'thing'} is not in your HomeSuite yet.</h1><button onclick={showIndex}>Back to HomeSuite</button></main>
	{:else}
		<main class="suite-index">
			<div class="index-heading">
				<div><div class="eyebrow">YOUR WORKSPACE</div><h1>All your things, <em>within reach.</em></h1><p>Documents and boards share one place to begin. Each opens in the surface made for it.</p></div>
				<div class="index-count"><strong>{artifacts.length}</strong><span>things in HomeSuite</span></div>
			</div>
			<div class="index-toolbar">
				<div class="filters" aria-label="Filter artifacts">
					<button class:active={filter === 'all'} onclick={() => { filter = 'all'; }}>All <span>{artifacts.length}</span></button>
					<button class:active={filter === 'document'} onclick={() => { filter = 'document'; }}>Documents <span>{counts.document}</span></button>
					<button class:active={filter === 'board'} onclick={() => { filter = 'board'; }}>Boards <span>{counts.board}</span></button>
					<button class:active={filter === 'collection'} onclick={() => { filter = 'collection'; }}>Collections <span>soon</span></button>
				</div>
				<label class="index-search"><span aria-hidden="true">⌕</span><input bind:value={search} aria-label="Find a thing" placeholder="Find a thing" /></label>
			</div>
			{#if filter === 'collection'}
				<section class="collection-placeholder"><span class="placeholder-mark">▦</span><h2>Collections are coming next.</h2><p>They will live here alongside documents and boards, with table, board, and gallery views over the same records.</p></section>
			{:else if filtered.length}
				<div class="artifact-list" aria-label="Recent artifacts">
					{#each filtered as artifact (artifact.ref.app + artifact.ref.id)}
						<button class="artifact-row" onclick={() => openArtifact(artifact)}>
							<span class="artifact-icon {artifact.kind}" aria-hidden="true">{artifact.kind === 'document' ? '¶' : '▧'}</span>
							<span class="artifact-copy"><strong>{artifact.title}</strong><small>{artifact.kind === 'document' ? 'Write' : 'Whiteboard'}</small></span>
							<span class="kind-badge {artifact.kind}">{artifact.kind}</span>
							<time datetime={artifact.updatedAt}>{formatDate(artifact.updatedAt)}</time>
							<span class="row-arrow" aria-hidden="true">↗</span>
						</button>
						{/each}
				</div>
			{:else}
				<div class="empty-list"><span>✳</span><h2>{search ? 'Nothing by that name yet.' : 'A place for your next thing.'}</h2><p>{search ? 'Try another word or clear the search.' : 'Use New to start a document or board.'}</p></div>
			{/if}
		</main>
	{/if}
</div>

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
