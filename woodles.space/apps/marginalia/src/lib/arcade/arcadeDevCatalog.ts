/**
 * Marginalia's small, stable development index. The Arcade reads its card
 * metadata here, and HomeSuite Data reads the same records as source rows.
 * Game rules and copy proposals remain in their owning components/Collections.
 */

export type ArcadeGameStatus = 'play' | 'soon' | 'roadmap';
export type ArcadeRoadmapMetric = 'written-conditions' | 'reading-stars';

export interface ArcadeGameCatalogEntry {
	id: string;
	icon: string;
	title: string;
	tagline: string;
	tags: readonly string[];
	status: ArcadeGameStatus;
	coreLoop: string;
	mastery: string;
	sourcePath: string;
	roadmapNote?: string;
	roadmapMetric?: ArcadeRoadmapMetric;
}

const ARCADE_PATH = 'apps/marginalia/src/lib/arcade/';

export const ARCADE_GAME_CATALOG: readonly ArcadeGameCatalogEntry[] = [
	{
		id: 'inkblot', icon: '⬤', title: 'Inkblot',
		tagline: 'An image blooms slowly from ink. Press space to pause and name the creature before it fully resolves.',
		tags: ['recognition', 'observation'], status: 'play',
		coreLoop: 'Watch an image emerge, pause the reveal, and name the creature.',
		mastery: 'Observation and patience', sourcePath: `${ARCADE_PATH}Inkblot.svelte`
	},
	{
		id: 'stack-2048', icon: '▦', title: '2048',
		tagline: 'Slide the tiles. Merge the numbers. Reach 2048 before the board fills.',
		tags: ['puzzle', 'numbers'], status: 'play',
		coreLoop: 'Slide and merge tiles while managing the space left on the board.',
		mastery: 'Planning and sequencing', sourcePath: `${ARCADE_PATH}TwoZeroFourEight.svelte`
	},
	{
		id: 'color-pop', icon: '●', title: 'Color POP!',
		tagline: 'Drop bright circles, merge matching tiers, and keep the pile below the line.',
		tags: ['physics', 'merge'], status: 'play',
		coreLoop: 'Drop circles, merge matching tiers, and control the growing pile.',
		mastery: 'Estimation and spatial judgment', sourcePath: `${ARCADE_PATH}ColorPop.svelte`
	},
	{
		id: 'margin-miner', icon: '$', title: 'Margin Miner',
		tagline: 'Swing the skyhook, gather cloud treasures, and beat the target before time runs out.',
		tags: ['claw', 'timed'], status: 'play',
		coreLoop: 'Time a swinging claw, choose treasure, and reach each level target.',
		mastery: 'Timing and estimating tradeoffs', sourcePath: `${ARCADE_PATH}MarginMiner.svelte`
	},
	{
		id: 'type-witch', icon: '⌨', title: 'Type Witch',
		tagline: "Race against the clock to transcribe Brianna's conditions before they dissolve.",
		tags: ['typing', 'timed'], status: 'play',
		coreLoop: 'Transcribe condition phrases accurately before time runs out.',
		mastery: 'Typing accuracy under time pressure', sourcePath: `${ARCADE_PATH}TypeWitch.svelte`
	},
	{
		id: 'get-big', icon: '●', title: 'Get Big!',
		tagline: 'Eat smaller jelly, dodge bigger jelly, and grow until yellow finally fits.',
		tags: ['arcade', 'growth'], status: 'play',
		coreLoop: 'Steer through a field, eat smaller jelly, and avoid larger jelly.',
		mastery: 'Steering and risk assessment', sourcePath: `${ARCADE_PATH}GetBig.svelte`
	},
	{
		id: 'margin-hollow', icon: '▣', title: 'Margin Hollow',
		tagline: 'A tiny metroidvania-like: jump, open wing and key routes, and chart the archive.',
		tags: ['platform', 'gates'], status: 'play',
		coreLoop: 'Move through rooms, jump obstacles, collect keys, and open routes.',
		mastery: 'Navigation, timing, and route planning', sourcePath: `${ARCADE_PATH}MarginHollow.svelte`
	},
	{
		id: 'condition-match', icon: '🜁', title: 'Condition Match',
		tagline: 'Flip tiles to pair conditions with their emergences. Memory as magic.',
		tags: ['memory', 'puzzle'], status: 'play',
		coreLoop: 'Reveal tiles and match conditions with the emergences they create.',
		mastery: 'Memory and classification', sourcePath: `${ARCADE_PATH}ConditionMatch.svelte`
	},
	{
		id: 'insight-rush', icon: '✦', title: 'Insight Rush',
		tagline: 'Tap fast, tap true. Harvest a burst of insight before the moment closes.',
		tags: ['clicker', 'speed'], status: 'play',
		coreLoop: 'Spot and tap true sparks before the short round closes.',
		mastery: 'Attention and response speed', sourcePath: `${ARCADE_PATH}InsightRush.svelte`
	},
	{
		id: 'bullet-dot', icon: '•', title: 'Bullet Dot',
		tagline: 'The simplest bullet heaven possible: one dot, one swarm, automatic shots.',
		tags: ['action', 'survival'], status: 'play',
		coreLoop: 'Move one dot through a chasing swarm while shots fire automatically.',
		mastery: 'Positioning and recovery', sourcePath: `${ARCADE_PATH}BulletHeaven.svelte`
	},
	{
		id: 'margin-defense', icon: '⌂', title: 'Margin Defense',
		tagline: 'Place tiny towers along one route. Hold five waves before the margin breaks.',
		tags: ['tower', 'strategy'], status: 'play',
		coreLoop: 'Place towers along a route and hold through five enemy waves.',
		mastery: 'Planning and prioritization', sourcePath: `${ARCADE_PATH}TowerDefense.svelte`
	},
	{
		id: 'margin-snake', icon: '∿', title: 'Margin Snake',
		tagline: 'Classic snake in a notebook grid. Eat marks, grow longer, avoid yourself.',
		tags: ['arcade', 'grid'], status: 'play',
		coreLoop: 'Collect marks, grow longer, and steer clear of your own path.',
		mastery: 'Steering and planning ahead', sourcePath: `${ARCADE_PATH}Snake.svelte`
	},
	{
		id: 'paddle-break', icon: '▭', title: 'Paddle Break',
		tagline: 'Pong hands, Breakout wall: keep the ball alive while the bricks come loose.',
		tags: ['arcade', 'reflex'], status: 'play',
		coreLoop: 'Move a paddle to return the ball and break the wall of bricks.',
		mastery: 'Timing and aiming', sourcePath: `${ARCADE_PATH}PaddleBreak.svelte`
	},
	{
		id: 'bubble-spinner', icon: 'o', title: 'Bubble Spinner',
		tagline: 'Shoot into a hex cluster, kick it into spin, match colors, and drop orphaned rings.',
		tags: ['shooter', 'physics'], status: 'play',
		coreLoop: 'Shoot a rotating hex cluster, match colors, and drop disconnected rings.',
		mastery: 'Aiming and prediction', sourcePath: `${ARCADE_PATH}BubbleSpinner.svelte`
	},
	{
		id: 'margin-bubbles', icon: '◌', title: 'Margin Bubbles',
		tagline: 'Bank shots into the canopy, match colors in threes, and keep the ceiling from pressing down.',
		tags: ['shooter', 'aim'], status: 'play',
		coreLoop: 'Bank shots into a canopy, match three colors, and manage the falling ceiling.',
		mastery: 'Aiming and spatial prediction', sourcePath: `${ARCADE_PATH}BubbleShooter.svelte`
	},
	{
		id: 'word-weave', icon: '🝩', title: 'Word Weave',
		tagline: "Arrange scattered words into valid conditions. The Book will know if you're wrong.",
		tags: ['word', 'puzzle'], status: 'roadmap',
		coreLoop: 'Arrange scattered words into valid conditions.',
		mastery: 'Language and pattern recognition', sourcePath: 'Roadmap card in Arcade.svelte',
		roadmapNote: 'Roadmap idea; progress marker is written conditions.', roadmapMetric: 'written-conditions'
	},
	{
		id: 'star-catcher', icon: '★', title: 'Star Catcher',
		tagline: "Guide falling stars into the margin before they blink out. Don't miss.",
		tags: ['action', 'reflex'], status: 'roadmap',
		coreLoop: 'Guide falling stars into the margin before they disappear.',
		mastery: 'Timing and aiming', sourcePath: 'Roadmap card in Arcade.svelte',
		roadmapNote: 'Roadmap idea; progress marker is reading stars earned.', roadmapMetric: 'reading-stars'
	},
	{
		id: 'the-long-game', icon: '∞', title: 'The Long Game',
		tagline: 'A prestige loop within the loop. It watches you back.',
		tags: ['idle', 'meta'], status: 'roadmap',
		coreLoop: 'A long-term prestige loop that responds to play over time.',
		mastery: 'Long-range planning', sourcePath: 'Roadmap card in Arcade.svelte',
		roadmapNote: 'Roadmap idea; a real lifecycle marker is not tracked yet.'
	}
];

