import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('a shelf export passes through the publisher into the public index', async ({ page }) => {
	const entry = {
		slug: 'integration-boundary',
		title: 'Integration Boundary',
		subject: 'Testing',
		desc: 'A browser export that becomes a public shelf card.',
		accent: 'rose',
		finish: 'none',
		glyph: '✦',
		layers: [],
		html: '<!doctype html><html lang="en"><title>Integration Boundary</title><body><h1>Integration Boundary</h1></body></html>',
		savedAt: Date.now()
	};

	await page.addInitScript((shelfEntry) => {
		localStorage.setItem('ologypedia-studio-v1', JSON.stringify([shelfEntry]));
	}, entry);
	await page.goto('/ologypedia/add-page.html');
	await expect(page.getByText('Integration Boundary', { exact: true })).toBeVisible();

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export shelf as JSON' }).click();
	const download = await downloadPromise;

	const tempRoot = await mkdtemp(path.join(tmpdir(), 'ologypedia-publish-'));
	const tempApp = path.join(tempRoot, 'ologypedia');
	await mkdir(tempApp);
	const exportPath = path.join(tempRoot, 'shelf.json');
	await download.saveAs(exportPath);
	await copyFile(path.resolve('apps/ologypedia/index.html'), path.join(tempApp, 'index.html'));

	try {
		const { stdout } = await execFileAsync(
			process.execPath,
			['apps/ologypedia/scripts/publish.mjs', exportPath, '--app-dir', tempApp],
			{ cwd: process.cwd() }
		);
		expect(stdout).toContain('added:   integration-boundary');
		expect(await readFile(path.join(tempApp, 'textbook-integration-boundary.html'), 'utf8')).toContain(
			'<h1>Integration Boundary</h1>'
		);
		const index = await readFile(path.join(tempApp, 'index.html'), 'utf8');
		expect(index).toContain('data-slug="integration-boundary"');
		expect(index).toContain('href="/ologypedia/textbook-integration-boundary.html"');
	} finally {
		await rm(tempRoot, { recursive: true, force: true });
	}
});
