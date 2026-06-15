// A local visual-check harness for the bestiary.
//
// It boots the dev server, seeds a few creatures, drives the editor through
// every card-look preset, and captures the actual "save card" PNG export — so
// the things that can't be unit-tested (frame layouts, finishes, textures, and
// export fidelity) can be eyeballed in one folder.
//
// It uses playwright-core against your *system* Chrome (no browser download),
// so nothing here depends on a CDN. Run it with:
//
//     pnpm --filter bestiary screenshot
//
// Requires Google Chrome (or Edge) installed. If yours is elsewhere, set
// CHROME_PATH=/path/to/chrome, or BROWSER_CHANNEL=msedge. Output lands in
// apps/bestiary/screenshots/ (gitignored).

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const outDir = path.join(appDir, 'screenshots');
const PORT = Number(process.env.PORT) || 5317;
const BASE = `http://localhost:${PORT}/bestiary`;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── seed data (this branch persists to localStorage) ──────────────────

function sprite(color) {
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><radialGradient id='g' cx='40%' cy='35%'><stop offset='0%' stop-color='white'/><stop offset='100%' stop-color='${color}'/></radialGradient></defs><circle cx='100' cy='110' r='74' fill='url(#g)'/><circle cx='78' cy='92' r='10' fill='#2b2433'/><circle cx='122' cy='92' r='10' fill='#2b2433'/></svg>`;
	return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function creature(over) {
	const ts = new Date().toISOString();
	return {
		id: Math.random().toString(36).slice(2, 10),
		name: '',
		sprite: null,
		pixelated: false,
		domain: 'unspecified',
		kind: '',
		cost: 1,
		rarity: 'common',
		power: 1,
		toughness: 1,
		abilities: '',
		flavor: '',
		foundIn: '',
		stats: { body: 1, mind: 1, grace: 1, heart: 1, will: 1, spark: 1, substats: {} },
		created: ts,
		updated: ts,
		...over
	};
}

const seed = [
	creature({ name: 'Hourling', domain: 'temporal', rarity: 'rare', kind: 'Spirit Wisp', cost: 3, power: 2, toughness: 3, abilities: 'When this enters, draw the margin.', flavor: 'it keeps a clock no one wound.', foundIn: 'a dog-eared page', sprite: sprite('#f2b75e'), stats: { body: 3, mind: 7, grace: 4, heart: 5, will: 6, spark: 8, substats: {} } }),
	creature({ name: 'Mossback', domain: 'biochemical', rarity: 'common', kind: 'Beast', cost: 2, power: 3, toughness: 2, abilities: 'Slow, and certain.', flavor: 'older than the path it sleeps on.', sprite: sprite('#86d6a0') }),
	creature({ name: 'Echo', domain: 'relational', rarity: 'mythic', kind: 'Revenant', cost: 5, power: 4, toughness: 6, abilities: 'It answers in your own voice.', flavor: 'written once, perhaps never again.', sprite: sprite('#cf9be8'), stats: { body: 4, mind: 8, grace: 9, heart: 7, will: 5, spark: 6, substats: {} } }),
	creature({ name: 'Driftwisp', domain: 'spatial', rarity: 'uncommon', kind: 'Construct', cost: 2, power: 1, toughness: 4, abilities: 'Holds a shape against the wind.', sprite: sprite('#7fb8ec') })
];

// every card-look preset, in display order (must match cardstyle.ts)
const presets = [
	'vellum',
	'full bleed',
	'midnight foil',
	'old codex',
	'neon',
	'cinema',
	'minimal ink',
	'arcade'
];

// ── plumbing ──────────────────────────────────────────────────────────

async function waitForServer(url, timeoutMs = 90000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const r = await fetch(url);
			if (r.ok) return;
		} catch {
			// not up yet
		}
		await sleep(500);
	}
	throw new Error(`dev server never responded at ${url}`);
}

async function launchBrowser() {
	const { chromium } = await import('playwright-core');
	if (process.env.CHROME_PATH) {
		return chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
	}
	const channels = process.env.BROWSER_CHANNEL ? [process.env.BROWSER_CHANNEL] : ['chrome', 'msedge'];
	let lastErr;
	for (const channel of channels) {
		try {
			return await chromium.launch({ channel, headless: true });
		} catch (e) {
			lastErr = e;
		}
	}
	throw new Error(
		`Couldn't launch a system browser (tried: ${channels.join(', ')}).\n` +
			`Install Google Chrome, or set CHROME_PATH=/path/to/chrome (or BROWSER_CHANNEL=msedge).\n` +
			`Underlying error: ${lastErr?.message ?? lastErr}`
	);
}

