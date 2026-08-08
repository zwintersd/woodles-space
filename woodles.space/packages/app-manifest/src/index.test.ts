import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	appById,
	appManifest,
	canAddress,
	defaultLandingPins,
	entityHref,
	featuredLandingApps,
	landingApps,
	landingAppsByBand,
	landingBands,
	primaryDestination,
	type AppDefinition
} from './index.js';

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const VERCEL = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
	rewrites: { source: string; destination: string }[];
	redirects?: { source: string; destination: string; permanent?: boolean }[];
};
const rewrites = new Map(VERCEL.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
const redirects = new Map((VERCEL.redirects ?? []).map((entry) => [entry.source, entry]));

describe('canonical app inventory', () => {
	it('accounts for every deployable app directory exactly once', () => {
		const directories = readdirSync(join(ROOT, 'apps'), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
		const manifested = appManifest.map((app) => app.sourceDir.replace('apps/', '')).sort();

		expect(manifested).toEqual(directories);
		expect(new Set(appManifest.map((app) => app.id)).size).toBe(appManifest.length);
		expect(new Set(appManifest.map((app) => app.publicPath)).size).toBe(appManifest.length);
	});

	it('provides stable lookup, maturity, and deployment metadata', () => {
		for (const app of appManifest) {
			expect(appById[app.id]).toBe(app);
			expect(['stable', 'growing', 'incubator', 'private']).toContain(app.maturity);
			expect(app.publicPath).toMatch(/^\/(?:[^/]+)?$/);
			expect(app.outputDir).toMatch(/^apps\//);
			expect(app.entryFile).toBe('index.html');
		}
	});
});

describe('route smoke contract', () => {
	it('maps every primary public route to the manifest output', () => {
		for (const app of appManifest) {
			expect(rewrites.get(app.publicPath), app.id).toBe(primaryDestination(app));
		}
	});

	it('keeps every declared alias reachable', () => {
		for (const app of appManifest) {
			for (const alias of app.aliases) {
				expect(rewrites.has(alias), `${app.id}: ${alias}`).toBe(true);
			}
		}
	});

	it('finds static entrypoints and verifies Svelte build/base contracts', () => {
		for (const app of appManifest) verifyAppShape(app);
	});

	it('keeps a retired app’s route alive as a redirect rather than a 404', () => {
		// Retired apps lose their manifest entry, so nothing else in this suite
		// would notice if an old bookmark started 404ing. Dev Log folded into
		// Spores (CONVERGENCE.md step 2); Notebook folded into Write (§7).
		const retired: [string, string][] = [
			['/marginalia-devlog', '/spores'],
			['/notebook', '/write']
		];
		for (const [route, destination] of retired) {
			for (const source of [route, `${route}/:path*`]) {
				const redirect = redirects.get(source);
				expect(redirect, source).toBeDefined();
				expect(redirect?.destination).toBe(destination);
				expect(redirect?.permanent).toBe(true);
			}
		}
		expect(appManifest.some((app) => app.id === 'marginalia-devlog')).toBe(false);
		expect(appManifest.some((app) => app.id === 'notebook')).toBe(false);
	});

	it('never redirects a route that an app still serves', () => {
		for (const app of appManifest) {
			expect(redirects.has(app.publicPath), app.id).toBe(false);
		}
	});
});

describe('landing catalogue', () => {
	it('derives the fifteen ordered tiles, pins, and featured fallbacks from the manifest', () => {
		expect(landingApps).toHaveLength(15);
		expect(landingApps.map((app) => app.order)).toEqual([...Array(15)].map((_, index) => index + 1));
		expect(new Set(landingApps.map((app) => app.id)).size).toBe(landingApps.length);
		expect(defaultLandingPins).toEqual(['hygge', 'write', 'marg', 'planner', 'quiet']);
		expect(featuredLandingApps.map((app) => app.id)).toEqual(['marg', 'bestiary', 'write']);
	});

	it('sorts every tile into exactly one known band, losing none', () => {
		const bandIds = landingBands.map((band) => band.id);
		expect(new Set(bandIds).size).toBe(landingBands.length);
		expect(landingBands.map((band) => band.order)).toEqual(
			[...Array(landingBands.length)].map((_, index) => index + 1)
		);

		for (const app of landingApps) {
			expect(bandIds, app.id).toContain(app.band);
		}

		const grouped = landingAppsByBand.flatMap((group) => group.apps);
		expect(grouped).toHaveLength(landingApps.length);
		expect(new Set(grouped.map((app) => app.id)).size).toBe(landingApps.length);
		expect(landingAppsByBand.map((group) => group.band.order)).toEqual(
			[...landingAppsByBand.map((group) => group.band.order)].sort((a, b) => a - b)
		);
	});

	it('keeps the write band the one front door for words', () => {
		// The catch band retired with Notebook (CONVERGENCE.md §7): catching a
		// thought is Write's job now. A resurrected catch band — or a second
		// app in write — means the routing decision CONVERGENCE.md set out to
		// remove has grown back.
		expect(landingBands.some((band) => band.id === 'catch')).toBe(false);
		const writeBand = landingAppsByBand.find((group) => group.band.id === 'write');
		expect(writeBand?.apps.map((app) => app.id)).toEqual(['write']);
	});

	it('imports the canonical catalogue and retains artwork for every tile', () => {
		const landing = readFileSync(join(ROOT, 'apps/landing/index.html'), 'utf8');
		expect(landing).toContain("from '/packages/app-manifest/src/index.js'");
		expect(landing).not.toMatch(/const\s+apps\s*=\s*\[/);

		for (const tile of landingApps) {
			expect(landing, tile.id).toMatch(new RegExp(`^\\s*${escapeRegExp(tile.id)}:\\s`, 'm'));
			const href = tile.href.split('#')[0];
			expect(
				appManifest.some((app) => app.publicPath === href || app.aliases.includes(href)),
				`${tile.id}: ${tile.href}`
			).toBe(true);
		}
	});
});

describe('entity addressing', () => {
	it('builds a record URL from the public path the manifest owns', () => {
		expect(entityHref('bloomforge-player', 'game', 'proj-1')).toBe('/play?game=proj-1');
	});

	it('encodes ids that would otherwise break the query string', () => {
		expect(entityHref('bloomforge-player', 'game', 'a b&c=d')).toBe('/play?game=a%20b%26c%3Dd');
	});

	it('refuses an unknown app and an undeclared kind', () => {
		expect(() => entityHref('nonesuch', 'game', 'x')).toThrow(/not an app/);
		// `write` is real but declares no addressable kinds — a link naming one
		// would point at a parameter nothing reads, which is the failure mode
		// `HandoffSource.href` already demonstrates (REFERENCES.md §2.2).
		expect(() => entityHref('write', 'draft', 'x')).toThrow(/declares no addressable/);
	});

	it('keeps every declared kind url-safe, so it needs no encoding of its own', () => {
		// entityHref encodes the id but interpolates the kind raw — a kind with
		// a `&` or a space in it would build a URL that silently means something
		// else. Same lowercase-and-hyphens shape the sync app keys use.
		for (const app of appManifest) {
			for (const kind of app.addressableBy ?? []) {
				expect(kind, `${app.id} declares "${kind}"`).toMatch(/^[a-z0-9-]{1,40}$/);
			}
		}
	});

	it('reports addressability without throwing, for callers that cannot know', () => {
		expect(canAddress('bloomforge-player', 'game')).toBe(true);
		expect(canAddress('bloomforge-player', 'draft')).toBe(false);
		expect(canAddress('nonesuch', 'game')).toBe(false);
	});

	// The tripwire that makes the declaration mean something. The manifest can
	// claim an app answers to `?game=`, but only the app can actually read it —
	// same stance the route contract above takes toward vercel.json and each
	// svelte.config.js: don't make them import each other, assert they agree.
	//
	// It matches the parameter name as a quoted literal anywhere in the app's
	// source rather than inside a `.get(...)` call specifically: naming it in a
	// constant (`const ARRIVAL_PARAM = '...'`) is better than inlining it at
	// the read site, and a contract test shouldn't push an app toward the worse
	// shape. That makes this a tripwire against a declaration nothing
	// implements, not a proof the wiring is correct — which is the job it is
	// here to do.
	it('declares only kinds the target app actually reads', () => {
		for (const app of appManifest) {
			for (const kind of app.addressableBy ?? []) {
				const sources = sourceFilesOf(join(ROOT, app.sourceDir));
				const pattern = new RegExp(`['"\`]${escapeRegExp(kind)}['"\`]`);
				const reads = sources.some((file) => pattern.test(readFileSync(file, 'utf8')));
				expect(reads, `${app.id} declares "${kind}" but never names it`).toBe(true);
			}
		}
	});
});

/** Every source file under an app, skipping build output and dependencies. */
function sourceFilesOf(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.svelte-kit') {
			continue;
		}
		const full = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...sourceFilesOf(full));
		else if (/\.(svelte|ts|js)$/.test(entry.name)) found.push(full);
	}
	return found;
}

function verifyAppShape(app: AppDefinition): void {
	if (app.kind !== 'sveltekit') {
		expect(existsSync(join(ROOT, app.outputDir, app.entryFile)), app.id).toBe(true);
		return;
	}

	expect(app.outputDir).toBe(`${app.sourceDir}/dist`);
	const packageJson = JSON.parse(readFileSync(join(ROOT, app.sourceDir, 'package.json'), 'utf8')) as {
		name: string;
		scripts?: Record<string, string>;
	};
	expect(packageJson.name).toBe(app.packageName);
	expect(packageJson.scripts?.build).toBe('vite build');

	const config = readFileSync(join(ROOT, app.sourceDir, 'svelte.config.js'), 'utf8');
	expect(config).toContain(`pages: 'dist'`);
	expect(config).toContain(`assets: 'dist'`);
	expect(config).toContain(`base: '${app.publicPath}'`);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
