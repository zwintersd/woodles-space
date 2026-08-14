export const BOARD_SCHEMA_VERSION = 2;
const MIN_CAMERA_ZOOM = 0.1;
const MAX_CAMERA_ZOOM = 4;

export type WhiteboardItemType = 'card' | 'image' | 'frame' | 'stack' | 'connector';

export type Camera = {
	x: number;
	y: number;
	zoom: number;
};

export type Bounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export interface BaseWhiteboardItem extends Bounds {
	id: string;
	type: WhiteboardItemType;
	zIndex: number;
	createdAt: string;
	updatedAt: string;
}

export interface CardItem extends BaseWhiteboardItem {
	type: 'card';
	title: string;
	body: string;
	stackId?: string;
	freePosition?: { x: number; y: number };
}

export interface ImageItem extends BaseWhiteboardItem {
	type: 'image';
	assetId: string;
	name: string;
	aspectRatio: number;
}

export interface FrameItem extends BaseWhiteboardItem {
	type: 'frame';
	title: string;
	tint: string;
}

export interface StackItem extends BaseWhiteboardItem {
	type: 'stack';
	title: string;
	cardIds: string[];
}

export interface ConnectorItem extends BaseWhiteboardItem {
	type: 'connector';
	fromId: string;
	toId: string;
	arrow: boolean;
}

export type WhiteboardItem = CardItem | ImageItem | FrameItem | StackItem | ConnectorItem;

/** A camera the board remembers by name, so a place can be returned to exactly. */
export type Viewpoint = {
	id: string;
	name: string;
	camera: Camera;
	createdAt: string;
};

/**
 * One stop on a journey. A stop points at something that already exists on the
 * board rather than storing a camera of its own, so moving a frame moves the
 * stop with it. Viewpoint stops are the exception: those *are* a camera.
 */
export type JourneyStop = {
	id: string;
	target:
		| { kind: 'item'; id: string }
		| { kind: 'viewpoint'; id: string }
		| { kind: 'board' };
	/** Seconds to rest here before Play moves on. */
	hold: number;
};

export type Journey = {
	stops: JourneyStop[];
	loop: boolean;
};

export type WhiteboardDocument = {
	board: {
		id: string;
		title: string;
	};
	items: WhiteboardItem[];
	camera: Camera;
	/** Where Home lands. Null means "wherever the board currently fits". */
	home: Camera | null;
	viewpoints: Viewpoint[];
	journey: Journey;
	updatedAt: string;
};

const CARD_WIDTH = 250;
const CARD_HEIGHT = 150;
const FRAME_TINTS = ['peach', 'lavender', 'aqua', 'gold'] as const;

export function now(): string {
	return new Date().toISOString();
}

