// Read-only access to the Bestiary app's IndexedDB store, plus the public
// gallery as a fallback (ROADMAP.md week 5) so the witch's world isn't empty
// just because a visitor hasn't drawn anything of their own yet.
//
// Both apps share the same origin (woodles.space), so Marginalia can open the
// 'bestiary' database directly and read the creature list. This file only
// ever reads from Bestiary's own store — it never writes to it. The published
// snapshot lives in a separate, marginalia-owned cache instead, so a repeat
// visit still has Z's showcase to offer even offline.

import type { Creature } from '@bestiary/types';
import {
	pullPublic,
	BESTIARY_PUBLIC_SLUG,
	type BestiaryPublicBlob,
	type PublicCreature
} from '@woodles/sync';

const DB_NAME = 'bestiary';
const STORE = 'kv';
const CREATURES_KEY = 'bestiary.creatures.v1';

export type BestiaryCreature = Creature;

function openBestiaryDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) {
				req.result.createObjectStore(STORE);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

// Local-only — Z's own device, or a visitor who has drawn something in this
// browser. Used as-is by the arcade's companion picker and the hex-stage dev
// preview, which stay deliberately local-only.
export async function getBestiaryCreatures(): Promise<BestiaryCreature[]> {
	if (typeof indexedDB === 'undefined') return [];
	try {
		const db = await openBestiaryDb();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE, 'readonly');
			const req = tx.objectStore(STORE).get(CREATURES_KEY);
			req.onsuccess = () => resolve((req.result as BestiaryCreature[] | undefined) ?? []);
			req.onerror = () => resolve([]);
		});
	} catch {
		return [];
	}
}

// ── the published fallback ──────────────────────────────────────────────
//
// A small cache marginalia owns outright (never Bestiary's own store), keyed
// by one snapshot. A visitor who was online for their first visit keeps
// seeing Z's showcase on later, offline ones; a fresh publish simply
// overwrites it next time they're online.

const CACHE_DB_NAME = 'marginalia-public-cache';
const CACHE_STORE = 'kv';
const CACHE_KEY = 'bestiary.published.creatures.v1';

function openCacheDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(CACHE_DB_NAME, 1);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(CACHE_STORE)) {
				req.result.createObjectStore(CACHE_STORE);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function readCachedPublished(): Promise<PublicCreature[]> {
	if (typeof indexedDB === 'undefined') return [];
	try {
		const db = await openCacheDb();
		return await new Promise((resolve) => {
			const tx = db.transaction(CACHE_STORE, 'readonly');
			const req = tx.objectStore(CACHE_STORE).get(CACHE_KEY);
			req.onsuccess = () => resolve((req.result as PublicCreature[] | undefined) ?? []);
			req.onerror = () => resolve([]);
		});
	} catch {
		return [];
	}
}

async function writeCachedPublished(creatures: PublicCreature[]): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	try {
		const db = await openCacheDb();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(CACHE_STORE, 'readwrite');
			tx.objectStore(CACHE_STORE).put(creatures, CACHE_KEY);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
	} catch {
		// best-effort — a visitor's world still works without the cache, just
		// not offline on a later visit.
	}
}

// Never throws: a visitor with no network and no cache yet simply gets [],
// same as "nothing published" — the world falls through to unbound placeholders.
async function getPublishedCreatures(): Promise<PublicCreature[]> {
	try {
		const snap = await pullPublic<BestiaryPublicBlob>('bestiary', BESTIARY_PUBLIC_SLUG);
		const creatures = snap.blob?.creatures ?? [];
		if (creatures.length > 0) void writeCachedPublished(creatures);
		return creatures;
	} catch {
		return readCachedPublished();
	}
}

// ── the world's pool: yours, plus Z's showcase ──────────────────────────
//
// The minimal shape the diorama needs to show a bound sprite — satisfied
// structurally by both a real (local) Creature and a published snapshot's
// PublicCreature, tagged so the binding UI can say which is which.

export type WorldCreatureSource = 'local' | 'published';

export interface WorldCreature {
	id: string;
	name: string;
	sprite: string | null;
	isolatedSprite?: string | null;
	pixelated: boolean;
	source: WorldCreatureSource;
}

// The common structural shape every sprite-displaying component actually
// needs (MiniHex, the card art preview) — satisfied by BestiaryCreature,
// WorldCreature, or any future source, with no cast required at the call site.
export interface SpriteCreature {
	name: string;
	sprite: string | null;
	isolatedSprite?: string | null;
	pixelated: boolean;
}

function toLocalWorldCreature(c: BestiaryCreature): WorldCreature {
	return {
		id: c.id,
		name: c.name,
		sprite: c.sprite,
		isolatedSprite: c.isolatedSprite,
		pixelated: c.pixelated,
		source: 'local'
	};
}

function toPublishedWorldCreature(c: PublicCreature): WorldCreature {
	// the public blob resolves isolatedSprite ?? sprite into one field at
	// publish time (ROADMAP.md week 1) — but MiniHex still needs to tell a
	// true studio cutout (float mode) from a card-only flat sprite (portal
	// mode) apart, exactly as it already does for a local Creature. Route the
	// one resolved image back into whichever field matches its real nature —
	// missing hasIsolatedSprite (pre-field blobs) reads as isolated, the
	// common case.
	const isolated = c.hasIsolatedSprite ?? true;
	return {
		id: c.id,
		name: c.name,
		sprite: isolated ? null : c.isolatedSprite,
		isolatedSprite: isolated ? c.isolatedSprite : null,
		pixelated: c.pixelated ?? false,
		source: 'published'
	};
}

// Pure — no I/O — so it's plain-testable. Local bestiary creatures first
// (Z's own device, or any visitor who has drawn something), then the
// published snapshot fills in the rest, so the world isn't empty just
// because you haven't made anything yet. A creature that is both yours *and*
// published (Z's own device) shows once, as yours — never twice.
export function mergeWorldCreatures(
	local: BestiaryCreature[],
	published: PublicCreature[]
): WorldCreature[] {
	const localIds = new Set(local.map((c) => c.id));
	return [
		...local.map(toLocalWorldCreature),
		...published.filter((c) => !localIds.has(c.id)).map(toPublishedWorldCreature)
	];
}

// `local` is passed in rather than re-fetched here so a caller that already
// has it (book.svelte.ts refreshes both pools together) doesn't open the
// Bestiary IndexedDB twice.
export async function getWorldCreatures(local: BestiaryCreature[]): Promise<WorldCreature[]> {
	const published = await getPublishedCreatures();
	return mergeWorldCreatures(local, published);
}
