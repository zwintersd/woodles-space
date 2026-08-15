<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { getImageAsset, imageDimensions, imageStorageAvailable, removeImageAsset, saveImageAsset } from '$lib/assets';
	import {
	boundsForItem,
	connectorEndpoints,
	documentBounds,
	extractCardFromStack,
	insertCardIntoStack,
	intersects,
	normalizeBounds,
	reorderStackCard,
	removeItems,
	repairDocument,
	screenToWorld,
	stackCardBounds,
	stackCards,
	zoomAroundPoint,
	} from '$lib/geometry';
	import {
	createCard,
	createConnector,
	createFrame,
	createImage,
	createStack,
	createViewpoint,
	makeId,
	nextZ,
	now,
	type Bounds,
	type Camera,
	type CardItem,
	type FrameItem,
	type JourneyStop,
	type StackItem,
	type Viewpoint,
	type WhiteboardDocument,
	type WhiteboardItem
	} from '$lib/model';
	import {
	cameraForBounds,
	camerasMatch,
	canGoBack,
	canGoForward,
	createCameraHistory,
	planCameraFlight,
	pushCameraMark,
	scaleName,
	stepHistory,
	visibleBounds,
	type CameraHistory
	} from '$lib/camera';
	import {
	fitBoardCamera,
	focusCamera,
	frameSequence,
	frameTitle,
	itemLabel,
	locateCamera,
	stepFrame
	} from '$lib/navigation';
	import {
	addStop,
	advanceStop,
	hasStop,
	moveStop,
	removeStop,
	resolveJourney,
	setJourneyLoop,
	setJourneyStops,
	setStopHold,
	stepStop,
	suggestedStops
	} from '$lib/journey';
	import { cameraCentredOn, minimapExtent, minimapMarks, minimapProjection, type MinimapMark } from '$lib/minimap';
	import { boardLibrary, boardTitleFallback, type BoardSummary } from '$lib/library';
	import { restoreWhiteboard } from '$lib/persistence';
	import {
	deleteLabel,
	labelItems,
	labelsOn,
	labelCount,
	renameLabel,
	retintLabel,
	suggestLabels,
	toggleLabel
	} from '$lib/labels';
	import {
	colorOf,
	formatStamp,
	kindOf,
	propertyCount,
	setItemProperty,
	sourceLabel,
	sourceLink,
	sourceOf,
	statusOf
	} from '$lib/properties';
	import { hitsBounds, searchBoard, type SearchHit } from '$lib/search';
	import {
	behaviorOf,
	BEHAVIOR_NOTES,
	checklistProgress,
	isStack,
	queueHeads,
	renameStack,
	setStackBehavior,
	shiftCardColumn,
	stackBeside,
	takeFromQueue,
	toggleChecked
	} from '$lib/stacks';
	import { isDone } from '$lib/properties';
	import {
	arrivalCamera,
	breadcrumbs,
	enterCamera,
	isPortal,
	popTrailTo,
	portals,
	portalTitle,
	pushTrail,
	returnCamera,
	trailHasBoard,
	type TrailStep
	} from '$lib/portals';
	import { createPortal, type PortalItem } from '$lib/model';
	import { STACK_BEHAVIORS, SUGGESTED_STATUSES, TINTS, type Label, type StackBehavior, type Tint } from '$lib/model';

	type Tool = 'select' | 'frame' | 'stack' | 'line';
	type Drawer = 'places' | 'journey' | 'details';
	const MINIMAP = { width: 186, height: 124 };
	type SaveState = 'idle' | 'saving' | 'saved' | 'recovered' | 'error';
	type Point = { x: number; y: number };
	type PointerMove = { pointerId: number; screen: Point };
	type DragSession = {
		kind: 'drag';
		pointerId: number;
		itemId: string;
		dragIds: string[];
		startWorld: Point;
		startBounds: Record<string, Bounds>;
		sourceStackId?: string;
		extracted: boolean;
	};
	type PanSession = {
		kind: 'pan';
		pointerId: number;
		startScreen: Point;
		camera: Camera;
	};
	type MarqueeSession = {
		kind: 'marquee';
		pointerId: number;
		startWorld: Point;
		additive: boolean;
	};
	type FrameSession = {
		kind: 'frame';
		pointerId: number;
		startWorld: Point;
	};
	type ResizeSession = {
		kind: 'resize';
		pointerId: number;
		itemId: string;
		startWorld: Point;
		bounds: Bounds;
	};
	type PointerSession = DragSession | PanSession | MarqueeSession | FrameSession | ResizeSession;

	let canvasEl = $state<HTMLElement>();
	let imageInput = $state<HTMLInputElement>();
	let board = $state<WhiteboardDocument>({
		board: { id: 'loading-board', title: 'Untitled whiteboard' },
		items: [],
		camera: { x: 180, y: 120, zoom: 1 },
		home: null,
		viewpoints: [],
		journey: { stops: [], loop: false },
		labels: [],
		updatedAt: ''
	});
	let tool = $state<Tool>('select');
	let selectedIds = $state<string[]>([]);
	let connectorSourceId = $state<string | null>(null);
	let draggingIds = $state<string[]>([]);
	let dropStackId = $state<string | null>(null);
	let marquee = $state<Bounds | null>(null);
	let frameDraft = $state<Bounds | null>(null);
	let renamingFrameId = $state<string | null>(null);
	let imageUrls = $state<Record<string, string>>({});
	let missingAssets = $state<Set<string>>(new Set());
	let saveState = $state<SaveState>('idle');
	let saveMessage = $state('stored on this device');
	let notice = $state('');
	let spaceHeld = $state(false);
	let fileDragging = $state(false);
	let activeSession: PointerSession | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let cameraAnimation = 0;
	let pointerMoveFrame = 0;
	let queuedPointerMove: PointerMove | null = null;
	let loaded = false;
	let dirty = false;
	const pendingAssetDeletes = new Set<string>();

	// Navigation: where the camera has been, where it can go, and what it says.
	let history = $state<CameraHistory>(createCameraHistory({ camera: { x: 180, y: 120, zoom: 1 }, label: 'Board' }));
	let viewportSize = $state({ width: 1200, height: 800 });
	let drawer = $state<Drawer | null>(null);
	let minimapOn = $state(true);
	let shortcutsOpen = $state(false);
	let newViewpointName = $state('');
	let renamingViewpointId = $state<string | null>(null);

	// The shelf: every board, and which one is open.
	let shelfOpen = $state(false);
	let boards = $state<BoardSummary[]>([]);
	let confirmDeleteId = $state<string | null>(null);

	// Journey Mode.
	let playing = $state(false);
	let paused = $state(false);
	let playIndex = $state(0);
	let playTimer: ReturnType<typeof setTimeout> | null = null;

	// Labels and the optional layer.
	let labelDraft = $state('');
	let renamingLabelId = $state<string | null>(null);

	// Portals: the boards below this one, and how deep we are.
	type PortalPreview = { title: string; marks: MinimapMark[]; bounds: Bounds | null; missing: boolean };
	let previews = $state<Record<string, PortalPreview>>({});
	let trail = $state<TrailStep[]>([]);
	/** Rises over the board while going through a doorway, in either direction. */
	let veil = $state(0);
	let travelling = false;

	// Search: the board flies to what you find.
	let searchOpen = $state(false);
	let searchText = $state('');
	let searchIndex = $state(0);
	let searchInput = $state<HTMLInputElement>();
	/** Where to put the camera back if the search is abandoned. */
	let searchReturn: Camera | null = null;
	let searchPreviewTimer: ReturnType<typeof setTimeout> | null = null;

	const objects = $derived(
		board.items
			.filter((item) => item.type !== 'connector')
			.slice()
			.sort((a, b) => {
				const kindOrder = a.type === 'frame' ? 0 : a.type === 'stack' ? 1 : 2;
				const otherKindOrder = b.type === 'frame' ? 0 : b.type === 'stack' ? 1 : 2;
				return kindOrder - otherKindOrder || a.zIndex - b.zIndex;
			})
	);
	const connectors = $derived(board.items.filter((item) => item.type === 'connector'));
	const hasContent = $derived(board.items.some((item) => item.type !== 'connector'));

	const sequence = $derived(frameSequence(board.items));
	/** The frames the camera is inside, outermost first — the tail of the crumbs. */
	const frameTrail = $derived(locateCamera(board.items, board.camera, viewportSize));
	const here = $derived(frameTrail.length ? frameTrail[frameTrail.length - 1] : null);
	const stops = $derived(resolveJourney(board, viewportSize));
	const mapProjection = $derived(minimapProjection(minimapExtent(board, board.camera, viewportSize), MINIMAP));
	const mapMarks = $derived(minimapMarks(board.items));
	const mapView = $derived(mapProjection.project(visibleBounds(board.camera, viewportSize)));

	/** The objects the Details panel is speaking about — nothing, one, or many. */
	const chosen = $derived(board.items.filter((item) => selectedIds.includes(item.id) && item.type !== 'connector'));
	const only = $derived(chosen.length === 1 ? chosen[0] : null);
	const crumbs = $derived(breadcrumbs(trail, board, board.camera, viewportSize));
	const results = $derived(searchOpen && searchText.trim() ? searchBoard(board, searchText) : []);
	const matchIds = $derived(new Set(results.map((hit) => hit.item.id)));

	function viewport(): { width: number; height: number } {
		const rect = canvasEl?.getBoundingClientRect();
		return { width: rect?.width ?? window.innerWidth, height: rect?.height ?? window.innerHeight };
	}

	function measureViewport() {
		viewportSize = viewport();
	}

	function localPoint(event: MouseEvent | PointerEvent | WheelEvent | DragEvent): Point {
		const rect = canvasEl?.getBoundingClientRect();
		return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
	}

	function pointForEvent(event: MouseEvent | PointerEvent | WheelEvent | DragEvent): Point {
		return screenToWorld(board.camera, localPoint(event));
	}

	function itemBounds(item: WhiteboardItem): Bounds {
		return boundsForItem(board.items, item);
	}

	function itemStyle(item: WhiteboardItem): string {
		const bounds = itemBounds(item);
		// Containers always sit beneath their material. Keep the bands integral:
		// CSS z-index accepts integers, not the fractional stack offsets this replaces.
		const layerBase = item.type === 'frame' ? 0 : item.type === 'stack' ? 10_000 : 20_000;
		const selected = isSelected(item.id) && item.type !== 'frame' && item.type !== 'stack' ? 10_000 : 0;
		return `transform: translate3d(${bounds.x}px, ${bounds.y}px, 0); width: ${bounds.width}px; height: ${bounds.height}px; z-index: ${layerBase + item.zIndex + selected};`;
	}

	function worldStyle(): string {
		return `transform: translate3d(${board.camera.x}px, ${board.camera.y}px, 0) scale(${board.camera.zoom});`;
	}

	function isSelected(id: string): boolean {
		return selectedIds.includes(id);
	}

	function isTextTarget(target: EventTarget | null): boolean {
		return target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(target.tagName);
	}

	function targetHasUI(target: EventTarget | null): boolean {
		return target instanceof Element && Boolean(target.closest('[data-whiteboard-ui], [data-whiteboard-object]'));
	}

	function selectOnly(id: string) {
		selectedIds = [id];
		connectorSourceId = null;
	}

	function selectObject(item: WhiteboardItem, event: PointerEvent | MouseEvent) {
		const additive = event.shiftKey || event.metaKey || event.ctrlKey;
		if (additive) {
			selectedIds = selectedIds.includes(item.id)
				? selectedIds.filter((id) => id !== item.id)
				: [...selectedIds, item.id];
		} else if (!selectedIds.includes(item.id)) {
			selectedIds = [item.id];
		}
	}

	function setItems(items: WhiteboardItem[]) {
		board.items = items;
		board.updatedAt = now();
		markDirty();
	}

	function markDirty() {
		if (loaded) dirty = true;
	}

	function updateItem(id: string, patch: Partial<WhiteboardItem>, persist = false) {
		setItems(
			board.items.map((item) =>
				item.id === id ? ({ ...item, ...patch, updatedAt: now() } as WhiteboardItem) : item
			)
		);
		if (persist) scheduleSave();
	}

	function scheduleSave(delay = 420) {
		if (!loaded) return;
		markDirty();
		if (saveTimer) clearTimeout(saveTimer);
		saveState = 'saving';
		saveMessage = 'saving…';
		saveTimer = setTimeout(() => {
			saveTimer = null;
			saveNow();
		}, delay);
	}

	function saveNow() {
		if (!loaded || !dirty) return;
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		board.updatedAt = now();
		const result = boardLibrary.save(board);
		if (result.ok) {
			dirty = false;
			saveState = 'saved';
			saveMessage = 'saved here';
			removeSettledImageAssets();
		} else {
			saveState = 'error';
			saveMessage = result.issue?.message ?? 'this board could not be saved';
		}
	}

	function removeSettledImageAssets() {
		for (const assetId of [...pendingAssetDeletes]) {
			if (board.items.some((item) => item.type === 'image' && item.assetId === assetId)) {
				pendingAssetDeletes.delete(assetId);
				continue;
			}
			void removeImageAsset(assetId)
				.then(() => pendingAssetDeletes.delete(assetId))
				.catch(() => undefined);
		}
	}

	async function hydrateImages() {
		for (const item of board.items.filter((candidate): candidate is Extract<WhiteboardItem, { type: 'image' }> => candidate.type === 'image')) {
			try {
				const asset = await getImageAsset(item.assetId);
				if (!asset) {
					missingAssets = new Set([...missingAssets, item.assetId]);
					continue;
				}
				imageUrls = { ...imageUrls, [item.assetId]: URL.createObjectURL(asset.blob) };
			} catch {
				missingAssets = new Set([...missingAssets, item.assetId]);
			}
		}
	}

	onMount(() => {
		measureViewport();
		// The one board of the single-board era becomes the first board on the shelf.
		const adopted = boardLibrary.adoptLegacyBoard();
		const opened = adopted
			? { document: adopted, source: 'primary' as const, issue: null }
			: openLastBoard();

		if (opened) {
			board = restoreWhiteboard(opened.document);
			boardLibrary.setActiveId(board.board.id);
			if (opened.source === 'backup') {
				saveState = 'recovered';
				saveMessage = 'restored the last saved board';
			} else if (opened.issue) {
				saveState = 'error';
				saveMessage = opened.issue;
			} else {
				saveState = 'saved';
				saveMessage = 'saved here';
			}
		} else {
			board = boardLibrary.create();
			saveState = 'saved';
			saveMessage = 'saved here';
		}

		history = createCameraHistory({ camera: { ...board.camera }, label: 'Where you were' });
		loaded = true;
		// Resume at the depth the last session left off at, not at the top.
		trail = boardLibrary.readTrail().filter((step) => step.boardId !== board.board.id);
		if (trail.length !== boardLibrary.readTrail().length) boardLibrary.writeTrail(trail);
		refreshBoards();
		refreshPreviews();
		void hydrateImages();

		const onBeforeUnload = () => saveNow();
		window.addEventListener('beforeunload', onBeforeUnload);
		window.addEventListener('resize', measureViewport);
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload);
			window.removeEventListener('resize', measureViewport);
			saveNow();
		};
	});

	function openLastBoard() {
		const shelf = boardLibrary.list();
		if (!shelf.length) return null;
		const active = boardLibrary.activeId();
		const target = active && shelf.some((entry) => entry.id === active) ? active : shelf[0].id;
		return boardLibrary.open(target);
	}

	onDestroy(() => {
		if (cameraAnimation) cancelAnimationFrame(cameraAnimation);
		if (pointerMoveFrame) cancelAnimationFrame(pointerMoveFrame);
		clearPlayTimer();
		if (searchPreviewTimer) clearTimeout(searchPreviewTimer);
		Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
	});

	async function createCardAt(point: Point) {
		const card = createCard(point.x - 18, point.y - 18, nextZ(board.items));
		setItems([...board.items, card]);
		selectOnly(card.id);
		scheduleSave();
		await tick();
		document.getElementById(`card-body-${card.id}`)?.focus();
	}

	async function createStackAt(point: Point) {
		const stack = createStack(point.x - 32, point.y - 24, nextZ(board.items));
		setItems([...board.items, stack]);
		selectOnly(stack.id);
		scheduleSave();
		await tick();
		document.getElementById(`stack-title-${stack.id}`)?.focus();
	}

	async function createFrameAt(bounds: Bounds) {
		const frame = createFrame(bounds.x, bounds.y, bounds.width, bounds.height, 1);
		setItems([...board.items, frame]);
		selectOnly(frame.id);
		renamingFrameId = frame.id;
		scheduleSave();
		await tick();
		document.getElementById(`frame-title-${frame.id}`)?.focus();
	}

	function addCardFromDock() {
		const size = viewport();
		void createCardAt(screenToWorld(board.camera, { x: size.width / 2 - 120, y: size.height / 2 - 70 }));
	}

	function addStackFromDock() {
		tool = 'select';
		const size = viewport();
		void createStackAt(screenToWorld(board.camera, { x: size.width / 2 - 100, y: size.height / 2 - 80 }));
	}

	async function addImageFile(file: File, point: Point) {
		if (!file.type.startsWith('image/')) {
			notice = 'Whiteboard can place image files here.';
			return;
		}
		if (!imageStorageAvailable()) {
			notice = 'This browser does not make room for images on the board.';
			return;
		}

		const assetId = makeId('image');
		const source = URL.createObjectURL(file);
		try {
			const dimensions = await imageDimensions(source);
			if (!dimensions.width || !dimensions.height) throw new Error('That image has no dimensions.');
			await saveImageAsset({ id: assetId, name: file.name || 'image', blob: file, createdAt: now() });
			const image = createImage(
				point.x - 150,
				point.y - (300 / (dimensions.width / dimensions.height)) / 2,
				assetId,
				file.name || 'image',
				dimensions.width / dimensions.height,
				nextZ(board.items)
			);
			imageUrls = { ...imageUrls, [assetId]: source };
			setItems([...board.items, image]);
			selectOnly(image.id);
			notice = '';
			scheduleSave();
		} catch (error) {
			URL.revokeObjectURL(source);
			notice = error instanceof Error ? error.message : 'That image could not be placed.';
		}
	}

	function handleImageInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		if (!files.length) return;
		const size = viewport();
		const center = screenToWorld(board.camera, { x: size.width / 2, y: size.height / 2 });
		void Promise.all(files.map((file, index) => addImageFile(file, { x: center.x + index * 28, y: center.y + index * 28 })));
		input.value = '';
	}

	/** Taking hold of the board mid-journey pauses it rather than fighting you. */
	function handHoldsTheCamera() {
		if (playing && !paused) pauseJourney();
	}

	function handleCanvasPointerDown(event: PointerEvent) {
		if (targetHasUI(event.target)) return;
		handHoldsTheCamera();
		interruptCameraAnimation();
		if (event.button === 1 || (event.button === 0 && spaceHeld)) {
			beginPan(event);
			return;
		}
		if (event.button !== 0) return;
		const point = pointForEvent(event);
		if (tool === 'frame') {
			activeSession = { kind: 'frame', pointerId: event.pointerId, startWorld: point };
			frameDraft = { x: point.x, y: point.y, width: 0, height: 0 };
			canvasEl?.setPointerCapture(event.pointerId);
			return;
		}
		if (tool === 'stack') {
			void createStackAt(point);
			tool = 'select';
			return;
		}
		if (tool === 'line') {
			notice = connectorSourceId ? 'Choose the second idea for this line.' : 'Choose the first idea for this line.';
			return;
		}
		activeSession = {
			kind: 'marquee',
			pointerId: event.pointerId,
			startWorld: point,
			additive: event.shiftKey || event.metaKey || event.ctrlKey
		};
		marquee = { x: point.x, y: point.y, width: 0, height: 0 };
		canvasEl?.setPointerCapture(event.pointerId);
	}

	function beginPan(event: PointerEvent) {
		activeSession = {
			kind: 'pan',
			pointerId: event.pointerId,
			startScreen: localPoint(event),
			camera: { ...board.camera }
		};
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
	}

	function handleItemPointerDown(event: PointerEvent, item: WhiteboardItem) {
		if (event.button === 1 || (event.button === 0 && spaceHeld)) {
			event.stopPropagation();
			beginPan(event);
			return;
		}
		if (event.button !== 0) return;
		event.stopPropagation();
		handHoldsTheCamera();
		interruptCameraAnimation();
		if (tool === 'line') {
			connectTo(item);
			return;
		}
		selectObject(item, event);
		const selection = (event.shiftKey || event.metaKey || event.ctrlKey)
			? selectedIds
			: selectedIds.includes(item.id) ? selectedIds : [item.id];
		const dragIds = selection.filter((id) => board.items.some((candidate) => candidate.id === id && candidate.type !== 'connector'));
		const startBounds = Object.fromEntries(
			dragIds
				.map((id) => board.items.find((candidate) => candidate.id === id))
				.filter((candidate): candidate is WhiteboardItem => Boolean(candidate))
				.map((candidate) => [candidate.id, itemBounds(candidate)])
		);
		activeSession = {
			kind: 'drag',
			pointerId: event.pointerId,
			itemId: item.id,
			dragIds,
			startWorld: pointForEvent(event),
			startBounds,
			sourceStackId: item.type === 'card' ? item.stackId : undefined,
			extracted: false
		};
		draggingIds = dragIds;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function connectTo(item: WhiteboardItem) {
		if (item.type === 'connector') return;
		if (!connectorSourceId) {
			connectorSourceId = item.id;
			selectedIds = [item.id];
			notice = 'Now choose the second idea.';
			return;
		}
		if (connectorSourceId === item.id) {
			notice = 'Choose another idea for the other end.';
			return;
		}
		const line = createConnector(connectorSourceId, item.id);
		setItems([...board.items, line]);
		selectedIds = [line.id];
		connectorSourceId = null;
		tool = 'select';
		notice = '';
		scheduleSave();
	}

	function handlePointerMove(event: PointerEvent) {
		const session = activeSession;
		if (!session || session.pointerId !== event.pointerId) return;
		queuedPointerMove = { pointerId: event.pointerId, screen: localPoint(event) };
		if (pointerMoveFrame) return;
		pointerMoveFrame = requestAnimationFrame(() => {
			pointerMoveFrame = 0;
			flushPointerMove();
		});
	}

	function flushPointerMove() {
		if (pointerMoveFrame) {
			cancelAnimationFrame(pointerMoveFrame);
			pointerMoveFrame = 0;
		}
		const move = queuedPointerMove;
		queuedPointerMove = null;
		if (move) applyPointerMove(move);
	}

	function applyPointerMove(move: PointerMove) {
		const session = activeSession;
		if (!session || session.pointerId !== move.pointerId) return;
		if (session.kind === 'pan') {
			const current = move.screen;
			board.camera = {
				...session.camera,
				x: session.camera.x + current.x - session.startScreen.x,
				y: session.camera.y + current.y - session.startScreen.y
			};
			markDirty();
			return;
		}

		const point = screenToWorld(board.camera, move.screen);
		if (session.kind === 'marquee') {
			marquee = normalizeBounds(session.startWorld.x, session.startWorld.y, point.x - session.startWorld.x, point.y - session.startWorld.y);
			return;
		}
		if (session.kind === 'frame') {
			frameDraft = normalizeBounds(session.startWorld.x, session.startWorld.y, point.x - session.startWorld.x, point.y - session.startWorld.y);
			return;
		}
		if (session.kind === 'resize') {
			const item = board.items.find((candidate) => candidate.id === session.itemId);
			if (!item || item.type === 'connector') return;
			const dx = point.x - session.startWorld.x;
			const dy = point.y - session.startWorld.y;
			const width = Math.max(item.type === 'card' ? 150 : 120, session.bounds.width + dx);
			const height = item.type === 'image'
				? Math.max(80, width / item.aspectRatio)
				: Math.max(item.type === 'card' ? 90 : 100, session.bounds.height + dy);
			updateItem(item.id, { width, height });
			return;
		}

		const dx = point.x - session.startWorld.x;
		const dy = point.y - session.startWorld.y;
		const source = board.items.find((candidate): candidate is CardItem => candidate.id === session.itemId && candidate.type === 'card');
		if (source?.stackId && !session.extracted) {
			const stack = board.items.find((candidate): candidate is StackItem => candidate.id === source.stackId && candidate.type === 'stack');
			if (stack) {
				const bounds = itemBounds(stack);
				const staysInStack = point.x >= bounds.x - 24 && point.x <= bounds.x + bounds.width + 24 && point.y >= bounds.y - 24 && point.y <= bounds.y + bounds.height + 24;
				if (staysInStack) {
					board = reorderStackCard(board, stack.id, source.id, point.y);
					markDirty();
					return;
				}
			}
			const start = session.startBounds[source.id];
			if (start) {
				board = extractCardFromStack(board, source.id, { x: start.x + dx, y: start.y + dy });
				markDirty();
				session.extracted = true;
			}
		}

		setItems(
			board.items.map((item) => {
				const start = session.startBounds[item.id];
				if (!start || item.type === 'connector' || (item.type === 'card' && item.stackId)) return item;
				return { ...item, x: start.x + dx, y: start.y + dy, updatedAt: now() };
			})
		);
		const draggedCard = board.items.find((candidate): candidate is CardItem => candidate.id === session.itemId && candidate.type === 'card');
		dropStackId = draggedCard && !draggedCard.stackId ? stackAt(point, draggedCard.id)?.id ?? null : null;
	}

	function handlePointerUp(event: PointerEvent) {
		flushPointerMove();
		const session = activeSession;
		if (!session || session.pointerId !== event.pointerId) return;
		if (session.kind === 'marquee') {
			const selected = marquee
				? board.items
					.filter((item) => item.type !== 'connector')
					.filter((item) => intersects(marquee!, itemBounds(item)))
					.map((item) => item.id)
				: [];
			selectedIds = session.additive ? [...new Set([...selectedIds, ...selected])] : selected;
			marquee = null;
		} else if (session.kind === 'frame') {
			const draft = frameDraft;
			frameDraft = null;
			if (draft && draft.width >= 48 && draft.height >= 48) void createFrameAt(draft);
		} else if (session.kind === 'drag') {
			const point = pointForEvent(event);
			const cards = session.dragIds
				.map((id) => board.items.find((item): item is CardItem => item.id === id && item.type === 'card'))
				.filter((item): item is CardItem => Boolean(item && !item.stackId));
			const target = stackAt(point, session.itemId);
			if (target && cards.length) {
				for (const card of cards) {
					board = insertCardIntoStack(board, card.id, target.id, insertionIndex(target, point.y));
				}
			}
			draggingIds = [];
			dropStackId = null;
		}
		if (session.kind === 'pan' || session.kind === 'resize' || session.kind === 'drag' || session.kind === 'frame') scheduleSave();
		activeSession = null;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
		} catch {
			// Capture can already be released by the browser, which is fine.
		}
	}

	function cancelPointerSession() {
		if (pointerMoveFrame) cancelAnimationFrame(pointerMoveFrame);
		pointerMoveFrame = 0;
		queuedPointerMove = null;
		activeSession = null;
		draggingIds = [];
		dropStackId = null;
		marquee = null;
		frameDraft = null;
	}

	function stackAt(point: Point, excludedId?: string): StackItem | null {
		return board.items
			.filter((item): item is StackItem => item.type === 'stack' && item.id !== excludedId)
			.sort((a, b) => b.zIndex - a.zIndex)
			.find((stack) => {
				const bounds = itemBounds(stack);
				return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
			}) ?? null;
	}

	function insertionIndex(stack: StackItem, pointY: number): number {
		const cards = stackCards(board.items, stack);
		for (let index = 0; index < cards.length; index += 1) {
			const bounds = stackCardBounds(board.items, stack, cards[index]);
			if (pointY < bounds.y + bounds.height / 2) return index;
		}
		return cards.length;
	}

	function startResize(event: PointerEvent, item: WhiteboardItem) {
		if (item.type === 'connector') return;
		event.stopPropagation();
		selectOnly(item.id);
		activeSession = { kind: 'resize', pointerId: event.pointerId, itemId: item.id, startWorld: pointForEvent(event), bounds: itemBounds(item) };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function handleEditablePointerDown(event: PointerEvent, item: WhiteboardItem) {
		event.stopPropagation();
		if (tool === 'line') {
			event.preventDefault();
			connectTo(item);
			return;
		}
		selectObject(item, event);
	}

	function handleEditableKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') (event.currentTarget as HTMLElement).blur();
	}

	function handleCanvasDoubleClick(event: MouseEvent) {
		if (targetHasUI(event.target)) return;
		if (tool === 'select') void createCardAt(pointForEvent(event));
	}

	function handleItemDoubleClick(event: MouseEvent, item: WhiteboardItem) {
		event.stopPropagation();
		if (tool !== 'select') return;
		if (item.type === 'card') {
			void tick().then(() => document.getElementById(`card-body-${item.id}`)?.focus());
		}
		if (item.type === 'frame') {
			renamingFrameId = item.id;
			void tick().then(() => document.getElementById(`frame-title-${item.id}`)?.focus());
		}
	}

	function updateCard(item: CardItem, field: 'title' | 'body', value: string) {
		updateItem(item.id, { [field]: value } as Partial<WhiteboardItem>, true);
	}

	function updateFrame(item: FrameItem, value: string) {
		updateItem(item.id, { title: value }, true);
	}

	/**
	 * Stack titles go through `renameStack`, not `updateItem`: a Status stack's
	 * title is the status it confers, so renaming it renames every card inside.
	 */
	function updateStack(item: StackItem, value: string) {
		board = renameStack(board, item.id, value);
		board.updatedAt = now();
		scheduleSave();
	}

	function changeBehavior(stackId: string, behavior: StackBehavior) {
		board = setStackBehavior(board, stackId, behavior);
		scheduleSave();
	}

	function tickCard(card: WhiteboardItem) {
		board = toggleChecked(board, card.id);
		scheduleSave();
	}

	function takeTop(stackId: string) {
		board = takeFromQueue(board, stackId);
		scheduleSave();
	}

	function addColumnBeside(stack: StackItem) {
		board = stackBeside(board, stack.id, 'New column');
		scheduleSave();
	}

	function moveCardColumn(direction: -1 | 1) {
		const card = chosen.find((item) => item.type === 'card' && item.stackId);
		if (!card) return;
		const before = board;
		board = shiftCardColumn(board, card.id, direction);
		if (board === before) notice = 'That is the last column this way.';
		else scheduleSave();
	}

	const stacksById = $derived(new Map(board.items.filter(isStack).map((item) => [item.id, item])));

	/** The stack a card is laid in, and therefore how it should be shown. */
	function homeStack(item: WhiteboardItem): StackItem | null {
		return item.type === 'card' && item.stackId ? stacksById.get(item.stackId) ?? null : null;
	}

	function cardMode(item: WhiteboardItem): StackBehavior | null {
		const stack = homeStack(item);
		return stack ? behaviorOf(stack) : null;
	}

	/** "now" for the top of a queue, "next" for the one under it. */
	function queueRank(item: WhiteboardItem): 'now' | 'next' | null {
		const stack = homeStack(item);
		if (!stack || behaviorOf(stack) !== 'queue') return null;
		const at = stack.cardIds.indexOf(item.id);
		return at === 0 ? 'now' : at === 1 ? 'next' : null;
	}

	function stackCountLabel(stack: StackItem): string {
		if (behaviorOf(stack) === 'checklist') {
			const progress = checklistProgress(board.items, stack);
			return progress.total ? `${progress.done}/${progress.total}` : '';
		}
		return stack.cardIds.length ? String(stack.cardIds.length) : '';
	}

	function deleteSelection() {
		if (!selectedIds.length) return;
		const selected = new Set(selectedIds);
		const imageAssets = board.items
			.filter((item): item is Extract<WhiteboardItem, { type: 'image' }> => selected.has(item.id) && item.type === 'image')
			.map((item) => item.assetId);
		const next = removeItems(board, selected);
		setItems(next.items);
		selectedIds = [];
		connectorSourceId = null;
		for (const assetId of imageAssets) {
			if (next.items.some((item) => item.type === 'image' && item.assetId === assetId)) continue;
			if (imageUrls[assetId]) URL.revokeObjectURL(imageUrls[assetId]);
			const { [assetId]: _removed, ...remaining } = imageUrls;
			imageUrls = remaining;
			pendingAssetDeletes.add(assetId);
		}
		scheduleSave();
	}

	function duplicateSelection() {
		const originals = board.items.filter((item) => selectedIds.includes(item.id) && item.type !== 'connector');
		if (!originals.length) return;
		const clones = originals.map((item, index) => {
			const bounds = itemBounds(item);
			const stamp = now();
			if (item.type === 'card') {
				return { ...item, id: makeId('card'), x: bounds.x + 28, y: bounds.y + 28, stackId: undefined, freePosition: undefined, zIndex: nextZ(board.items) + index, createdAt: stamp, updatedAt: stamp } as WhiteboardItem;
			}
			if (item.type === 'stack') {
				return { ...item, id: makeId('stack'), x: bounds.x + 28, y: bounds.y + 28, cardIds: [], zIndex: nextZ(board.items) + index, createdAt: stamp, updatedAt: stamp } as WhiteboardItem;
			}
			return { ...item, id: makeId(item.type), x: bounds.x + 28, y: bounds.y + 28, zIndex: nextZ(board.items) + index, createdAt: stamp, updatedAt: stamp } as WhiteboardItem;
		});
		setItems([...board.items, ...clones]);
		selectedIds = clones.map((item) => item.id);
		scheduleSave();
	}

	function handleConnectorPointerDown(event: PointerEvent, connector: Extract<WhiteboardItem, { type: 'connector' }>) {
		event.stopPropagation();
		selectOnly(connector.id);
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		handHoldsTheCamera();
		interruptCameraAnimation();
		const factor = Math.exp(-event.deltaY * 0.00125);
		board.camera = zoomAroundPoint(board.camera, localPoint(event), board.camera.zoom * factor);
		scheduleSave(540);
	}

	function interruptCameraAnimation() {
		if (cameraAnimation) cancelAnimationFrame(cameraAnimation);
		cameraAnimation = 0;
	}

	function prefersReducedMotion(): boolean {
		return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/** Returns how long the move will take, so a journey can time its next step. */
	function animateCamera(target: Camera): number {
		interruptCameraAnimation();
		measureViewport();
		if (prefersReducedMotion()) {
			board.camera = { ...target };
			scheduleSave();
			return 0;
		}
		const flight = planCameraFlight(board.camera, target, viewport());
		const startAt = performance.now();
		const step = (time: number) => {
			const progress = Math.min(1, (time - startAt) / flight.duration);
			board.camera = flight.at(progress);
			markDirty();
			if (progress < 1) {
				cameraAnimation = requestAnimationFrame(step);
			} else {
				cameraAnimation = 0;
				scheduleSave();
			}
		};
		cameraAnimation = requestAnimationFrame(step);
		return flight.duration;
	}

	/**
	 * Every deliberate move goes through here, so the place being left is written
	 * into history and Back has somewhere to return to. Free panning and zooming
	 * deliberately do not: history is a record of decisions, not of drifting.
	 */
	function flyTo(target: Camera, label: string, record = true): number {
		if (record) history = pushCameraMark(history, board.camera, { camera: { ...target }, label });
		return animateCamera(target);
	}

	function focusItem(id: string, label?: string) {
		const camera = focusCamera(board.items, id, viewport());
		if (!camera) return;
		const item = board.items.find((candidate) => candidate.id === id);
		flyTo(camera, label ?? (item ? itemLabel(item) : 'Board'));
		selectOnly(id);
	}

	function focusFrame(item: FrameItem) {
		focusItem(item.id, frameTitle(item));
	}

	function goHome() {
		flyTo(board.home ?? fitBoardCamera(board, viewport()), board.home ? 'Home' : 'Whole board');
	}

	function fitBoard() {
		flyTo(fitBoardCamera(board, viewport()), 'Whole board');
	}

	function setHome() {
		board.home = { ...board.camera };
		notice = 'Home is this view now.';
		scheduleSave();
	}

	function clearHome() {
		board.home = null;
		notice = 'Home is the whole board again.';
		scheduleSave();
	}

	function travelHistory(direction: -1 | 1) {
		const stepped = stepHistory(history, board.camera, direction);
		if (!stepped) return;
		history = stepped.history;
		animateCamera(stepped.mark.camera);
	}

	function stepThroughFrames(direction: -1 | 1) {
		const next = stepFrame(sequence, here?.id ?? null, direction);
		if (!next) {
			notice = 'Draw a frame to give the board places to go.';
			return;
		}
		focusFrame(next);
	}

	function jumpToFrame(position: number) {
		const frame = sequence[position];
		if (frame) focusFrame(frame);
	}

	function changeZoom(multiplier: number) {
		const size = viewport();
		board.camera = zoomAroundPoint(board.camera, { x: size.width / 2, y: size.height / 2 }, board.camera.zoom * multiplier);
		scheduleSave();
	}

	function saveViewpointHere() {
		const name = newViewpointName.trim() || `View ${board.viewpoints.length + 1}`;
		board.viewpoints = [...board.viewpoints, createViewpoint(name, board.camera)];
		newViewpointName = '';
		notice = `Saved “${name}”.`;
		scheduleSave();
	}

	function goToViewpoint(viewpoint: Viewpoint) {
		flyTo(viewpoint.camera, viewpoint.name);
	}

	function renameViewpoint(id: string, name: string) {
		board.viewpoints = board.viewpoints.map((viewpoint) => (viewpoint.id === id ? { ...viewpoint, name } : viewpoint));
		scheduleSave();
	}

	function deleteViewpoint(id: string) {
		board.viewpoints = board.viewpoints.filter((viewpoint) => viewpoint.id !== id);
		board = repairDocument(board);
		scheduleSave();
	}

	// ── Journey Mode ────────────────────────────────────────────────────────
	// The board, read aloud: the camera walks an arranged sequence of places and
	// rests at each one long enough to be taken in.

	function clearPlayTimer() {
		if (playTimer) clearTimeout(playTimer);
		playTimer = null;
	}

	function beginJourney(from = 0) {
		if (!board.journey.stops.length) {
			const suggested = suggestedStops(board);
			if (!suggested.length) {
				notice = 'A journey visits frames — draw a frame or two first.';
				return;
			}
			board = setJourneyStops(board, suggested);
			scheduleSave();
		}
		playing = true;
		paused = false;
		drawer = null;
		shelfOpen = false;
		// The board is being shown, not worked on: selection rings and handles go.
		selectedIds = [];
		connectorSourceId = null;
		tool = 'select';
		notice = '';
		playStop(from);
	}

	function playStop(index: number) {
		clearPlayTimer();
		const resolved = resolveJourney(board, viewport());
		if (!resolved.length) {
			exitJourney();
			return;
		}
		const position = Math.max(0, Math.min(index, resolved.length - 1));
		playIndex = position;
		const stop = resolved[position];
		// Stops are not written into history: a journey has its own way forward
		// and back, and twenty stops would bury the places you chose yourself.
		const travel = stop.camera ? flyTo(stop.camera, stop.label, false) : 0;
		if (paused) return;
		playTimer = setTimeout(() => {
			const next = advanceStop(position, resolved.length, board.journey.loop);
			if (next === null) finishJourney();
			else playStop(next);
		}, travel + stop.stop.hold * 1000);
	}

	function pauseJourney() {
		paused = true;
		clearPlayTimer();
	}

	function resumeJourney() {
		paused = false;
		playStop(playIndex);
	}

	function stepJourney(direction: -1 | 1) {
		playStop(stepStop(playIndex, board.journey.stops.length, direction));
	}

	function finishJourney() {
		exitJourney();
		notice = 'Journey complete.';
	}

	/** Leaves the journey where it stands, and makes that somewhere Back can undo. */
	function exitJourney() {
		clearPlayTimer();
		if (playing) {
			const label = stops[playIndex]?.label ?? 'Journey';
			history = pushCameraMark(history, board.camera, { camera: { ...board.camera }, label });
		}
		playing = false;
		paused = false;
	}

	function toggleStop(target: JourneyStop['target']) {
		if (hasStop(board, target)) {
			const existing = board.journey.stops.find((stop) =>
				stop.target.kind === target.kind &&
				(target.kind === 'board' || (stop.target.kind !== 'board' && stop.target.id === target.id))
			);
			if (existing) board = removeStop(board, existing.id);
		} else {
			board = addStop(board, target);
		}
		scheduleSave();
	}

	function addSelectionToJourney() {
		const additions = selectedIds.filter((id) => board.items.some((item) => item.id === id && item.type !== 'connector'));
		if (!additions.length) {
			notice = 'Choose something on the board to add to the journey.';
			return;
		}
		for (const id of additions) {
			if (!hasStop(board, { kind: 'item', id })) board = addStop(board, { kind: 'item', id });
		}
		drawer = 'journey';
		scheduleSave();
	}

	function useSuggestedJourney() {
		const suggested = suggestedStops(board);
		if (!suggested.length) {
			notice = 'A journey visits frames — draw a frame or two first.';
			return;
		}
		board = setJourneyStops(board, suggested);
		scheduleSave();
	}

	function clearJourney() {
		board = setJourneyStops(board, []);
		scheduleSave();
	}

	// ── Labels and the optional layer ───────────────────────────────────────

	function chipsFor(item: WhiteboardItem): Label[] {
		return labelsOn(board, item);
	}

	/**
	 * A chip on the board is a button, not a handle. Without this the object
	 * underneath takes the pointer, captures it, and the click never lands.
	 */
	function stopChipPointer(event: PointerEvent) {
		event.stopPropagation();
	}

	const CHIP_ROW_ROOM = 28;

	/** Whether an object is showing a chip row of its own, selection aside. */
	function showsChipRow(item: WhiteboardItem): boolean {
		return Boolean(chipsFor(item).length || statusOf(item) || sourceOf(item));
	}

	function chipRoomBefore(ids: string[]): Map<string, boolean> {
		return new Map(ids.map((id) => {
			const item = board.items.find((candidate) => candidate.id === id);
			return [id, item ? showsChipRow(item) : false];
		}));
	}

	/**
	 * A card grows to hold its first chip row and shrinks back when the last chip
	 * goes. Without this, saying something about a card silently eats a line of
	 * whatever it already said.
	 */
	function keepChipRoom(before: Map<string, boolean>) {
		board.items = board.items.map((item) => {
			if (item.type !== 'card') return item;
			const had = before.get(item.id);
			if (had === undefined || had === showsChipRow(item)) return item;
			const height = had ? Math.max(90, item.height - CHIP_ROW_ROOM) : item.height + CHIP_ROW_ROOM;
			return { ...item, height };
		});
	}

	/** Names a label onto everything selected. New labels are made by typing. */
	function applyLabelDraft() {
		const name = labelDraft.trim();
		if (!name || !chosen.length) return;
		const ids = chosen.map((item) => item.id);
		const before = chipRoomBefore(ids);
		board = labelItems(board, ids, name);
		keepChipRoom(before);
		labelDraft = '';
		scheduleSave();
	}

	function toggleLabelOnSelection(labelId: string) {
		if (!chosen.length) return;
		// With several chosen, one click means "give this to all of them" unless
		// they all already have it, in which case it means "take it away".
		const everyone = chosen.every((item) => item.properties?.labelIds?.includes(labelId));
		const before = chipRoomBefore(chosen.map((item) => item.id));
		for (const item of chosen) {
			const wears = item.properties?.labelIds?.includes(labelId);
			if (everyone === Boolean(wears)) board = toggleLabel(board, item.id, labelId);
		}
		keepChipRoom(before);
		scheduleSave();
	}

	function removeLabelFrom(itemId: string, labelId: string) {
		const before = chipRoomBefore([itemId]);
		board = toggleLabel(board, itemId, labelId);
		keepChipRoom(before);
		scheduleSave();
	}

	function writeProperty(key: 'status' | 'kind' | 'source' | 'tint', value: string | null) {
		const before = chipRoomBefore(chosen.map((item) => item.id));
		for (const item of chosen) board = setItemProperty(board, item.id, key, value);
		keepChipRoom(before);
		scheduleSave();
	}

	/** A property already shared by everything chosen, or null when they differ. */
	function sharedProperty(read: (item: WhiteboardItem) => string | null): string | null {
		if (!chosen.length) return null;
		const first = read(chosen[0]);
		return chosen.every((item) => read(item) === first) ? first : null;
	}

	function openDetails() {
		drawer = 'details';
		shortcutsOpen = false;
	}

	async function addLabelToItem(item: WhiteboardItem) {
		selectOnly(item.id);
		openDetails();
		await tick();
		document.getElementById('label-draft')?.focus();
	}

	function renameLabelTo(labelId: string, name: string) {
		board = renameLabel(board, labelId, name);
		scheduleSave();
	}

	function recolourLabel(labelId: string, tint: Tint) {
		board = retintLabel(board, labelId, tint);
		scheduleSave();
	}

	function dropLabel(labelId: string) {
		board = deleteLabel(board, labelId);
		scheduleSave();
	}

	// ── Portals ─────────────────────────────────────────────────────────────

	function wait(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * What each doorway on this board is showing. A portal stores only an id, so
	 * the miniature is read from the library rather than kept in the document —
	 * which is why a child board that changes is immediately right through the
	 * doorway, with nothing to keep in step.
	 */
	function refreshPreviews() {
		const next: Record<string, PortalPreview> = {};
		for (const boardId of new Set(portals(board.items).map((portal) => portal.boardId))) {
			const opened = boardLibrary.open(boardId);
			next[boardId] = opened
				? {
					title: opened.document.board.title,
					marks: minimapMarks(opened.document.items),
					bounds: documentBounds(opened.document),
					missing: false
				}
				: { title: '', marks: [], bounds: null, missing: true };
		}
		previews = next;
	}

	function previewFor(portal: PortalItem): PortalPreview | null {
		return previews[portal.boardId] ?? null;
	}

	function doorLabel(portal: PortalItem): string {
		return portalTitle(portal, previewFor(portal)?.title ?? null);
	}

	/** The child board's shapes, projected into the pane of the doorway. */
	function previewProjection(portal: PortalItem) {
		const extent = previewFor(portal)?.bounds ?? { x: 0, y: 0, width: 1, height: 1 };
		return minimapProjection(extent, { width: portal.width - 22, height: portal.height - 52 }, 5);
	}

	async function addPortalFromDock() {
		saveNow();
		const size = viewport();
		const at = screenToWorld(board.camera, { x: size.width / 2 - 115, y: size.height / 2 - 84 });
		const child = boardLibrary.create('New board');
		// `create` marks the child as the board to reopen. We are not going there
		// yet — this board is still the one being worked on.
		boardLibrary.setActiveId(board.board.id);
		const portal = createPortal(at.x, at.y, child.board.id, '', nextZ(board.items));
		setItems([...board.items, portal]);
		selectOnly(portal.id);
		refreshBoards();
		refreshPreviews();
		scheduleSave();
		await tick();
		document.getElementById(`portal-title-${portal.id}`)?.focus();
	}

	function pointPortal(portal: PortalItem, boardId: string) {
		updateItem(portal.id, { boardId } as Partial<WhiteboardItem>, true);
		refreshPreviews();
	}

	/**
	 * Through the doorway. The camera flies into the portal until it is past the
	 * edges of the screen, and the child arrives at the framing its miniature was
	 * showing — so the shapes you were flying toward are the shapes that greet
	 * you. That continuity is the whole of the illusion; without it this would be
	 * a page navigation with an animation in front of it.
	 */
	async function enterPortal(portal: PortalItem) {
		if (travelling) return;
		const opened = boardLibrary.open(portal.boardId);
		if (!opened) {
			refreshPreviews();
			notice = 'That board is no longer on the shelf.';
			return;
		}

		travelling = true;
		handHoldsTheCamera();
		saveNow();
		const resting = { ...board.camera };
		const flight = animateCamera(enterCamera(itemBounds(portal), viewport()));
		veil = 1;
		await wait(flight * 0.75);
		// The flight is still running. Left going, it would keep writing the camera
		// every frame and paint straight over the arrival.
		interruptCameraAnimation();

		const step: TrailStep = {
			boardId: board.board.id,
			title: board.board.title,
			camera: resting,
			portalId: portal.id
		};
		trail = pushTrail(trail, step);
		boardLibrary.writeTrail(trail);
		boardLibrary.setActiveId(portal.boardId);
		adoptDocument(opened.document, 'saved', 'saved here');
		board.camera = arrivalCamera(board, viewport());
		refreshPreviews();
		veil = 0;
		travelling = false;
	}

	/**
	 * Back up to a board on the trail. The child shrinks away, and the parent
	 * comes back framed on the doorway that was stepped through before easing out
	 * to where you were actually standing.
	 */
	async function climbTo(depth: number) {
		if (travelling) return;
		const climbed = popTrailTo(trail, depth);
		if (!climbed) return;
		const opened = boardLibrary.open(climbed.step.boardId);
		if (!opened) {
			trail = climbed.trail;
			boardLibrary.writeTrail(trail);
			notice = 'The board above is no longer on the shelf.';
			return;
		}

		travelling = true;
		handHoldsTheCamera();
		saveNow();
		const away = { ...board.camera, zoom: Math.max(0.1, board.camera.zoom * 0.4) };
		const flight = animateCamera(away);
		veil = 1;
		await wait(flight * 0.6);
		interruptCameraAnimation();

		trail = climbed.trail;
		boardLibrary.writeTrail(trail);
		boardLibrary.setActiveId(climbed.step.boardId);
		adoptDocument(opened.document, 'saved', 'saved here');
		refreshPreviews();

		const door = opened.document.items.find((item) => item.id === climbed.step.portalId);
		board.camera = door
			? returnCamera(boundsForItem(opened.document.items, door), climbed.step.camera, viewport())
			: climbed.step.camera;
		veil = 0;
		// Ease from the doorway back out to the view that was left behind.
		animateCamera(climbed.step.camera);
		travelling = false;
	}

	function climbOne() {
		if (trail.length) void climbTo(trail.length - 1);
	}

	// ── Search ──────────────────────────────────────────────────────────────

	async function openSearch(seed = '') {
		if (!searchOpen) searchReturn = { ...board.camera };
		searchOpen = true;
		searchText = seed;
		searchIndex = 0;
		drawer = null;
		shelfOpen = false;
		shortcutsOpen = false;
		handHoldsTheCamera();
		await tick();
		searchInput?.focus();
		searchInput?.select();
		if (seed) previewResult(0);
	}

	/** Moving through results flies the camera, without filling up the history. */
	function previewResult(index: number) {
		const hit = results[index];
		if (!hit) return;
		searchIndex = index;
		const camera = focusCamera(board.items, hit.item.id, viewport());
		if (camera) flyTo(camera, hit.title, false);
	}

	function stepResult(direction: -1 | 1) {
		if (!results.length) return;
		previewResult((searchIndex + direction + results.length) % results.length);
	}

	/**
	 * The board goes to the best result on its own, once typing settles. Flying
	 * on every keystroke would be thrash, not travel.
	 */
	function queueSearchPreview() {
		if (searchPreviewTimer) clearTimeout(searchPreviewTimer);
		searchPreviewTimer = setTimeout(() => {
			searchPreviewTimer = null;
			if (searchOpen && results.length) previewResult(0);
		}, 340);
	}

	/** Keeps the result you landed on, and makes it something Back can undo. */
	function commitSearch(index = searchIndex) {
		const hit = results[index];
		if (!hit) return;
		searchIndex = index;
		const camera = focusCamera(board.items, hit.item.id, viewport());
		if (camera && searchReturn) {
			// Rewind to where the search started so history records one move, from
			// there to here, rather than every result glanced at along the way.
			board.camera = { ...searchReturn };
			flyTo(camera, hit.title);
		}
		selectOnly(hit.item.id);
		closeSearch(false);
	}

	/** Pulls back far enough to hold every result at once. */
	function fitResults() {
		const bounds = hitsBounds(board.items, results);
		if (!bounds) return;
		if (searchReturn) board.camera = { ...searchReturn };
		flyTo(cameraForBounds(bounds, viewport(), 140, 1.2), `${results.length} results`);
		selectedIds = results.map((hit) => hit.item.id);
		closeSearch(false);
	}

	function closeSearch(restore = true) {
		if (searchPreviewTimer) clearTimeout(searchPreviewTimer);
		searchPreviewTimer = null;
		if (restore && searchReturn) animateCamera(searchReturn);
		searchOpen = false;
		searchText = '';
		searchIndex = 0;
		searchReturn = null;
	}

	function searchForLabel(label: Label) {
		void openSearch(`#${label.name}`);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			stepResult(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			stepResult(-1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (event.shiftKey) fitResults();
			else commitSearch();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeSearch();
		}
	}

	// ── The shelf: boards as a set, not a single canvas ─────────────────────

	function refreshBoards() {
		boards = boardLibrary.list();
	}

	function releaseImageUrls() {
		Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
		imageUrls = {};
		missingAssets = new Set();
	}

	/** Puts a board on screen, with none of the previous board left clinging on. */
	function adoptDocument(document: WhiteboardDocument, state: SaveState, message: string) {
		exitJourney();
		if (searchOpen) closeSearch(false);
		labelDraft = '';
		renamingLabelId = null;
		releaseImageUrls();
		board = restoreWhiteboard(document);
		selectedIds = [];
		connectorSourceId = null;
		renamingFrameId = null;
		tool = 'select';
		notice = '';
		marquee = null;
		frameDraft = null;
		history = createCameraHistory({ camera: { ...board.camera }, label: 'Where you were' });
		dirty = false;
		saveState = state;
		saveMessage = message;
		void hydrateImages();
	}

	function discardPendingSave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = null;
		dirty = false;
	}

	function openShelf() {
		saveNow();
		refreshBoards();
		shelfOpen = true;
	}

	function openBoard(id: string) {
		if (id === board.board.id) {
			shelfOpen = false;
			return;
		}
		saveNow();
		const opened = boardLibrary.open(id);
		if (!opened) {
			notice = 'That board is no longer on the shelf.';
			refreshBoards();
			return;
		}
		boardLibrary.setActiveId(id);
		// Opening a board from the shelf is not climbing out of anything, so the
		// trail does not survive it — you arrive at that board, not under it.
		trail = [];
		boardLibrary.writeTrail(trail);
		adoptDocument(
			opened.document,
			opened.source === 'backup' ? 'recovered' : 'saved',
			opened.source === 'backup' ? 'restored the last saved board' : 'saved here'
		);
		shelfOpen = false;
		refreshBoards();
		refreshPreviews();
	}

	async function startNewBoard() {
		saveNow();
		trail = [];
		boardLibrary.writeTrail(trail);
		adoptDocument(boardLibrary.create(), 'saved', 'saved here');
		shelfOpen = false;
		refreshBoards();
		refreshPreviews();
		await tick();
		document.getElementById('board-title')?.focus();
	}

	function closeBoard() {
		saveNow();
		refreshBoards();
		shelfOpen = true;
	}

	function duplicateBoard(id: string) {
		if (id === board.board.id) saveNow();
		const copy = boardLibrary.duplicate(id);
		if (!copy) return;
		refreshBoards();
		notice = `Copied as “${boardTitleFallback(copy.board.title)}”.`;
	}

	function deleteBoard(id: string) {
		const doomed = boardLibrary.open(id);
		const spokenFor = boardLibrary.referencedAssets(id);
		boardLibrary.remove(id);
		for (const item of doomed?.document.items ?? []) {
			if (item.type === 'image' && !spokenFor.has(item.assetId)) {
				void removeImageAsset(item.assetId).catch(() => undefined);
			}
		}
		confirmDeleteId = null;
		refreshBoards();
		// Doorways to it stay where they are and say they lead nowhere — the board
		// may come back, and the layout around them was arranged by hand.
		refreshPreviews();
		trail = trail.filter((step) => step.boardId !== id);
		boardLibrary.writeTrail(trail);
		if (id !== board.board.id) return;

		// The board under our feet just went. Don't let a queued save write it back.
		discardPendingSave();
		const next = boards[0] ? boardLibrary.open(boards[0].id) : null;
		if (next) {
			boardLibrary.setActiveId(next.document.board.id);
			adoptDocument(next.document, 'saved', 'saved here');
		} else {
			adoptDocument(boardLibrary.create(), 'saved', 'saved here');
			refreshBoards();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// Find is reachable from anywhere, including from inside a card.
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			void openSearch(searchOpen ? searchText : '');
			return;
		}
		if (event.code === 'Space' && !isTextTarget(event.target)) {
			spaceHeld = true;
			event.preventDefault();
		}
		if (isTextTarget(event.target)) return;

		if (event.key === '/') {
			event.preventDefault();
			void openSearch();
			return;
		}

		if (event.key === 'Escape') {
			if (searchOpen) {
				closeSearch();
				return;
			}
			if (playing) {
				exitJourney();
				return;
			}
			if (shelfOpen || drawer || shortcutsOpen) {
				shelfOpen = false;
				drawer = null;
				shortcutsOpen = false;
				confirmDeleteId = null;
				return;
			}
			tool = 'select';
			connectorSourceId = null;
			renamingFrameId = null;
			notice = '';
			cancelPointerSession();
			return;
		}

		// Camera history rides the platform's own back and forward gesture.
		if ((event.altKey || event.metaKey) && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
			event.preventDefault();
			travelHistory(event.key === 'ArrowLeft' ? -1 : 1);
			return;
		}
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			saveNow();
			return;
		}
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
			event.preventDefault();
			duplicateSelection();
			return;
		}
		if (event.metaKey || event.ctrlKey) return;

		if (playing) {
			if (event.key === 'ArrowRight') { event.preventDefault(); stepJourney(1); }
			if (event.key === 'ArrowLeft') { event.preventDefault(); stepJourney(-1); }
			if (event.key.toLowerCase() === 'p') { event.preventDefault(); paused ? resumeJourney() : pauseJourney(); }
			return;
		}

		if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length) {
			event.preventDefault();
			deleteSelection();
			return;
		}
		if (event.key === '[' || event.key === ']') {
			event.preventDefault();
			stepThroughFrames(event.key === '[' ? -1 : 1);
			return;
		}
		if (event.key === '0') {
			event.preventDefault();
			fitBoard();
			return;
		}
		if (/^[1-9]$/.test(event.key)) {
			event.preventDefault();
			jumpToFrame(Number(event.key) - 1);
			return;
		}
		if (event.key.toLowerCase() === 'h') {
			event.preventDefault();
			goHome();
			return;
		}
		if (event.key.toLowerCase() === 'p') {
			event.preventDefault();
			beginJourney();
			return;
		}
		if (event.key.toLowerCase() === 'm') {
			event.preventDefault();
			minimapOn = !minimapOn;
			return;
		}
		if (event.key.toLowerCase() === 'i' && chosen.length) {
			event.preventDefault();
			openDetails();
			return;
		}
		// The keyboard says what the drag says: move the card one column along.
		if (event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
			event.preventDefault();
			moveCardColumn(event.key === 'ArrowLeft' ? -1 : 1);
			return;
		}
		if (event.key === '?') {
			event.preventDefault();
			shortcutsOpen = !shortcutsOpen;
		}
	}

	function handleKeyup(event: KeyboardEvent) {
		if (event.code === 'Space') spaceHeld = false;
	}

	function releaseCanvasKeys() {
		spaceHeld = false;
	}

	function handlePaste(event: ClipboardEvent) {
		if (isTextTarget(event.target)) return;
		const image = [...(event.clipboardData?.files ?? [])].find((file) => file.type.startsWith('image/'));
		if (!image) return;
		event.preventDefault();
		const size = viewport();
		void addImageFile(image, screenToWorld(board.camera, { x: size.width / 2, y: size.height / 2 }));
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		fileDragging = false;
		const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith('image/'));
		if (!files.length) return;
		const point = pointForEvent(event);
		void Promise.all(files.map((file, index) => addImageFile(file, { x: point.x + index * 26, y: point.y + index * 26 })));
	}

	function handleFrameTitleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			renamingFrameId = null;
			(event.currentTarget as HTMLInputElement).blur();
		}
		if (event.key === 'Escape') {
			renamingFrameId = null;
			(event.currentTarget as HTMLInputElement).blur();
		}
	}

	function zoomLabel(): string {
		return `${Math.round(board.camera.zoom * 100)}%`;
	}

	function handleMinimapPointer(event: PointerEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const point = mapProjection.toWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top });
		handHoldsTheCamera();
		flyTo(cameraCentredOn(point, board.camera, viewport()), 'Overview');
	}

	/** The 1–9 a frame answers to, or empty once the sequence runs past nine. */
	function frameKey(id: string): string {
		const position = sequence.findIndex((frame) => frame.id === id);
		return position >= 0 && position < 9 ? String(position + 1) : '';
	}

	function relativeWhen(iso: string): string {
		const then = new Date(iso).getTime();
		if (!Number.isFinite(then)) return '';
		const minutes = Math.round((Date.now() - then) / 60_000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours} hr ago`;
		const days = Math.round(hours / 24);
		return days < 30 ? `${days} d ago` : new Date(then).toLocaleDateString();
	}

	function boardCountLabel(entry: BoardSummary): string {
		const pieces = [`${entry.items} ${entry.items === 1 ? 'thing' : 'things'}`];
		if (entry.frames) pieces.push(`${entry.frames} ${entry.frames === 1 ? 'frame' : 'frames'}`);
		return pieces.join(' · ');
	}
</script>

<svelte:head>
	<title>{board.board.title} · Whiteboard · woodles.space</title>
</svelte:head>

<svelte:window
	onkeydown={handleKeydown}
	onkeyup={handleKeyup}
	onpaste={handlePaste}
	onpointercancel={cancelPointerSession}
	onblur={releaseCanvasKeys}
/>

<main
	bind:this={canvasEl}
	class:space-panning={spaceHeld}
	class:file-dragging={fileDragging}
	class="whiteboard"
	aria-label="Whiteboard canvas"
	onpointerdown={handleCanvasPointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onwheel={handleWheel}
	ondblclick={handleCanvasDoubleClick}
	ondragover={(event) => { event.preventDefault(); fileDragging = true; }}
	ondragleave={() => (fileDragging = false)}
	ondrop={handleDrop}
>
	<div class="world" style={worldStyle()}>
		<svg class="connector-layer" width="1" height="1">
			<defs>
				<marker id="connector-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
					<path d="M 0 0 L 10 5 L 0 10 z" />
				</marker>
			</defs>
			{#each connectors as connector (connector.id)}
				{@const endpoints = connectorEndpoints(board.items, connector)}
				{#if endpoints}
					<path
						class="connector-hit-area"
						d={`M ${endpoints.from.x} ${endpoints.from.y} L ${endpoints.to.x} ${endpoints.to.y}`}
						role="button"
						tabindex="0"
						aria-label="Select connector"
						onpointerdown={(event) => handleConnectorPointerDown(event, connector)}
						onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectOnly(connector.id); } }}
					/>
					<path
						aria-hidden="true"
						class:selected-line={isSelected(connector.id)}
						class="connector-path"
						d={`M ${endpoints.from.x} ${endpoints.from.y} L ${endpoints.to.x} ${endpoints.to.y}`}
						marker-end={connector.arrow ? 'url(#connector-arrow)' : undefined}
					/>
				{/if}
			{/each}
		</svg>

		{#each objects as item (item.id)}
			{#if item.type === 'frame'}
				<section
					data-whiteboard-object
					class:selected={isSelected(item.id)}
					class:dragging={draggingIds.includes(item.id)}
					class:found={matchIds.has(item.id)}
					class="board-item frame tint-{item.tint}"
					style={itemStyle(item)}
					role="group"
					aria-label={`Frame: ${item.title || 'Untitled frame'}`}
					onpointerdown={(event) => handleItemPointerDown(event, item)}
					ondblclick={(event) => handleItemDoubleClick(event, item)}
				>
					<div class="frame-corner top-left"></div>
					<div class="frame-corner top-right"></div>
					<div class="frame-corner bottom-left"></div>
					<div class="frame-corner bottom-right"></div>
					<div class="frame-label">
						{#if renamingFrameId === item.id}
							<input
								id={`frame-title-${item.id}`}
								aria-label="Frame title"
								value={item.title}
								onpointerdown={(event) => handleEditablePointerDown(event, item)}
								oninput={(event) => updateFrame(item, (event.currentTarget as HTMLInputElement).value)}
								onkeydown={(event) => { handleEditableKeydown(event); handleFrameTitleKeydown(event); }}
								onblur={() => (renamingFrameId = null)}
							/>
						{:else}
							<button
								data-whiteboard-ui
								class="frame-title"
								onpointerdown={(event) => { event.stopPropagation(); if (tool === 'line') { event.preventDefault(); connectTo(item); } }}
								onclick={() => { if (tool !== 'line') focusFrame(item); }}
								ondblclick={(event) => { event.stopPropagation(); renamingFrameId = item.id; void tick().then(() => document.getElementById(`frame-title-${item.id}`)?.focus()); }}
							>{item.title || 'Untitled frame'}</button>
						{/if}
						{#each chipsFor(item) as label (label.id)}
							<button data-whiteboard-ui class="label-chip tint-{label.tint}" title={`Find everything labelled ${label.name}`} onpointerdown={stopChipPointer} onclick={() => searchForLabel(label)}>{label.name}</button>
						{/each}
					</div>
					{#if isSelected(item.id)}
						<button data-whiteboard-ui class="resize-handle" aria-label="Resize frame" onpointerdown={(event) => startResize(event, item)}></button>
					{/if}
				</section>
			{:else if item.type === 'stack'}
				<section
					data-whiteboard-object
					class:selected={isSelected(item.id)}
					class:dragging={draggingIds.includes(item.id)}
					class:drop-target={dropStackId === item.id}
					class:found={matchIds.has(item.id)}
					class="board-item stack tint-{colorOf(item) ?? 'none'} does-{behaviorOf(item)}"
					style={itemStyle(item)}
					role="group"
					aria-label={`${behaviorOf(item) === 'plain' ? 'Stack' : `${behaviorOf(item)} stack`}: ${item.title || 'Untitled stack'}`}
					onpointerdown={(event) => handleItemPointerDown(event, item)}
					ondblclick={(event) => handleItemDoubleClick(event, item)}
				>
					<div class="stack-header">
						<span class="stack-grip" aria-hidden="true">⋮⋮</span>
						<input
							id={`stack-title-${item.id}`}
							aria-label="Stack title"
							value={item.title}
							onpointerdown={(event) => handleEditablePointerDown(event, item)}
							oninput={(event) => updateStack(item, (event.currentTarget as HTMLInputElement).value)}
							onkeydown={handleEditableKeydown}
						/>
						{#if behaviorOf(item) !== 'plain'}
							<span class="stack-mode" title={BEHAVIOR_NOTES[behaviorOf(item)]}>{behaviorOf(item)}</span>
						{/if}
						<span class="stack-count">{stackCountLabel(item)}</span>
					</div>
					{#if behaviorOf(item) === 'queue' && item.cardIds.length}
						<button
							data-whiteboard-ui
							class="queue-take"
							title="Take the top card out and set it down beside the stack"
							onpointerdown={stopChipPointer}
							onclick={() => takeTop(item.id)}
						>take “{itemLabel(queueHeads(board.items, item).now ?? item)}”</button>
					{/if}
					{#if chipsFor(item).length}
						<div class="chip-row stack-chips" data-whiteboard-ui>
							{#each chipsFor(item) as label (label.id)}
								<button class="label-chip tint-{label.tint}" title={`Find everything labelled ${label.name}`} onpointerdown={stopChipPointer} onclick={() => searchForLabel(label)}>{label.name}</button>
							{/each}
						</div>
					{/if}
					{#if item.cardIds.length === 0}
						<p class="stack-empty">drag a card in</p>
					{/if}
					{#if isSelected(item.id)}
						<button data-whiteboard-ui class="resize-handle" aria-label="Resize stack" onpointerdown={(event) => startResize(event, item)}></button>
					{/if}
				</section>
			{:else if item.type === 'card'}
				{@const chips = chipsFor(item)}
				<section
					data-whiteboard-object
					class:selected={isSelected(item.id)}
					class:dragging={draggingIds.includes(item.id)}
					class:in-stack={Boolean(item.stackId)}
					class:found={matchIds.has(item.id)}
					class:tile={cardMode(item) === 'gallery'}
					class:ticked={cardMode(item) === 'checklist' && isDone(item)}
					class="board-item card tint-{colorOf(item) ?? 'none'} laid-{cardMode(item) ?? 'free'}"
					style={itemStyle(item)}
					role="group"
					aria-label={`Card: ${item.title || 'Untitled card'}`}
					onpointerdown={(event) => handleItemPointerDown(event, item)}
					ondblclick={(event) => handleItemDoubleClick(event, item)}
				>
					{#if cardMode(item) === 'checklist'}
						<button
							data-whiteboard-ui
							class:on={isDone(item)}
							class="tick"
							aria-label={isDone(item) ? `Untick ${itemLabel(item)}` : `Tick off ${itemLabel(item)}`}
							aria-pressed={isDone(item)}
							onpointerdown={stopChipPointer}
							onclick={() => tickCard(item)}
						><span aria-hidden="true">✓</span></button>
					{:else}
						<div class="card-topline" aria-hidden="true"></div>
					{/if}
					{#if queueRank(item)}
						<span class="queue-badge {queueRank(item)}">{queueRank(item)}</span>
					{/if}
					<span class="card-grip" aria-hidden="true">⠿</span>
					{#if kindOf(item)}
						<p class="card-kind">{kindOf(item)}</p>
					{/if}
					<input
						class="card-title"
						aria-label="Card title"
						placeholder="title"
						value={item.title}
						onpointerdown={(event) => handleEditablePointerDown(event, item)}
						oninput={(event) => updateCard(item, 'title', (event.currentTarget as HTMLInputElement).value)}
						onkeydown={handleEditableKeydown}
					/>
					<textarea
						id={`card-body-${item.id}`}
						class="card-body"
						aria-label="Card text"
						placeholder="Start anywhere…"
						value={item.body}
						onpointerdown={(event) => handleEditablePointerDown(event, item)}
						oninput={(event) => updateCard(item, 'body', (event.currentTarget as HTMLTextAreaElement).value)}
						onkeydown={handleEditableKeydown}
					></textarea>
					{#if chips.length || statusOf(item) || sourceOf(item) || isSelected(item.id)}
						<div class="chip-row" data-whiteboard-ui>
							{#if statusOf(item)}
								<span class="status-chip {statusOf(item)}" title={`Status: ${statusOf(item)}`}><i aria-hidden="true"></i>{statusOf(item)}</span>
							{/if}
							{#each chips as label (label.id)}
								<button class="label-chip tint-{label.tint}" title={`Find everything labelled ${label.name}`} onpointerdown={stopChipPointer} onclick={() => searchForLabel(label)}>{label.name}</button>
							{/each}
							{#if sourceOf(item)}
								<span class="source-mark" title={`Source: ${sourceOf(item)}`} aria-label={`Source: ${sourceOf(item)}`}>↗</span>
							{/if}
							{#if isSelected(item.id)}
								<button class="chip-add" title="Label this card (I)" aria-label="Add a label to this card" onpointerdown={stopChipPointer} onclick={() => addLabelToItem(item)}>＋</button>
							{/if}
						</div>
					{/if}
					{#if isSelected(item.id)}
						<button data-whiteboard-ui class="resize-handle" aria-label="Resize card" onpointerdown={(event) => startResize(event, item)}></button>
					{/if}
				</section>
			{:else if item.type === 'portal'}
				{@const preview = previewFor(item)}
				{@const projection = previewProjection(item)}
				<section
					data-whiteboard-object
					class:selected={isSelected(item.id)}
					class:dragging={draggingIds.includes(item.id)}
					class:found={matchIds.has(item.id)}
					class:missing={preview?.missing}
					class:loops={trailHasBoard(trail, item.boardId)}
					class="board-item portal"
					style={itemStyle(item)}
					role="group"
					aria-label={`Way through to ${doorLabel(item)}`}
					onpointerdown={(event) => handleItemPointerDown(event, item)}
					ondblclick={(event) => { event.stopPropagation(); if (tool === 'select' && !preview?.missing) void enterPortal(item); }}
				>
					<div class="portal-pane" aria-hidden="true">
						{#if preview?.missing}
							<p class="portal-gone">this board is gone</p>
						{:else if preview?.marks.length}
							{#each preview.marks as mark (mark.id)}
								{@const box = projection.project(mark.bounds)}
								<span class="door-mark mark-{mark.kind}" style={`left: ${box.x}px; top: ${box.y}px; width: ${box.width}px; height: ${box.height}px;`}></span>
							{/each}
						{:else}
							<p class="portal-empty">nothing here yet</p>
						{/if}
					</div>
					<div class="portal-foot">
						<input
							id={`portal-title-${item.id}`}
							class="portal-title"
							aria-label="Portal name"
							placeholder={preview?.title || 'Name this way through'}
							value={item.title}
							onpointerdown={(event) => handleEditablePointerDown(event, item)}
							oninput={(event) => updateItem(item.id, { title: (event.currentTarget as HTMLInputElement).value } as Partial<WhiteboardItem>, true)}
							onkeydown={handleEditableKeydown}
						/>
						{#if !preview?.missing}
							<button
								data-whiteboard-ui
								class="portal-go"
								title={`Go into ${doorLabel(item)}`}
								aria-label={`Go into ${doorLabel(item)}`}
								onpointerdown={stopChipPointer}
								onclick={() => void enterPortal(item)}
							>→</button>
						{/if}
					</div>
					{#if isSelected(item.id)}
						<button data-whiteboard-ui class="resize-handle" aria-label="Resize portal" onpointerdown={(event) => startResize(event, item)}></button>
					{/if}
				</section>
			{:else if item.type === 'image'}
				<section
					data-whiteboard-object
					class:selected={isSelected(item.id)}
					class:dragging={draggingIds.includes(item.id)}
					class:found={matchIds.has(item.id)}
					class="board-item image-card"
					style={itemStyle(item)}
					role="group"
					aria-label={`Image: ${item.name || 'Board image'}`}
					onpointerdown={(event) => handleItemPointerDown(event, item)}
					ondblclick={(event) => handleItemDoubleClick(event, item)}
				>
					{#if imageUrls[item.assetId]}
						<img src={imageUrls[item.assetId]} alt={item.name || 'Board image'} draggable="false" />
					{:else}
						<div class="missing-image">
							<span aria-hidden="true">◇</span>
							<p>{missingAssets.has(item.assetId) ? 'image kept its place' : 'placing image…'}</p>
						</div>
					{/if}
					{#if chipsFor(item).length}
						<div class="chip-row image-chips" data-whiteboard-ui>
							{#each chipsFor(item) as label (label.id)}
								<button class="label-chip tint-{label.tint}" title={`Find everything labelled ${label.name}`} onpointerdown={stopChipPointer} onclick={() => searchForLabel(label)}>{label.name}</button>
							{/each}
						</div>
					{/if}
					{#if isSelected(item.id)}
						<button data-whiteboard-ui class="resize-handle" aria-label="Resize image" onpointerdown={(event) => startResize(event, item)}></button>
					{/if}
				</section>
			{/if}
		{/each}

		{#if marquee}
			<div class="marquee" style={`transform: translate3d(${marquee.x}px, ${marquee.y}px, 0); width: ${marquee.width}px; height: ${marquee.height}px;`}></div>
		{/if}
		{#if frameDraft}
			<div class="frame-draft" style={`transform: translate3d(${frameDraft.x}px, ${frameDraft.y}px, 0); width: ${frameDraft.width}px; height: ${frameDraft.height}px;`}></div>
		{/if}
	</div>

	{#if !hasContent && !shelfOpen}
		<div class="empty-whisper" aria-hidden="true">
			<span class="empty-mark">✦</span>
			<p>double-click anywhere to begin</p>
			<small>drag images in · hold Space to move · frame a region to name a place</small>
		</div>
	{/if}

	<div class="top-deck">
	<header class:hidden={playing} class="topbar" data-whiteboard-ui>
		<a class="back-link" href="/" aria-label="Back to Woodles">←</a>
		<div class="board-name">
			<span>Whiteboard</span>
			<input
				id="board-title"
				aria-label="Whiteboard title"
				placeholder="Untitled whiteboard"
				value={board.board.title}
				oninput={(event) => { board.board.title = (event.currentTarget as HTMLInputElement).value; board.updatedAt = now(); scheduleSave(); }}
			/>
		</div>
		<p class:warning={saveState === 'error'} class="save-status" aria-live="polite">
			<span class:working={saveState === 'saving'} class="save-dot"></span>{saveMessage}
		</p>
		<div class="board-actions">
			<button class="chip" title="Save now (⌘S)" onclick={() => { markDirty(); saveNow(); }}>Save</button>
			<button class="chip" title="Save and put this board back on the shelf" onclick={closeBoard}>Close</button>
			<button class:active={shelfOpen} class="chip strong" aria-expanded={shelfOpen} onclick={() => (shelfOpen ? (shelfOpen = false) : openShelf())}>
				Boards<span class="chip-count">{boards.length || 1}</span>
			</button>
		</div>
	</header>

	<nav class:hidden={playing || searchOpen} class="location-bar" data-whiteboard-ui aria-label="Board location">
		{#if trail.length}
			<button class="climb-out" title={`Back out to ${trail[trail.length - 1].title || 'the board above'}`} aria-label="Back out one board" onclick={climbOne}>↰</button>
		{/if}
		<div class="history-pair">
			<button disabled={!canGoBack(history)} aria-label="Back to the previous view" title="Back (⌥←)" onclick={() => travelHistory(-1)}>‹</button>
			<button disabled={!canGoForward(history)} aria-label="Forward to the next view" title="Forward (⌥→)" onclick={() => travelHistory(1)}>›</button>
		</div>
		<ol class="breadcrumb">
			{#each crumbs as crumb, index (index)}
				<li>
					{#if index > 0}<span class="crumb-arrow" aria-hidden="true">/</span>{/if}
					{#if crumb.kind === 'board'}
						<button class="crumb above" title={`Back out to ${crumb.label}`} onclick={() => void climbTo(crumb.depth)}>{crumb.label}</button>
					{:else if crumb.kind === 'here'}
						<button class="crumb root" title="Fit the whole board (0)" onclick={fitBoard}>{crumb.label}</button>
					{:else}
						<button class:current={crumb.id === here?.id} class="crumb" onclick={() => { const frame = board.items.find((item) => item.id === crumb.id); if (frame?.type === 'frame') focusFrame(frame); }}>{crumb.label}</button>
					{/if}
				</li>
			{/each}
		</ol>
		<span class="scale-word" title={`${zoomLabel()} — ${sequence.length} ${sequence.length === 1 ? 'frame' : 'frames'} on this board`}>{scaleName(board.camera.zoom)}</span>
		<div class="frame-steps">
			<button disabled={!sequence.length} aria-label="Previous frame" title="Previous frame ([)" onclick={() => stepThroughFrames(-1)}>◂</button>
			<button disabled={!sequence.length} aria-label="Next frame" title="Next frame (])" onclick={() => stepThroughFrames(1)}>▸</button>
		</div>
	</nav>

	<div class:hidden={playing || searchOpen} class="rail" data-whiteboard-ui aria-label="Places and journeys">
		<button class="rail-button" title="Home — the view this board opens to (H)" onclick={goHome}><span aria-hidden="true">⌂</span>Home</button>
		<button class="rail-button" title="Find anything on this board (/)" onclick={() => void openSearch()}><span aria-hidden="true">⌕</span>Find</button>
		<button class:active={drawer === 'places'} class="rail-button" aria-pressed={drawer === 'places'} title="Saved views and frames" onclick={() => (drawer = drawer === 'places' ? null : 'places')}><span aria-hidden="true">◈</span>Places</button>
		<button class:active={drawer === 'journey'} class="rail-button" aria-pressed={drawer === 'journey'} title="Arrange a journey through the board" onclick={() => (drawer = drawer === 'journey' ? null : 'journey')}><span aria-hidden="true">⇉</span>Journey</button>
		<button class="rail-button play" title="Play the journey (P)" onclick={() => beginJourney()}><span aria-hidden="true">▶</span>Play</button>
	</div>
	</div>

	{#if searchOpen}
		<div class="finder" data-whiteboard-ui>
			<div class="finder-field">
				<span class="finder-mark" aria-hidden="true">⌕</span>
				<input
					bind:this={searchInput}
					aria-label="Find on this board"
					placeholder="Find a card, a label, anything…"
					value={searchText}
					oninput={(event) => { searchText = (event.currentTarget as HTMLInputElement).value; searchIndex = 0; queueSearchPreview(); }}
					onkeydown={handleSearchKeydown}
				/>
				{#if results.length}
					<button class="chip quiet" title="Pull back to show every result (⇧↵)" onclick={fitResults}>Show all {results.length}</button>
				{/if}
				<button class="finder-close" aria-label="Close find" onclick={() => closeSearch()}>×</button>
			</div>
			{#if searchText.trim()}
				{#if results.length}
					<ul class="finder-results">
						{#each results.slice(0, 40) as hit, index (hit.item.id)}
							<li>
								<button
									class:current={index === searchIndex}
									class="finder-result"
									onpointerenter={() => (searchIndex = index)}
									onclick={() => commitSearch(index)}
								>
									<span class="finder-kind" aria-hidden="true">{hit.item.type === 'frame' ? '▢' : hit.item.type === 'stack' ? '▤' : hit.item.type === 'image' ? '▧' : '□'}</span>
									<span class="finder-text">
										<strong>{hit.title}</strong>
										<small>{hit.snippet}</small>
									</span>
									{#each hit.labels.slice(0, 3) as label (label.id)}
										<span class="label-chip tint-{label.tint} tiny">{label.name}</span>
									{/each}
									<span class="finder-where">{hit.field}</span>
								</button>
							</li>
						{/each}
					</ul>
					<p class="finder-hint">↑↓ to travel · ↵ to stay · ⇧↵ to see them all · esc to come back</p>
				{:else}
					<p class="finder-empty">Nothing on this board answers to that.</p>
				{/if}
			{:else}
				<p class="finder-hint">Type to search titles, text, labels, type, status and source. Start with <code>#</code> to search labels alone.</p>
			{/if}
		</div>
	{/if}

	{#if drawer && !playing}
		<aside class="drawer" data-whiteboard-ui aria-label={drawer === 'places' ? 'Places on this board' : drawer === 'details' ? 'What is known about the chosen objects' : 'The journey through this board'}>
			<header class="drawer-head">
				<div class="drawer-tabs">
					<button class:active={drawer === 'places'} onclick={() => (drawer = 'places')}>Places</button>
					<button class:active={drawer === 'journey'} onclick={() => (drawer = 'journey')}>Journey</button>
					<button class:active={drawer === 'details'} onclick={() => (drawer = 'details')}>Details{#if chosen.length > 1}<span class="tab-count">{chosen.length}</span>{/if}</button>
				</div>
				<button class="drawer-close" aria-label="Close panel" onclick={() => (drawer = null)}>×</button>
			</header>

			{#if drawer === 'places'}
				<div class="drawer-body">
					<section>
						<h3>Home</h3>
						<p class="drawer-note">{board.home ? 'This board opens to a view you chose.' : 'This board opens to whatever fits.'}</p>
						<div class="row-buttons">
							<button class="chip" onclick={setHome}>Set home to this view</button>
							{#if board.home}
								<button class="chip quiet" onclick={clearHome}>Clear</button>
							{/if}
						</div>
					</section>

					<section>
						<h3>Saved views</h3>
						{#if board.viewpoints.length}
							<ul class="place-list">
								{#each board.viewpoints as viewpoint (viewpoint.id)}
									<li>
										{#if renamingViewpointId === viewpoint.id}
											<input
												class="place-rename"
												aria-label="View name"
												value={viewpoint.name}
												oninput={(event) => renameViewpoint(viewpoint.id, (event.currentTarget as HTMLInputElement).value)}
												onblur={() => (renamingViewpointId = null)}
												onkeydown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') (event.currentTarget as HTMLInputElement).blur(); }}
											/>
										{:else}
											<button class="place-name" onclick={() => goToViewpoint(viewpoint)}>
												<span>{viewpoint.name}</span>
												<small>{Math.round(viewpoint.camera.zoom * 100)}%</small>
											</button>
										{/if}
										<button
											class:on={hasStop(board, { kind: 'viewpoint', id: viewpoint.id })}
											class="place-add"
											title="Add this view to the journey"
											aria-label={`Add ${viewpoint.name} to the journey`}
											onclick={() => toggleStop({ kind: 'viewpoint', id: viewpoint.id })}
										>⇉</button>
										<button class="place-edit" aria-label={`Rename ${viewpoint.name}`} onclick={() => { renamingViewpointId = viewpoint.id; void tick().then(() => (window.document.querySelector('.place-rename') as HTMLInputElement | null)?.focus()); }}>✎</button>
										<button class="place-drop" aria-label={`Delete ${viewpoint.name}`} onclick={() => deleteViewpoint(viewpoint.id)}>×</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="drawer-note">No saved views yet. Frame something you will want to come back to.</p>
						{/if}
						<div class="row-buttons">
							<input
								class="place-input"
								aria-label="Name for this view"
								placeholder="Name this view"
								bind:value={newViewpointName}
								onkeydown={(event) => { if (event.key === 'Enter') saveViewpointHere(); }}
							/>
							<button class="chip strong" onclick={saveViewpointHere}>Save view</button>
						</div>
					</section>

					<section>
						<h3>Frames</h3>
						{#if sequence.length}
							<ul class="place-list">
								{#each sequence as frame (frame.id)}
									<li>
										<button class:current={frame.id === here?.id} class="place-name" onclick={() => focusFrame(frame)}>
											<span>{frameTitle(frame)}</span>
											{#if frameKey(frame.id)}<small class="key">{frameKey(frame.id)}</small>{/if}
										</button>
										<button
											class:on={hasStop(board, { kind: 'item', id: frame.id })}
											class="place-add"
											title="Add this frame to the journey"
											aria-label={`Add ${frameTitle(frame)} to the journey`}
											onclick={() => toggleStop({ kind: 'item', id: frame.id })}
										>⇉</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="drawer-note">Draw a frame to give the board named places. Frames are what the keyboard walks between.</p>
						{/if}
					</section>
				</div>
			{:else if drawer === 'details'}
				<div class="drawer-body">
					{#if !chosen.length}
						<p class="drawer-empty">Choose something on the board. Anything you say about it stays optional — a card with nothing said about it is still just a card.</p>
					{:else}
						<section>
							<h3>{only ? itemLabel(only) : `${chosen.length} chosen`}</h3>
							<p class="drawer-note">
								{#if only}{only.type}{propertyCount(only) ? ` · ${propertyCount(only)} things said about it` : ''}{:else}What you say here goes to all of them.{/if}
							</p>
						</section>

						{#if only && isPortal(only)}
						<section>
							<h3>Where this goes</h3>
							{#if previewFor(only)?.missing}
								<p class="drawer-note">This doorway points at a board that is no longer on the shelf. Choose another below, or delete the doorway.</p>
							{:else}
								<div class="row-buttons">
									<button class="chip strong" onclick={() => void enterPortal(only)}>Go into “{doorLabel(only)}”</button>
								</div>
							{/if}
							<ul class="place-list door-targets">
								{#each boards as entry (entry.id)}
									<li>
										<button class:current={entry.id === only.boardId} class="place-name" onclick={() => pointPortal(only, entry.id)}>
											<span>{boardTitleFallback(entry.title)}</span>
											<small>{boardCountLabel(entry)}</small>
										</button>
									</li>
								{/each}
							</ul>
							{#if trailHasBoard(trail, only.boardId)}
								<p class="drawer-note">This leads back to a board you came through. Going in is allowed — it just goes round.</p>
							{/if}
						</section>
					{/if}

					{#if only && isStack(only)}
							<section>
								<h3>What this stack does</h3>
								<div class="row-buttons">
									{#each STACK_BEHAVIORS as behavior (behavior)}
										<button
											class:active={behaviorOf(only) === behavior}
											class="chip"
											onclick={() => changeBehavior(only.id, behavior)}
										>{behavior}</button>
									{/each}
								</div>
								<p class="drawer-note behavior-note">{BEHAVIOR_NOTES[behaviorOf(only)]}</p>
								{#if behaviorOf(only) === 'status'}
									<div class="row-buttons">
										<button class="chip strong" onclick={() => addColumnBeside(only)}>Add a column beside this</button>
									</div>
									<p class="drawer-note">Four of these side by side is a board. Nothing new is created — they are still stacks on the same canvas.</p>
								{:else if behaviorOf(only) === 'queue'}
									<div class="row-buttons">
										<button class="chip strong" disabled={!only.cardIds.length} onclick={() => takeTop(only.id)}>Take the top card</button>
									</div>
								{:else if behaviorOf(only) === 'checklist'}
									<p class="drawer-note">{checklistProgress(board.items, only).done} of {checklistProgress(board.items, only).total} ticked.</p>
								{/if}
							</section>
						{/if}

						<section>
							<h3>Labels</h3>
							{#if only && chipsFor(only).length}
								<div class="chip-row inline">
									{#each chipsFor(only) as label (label.id)}
										<button class="label-chip tint-{label.tint} removable" title={`Take ${label.name} off`} onclick={() => removeLabelFrom(only.id, label.id)}>{label.name}<i aria-hidden="true">×</i></button>
									{/each}
								</div>
							{/if}
							<div class="row-buttons">
								<input
									id="label-draft"
									class="place-input"
									aria-label="Add a label"
									placeholder="Type a label…"
									bind:value={labelDraft}
									onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyLabelDraft(); } }}
								/>
								<button class="chip strong" onclick={applyLabelDraft}>Add</button>
							</div>
							{#if suggestLabels(board, only, labelDraft).length}
								<div class="chip-row inline suggestions">
									{#each suggestLabels(board, only, labelDraft).slice(0, 12) as label (label.id)}
										<button class="label-chip tint-{label.tint} ghost" onclick={() => toggleLabelOnSelection(label.id)}>{label.name}</button>
									{/each}
								</div>
							{/if}
						</section>

						<section>
							<h3>Status</h3>
							<div class="row-buttons">
								{#each SUGGESTED_STATUSES as status (status)}
									<button
										class:active={sharedProperty(statusOf) === status}
										class="chip status-pick {status}"
										onclick={() => writeProperty('status', sharedProperty(statusOf) === status ? null : status)}
									><i aria-hidden="true"></i>{status}</button>
								{/each}
							</div>
							<input
								class="place-input wide status-free"
								aria-label="Status"
								placeholder="or a word of your own…"
								value={sharedProperty(statusOf) ?? ''}
								oninput={(event) => writeProperty('status', (event.currentTarget as HTMLInputElement).value)}
							/>
							{#if only?.type === 'card' && homeStack(only) && behaviorOf(homeStack(only)!) === 'status'}
								<p class="drawer-note">Held by “{homeStack(only)!.title.trim() || 'an unnamed stack'}”, which sets this. Drag the card to another column to change it.</p>
							{/if}
						</section>

						<section>
							<h3>Type</h3>
							<input
								class="place-input wide"
								aria-label="Type"
								placeholder="note, question, reference…"
								value={sharedProperty(kindOf) ?? ''}
								oninput={(event) => writeProperty('kind', (event.currentTarget as HTMLInputElement).value)}
							/>
						</section>

						<section>
							<h3>Source</h3>
							<input
								class="place-input wide"
								aria-label="Source"
								placeholder="a link, a book, a conversation…"
								value={sharedProperty(sourceOf) ?? ''}
								oninput={(event) => writeProperty('source', (event.currentTarget as HTMLInputElement).value)}
							/>
							{#if only && sourceOf(only) && sourceLink(sourceOf(only)!)}
								<a class="source-link" href={sourceLink(sourceOf(only)!)} target="_blank" rel="noreferrer noopener">{sourceLabel(sourceOf(only)!)} ↗</a>
							{/if}
						</section>

						<section>
							<h3>Color</h3>
							<div class="swatches">
								{#each TINTS as tint (tint)}
									<button
										class:active={sharedProperty(colorOf) === tint}
										class="swatch tint-{tint}"
										aria-label={tint}
										title={tint}
										onclick={() => writeProperty('tint', sharedProperty(colorOf) === tint ? null : tint)}
									></button>
								{/each}
							</div>
						</section>

						{#if only}
							<section>
								<h3>When</h3>
								<dl class="stamps">
									<dt>Created</dt><dd>{formatStamp(only.createdAt)}</dd>
									<dt>Updated</dt><dd>{formatStamp(only.updatedAt)}</dd>
								</dl>
							</section>
						{/if}
					{/if}
					{#if board.labels.length}
						<section>
							<h3>Labels on this board</h3>
							<p class="drawer-note">Organization that does not depend on where a thing sits.</p>
							<ul class="place-list">
								{#each board.labels as label (label.id)}
									<li>
										{#if renamingLabelId === label.id}
											<input
												class="place-rename"
												aria-label="Label name"
												value={label.name}
												oninput={(event) => renameLabelTo(label.id, (event.currentTarget as HTMLInputElement).value)}
												onblur={() => (renamingLabelId = null)}
												onkeydown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') (event.currentTarget as HTMLInputElement).blur(); }}
											/>
										{:else}
											<button class="place-name" onclick={() => searchForLabel(label)}>
												<span class="label-chip tint-{label.tint}">{label.name}</span>
												<small>{labelCount(board, label.id)}</small>
											</button>
										{/if}
										<button class="place-edit" aria-label={`Rename ${label.name}`} onclick={() => { renamingLabelId = label.id; void tick().then(() => (window.document.querySelector('.place-rename') as HTMLInputElement | null)?.focus()); }}>✎</button>
										<button class="place-drop" aria-label={`Delete ${label.name}`} onclick={() => dropLabel(label.id)}>×</button>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				</div>
			{:else}
				<div class="drawer-body">
					<section>
						<p class="drawer-note">A journey is an order to see this board in. Press Play and the camera walks it.</p>
						{#if stops.length}
							<ol class="stop-list">
								{#each stops as entry, index (entry.stop.id)}
									<li class:playing={playing && index === playIndex}>
										<span class="stop-number">{index + 1}</span>
										<button class="stop-name" onclick={() => beginJourney(index)}>
											<span>{entry.label}</span>
											<small>{entry.kind === 'board' ? 'the whole board' : entry.kind === 'viewpoint' ? 'saved view' : 'on the board'}</small>
										</button>
										<label class="stop-hold">
											<input
												type="number"
												min="1"
												max="30"
												aria-label={`Seconds to rest at ${entry.label}`}
												value={entry.stop.hold}
												oninput={(event) => { board = setStopHold(board, entry.stop.id, Number((event.currentTarget as HTMLInputElement).value)); scheduleSave(); }}
											/>s
										</label>
										<div class="stop-move">
											<button disabled={index === 0} aria-label="Move this stop earlier" onclick={() => { board = moveStop(board, entry.stop.id, -1); scheduleSave(); }}>▴</button>
											<button disabled={index === stops.length - 1} aria-label="Move this stop later" onclick={() => { board = moveStop(board, entry.stop.id, 1); scheduleSave(); }}>▾</button>
										</div>
										<button class="place-drop" aria-label={`Remove ${entry.label} from the journey`} onclick={() => { board = removeStop(board, entry.stop.id); scheduleSave(); }}>×</button>
									</li>
								{/each}
							</ol>
						{:else}
							<p class="drawer-empty">Nothing arranged yet.</p>
						{/if}
					</section>

					<section class="journey-controls">
						<div class="row-buttons">
							<button class="chip strong" onclick={() => beginJourney()}>▶ Play</button>
							<button class="chip" onclick={addSelectionToJourney}>Add selection</button>
							<button class="chip" onclick={() => toggleStop({ kind: 'board' })}>{hasStop(board, { kind: 'board' }) ? 'Remove overview' : 'Add overview'}</button>
						</div>
						<div class="row-buttons">
							<button class="chip" onclick={useSuggestedJourney}>Build from frames</button>
							{#if stops.length}<button class="chip quiet" onclick={clearJourney}>Clear</button>{/if}
						</div>
						<label class="loop-toggle">
							<input type="checkbox" checked={board.journey.loop} onchange={(event) => { board = setJourneyLoop(board, (event.currentTarget as HTMLInputElement).checked); scheduleSave(); }} />
							loop back to the beginning
						</label>
					</section>
				</div>
			{/if}
		</aside>
	{/if}

	{#if minimapOn && !playing}
		<div class="minimap-shell" data-whiteboard-ui>
			<div
				class="minimap"
				role="button"
				tabindex="0"
				aria-label="Board overview — choose a place to move the view there"
				style={`width: ${MINIMAP.width}px; height: ${MINIMAP.height}px;`}
				onpointerdown={handleMinimapPointer}
				onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fitBoard(); } }}
			>
				{#each mapMarks as mark (mark.id)}
					{@const box = mapProjection.project(mark.bounds)}
					<span
						class="map-mark mark-{mark.kind}"
						class:here={mark.id === here?.id}
						style={`left: ${box.x}px; top: ${box.y}px; width: ${box.width}px; height: ${box.height}px;`}
					></span>
				{/each}
				<span class="map-view" style={`left: ${mapView.x}px; top: ${mapView.y}px; width: ${mapView.width}px; height: ${mapView.height}px;`}></span>
			</div>
		</div>
	{/if}

	{#if playing}
		<div class="player" data-whiteboard-ui aria-label="Journey">
			<button aria-label="Previous stop" title="Previous stop (←)" onclick={() => stepJourney(-1)}>‹</button>
			<button class="player-play" aria-label={paused ? 'Resume the journey' : 'Pause the journey'} onclick={() => (paused ? resumeJourney() : pauseJourney())}>{paused ? '▶' : '❚❚'}</button>
			<button aria-label="Next stop" title="Next stop (→)" onclick={() => stepJourney(1)}>›</button>
			<p class="player-where">
				<span class="player-count">{playIndex + 1} / {stops.length}</span>
				<span class="player-label">{stops[playIndex]?.label ?? ''}</span>
			</p>
			<button class="player-exit" onclick={exitJourney}>Leave</button>
		</div>
	{/if}

	{#if shelfOpen}
		<div class="shelf-backdrop" data-whiteboard-ui>
			<section class="shelf" aria-label="Your whiteboards">
				<header class="shelf-head">
					<div>
						<h2>Whiteboards</h2>
						<p>Each board is its own space. They are saved on this device as you work.</p>
					</div>
					<button class="shelf-close" aria-label="Close the shelf" onclick={() => { shelfOpen = false; confirmDeleteId = null; }}>×</button>
				</header>
				<ul class="shelf-list">
					{#each boards as entry (entry.id)}
						<li class:open={entry.id === board.board.id}>
							<button class="shelf-open" onclick={() => openBoard(entry.id)}>
								<strong>{boardTitleFallback(entry.title)}</strong>
								<small>{boardCountLabel(entry)} · {relativeWhen(entry.updatedAt)}</small>
							</button>
							{#if entry.id === board.board.id}<span class="shelf-badge">open</span>{/if}
							<button class="chip quiet" onclick={() => duplicateBoard(entry.id)}>Duplicate</button>
							{#if confirmDeleteId === entry.id}
								<button class="chip danger" onclick={() => deleteBoard(entry.id)}>Delete for good</button>
								<button class="chip quiet" onclick={() => (confirmDeleteId = null)}>Keep</button>
							{:else}
								<button class="chip quiet" onclick={() => (confirmDeleteId = entry.id)}>Delete</button>
							{/if}
						</li>
					{/each}
				</ul>
				<footer class="shelf-foot">
					<button class="chip strong" onclick={startNewBoard}>Start a new whiteboard</button>
					<button class="chip" onclick={() => { shelfOpen = false; confirmDeleteId = null; }}>Back to “{boardTitleFallback(board.board.title)}”</button>
				</footer>
			</section>
		</div>
	{/if}

	{#if shortcutsOpen && !playing}
		<div class="shortcuts" data-whiteboard-ui aria-label="Keyboard shortcuts">
			<h3>Moving around</h3>
			<dl>
				<dt>/ ⌘K</dt><dd>find anything</dd>
				<dt>I</dt><dd>details of what's chosen</dd>
				<dt>⇧← →</dt><dd>move a card a column along</dd>
				<dt>[ ]</dt><dd>previous / next frame</dd>
				<dt>1–9</dt><dd>jump to a frame</dd>
				<dt>0</dt><dd>fit the whole board</dd>
				<dt>H</dt><dd>home</dd>
				<dt>⌥ ← →</dt><dd>back / forward</dd>
				<dt>P</dt><dd>play the journey</dd>
				<dt>M</dt><dd>overview map</dd>
				<dt>Space</dt><dd>hold to drag the board</dd>
				<dt>⌘S</dt><dd>save now</dd>
			</dl>
		</div>
	{/if}

	<div class:hidden={playing} class="tool-dock" data-whiteboard-ui aria-label="Whiteboard tools">
		<button class="tool-button" aria-label="Add card" title="Card" onclick={addCardFromDock}><span aria-hidden="true">□</span>Card</button>
		<button class="tool-button" aria-label="Add image" title="Image" onclick={() => imageInput?.click()}><span aria-hidden="true">▧</span>Image</button>
		<button class:active={tool === 'frame'} class="tool-button" aria-pressed={tool === 'frame'} title="Draw a frame" onclick={() => { tool = tool === 'frame' ? 'select' : 'frame'; connectorSourceId = null; notice = tool === 'frame' ? 'Drag a region for a frame.' : ''; }}><span aria-hidden="true">▢</span>Frame</button>
		<button class="tool-button" aria-label="Add stack" title="Stack" onclick={addStackFromDock}><span aria-hidden="true">▤</span>Stack</button>
		<button class="tool-button" aria-label="Add a way through to another board" title="Portal" onclick={addPortalFromDock}><span aria-hidden="true">◫</span>Portal</button>
		<button class:active={tool === 'line'} class="tool-button" aria-pressed={tool === 'line'} title="Connect two ideas" onclick={() => { tool = tool === 'line' ? 'select' : 'line'; connectorSourceId = null; notice = tool === 'line' ? 'Choose the first idea.' : ''; }}><span aria-hidden="true">⟶</span>Line</button>
	</div>

	<div class:hidden={playing} class="camera-controls" data-whiteboard-ui aria-label="Camera controls">
		<button aria-label="Zoom in" title="Zoom in" onclick={() => changeZoom(1.2)}>+</button>
		<button aria-label="Zoom out" title="Zoom out" onclick={() => changeZoom(1 / 1.2)}>−</button>
		<button class="home-button" aria-label="Fit board in view" title="Fit the whole board (0)" onclick={fitBoard}>⌾</button>
		<button class:active={minimapOn} class="map-button" aria-pressed={minimapOn} aria-label="Board overview" title="Overview map (M)" onclick={() => (minimapOn = !minimapOn)}>▦</button>
		<button class:active={shortcutsOpen} class="map-button help-button" aria-pressed={shortcutsOpen} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onclick={() => (shortcutsOpen = !shortcutsOpen)}>?</button>
		<span>{zoomLabel()}</span>
	</div>

	{#if notice && !playing}
		<p class="notice" data-whiteboard-ui>{notice}</p>
	{/if}
	{#if playing}
		<!-- nothing: the board is being presented, not edited -->
	{:else if tool === 'frame'}
		<p class="mode-note" data-whiteboard-ui>drag to make a frame</p>
	{:else if tool === 'line' && connectorSourceId}
		<p class="mode-note" data-whiteboard-ui>choose the other end</p>
	{/if}

	<div class="veil" class:up={veil === 1} aria-hidden="true"></div>

	<input bind:this={imageInput} class="image-input" type="file" accept="image/*" multiple onchange={handleImageInput} />
</main>

<style>
	:global(:root) {
		font-family: var(--font-body, 'DM Sans', ui-sans-serif, system-ui, sans-serif);
		color: #403b38;
		background: #f7f3ec;
	}

	.whiteboard {
		--ink: #403b38;
		--muted: #8e8580;
		--paper: #f7f3ec;
		--surface: rgba(255, 253, 248, 0.82);
		--rule: rgba(90, 75, 67, 0.16);
		--accent: #a76670;
		position: fixed;
		inset: 0;
		overflow: hidden;
		isolation: isolate;
		user-select: none;
		touch-action: none;
		background-color: var(--paper);
		background-image:
			radial-gradient(circle at 1px 1px, rgba(103, 86, 75, 0.14) 1px, transparent 1.1px),
			radial-gradient(ellipse at 50% -20%, rgba(255, 255, 255, 0.82), transparent 59%);
		background-size: 22px 22px, 100% 100%;
		cursor: default;
	}

	.whiteboard::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(ellipse at center, transparent 55%, rgba(104, 79, 65, 0.08));
		z-index: 50;
	}

	.whiteboard.space-panning,
	.whiteboard.space-panning * { cursor: grab !important; }

	.whiteboard.space-panning:active,
	.whiteboard.space-panning:active * { cursor: grabbing !important; }

	.whiteboard.file-dragging::before {
		content: 'drop images into the board';
		position: absolute;
		inset: 18px;
		z-index: 60;
		display: grid;
		place-items: center;
		border: 1.5px dashed rgba(167, 102, 112, 0.6);
		border-radius: 18px;
		background: rgba(255, 252, 247, 0.6);
		color: #7e5159;
		font-family: var(--font-display, Georgia, serif);
		font-size: 1.2rem;
		letter-spacing: 0.02em;
		pointer-events: none;
	}

	.world {
		position: absolute;
		left: 0;
		top: 0;
		width: 1px;
		height: 1px;
		transform-origin: 0 0;
		will-change: transform;
		pointer-events: none;
	}

	.connector-layer {
		position: absolute;
		left: 0;
		top: 0;
		overflow: visible;
		pointer-events: none;
	}

	.connector-layer marker path { fill: #9e7a73; }

	.connector-path {
		fill: none;
		stroke: rgba(139, 111, 103, 0.68);
		stroke-width: 2.25;
		stroke-linecap: round;
		pointer-events: none;
		transition: stroke 140ms ease, stroke-width 140ms ease;
	}

	.connector-hit-area {
		fill: none;
		stroke: transparent;
		stroke-width: 15px;
		vector-effect: non-scaling-stroke;
		pointer-events: stroke;
		cursor: pointer;
	}

	.connector-path:hover,
	.connector-path.selected-line { stroke: var(--accent); stroke-width: 3.4; }

	.board-item {
		position: absolute;
		pointer-events: auto;
		outline: none;
	}

	.board-item.selected::after {
		content: '';
		position: absolute;
		inset: -5px;
		border: 1.5px solid rgba(167, 102, 112, 0.88);
		border-radius: inherit;
		box-shadow: 0 0 0 3px rgba(167, 102, 112, 0.11);
		pointer-events: none;
	}

	.board-item.dragging { filter: drop-shadow(0 14px 18px rgba(70, 51, 43, 0.18)); }

	.frame {
		min-width: 120px;
		min-height: 100px;
		border: 1px solid rgba(137, 103, 89, 0.28);
		border-radius: 18px;
		background: rgba(245, 209, 186, 0.12);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
		cursor: move;
	}

	/* One palette, six names, shared by frames, labels and the Color property. */
	.frame.tint-lavender { background: rgba(204, 193, 232, 0.18); border-color: rgba(113, 94, 150, 0.28); }
	.frame.tint-aqua { background: rgba(172, 220, 216, 0.18); border-color: rgba(66, 136, 133, 0.26); }
	.frame.tint-gold { background: rgba(236, 215, 166, 0.2); border-color: rgba(161, 124, 51, 0.26); }
	.frame.tint-rose { background: rgba(232, 193, 199, 0.2); border-color: rgba(160, 96, 110, 0.26); }
	.frame.tint-sage { background: rgba(196, 216, 190, 0.2); border-color: rgba(97, 133, 92, 0.26); }

	.frame-label {
		position: absolute;
		left: 16px;
		top: 14px;
		max-width: calc(100% - 32px);
	}

	.frame-title,
	.frame-label input {
		max-width: 100%;
		padding: 3px 8px 4px;
		border: 0;
		border-radius: 7px;
		background: rgba(255, 253, 248, 0.55);
		color: #66534e;
		font-family: var(--font-display, Georgia, serif);
		font-size: 16px;
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: 0.01em;
		outline: none;
	}

	.frame-title:hover { background: rgba(255, 253, 248, 0.82); }
	.frame-label input { width: min(230px, 100%); border: 1px solid rgba(167, 102, 112, 0.5); }

	.frame-corner {
		position: absolute;
		width: 10px;
		height: 10px;
		border-color: rgba(130, 98, 84, 0.48);
		border-style: solid;
	}
	.frame-corner.top-left { left: 8px; top: 8px; border-width: 1px 0 0 1px; border-radius: 4px 0 0; }
	.frame-corner.top-right { right: 8px; top: 8px; border-width: 1px 1px 0 0; border-radius: 0 4px 0 0; }
	.frame-corner.bottom-left { left: 8px; bottom: 8px; border-width: 0 0 1px 1px; border-radius: 0 0 0 4px; }
	.frame-corner.bottom-right { right: 8px; bottom: 8px; border-width: 0 1px 1px 0; border-radius: 0 0 4px 0; }

	.stack {
		min-width: 180px;
		min-height: 130px;
		border: 1px solid rgba(89, 73, 67, 0.17);
		border-radius: 16px;
		background: rgba(234, 226, 216, 0.58);
		box-shadow: 0 5px 13px rgba(82, 64, 55, 0.06), inset 0 1px rgba(255,255,255,0.75);
		cursor: move;
		transition: border-color 150ms ease, box-shadow 150ms ease;
	}

	.stack.drop-target { border-color: rgba(167, 102, 112, 0.72); box-shadow: 0 0 0 5px rgba(167, 102, 112, 0.12); }

	.stack-header {
		display: flex;
		align-items: center;
		gap: 7px;
		height: 52px;
		padding: 0 13px;
		border-bottom: 1px solid rgba(89, 73, 67, 0.12);
	}

	.stack-grip { color: #aa9e97; letter-spacing: -3px; font-size: 17px; transform: rotate(90deg); }
	.stack-header input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: #4c403c;
		font-family: var(--font-display, Georgia, serif);
		font-weight: 600;
		font-size: 16px;
		outline: none;
	}

	.stack-count { color: #9a8d86; font-size: 12px; min-width: 10px; text-align: right; font-variant-numeric: tabular-nums; }
	.stack-empty { margin: 22px 14px; color: #a69a93; font-size: 12px; font-style: italic; }

	/*
	 * A stack with a behaviour still looks like a stack in the same place. The
	 * only outward difference is a word in the header and what its cards do.
	 */
	.stack-mode {
		flex: none;
		padding: 2px 6px;
		border-radius: 999px;
		background: rgba(120, 96, 88, 0.1);
		color: #8b7a73;
		font-size: 9px;
		letter-spacing: .07em;
		text-transform: uppercase;
		cursor: help;
	}
	.stack.does-status { border-color: rgba(137, 103, 89, 0.3); }
	.stack.does-status .stack-header { border-bottom-width: 2px; border-bottom-color: rgba(137, 103, 89, 0.22); }
	.stack.does-status .stack-header input { font-size: 14px; letter-spacing: .05em; text-transform: uppercase; }

	.queue-take {
		display: block;
		width: calc(100% - 26px);
		margin: 9px 13px 0;
		padding: 5px 8px;
		border: 1px dashed rgba(120, 96, 88, 0.3);
		border-radius: 9px;
		background: transparent;
		color: #7c6a63;
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background 130ms ease, border-color 130ms ease;
	}
	.queue-take:hover { border-color: rgba(167, 102, 112, 0.5); background: rgba(219, 178, 178, 0.22); color: #7c4a53; }

	.tick {
		position: absolute;
		left: 15px;
		top: 13px;
		width: 15px;
		height: 15px;
		display: grid;
		place-items: center;
		border: 1.5px solid rgba(120, 96, 88, 0.34);
		border-radius: 5px;
		background: transparent;
		color: transparent;
		font-size: 10px;
		line-height: 1;
		transition: background 130ms ease, border-color 130ms ease, color 130ms ease;
	}
	.tick:hover { border-color: rgba(120, 96, 88, 0.6); color: rgba(120, 96, 88, 0.35); }
	.tick.on { border-color: rgba(122, 152, 132, 0.85); background: rgba(140, 177, 156, 0.5); color: #40624f; }
	.card.laid-checklist .card-title,
	.card.laid-checklist .card-body { padding-left: 24px; }
	.card.ticked .card-title { color: #9a8d86; text-decoration: line-through; text-decoration-color: rgba(120, 96, 88, 0.4); }
	.card.ticked .card-body { color: #a49790; }

	.queue-badge {
		position: absolute;
		left: 16px;
		top: 7px;
		padding: 1px 6px;
		border-radius: 999px;
		font-size: 8.5px;
		font-weight: 700;
		letter-spacing: .09em;
		text-transform: uppercase;
	}
	.queue-badge.now { background: rgba(219, 178, 178, 0.62); color: #7c4a53; }
	.queue-badge.next { background: rgba(120, 96, 88, 0.11); color: #8b7a73; }
	.card.laid-queue .card-topline { display: none; }
	.card.laid-queue .card-title { margin-top: 11px; }

	/* A gallery tile is the same card, read at a glance. Its box is a fixed size,
	   so unlike a free card it clips rather than spilling over its neighbour. */
	.card.tile { padding: 11px 12px 10px; overflow: hidden; }
	.card.tile .card-topline,
	.card.tile .card-grip,
	.card.tile .card-kind,
	.card.tile .card-body,
	.card.tile .chip-row { display: none; }
	.card.tile .card-title { margin-top: 0; font-size: 12.5px; line-height: 1.3; }

	.card {
		min-width: 150px;
		min-height: 90px;
		display: flex;
		flex-direction: column;
		padding: 17px 18px 16px;
		border: 1px solid rgba(93, 79, 71, 0.14);
		border-radius: 14px;
		background: rgba(255, 253, 248, 0.96);
		box-shadow: 0 4px 11px rgba(73, 54, 46, 0.1), 0 1px 1px rgba(73, 54, 46, 0.05);
		cursor: move;
		overflow: visible;
	}

	.card.in-stack { box-shadow: 0 3px 8px rgba(73, 54, 46, 0.09); }

	/* Colour is a wash over the card's own paper, never a repaint of it. */
	.card.tint-peach { background: rgba(250, 226, 210, 0.94); }
	.card.tint-lavender { background: rgba(230, 224, 245, 0.94); }
	.card.tint-aqua { background: rgba(214, 238, 235, 0.94); }
	.card.tint-gold { background: rgba(246, 233, 202, 0.94); }
	.card.tint-rose { background: rgba(247, 224, 228, 0.94); }
	.card.tint-sage { background: rgba(224, 237, 219, 0.94); }
	.stack.tint-peach { background: rgba(243, 219, 203, 0.6); }
	.stack.tint-lavender { background: rgba(222, 216, 238, 0.6); }
	.stack.tint-aqua { background: rgba(206, 231, 228, 0.6); }
	.stack.tint-gold { background: rgba(239, 226, 195, 0.6); }
	.stack.tint-rose { background: rgba(240, 217, 221, 0.6); }
	.stack.tint-sage { background: rgba(217, 230, 212, 0.6); }

	/* A search result, said quietly on the board itself. */
	.board-item.found::before {
		content: '';
		position: absolute;
		inset: -7px;
		border: 1.5px solid rgba(180, 132, 84, 0.85);
		border-radius: inherit;
		box-shadow: 0 0 0 4px rgba(206, 163, 106, 0.16);
		pointer-events: none;
		animation: found 1.6s ease-in-out infinite alternate;
	}
	@keyframes found { from { opacity: .55; } to { opacity: 1; } }

	.card-kind {
		margin: 3px 0 0;
		color: #9d857c;
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: .11em;
		text-transform: uppercase;
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
		pointer-events: auto;
	}
	.chip-row.inline { margin-top: 0; margin-bottom: 8px; }
	.chip-row.suggestions { margin-top: 9px; margin-bottom: 0; }
	.stack-chips { margin: 9px 13px 0; }
	.image-chips { position: absolute; left: 5px; bottom: 5px; margin: 0; }

	.label-chip {
		max-width: 132px;
		padding: 2px 7px;
		border: 1px solid transparent;
		border-radius: 999px;
		font-size: 10.5px;
		line-height: 1.5;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: filter 130ms ease, border-color 130ms ease;
	}
	button.label-chip:hover { filter: brightness(0.96); border-color: rgba(90, 70, 60, 0.28); }
	.label-chip.tiny { max-width: 88px; font-size: 9.5px; }
	.label-chip.ghost { background: transparent !important; border-color: rgba(120, 96, 88, 0.24); color: #8b7a73 !important; }
	.label-chip.ghost:hover { border-color: rgba(120, 96, 88, 0.5); color: #5f4f49 !important; }
	.label-chip.removable i { margin-left: 4px; font-style: normal; opacity: .55; }

	.label-chip.tint-peach { background: rgba(246, 214, 192, 0.85); color: #7d5340; }
	.label-chip.tint-lavender { background: rgba(220, 212, 240, 0.85); color: #5d4d7d; }
	.label-chip.tint-aqua { background: rgba(199, 230, 226, 0.85); color: #3d6d69; }
	.label-chip.tint-gold { background: rgba(240, 224, 184, 0.85); color: #7a5f26; }
	.label-chip.tint-rose { background: rgba(243, 210, 216, 0.85); color: #86495a; }
	.label-chip.tint-sage { background: rgba(211, 228, 204, 0.85); color: #4d6b45; }

	.status-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 7px 2px 5px;
		border-radius: 999px;
		background: rgba(120, 96, 88, 0.08);
		color: #7c6a63;
		font-size: 10.5px;
		line-height: 1.5;
	}
	.status-chip i, .status-pick i { width: 6px; height: 6px; border-radius: 50%; background: #b3a49c; }
	.status-chip.idea i, .status-pick.idea i { background: #c2a25f; }
	.status-chip.open i, .status-pick.open i { background: #8ea9c4; }
	.status-chip.doing i, .status-pick.doing i { background: #cf8d6b; }
	.status-chip.done i, .status-pick.done i { background: #8cb19c; }
	.status-chip.parked i, .status-pick.parked i { background: #b0a6a1; }

	.source-mark { color: #a4938b; font-size: 11px; line-height: 1.5; cursor: help; }

	.chip-add {
		width: 20px;
		height: 18px;
		border-radius: 999px;
		background: rgba(120, 96, 88, 0.09);
		color: #8b7a73;
		font-size: 10px;
		line-height: 1;
		transition: background 130ms ease, color 130ms ease;
	}
	.chip-add:hover { background: rgba(218, 188, 181, 0.55); color: #69434a; }

	.card-topline { position: absolute; left: 18px; top: 9px; width: 29px; height: 2px; background: rgba(189, 139, 119, 0.42); border-radius: 3px; }
	.card-grip { position: absolute; right: 11px; top: 7px; color: rgba(93, 79, 71, 0.38); font-size: 14px; line-height: 1; letter-spacing: -3px; }
	.card-title,
	.card-body {
		width: 100%;
		border: 0;
		background: transparent;
		color: var(--ink);
		outline: none;
		resize: none;
	}

	.card-title {
		margin-top: 4px;
		font-family: var(--font-display, Georgia, serif);
		font-size: 17px;
		font-weight: 600;
		line-height: 1.25;
	}

	.card-title::placeholder { color: #b4a7a0; font-weight: 400; }
	.card-body {
		min-height: 0;
		flex: 1;
		margin-top: 8px;
		font-size: 14px;
		line-height: 1.5;
		font-family: var(--font-body, ui-sans-serif, sans-serif);
	}
	.card-body::placeholder { color: #b4aaa5; }

	/*
	 * A doorway. The pane shows the board beyond as shapes — the same projection
	 * the overview map uses — so flying into it lands on the arrangement you were
	 * already looking at.
	 */
	.portal {
		min-width: 150px;
		min-height: 120px;
		display: flex;
		flex-direction: column;
		padding: 8px 8px 0;
		border: 1px solid rgba(93, 79, 71, 0.18);
		border-radius: 16px;
		background: rgba(252, 249, 243, 0.96);
		box-shadow: 0 5px 14px rgba(73, 54, 46, 0.12), inset 0 1px rgba(255,255,255,.9);
		cursor: move;
	}
	.portal::after { border-radius: 16px; }
	.portal.missing { border-style: dashed; border-color: rgba(163, 84, 83, 0.42); background: rgba(250, 244, 241, 0.9); }
	.portal.loops { border-color: rgba(137, 103, 89, 0.42); }

	.portal-pane {
		position: relative;
		flex: 1;
		min-height: 0;
		border-radius: 10px;
		background:
			radial-gradient(ellipse at 50% 120%, rgba(167, 102, 112, 0.09), transparent 62%),
			rgba(120, 96, 88, 0.07);
		box-shadow: inset 0 1px 3px rgba(73, 54, 46, 0.09);
		overflow: hidden;
	}
	.door-mark { position: absolute; border-radius: 2px; background: rgba(120, 96, 88, 0.34); }
	.door-mark.mark-frame { border: 1px solid rgba(137, 103, 89, 0.4); border-radius: 3px; background: rgba(219, 186, 163, 0.28); }
	.door-mark.mark-stack { background: rgba(120, 96, 88, 0.3); }
	.door-mark.mark-image { background: rgba(150, 118, 106, 0.44); }
	.door-mark.mark-portal { border: 1px solid rgba(120, 96, 88, 0.4); background: rgba(252, 249, 243, 0.85); }

	.portal-gone,
	.portal-empty { margin: 0; padding: 0 10px; height: 100%; display: grid; place-content: center; text-align: center; font-size: 11px; font-style: italic; }
	.portal-gone { color: #a45554; }
	.portal-empty { color: #a89a93; }

	.portal-foot { display: flex; align-items: center; gap: 4px; height: 36px; flex: none; }
	.portal-title {
		flex: 1;
		min-width: 0;
		padding: 3px 4px;
		border: 0;
		background: transparent;
		color: #4c403c;
		font-family: var(--font-display, Georgia, serif);
		font-size: 14px;
		font-weight: 600;
		outline: none;
	}
	.portal-title::placeholder { color: #a89a93; font-weight: 400; }
	.portal-go {
		width: 26px;
		height: 26px;
		flex: none;
		border-radius: 8px;
		background: rgba(219, 178, 178, 0.34);
		color: #7c4a53;
		font-size: 14px;
		line-height: 1;
		transition: background 130ms ease, transform 130ms ease;
	}
	.portal-go:hover { background: rgba(219, 178, 178, 0.62); transform: translateX(1px); }

	/* Rises over the board while going through, in either direction. */
	.veil {
		position: absolute;
		inset: 0;
		z-index: 85;
		background: var(--paper);
		opacity: 0;
		pointer-events: none;
		transition: opacity 260ms ease;
	}
	.veil.up { opacity: 1; }

	.climb-out {
		width: 26px;
		height: 26px;
		flex: none;
		border-radius: 8px;
		background: rgba(219, 178, 178, 0.3);
		color: #7c4a53;
		font-size: 14px;
		line-height: 1;
		transition: background 130ms ease;
	}
	.climb-out:hover { background: rgba(219, 178, 178, 0.58); }
	.crumb.above { color: #8a5b63; }
	.crumb.above:hover { background: rgba(219, 178, 178, 0.32); color: #6f454c; }
	.door-targets { margin-top: 9px; max-height: 168px; overflow-y: auto; }

	.image-card {
		min-width: 120px;
		min-height: 80px;
		border: 5px solid rgba(255, 253, 248, 0.96);
		border-radius: 12px;
		background: #e7dfd7;
		box-shadow: 0 6px 16px rgba(73, 54, 46, 0.15);
		cursor: move;
		overflow: visible;
	}

	.image-card img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 7px; pointer-events: none; }
	.missing-image { width: 100%; height: 100%; display: grid; place-content: center; gap: 7px; text-align: center; color: #8d817c; background: repeating-linear-gradient(45deg, rgba(255,255,255,.28), rgba(255,255,255,.28) 10px, rgba(209,195,186,.2) 10px, rgba(209,195,186,.2) 20px); border-radius: 7px; }
	.missing-image span { font-size: 28px; color: #b08b83; }
	.missing-image p { margin: 0; font-size: 12px; }

	.resize-handle {
		position: absolute;
		right: -7px;
		bottom: -7px;
		width: 15px;
		height: 15px;
		border: 2px solid #fffaf5;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 1px 4px rgba(77, 55, 47, 0.22);
		cursor: nwse-resize;
		z-index: 5;
	}

	.marquee,
	.frame-draft {
		position: absolute;
		pointer-events: none;
	}
	.marquee { border: 1px solid rgba(167, 102, 112, 0.84); background: rgba(167, 102, 112, 0.1); border-radius: 3px; }
	.frame-draft { border: 1.5px dashed rgba(119, 94, 149, 0.7); border-radius: 16px; background: rgba(204, 193, 232, 0.17); }

	/*
	 * One row across the top rather than three pieces pinned independently:
	 * absolute positioning let the breadcrumb drift over the board controls at
	 * middling widths, and a flex row cannot overlap itself at any width.
	 */
	.top-deck {
		position: absolute;
		z-index: 70;
		top: 20px;
		left: 22px;
		right: 22px;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 9px;
		pointer-events: none;
	}
	.top-deck > * { pointer-events: auto; }

	.topbar {
		display: flex;
		align-items: center;
		gap: 13px;
		min-width: 0;
		padding: 8px 10px 8px 8px;
		border: 1px solid rgba(98, 80, 70, 0.13);
		border-radius: 14px;
		background: rgba(255, 253, 248, 0.72);
		box-shadow: 0 5px 19px rgba(76, 57, 48, 0.08), inset 0 1px rgba(255,255,255,.85);
		backdrop-filter: blur(12px);
	}

	.back-link { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; color: #76645d; text-decoration: none; font-size: 18px; }
	.back-link:hover { background: rgba(224, 210, 200, 0.5); color: #4f403b; }
	.board-name { min-width: 0; display: flex; align-items: baseline; gap: 8px; }
	.board-name span { color: #9c8e86; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
	.board-name input { min-width: 90px; width: clamp(125px, 18vw, 220px); border: 0; background: transparent; color: #443a36; font-family: var(--font-display, Georgia, serif); font-size: 17px; font-weight: 600; outline: none; }
	.save-status { display: flex; align-items: center; gap: 5px; margin: 0 0 0 3px; padding-left: 10px; border-left: 1px solid rgba(98,80,70,.13); color: #92847c; font-size: 11px; white-space: nowrap; }
	.save-status.warning { color: #a45554; }
	.save-dot { width: 5px; height: 5px; border-radius: 50%; background: #8cb19c; }
	.save-dot.working { background: #c49b68; animation: breathe 900ms ease-in-out infinite alternate; }
	@keyframes breathe { to { transform: scale(1.65); opacity: .46; } }

	.tool-dock {
		position: absolute;
		z-index: 70;
		left: 50%;
		bottom: 25px;
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 5px;
		border: 1px solid rgba(98, 80, 70, 0.14);
		border-radius: 15px;
		background: rgba(255,253,248,.8);
		box-shadow: 0 8px 26px rgba(76,57,48,.11), inset 0 1px rgba(255,255,255,.9);
		backdrop-filter: blur(15px);
		transform: translateX(-50%);
	}

	.tool-button { display: inline-flex; align-items: center; gap: 6px; min-height: 35px; padding: 0 10px; border-radius: 10px; background: transparent; color: #695953; font-size: 12px; transition: background 130ms ease, color 130ms ease, transform 130ms ease; }
	.tool-button span { color: #9a7770; font-size: 15px; line-height: 1; }
	.tool-button:hover, .tool-button.active { color: #69434a; background: rgba(218, 188, 181, .37); }
	.tool-button:active { transform: scale(.96); }

	.camera-controls {
		position: absolute;
		z-index: 70;
		right: 22px;
		bottom: 25px;
		display: grid;
		grid-template-columns: repeat(5, 35px) auto;
		align-items: center;
		gap: 3px;
		padding: 5px;
		border: 1px solid rgba(98,80,70,.14);
		border-radius: 14px;
		background: rgba(255,253,248,.8);
		box-shadow: 0 8px 26px rgba(76,57,48,.11), inset 0 1px rgba(255,255,255,.9);
		backdrop-filter: blur(15px);
	}

	.camera-controls button { width: 35px; height: 35px; border-radius: 9px; background: transparent; color: #695953; font-size: 18px; transition: background 130ms ease, transform 130ms ease; }
	.camera-controls button:hover { background: rgba(218,188,181,.37); }
	.camera-controls button:active { transform: scale(.94); }
	.camera-controls .home-button { font-size: 20px; }
	.camera-controls span { min-width: 40px; padding-left: 5px; color: #978981; font-size: 11px; font-variant-numeric: tabular-nums; }

	.empty-whisper {
		position: absolute;
		z-index: 2;
		left: 50%;
		top: 48%;
		transform: translate(-50%, -50%);
		width: min(340px, calc(100vw - 60px));
		text-align: center;
		color: #91847d;
		pointer-events: none;
		animation: enter 700ms ease both;
	}
	.empty-mark { display: block; margin-bottom: 14px; color: #c69d93; font-size: 27px; }
	.empty-whisper p { margin: 0; color: #6f5f59; font-family: var(--font-display, Georgia, serif); font-size: 21px; }
	.empty-whisper small { display: block; margin-top: 8px; font-size: 12px; }
	@keyframes enter { from { opacity: 0; transform: translate(-50%, -42%); } to { opacity: 1; transform: translate(-50%, -50%); } }

	.notice,
	.mode-note { position: absolute; z-index: 70; left: 50%; bottom: 80px; margin: 0; padding: 7px 12px; border: 1px solid rgba(98,80,70,.12); border-radius: 999px; background: rgba(255,253,248,.82); box-shadow: 0 5px 15px rgba(76,57,48,.08); color: #77665f; font-size: 12px; transform: translateX(-50%); pointer-events: none; backdrop-filter: blur(10px); }
	.mode-note { color: #73586f; }
	.image-input { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

	/* Chrome steps out of the way while a journey is running. */
	.hidden { opacity: 0; pointer-events: none; transform: translateY(-8px); }
	.topbar, .location-bar, .rail, .tool-dock, .camera-controls { transition: opacity 260ms ease, transform 260ms ease; }

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-height: 27px;
		padding: 0 10px;
		border: 1px solid rgba(98, 80, 70, 0.15);
		border-radius: 9px;
		background: rgba(255, 253, 248, 0.7);
		color: #6b5b55;
		font-size: 11.5px;
		white-space: nowrap;
		transition: background 130ms ease, color 130ms ease, border-color 130ms ease;
	}
	.chip:hover { background: rgba(232, 214, 208, 0.62); color: #4f403b; }
	.chip.strong { border-color: rgba(167, 102, 112, 0.38); background: rgba(219, 178, 178, 0.34); color: #7c4a53; }
	.chip.strong:hover { background: rgba(219, 178, 178, 0.52); }
	.chip.quiet { border-color: transparent; background: transparent; color: #8d7f79; }
	.chip.quiet:hover { background: rgba(224, 210, 200, 0.5); }
	.chip.danger { border-color: rgba(163, 84, 83, 0.4); background: rgba(196, 122, 118, 0.2); color: #8f4a48; }
	.chip.active { background: rgba(218, 188, 181, 0.5); color: #69434a; }
	.chip-count { padding: 0 5px; border-radius: 6px; background: rgba(120, 96, 88, 0.13); color: #7b6a63; font-size: 10px; font-variant-numeric: tabular-nums; }

	.board-actions { display: flex; align-items: center; gap: 4px; padding-left: 9px; border-left: 1px solid rgba(98,80,70,.13); }

	.location-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		max-width: 560px;
		padding: 5px 9px 5px 5px;
		border: 1px solid rgba(98, 80, 70, 0.13);
		border-radius: 13px;
		background: rgba(255, 253, 248, 0.72);
		box-shadow: 0 5px 19px rgba(76, 57, 48, 0.08), inset 0 1px rgba(255,255,255,.85);
		backdrop-filter: blur(12px);
	}

	.history-pair,
	.frame-steps { display: flex; gap: 1px; }
	.history-pair button,
	.frame-steps button {
		width: 26px;
		height: 26px;
		border-radius: 8px;
		background: transparent;
		color: #77655e;
		font-size: 16px;
		line-height: 1;
		transition: background 130ms ease, color 130ms ease;
	}
	.frame-steps button { font-size: 11px; }
	.history-pair button:hover:not(:disabled),
	.frame-steps button:hover:not(:disabled) { background: rgba(218, 188, 181, 0.4); color: #5a4741; }
	.history-pair button:disabled,
	.frame-steps button:disabled { color: #c8bcb5; cursor: default; }

	.breadcrumb {
		display: flex;
		align-items: center;
		min-width: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		overflow: hidden;
	}
	.breadcrumb li { display: flex; align-items: center; min-width: 0; }
	.crumb {
		max-width: 190px;
		padding: 3px 6px;
		border-radius: 7px;
		background: transparent;
		color: #7d6c65;
		font-size: 12.5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background 130ms ease, color 130ms ease;
	}
	.crumb:hover { background: rgba(224, 210, 200, 0.55); color: #4f403b; }
	.crumb.root { font-family: var(--font-display, Georgia, serif); font-weight: 600; color: #5d4c46; }
	.crumb.current { color: #7c4a53; font-weight: 600; }
	.crumb-arrow { color: #b8a9a2; font-size: 12px; }

	.scale-word {
		flex: none;
		padding: 2px 7px;
		border-radius: 999px;
		background: rgba(120, 96, 88, 0.09);
		color: #8b7a73;
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.rail {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 5px;
		border: 1px solid rgba(98, 80, 70, 0.13);
		border-radius: 13px;
		background: rgba(255, 253, 248, 0.72);
		box-shadow: 0 5px 19px rgba(76, 57, 48, 0.08), inset 0 1px rgba(255,255,255,.85);
		backdrop-filter: blur(12px);
	}
	.rail-button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-height: 30px;
		padding: 0 9px;
		border-radius: 9px;
		background: transparent;
		color: #695953;
		font-size: 11.5px;
		transition: background 130ms ease, color 130ms ease;
	}
	.rail-button span { color: #9a7770; font-size: 13px; line-height: 1; }
	.rail-button:hover,
	.rail-button.active { background: rgba(218, 188, 181, 0.4); color: #69434a; }
	.rail-button.play span { color: #a3646e; }

	.drawer {
		position: absolute;
		z-index: 72;
		top: 66px;
		right: 22px;
		bottom: 96px;
		display: flex;
		flex-direction: column;
		width: min(324px, calc(100vw - 44px));
		border: 1px solid rgba(98, 80, 70, 0.14);
		border-radius: 16px;
		background: rgba(255, 253, 248, 0.93);
		box-shadow: 0 14px 40px rgba(76, 57, 48, 0.16), inset 0 1px rgba(255,255,255,.9);
		backdrop-filter: blur(16px);
		animation: drawer-in 220ms ease both;
	}
	@keyframes drawer-in { from { opacity: 0; transform: translateY(-8px); } }

	.drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 9px 9px 8px 11px; border-bottom: 1px solid rgba(98,80,70,.11); }
	.drawer-tabs { display: flex; gap: 2px; }
	.drawer-tabs button { padding: 5px 10px; border-radius: 8px; background: transparent; color: #877771; font-size: 12px; }
	.drawer-tabs button.active { background: rgba(218, 188, 181, 0.42); color: #69434a; font-weight: 600; }
	.drawer-close { width: 26px; height: 26px; border-radius: 8px; background: transparent; color: #8b7a73; font-size: 18px; line-height: 1; }
	.drawer-close:hover { background: rgba(224, 210, 200, 0.55); }

	.drawer-body { flex: 1; overflow-y: auto; padding: 12px 12px 16px; }
	.drawer-body section + section { margin-top: 18px; padding-top: 15px; border-top: 1px solid rgba(98,80,70,.09); }
	.drawer-body h3 { margin: 0 0 7px; color: #6d5c56; font-family: var(--font-display, Georgia, serif); font-size: 13px; font-weight: 600; }
	.drawer-note { margin: 0 0 9px; color: #94867f; font-size: 11.5px; line-height: 1.5; }
	.drawer-empty { margin: 0 0 10px; padding: 14px; border: 1px dashed rgba(120,96,88,.22); border-radius: 11px; color: #9c8e87; font-size: 11.5px; font-style: italic; text-align: center; }
	.row-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 8px; }

	.place-list,
	.stop-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; }
	.place-list li,
	.stop-list li { display: flex; align-items: center; gap: 3px; border-radius: 9px; }
	.stop-list li.playing { background: rgba(219, 178, 178, 0.26); }

	.place-name,
	.stop-name {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 8px;
		background: transparent;
		color: #5f4f49;
		font-size: 12.5px;
		text-align: left;
	}
	.place-name span,
	.stop-name span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.place-name small,
	.stop-name small { flex: none; color: #a2948d; font-size: 10px; }
	.place-name:hover,
	.stop-name:hover { background: rgba(224, 210, 200, 0.5); }
	.place-name.current { color: #7c4a53; font-weight: 600; }
	.place-name small.key { padding: 1px 5px; border-radius: 5px; background: rgba(120,96,88,.11); font-variant-numeric: tabular-nums; }

	.place-add,
	.place-edit,
	.place-drop { width: 25px; height: 25px; flex: none; border-radius: 7px; background: transparent; color: #a1928b; font-size: 12px; line-height: 1; transition: background 130ms ease, color 130ms ease; }
	.place-drop { font-size: 16px; }
	.place-add:hover, .place-edit:hover, .place-drop:hover { background: rgba(224, 210, 200, 0.6); color: #6b5952; }
	.place-add.on { background: rgba(219, 178, 178, 0.5); color: #7c4a53; }
	.place-rename,
	.place-input { flex: 1; min-width: 0; padding: 5px 8px; border: 1px solid rgba(167, 102, 112, 0.35); border-radius: 8px; background: rgba(255,255,255,.7); color: #4c403c; font-size: 12px; outline: none; }
	.place-input:focus, .place-rename:focus { border-color: rgba(167, 102, 112, 0.7); }

	.stop-number { width: 18px; flex: none; color: #a89a93; font-size: 10.5px; font-variant-numeric: tabular-nums; text-align: center; }
	.stop-hold { display: flex; align-items: center; gap: 1px; color: #a2948d; font-size: 10px; }
	.stop-hold input { width: 32px; padding: 3px 4px; border: 1px solid rgba(98,80,70,.16); border-radius: 6px; background: rgba(255,255,255,.6); color: #6b5b55; font-size: 11px; text-align: center; outline: none; }
	.stop-move { display: flex; flex-direction: column; gap: 1px; }
	.stop-move button { width: 20px; height: 13px; border-radius: 4px; background: transparent; color: #a89a93; font-size: 9px; line-height: 1; }
	.stop-move button:hover:not(:disabled) { background: rgba(224, 210, 200, 0.6); color: #6b5952; }
	.stop-move button:disabled { color: #d2c7c1; cursor: default; }

	.journey-controls .loop-toggle { display: flex; align-items: center; gap: 6px; margin-top: 11px; color: #8b7d76; font-size: 11.5px; }
	.journey-controls .loop-toggle input { accent-color: #a76670; }

	/* Bottom-left: the one corner the dock, the camera controls and the drawer
	   all leave alone, so the overview never has to fight for it. */
	.minimap-shell {
		position: absolute;
		z-index: 68;
		left: 22px;
		bottom: 25px;
		padding: 5px;
		border: 1px solid rgba(98, 80, 70, 0.13);
		border-radius: 13px;
		background: rgba(255, 253, 248, 0.78);
		box-shadow: 0 8px 26px rgba(76,57,48,.11), inset 0 1px rgba(255,255,255,.9);
		backdrop-filter: blur(15px);
	}
	.minimap { position: relative; border-radius: 9px; background: rgba(120, 96, 88, 0.06); overflow: hidden; cursor: crosshair; }
	.minimap:focus-visible { outline: 2px solid rgba(167, 102, 112, 0.7); outline-offset: 2px; }
	/* Kind classes are prefixed: a bare `.frame` here would be the same selector
	   as a frame on the board, and the two are not the same thing. */
	.map-mark { position: absolute; border-radius: 2px; background: rgba(120, 96, 88, 0.34); }
	.map-mark.mark-frame { border: 1px solid rgba(137, 103, 89, 0.42); border-radius: 4px; background: rgba(219, 186, 163, 0.24); }
	.map-mark.mark-stack { background: rgba(120, 96, 88, 0.26); }
	.map-mark.mark-image { background: rgba(150, 118, 106, 0.44); }
	.map-mark.here { border-color: rgba(167, 102, 112, 0.75); background: rgba(219, 178, 178, 0.42); }
	.map-view { position: absolute; border: 1.5px solid rgba(167, 102, 112, 0.85); border-radius: 3px; background: rgba(167, 102, 112, 0.09); pointer-events: none; }

	.player {
		position: absolute;
		z-index: 80;
		left: 50%;
		bottom: 26px;
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: min(520px, calc(100vw - 40px));
		padding: 6px 8px 6px 6px;
		border: 1px solid rgba(98, 80, 70, 0.15);
		border-radius: 15px;
		background: rgba(255, 253, 248, 0.86);
		box-shadow: 0 10px 32px rgba(76,57,48,.15), inset 0 1px rgba(255,255,255,.9);
		backdrop-filter: blur(16px);
		transform: translateX(-50%);
		animation: player-in 300ms ease both;
	}
	@keyframes player-in { from { opacity: 0; transform: translate(-50%, 14px); } }
	.player button { width: 32px; height: 32px; border-radius: 9px; background: transparent; color: #6b5b55; font-size: 16px; line-height: 1; transition: background 130ms ease; }
	.player button:hover { background: rgba(218, 188, 181, 0.45); }
	.player-play { color: #7c4a53 !important; font-size: 13px !important; background: rgba(219, 178, 178, 0.34) !important; }
	.player-where { display: flex; align-items: baseline; gap: 8px; min-width: 0; margin: 0 4px; padding-left: 9px; border-left: 1px solid rgba(98,80,70,.13); }
	.player-count { flex: none; color: #a2948d; font-size: 10.5px; font-variant-numeric: tabular-nums; }
	.player-label { min-width: 0; color: #5c4b45; font-family: var(--font-display, Georgia, serif); font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.player-exit { width: auto !important; padding: 0 10px; color: #8b7a73 !important; font-size: 11.5px !important; }

	.shelf-backdrop {
		position: absolute;
		inset: 0;
		z-index: 90;
		display: grid;
		place-items: center;
		padding: 22px;
		background: rgba(60, 47, 41, 0.24);
		backdrop-filter: blur(4px);
		animation: fade-in 180ms ease both;
	}
	@keyframes fade-in { from { opacity: 0; } }

	.shelf {
		display: flex;
		flex-direction: column;
		width: min(560px, 100%);
		max-height: min(620px, 100%);
		border: 1px solid rgba(98, 80, 70, 0.16);
		border-radius: 20px;
		background: rgba(255, 253, 248, 0.98);
		box-shadow: 0 24px 60px rgba(58, 42, 35, 0.28);
		animation: shelf-in 240ms ease both;
	}
	@keyframes shelf-in { from { opacity: 0; transform: translateY(12px) scale(.99); } }

	.shelf-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 20px 14px; border-bottom: 1px solid rgba(98,80,70,.1); }
	.shelf-head h2 { margin: 0; color: #4f403b; font-family: var(--font-display, Georgia, serif); font-size: 20px; font-weight: 600; }
	.shelf-head p { margin: 5px 0 0; color: #92847c; font-size: 12px; }
	.shelf-close { width: 30px; height: 30px; flex: none; border-radius: 9px; background: transparent; color: #8b7a73; font-size: 20px; line-height: 1; }
	.shelf-close:hover { background: rgba(224, 210, 200, 0.55); }

	.shelf-list { flex: 1; margin: 0; padding: 10px; list-style: none; overflow-y: auto; }
	.shelf-list li { display: flex; align-items: center; gap: 4px; padding: 3px; border-radius: 12px; }
	.shelf-list li:hover { background: rgba(238, 228, 220, 0.6); }
	.shelf-list li.open { background: rgba(219, 178, 178, 0.18); }
	.shelf-open { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 9px 11px; border-radius: 10px; background: transparent; text-align: left; }
	.shelf-open strong { color: #4f403b; font-family: var(--font-display, Georgia, serif); font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.shelf-open small { color: #988a82; font-size: 11px; }
	.shelf-badge { flex: none; padding: 2px 7px; border-radius: 999px; background: rgba(167, 102, 112, 0.16); color: #7c4a53; font-size: 9.5px; letter-spacing: .07em; text-transform: uppercase; }
	.shelf-foot { display: flex; flex-wrap: wrap; gap: 7px; padding: 14px 20px 18px; border-top: 1px solid rgba(98,80,70,.1); }

	.tab-count { margin-left: 4px; padding: 0 4px; border-radius: 5px; background: rgba(120, 96, 88, 0.16); font-size: 9.5px; font-variant-numeric: tabular-nums; }
	.place-input.wide { width: 100%; }
	.source-link { display: inline-block; margin-top: 7px; color: #8a5b63; font-size: 11px; text-decoration: none; border-bottom: 1px solid rgba(138, 91, 99, .3); }
	.source-link:hover { color: #6f454c; }

	.status-pick { gap: 5px; padding: 0 9px; }
	.status-pick.active { border-color: rgba(167, 102, 112, 0.42); background: rgba(219, 178, 178, 0.34); color: #7c4a53; }

	.swatches { display: flex; flex-wrap: wrap; gap: 6px; }
	.swatch { width: 26px; height: 26px; border: 1.5px solid rgba(98, 80, 70, 0.16); border-radius: 8px; transition: transform 130ms ease, border-color 130ms ease; }
	.swatch:hover { transform: scale(1.08); }
	.swatch.active { border-color: rgba(167, 102, 112, 0.85); box-shadow: 0 0 0 3px rgba(167, 102, 112, 0.14); }
	.swatch.tint-peach { background: rgba(246, 214, 192, 0.95); }
	.swatch.tint-lavender { background: rgba(220, 212, 240, 0.95); }
	.swatch.tint-aqua { background: rgba(199, 230, 226, 0.95); }
	.swatch.tint-gold { background: rgba(240, 224, 184, 0.95); }
	.swatch.tint-rose { background: rgba(243, 210, 216, 0.95); }
	.swatch.tint-sage { background: rgba(211, 228, 204, 0.95); }

	.stamps { display: grid; grid-template-columns: 62px 1fr; gap: 4px 10px; margin: 0; }
	.stamps dt { color: #a2948d; font-size: 10.5px; }
	.stamps dd { margin: 0; color: #6b5b55; font-size: 11.5px; }

	.finder {
		position: absolute;
		z-index: 88;
		left: 50%;
		top: 84px;
		display: flex;
		flex-direction: column;
		width: min(560px, calc(100vw - 44px));
		max-height: calc(100vh - 180px);
		border: 1px solid rgba(98, 80, 70, 0.16);
		border-radius: 16px;
		background: rgba(255, 253, 248, 0.95);
		box-shadow: 0 18px 46px rgba(70, 52, 44, 0.2), inset 0 1px rgba(255,255,255,.9);
		backdrop-filter: blur(18px);
		transform: translateX(-50%);
		animation: finder-in 200ms ease both;
	}
	@keyframes finder-in { from { opacity: 0; transform: translate(-50%, -10px); } }

	.finder-field { display: flex; align-items: center; gap: 7px; padding: 9px 9px 9px 13px; }
	.finder-mark { color: #a4938b; font-size: 16px; line-height: 1; }
	.finder-field input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: #4c403c;
		font-family: var(--font-display, Georgia, serif);
		font-size: 16px;
		outline: none;
	}
	.finder-field input::placeholder { color: #b4a7a0; font-family: var(--font-body, sans-serif); font-size: 14px; }
	.finder-close { width: 26px; height: 26px; flex: none; border-radius: 8px; background: transparent; color: #8b7a73; font-size: 18px; line-height: 1; }
	.finder-close:hover { background: rgba(224, 210, 200, 0.55); }

	.finder-results { margin: 0; padding: 4px 6px 6px; list-style: none; overflow-y: auto; border-top: 1px solid rgba(98,80,70,.1); }
	.finder-result {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 7px 9px;
		border-radius: 10px;
		background: transparent;
		text-align: left;
	}
	.finder-result.current { background: rgba(219, 178, 178, 0.28); }
	.finder-kind { flex: none; color: #a4938b; font-size: 12px; }
	.finder-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
	.finder-text strong { color: #4f403b; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.finder-text small { color: #988a82; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.finder-where { flex: none; color: #b0a29b; font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase; }
	.finder-hint { margin: 0; padding: 10px 13px 12px; border-top: 1px solid rgba(98,80,70,.08); color: #a2948d; font-size: 11px; }
	.finder-hint code { padding: 1px 4px; border-radius: 4px; background: rgba(120,96,88,.1); font-size: 10.5px; }
	.finder-empty { margin: 0; padding: 16px 13px 18px; border-top: 1px solid rgba(98,80,70,.1); color: #9c8e87; font-size: 12px; font-style: italic; text-align: center; }

	.shortcuts {
		position: absolute;
		z-index: 74;
		right: 22px;
		bottom: 76px;
		width: 232px;
		padding: 13px 15px 15px;
		border: 1px solid rgba(98, 80, 70, 0.14);
		border-radius: 14px;
		background: rgba(255, 253, 248, 0.95);
		box-shadow: 0 12px 34px rgba(76,57,48,.15);
		backdrop-filter: blur(14px);
	}
	.shortcuts h3 { margin: 0 0 9px; color: #6d5c56; font-family: var(--font-display, Georgia, serif); font-size: 13px; font-weight: 600; }
	.shortcuts dl { display: grid; grid-template-columns: 58px 1fr; gap: 5px 9px; margin: 0; }
	.shortcuts dt { color: #7c6a63; font-size: 10.5px; font-variant-numeric: tabular-nums; }
	.shortcuts dd { margin: 0; color: #948680; font-size: 10.5px; }

	@media (max-width: 1360px) {
		/* The eyebrow is the first thing worth losing to keep the top one row. */
		.board-name span { display: none; }
	}

	@media (max-width: 1120px) {
		/* The breadcrumb drops to its own line before anything has to shrink. */
		.location-bar { order: 3; }
		.topbar { flex: 1 1 auto; }
	}

	@media (max-width: 650px) {
		.top-deck { left: 12px; right: 12px; top: 12px; gap: 7px; }
		.save-status { display: none; }
		/* The eyebrow is decoration; the title needs every pixel it can have. */
		.board-name { flex: 1 1 auto; }
		.board-name span { display: none; }
		.board-name input { min-width: 0; width: 100%; }
		/* Pinned between the left edge and the camera controls rather than
		   centred, so the two can never land on top of each other. */
		.tool-dock { left: 12px; right: 158px; bottom: 12px; max-width: none; overflow-x: auto; transform: none; }
		.tool-button { padding: 0 8px; }
		.tool-button span { display: none; }
		.camera-controls { right: 12px; bottom: 12px; grid-template-columns: repeat(4, 31px); }
		.camera-controls button { width: 31px; height: 31px; }
		.camera-controls span,
		.camera-controls .help-button { display: none; }
		.location-bar { max-width: 100%; }
		.crumb { max-width: 118px; }
		.scale-word { display: none; }
		.rail-button { padding: 0 7px; font-size: 0; gap: 0; }
		.rail-button span { font-size: 15px; }
		.drawer { top: 112px; right: 12px; bottom: 66px; width: calc(100vw - 24px); }
		.minimap-shell { display: none; }
		.shortcuts { right: 12px; bottom: 60px; }
		.board-actions { padding-left: 6px; gap: 3px; }
		.shelf-list li { flex-wrap: wrap; }
	}

	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
	}
</style>
