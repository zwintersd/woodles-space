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
		landing: tile('hygge', 1, 'play', 'design playground: fonts, motifs, palette & motion', 'var(--lavender)', 'var(--peach)', '135deg', { defaultPin: 1 })
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
		landing: tile('lab', 9, 'play', 'experiments, sketches, and stub apps', 'var(--aqua)', 'var(--plum)', '185deg')
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
		landing: tile('piano', 8, 'play', 'a purple keyboard with soft synth strings', 'var(--lavender)', 'var(--aqua)', '125deg')
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
		landing: tile('quiet', 11, 'play', 'an immersive room of light, drawn in three.js', 'var(--lapis)', 'var(--lilac)', '195deg', { defaultPin: 5 })
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
		// A `#` reference to another draft resolves here — the knowledge-base
		// job Spores retired from (see references.svelte.ts's draft source).
		addressableBy: ['draft'],
		landing: tile('write', 2, 'write', 'every kind of writing — letters, essays, stories, poems, and the thought that just arrived', 'var(--aqua)', 'var(--lavender)', '160deg', { defaultPin: 2, featured: 3 })
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
		// The archive already opened one letter by id (`?id=`); declaring it is
		// what lets another app link to a specific one.
		addressableBy: ['letter'],
		landing: tile('echoes', 3, 'read', 'letters left here, words that stayed', 'var(--peach)', 'var(--lilac)', '120deg')
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
		landing: tile('marg', 4, 'play', "tend a small witch, grow her world, and meet the creatures Z's already brought into it", 'var(--plum)', 'var(--lavender)', '150deg', { defaultPin: 3, featured: 1 }),
		landingSurfaces: [
			tile('reading', 5, 'read', 'a quiet timer, read for stars', 'var(--peach)', 'var(--aqua)', '115deg', {
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
		// A *foreign* record kind, which is the honest name for it: arriving here
		// with a Thinking About entry means "what does the day say about this
		// thing", and Carillon answers with what it already has scheduled.
		addressableBy: ['thinking-about-entry'],
		landing: tile('planner', 6, 'tend', 'interval data, fading routines, and day piles', 'var(--peach)', 'var(--lavender)', '170deg', { defaultPin: 4 })
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
		// Share links have used `?card=<id>` since ROADMAP.md week 4; declaring it
		// is what lets the link be built from the manifest that owns the path
		// rather than from `location.origin` plus a literal.
		addressableBy: ['card'],
		landing: tile('bestiary', 10, 'tend', 'bring a png of anything, leave with a card that belongs', 'var(--peach)', 'var(--plum)', '110deg', { featured: 2 })
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
		addressableBy: ['entry'],
		landing: tile('thinking', 7, 'tend', 'a landing spot for what you are reading, playing, and watching', 'var(--lapis)', 'var(--aqua)', '140deg')
	},
	{
		id: 'bloomforge',
		name: 'Bloomforge',
		publicPath: '/bloomforge',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'growing',
		sourceDir: 'apps/bloomforge',
		outputDir: 'apps/bloomforge/dist',
		entryFile: 'index.html',
		packageName: 'bloomforge',
		landing: tile('bloomforge', 12, 'play', 'a studio for making incremental games: wire up an economy, then watch it run', 'var(--lavender)', 'var(--aqua)', '150deg')
	},
	{
		id: 'bloomforge-player',
		name: 'Bloomforge Player',
		publicPath: '/play',
		aliases: [],
		kind: 'sveltekit',
		maturity: 'growing',
		sourceDir: 'apps/bloomforge-player',
		outputDir: 'apps/bloomforge-player/dist',
		entryFile: 'index.html',
		packageName: 'bloomforge-player',
		// The studio's "Play it" hands over a project id rather than a def in the
		// URL, so a link can't go stale against an edited game.
		addressableBy: ['game'],
		landing: tile('player', 13, 'play', 'play the incremental games you built in the studio', 'var(--peach)', 'var(--lavender)', '160deg')
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

/**
 * The bands tiles group under, in the order they should be shown. Named for the
 * moment rather than the thing, so the landing page stops presenting a wall of
 * peers you have to choose between. See CONVERGENCE.md §3.
 *
 * There is no `catch` band anymore: Notebook, the app it existed for, retired
 * into Write (CONVERGENCE.md §7). Catching a thought is now the write band's
 * job — Write's drafts always accept, and a capture can grow into an essay or
 * a story without changing rooms.
 *
 * @type {readonly import('./types').LandingBand[]}
 */
export const landingBands = Object.freeze([
	{ id: 'write', label: 'write', blurb: 'where the words go — from stray thought to finished piece', order: 1 },
	{ id: 'tend', label: 'tend', blurb: 'the things you keep, and keep coming back to', order: 2 },
	{ id: 'read', label: 'read', blurb: 'finished things, sitting still to be read', order: 3 },
	{ id: 'play', label: 'play', blurb: 'no goal beyond the doing of it', order: 4 }
]);

/**
 * Landing tiles grouped into their bands, bands in order, tiles in their usual
 * order within each. Bands with no tiles are omitted.
 *
 * @type {readonly { band: import('./types').LandingBand; apps: readonly LandingApp[] }[]}
 */
export const landingAppsByBand = Object.freeze(
	landingBands
		.map((band) => ({
			band,
			apps: Object.freeze(landingApps.filter((app) => app.band === band.id))
		}))
		.filter((group) => group.apps.length > 0)
);

/** @param {AppDefinition} app */
export function primaryDestination(app) {
	return `/${app.outputDir}/${app.entryFile}`;
}

// ── addressing one record inside an app ───────────────────────────
//
// `primaryDestination` above answers "where does this app live"; these answer
// "where does *this thing* live". The distinction is the whole subject of
// REFERENCES.md: until now the workspace had no vocabulary for the second
// question, so the two places that needed it hardcoded a path — the studio
// wrote the literal `/play?game=`, and `HandoffSource.href` was documented as
// a deep link back and populated once, with an app root.
//
// The shape is deliberately one convention rather than a per-app scheme:
// `<publicPath>?<kind>=<id>`. An app declares which kinds it answers to via
// `addressableBy`, a contract test asserts the app actually reads that
// parameter, and nothing else is addressable. Keeping it to a query parameter
// (rather than a path segment or a hash) is what lets every app stay a
// prerendered static bundle with no router change.

/**
 * Whether `appId` can be opened on a record of `kind`. Use before
 * `entityHref` anywhere the pair isn't known at author time.
 *
 * @param {string} appId
 * @param {string} kind
 * @returns {boolean}
 */
export function canAddress(appId, kind) {
	return appById[appId]?.addressableBy?.includes(kind) === true;
}

/**
 * The URL that opens one record inside an app.
 *
 * Throws rather than returning null on an unknown app or an undeclared kind:
 * the manifest is static data, so neither is a runtime condition a caller
 * could sensibly recover from — both are a bug, and a thrown error names it
 * at the call site instead of rendering `href="null"`.
 *
 * @param {string} appId manifest app id, e.g. `bloomforge-player`
 * @param {string} kind a record kind the app lists in `addressableBy`
 * @param {string} id the record's own id, encoded here so callers needn't
 * @returns {string}
 */
export function entityHref(appId, kind, id) {
	const app = appById[appId];
	if (!app) {
		throw new Error(`entityHref: "${appId}" is not an app in the manifest`);
	}
	if (!canAddress(appId, kind)) {
		throw new Error(
			`entityHref: ${appId} declares no addressable "${kind}" — add it to that app's ` +
				`addressableBy and read the parameter in the app itself`
		);
	}
	return `${app.publicPath}?${kind}=${encodeURIComponent(id)}`;
}

/**
 * @param {string} tileId
 * @param {number} order
 * @param {import('./types').LandingBandId} band
 * @param {string} description
 * @param {string} gradientFrom
 * @param {string} gradientTo
 * @param {string} gradientAngle
 * @param {Partial<LandingTileDefinition>} [extra]
 * @returns {LandingTileDefinition}
 */
function tile(tileId, order, band, description, gradientFrom, gradientTo, gradientAngle, extra = {}) {
	return { tileId, order, band, description, gradientFrom, gradientTo, gradientAngle, ...extra };
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
		band: tileDefinition.band,
		g1: tileDefinition.gradientFrom,
		g2: tileDefinition.gradientTo,
		ga: tileDefinition.gradientAngle,
		order: tileDefinition.order,
		...(tileDefinition.defaultPin === undefined ? {} : { defaultPin: tileDefinition.defaultPin }),
		...(tileDefinition.featured === undefined ? {} : { featured: tileDefinition.featured })
	};
}
