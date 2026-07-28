import { expect, type Page, type Route } from '@playwright/test';

export const pixel =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="#d46a9a"/></svg>');

export const publishedCreature = {
	id: 'e2e-moth',
	name: 'Integration Moth',
	domain: 'dream',
	kind: 'Test Familiar',
	cost: 2,
	rarity: 'common',
	power: 2,
	toughness: 3,
	abilities: 'Crosses app boundaries without losing its wings.',
	flavor: 'A small proof, still glowing.',
	foundIn: 'the integration margin',
	cardImage: pixel,
	isolatedSprite: pixel,
	hasIsolatedSprite: true,
	pixelated: false,
	sourceImage: pixel,
	publishedAt: '2026-07-22T12:00:00.000Z'
};

export async function fulfillPublicApi(route: Route): Promise<void> {
	const url = new URL(route.request().url());
	if (route.request().method() === 'GET' && url.searchParams.get('app') === 'bestiary') {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				blob: { creatures: [publishedCreature] },
				version: 1,
				publishedAt: publishedCreature.publishedAt
			})
		});
		return;
	}
	await route.fallback();
}

export async function expectNoPageErrors(page: Page, action: () => Promise<unknown>): Promise<void> {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	await action();
	await page.waitForTimeout(250);
	expect(errors, errors.join('\n')).toEqual([]);
}
