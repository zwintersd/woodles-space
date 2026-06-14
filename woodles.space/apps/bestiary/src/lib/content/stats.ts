// Six-axis stat block. Authored alongside cost / P/T / domain, read by
// Marginalia and Heaven! to determine minigame bonuses, care responses,
// and reward biasing. v1 is storage-only; game-layer reads come later.

export type CoreStat = 'body' | 'mind' | 'grace' | 'heart' | 'will' | 'spark';

export type BodySub  = 'strength' | 'speed' | 'stamina' | 'agility' | 'coordination' | 'hardiness';
export type MindSub  = 'memory' | 'focus' | 'insight' | 'composure' | 'knowledge' | 'reasoning';
export type GraceSub = 'empathy' | 'presence' | 'warmth';
export type HeartSub = 'devotion' | 'resilience' | 'care';
export type Substat  = BodySub | MindSub | GraceSub | HeartSub;

// 'capacities' = body/mind/grace/heart (the four-panel block)
// 'arc'        = will/spark (the offset panel)
export type StatGroup = 'capacities' | 'arc';

export interface SubstatDef {
	id: Substat;
	parent: CoreStat;
	name: string;
	note: string;
}

export interface CoreStatDef {
	id: CoreStat;
	group: StatGroup;
	name: string;
	tagline: string;        // one-line evocation for the editor
	glyph: string;          // the symbol used on the card strip
	colorVar: string;       // CSS custom property carrying its accent
	substats: SubstatDef[]; // empty for will / spark
}

export const coreStats: CoreStatDef[] = [
	{
		id: 'body', group: 'capacities', name: 'Body',
		glyph: '●', colorVar: '--b-stat-body',
		tagline: 'what this creature can do physically',
		substats: [
			{ id: 'strength',     parent: 'body', name: 'Strength',     note: 'force, lifting, breaking' },
			{ id: 'speed',        parent: 'body', name: 'Speed',        note: 'movement rate, reflex windows' },
			{ id: 'stamina',      parent: 'body', name: 'Stamina',      note: 'how long before exertion falters' },
			{ id: 'agility',      parent: 'body', name: 'Agility',      note: 'turning, dodging, mid-motion correction' },
			{ id: 'coordination', parent: 'body', name: 'Coordination', note: 'precision under load' },
			{ id: 'hardiness',    parent: 'body', name: 'Hardiness',    note: 'damage absorbed before it matters' }
		]
	},
	{
		id: 'mind', group: 'capacities', name: 'Mind',
		glyph: '◇', colorVar: '--b-stat-mind',
		tagline: 'how this creature processes information',
		substats: [
			{ id: 'memory',    parent: 'mind', name: 'Memory',    note: 'retains patterns, recognizes returning things' },
			{ id: 'focus',     parent: 'mind', name: 'Focus',     note: 'holds one thread under distraction' },
			{ id: 'insight',   parent: 'mind', name: 'Insight',   note: 'sees structure, predicts outcomes' },
			{ id: 'composure', parent: 'mind', name: 'Composure', note: 'keeps thinking under pressure' },
			{ id: 'knowledge', parent: 'mind', name: 'Knowledge', note: 'knows facts about the world' },
			{ id: 'reasoning', parent: 'mind', name: 'Reasoning', note: 'chains thoughts, solves novel problems' }
		]
	},
	{
		id: 'grace', group: 'capacities', name: 'Grace',
		glyph: '✿', colorVar: '--b-stat-grace',
		tagline: 'how this creature relates to the world',
		substats: [
			{ id: 'empathy',  parent: 'grace', name: 'Empathy',  note: 'reads what others need' },
			{ id: 'presence', parent: 'grace', name: 'Presence', note: 'how a room responds to its arrival' },
			{ id: 'warmth',   parent: 'grace', name: 'Warmth',   note: 'how much others want to help it' }
		]
	},
	{
		id: 'heart', group: 'capacities', name: 'Heart',
		glyph: '♡', colorVar: '--b-stat-heart',
		tagline: 'what keeps this creature invested',
		substats: [
			{ id: 'devotion',   parent: 'heart', name: 'Devotion',   note: 'depth of commitment to a chosen thing' },
			{ id: 'resilience', parent: 'heart', name: 'Resilience', note: 'returns to baseline after damage' },
			{ id: 'care',       parent: 'heart', name: 'Care',       note: 'invests in others without expecting return' }
		]
	},
	{
		id: 'will', group: 'arc', name: 'Will',
		glyph: '↑', colorVar: '--b-stat-will',
		tagline: 'how fast this creature becomes more than it is',
		substats: []
	},
	{
		id: 'spark', group: 'arc', name: 'Spark',
		glyph: '✦', colorVar: '--b-stat-spark',
		tagline: 'how often the world hands it something unexpected',
		substats: []
	}
];

// ── lookups ──────────────────────────────────────────────────

const coreMap = new Map(coreStats.map((s) => [s.id, s]));
const subMap = new Map<Substat, SubstatDef>();
for (const c of coreStats) for (const s of c.substats) subMap.set(s.id, s);

export function coreStatDef(id: CoreStat): CoreStatDef {
	return coreMap.get(id)!;
}
export function substatDef(id: Substat): SubstatDef {
	return subMap.get(id)!;
}

export const capacities = coreStats.filter((s) => s.group === 'capacities');
export const arc = coreStats.filter((s) => s.group === 'arc');
