export interface DevlogEntry {
	id: string;
	date: string; // ISO date YYYY-MM-DD
	title: string;
	blocks: Block[];
	createdAt: string;
	updatedAt: string;
}

export type Block =
	| ProseBlock
	| CreatureBlock
	| BiomeBlock
	| AbilityBlock
	| StatBlock
	| MinigameBlock
	| LoreBlock;

export type BlockType = Block['type'];

export interface ProseBlock {
	type: 'prose';
	id: string;
	content: string;
}

export interface SmartLink {
	kind: 'creature' | 'biome' | 'ability' | 'stat' | 'minigame' | 'lore';
	label: string;
}

export interface CreatureBlock {
	type: 'creature';
	id: string;
	name: string;
	biome: SmartLink | null;
	loreFragment: string;
	interventionBehavior: string;
	visualNotes: string;
	relationships: string;
}

export interface BiomeBlock {
	type: 'biome';
	id: string;
	name: string;
	hexGridPosition: string;
	climateMood: string;
	nativeCreatures: SmartLink[];
	mechanicExpression: string;
	atmosphereNotes: string;
}

export interface AbilityBlock {
	type: 'ability';
	id: string;
	name: string;
	mechanicalEffect: string;
	tiedTo: SmartLink[];
	narrativeJustification: string;
	costLimitation: string;
}

export interface StatBlock {
	type: 'stat';
	id: string;
	name: string;
	narrativeMeaning: string;
	highExamples: string;
	lowExamples: string;
	crossRpgEquivalents: string;
	operationalizationIdeas: string;
}

export interface MinigameBlock {
	type: 'minigame';
	id: string;
	name: string;
	purpose: string;
	coreLoop: string;
	winFailState: string;
	feelsLike: string;
	statsOperationalized: SmartLink[];
	openQuestions: string;
}

export interface LoreBlock {
	type: 'lore';
	id: string;
	title: string;
	content: string;
	tags: string[];
}

export interface DevlogBlob {
	entries: DevlogEntry[];
}
