<script lang="ts">
	import { onMount } from 'svelte';
	import { entityHref } from '@woodles/app-manifest';
	import { blankGameDef, GameDefParseError, type EntityKind, type GameDef } from '@woodles/incremental-core';
	import Canvas from '$lib/canvas/Canvas.svelte';
	import Dock from '$lib/dock/Dock.svelte';
	import Inspector from '$lib/inspector/Inspector.svelte';
	import ProjectsView from '$lib/ProjectsView.svelte';
	import Sidebar from '$lib/sidebar/Sidebar.svelte';
	import Toolbar from '$lib/Toolbar.svelte';
	import TourCard from '$lib/TourCard.svelte';
	import Welcome from '$lib/Welcome.svelte';
	import { balance } from '$lib/balance.svelte.js';
	import { playtest } from '$lib/playtest.svelte.js';
	import { studio } from '$lib/studio.svelte.js';
	import { tour } from '$lib/tour.svelte.js';
	import { flushSync as pushLibrary, initSync, syncState } from '$lib/sync.svelte.js';
	import { findExampleProject, lastOpenedId, listProjects, loadProject, starterProject } from '$lib/projects.js';

	let projects = $state(listProjects());
	let dockCollapsed = $state(false);
	let projectsViewOpen = $state(false);
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let fileInput: HTMLInputElement;

	// Boot once, on mount. Deliberately not an `$effect`: opening a project
	// writes `studio.def`, which an effect that also *reads* it would treat as a
	// reason to run again — and re-open the project, forever.
	onMount(() => {
		studio.openOrCreate(lastOpenedId());
		projects = listProjects();
		// Built up front rather than on first play, so the readout, the chart's
		// currency picker and the node overlays all have something to show.
		playtest.reset(studio.def);
		// The example loads behind the welcome, so the first thing a visitor sees
		// is a working economy rather than an empty grid.
		tour.boot();

		// Picks up a stored passphrase and pulls whatever another device left.
		void initSync();

		const onBeforeUnload = () => studio.flush();
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload);
			studio.flush();
			playtest.pause();
			balance.dispose();
		};
	});

	/**
	 * Pushes the shelf a beat after editing stops. Debounced well past the
	 * autosave so a burst of typing is one request, and skipped while a sync is
	 * already in flight so a conflict-merge write cannot feed itself.
	 */
	let pushTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		// Read the def so this reruns whenever it changes.
		void studio.def;
		if (!syncState.connected || syncState.syncing) return;
		if (pushTimer) clearTimeout(pushTimer);
		pushTimer = setTimeout(() => {
			pushTimer = null;
			void pushLibrary();
		}, 2500);
	});

	function say(message: string): void {
		if (!message) return;
		toast = message;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 2600);
	}

	function openProject(id: string): void {
		const def = loadProject(id);
		if (!def) {
			say('That project could not be opened.');
			return;
		}
		studio.open(id, def);
		playtest.reset(def);
		say(`Opened ${def.meta.title}`);
	}

	function createProject(): void {
		studio.createProject();
		playtest.reset(studio.def);
		projects = listProjects();
		say('New project');
	}

	function add(kind: EntityKind): void {
		// Dropped somewhere visible rather than at the origin, with a little
		// scatter so repeated adds don't stack into one card.
		const at = { x: 140 + Math.random() * 320, y: 120 + Math.random() * 240 };
		const id = studio.create(kind, at);
		say(id ? `Added ${kind}` : `A ${kind} needs a currency first — add one of those.`);
		projects = listProjects();
	}

	function exportProject(): void {
		const blob = new Blob([studio.toJSON()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${studio.def.meta.id || 'game'}.bloomforge.json`;
		link.click();
		URL.revokeObjectURL(url);
		say('Exported JSON');
	}

	async function importFile(file: File): Promise<void> {
		try {
			studio.importJSON(await file.text());
			playtest.reset(studio.def);
			say(`Imported ${studio.def.meta.title}`);
			projects = listProjects();
		} catch (error) {
			say(error instanceof GameDefParseError ? error.message : 'That file could not be read.');
		}
	}

	/** Opens a genuinely empty project and starts the tour on it. */
	function startTour(): void {
		studio.createProject('My First Game', blankGameDef());
		playtest.reset(studio.def);
		studio.select(null);
		projects = listProjects();
		tour.start();
	}

	function openExample(): void {
		tour.close();
		const existing = findExampleProject();
		if (existing) {
			const def = loadProject(existing);
			if (def) {
				studio.open(existing, def);
				playtest.reset(def);
				projects = listProjects();
				return;
			}
		}
		studio.createProject('My Cozy Incremental', starterProject());
		playtest.reset(studio.def);
		projects = listProjects();
	}

	/** Opens a stress-test sample from the advanced tour's finish card, as a new project. */
	function tryExample(def: GameDef, title: string): void {
		tour.close();
		studio.createProject(title, structuredClone(def));
		playtest.reset(studio.def);
		projects = listProjects();
		say(`Opened ${title}`);
	}

	function onKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		// Never steal an undo from a text field the person is typing in.
		if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

		const meta = event.metaKey || event.ctrlKey;
		if (meta && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) studio.redo();
			else studio.undo();
			return;
		}
		if (!meta && (event.key === 'Delete' || event.key === 'Backspace') && studio.selectedId) {
			event.preventDefault();
			studio.remove(studio.selectedId);
			return;
		}
		if (!meta && event.key === 'Escape') studio.select(null);
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="studio">
	<Toolbar
		{projects}
		onmanage={() => (projectsViewOpen = true)}
		onexport={exportProject}
		onimport={() => fileInput.click()}
		onaddnote={() => {
			studio.addNote({ x: 160 + Math.random() * 260, y: 140 + Math.random() * 200 });
			say('Note added to the canvas');
		}}
		ontour={() => (tour.active ? tour.skip() : startTour())}
		onplay={() => {
			// Flushed first: the player reads the project straight out of storage,
			// so an unsaved edit would be missing from the game it opens.
			studio.flush();
			window.open(
				entityHref('bloomforge-player', 'game', studio.projectId),
				'_blank',
				'noopener'
			);
		}}
	/>

	<main class:dock-collapsed={dockCollapsed}>
		<Sidebar onadd={add} />

		<div class="stage">
			<TourCard onexample={openExample} ontryexample={tryExample} />
			<Canvas onmessage={say} />
		</div>

		<Inspector />

		<div class="dock-slot">
			<Dock collapsed={dockCollapsed} ontoggle={() => (dockCollapsed = !dockCollapsed)} />
		</div>
	</main>

	{#if tour.showWelcome}
		<Welcome onstart={startTour} onexplore={() => tour.dismissWelcome()} />
	{/if}

	{#if projectsViewOpen}
		<ProjectsView
			{projects}
			onopen={openProject}
			oncreate={createProject}
			onclose={() => (projectsViewOpen = false)}
			onchange={() => (projects = listProjects())}
			onmessage={say}
		/>
	{/if}

	{#if toast}
		<p class="toast" role="status">{toast}</p>
	{/if}

	<input
		bind:this={fileInput}
		class="sr-only"
		type="file"
		accept="application/json,.json"
		onchange={(event) => {
			const file = event.currentTarget.files?.[0];
			if (file) void importFile(file);
			event.currentTarget.value = '';
		}}
	/>
</div>

<style>
	.studio {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		background: linear-gradient(160deg, var(--bf-bg) 0%, var(--bf-bg-tint) 100%);
	}

	main {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 216px minmax(0, 1fr) 296px;
		grid-template-rows: minmax(0, 1fr) minmax(210px, 30%);
		grid-template-areas:
			'sidebar stage inspector'
			'dock dock dock';
	}

	main.dock-collapsed {
		grid-template-rows: minmax(0, 1fr) auto;
	}

	main > :global(aside:first-of-type) {
		grid-area: sidebar;
	}

	.stage {
		grid-area: stage;
		min-width: 0;
		min-height: 0;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* The canvas takes whatever the tour banner isn't using. */
	.stage > :global(.canvas) {
		flex: 1;
		min-height: 0;
	}

	main > :global(aside:last-of-type) {
		grid-area: inspector;
	}

	.dock-slot {
		grid-area: dock;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.dock-slot > :global(section) {
		flex: 1;
		min-height: 0;
	}

	.toast {
		position: fixed;
		left: 50%;
		bottom: 22px;
		transform: translateX(-50%);
		z-index: 40;
		margin: 0;
		padding: 8px 16px;
		border: 1px solid var(--bf-rule-strong);
		border-radius: var(--bf-radius-pill);
		background: var(--bf-surface);
		box-shadow: var(--bf-shadow-lift);
		font-size: 12.5px;
		color: var(--bf-ink-soft);
		pointer-events: none;
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

	/* Below this the three columns stop being three columns. The studio is a
	   desktop tool; this keeps it usable rather than pretending otherwise. */
	@media (max-width: 1080px) {
		main,
		main.dock-collapsed {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(300px, 1fr) auto auto;
			grid-template-areas:
				'sidebar'
				'stage'
				'inspector'
				'dock';
			overflow-y: auto;
		}
	}
</style>
