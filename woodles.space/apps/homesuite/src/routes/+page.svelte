<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { appById, entityHref, primaryDestination } from '@woodles/app-manifest';
	import {
		HOMESUITE_CHANNEL,
		isHomeSuiteSurfaceMessage,
		type HomeSuiteArtifactKind,
		type HomeSuiteContextAction,
		type HomeSuiteSurfaceState,
		type WoodlesRef
	} from '@shared/homesuiteBridge';
	import {
		addCollectionReference,
		collectionReferenceTargets,
		listEverything,
		prepareSurfaceStorage,
		surfaceFor,
		surfaceForRef,
		surfaces,
		type HomeSuiteArtifact,
		type HomeSuiteSurfaceAdapter
	} from '$lib/surfaces';
	import { HOMESUITE_TRASH_KEY, moveHomeSuiteArtifactToTrash, restoreHomeSuiteArtifact, forgetHomeSuiteArtifact, type HomeSuiteTrashEntry } from '@shared/homesuiteTrash';
	import { modal } from '@shared/modal';
	import ContextMenu from '@shared/ContextMenu.svelte';
	import FolderNavigation from '$lib/FolderNavigation.svelte';
	import FolderIcon from '$lib/FolderIcon.svelte';
	import {
		HOMESUITE_FOLDERS_KEY, createFolder, loadFolders, folderForRef, folderPath, folderTree,
		moveFilesToFolder, moveFolder, removeFolder, renameFolder, refKey,
		type FolderLibrary, type HomeSuiteFolder
	} from '$lib/folders';
	import { syncState, connect as connectSync, disconnect as disconnectSync, pushIfChanged, syncNow } from '$lib/sync.svelte';
	import '@shared/homesuiteTheme.css';
	import './homesuite.css';

	type Filter = 'all' | 'document' | 'board' | 'collection';
	type PaletteItem = { id: string; label: string; detail: string; enabled: boolean; run: () => void };
	type ShellAction =
		| { action: 'undo' | 'redo' | 'inspect' | 'focus' | 'flush' | 'context-open' }
		| { action: 'context-command'; requestId: string; commandId: string }
		| { action: 'context-dismiss'; requestId: string }
		| { action: 'add-reference'; ref: WoodlesRef }
		| { action: 'command'; commandId: string }
		| { action: 'inspector'; controlId: string; value: string }
		| { action: 'mode'; modeId: string }
		| { action: 'rename'; title: string };

	let artifacts = $state<HomeSuiteArtifact[]>([]);
	let ready = $state(false);
	let filter = $state<Filter>('all');
	let showingTrash = $state(false);
	let trashed = $state<HomeSuiteTrashEntry[]>([]);
	let actionIssue = $state('');
	let storageNotices = $state<string[]>([]);
	let arrivals = $state('');
	let renaming = $state(false);
	let renameDraft = $state('');
	let permanentConfirmation = $state('');
	let search = $state('');
	let newOpen = $state(false);
	// The surface whose templates are on offer; New asks which shape first.
	let templatePicker = $state<HomeSuiteSurfaceAdapter | null>(null);
	let createIssue = $state('');
	let paletteOpen = $state(false);
	let paletteSearch = $state('');
	let paletteIndex = $state(0);
	let inspectorOpen = $state(true);
	let surfaceState = $state<HomeSuiteSurfaceState | null>(null);
	let surfaceFrame = $state<HTMLIFrameElement | null>(null);
	// The mounted frame. Its key changes only when the shell points it somewhere;
	// a surface that moves on its own keeps its frame (see followSurface).
	let frame = $state<{ key: number; src: string } | null>(null);
	// Veiled and inert until the surface reports — a prerendered editor accepts
	// typing before it has loaded the thing it is showing, then discards it.
	let frameReady = $state(false);
	let frameCount = 0;
	let frameShowing = '';
	let navigating = false;
	let readyFallback: ReturnType<typeof setTimeout> | undefined;
	let flushWaiter: (() => void) | null = null;
	type MenuAction = HomeSuiteContextAction & { run: () => void };
	let contextMenu = $state<{ label: string; detail: string; x: number; y: number; items: MenuAction[]; requestId?: string; returnTo?: HTMLElement } | null>(null);
	let referencePicker = $state<{ ref: WoodlesRef; title: string } | null>(null);
	let referenceTargets = $state<ReturnType<typeof collectionReferenceTargets>>([]);
	let referenceQuery = $state('');
	let referenceIssue = $state('');
	let actionNotice = $state('');
	let renameOnArrival = '';
	let folderLibrary = $state<FolderLibrary>({ folders: [], placements: [] });
	let folderNotice = $state('');
	let selectedFiles = $state<string[]>([]);
	let folderEditor = $state<{ id?: string; parentId: string | null } | null>(null);
	let folderName = $state('');
	let folderIssue = $state('');
	let folderRemoval = $state<HomeSuiteFolder | null>(null);
	let movePicker = $state<{ refs?: WoodlesRef[]; folderId?: string; title: string } | null>(null);
	let moveDestination = $state<string | null>(null);
	let folderQuery = $state('');
	let syncOpen = $state(false);
	let syncPass = $state('');
	let lastIndexSync = 0;
	let pushSoon: ReturnType<typeof setTimeout> | undefined;
	const syncLabel = $derived(syncState.syncing ? 'Syncing…' : !syncState.connected ? 'Sync off' : syncState.status === 'error' ? 'Sync issue' : 'Synced');
	const location = $derived(page.url.searchParams.get('folder'));
	const currentFolder = $derived(folderLibrary.folders.find((folder) => folder.id === location));
	const breadcrumbs = $derived(folderPath(folderLibrary, currentFolder?.id ?? null));
	const scopedArtifacts = $derived(artifacts.filter((artifact) => location === null ||
		folderForRef(folderLibrary, artifact.ref) === (location === 'root' ? null : location)));
	const childFolders = $derived(folderLibrary.folders.filter((folder) => folder.parentId === (currentFolder?.id ?? null) &&
		location !== 'root' && folder.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)));
	const unfiledCount = $derived(artifacts.filter((artifact) => folderForRef(folderLibrary, artifact.ref) === null).length);
	const moveTargets = $derived(folderTree(folderLibrary).filter((row) =>
		(!movePicker?.folderId || !folderPath(folderLibrary, row.folder.id).some((folder) => folder.id === movePicker?.folderId)) &&
		row.path.toLowerCase().includes(folderQuery.trim().toLowerCase())));
	const pickedFiles = $derived(artifacts.filter((artifact) => selectedFiles.includes(refKey(artifact.ref))));
	const visibleReferenceTargets = $derived(referenceTargets.filter((target) => target.title.toLowerCase().includes(referenceQuery.trim().toLowerCase())));
	$effect(() => {
		// Browser Back and Forward change the folder without calling openFolder.
		void location;
		untrack(() => { selectedFiles = []; });
	});

	function refreshFolders(): void {
		const loaded = loadFolders();
		folderLibrary = loaded.value;
		folderNotice = loaded.issue ? `Folder organization: ${loaded.issue.message}` : '';
	}

	function indexPath(id: string | null = location): string {
		return id === null ? '/homesuite' : `/homesuite?folder=${encodeURIComponent(id)}`;
	}

	async function openFolder(id: string | null): Promise<void> {
		selectedFiles = []; search = ''; filter = 'all'; showingTrash = false;
		closeContext(false); newOpen = false; paletteOpen = false;
		navigating = true;
		try { await releaseFrame(); refresh(); await goto(indexPath(id), { noScroll: true }); await tick(); }
		finally { navigating = false; }
	}

	/**
	 * Sync writes into the owning apps' storage, so it runs only while no
	 * editor is mounted over that storage: on opening, on coming back to the
	 * index, on returning to the tab. With a frame open it only pushes.
	 */
	async function syncIndex(): Promise<void> {
		if (frame) return;
		lastIndexSync = Date.now();
		await syncNow();
		if (!frame) refresh();
	}

	async function connectSuite(): Promise<void> {
		const pass = syncPass.trim();
		if (!pass) return;
		await releaseFrame();
		await connectSync(pass);
		syncPass = '';
		refresh();
	}

	function openSync(): void {
		closeContext(false); newOpen = false; paletteOpen = false;
		syncOpen = true;
	}

	function onVisibility(): void {
		if (document.visibilityState === 'hidden') void pushIfChanged();
		else if (Date.now() - lastIndexSync > 20_000) void syncIndex();
	}

	function editFolder(folder?: HomeSuiteFolder): void {
		newOpen = false; folderIssue = '';
		folderName = folder?.name ?? '';
		folderEditor = folder ? { id: folder.id, parentId: folder.parentId } : { parentId: currentFolder?.id ?? null };
	}

	async function saveFolder(): Promise<void> {
		if (!folderEditor) return;
		try {
			if (folderEditor.id) {
				renameFolder(folderEditor.id, folderName);
				folderEditor = null; refreshFolders(); actionNotice = 'Folder renamed.';
			} else {
				const folder = createFolder(folderName, folderEditor.parentId);
				folderEditor = null; refreshFolders();
				await openFolder(folder.id);
			}
		} catch (error) { folderIssue = error instanceof Error ? error.message : 'Could not save this folder.'; }
	}

	function folderContext(id: string, event: MouseEvent): void {
		event.preventDefault(); event.stopPropagation();
		const folder = folderLibrary.folders.find((entry) => entry.id === id);
		if (!folder) return;
		const trigger = event.currentTarget as HTMLElement;
		const rect = trigger.getBoundingClientRect();
		showContext(folder.name, 'HomeSuite folder', { x: rect.left, y: rect.bottom }, [
			{ id: 'folder:open', label: 'Open folder', group: 'edit', run: () => void openFolder(id) },
			{ id: 'folder:rename', label: 'Rename folder…', group: 'edit', run: () => editFolder(folder) },
			{ id: 'folder:move', label: 'Move folder…', group: 'edit', run: () => pickMove({ folderId: id, title: folder.name }) },
			{ id: 'folder:remove', label: 'Remove folder…', detail: 'Contents move up one level', group: 'danger', run: () => { folderIssue = ''; folderRemoval = folder; } }
		], trigger);
	}

	function pickMove(target: NonNullable<typeof movePicker>): void {
		refreshFolders(); folderIssue = ''; folderQuery = '';
		moveDestination = target.folderId ? folderLibrary.folders.find((folder) => folder.id === target.folderId)?.parentId ?? null :
			target.refs?.length === 1 ? folderForRef(folderLibrary, target.refs[0]) : null;
		movePicker = target;
	}

	async function commitMove(): Promise<void> {
		if (!movePicker) return;
		try {
			if (movePicker.folderId) moveFolder(movePicker.folderId, moveDestination);
			else moveFilesToFolder(movePicker.refs ?? [], moveDestination);
			actionNotice = `${movePicker.title} moved to ${moveDestination === null ? (movePicker.folderId ? 'HomeSuite' : 'Unfiled') : folderPath(folderLibrary, moveDestination).map((folder) => folder.name).join(' / ')}.`;
			movePicker = null; selectedFiles = []; refreshFolders();
		} catch (error) { folderIssue = error instanceof Error ? error.message : 'Could not move these things.'; }
	}

	async function confirmFolderRemoval(): Promise<void> {
		if (!folderRemoval) return;
		try {
			const removed = folderRemoval;
			removeFolder(removed.id); folderRemoval = null; refreshFolders();
			if (location === removed.id) await openFolder(removed.parentId);
			actionNotice = 'Folder removed. Its files and subfolders moved up one level.';
		} catch (error) { folderIssue = error instanceof Error ? error.message : 'Could not remove this folder.'; }
	}

	function toggleFile(ref: WoodlesRef): void {
		const key = refKey(ref);
		selectedFiles = selectedFiles.includes(key) ? selectedFiles.filter((entry) => entry !== key) : [...selectedFiles, key];
	}

	function toggleVisibleFiles(): void {
		const visible = new Set(filtered.map((artifact) => refKey(artifact.ref)));
		selectedFiles = allVisibleSelected ? selectedFiles.filter((key) => !visible.has(key)) : [...new Set([...selectedFiles, ...visible])];
	}

	function closeContext(restoreFocus = true, dismiss = true): void {
		const menu = contextMenu;
		contextMenu = null;
		if (menu?.requestId && dismiss) sendAction({ action: 'context-dismiss', requestId: menu.requestId });
		if (restoreFocus && menu?.returnTo?.isConnected) menu.returnTo.focus({ preventScroll: true });
	}

	function showContext(label: string, detail: string, point: { x: number; y: number }, items: MenuAction[], returnTo?: HTMLElement): void {
		closeContext(false);
		newOpen = false;
		contextMenu = { label, detail, ...point, items, returnTo };
	}

	function runContext(id: string): void {
		const item = contextMenu?.items.find((entry) => entry.id === id);
		if (!item || item.enabled === false) return;
		closeContext(true, false);
		item.run();
	}

	async function copyRef(ref: WoodlesRef): Promise<void> {
		try {
			const path = refHref(ref);
			await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
			actionNotice = 'Link copied.';
		} catch { actionNotice = 'Could not copy the link. Clipboard access may be unavailable.'; }
	}

	function connectionActions(ref: WoodlesRef, title: string): MenuAction[] {
		let addressable = true;
		try { refHref(ref); } catch { addressable = false; }
		return [
			{ id: 'ref:copy', label: 'Copy link', group: 'connect', enabled: addressable, run: () => void copyRef(ref) },
			{ id: 'ref:collect', label: 'Add reference to collection…', group: 'connect', run: () => void pickReferenceDestination(ref, title) }
		];
	}

	async function pickReferenceDestination(ref: WoodlesRef, title: string): Promise<void> {
		await releaseFrame();
		referenceTargets = collectionReferenceTargets(ref);
		referenceQuery = ''; referenceIssue = '';
		referencePicker = { ref, title };
	}

	async function addReferenceTo(id: string): Promise<void> {
		if (!referencePicker) return;
		try {
			const mounted = activeArtifact?.kind === 'collection' && activeArtifact.ref.id === id;
			if (mounted) {
				// The mounted owner applies this as an undoable edit to its current model.
				sendAction({ action: 'add-reference', ref: referencePicker.ref });
				await releaseFrame();
			} else addCollectionReference(referencePicker.ref, id);
			referencePicker = null;
			actionNotice = mounted ? 'Reference sent to the open collection.' : 'Reference added to collection.';
			refresh();
		} catch (error) { referenceIssue = error instanceof Error ? error.message : 'Could not add the reference.'; }
	}

	function artifactContext(artifact: HomeSuiteArtifact, event: MouseEvent): void {
		event.preventDefault(); event.stopPropagation();
		const trigger = event.currentTarget as HTMLElement;
		const rect = trigger.getBoundingClientRect();
		const point = event.type === 'contextmenu' && (event.clientX || event.clientY) ? { x: event.clientX, y: event.clientY } : { x: rect.left, y: rect.bottom };
		const active = activeArtifact?.kind === artifact.kind && activeArtifact.ref.id === artifact.ref.id;
		const title = active ? activeState?.artifact.title || artifact.title : artifact.title;
		const items: MenuAction[] = [
			{ id: 'artifact:open', label: 'Open in HomeSuite', group: 'edit', run: () => void openArtifact(artifact) },
			{ id: 'artifact:rename', label: `Rename ${artifact.kind}`, group: 'edit', enabled: !active || !!activeState, run: () => {
				if (active) startRename();
				else { renameOnArrival = artifactKey(artifact.kind, artifact.ref.id); void openArtifact(artifact); }
			} },
			{ id: 'artifact:folder', label: 'Move to folder…', group: 'edit', enabled: !artifact.inTrash, run: () => pickMove({ refs: [artifact.ref], title }) },
			...connectionActions(artifact.ref, title),
			...(active ? (activeState?.commands ?? []).filter((command) => command.context === 'artifact').map((command): MenuAction => ({
				id: `surface:${command.id}`, label: command.label, enabled: command.enabled, group: command.group ?? 'edit', detail: command.detail,
				run: () => sendAction({ action: 'command', commandId: command.id })
			})) : []),
			{ id: 'artifact:owner', label: `Open in ${surfaceFor(artifact.kind)?.appName}`, group: 'view', run: () => {
				void releaseFrame().then(() => window.open(entityHref(artifact.ref.app, artifact.ref.kind, artifact.ref.id), '_blank', 'noopener'));
			} },
			{ id: 'artifact:trash', label: artifact.inTrash ? 'Restore from Trash' : 'Move to Trash', group: 'danger', run: () => {
				if (artifact.inTrash) { restoreHomeSuiteArtifact(artifact.ref); refresh(); }
				else if (active) moveActiveToTrash();
				else { moveHomeSuiteArtifactToTrash({ ...artifact, title }); refresh(); }
			} }
		];
		items.sort((a, b) => ['edit', 'connect', 'view', 'danger'].indexOf(a.group ?? 'edit') - ['edit', 'connect', 'view', 'danger'].indexOf(b.group ?? 'edit'));
		showContext(title, `${artifact.kind} · ${surfaceFor(artifact.kind)?.appName}${artifact.inTrash ? ' · in Trash' : ''}`, point, items, trigger);
	}

	function trashContext(entry: HomeSuiteTrashEntry, event: MouseEvent): void {
		event.preventDefault(); event.stopPropagation();
		const trigger = event.currentTarget as HTMLElement;
		const rect = trigger.getBoundingClientRect();
		showContext(entry.title, `${entry.kind} · in Trash`, { x: event.clientX || rect.left, y: event.clientY || rect.bottom }, [
			{ id: 'trash:restore', label: 'Restore from Trash', group: 'edit', run: () => restoreArtifact(entry) },
			{ id: 'trash:copy', label: 'Copy link', group: 'connect', run: () => void copyRef(entry.ref) },
			{ id: 'trash:delete', label: 'Delete permanently…', detail: 'Confirm in the Trash row', group: 'danger', run: () => { permanentConfirmation = `${entry.ref.app}:${entry.ref.kind}:${entry.ref.id}`; } }
		], trigger);
	}

	// `?document=<id>` (or board, collection) — `entityHref('homesuite', …)`.
	// `?kind=&id=` is the shape before HomeSuite was in the manifest; it still
	// opens, and is rewritten on arrival.
	const requested = $derived.by((): { kind: string; id: string; legacy: boolean } | null => {
		const params = page.url.searchParams;
		for (const surface of surfaces) {
			const id = params.get(surface.kind);
			if (id) return { kind: surface.kind, id, legacy: false };
		}
		const kind = params.get('kind');
		const id = params.get('id');
		return kind && id ? { kind, id, legacy: true } : null;
	});
	const requestedKind = $derived(requested?.kind ?? null);
	const requestedId = $derived(requested?.id ?? null);
	const adapter = $derived(requestedKind ? surfaceFor(requestedKind) : undefined);
	const activeArtifact = $derived.by((): HomeSuiteArtifact | undefined => {
		if (!adapter || !requestedId) return undefined;
		const listed = artifacts.find((item) => item.kind === adapter.kind && item.ref.id === requestedId);
		if (listed) return listed;
		const binned = trashed.find((entry) => entry.kind === adapter.kind && entry.ref.id === requestedId);
		return binned && { ref: binned.ref, kind: binned.kind, title: binned.title, updatedAt: binned.updatedAt, inTrash: true };
	});
	const activeState = $derived(surfaceState);
	const filtered = $derived(scopedArtifacts.filter((artifact) =>
		(filter === 'all' || artifact.kind === filter) &&
		artifact.title.toLowerCase().includes(search.trim().toLowerCase())
	));
	const allVisibleSelected = $derived(filtered.length > 0 && filtered.every((artifact) => selectedFiles.includes(refKey(artifact.ref))));
	const counts = $derived({
		document: scopedArtifacts.filter((item) => item.kind === 'document').length,
		board: scopedArtifacts.filter((item) => item.kind === 'board').length,
		collection: scopedArtifacts.filter((item) => item.kind === 'collection').length
	});
	const paletteItems = $derived.by((): PaletteItem[] => {
		const shell: PaletteItem[] = [
			{ id: 'shell:index', label: 'Go to HomeSuite', detail: 'Navigation', enabled: true, run: () => void showIndex() },
			{ id: 'shell:trash', label: 'Open Trash', detail: 'HomeSuite', enabled: true, run: showTrash },
			{ id: 'shell:new-folder', label: 'New folder', detail: 'Organize', enabled: true, run: () => editFolder() },
			{ id: 'shell:all-files', label: 'Show all files', detail: 'Organize', enabled: true, run: () => void openFolder(null) },
			{ id: 'shell:sync', label: syncState.connected ? 'Sync now' : 'Set up sync', detail: 'Devices', enabled: true, run: () => {
				if (syncState.connected && !frame) void syncIndex(); else openSync();
			} },
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
			activeArtifact.inTrash
				? { id: 'shell:restore', label: 'Restore from Trash', detail: 'HomeSuite artifact', enabled: true, run: restoreActive }
				: { id: 'shell:move-trash', label: 'Move to Trash', detail: 'HomeSuite artifact', enabled: true, run: moveActiveToTrash },
			{ id: 'shell:rename', label: `Rename ${activeArtifact.kind}`, detail: 'HomeSuite artifact', enabled: !!activeState, run: startRename },
			{ id: 'shell:folder', label: 'Move to folder…', detail: 'Organize', enabled: !activeArtifact.inTrash, run: () => pickMove({ refs: [activeArtifact.ref], title: activeState?.artifact.title || activeArtifact.title }) },
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
	const currentCommand = $derived(visibleCommands[Math.min(paletteIndex, visibleCommands.length - 1)]);

	function refresh(): void {
		({ artifacts, trashed } = listEverything());
		refreshFolders();
		selectedFiles = selectedFiles.filter((key) => artifacts.some((artifact) => refKey(artifact.ref) === key));
		storageNotices = surfaces.flatMap((surface) => surface.notice?.() ?? []);
		// Every change made from the index ends here; send it on once things settle.
		clearTimeout(pushSoon);
		if (syncState.connected) pushSoon = setTimeout(() => void pushIfChanged(), 1500);
	}

	/**
	 * Keep the listing in step with the open surface without re-reading every
	 * library on every message: patch the title, and only look again when the
	 * surface reports something the listing has not seen (a board a portal
	 * just made). The index refreshes in full whenever it is shown.
	 */
	function noteSurface(reported: { kind: HomeSuiteArtifactKind; id: string; title: string }): void {
		const listed = artifacts.find((item) => item.kind === reported.kind && item.ref.id === reported.id);
		if (!listed) {
			if (!trashed.some((entry) => entry.kind === reported.kind && entry.ref.id === reported.id)) refresh();
			return;
		}
		if (listed.title !== reported.title) artifacts = artifacts.map((item) => item === listed ? { ...item, title: reported.title } : item);
	}

	// A surface's own saves reach the shell as `storage` events too (same
	// origin, another frame). While one is open only Trash matters here.
	function onStorage(event: StorageEvent): void {
		if (event.key === HOMESUITE_FOLDERS_KEY) refreshFolders();
		if (!frame || event.key === HOMESUITE_TRASH_KEY || event.key === null) refresh();
	}

	function artifactKey(kind: string, id: string): string {
		return `${kind}:${id}`;
	}

	$effect(() => {
		const target = activeArtifact;
		const owner = adapter;
		untrack(() => {
			if (!target || !owner) {
				frame = null;
				frameShowing = '';
				return;
			}
			const key = artifactKey(target.kind, target.ref.id);
			if (frame && frameShowing === key) return;
			clearTimeout(readyFallback);
			surfaceState = null;
			frameReady = false;
			frameShowing = key;
			frame = { key: ++frameCount, src: owner.embedHref(target.ref.id) };
		});
	});

	function onFrameLoad(): void {
		const key = frame?.key;
		clearTimeout(readyFallback);
		// A surface that never reports (an older build, a record it cannot find)
		// should not stay veiled for good.
		readyFallback = setTimeout(() => { if (frame?.key === key) frameReady = true; }, 3000);
	}

	/**
	 * A surface can move on its own — a board's portal opens another board in
	 * place. What the frame reports is the truth; the address follows it
	 * without reloading the frame, so Trash, the title, and a reload all land
	 * on what is on screen.
	 */
	function followSurface(reported: { kind: HomeSuiteArtifactKind; id: string }): void {
		if (navigating) return;
		const key = artifactKey(reported.kind, reported.id);
		if (key === frameShowing) return;
		frameShowing = key;
		if (reported.kind === requestedKind && reported.id === requestedId) return;
		void goto(artifactPath(reported.kind, reported.id), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function moveActiveToTrash(): void {
		if (!activeArtifact || activeArtifact.inTrash) return;
		const { ref, kind, updatedAt } = activeArtifact;
		moveHomeSuiteArtifactToTrash({ ref, kind, updatedAt, title: activeState?.artifact.title || activeArtifact.title });
		actionIssue = '';
		void showIndex();
	}

	/** Titles are edited here, in the shell; the surface applies the new one as its own edit. */
	function startRename(): void {
		if (!activeState || !activeArtifact) return;
		renameDraft = activeState.artifact.title || activeArtifact.title;
		renaming = true;
	}

	function commitRename(): void {
		if (!renaming) return;
		renaming = false;
		const next = renameDraft.trim();
		if (next && next !== (activeState?.artifact.title ?? activeArtifact?.title)) sendAction({ action: 'rename', title: next });
	}

	function onRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
		else if (event.key === 'Escape') { event.preventDefault(); renaming = false; }
	}

	function focusAndSelect(node: HTMLInputElement) {
		queueMicrotask(() => { node.focus(); node.select(); });
	}

	function restoreActive(): void {
		if (!activeArtifact?.inTrash) return;
		restoreHomeSuiteArtifact(activeArtifact.ref);
		refresh();
	}

	function restoreArtifact(entry: (typeof trashed)[number]): void {
		restoreHomeSuiteArtifact(entry.ref);
		permanentConfirmation = '';
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

	function artifactPath(kind: string, id: string): string {
		const path = entityHref('homesuite', kind, id);
		return location === null ? path : `${path}&folder=${encodeURIComponent(location)}`;
	}

	function refHref(ref: WoodlesRef): string {
		const owner = surfaceForRef(ref);
		return owner ? artifactPath(owner.kind, ref.id) : ref.kind === 'app' ? primaryDestination(appById[ref.app]) : entityHref(ref.app, ref.kind, ref.id);
	}

	/**
	 * Ask the open surface to write what it has pending before the shell takes
	 * its frame away. `pagehide` covers the same ground; this answers first, so
	 * the next thing opened reads what was just typed.
	 */
	function releaseFrame(): Promise<void> {
		if (!surfaceFrame?.contentWindow || !frameReady) return Promise.resolve();
		return new Promise((resolve) => {
			const done = () => { clearTimeout(timer); flushWaiter = null; resolve(); };
			const timer = setTimeout(done, 250);
			flushWaiter = done;
			sendAction({ action: 'flush' });
		});
	}

	async function openAddress(kind: string, id: string): Promise<void> {
		closeContext(false);
		newOpen = false;
		paletteOpen = false;
		navigating = true;
		try { await releaseFrame(); await goto(artifactPath(kind, id), { noScroll: true }); await tick(); }
		finally { navigating = false; }
	}

	function openArtifact(artifact: HomeSuiteArtifact): Promise<void> {
		return openAddress(artifact.kind, artifact.ref.id);
	}

	/** A surface asked to open another thing: in the suite if it lives here. */
	function openRef(ref: WoodlesRef): void {
		const owner = surfaceForRef(ref);
		if (owner) { void openAddress(owner.kind, ref.id); return; }
		try { window.open(refHref(ref), '_blank', 'noopener'); } catch { /* not addressable */ }
	}

	async function showIndex(trash = false): Promise<void> {
		closeContext(false);
		newOpen = false;
		paletteOpen = false;
		navigating = true;
		try {
			await releaseFrame();
			showingTrash = trash;
			selectedFiles = [];
			refresh();
			await goto(indexPath(), { noScroll: true }); await tick();
		} finally { navigating = false; }
		void syncIndex();
	}

	function showTrash(): void {
		void showIndex(true);
	}

	function create(surface: HomeSuiteSurfaceAdapter, template?: string): void {
		newOpen = false;
		if (surface.templates && !template) { createIssue = ''; templatePicker = surface; return; }
		createIssue = '';
		try {
			const artifact = surface.create(template);
			if (currentFolder) {
				try { moveFilesToFolder([artifact.ref], currentFolder.id); }
				catch (error) { actionIssue = error instanceof Error ? `File created, but could not place it in the folder: ${error.message}` : 'File created in Unfiled. Folder placement could not be saved.'; }
			}
			templatePicker = null;
			refresh();
			void openArtifact(artifact);
		} catch (error) {
			createIssue = error instanceof Error ? error.message : 'Could not create that item.';
			if (surface.templates) templatePicker = surface;
		}
	}

	function templatesInGroup(templates: readonly { id: string; name: string; detail: string; group?: string }[], group: string) {
		return templates.filter((template) => (template.group ?? 'connected') === group);
	}

	function sendAction(action: ShellAction): void {
		if (!surfaceFrame?.contentWindow) return;
		surfaceFrame.contentWindow.postMessage(
			{ channel: HOMESUITE_CHANNEL, source: 'shell', type: 'action', ...action, ...('ref' in action ? { ref: { app: action.ref.app, kind: action.ref.kind, id: action.ref.id } } : {}) },
			window.location.origin
		);
	}

	function handleMessage(event: MessageEvent): void {
		if (event.origin !== window.location.origin || event.source !== surfaceFrame?.contentWindow) return;
		if (!isHomeSuiteSurfaceMessage(event.data)) return;
		const message = event.data;
		if (message.type === 'state') {
			if (!message.state?.artifact?.id) return;
			if (surfaceState && artifactKey(surfaceState.artifact.kind, surfaceState.artifact.id) !== artifactKey(message.state.artifact.kind, message.state.artifact.id)) closeContext(false);
			surfaceState = message.state;
			frameReady = true;
			clearTimeout(readyFallback);
			noteSurface(message.state.artifact);
			followSurface(message.state.artifact);
			if (renameOnArrival === artifactKey(message.state.artifact.kind, message.state.artifact.id)) { renameOnArrival = ''; startRename(); }
		} else if (message.type === 'context-menu') {
			if (!frameReady || !Number.isFinite(message.x) || !Number.isFinite(message.y) || !message.target?.actions?.length) return;
			const rect = surfaceFrame!.getBoundingClientRect();
			const { target, requestId } = message;
			const items: MenuAction[] = target.actions.map((action) => ({ ...action, run: () => sendAction({ action: 'context-command', requestId, commandId: action.id }) }));
			items.push({ id: 'context:inspector', label: 'Show inspector', group: 'view', run: () => { sendAction({ action: 'context-dismiss', requestId }); inspectorOpen = true; } });
			if (target.ref) {
				const ref = target.ref;
				let addressable = true;
				try { refHref(ref); } catch { addressable = false; }
				items.push({ id: 'ref:open', label: surfaceForRef(ref) ? 'Open referenced item in HomeSuite' : 'Open source', group: 'connect', enabled: addressable,
					run: () => { sendAction({ action: 'context-dismiss', requestId }); openRef(ref); } });
			}
			if (target.ref) items.push(...connectionActions(target.ref, target.label).map((action) => ({ ...action, run: () => {
				sendAction({ action: 'context-dismiss', requestId }); action.run();
			} })));
			items.sort((a, b) => ['edit', 'connect', 'view', 'danger'].indexOf(a.group ?? 'edit') - ['edit', 'connect', 'view', 'danger'].indexOf(b.group ?? 'edit'));
			showContext(target.label, target.detail, { x: rect.left + message.x, y: rect.top + message.y }, items);
			contextMenu!.requestId = requestId;
		} else if (message.type === 'request-palette') {
			openPalette();
		} else if (message.type === 'request-rename') {
			startRename();
		} else if (message.type === 'flushed') {
			flushWaiter?.();
		} else if (message.type === 'navigate' && message.target === 'index') {
			void showIndex();
		} else if (message.type === 'navigate' && message.target === 'artifact') {
			openRef(message.ref);
		}
	}

	function openPalette(): void {
		closeContext(false);
		newOpen = false;
		paletteSearch = '';
		paletteIndex = 0;
		paletteOpen = true;
	}

	function movePalette(step: 1 | -1): void {
		const count = visibleCommands.length;
		if (!count) return;
		let next = Math.min(paletteIndex, count - 1);
		for (let tries = 0; tries < count; tries++) {
			next = (next + step + count) % count;
			if (visibleCommands[next].enabled) break;
		}
		paletteIndex = next;
		document.getElementById(`palette-item-${next}`)?.scrollIntoView({ block: 'nearest' });
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
			// One layer at a time: the palette, then a template picker, then menus.
			if (folderEditor) folderEditor = null;
			else if (folderRemoval) folderRemoval = null;
			else if (movePicker) movePicker = null;
			else if (referencePicker) referencePicker = null;
			else if (contextMenu) closeContext();
			else if (paletteOpen) paletteOpen = false;
			else if (syncOpen) syncOpen = false;
			else if (templatePicker) templatePicker = null;
			newOpen = false;
			return;
		}
		if (paletteOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			event.preventDefault();
			movePalette(event.key === 'ArrowDown' ? 1 : -1);
			return;
		}
		if (paletteOpen && event.key === 'Enter' && currentCommand) {
			event.preventDefault();
			runPaletteItem(currentCommand.enabled ? currentCommand : visibleCommands.find((item) => item.enabled) ?? currentCommand);
			return;
		}
		if (activeArtifact && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
			const target = event.target as HTMLElement | null;
			if (target?.closest('input, textarea, [contenteditable="true"]')) return;
			event.preventDefault();
			sendAction({ action: event.shiftKey ? 'redo' : 'undo' });
		}
	}

	/**
	 * Keep an inspector field in step with what the surface reports, but never
	 * under the caret: an echo of an earlier keystroke would otherwise land
	 * after a later one and undo it. It catches up once focus leaves.
	 */
	function controlValue(node: HTMLInputElement, value: string) {
		let latest = value;
		node.value = value;
		const catchUp = () => { node.value = latest; };
		node.addEventListener('blur', catchUp);
		return {
			update(next: string) {
				latest = next;
				if (document.activeElement !== node) node.value = next;
			},
			destroy() { node.removeEventListener('blur', catchUp); }
		};
	}

	function formatDate(stamp: string): string {
		const date = new Date(stamp);
		return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	onMount(() => {
		arrivals = prepareSurfaceStorage() ?? '';
		refresh();
		if (requested?.legacy) void goto(artifactPath(requested.kind, requested.id), { replaceState: true, noScroll: true });
		// On a phone the inspector would cover the thing being inspected.
		inspectorOpen = !window.matchMedia('(max-width: 600px)').matches;
		ready = true;
		void syncIndex();
		// A phone tab is often closed from the app switcher, never coming back to the index.
		const pushing = setInterval(() => { if (frame) void pushIfChanged(); else void syncIndex(); }, 120_000);
		const onPageHide = () => void pushIfChanged();
		window.addEventListener('message', handleMessage);
		window.addEventListener('storage', onStorage);
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('pagehide', onPageHide);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('message', handleMessage);
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('pagehide', onPageHide);
			document.removeEventListener('visibilitychange', onVisibility);
			clearInterval(pushing);
			clearTimeout(pushSoon);
			clearTimeout(readyFallback);
		};
	});
</script>

<svelte:head>
	<title>HomeSuite · woodles.space</title>
</svelte:head>

<div class="suite-shell">
	<header class="suite-topbar" class:artifact-open={!!activeArtifact}>
		<div class="suite-navigation">
			<a class="woodles-link" href="/" aria-label="Woodles home">woodles<span>✳</span></a>
			<span class="crumb-separator" aria-hidden="true">/</span>
			<button class="suite-home" onclick={() => showIndex()} aria-label="HomeSuite index">HomeSuite</button>
			{#if activeArtifact}
				<span class="crumb-separator" aria-hidden="true">/</span>
				<span class="kind-badge {activeArtifact.kind}">{activeArtifact.kind}</span>
				<h1 class="artifact-heading">
					{#if renaming}
						<input class="artifact-title-input" aria-label={`Rename ${activeArtifact.kind}`} bind:value={renameDraft} use:focusAndSelect onkeydown={onRenameKeydown} onblur={commitRename} />
					{:else}
						<button class="artifact-title" title="Rename" disabled={!activeState} onclick={startRename} oncontextmenu={(event) => artifactContext(activeArtifact, event)}>{activeState?.artifact.title || activeArtifact.title}</button>
					{/if}
				</h1>
				{#if activeArtifact.inTrash}<span class="trash-badge">In Trash</span>{/if}
			{/if}
		</div>

		<div class="suite-actions">
			{#if activeArtifact}
				<button class="toolbar-button artifact-context-trigger" aria-label={`Actions for ${activeArtifact.kind}`} aria-haspopup="menu" onclick={(event) => artifactContext(activeArtifact, event)}>⋯</button>
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
			<button class="toolbar-button sync-trigger" aria-label={`${syncLabel}. Sync settings`} aria-haspopup="dialog" onclick={openSync}><span class="sync-dot {syncState.syncing ? 'busy' : !syncState.connected ? 'off' : syncState.status}" aria-hidden="true"></span><span class="sync-label">{syncLabel}</span></button>
			<button class="toolbar-button palette-trigger" onclick={openPalette} title="Commands (Ctrl/⌘ K)">⌕ <span>Commands</span><kbd>⌘ K</kbd></button>
			{#if activeArtifact}
				<button class="toolbar-button inspector-trigger" class:pressed={inspectorOpen} aria-label={inspectorOpen ? 'Hide inspector' : 'Show inspector'} aria-pressed={inspectorOpen} onclick={() => { inspectorOpen = !inspectorOpen; }}>☷ <span>Inspector</span></button>
				{#if activeArtifact.inTrash}
					<button class="toolbar-button trash-trigger" onclick={restoreActive}>Restore</button>
				{:else}
					<button class="toolbar-button trash-trigger" aria-label="Move to Trash" onclick={moveActiveToTrash}><span>Move to</span>Trash</button>
				{/if}
			{/if}
			<div class="new-wrap">
				<button class="new-button" aria-expanded={newOpen} onclick={() => { newOpen = !newOpen; }}>＋ New <span aria-hidden="true">⌄</span></button>
				{#if newOpen}
					<div class="new-menu" role="menu" aria-label="Create in HomeSuite">
						{#each surfaces as surface}
							<button role="menuitem" onclick={() => create(surface)}><span class="menu-glyph" aria-hidden="true">{surface.glyph}</span><span>{surface.label}</span></button>
						{/each}
						<div class="menu-divider"></div>
						<button role="menuitem" onclick={() => editFolder()}><span class="menu-glyph" aria-hidden="true"><FolderIcon /></span><span>Folder</span></button>
					</div>
				{/if}
			</div>
		</div>
	</header>

	{#if !ready}
		<main class="suite-loading" aria-live="polite">Opening HomeSuite…</main>
	{:else if activeArtifact && adapter}
		<main class="surface-layout" aria-label={`${adapter.label}: ${activeState?.artifact.title || activeArtifact.title}`}>
			<div class="surface-main">
				<div class="surface-strip">
					<button class="back-link" onclick={() => showIndex()}>← {currentFolder?.name ?? (location === 'root' ? 'Unfiled' : 'All things')}</button>
					{#if activeState?.selection}
						<button class="selection-pill" aria-label="Actions for selection" aria-haspopup="menu" onclick={() => sendAction({ action: 'context-open' })}><span class="selection-dot"></span>{activeState.selection.count && activeState.selection.count > 1 ? `${activeState.selection.count} selected` : activeState.selection.label}<span aria-hidden="true">⋯</span></button>
					{:else}
						<span class="surface-hint">{adapter.surfaceLabel}</span>
					{/if}
				</div>
				<div class="surface-frame">
					{#if frame}
						{#key frame.key}
							<iframe
								bind:this={surfaceFrame}
								title={`${activeArtifact.title} ${activeArtifact.kind} editor`}
								src={frame.src}
								class="native-surface"
								inert={!frameReady}
								onload={onFrameLoad}
							></iframe>
						{/key}
					{/if}
					{#if !frameReady}
						<div class="surface-veil" role="status"><span>Opening {activeArtifact.kind}…</span></div>
					{/if}
				</div>
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
						<p class="inspector-empty">Select something on the {adapter.selectionPlace} to see it here.</p>
					{/if}
					{#if activeState?.inspector?.controls?.length}
						<div class="inspector-controls">
							{#each activeState.inspector.controls as control (control.id)}
								<label>{control.label}<input use:controlValue={control.value} readonly={control.readonly} oninput={(event) => sendAction({ action: 'inspector', controlId: control.id, value: event.currentTarget.value })} /></label>
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
						<button class="inspector-detail" onclick={() => sendAction({ action: 'inspect' })}>Open details in {adapter.appName} ↗</button>
					{/if}
				</aside>
			{/if}
		</main>
		{:else if requestedId && ready}
		<main class="missing-artifact"><span>Nothing at that address</span><h1>This {requestedKind || 'thing'} is not in your HomeSuite yet.</h1><button onclick={() => showIndex()}>Back to HomeSuite</button></main>
	{:else}
		<main class="suite-index">
				<div class="index-heading">
					<div><div class="eyebrow">{showingTrash ? 'HOME SUITE TRASH' : currentFolder ? 'YOUR FOLDER' : 'YOUR WORKSPACE'}</div><h1>{#if showingTrash}A little room to reconsider.{:else if currentFolder}{currentFolder.name}{:else if location === 'root'}Unfiled things.{:else}All your things, <em>within reach.</em>{/if}</h1><p>{showingTrash ? 'Trashed items keep their identity and contents until you restore or permanently delete them.' : currentFolder ? 'A place for related documents, boards, and Collections. Use New to add something here.' : location === 'root' ? 'Things you haven’t placed in a folder yet.' : 'Documents, boards, and Collections share one place to begin. Group related things into folders.'}</p></div>
					<div class="index-count"><strong>{showingTrash ? trashed.length : scopedArtifacts.length}</strong><span>{showingTrash ? 'things in Trash' : currentFolder ? 'things in this folder' : 'things in HomeSuite'}</span></div>
			</div>
				<div class="index-toolbar">
					<nav class="index-views" aria-label="HomeSuite views"><button class:active={!showingTrash} onclick={() => { showingTrash = false; }}>Workspace</button><button class:active={showingTrash} onclick={() => { showingTrash = true; }}>Trash <span>{trashed.length}</span></button></nav>
					{#if !showingTrash}
				<div class="filters" aria-label="Filter artifacts">
					<button class:active={filter === 'all'} onclick={() => { filter = 'all'; }}>All <span>{scopedArtifacts.length}</span></button>
					<button class:active={filter === 'document'} onclick={() => { filter = 'document'; }}>Documents <span>{counts.document}</span></button>
					<button class:active={filter === 'board'} onclick={() => { filter = 'board'; }}>Boards <span>{counts.board}</span></button>
					<button class:active={filter === 'collection'} onclick={() => { filter = 'collection'; }}>Collections <span>{counts.collection}</span></button>
				</div>
				<label class="index-search"><span aria-hidden="true">⌕</span><input bind:value={search} aria-label="Find a thing" placeholder="Find a thing" /></label>
					{/if}
			</div>
				{#if actionIssue}<div class="trash-issue" role="alert">{actionIssue}</div>{/if}
				{#each storageNotices as notice}<div class="trash-issue" role="status">{notice}</div>{/each}
				{#if folderNotice}<div class="trash-issue" role="status">{folderNotice}</div>{/if}
				{#if arrivals && !showingTrash}<div class="arrival-notice" role="status"><span>{arrivals}</span><button aria-label="Dismiss" onclick={() => { arrivals = ''; }}>×</button></div>{/if}
				{#if showingTrash && trashed.length}
					<div class="artifact-list" aria-label="Trashed artifacts">
						{#each trashed as entry (entry.ref.app + entry.ref.id)}
							<div class="artifact-row trash-row">
								<span class="artifact-icon {entry.kind}" aria-hidden="true">{surfaceFor(entry.kind)?.glyph}</span>
								<span class="artifact-copy"><strong>{entry.title}</strong><small>{entry.kind} · moved {formatDate(entry.trashedAt)}</small></span>
								<button class="trash-action" onclick={() => restoreArtifact(entry)}>Restore</button>
								{#if permanentConfirmation === `${entry.ref.app}:${entry.ref.kind}:${entry.ref.id}`}
									<button class="trash-action permanent" onclick={() => permanentlyDelete(entry)}>Confirm permanent deletion</button>
									<button class="trash-action" onclick={() => permanentConfirmation = ''}>Cancel</button>
								{:else}
									<button class="trash-action permanent" onclick={() => permanentlyDelete(entry)}>Delete permanently</button>
								{/if}
								<button class="row-context-trigger" aria-label={`Actions for ${entry.title}`} aria-haspopup="menu" onclick={(event) => trashContext(entry, event)}>⋯</button>
							</div>
						{/each}
					</div>
				{:else if showingTrash}
					<div class="empty-list"><span>✳</span><h2>Trash is empty.</h2><p>Top-level documents, boards, and Collections you move to Trash will appear here.</p></div>
				{:else}
				<div class="organized-workspace">
					<FolderNavigation library={folderLibrary} {location} {unfiledCount} onOpen={(id) => void openFolder(id)} onCreate={() => editFolder()} onActions={folderContext} />
					<section class="folder-contents" aria-label="Folder contents">
						<div class="folder-location-bar">
							<nav class="folder-breadcrumbs" aria-label="Folder breadcrumbs">
								<button onclick={() => openFolder(null)}>All files</button>
								{#if location === 'root'}<span aria-hidden="true">/</span><span aria-current="page">Unfiled</span>{/if}
								{#each breadcrumbs as crumb, index (crumb.id)}
									<span aria-hidden="true">/</span><button aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined} onclick={() => openFolder(crumb.id)}>{crumb.name}</button>
								{/each}
							</nav>
							{#if currentFolder}<button class="row-context-trigger" aria-label={`Folder actions for current folder ${currentFolder.name}`} aria-haspopup="menu" onclick={(event) => folderContext(currentFolder.id, event)}>⋯</button>{/if}
						</div>
						{#if location && location !== 'root' && !currentFolder}
							<div class="empty-list"><span>▱</span><h2>This folder is no longer here.</h2><p>Your files are still available in All files.</p><button class="destination-cancel" onclick={() => openFolder(null)}>Show all files</button></div>
						{:else}
						{#if childFolders.length}
							<div class="child-folders" aria-label="Subfolders">
								{#each childFolders as folder (folder.id)}
									<div class="folder-card">
										<button class="folder-card-open" onclick={() => openFolder(folder.id)} oncontextmenu={(event) => folderContext(folder.id, event)}><FolderIcon /><span><strong>{folder.name}</strong><small>{artifacts.filter((artifact) => folderForRef(folderLibrary, artifact.ref) === folder.id).length} files · {folderLibrary.folders.filter((entry) => entry.parentId === folder.id).length} folders</small></span></button>
										<button class="row-context-trigger" aria-label={`Actions for folder ${folder.name}`} aria-haspopup="menu" onclick={(event) => folderContext(folder.id, event)}>⋯</button>
									</div>
								{/each}
								</div>
						{/if}
						{#if filtered.length || pickedFiles.length}
						<div class="file-selection-bar">
							<label><input type="checkbox" aria-label="Select all visible files" checked={allVisibleSelected} onchange={toggleVisibleFiles} />{pickedFiles.length ? `${pickedFiles.length} selected` : `${filtered.length} ${filtered.length === 1 ? 'file' : 'files'}`}</label>
							{#if pickedFiles.length}<div><button class="destination-cancel" onclick={() => pickMove({ refs: pickedFiles.map((artifact) => artifact.ref), title: `${pickedFiles.length} ${pickedFiles.length === 1 ? 'file' : 'files'}` })}>Move to folder…</button><button class="toolbar-button" onclick={() => selectedFiles = []}>Clear selection</button></div>{/if}
						</div>
						{/if}
						{#if filtered.length}
				<div class="artifact-list" aria-label="Recent artifacts">
					{#each filtered as artifact (artifact.ref.app + artifact.ref.id)}
						<div class="artifact-row" class:selected={selectedFiles.includes(refKey(artifact.ref))}>
						<input class="file-checkbox" type="checkbox" aria-label={`Select ${artifact.title}`} checked={selectedFiles.includes(refKey(artifact.ref))} onchange={() => toggleFile(artifact.ref)} />
						<button class="artifact-row-open" onclick={() => openArtifact(artifact)} oncontextmenu={(event) => artifactContext(artifact, event)}>
							<span class="artifact-icon {artifact.kind}" aria-hidden="true">{surfaceFor(artifact.kind)?.glyph}</span>
							<span class="artifact-copy"><strong>{artifact.title}</strong><small>{artifact.recordCount === undefined ? surfaceFor(artifact.kind)?.appName : `${artifact.recordCount} ${artifact.recordCount === 1 ? 'record' : 'records'}`}{#if location === null}<span class="file-folder-path"> · {folderPath(folderLibrary, folderForRef(folderLibrary, artifact.ref)).map((folder) => folder.name).join(' / ') || 'Unfiled'}</span>{/if}</small></span>
							<span class="kind-badge {artifact.kind}">{artifact.kind}</span>
							<time datetime={artifact.updatedAt}>{formatDate(artifact.updatedAt)}</time>
							<span class="row-arrow" aria-hidden="true">↗</span>
						</button>
						<button class="row-context-trigger" aria-label={`Actions for ${artifact.title}`} aria-haspopup="menu" onclick={(event) => artifactContext(artifact, event)}>⋯</button>
						</div>
						{/each}
				</div>
			{:else}
				<div class="empty-list"><span>{currentFolder ? '▱' : '✳'}</span><h2>{search ? 'Nothing by that name yet.' : currentFolder ? 'Room for your next thing.' : 'A place for your next thing.'}</h2><p>{search ? 'Try another word or clear the search.' : currentFolder ? 'Use New to create something here, or move files into this folder from All files.' : 'Use New to start a document, board, or Collection.'}</p></div>
						{/if}
						{/if}
					</section>
				</div>
			{/if}
		</main>
	{/if}
</div>

{#if folderEditor}
	<div class="template-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) folderEditor = null; }}>
		<div class="folder-dialog" role="dialog" aria-modal="true" aria-label={folderEditor.id ? 'Rename folder' : 'New folder'} use:modal={{ returnFocus: '.folder-new-link, .new-button' }}>
		<form class="folder-dialog-form" onsubmit={(event) => { event.preventDefault(); void saveFolder(); }}>
			<header class="folder-dialog-header"><div class="eyebrow">ORGANIZE YOUR THINGS</div><h2>{folderEditor.id ? 'Rename folder' : 'New folder'}</h2><p>{folderEditor.id ? 'Choose a name that’s easy to find.' : `Create inside ${folderPath(folderLibrary, folderEditor.parentId).map((folder) => folder.name).join(' / ') || 'HomeSuite'}.`}</p></header>
			<div class="folder-dialog-body"><label class="folder-name-label">Folder name<input bind:value={folderName} maxlength="120" data-autofocus /></label>{#if folderIssue}<p class="trash-issue" role="alert">{folderIssue}</p>{/if}</div>
			<footer class="folder-dialog-footer"><button type="button" class="destination-cancel" onclick={() => folderEditor = null}>Cancel</button><button type="submit" class="new-button">{folderEditor.id ? 'Save name' : 'Create folder'}</button></footer>
		</form>
		</div>
	</div>
{/if}

{#if movePicker}
	<div class="template-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) movePicker = null; }}>
		<div class="folder-dialog" role="dialog" aria-modal="true" aria-label={movePicker.folderId ? 'Move folder' : 'Move to folder'} use:modal={{ returnFocus: '.artifact-context-trigger, .file-checkbox, .row-context-trigger' }}>
			<header class="folder-dialog-header"><div class="eyebrow">CHOOSE A PLACE</div><h2>{movePicker.folderId ? 'Move folder' : 'Move to folder'}</h2><p>{movePicker.title}</p><input class="folder-search" aria-label="Find a folder" placeholder="Find a folder" bind:value={folderQuery} data-autofocus /></header>
			<div class="folder-dialog-body folder-destinations" role="group" aria-label="Destination folder">
				<button class:chosen={moveDestination === null} aria-pressed={moveDestination === null} onclick={() => moveDestination = null}><span aria-hidden="true">✳</span><span>{movePicker.folderId ? 'HomeSuite' : 'Unfiled'}</span><span class="destination-check" aria-hidden="true">{moveDestination === null ? '✓' : ''}</span></button>
				{#each moveTargets as row (row.folder.id)}<button class:chosen={moveDestination === row.folder.id} aria-pressed={moveDestination === row.folder.id} onclick={() => moveDestination = row.folder.id}><FolderIcon /><span>{row.path}</span><span class="destination-check" aria-hidden="true">{moveDestination === row.folder.id ? '✓' : ''}</span></button>{:else}<p>{folderQuery ? 'No matching folders.' : 'Create a folder from New to give your things a place.'}</p>{/each}
				{#if folderIssue}<p class="trash-issue" role="alert">{folderIssue}</p>{/if}
			</div>
			<footer class="folder-dialog-footer"><button class="destination-cancel" onclick={() => movePicker = null}>Cancel</button><button class="new-button" onclick={commitMove}>Move here</button></footer>
		</div>
	</div>
{/if}

{#if folderRemoval}
	<div class="template-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) folderRemoval = null; }}>
		<div class="folder-dialog" role="dialog" aria-modal="true" aria-label="Remove folder" use:modal={{ returnFocus: '.folder-new-link' }}>
			<header class="folder-dialog-header"><div class="eyebrow">KEEP YOUR THINGS</div><h2>Remove {folderRemoval.name}?</h2><p>Files and subfolders inside will move to {folderPath(folderLibrary, folderRemoval.parentId).map((folder) => folder.name).join(' / ') || 'HomeSuite (files become Unfiled)'}. All file contents are kept.</p></header>
			{#if folderIssue}<div class="folder-dialog-body"><p class="trash-issue" role="alert">{folderIssue}</p></div>{/if}
			<footer class="folder-dialog-footer"><button class="destination-cancel" data-autofocus onclick={() => folderRemoval = null}>Cancel</button><button class="trash-action permanent" onclick={confirmFolderRemoval}>Remove folder</button></footer>
		</div>
	</div>
{/if}

{#if syncOpen}
	<div class="template-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) syncOpen = false; }}>
		<div class="folder-dialog sync-dialog" role="dialog" aria-modal="true" aria-label="Sync HomeSuite" use:modal={{ returnFocus: '.sync-trigger' }}>
			<header class="folder-dialog-header">
				<div class="eyebrow">YOUR DEVICES</div>
				<h2>Sync HomeSuite</h2>
				<p>Documents, boards, Collections, folders, and Trash follow you between your computer and your phone. Connect each one with the same passphrase.</p>
			</header>
			<div class="folder-dialog-body">
				{#if syncState.connected}
					<p class="sync-status" role="status"><span class="sync-dot {syncState.syncing ? 'busy' : syncState.status}" aria-hidden="true"></span>{syncState.syncing ? 'Syncing…' : syncState.lastSyncedAt ? `Synced at ${syncState.lastSyncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Connected'}</p>
					<p>HomeSuite syncs when it opens, when you come back to the index, every couple of minutes, and as you leave. A thing changed on both devices keeps the later edit; a delete on one removes it on the other.</p>
				{:else}
					<form class="sync-connect" onsubmit={(event) => { event.preventDefault(); void connectSuite(); }}>
						<label class="folder-name-label">Sync passphrase<input type="password" autocomplete="current-password" bind:value={syncPass} data-autofocus /></label>
						<button type="submit" class="new-button" disabled={syncState.syncing || !syncPass.trim()}>{syncState.syncing ? 'Connecting…' : 'Connect'}</button>
					</form>
					<p>The first sync puts both devices’ things together; nothing on either is removed.</p>
				{/if}
				{#if syncState.errorMessage}<p class="trash-issue" role="alert">{syncState.errorMessage}</p>{/if}
				<p class="sync-footnote">Pictures placed on boards stay on the device they were added from. Connecting here connects every woodles app on this device.</p>
			</div>
			<footer class="folder-dialog-footer">
				{#if syncState.connected}
					<button class="destination-cancel" onclick={() => { disconnectSync(); }}>Disconnect</button>
					<button class="new-button" disabled={syncState.syncing || !!frame} title={frame ? 'Close the open thing to sync' : undefined} onclick={() => void syncIndex()}>Sync now</button>
				{:else}
					<button class="destination-cancel" onclick={() => syncOpen = false}>Close</button>
				{/if}
			</footer>
		</div>
	</div>
{/if}

{#if actionNotice}<div class="context-notice" role="status"><span>{actionNotice}</span><button aria-label="Dismiss action notice" onclick={() => actionNotice = ''}>×</button></div>{/if}

{#if contextMenu}
	{#key contextMenu}
		<ContextMenu label={contextMenu.label} detail={contextMenu.detail} items={contextMenu.items} x={contextMenu.x} y={contextMenu.y} onRun={runContext} onClose={closeContext} />
	{/key}
{/if}

{#if referencePicker}
	<div class="template-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) referencePicker = null; }}>
		<div class="reference-destination-dialog" role="dialog" aria-modal="true" aria-label="Add reference to collection" use:modal={{ returnFocus: '.artifact-context-trigger, .row-context-trigger' }}>
			<div class="eyebrow">CONNECT YOUR THINGS</div>
			<h2>Add to a collection</h2>
			<p><strong>{referencePicker.title}</strong> will appear as a reference. Its content stays in its owning app; the collection holds your local notes.</p>
			<input bind:value={referenceQuery} aria-label="Find a collection" placeholder="Find a collection" data-autofocus />
			{#if referenceIssue}<p role="alert">{referenceIssue}</p>{/if}
			<div class="reference-destinations">
				{#each visibleReferenceTargets as target (target.id)}
					<button disabled={target.contains} onclick={() => addReferenceTo(target.id)}><strong>{target.title}</strong><small>{target.contains ? 'Already contains this reference' : 'Add reference'}</small></button>
				{:else}
					<p>{referenceTargets.length ? 'No matching collections.' : 'Create a collection from New, then add a reference here.'}</p>
				{/each}
			</div>
			<button class="destination-cancel" onclick={() => referencePicker = null}>Cancel</button>
		</div>
	</div>
{/if}

{#if templatePicker}
	{@const picker = templatePicker}
	<div class="template-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) templatePicker = null; }}>
		<div class="template-dialog" role="dialog" aria-modal="true" aria-label={`New ${picker.label.toLowerCase()}`} use:modal={{ returnFocus: '.new-button' }}>
			<header class="template-header">
				<div class="eyebrow">START WITH A SHAPE</div><h2>New {picker.label.toLowerCase()}</h2><p>Choose a starting point. Every {picker.label.toLowerCase()} stays editable.</p>
			</header>
			{#if createIssue}<div class="create-issue" role="alert">{createIssue}</div>{/if}
			<div class="template-scroll">
				{#each [{ id: 'quick', label: 'Quick starts' }, { id: 'lists', label: 'Personal lists' }, { id: 'connected', label: 'Connected app data' }] as group (group.id)}
					{@const groupTemplates = templatesInGroup(picker.templates ?? [], group.id)}
					{#if groupTemplates.length}
						<details class="template-group" open={group.id === 'quick'}>
							<summary><span>{group.label}</span><small>{groupTemplates.length} {groupTemplates.length === 1 ? 'option' : 'options'}</small></summary>
							<div class="template-options">
								{#each groupTemplates as template (template.id)}
									<button onclick={() => create(picker, template.id)}><span>{template.name}</span><small>{template.detail}</small><b aria-hidden="true">↗</b></button>
								{/each}
							</div>
						</details>
					{/if}
				{/each}
			</div>
			<footer class="template-footer"><button class="template-cancel" onclick={() => templatePicker = null}>Cancel</button></footer>
		</div>
	</div>
{/if}

{#if paletteOpen}
	<div class="palette-backdrop">
		<button class="palette-dismiss" aria-label="Close commands" onclick={() => { paletteOpen = false; }}></button>
		<div class="command-palette" role="dialog" aria-modal="true" aria-label="HomeSuite commands" tabindex="-1" use:modal>
			<div class="palette-search"><span>⌕</span><input bind:value={paletteSearch} oninput={() => { paletteIndex = 0; }} data-autofocus role="combobox" aria-expanded="true" aria-controls="palette-results" aria-activedescendant={currentCommand ? `palette-item-${visibleCommands.indexOf(currentCommand)}` : undefined} aria-label="Search commands" placeholder="Type a command…" /><kbd>esc</kbd></div>
			<div class="palette-results" id="palette-results" role="listbox" aria-label="Commands">
				{#each visibleCommands as item, index (item.id)}
					<button id={`palette-item-${index}`} role="option" aria-selected={item === currentCommand} class:current={item === currentCommand} aria-disabled={!item.enabled} tabindex="-1" onclick={() => runPaletteItem(item)} onpointermove={() => { if (item.enabled) paletteIndex = index; }}><span>{item.label}</span><small>{item.detail}</small></button>
				{:else}
					<p>No commands match.</p>
				{/each}
			</div>
		</div>
	</div>
{/if}
