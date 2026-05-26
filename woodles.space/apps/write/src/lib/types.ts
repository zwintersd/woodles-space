export type LayerId = 'foreground' | 'midground' | 'background';
export type PocketLayer = 'midground' | 'background';
export type PocketsOrder = 'oldest' | 'newest';

export interface PocketNote {
	id: string;
	html: string;
	layer: PocketLayer;
	createdAt: string;
	updatedAt: string;
}

export interface MarginNote {
	id: string;
	anchorId: string;
	html: string;
	createdAt: string;
	updatedAt: string;
}

export function pocketLayerLabel(layer: PocketLayer): string {
	return layer === 'midground' ? 'mg' : 'bg';
}

export function newId(prefix: string): string {
	return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}
