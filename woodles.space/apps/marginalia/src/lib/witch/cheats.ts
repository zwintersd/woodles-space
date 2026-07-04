import { conditions } from './content/conditions';
import { world1Life } from './content/life';
import { neutralStocks, type Stocks } from './vitals';
import {
	FEATURE_SPECS,
	SEDIMENT_UNLOCK_COVERAGE,
	emptySedimentGrid,
	normalizeWorldShape,
	placeFeatureOnBestSediment,
	unlockWorldspacesForCoverage,
	type WorldShape
} from './worldShape';

const STAGE_KNOWN = 3;

export interface CheatTarget {
	insight: number;
	essence: number;
	knowing: number;
	favor: number;
	stocks: Stocks;
	vitality: Record<string, number>;
	attentionCapacity: number;
	attending: string[];
	study: Record<string, number>;
	writtenConditions: string[];
	observation: Record<string, number>;
	categoryMastered: Record<string, boolean>;
	worldShape: WorldShape;
	bookOpen: boolean;
	mode: 'web' | 'world';
	persist: () => void;
}

export interface CheatResult {
	ok: boolean;
	message: string;
	persisted?: boolean;
}

interface CheatSpec {
	code: string;
	aliases?: string[];
	summary: string;
	run: (target: CheatTarget) => string;
	persist?: boolean;
}

const allConditionIds = () => conditions.map((condition) => condition.id);

function writeAllConditions(target: CheatTarget): number {
	const existing = new Set(target.writtenConditions);
	let added = 0;
	for (const id of allConditionIds()) {
		if (existing.has(id)) continue;
		existing.add(id);
		added++;
	}
	target.writtenConditions = Array.from(existing);
	target.knowing += added;
	return added;
}

function knownVisibleLife(target: CheatTarget): number {
	const written = new Set(target.writtenConditions);
	const visible = world1Life.filter((life) => life.requires.every((id) => written.has(id)));
	const observation = { ...target.observation };
	const study = { ...target.study };
	const vitality = { ...target.vitality };
	let changed = 0;
	for (const life of visible) {
		if ((observation[life.id] ?? 0) < STAGE_KNOWN) {
			observation[life.id] = STAGE_KNOWN;
			study[life.id] = 0;
			vitality[life.id] = 1;
			changed++;
		}
	}
	target.observation = observation;
	target.study = study;
	target.vitality = vitality;
	target.attending = target.attending.filter((id) => (observation[id] ?? 0) < STAGE_KNOWN);
	target.knowing += changed;
	return changed;
}

function sedimentCells(fill: 'threshold' | 'full') {
	const grid = emptySedimentGrid();
	const cells = grid.cells.map((_, index) => {
		const x = index % grid.w;
		const y = Math.floor(index / grid.w);
		if (fill === 'full') return 1;
		const floorBias = y / Math.max(1, grid.h - 1);
		const centerBias = 1 - Math.abs((x + 0.5) / grid.w - 0.5) * 0.3;
		return floorBias > 0.34 && centerBias > 0.74 ? 0.72 : 0.18;
	});
	return { ...grid, cells };
}

function unlockShallows(target: CheatTarget, fill: 'threshold' | 'full', seen: boolean) {
	const shape = unlockWorldspacesForCoverage(
		normalizeWorldShape({
			...target.worldShape,
			sedimentUnlocked: true,
			sedimentGrid: sedimentCells(fill),
			seenUnlocks: seen ? ['shallows'] : target.worldShape.seenUnlocks,
			spawnRevision: target.worldShape.spawnRevision + 1
		})
	);
	target.worldShape = {
		...shape,
		activeWorldspace: seen ? 'shallows' : 'water',
		seenUnlocks: seen ? Array.from(new Set([...shape.seenUnlocks, 'shallows'])) : shape.seenUnlocks
	};
	target.bookOpen = true;
	target.mode = 'world';
}

function placeEveryFeature(target: CheatTarget): number {
	let placed = 0;
	for (const feature of FEATURE_SPECS) {
		const before = target.worldShape.placedFeatures.length;
		target.worldShape = placeFeatureOnBestSediment(target.worldShape, feature.id);
		if (target.worldShape.placedFeatures.length > before) placed++;
	}
	return placed;
}

function maxMotives(target: CheatTarget) {
	target.favor = 100;
	target.stocks = { ...neutralStocks(), nutrients: 100, oxygen: 100, moisture: 100 };
	const vitality = { ...target.vitality };
	for (const life of world1Life) vitality[life.id] = 1;
	target.vitality = vitality;
}

