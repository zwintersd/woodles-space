import { entityHref } from '@woodles/app-manifest';
import {
	createDraftId,
	listDrafts,
	prepareHomeSuiteDrafts,
	saveDraft,
	setActiveDraftId,
	upsertIndex,
	writeIndex
} from '../../../write/src/lib/drafts';
import { boardLibrary } from '../../../whiteboard/src/lib/library';
import type { HomeSuiteArtifactKind, WoodlesRef } from '@shared/homesuiteBridge';
import { createCollection, loadCollections, saveCollections, type CollectionTemplate } from '../../../data/src/lib/collections';

export type HomeSuiteArtifact = {
	ref: WoodlesRef;
	kind: HomeSuiteArtifactKind;
	title: string;
	updatedAt: string;
	recordCount?: number;
};

export type HomeSuiteSurfaceAdapter = {
	kind: HomeSuiteArtifactKind;
	label: string;
	plural: string;
	list: () => HomeSuiteArtifact[];
	create: (template?: CollectionTemplate) => HomeSuiteArtifact;
	embedHref: (id: string) => string;
};

/** Let each owning app continue to define storage, creation, and deep links. */
export const surfaces: readonly HomeSuiteSurfaceAdapter[] = [
	{
		kind: 'document',
		label: 'Document',
		plural: 'Documents',
		list: () => listDrafts().map((draft) => ({
			ref: { app: 'write', kind: 'draft', id: draft.id },
			kind: 'document',
			title: draft.title.trim() || 'Untitled document',
			updatedAt: draft.updatedAt
		})),
		create: () => {
			const id = createDraftId();
			const updatedAt = new Date().toISOString();
			saveDraft(id, { title: '', kind: 'note' });
			writeIndex(upsertIndex(listDrafts(), id, '', updatedAt, { kind: 'note' }));
			setActiveDraftId(id);
			return { ref: { app: 'write', kind: 'draft', id }, kind: 'document', title: 'Untitled document', updatedAt };
		},
		embedHref: (id) => `${entityHref('write', 'draft', id)}&homesuite=1`
	},
	{
		kind: 'board',
		label: 'Board',
		plural: 'Boards',
		list: () => boardLibrary.list().map((board) => ({
			ref: { app: 'whiteboard', kind: 'board', id: board.id },
			kind: 'board',
			title: board.title.trim() || 'Untitled board',
			updatedAt: board.updatedAt
		})),
		create: () => {
			const board = boardLibrary.create('Untitled board');
			return {
				ref: { app: 'whiteboard', kind: 'board', id: board.board.id },
				kind: 'board',
				title: board.board.title,
				updatedAt: board.updatedAt
			};
		},
		embedHref: (id) => `${entityHref('whiteboard', 'board', id)}&homesuite=1`
	},
	{
		kind: 'collection', label: 'Collection', plural: 'Collections',
		list: () => loadCollections().value.collections.map((collection) => ({
			ref: { app: 'data', kind: 'collection', id: collection.id }, kind: 'collection',
			title: collection.title, updatedAt: collection.updatedAt, recordCount: collection.records.length
		})),
		create: (template = 'blank') => {
			const library = loadCollections().value;
			const collection = createCollection('Untitled collection', template);
			const result = saveCollections({ collections: [...library.collections, collection] });
			if (!result.ok) throw new Error(result.issue?.message ?? 'Could not create Collection.');
			return { ref: { app: 'data', kind: 'collection', id: collection.id }, kind: 'collection', title: collection.title, updatedAt: collection.updatedAt, recordCount: 0 };
		},
		embedHref: (id) => `${entityHref('data', 'collection', id)}&homesuite=1`
	}
];

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

export function surfaceFor(kind: string): HomeSuiteSurfaceAdapter | undefined {
	return surfaces.find((surface) => surface.kind === kind);
}
