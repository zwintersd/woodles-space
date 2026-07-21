// @ts-check

/** @typedef {import('./types').AppDefinition} AppDefinition */
/** @typedef {import('./types').LandingApp} LandingApp */
/** @typedef {import('./types').LandingTileDefinition} LandingTileDefinition */

/**
 * Canonical deployable-app inventory. App-specific feature copy remains with
 * each app; this file owns the metadata that otherwise drifts between landing,
 * Vercel, build configuration, route checks, and architecture documentation.
 *
 * @satisfies {readonly AppDefinition[]}
 */
export const appManifest = Object.freeze([
	{
		id: 'landing',
		name: 'woodles.space',
		publicPath: '/',
		aliases: [],
		kind: 'static',
		maturity: 'stable',
		sourceDir: 'apps/landing',
		outputDir: 'apps/landing',
		entryFile: 'index.html'
	},
	{
		id: 'hygge',
		name: 'Hygge',
		publicPath: '/hygge',
		aliases: ['/fonts', '/palette', '/motifs'],
		kind: 'static',
		maturity: 'stable',
		sourceDir: 'apps/hygge',
		outputDir: 'apps/hygge',
		entryFile: 'index.html',
		landing: tile('hygge', 1, 'design playground: fonts, motifs & palette', 'var(--lavender)', 'var(--peach)', '135deg', { defaultPin: 1 })
	},
	{
		id: 'lab',
		name: 'Lab',
		publicPath: '/lab',
		aliases: [],
		kind: 'static',
		maturity: 'incubator',
		sourceDir: 'apps/lab',
		outputDir: 'apps/lab',
		entryFile: 'index.html',
		landing: tile('lab', 11, 'experiments, sketches, and stub apps', 'var(--aqua)', 'var(--plum)', '185deg')
	},
	{
		id: 'piano',
		name: 'Piano',
		publicPath: '/piano',
		aliases: [],
		kind: 'static',
		maturity: 'stable',
		sourceDir: 'apps/piano',
		outputDir: 'apps/piano',
		entryFile: 'index.html',
		landing: tile('piano', 10, 'a purple keyboard with soft synth strings', 'var(--lavender)', 'var(--aqua)', '125deg')
	},
	{
		id: 'digits',
		name: 'Digits',
		publicPath: '/digits',
		aliases: [],
		kind: 'static',
		maturity: 'incubator',
		sourceDir: 'apps/digits',
		outputDir: 'apps/digits',
		entryFile: 'index.html'
	},
	{
		id: 'quiet-room',
		name: 'Quiet Room',
		publicPath: '/quiet-room',
		aliases: [],
		kind: 'static',
		maturity: 'stable',
		sourceDir: 'apps/quiet-room',
		outputDir: 'apps/quiet-room',
		entryFile: 'index.html',
		landing: tile('quiet', 15, 'an immersive room of light, drawn in three.js', 'var(--lapis)', 'var(--lilac)', '195deg', { defaultPin: 6 })
	},
	{
		id: 'ologypedia',
		name: 'Ologypedia',
		publicPath: '/ologypedia',
		aliases: [],
		kind: 'static',
		maturity: 'growing',
		sourceDir: 'apps/ologypedia',
		outputDir: 'apps/ologypedia',
		entryFile: 'index.html',
		landing: tile('ologypedia', 13, 'a block system for textbook-style pages, and the pages it renders', 'var(--plum)', 'var(--peach)', '160deg')
	},
	{
		id: 'write',
		name: 'Write',
		publicPath: '/write',
		aliases: ['/scaffold'],
		kind: 'sveltekit',
		maturity: 'stable',
		sourceDir: 'apps/write',
		outputDir: 'apps/write/dist',
		entryFile: 'index.html',
		packageName: 'write',
		landing: tile('write', 2, 'compose, save, send a letter', 'var(--aqua)', 'var(--lavender)', '160deg', { defaultPin: 2, featured: 3 })
	},
	{
		id: 'letter',
		name: 'Echoes',
		publicPath: '/letter',
		aliases: [],
		kind: 'static',
		maturity: 'stable',
		sourceDir: 'apps/letter',
		outputDir: 'apps/letter',
		entryFile: 'index.html',
		landing: tile('echoes', 3, 'letters left here, words that stayed', 'var(--peach)', 'var(--lilac)', '120deg')
	},
	{
		id: 'marginalia',
		name: 'Marginalia',
		publicPath: '/marginalia',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'stable',
		sourceDir: 'apps/marginalia',
		outputDir: 'apps/marginalia/dist',
		entryFile: 'index.html',
		packageName: 'marginalia',
		landing: tile('marg', 4, "tend a small witch, grow her world, and meet the creatures Z's already brought into it", 'var(--plum)', 'var(--lavender)', '150deg', { defaultPin: 3, featured: 1 }),
		landingSurfaces: [
			tile('reading', 6, 'a quiet timer, read for stars', 'var(--peach)', 'var(--aqua)', '115deg', {
				name: 'Reading Room',
				href: '/marginalia#reading-room'
			})
		]
	},
	{
		id: 'planner',
		name: 'Carillon',
		publicPath: '/planner',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'stable',
		sourceDir: 'apps/planner',
		outputDir: 'apps/planner/dist',
		entryFile: 'index.html',
		packageName: 'planner',
		landing: tile('planner', 7, 'calendar, schedule, and time', 'var(--peach)', 'var(--lavender)', '170deg', { defaultPin: 4 })
	},
	{
		id: 'notebook',
		name: 'Notebook',
		publicPath: '/notebook',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'growing',
		sourceDir: 'apps/notebook',
		outputDir: 'apps/notebook/dist',
		entryFile: 'index.html',
		packageName: 'notebook',
		landing: tile('notebook', 8, 'notes, tasks, and ideas kept close', 'var(--aqua)', 'var(--peach)', '205deg', { defaultPin: 5 })
	},
	{
		id: 'animations',
		name: 'Animations',
		publicPath: '/animations',
		aliases: [],
		kind: 'external',
		maturity: 'incubator',
		sourceDir: 'apps/animations',
		outputDir: 'apps/animations',
		entryFile: 'index.html'
	},
	{
		id: 'spores',
		name: 'Spores',
		publicPath: '/spores',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'growing',
		sourceDir: 'apps/spores',
		outputDir: 'apps/spores/dist',
		entryFile: 'index.html',
		packageName: 'spores',
		landing: tile('spores', 12, 'a personal wikipedia, tended by hand', 'var(--lilac)', 'var(--aqua)', '145deg')
	},
	{
		id: 'bestiary',
		name: 'Bestiary',
		publicPath: '/bestiary',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'stable',
		sourceDir: 'apps/bestiary',
		outputDir: 'apps/bestiary/dist',
		entryFile: 'index.html',
		packageName: 'bestiary',
		landing: tile('bestiary', 14, 'bring a png of anything, leave with a card that belongs', 'var(--peach)', 'var(--plum)', '110deg', { featured: 2 })
	},
	{
		id: 'marginalia-devlog',
		name: 'Dev Log',
		publicPath: '/marginalia-devlog',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'growing',
		sourceDir: 'apps/marginalia-devlog',
		outputDir: 'apps/marginalia-devlog/dist',
		entryFile: 'index.html',
		packageName: 'marginalia-devlog',
		landing: tile('devlog', 5, "notes from making the witch's world", 'var(--lilac)', 'var(--plum)', '200deg')
	},
	{
		id: 'thinking-about',
		name: 'Thinking About',
		publicPath: '/thinking-about',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'stable',
		sourceDir: 'apps/thinking-about',
		outputDir: 'apps/thinking-about/dist',
		entryFile: 'index.html',
		packageName: 'thinking-about',
		landing: tile('thinking', 9, 'a landing spot for what you are reading, playing, and watching', 'var(--lapis)', 'var(--aqua)', '140deg')
	}
]);

