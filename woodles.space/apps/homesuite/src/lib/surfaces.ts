import { entityHref } from '@woodles/app-manifest';
import {
	createDraftId,
	listDrafts,
	removeDraftBody,
	clearActiveDraftId,
	getActiveDraftId,
	prepareHomeSuiteDrafts,
	saveDraft,
	upsertIndex,
	writeIndex
} from '../../../write/src/lib/drafts';
import { boardLibrary } from '../../../whiteboard/src/lib/library';
import { removeImageAsset } from '../../../whiteboard/src/lib/assets';
import { isHomeSuiteTrashed, listHomeSuiteTrash, type HomeSuiteTrashEntry } from '@shared/homesuiteTrash';
import type { HomeSuiteArtifactKind, WoodlesRef } from '@shared/homesuiteBridge';
import {
	COLLECTION_TEMPLATES,
	createCollection,
	loadCollections,
	removeCollection,
	saveCollection
} from '../../../data/src/lib/collections';

export type HomeSuiteArtifact = {
	ref: WoodlesRef;
	kind: HomeSuiteArtifactKind;
	title: string;
	updatedAt: string;
	recordCount?: number;
	/** Open, but in HomeSuite's Trash — a portal can walk into a trashed board. */
	inTrash?: boolean;
};

export type HomeSuiteTemplate = { id: string; name: string; detail: string };

export type HomeSuiteSurfaceAdapter = {
	kind: HomeSuiteArtifactKind;
	label: string;
	plural: string;
	/** The owning app, and the record kind it answers to in `entityHref`. */
	app: string;
	refKind: string;
	appName: string;
	glyph: string;
	/** What the strip above the frame calls the surface. */
	surfaceLabel: string;
	/** What you select something on, for the empty inspector. */
	selectionPlace: string;
	/** Shapes to start from; when present, New asks which one. */
	templates?: readonly HomeSuiteTemplate[];
	list: () => HomeSuiteArtifact[];
	create: (template?: string) => HomeSuiteArtifact;
	embedHref: (id: string) => string;
	permanentlyDelete: (id: string) => Promise<void> | void;
	/** Something the index should say about this kind's storage, if anything. */
	notice?: () => string | null;
};

function refFor(app: string, kind: string, id: string): WoodlesRef {
	return { app, kind, id };
}

