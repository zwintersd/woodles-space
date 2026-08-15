// A small, honest placeholder — not World 1. Two life, minimal tuning, just
// enough for a `World` to actually tick and produce moving numbers.
//
// Grimoire has no way to reach Marginalia's real `world1Def` yet: apps in
// this workspace only share code through `packages/*`, and `world1Def` is
// still assembled entirely inside apps/marginalia from its own content
// files. Getting Grimoire the real thing means deciding whether that content
// moves into @woodles/witch-engine (the way incremental-core bundles its own
// example fixtures) or gets reached some other way — a real decision, not
// this file's job to make quietly. This def exists only to prove the wiring:
// Grimoire -> @woodles/witch-engine -> World.tick() actually runs in a
// browser.

import type { MarginaliaDef } from '@woodles/witch-engine';

export const exampleDef: MarginaliaDef = {
	meta: { id: 'grimoire-example', title: 'Example world (placeholder, not World 1)' },

	life: [
		{
			id: 'spark',
			name: 'the spark',
			scientificName: '(placeholder)',
			category: 'aquatic',
			domain: 'plant',
			requires: [],
			insightWeight: 1,
			studyEase: 1,
			metabolism: { oxygen: 0.1 },
			needs: { nutrients: [30, 100] },
			notice: '(placeholder)',
			observe: '(placeholder)',
			study: '(placeholder)',
			know: '(placeholder)'
		},
		{
			id: 'drift',
			name: 'the drift',
			scientificName: '(placeholder)',
			category: 'aquatic',
			domain: 'weather',
			requires: [],
			insightWeight: 0.6,
			studyEase: 1.3,
			metabolism: { moisture: 0.05 },
			notice: '(placeholder)',
			observe: '(placeholder)',
			study: '(placeholder)',
			know: '(placeholder)'
		}
	],
	conditions: [],
	emergences: [],
	interventions: {
		plant: { domain: 'plant', verb: 'tend', reach: 'broad', permanence: 'temporary', cost: { insight: 10, essence: 0 }, lines: ['(placeholder)'] },
		animal: { domain: 'animal', verb: 'guide', reach: 'targeted', permanence: 'lasting', cost: { insight: 20, essence: 0 }, lines: ['(placeholder)'] },
		ecosystem: { domain: 'ecosystem', verb: 'encourage', reach: 'broad', permanence: 'lasting', cost: { insight: 30, essence: 0 }, lines: ['(placeholder)'] },
		geology: { domain: 'geology', verb: 'shape', reach: 'narrow', permanence: 'permanent', cost: { insight: 50, essence: 1 }, lines: ['(placeholder)'] },
		weather: { domain: 'weather', verb: 'invoke', reach: 'broad', permanence: 'temporary', uncertain: true, cost: { insight: 10, essence: 0 }, lines: ['(placeholder)'] }
	},
	worldspaces: {
		water: { id: 'water', visibleCategories: 'all' },
		shallows: { id: 'shallows', visibleCategories: 'all' }
	},

	stage: { seconds: [0, 10, 30, 90], insightMult: [0, 0.2, 0.6, 1], activity: [0, 0.3, 0.7, 1], lookCloserSeconds: 2 },
	stock: {
		bands: { nutrients: [40, 80], oxygen: [45, 85], moisture: [35, 75] },
		driftPerSec: 0.005,
		leak: { nutrients: 0.006, oxygen: 0.012, moisture: 0.0145 },
		start: 50,
		neutral: 50,
		bandFalloff: 25
	},
	vitality: { drainPerSec: 0.05, recoverPerSec: 0.03, floor: 0.05 },
	favor: { baseTarget: 50, perKnown: 6, driftPerSec: 0.02, stressPenalty: 4, equilibriumBonus: 8, multiplier: { base: 0.5, perPoint: 0.01 } },
	recall: { restoreRate: 0.02, baseDecayRate: 0.002, companionGainRate: 0.006, companionCap: 3 },
	recallYield: { floor: 0.5, fluencyBonus: 0.12 },
	attention: { start: 2, costs: [20, 60, 150] },
	restraint: { loadWeight: { temporary: 0.1, lasting: 0.3, permanent: 0.5 }, loadFull: 1.2, minFactor: 0.5 },
	interventionEffects: {
		tendBump: 8,
		invokeBump: 22,
		shapeBaselineRaise: 15,
		shapeBaselineMax: 85,
		encourageStability: 8,
		encourageStabilityMax: 40,
		guideMetabolismScale: 0.5
	},
	insightSinks: { distillInsightCost: 30, distillEssenceGain: 1 },
	progress: {
		essenceOnStudied: 1,
		essenceOnKnown: 2,
		stabilityEcosystemBonus: 0.04,
		quietStability: 18,
		categoryMasteryBonus: 0.12,
		insightTrickleAnnounceSec: 3
	},
	focus: { windowSeconds: 2.2, stepBonus: 0.09, maxLevel: 6 },
	fieldNotes: { byDomain: { plant: {}, animal: {}, ecosystem: {}, geology: {}, weather: {} }, equilibrium: [], quiet: [], categoryMastery: { aquatic: [], terrestrial: [], atmospheric: [] } }
};
