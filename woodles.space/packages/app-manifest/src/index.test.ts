import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	appById,
	appManifest,
	defaultLandingPins,
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
		// Dev Log was folded into Spores (CONVERGENCE.md step 2). Its manifest
		// entry is gone, so nothing else in this suite would notice if the old
		// bookmark started 404ing.
		for (const source of ['/marginalia-devlog', '/marginalia-devlog/:path*']) {
			const redirect = redirects.get(source);
			expect(redirect, source).toBeDefined();
			expect(redirect?.destination).toBe('/spores');
			expect(redirect?.permanent).toBe(true);
		}
		expect(appManifest.some((app) => app.id === 'marginalia-devlog')).toBe(false);
	});

	it('never redirects a route that an app still serves', () => {
		for (const app of appManifest) {
			expect(redirects.has(app.publicPath), app.id).toBe(false);
		}
	});
});

describe('landing catalogue', () => {
	it('derives the sixteen ordered tiles, pins, and featured fallbacks from the manifest', () => {
		expect(landingApps).toHaveLength(16);
		expect(landingApps.map((app) => app.order)).toEqual([...Array(16)].map((_, index) => index + 1));
		expect(new Set(landingApps.map((app) => app.id)).size).toBe(landingApps.length);
		expect(defaultLandingPins).toEqual(['hygge', 'write', 'marg', 'planner', 'notebook', 'quiet']);
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

	it('keeps the front door alone in its band', () => {
		// "catch" is the one-way-in band. more than one app in it means the
		// routing decision CONVERGENCE.md set out to remove has grown back.
		const catchBand = landingAppsByBand.find((group) => group.band.id === 'catch');
		expect(catchBand?.apps.map((app) => app.id)).toEqual(['notebook']);
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