/** Let each owning app continue to define storage, creation, and deep links. */
export const surfaces: readonly HomeSuiteSurfaceAdapter[] = [
	{
		kind: 'document',
		label: 'Document',
		plural: 'Documents',
		app: 'write',
		refKind: 'draft',
		appName: 'Write',
		glyph: '¶',
		surfaceLabel: 'Writing surface',
		selectionPlace: 'page',
		list: () => listDrafts().filter((draft) => !isHomeSuiteTrashed(refFor('write', 'draft', draft.id))).map((draft) => ({
			ref: refFor('write', 'draft', draft.id),
			kind: 'document',
			title: draft.title.trim() || 'Untitled document',
			updatedAt: draft.updatedAt
		})),
		// Not made Write's active draft: standalone Write keeps opening what it
		// had open, whatever HomeSuite creates.
		create: () => {
			const id = createDraftId();
			const updatedAt = new Date().toISOString();
			saveDraft(id, { title: '', kind: 'note' });
			writeIndex(upsertIndex(listDrafts(), id, '', updatedAt, { kind: 'note' }));
			return { ref: refFor('write', 'draft', id), kind: 'document', title: 'Untitled document', updatedAt };
		},
		embedHref: (id) => `${entityHref('write', 'draft', id)}&homesuite=1`,
		permanentlyDelete: (id) => {
			removeDraftBody(id);
			writeIndex(listDrafts().filter((draft) => draft.id !== id));
			if (getActiveDraftId() === id) clearActiveDraftId();
		}
	},
	{
		kind: 'board',
		label: 'Board',
		plural: 'Boards',
		app: 'whiteboard',
		refKind: 'board',
		appName: 'Whiteboard',
		glyph: '▧',
		surfaceLabel: 'Canvas',
		selectionPlace: 'board',
		list: () => boardLibrary.list().filter((board) => !isHomeSuiteTrashed(refFor('whiteboard', 'board', board.id))).map((board) => ({
			ref: refFor('whiteboard', 'board', board.id),
			kind: 'board',
			title: board.title.trim() || 'Untitled board',
			updatedAt: board.updatedAt
		})),
		create: () => {
			// `create` makes the new board Whiteboard's active one; standalone
			// Whiteboard should keep opening what it had open.
			const previous = boardLibrary.activeId();
			const board = boardLibrary.create('Untitled board');
			if (previous) boardLibrary.setActiveId(previous);
			else boardLibrary.clearActiveId();
			return {
				ref: refFor('whiteboard', 'board', board.board.id),
				kind: 'board',
				title: board.board.title,
				updatedAt: board.updatedAt
			};
		},
		embedHref: (id) => `${entityHref('whiteboard', 'board', id)}&homesuite=1`,
		permanentlyDelete: async (id) => {
			const doomed = boardLibrary.open(id);
			const spokenFor = boardLibrary.referencedAssets(id);
			boardLibrary.remove(id);
			for (const item of doomed?.document.items ?? []) {
				if (item.type === 'image' && !spokenFor.has(item.assetId)) await removeImageAsset(item.assetId).catch(() => undefined);
			}
		}
	},
	{
		kind: 'collection',
		label: 'Collection',
		plural: 'Collections',
		app: 'data',
		refKind: 'collection',
		appName: 'Data',
		glyph: '▦',
		surfaceLabel: 'Table',
		selectionPlace: 'table',
		templates: COLLECTION_TEMPLATES,
		list: () => loadCollections().collections.map((collection) => ({
			ref: refFor('data', 'collection', collection.id), kind: 'collection' as const,
			title: collection.title, updatedAt: collection.updatedAt, recordCount: collection.records.length
		})).filter((item) => !isHomeSuiteTrashed(item.ref)),
		create: (templateId = 'blank') => {
			const template = COLLECTION_TEMPLATES.find((entry) => entry.id === templateId);
			if (!template) throw new Error('That Collection template is not available.');
			const collection = createCollection(template.title, template.id);
			const result = saveCollection(collection);
			if (!result.ok) throw new Error(result.issue?.message ?? 'Could not create Collection.');
			return { ref: refFor('data', 'collection', collection.id), kind: 'collection', title: collection.title, updatedAt: collection.updatedAt, recordCount: 0 };
		},
		embedHref: (id) => `${entityHref('data', 'collection', id)}&homesuite=1`,
		permanentlyDelete: (id) => {
			const result = removeCollection(id);
			if (!result.ok) throw new Error(result.issue?.message ?? 'Could not delete this Collection.');
		},
		notice: () => loadCollections().issue?.message ?? null
	}
];

export type TrashedHomeSuiteArtifact = HomeSuiteTrashEntry;

export function prepareSurfaceStorage(): void {
	// These are the apps' own one-time migrations. HomeSuite can then show the
	// same library each app would show after opening it directly.
	prepareHomeSuiteDrafts();
	boardLibrary.adoptLegacyBoard();
}

export function listArtifacts(): HomeSuiteArtifact[] {
	return surfaces.flatMap((surface) => surface.list())
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listTrashedArtifacts(): TrashedHomeSuiteArtifact[] {
	return listHomeSuiteTrash().sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
}

export function surfaceFor(kind: string): HomeSuiteSurfaceAdapter | undefined {
	return surfaces.find((surface) => surface.kind === kind);
}

/** The surface that shows a ref, if HomeSuite has one for it. */
export function surfaceForRef(ref: WoodlesRef): HomeSuiteSurfaceAdapter | undefined {
	return surfaces.find((surface) => surface.app === ref.app && surface.refKind === ref.kind);
}
