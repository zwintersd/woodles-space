export type Spore = {
	id: string;
	title: string;
	body: string;
	data: Record<string, unknown>;
	spellbookIds: string[];
	created: string;
	updated: string;
};

export type Spellbook = {
	id: string;
	title: string;
	archetype: 'plain' | 'diary' | 'media' | string;
	created: string;
	updated: string;
};

export type Flight = {
	id: string;
	from: string;
	to: string;
	label?: string;
	created: string;
};

export type GardenSettings = {
	passphrase?: string;
	customCategories?: import('./spells/types').Category[];
};

export type GardenBlob = {
	spores: Spore[];
	spellbooks: Spellbook[];
	flights: Flight[];
	settings: GardenSettings;
};

export type GardenView = 'garden' | 'spellbook' | 'spore' | 'spell';
