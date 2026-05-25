export type LayerId = 'foreground' | 'midground' | 'background';
export type PocketLayer = 'midground' | 'background';

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