/** @type {Readonly<Record<string, AppDefinition>>} */
export const appById = Object.freeze(Object.fromEntries(appManifest.map((app) => [app.id, app])));

/** @type {readonly LandingApp[]} */
export const landingApps = Object.freeze(
	appManifest
		.flatMap((app) => [app.landing, ...(app.landingSurfaces ?? [])]
			.filter((entry) => entry !== undefined)
			.map((entry) => toLandingApp(app, entry)))
		.sort((a, b) => a.order - b.order)
);

export const defaultLandingPins = Object.freeze(
	landingApps
		.filter((app) => app.defaultPin !== undefined)
		.sort((a, b) => /** @type {number} */ (a.defaultPin) - /** @type {number} */ (b.defaultPin))
		.map((app) => app.id)
);

export const featuredLandingApps = Object.freeze(
	landingApps
		.filter((app) => app.featured !== undefined)
		.sort((a, b) => /** @type {number} */ (a.featured) - /** @type {number} */ (b.featured))
);

/** @param {AppDefinition} app */
export function primaryDestination(app) {
	return `/${app.outputDir}/${app.entryFile}`;
}

/**
 * @param {string} tileId
 * @param {number} order
 * @param {string} description
 * @param {string} gradientFrom
 * @param {string} gradientTo
 * @param {string} gradientAngle
 * @param {Partial<LandingTileDefinition>} [extra]
 * @returns {LandingTileDefinition}
 */
function tile(tileId, order, description, gradientFrom, gradientTo, gradientAngle, extra = {}) {
	return { tileId, order, description, gradientFrom, gradientTo, gradientAngle, ...extra };
}

/**
 * @param {AppDefinition} app
 * @param {LandingTileDefinition} tileDefinition
 * @returns {LandingApp}
 */
function toLandingApp(app, tileDefinition) {
	return {
		appId: app.id,
		id: tileDefinition.tileId,
		name: tileDefinition.name ?? app.name,
		href: tileDefinition.href ?? app.publicPath,
		desc: tileDefinition.description,
		g1: tileDefinition.gradientFrom,
		g2: tileDefinition.gradientTo,
		ga: tileDefinition.gradientAngle,
		order: tileDefinition.order,
		...(tileDefinition.defaultPin === undefined ? {} : { defaultPin: tileDefinition.defaultPin }),
		...(tileDefinition.featured === undefined ? {} : { featured: tileDefinition.featured })
	};
}