async function main() {
	await mkdir(outDir, { recursive: true });

	console.log(`· starting dev server on :${PORT} …`);
	const server = spawn('pnpm', ['exec', 'vite', 'dev', '--port', String(PORT), '--strictPort'], {
		cwd: appDir,
		stdio: ['ignore', 'ignore', 'inherit']
	});
	let stopped = false;
	const stop = () => {
		if (stopped) return;
		stopped = true;
		try {
			server.kill('SIGTERM');
		} catch {
			// already gone
		}
	};
	process.on('exit', stop);
	process.on('SIGINT', () => {
		stop();
		process.exit(130);
	});

	try {
		await waitForServer(BASE);
		console.log('· server up — launching browser …');
		const browser = await launchBrowser();
		const ctx = await browser.newContext({
			viewport: { width: 1340, height: 940 },
			deviceScaleFactor: 2,
			acceptDownloads: true
		});
		// seed before the app's scripts run
		await ctx.addInitScript((data) => {
			try {
				localStorage.setItem('bestiary.creatures.v1', data);
			} catch {
				/* ignore */
			}
		}, JSON.stringify(seed));

		const page = await ctx.newPage();
		const shot = (name) => page.screenshot({ path: path.join(outDir, name) });
		const wrote = [];

		await page.goto(BASE, { waitUntil: 'networkidle' });
		await sleep(700);

		const cards = page.locator('.card-cell');
		if ((await cards.count()) === 0) {
			console.warn(
				'! the shelf is empty — seeding may not have taken (has this branch moved to IndexedDB?).\n' +
					'  creating one creature through the UI so the rest of the run still produces shots.'
			);
			await page.getByRole('button', { name: /new creature/i }).first().click();
			await sleep(500);
			await page.getByRole('button', { name: /the shelf/i }).first().click();
			await sleep(500);
		}

		await shot('01-shelf.png');
		wrote.push('01-shelf.png');

		// open the first card → editor
		await cards.first().click();
		await sleep(600);
		await shot('02-editor-content.png');
		wrote.push('02-editor-content.png');

		// the look tab + each preset, captured as a clean card
		await page.getByRole('tab', { name: 'look' }).click();
		await sleep(400);
		await shot('03-editor-look.png');
		wrote.push('03-editor-look.png');

		const preview = page.locator('.preview-card');
		for (const name of presets) {
			const btn = page.locator('.appearance .preset', { hasText: name });
			if ((await btn.count()) === 0) continue;
			await btn.first().click();
			await sleep(350);
			const file = `frame-${slug(name)}.png`;
			await preview.screenshot({ path: path.join(outDir, file) });
			wrote.push(file);
		}

		// the real export: capture the downloaded PNGs
		await page.locator('.appearance .preset', { hasText: 'midnight foil' }).first().click();
		await sleep(350);
		try {
			const [dl] = await Promise.all([
				page.waitForEvent('download', { timeout: 30000 }),
				page.getByRole('button', { name: /save card/i }).click()
			]);
			await dl.saveAs(path.join(outDir, 'export-card.png'));
			wrote.push('export-card.png  ← the rasterised card');
		} catch (e) {
			console.warn(`! save-card export did not produce a download: ${e.message}`);
		}
		try {
			const [dl] = await Promise.all([
				page.waitForEvent('download', { timeout: 15000 }),
				page.getByRole('button', { name: /art only/i }).click()
			]);
			await dl.saveAs(path.join(outDir, 'export-art.png'));
			wrote.push('export-art.png');
		} catch {
			// art-only is optional (no sprite, or SVG taint) — skip quietly
		}

		// bonus: the sprite studio
		try {
			await page.getByRole('tab', { name: 'content' }).click();
			await sleep(300);
			await page.getByRole('button', { name: /sprite studio/i }).click();
			await page.locator('.studio').waitFor({ timeout: 8000 });
			await sleep(800);
			await shot('07-sprite-studio.png');
			wrote.push('07-sprite-studio.png');
		} catch (e) {
			console.warn(`! sprite-studio shot skipped: ${e.message}`);
		}

		await browser.close();
		console.log(`\n✓ ${wrote.length} screenshots in ${path.relative(process.cwd(), outDir)}/`);
		for (const w of wrote) console.log(`   · ${w}`);
	} finally {
		stop();
	}
}

main().catch((err) => {
	console.error('\n✗ screenshot run failed:\n', err.message ?? err);
	process.exitCode = 1;
});