export type ArcadePrimitiveStatus = 'shared' | 'Marginalia-specific' | 'game-local';

export interface ArcadePrimitiveCatalogEntry {
	id: string;
	name: string;
	category: string;
	status: ArcadePrimitiveStatus;
	summary: string;
	api: string;
	consumers: string;
	sourcePath: string;
	boundary: string;
	exampleGameId?: string;
}

export const ARCADE_PRIMITIVE_CATALOG: readonly ArcadePrimitiveCatalogEntry[] = [
	{
		id: 'arcade-math', name: 'Arcade math', category: 'Pure helpers', status: 'shared',
		summary: 'Small geometry, vector, clamping, reward-cap, and hex-grid helpers.',
		api: 'Dot, clamp, distance, normalize, rotate, CubeHex helpers, cappedReward',
		consumers: 'Multiple arcade games', sourcePath: `${ARCADE_PATH}arcadeMath.ts`,
		boundary: 'Pure and domain-neutral; a good first place to look before adding duplicate math.', exampleGameId: 'bubble-spinner'
	},
	{
		id: 'arcade-hud', name: 'Arcade HUD', category: 'Presentation', status: 'shared',
		summary: 'Shared title, hint, score boxes, start control, and return-to-arcade control.',
		api: 'ArcadeHud.svelte', consumers: 'Type Witch, Get Big, Margin Hollow, Insight Rush, Bullet Dot, Margin Defense, Margin Snake, Paddle Break, Bubble Spinner, Margin Bubbles',
		sourcePath: `${ARCADE_PATH}ArcadeHud.svelte`,
		boundary: 'Presentation shell only; game score rules and phase state stay in each game.', exampleGameId: 'margin-hollow'
	},
	{
		id: 'arcade-progress', name: 'Arcade progress track', category: 'Presentation', status: 'shared',
		summary: 'Narrow, responsive progress bar with named color tones.',
		api: 'ArcadeProgress.svelte', consumers: 'Core timing and action games',
		sourcePath: `${ARCADE_PATH}ArcadeProgress.svelte`,
		boundary: 'Use when the visual track fits; do not use it to define game timing.', exampleGameId: 'inkblot'
	},
	{
		id: 'svg-arena', name: 'SVG arena', category: 'Presentation', status: 'shared',
		summary: 'Responsive SVG frame, paper background, grid, and pointer/touch surface.',
		api: 'SvgArena.svelte', consumers: 'Several SVG arcade games',
		sourcePath: `${ARCADE_PATH}SvgArena.svelte`,
		boundary: 'SVG-specific; canvas games should remain canvas-native.', exampleGameId: 'margin-hollow'
	},
	{
		id: 'arcade-labels', name: 'Arcade start labels', category: 'Copy and state', status: 'shared',
		summary: 'Keeps start, again, restart, and ready labels consistent with run state.',
		api: 'arcadeStartLabel, arcadeReadyAgainLabel', consumers: 'Shared HUD games',
		sourcePath: `${ARCADE_PATH}arcadeLabels.ts`,
		boundary: 'Small shared vocabulary; game-specific instructions and end states stay local.', exampleGameId: 'bubble-spinner'
	},
	{
		id: 'arcade-rewards', name: 'Arcade rewards', category: 'Economy', status: 'Marginalia-specific',
		summary: 'Clamps previews and centralizes insight credit into the Marginalia Book.',
		api: 'creditInsight, previewReward, payReward', consumers: 'Paying arcade games',
		sourcePath: `${ARCADE_PATH}arcadeRewards.ts`,
		boundary: 'The Book mutation is Marginalia-owned; only the pure cap is portable.', exampleGameId: 'bubble-spinner'
	},
	{
		id: 'arcade-pet-perks', name: 'Arcade pet perks', category: 'Game integration', status: 'Marginalia-specific',
		summary: 'Turns Bestiary stats into visible per-game perk descriptions.',
		api: 'coreStatPerks, statTier, ArcadePetPerks.svelte', consumers: 'Pet-enabled arcade games',
		sourcePath: `${ARCADE_PATH}arcadeStats.ts`,
		boundary: 'Depends on Bestiary creature stats; each game still owns the effect it applies.', exampleGameId: 'stack-2048'
	},
	{
		id: 'arcade-records', name: 'Arcade run records', category: 'Persistence', status: 'Marginalia-specific',
		summary: 'Stores per-game best and recent run summaries in local storage.',
		api: 'loadArcadeRecord, recordArcadeRun', consumers: 'Playable arcade games',
		sourcePath: `${ARCADE_PATH}arcadeRecords.ts`,
		boundary: 'Keep record shapes specific to the Arcade until another owner needs the same contract.', exampleGameId: 'margin-hollow'
	},
	{
		id: 'inkblot-daily-limit', name: 'Daily play limit', category: 'Pacing', status: 'game-local',
		summary: 'Small local helper for counting remaining plays and day changes.',
		api: 'dailyLimit, localDayKey', consumers: 'Inkblot',
		sourcePath: `${ARCADE_PATH}dailyLimit.ts`,
		boundary: 'Only Inkblot currently uses this pacing rule.', exampleGameId: 'inkblot'
	},
	{
		id: 'condition-match-pairs', name: 'Condition Match pairs', category: 'Game logic', status: 'game-local',
		summary: 'Selects emergences, builds shuffled tiles, and validates pairs.',
		api: 'selectRoundEmergences, buildTilePool, emergenceForPair', consumers: 'Condition Match',
		sourcePath: `${ARCADE_PATH}conditionMatchPairs.ts`,
		boundary: 'Unit-testable but tied to Marginalia condition/emergence content; reuse the testing pattern, not this domain model.', exampleGameId: 'condition-match'
	},
	{
		id: 'margin-miner-tuning', name: 'Margin Miner tuning', category: 'Game logic', status: 'game-local',
		summary: 'Named difficulty and upgrade tuning values for the claw loop.',
		api: 'marginMinerTuning.ts', consumers: 'Margin Miner',
		sourcePath: `${ARCADE_PATH}marginMinerTuning.ts`,
		boundary: 'Claw-specific timing and level rules; keep local until another game needs the same model.', exampleGameId: 'margin-miner'
	}
];

