import { expect, test } from '@playwright/test';
import { defaultCardStyle, MYCELIUM_STORAGE_KEY, type Person } from '../packages/mycelium/src/index';

const person: Person = {
	id: 'person-juniper', name: 'Juniper Lane', pronouns: 'they/them', role: 'Illustrator', organization: 'Fern Studio',
	emails: [{ id: 'email-work', label: 'Work', value: 'juniper@example.com' }], phones: [], links: [],
	location: 'Portland', birthday: '', tags: ['art'], notes: 'Prefers email.', portrait: null, favorite: false,
	cardStyle: defaultCardStyle(), createdAt: '2026-10-19T12:00:00.000Z', updatedAt: '2026-10-19T12:00:00.000Z'
};

test.beforeEach(async ({ page }) => {
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, body: '' }));
	await page.route('**/api/sync**', (route) => route.fulfill({
		status: 200, contentType: 'application/json', body: JSON.stringify({ blob: null, version: 0 })
	}));
	await page.addInitScript(({ key, contact }) => {
		if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify({ format: 'woodles-mycelium', version: 1, people: [contact] }));
	}, { key: MYCELIUM_STORAGE_KEY, contact: person });
});

test('Write stores the complete person reference and removing prose preserves the contact', async ({ page }) => {
	await page.goto('/write');
	const editor = page.getByRole('textbox', { name: 'foreground content' });
	await editor.click();
	await editor.pressSequentially('Ask #Juniper');
	const picker = page.getByTestId('reference-picker');
	await expect(picker).toContainText('Juniper Lane');
	await expect(picker).toContainText('Mycelium');
	await page.keyboard.press('Enter');
	const link = editor.locator('a[data-ref-app="mycelium"]');
	await expect(link).toHaveAttribute('data-ref-kind', 'person');
	await expect(link).toHaveAttribute('data-ref-id', person.id);
	await expect(link).toHaveAttribute('href', `/mycelium?person=${person.id}`);
	await expect(link).toHaveText(person.name);
	await editor.fill('Ask later.');
	expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).people, MYCELIUM_STORAGE_KEY)).toEqual([person]);
});

test('Data refreshes owner fields, retains local notes, and removes only membership', async ({ page }) => {
	await page.goto('/homesuite');
	await page.getByRole('button', { name: '＋ New', exact: true }).click();
	await page.getByRole('menuitem', { name: /Collection/ }).click();
	const dialog = page.getByRole('dialog', { name: 'New collection' });
	const connected = dialog.locator('details').filter({ has: page.getByRole('button', { name: /^Mycelium people/, includeHidden: true }) });
	if (await connected.getAttribute('open') === null) await connected.locator('summary').click();
	await dialog.getByRole('button', { name: /^Mycelium people/ }).click();
	await expect(page.locator('.surface-veil')).toHaveCount(0);
	const data = page.frameLocator('iframe.native-surface');
	await expect(data.locator('.source-value')).toHaveText(person.name);
	await expect(data.getByRole('textbox', { name: 'Email, Juniper Lane', exact: true })).toHaveValue('Work: juniper@example.com');
	await expect(data.getByRole('textbox', { name: 'Contact notes, Juniper Lane', exact: true })).toHaveAttribute('readonly');
	await data.getByRole('textbox', { name: 'My notes, Juniper Lane', exact: true }).fill('Ask about the mural.');

	// A canonical owner edit in another same-origin window reaches the open
	// Data frame through the package's storage subscription.
	await page.evaluate((key) => {
		const saved = JSON.parse(localStorage.getItem(key)!);
		saved.people[0].name = 'Juniper Rivers';
		saved.people[0].notes = 'Prefers text now.';
		saved.people[0].updatedAt = '2026-10-19T12:05:00.000Z';
		localStorage.setItem(key, JSON.stringify(saved));
	}, MYCELIUM_STORAGE_KEY);
	await expect(data.locator('.source-value')).toHaveText('Juniper Rivers');
	await expect(data.getByRole('textbox', { name: 'Contact notes, Juniper Rivers', exact: true })).toHaveValue('Prefers text now.');
	await expect(data.getByRole('textbox', { name: 'My notes, Juniper Rivers', exact: true })).toHaveValue('Ask about the mural.');
	await data.getByRole('button', { name: 'Select Juniper Rivers', exact: true }).click();
	await data.getByRole('button', { name: 'Select Juniper Rivers', exact: true }).press('Delete');
	await expect(data.locator('.source-value')).toHaveCount(0);
	await data.getByRole('button', { name: '↻ Refresh sources' }).click();
	await expect(data.locator('.source-value')).toHaveCount(0);
	expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).people[0].name, MYCELIUM_STORAGE_KEY)).toBe('Juniper Rivers');
	await page.reload();
	await expect(page.locator('.surface-veil')).toHaveCount(0);
	await expect(data.locator('.source-value')).toHaveCount(0);
});

test('Data keeps a deleted person unresolved after reopening its retained row', async ({ page }) => {
	await page.goto('/homesuite');
	await page.getByRole('button', { name: '＋ New', exact: true }).click();
	await page.getByRole('menuitem', { name: /Collection/ }).click();
	const dialog = page.getByRole('dialog', { name: 'New collection' });
	const connected = dialog.locator('details').filter({ has: page.getByRole('button', { name: /^Mycelium people/, includeHidden: true }) });
	if (await connected.getAttribute('open') === null) await connected.locator('summary').click();
	await dialog.getByRole('button', { name: /^Mycelium people/ }).click();
	await expect(page.locator('.surface-veil')).toHaveCount(0);
	const data = page.frameLocator('iframe.native-surface');
	await expect(data.locator('.source-value')).toHaveText(person.name);
	await data.getByRole('textbox', { name: 'My notes, Juniper Lane', exact: true }).fill('Keep this even if the contact is deleted.');
	await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ format: 'woodles-mycelium', version: 1, people: [] })), MYCELIUM_STORAGE_KEY);
	await expect(data.locator('.source-value .cold')).toHaveText('cold');
	await page.reload();
	await expect(page.locator('.surface-veil')).toHaveCount(0);
	await expect(data.locator('.source-status')).toContainText('No source records');
	await expect(data.locator('.source-value .cold')).toHaveText('cold');
	await expect(data.getByRole('textbox', { name: 'My notes, Unavailable source', exact: true })).toHaveValue('Keep this even if the contact is deleted.');
	await data.getByRole('button', { name: '↗ Add existing' }).click();
	const picker = data.getByRole('dialog', { name: 'Choose a Woodles reference' });
	await picker.getByRole('textbox', { name: 'Find a thing' }).fill('Juniper');
	await expect(picker.getByRole('button', { name: /Juniper/ })).toHaveCount(0);
});