export const CHEAT_CODES: CheatSpec[] = [
	{
		code: 'rosebud',
		summary: '+1k Insight, +1 Essence',
		run: (target) => {
			target.insight += 1000;
			target.essence += 1;
			return 'rosebud: the margin blooms.';
		}
	},
	{
		code: 'kaching',
		summary: '+10k Insight',
		run: (target) => {
			target.insight += 10000;
			return 'kaching: the book rustles.';
		}
	},
	{
		code: 'motherlode',
		summary: '+50k Insight, +25 Essence',
		run: (target) => {
			target.insight += 50000;
			target.essence += 25;
			return 'motherlode: the world overpays its witness.';
		}
	},
	{
		code: 'maxmotives',
		aliases: ['max motives'],
		summary: 'max Favor, stocks, and vitality',
		run: (target) => {
			maxMotives(target);
			return 'maxmotives: everybody feels luminous.';
		}
	},
	{
		code: 'freerealestate',
		aliases: ['free real estate'],
		summary: 'write every condition for free',
		run: (target) => {
			const added = writeAllConditions(target);
			target.bookOpen = true;
			target.mode = 'web';
			return added === 0 ? 'freerealestate: the deed was already signed.' : `freerealestate: ${added} conditions written.`;
		}
	},
	{
		code: 'unlockshallows',
		aliases: ['unlock shallows'],
		summary: 'trigger the shallows unlock screen',
		run: (target) => {
			target.insight = Math.max(target.insight, 5000);
			unlockShallows(target, 'threshold', false);
			return `unlockshallows: sediment passes ${Math.floor(SEDIMENT_UNLOCK_COVERAGE * 100)}%.`;
		}
	},
	{
		code: 'pearlrush',
		aliases: ['pearl rush', 'pearlsplease', 'pearls please'],
		summary: 'fill the water floor with pearl sediment',
		run: (target) => {
			target.insight = Math.max(target.insight, 5000);
			unlockShallows(target, 'full', true);
			return 'pearlrush: the floor turns pearlescent.';
		}
	},
	{
		code: 'landcards',
		aliases: ['land cards', 'featurecards', 'feature cards'],
		summary: 'place every current feature card',
		run: (target) => {
			unlockShallows(target, 'full', true);
			const placed = placeEveryFeature(target);
			return placed === 0 ? 'landcards: every feature is already settled.' : `landcards: ${placed} features settled.`;
		}
	},
	{
		code: 'makeknown',
		aliases: ['make known'],
		summary: 'set all currently revealed life to Known',
		run: (target) => {
			const changed = knownVisibleLife(target);
			return changed === 0 ? 'makeknown: nothing new to know.' : `makeknown: ${changed} lives become known.`;
		}
	},
	{
		code: 'worldparty',
		aliases: ['world party'],
		summary: 'full sandbox setup for testing',
		run: (target) => {
			writeAllConditions(target);
			knownVisibleLife(target);
			maxMotives(target);
			target.insight = Math.max(target.insight, 250000);
			target.essence = Math.max(target.essence, 100);
			target.attentionCapacity = Math.max(target.attentionCapacity, 12);
			unlockShallows(target, 'full', true);
			placeEveryFeature(target);
			target.bookOpen = true;
			target.mode = 'world';
			return 'worldparty: the whole little cosmos is open.';
		}
	},
	{
		code: 'testingcheats true',
		aliases: ['testingcheats on', 'testing cheats true', 'testing cheats on'],
		summary: 'confirm cheat console is listening',
		persist: false,
		run: () => 'testingcheats true: enabled, emotionally.'
	}
];

export function cheatHelp(): string {
	return CHEAT_CODES.map((cheat) => `${cheat.code} — ${cheat.summary}`).join(' / ');
}

export function normalizeCheatCode(input: string): string {
	return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function applyMarginaliaCheat(input: string, target: CheatTarget): CheatResult {
	const code = normalizeCheatCode(input);
	if (!code) return { ok: false, message: 'type a code first.' };
	if (code === 'help' || code === '?') return { ok: true, message: cheatHelp(), persisted: false };

	const cheat = CHEAT_CODES.find(
		(item) => item.code === code || item.aliases?.some((alias) => normalizeCheatCode(alias) === code)
	);
	if (!cheat) return { ok: false, message: `unknown code: ${code}` };

	const message = cheat.run(target);
	if (cheat.persist !== false) {
		target.persist();
		return { ok: true, message, persisted: true };
	}
	return { ok: true, message, persisted: false };
}
