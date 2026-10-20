import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { PlannerBlob } from '../apps/planner/src/lib/types';

/** /api/sync for one test, shared by every device in it: compare-and-swap per app, one passphrase. */
function fakeSyncServer() {
	const rows = new Map<string, { blob: unknown; version: number }>();
	const serve = async (context: BrowserContext) => {
		await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, body: '' }));
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
		await context.addInitScript(() => {
			if (!localStorage.getItem('planner.settings.v1')) {
				localStorage.setItem('planner.settings.v1', JSON.stringify({ onboardingComplete: true, bellsEnabled: false, fixedPaletteMode: 'late-afternoon' }));
			}
		});
	};
	return Object.assign(serve, {
		signals: () => ((rows.get('planner')?.blob as PlannerBlob | undefined)?.signals ?? []).map((entry) => entry.label).sort()
	});
}

async function openContext(page: Page): Promise<void> {
	const details = page.locator('details.context-details').filter({ has: page.getByTestId('context-card') });
	if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await details.locator('summary').click();
}

async function logSignal(page: Page, label: string): Promise<void> {
	await openContext(page);
	const card = page.getByTestId('context-card');
	await card.getByRole('button', { name: '+ log something ongoing' }).click();
	await card.getByRole('group', { name: 'what kind of thing' }).getByRole('button', { name: /something else/ }).click();
	await card.getByPlaceholder('started new medication, travel…').fill(label);
	await card.getByRole('button', { name: 'log it' }).click();
	await expect(card.getByRole('button', { name: `remove ${label}` })).toBeVisible();
}

async function connect(page: Page): Promise<void> {
	await page.getByRole('button', { name: /^Open sync panel/ }).click();
	await page.locator('#sync-pass').fill('correct horse');
	await page.getByRole('button', { name: 'connect', exact: true }).click();
	await expect(page.locator('.sync-status-text')).toHaveText('synced');
	await page.keyboard.press('Escape');
}

test.describe('Carillon sync', () => {
	test('a signal removed on the phone stays removed on the computer', async ({ browser }) => {
		const serve = fakeSyncServer();
		const desk = await browser.newContext();
		const phone = await browser.newContext({ viewport: { width: 390, height: 780 } });
		await serve(desk);
		await serve(phone);

		const deskPage = await desk.newPage();
		await deskPage.goto('/planner');
		await logSignal(deskPage, 'New medication');
		await logSignal(deskPage, 'Travelling');
		await connect(deskPage);
		await expect.poll(serve.signals).toEqual(['New medication', 'Travelling']);

		const phonePage = await phone.newPage();
		await phonePage.goto('/planner');
		await connect(phonePage);
		await openContext(phonePage);
		const phoneCard = phonePage.getByTestId('context-card');
		await expect(phoneCard.getByRole('button', { name: 'remove Travelling' })).toBeVisible();
		await phoneCard.getByRole('button', { name: 'remove Travelling' }).click();
		await expect.poll(serve.signals).toEqual(['New medication']);

		// The computer still holds it, and picks the removal up on opening instead of putting it back.
		await deskPage.reload();
		await openContext(deskPage);
		const deskCard = deskPage.getByTestId('context-card');
		await expect(deskCard.getByRole('button', { name: 'remove Travelling' })).toHaveCount(0);
		await expect(deskCard.getByRole('button', { name: 'remove New medication' })).toBeVisible();
		await deskPage.getByRole('button', { name: /^Open sync panel/ }).click();
		await deskPage.getByRole('button', { name: 'sync now', exact: true }).click();
		await expect(deskPage.locator('.sync-status-text')).toHaveText('synced');
		expect(serve.signals()).toEqual(['New medication']);

		await desk.close();
		await phone.close();
	});

	test('two tabs keep each other’s changes, and both reach the server', async ({ browser }) => {
		const serve = fakeSyncServer();
		const context = await browser.newContext();
		await serve(context);
		const first = await context.newPage();
		await first.goto('/planner');
		await connect(first);
		const second = await context.newPage();
		await second.goto('/planner');
		await expect(second.getByRole('button', { name: /^Open sync panel/ })).toHaveAccessibleName(/phone \+ desktop/);

		await logSignal(first, 'From the first tab');
		// Arrives in the other tab without a reload.
		await openContext(second);
		await expect(second.getByTestId('context-card').getByRole('button', { name: 'remove From the first tab' })).toBeVisible();
		await logSignal(second, 'From the second tab');

		await expect.poll(serve.signals).toEqual(['From the first tab', 'From the second tab']);
		await first.reload();
		await openContext(first);
		await expect(first.getByTestId('context-card').getByRole('button', { name: /^remove From/ })).toHaveCount(2);
		await context.close();
	});
});