export interface ArcadeCopyCatalogEntry {
	id: string;
	gameId: string;
	name: string;
	placement: string;
	status: ArcadeGameStatus;
	title: string;
	text: string;
	sourcePath: string;
}

/** Current title and tagline for each card, keyed to the game id. */
export const ARCADE_COPY_CATALOG: readonly ArcadeCopyCatalogEntry[] = ARCADE_GAME_CATALOG.map((game) => ({
	id: game.id,
	gameId: game.id,
	name: `${game.title} card copy`,
	placement: 'Arcade cabinet card',
	status: game.status,
	title: game.title,
	text: game.tagline,
	sourcePath: 'apps/marginalia/src/lib/arcade/arcadeDevCatalog.ts'
}));

/** Resolve a source row back to the game whose screen gives it useful context. */
export function arcadeGameForSource(kind: string, id: string): string | null {
	if (kind === 'arcade-game') return ARCADE_GAME_CATALOG.some((game) => game.id === id) ? id : null;
	if (kind === 'arcade-copy') return ARCADE_COPY_CATALOG.find((entry) => entry.id === id)?.gameId ?? null;
	if (kind === 'arcade-primitive') return ARCADE_PRIMITIVE_CATALOG.find((entry) => entry.id === id)?.exampleGameId ?? null;
	return null;
}