export function makeId(prefix: string): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${prefix}-${crypto.randomUUID()}`;
	}
	return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function base<T extends WhiteboardItemType>(
	type: T,
	x: number,
	y: number,
	width: number,
	height: number,
	zIndex: number
): Omit<BaseWhiteboardItem, 'type'> & { type: T } {
	const stamp = now();
	return { id: makeId(type), type, x, y, width, height, zIndex, createdAt: stamp, updatedAt: stamp };
}

export function createEmptyBoard(): WhiteboardDocument {
	return {
		board: { id: makeId('board'), title: 'Untitled whiteboard' },
		items: [],
		camera: { x: 180, y: 120, zoom: 1 },
		home: null,
		viewpoints: [],
		journey: { stops: [], loop: false },
		updatedAt: now()
	};
}

export const DEFAULT_STOP_HOLD = 4;

export function createViewpoint(name: string, camera: Camera): Viewpoint {
	return { id: makeId('view'), name: name.trim() || 'Untitled view', camera: { ...camera }, createdAt: now() };
}

export function createStop(target: JourneyStop['target'], hold = DEFAULT_STOP_HOLD): JourneyStop {
	return { id: makeId('stop'), target, hold: clampHold(hold) };
}

export function clampHold(seconds: number): number {
	if (!Number.isFinite(seconds)) return DEFAULT_STOP_HOLD;
	return Math.min(30, Math.max(1, Math.round(seconds)));
}

export function createCard(x: number, y: number, zIndex = nextZ([])): CardItem {
	return {
		...base('card', x, y, CARD_WIDTH, CARD_HEIGHT, zIndex),
		title: '',
		body: ''
	};
}

export function createFrame(x: number, y: number, width = 500, height = 360, zIndex = 1): FrameItem {
	return {
		...base('frame', x, y, Math.max(120, width), Math.max(100, height), zIndex),
		title: 'New frame',
		tint: FRAME_TINTS[Math.floor(Math.random() * FRAME_TINTS.length)]
	};
}

export function createStack(x: number, y: number, zIndex = nextZ([])): StackItem {
	return {
		...base('stack', x, y, 280, 290, zIndex),
		title: 'New stack',
		cardIds: []
	};
}

export function createImage(
	x: number,
	y: number,
	assetId: string,
	name: string,
	aspectRatio: number,
	zIndex = nextZ([])
): ImageItem {
	const width = 300;
	return {
		...base('image', x, y, width, Math.max(80, width / Math.max(0.1, aspectRatio)), zIndex),
		assetId,
		name,
		aspectRatio: Math.max(0.1, aspectRatio)
	};
}

export function createConnector(fromId: string, toId: string, zIndex = 2): ConnectorItem {
	return {
		...base('connector', 0, 0, 0, 0, zIndex),
		fromId,
		toId,
		arrow: true
	};
}

export function nextZ(items: WhiteboardItem[]): number {
	return Math.max(10, ...items.filter((item) => item.type !== 'frame').map((item) => item.zIndex + 1));
}

export function isWhiteboardDocument(value: unknown): value is WhiteboardDocument {
	if (!isRecord(value) || !isRecord(value.board) || !Array.isArray(value.items) || !isCamera(value.camera)) return false;
	if (typeof value.board.id !== 'string' || typeof value.board.title !== 'string' || typeof value.updatedAt !== 'string') return false;
	if (value.home !== null && !isCamera(value.home)) return false;
	if (!Array.isArray(value.viewpoints) || !value.viewpoints.every(isViewpoint)) return false;
	if (new Set(value.viewpoints.map((viewpoint) => viewpoint.id)).size !== value.viewpoints.length) return false;
	if (!isJourney(value.journey)) return false;
	return value.items.every(isWhiteboardItem) && new Set(value.items.map((item) => item.id)).size === value.items.length;
}

export function isViewpoint(value: unknown): value is Viewpoint {
	return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
		typeof value.createdAt === 'string' && isCamera(value.camera);
}

function isJourney(value: unknown): value is Journey {
	if (!isRecord(value) || typeof value.loop !== 'boolean' || !Array.isArray(value.stops)) return false;
	return value.stops.every(isJourneyStop) && new Set(value.stops.map((stop) => (stop as JourneyStop).id)).size === value.stops.length;
}

function isJourneyStop(value: unknown): value is JourneyStop {
	if (!isRecord(value) || typeof value.id !== 'string' || !finite(value.hold) || !isRecord(value.target)) return false;
	const target = value.target;
	if (target.kind === 'board') return true;
	return (target.kind === 'item' || target.kind === 'viewpoint') && typeof target.id === 'string';
}

export function isWhiteboardItem(value: unknown): value is WhiteboardItem {
	if (!isRecord(value) || !isBaseItem(value) || typeof value.type !== 'string') return false;
	switch (value.type) {
		case 'card':
			return typeof value.title === 'string' && typeof value.body === 'string' &&
				(value.stackId === undefined || typeof value.stackId === 'string') &&
				(value.freePosition === undefined || isPoint(value.freePosition));
		case 'image':
			return typeof value.assetId === 'string' && typeof value.name === 'string' && finite(value.aspectRatio);
		case 'frame':
			return typeof value.title === 'string' && typeof value.tint === 'string';
		case 'stack':
			return typeof value.title === 'string' && Array.isArray(value.cardIds) && value.cardIds.every((id) => typeof id === 'string');
		case 'connector':
			return typeof value.fromId === 'string' && typeof value.toId === 'string' && typeof value.arrow === 'boolean';
		default:
			return false;
	}
}

function isBaseItem(value: Record<string, unknown>): boolean {
	return typeof value.id === 'string' &&
		finite(value.x) && finite(value.y) && finite(value.width) && finite(value.height) && finite(value.zIndex) &&
		typeof value.createdAt === 'string' && typeof value.updatedAt === 'string';
}

function isCamera(value: unknown): value is Camera {
	return isRecord(value) && finite(value.x) && finite(value.y) && finite(value.zoom) && value.zoom >= MIN_CAMERA_ZOOM && value.zoom <= MAX_CAMERA_ZOOM;
}

function isPoint(value: unknown): value is { x: number; y: number } {
	return isRecord(value) && finite(value.x) && finite(value.y);
}

function finite(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Fills in everything schema 2 added. Anything unreadable is dropped rather
 * than guessed at: a board's material matters more than its navigation, so a
 * corrupt journey costs you the journey, never the board.
 */
export function upgradeDocument(value: unknown): unknown {
	if (!isRecord(value)) return value;
	const viewpoints = Array.isArray(value.viewpoints) ? value.viewpoints.filter(isViewpoint) : [];
	const journey = isJourney(value.journey) ? value.journey : { stops: [], loop: false };
	return { ...value, home: isCamera(value.home) ? value.home : null, viewpoints, journey };
}

export function snapshotDocument(document: WhiteboardDocument): WhiteboardDocument {
	return {
		board: { ...document.board },
		camera: { ...document.camera },
		home: document.home ? { ...document.home } : null,
		viewpoints: document.viewpoints.map((viewpoint) => ({ ...viewpoint, camera: { ...viewpoint.camera } })),
		journey: { loop: document.journey.loop, stops: document.journey.stops.map((stop) => ({ ...stop, target: { ...stop.target } })) },
		updatedAt: document.updatedAt,
		items: document.items.map((item) => ({
			...item,
			...(item.type === 'stack' ? { cardIds: [...item.cardIds] } : {}),
			...(item.type === 'card' && item.freePosition ? { freePosition: { ...item.freePosition } } : {})
		})) as WhiteboardItem[]
	};
}
