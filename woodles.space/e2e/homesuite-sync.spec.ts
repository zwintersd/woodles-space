import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/** /api/sync for one test, shared by every device in it: compare-and-swap, one passphrase. */
function fakeSyncServer() {
	const rows = new Map<string, { blob: unknown; version: number }>();
	const serve = async (context: BrowserContext) => {
		await context.route('**/api/sync**', async (route) => {
			const request = route.request();
			if (request.headers().authorization !== 'Bearer correct horse') return route.fulfill({ status: 401, json: { ok: false } });
			if (request.method() === 'GET') {
				const app = new URL(request.url()).searchParams.get('app') ?? '';
				return route.fulfill({ json: rows.get(app) ?? { blob: null, version: 0 } });
			}
			const { app, blob, baseVersion } = request.postDataJSON() as { app: string; blob: unknown; baseVersion: number };
			const row = rows.get(app) ?? { blob: null, version: 0 };
			if (row.version !== baseVersion) return route.fulfill({ status: 409, json: { ok: false, conflict: true, server: row } });
			rows.set(app, { blob, version: row.version + 1 });
			return route.fulfill({ json: { ok: true, version: row.version + 1 } });
		});
	};
	return Object.assign(serve, { rows });
}

async function connect(page: Page, pass = 'correct horse'): Promise<void> {
	await page.locator('.sync-trigger').click();
	const dialog = page.getByRole('dialog', { name: 'Sync HomeSuite' });
	await dialog.getByLabel('Sync passphrase').fill(pass);
	await dialog.getByRole('button', { name: 'Connect' }).click();
}

test.describe('HomeSuite sync', () => {
	test('a document made on the computer appears on the phone, and the phone’s Trash comes back', async ({ browser }) => {
		const serve = fakeSyncServer();
		const desk = await browser.newContext();
		const phone = await browser.newContext({ viewport: { width: 390, height: 780 } });
		await serve(desk);
		await serve(phone);

		const deskPage = await desk.newPage();
		await deskPage.goto('/homesuite');
		await expect(deskPage.locator('.sync-trigger')).toHaveAccessibleName(/Sync off/);
		await deskPage.getByRole('button', { name: '＋ New', exact: true }).click();
		await deskPage.getByRole('menuitem', { name: /Document/ }).click();
		await expect(deskPage.locator('iframe.native-surface')).toBeVisible();
		await deskPage.getByRole('button', { name: '← All things' }).click();
		await expect(deskPage.locator('.artifact-row')).toHaveCount(1);
		await connect(deskPage);
		await expect(deskPage.getByRole('dialog', { name: 'Sync HomeSuite' }).getByRole('status')).toContainText('Synced at');
		await expect(deskPage.locator('.sync-trigger')).toHaveAccessibleName(/^Synced/);

		const phonePage = await phone.newPage();
		await phonePage.goto('/homesuite');
		await expect(phonePage.locator('.artifact-row')).toHaveCount(0);
		await connect(phonePage);
		await expect(phonePage.locator('.artifact-row')).toHaveCount(1);
		await phonePage.keyboard.press('Escape');
		await phonePage.getByRole('button', { name: /^Actions for Untitled document/ }).click();
		await phonePage.getByRole('menuitem', { name: 'Move to Trash' }).click();
		await expect(phonePage.locator('.artifact-row')).toHaveCount(0);
		// Sent on without leaving the index.
		await expect.poll(() => JSON.stringify(serve.rows.get('homesuite')?.blob ?? null)).toContain('trashedAt');

		// The computer remembers its passphrase, and picks the change up on opening.
		await deskPage.reload();
		await expect(deskPage.locator('.sync-trigger')).toHaveAccessibleName(/^Synced/);
		await expect(deskPage.locator('.artifact-row')).toHaveCount(0);
		await deskPage.getByRole('button', { name: /^Trash/ }).click();
		await expect(deskPage.locator('.trash-row')).toHaveCount(1);

		await desk.close();
		await phone.close();
	});

	test('a wrong passphrase says so and leaves sync off', async ({ browser }) => {
		const context = await browser.newContext();
		await fakeSyncServer()(context);
		const page = await context.newPage();
		await page.goto('/homesuite');
		await connect(page, 'nope');
		await expect(page.getByRole('dialog', { name: 'Sync HomeSuite' }).getByRole('alert')).toContainText('wrong passphrase');
		await expect(page.locator('.sync-trigger')).toHaveAccessibleName(/Sync off/);
		await context.close();
	});

	for (const colorScheme of ['light', 'dark'] as const) {
		test(`the sync dialog meets WCAG AA in the ${colorScheme} scheme`, async ({ browser }) => {
			const context = await browser.newContext({ colorScheme });
			await fakeSyncServer()(context);
			const page = await context.newPage();
			await page.goto('/homesuite');
			await page.locator('.sync-trigger').click();
			const off = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
			expect(off.violations, JSON.stringify(off.violations, null, 2)).toEqual([]);
			await page.getByLabel('Sync passphrase').fill('correct horse');
			await page.getByRole('button', { name: 'Connect' }).click();
			await expect(page.getByRole('button', { name: 'Sync now' })).toBeVisible();
			const on = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
			expect(on.violations, JSON.stringify(on.violations, null, 2)).toEqual([]);
			await context.close();
		});
	}
});
