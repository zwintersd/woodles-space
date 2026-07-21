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
	primaryDestination,
	type AppDefinition
} from './index.js';

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const VERCEL = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
	rewrites: { source: string; destination: string }[];
};
const rewrites = new Map(VERCEL.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));

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
});

describe('landing catalogue', () => {
	it('derives the fifteen ordered tiles, pins, and featured fallbacks from the manifest', () => {
		expect(landingApps).toHaveLength(15);
		expect(landingApps.map((app) => app.order)).toEqual([...Array(15)].map((_, index) => index + 1));
		expect(new Set(landingApps.map((app) => app.id)).size).toBe(landingApps.length);
		expect(defaultLandingPins).toEqual(['hygge', 'write', 'marg', 'planner', 'notebook', 'quiet']);
		expect(featuredLandingApps.map((app) => app.id)).toEqual(['marg', 'bestiary', 'write']);
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
