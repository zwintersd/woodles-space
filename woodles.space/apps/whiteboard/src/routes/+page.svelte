<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { getImageAsset, imageDimensions, imageStorageAvailable, removeImageAsset, saveImageAsset } from '$lib/assets';
	import {
	boundsForItem,
	connectorEndpoints,
	documentBounds,
	extractCardFromStack,
	fitCamera,
	insertCardIntoStack,
	intersects,
	normalizeBounds,
	reorderStackCard,
	removeItems,
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
	makeId,
	nextZ,
	now,
	snapshotDocument,
	type Bounds,
	type Camera,
	type CardItem,
	type FrameItem,
	type StackItem,
	type WhiteboardDocument,
	type WhiteboardItem
	} from '$lib/model';
	import { restoreWhiteboard, whiteboardStorage } from '$lib/persistence';

	type Tool = 'select' | 'frame' | 'stack' | 'line';
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

	function viewport(): { width: number; height: number } {
		const rect = canvasEl?.getBoundingClientRect();
		return { width: rect?.width ?? window.innerWidth, height: rect?.height ?? window.innerHeight };
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
		const result = whiteboardStorage.save(snapshotDocument(board));
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
		const result = whiteboardStorage.load();
		board = restoreWhiteboard(result.value);
		if (result.source === 'backup') {
			saveState = 'recovered';
			saveMessage = 'restored the last saved board';
		} else if (result.issue) {
			saveState = 'error';
			saveMessage = result.issue.message;
		} else if (result.source === 'primary') {
			saveState = 'saved';
			saveMessage = 'saved here';
		}
		loaded = true;
		void hydrateImages();
		const onBeforeUnload = () => saveNow();
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload);
			saveNow();
		};
	});

	onDestroy(() => {
		if (cameraAnimation) cancelAnimationFrame(cameraAnimation);
		if (pointerMoveFrame) cancelAnimationFrame(pointerMoveFrame);
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

	function handleCanvasPointerDown(event: PointerEvent) {
		if (targetHasUI(event.target)) return;
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

	function updateStack(item: StackItem, value: string) {
		updateItem(item.id, { title: value }, true);
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
		interruptCameraAnimation();
		const factor = Math.exp(-event.deltaY * 0.00125);
		board.camera = zoomAroundPoint(board.camera, localPoint(event), board.camera.zoom * factor);
		scheduleSave(540);
	}

	function interruptCameraAnimation() {
		if (cameraAnimation) cancelAnimationFrame(cameraAnimation);
		cameraAnimation = 0;
	}

	function animateCamera(target: Camera) {
		interruptCameraAnimation();
		const start = { ...board.camera };
		const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion) {
			board.camera = target;
			scheduleSave();
			return;
		}
		const startAt = performance.now();
		const duration = 460;
		const ease = (value: number) => 1 - Math.pow(1 - value, 4);
		const step = (time: number) => {
			const amount = Math.min(1, (time - startAt) / duration);
			const t = ease(amount);
			board.camera = {
				x: start.x + (target.x - start.x) * t,
				y: start.y + (target.y - start.y) * t,
				zoom: start.zoom + (target.zoom - start.zoom) * t
			};
			markDirty();
			if (amount < 1) cameraAnimation = requestAnimationFrame(step);
			else {
				cameraAnimation = 0;
				scheduleSave();
			}
		};
		cameraAnimation = requestAnimationFrame(step);
	}

	function focusFrame(item: FrameItem) {
		const bounds = itemBounds(item);
		animateCamera(fitCamera(bounds, viewport(), 100));
		selectOnly(item.id);
	}

	function goHome() {
		const bounds = documentBounds(board);
		if (bounds) animateCamera(fitCamera(bounds, viewport(), 120));
		else {
			const size = viewport();
			animateCamera({ x: size.width / 2, y: size.height / 2, zoom: 1 });
		}
	}

	function changeZoom(multiplier: number) {
		const size = viewport();
		board.camera = zoomAroundPoint(board.camera, { x: size.width / 2, y: size.height / 2 }, board.camera.zoom * multiplier);
		scheduleSave();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.code === 'Space' && !isTextTarget(event.target)) {
			spaceHeld = true;
			event.preventDefault();
		}
		if (isTextTarget(event.target)) return;
		if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length) {
			event.preventDefault();
			deleteSelection();
		}
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
			event.preventDefault();
			duplicateSelection();
		}
		if (event.key === 'Escape') {
			tool = 'select';
			connectorSourceId = null;
			renamingFrameId = null;
			notice = '';
			cancelPointerSession();
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
					class:peach={item.tint === 'peach'}
					class:lavender={item.tint === 'lavender'}
					class:aqua={item.tint === 'aqua'}
					class:gold={item.tint === 'gold'}
					class="board-item frame"
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
					class="board-item stack"
					style={itemStyle(item)}
					role="group"
					aria-label={`Stack: ${item.title || 'Untitled stack'}`}
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
						<span class="stack-count">{item.cardIds.length || ''}</span>
					</div>
					{#if item.cardIds.length === 0}
						<p class="stack-empty">drag a card in</p>
					{/if}
					{#if isSelected(item.id)}
						<button data-whiteboard-ui class="resize-handle" aria-label="Resize stack" onpointerdown={(event) => startResize(event, item)}></button>
					{/if}
				</section>
			{:else if item.type === 'card'}
				<section
					data-whiteboard-object
					class:selected={isSelected(item.id)}
					class:dragging={draggingIds.includes(item.id)}
					class:in-stack={Boolean(item.stackId)}
					class="board-item card"
					style={itemStyle(item)}
					role="group"
					aria-label={`Card: ${item.title || 'Untitled card'}`}
					onpointerdown={(event) => handleItemPointerDown(event, item)}
					ondblclick={(event) => handleItemDoubleClick(event, item)}
				>
					<div class="card-topline" aria-hidden="true"></div>
					<span class="card-grip" aria-hidden="true">⠿</span>
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
					{#if isSelected(item.id)}
						<button data-whiteboard-ui class="resize-handle" aria-label="Resize card" onpointerdown={(event) => startResize(event, item)}></button>
					{/if}
				</section>
			{:else if item.type === 'image'}
				<section
					data-whiteboard-object
					class:selected={isSelected(item.id)}
					class:dragging={draggingIds.includes(item.id)}
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

	{#if !hasContent}
		<div class="empty-whisper" aria-hidden="true">
			<span class="empty-mark">✦</span>
			<p>double-click anywhere to begin</p>
			<small>drag images in · hold Space to move</small>
		</div>
	{/if}

	<header class="topbar" data-whiteboard-ui>
		<a class="back-link" href="/" aria-label="Back to Woodles">←</a>
		<div class="board-name">
			<span>Whiteboard</span>
			<input
				aria-label="Whiteboard title"
				value={board.board.title}
				oninput={(event) => { board.board.title = (event.currentTarget as HTMLInputElement).value; board.updatedAt = now(); scheduleSave(); }}
			/>
		</div>
		<p class:warning={saveState === 'error'} class="save-status" aria-live="polite">
			<span class:working={saveState === 'saving'} class="save-dot"></span>{saveMessage}
		</p>
	</header>

	<div class="tool-dock" data-whiteboard-ui aria-label="Whiteboard tools">
		<button class="tool-button" aria-label="Add card" title="Card" onclick={addCardFromDock}><span aria-hidden="true">□</span>Card</button>
		<button class="tool-button" aria-label="Add image" title="Image" onclick={() => imageInput?.click()}><span aria-hidden="true">▧</span>Image</button>
		<button class:active={tool === 'frame'} class="tool-button" aria-pressed={tool === 'frame'} title="Draw a frame" onclick={() => { tool = tool === 'frame' ? 'select' : 'frame'; connectorSourceId = null; notice = tool === 'frame' ? 'Drag a region for a frame.' : ''; }}><span aria-hidden="true">▢</span>Frame</button>
		<button class="tool-button" aria-label="Add stack" title="Stack" onclick={addStackFromDock}><span aria-hidden="true">▤</span>Stack</button>
		<button class:active={tool === 'line'} class="tool-button" aria-pressed={tool === 'line'} title="Connect two ideas" onclick={() => { tool = tool === 'line' ? 'select' : 'line'; connectorSourceId = null; notice = tool === 'line' ? 'Choose the first idea.' : ''; }}><span aria-hidden="true">⟶</span>Line</button>
	</div>

	<div class="camera-controls" data-whiteboard-ui aria-label="Camera controls">
		<button aria-label="Zoom in" title="Zoom in" onclick={() => changeZoom(1.2)}>+</button>
		<button aria-label="Zoom out" title="Zoom out" onclick={() => changeZoom(1 / 1.2)}>−</button>
		<button class="home-button" aria-label="Fit board in view" title="Fit board" onclick={goHome}>⌾</button>
		<span>{zoomLabel()}</span>
	</div>

	{#if notice}
		<p class="notice" data-whiteboard-ui>{notice}</p>
	{/if}
	{#if tool === 'frame'}
		<p class="mode-note" data-whiteboard-ui>drag to make a frame</p>
	{:else if tool === 'line' && connectorSourceId}
		<p class="mode-note" data-whiteboard-ui>choose the other end</p>
	{/if}

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

	.frame.lavender { background: rgba(204, 193, 232, 0.18); border-color: rgba(113, 94, 150, 0.28); }
	.frame.aqua { background: rgba(172, 220, 216, 0.18); border-color: rgba(66, 136, 133, 0.26); }
	.frame.gold { background: rgba(236, 215, 166, 0.2); border-color: rgba(161, 124, 51, 0.26); }

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

	.stack-count { color: #9a8d86; font-size: 12px; min-width: 10px; text-align: right; }
	.stack-empty { margin: 22px 14px; color: #a69a93; font-size: 12px; font-style: italic; }

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

	.topbar {
		position: absolute;
		z-index: 70;
		top: 20px;
		left: 22px;
		display: flex;
		align-items: center;
		gap: 13px;
		max-width: min(620px, calc(100vw - 44px));
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
		grid-template-columns: 35px 35px 35px auto;
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

	@media (max-width: 650px) {
		.topbar { left: 12px; top: 12px; max-width: calc(100vw - 24px); }
		.save-status { display: none; }
		.tool-dock { bottom: 12px; max-width: calc(100vw - 120px); overflow-x: auto; }
		.tool-button { padding: 0 8px; }
		.tool-button span { display: none; }
		.camera-controls { right: 12px; bottom: 12px; grid-template-columns: 31px 31px 31px; }
		.camera-controls button { width: 31px; height: 31px; }
		.camera-controls span { display: none; }
	}

	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
	}
</style>
