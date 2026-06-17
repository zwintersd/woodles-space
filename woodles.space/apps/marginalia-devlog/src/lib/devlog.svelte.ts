import type {
	DevlogEntry,
	DevlogBlob,
	Block,
	BlockType,
	ProseBlock,
	CreatureBlock,
	BiomeBlock,
	AbilityBlock,
	StatBlock,
	MinigameBlock,
	LoreBlock
} from './types';

const STORAGE_KEY = 'woodles_devlog';

function genId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today(): string {
	return new Date().toISOString().split('T')[0];
}

function now(): string {
	return new Date().toISOString();
}

function makeBlock(type: BlockType): Block {
	const id = genId();
	switch (type) {
		case 'prose':
			return { type, id, content: '' } satisfies ProseBlock;
		case 'creature':
			return {
				type, id, name: '', biome: null,
				loreFragment: '', interventionBehavior: '', visualNotes: '', relationships: ''
			} satisfies CreatureBlock;
		case 'biome':
			return {
				type, id, name: '', hexGridPosition: '', climateMood: '',
				nativeCreatures: [], mechanicExpression: '', atmosphereNotes: ''
			} satisfies BiomeBlock;
		case 'ability':
			return {
				type, id, name: '', mechanicalEffect: '', tiedTo: [],
				narrativeJustification: '', costLimitation: ''
			} satisfies AbilityBlock;
		case 'stat':
			return {
				type, id, name: '', narrativeMeaning: '', highExamples: '',
				lowExamples: '', crossRpgEquivalents: '', operationalizationIdeas: ''
			} satisfies StatBlock;
		case 'minigame':
			return {
				type, id, name: '', purpose: '', coreLoop: '', winFailState: '',
				feelsLike: '', statsOperationalized: [], openQuestions: ''
			} satisfies MinigameBlock;
		case 'lore':
			return { type, id, title: '', content: '', tags: [] } satisfies LoreBlock;
	}
}

class DevlogStore {
	entries = $state<DevlogEntry[]>([]);
	currentEntryId = $state<string | null>(null);
	view = $state<'list' | 'entry'>('list');

	readyPromise: Promise<void>;

	constructor() {
		this.readyPromise = this.load();
	}

	private async load(): Promise<void> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const data = JSON.parse(raw) as DevlogBlob;
				this.entries = data.entries ?? [];
			}
		} catch { /* ignore */ }
	}

	save(): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toBlob()));
		} catch { /* ignore */ }
	}

	rehydrate(blob: DevlogBlob): void {
		this.entries = blob.entries ?? [];
		this.save();
	}

	toBlob(): DevlogBlob {
		return { entries: this.entries };
	}

	get currentEntry(): DevlogEntry | null {
		return this.entries.find((e) => e.id === this.currentEntryId) ?? null;
	}

	// ── entry CRUD ───────────────────────────────────────────────────────

	createEntry(): DevlogEntry {
		const entry: DevlogEntry = {
			id: genId(),
			date: today(),
			title: '',
			blocks: [makeBlock('prose')],
			createdAt: now(),
			updatedAt: now()
		};
		this.entries = [entry, ...this.entries];
		this.save();
		return entry;
	}

	openEntry(id: string): void {
		this.currentEntryId = id;
		this.view = 'entry';
	}

	closeEntry(): void {
		this.currentEntryId = null;
		this.view = 'list';
	}

	updateEntry(id: string, patch: Partial<Pick<DevlogEntry, 'date' | 'title'>>): void {
		this.entries = this.entries.map((e) =>
			e.id === id ? { ...e, ...patch, updatedAt: now() } : e
		);
		this.save();
	}

	deleteEntry(id: string): void {
		this.entries = this.entries.filter((e) => e.id !== id);
		if (this.currentEntryId === id) {
			this.currentEntryId = null;
			this.view = 'list';
		}
		this.save();
	}

	// ── block operations ─────────────────────────────────────────────────

	addBlock(entryId: string, type: BlockType, afterIndex?: number): void {
		const block = makeBlock(type);
		this.entries = this.entries.map((e) => {
			if (e.id !== entryId) return e;
			const blocks = [...e.blocks];
			const insertAt = afterIndex !== undefined ? afterIndex + 1 : blocks.length;
			blocks.splice(insertAt, 0, block);
			return { ...e, blocks, updatedAt: now() };
		});
		this.save();
	}

	updateBlock(entryId: string, blockId: string, patch: Partial<Block>): void {
		this.entries = this.entries.map((e) => {
			if (e.id !== entryId) return e;
			return {
				...e,
				updatedAt: now(),
				blocks: e.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b))
			};
		});
		this.save();
	}

	deleteBlock(entryId: string, blockId: string): void {
		this.entries = this.entries.map((e) => {
			if (e.id !== entryId) return e;
			return { ...e, blocks: e.blocks.filter((b) => b.id !== blockId), updatedAt: now() };
		});
		this.save();
	}

	moveBlock(entryId: string, blockId: string, dir: 'up' | 'down'): void {
		this.entries = this.entries.map((e) => {
			if (e.id !== entryId) return e;
			const blocks = [...e.blocks];
			const i = blocks.findIndex((b) => b.id === blockId);
			if (i < 0) return e;
			const j = dir === 'up' ? i - 1 : i + 1;
			if (j < 0 || j >= blocks.length) return e;
			[blocks[i], blocks[j]] = [blocks[j], blocks[i]];
			return { ...e, blocks, updatedAt: now() };
		});
		this.save();
	}
}

export const devlog = new DevlogStore();
