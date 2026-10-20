import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const base = `http://127.0.0.1:${process.env.E2E_PORT || 4173}`;
const key = 'woodles.mycelium.people.v1';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, body: '' }));
});

async function create(page: Page, name = 'Juniper Moss') {
  await page.goto(`${base}/mycelium`);
  await page.getByRole('button', { name: '＋ make the first card' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Pronouns', { exact: true }).fill('they / them');
  await page.getByLabel('Role', { exact: true }).fill('Illustrator');
  await page.getByLabel('Organization', { exact: true }).fill('The garden studio');
  await page.getByLabel('Location', { exact: true }).fill('Brooklyn');
  await page.getByRole('button', { name: '＋ add email' }).click();
  await page.getByLabel('Email 1', { exact: true }).fill('juniper@example.com');
  await page.getByLabel('Circles', { exact: false }).fill('friends, garden club');
  await page.getByLabel('Notes', { exact: false }).fill('Remember the little blue notebook.');
  await page.getByRole('button', { name: 'save contact', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
  return new URL(page.url()).searchParams.get('person')!;
}

test('creates, styles, reloads, and deletes one stable person without cloning identity', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const id = await create(page);
  await page.getByRole('button', { name: 'edit contact', exact: true }).click();
  await page.getByRole('tab', { name: 'the card', exact: true }).click();
  await page.getByRole('button', { name: 'midnight foil', exact: true }).click();
  await page.getByRole('button', { name: 'save contact', exact: true }).click();
  await expect(page.locator('.person-card')).toHaveClass(/finish-rainbow/);
  await page.reload();
  await expect(page.locator('.person-card')).toHaveClass(/finish-rainbow/);
  await expect(page.getByText('Remember the little blue notebook.', { exact: true })).toBeVisible();
  const data = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
  expect(data.people).toHaveLength(1);
  expect(data.people[0].id).toBe(id);
  await page.getByRole('button', { name: '⎘ copy Woodles reference', exact: true }).click();
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toEqual({ app: 'mycelium', kind: 'person', id });
  await page.getByRole('button', { name: 'delete contact…', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'delete contact', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Every little world starts with someone.' })).toBeVisible();
  await page.goto(`${base}/mycelium?person=${id}`);
  await expect(page.getByRole('heading', { name: 'This card isn’t on this shelf.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('portrait, 3:4 frames, filtering, phone layout and printed cards', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: 'edit contact', exact: true }).click();
  const portrait = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 100;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#abd1bb'; ctx.fillRect(0, 0, 80, 100);
    ctx.fillStyle = '#72475f'; ctx.beginPath(); ctx.arc(40, 35, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(20, 60, 40, 40); return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file][accept^="image/"]').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(portrait, 'base64') });
  await expect(page.getByAltText('Portrait of Juniper Moss')).toBeVisible();
  await page.getByRole('tab', { name: 'the card', exact: true }).click();
  for (const frame of ['classic', 'full art', 'borderless', 'minimal', 'cinema']) {
    await page.getByRole('button', { name: frame, exact: true }).last().click();
    const ratio = await page.locator('.person-card').evaluate((el) => el.clientWidth / el.clientHeight);
    expect(ratio).toBeCloseTo(0.75, 2);
  }
  await page.getByRole('button', { name: 'vellum', exact: true }).click();
  await page.getByRole('button', { name: 'save contact', exact: true }).click();
  await page.getByRole('button', { name: '← the people shelf' }).click();
  await page.getByLabel('Search people').fill('juniper@example.com');
  await expect(page.getByRole('button', { name: 'Open Juniper Moss', exact: true })).toBeVisible();
  await expect(page.locator('.person-card')).not.toContainText('little blue notebook');
  await page.screenshot({ path: 'artifacts/mycelium/shelf-wide.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/mycelium/shelf-phone.png', fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-header')).toBeHidden();
  await expect(page.locator('.ribbon')).toBeHidden();
  await expect(page.locator('.person-card')).toBeVisible();
});

test('storage failures preserve data and an unsaved draft', async ({ page }) => {
  await create(page);
  const original = await page.evaluate((key) => localStorage.getItem(key), key);
  await page.getByRole('button', { name: 'edit contact', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('A new name');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'save contact', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('storage is full');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('A new name');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(original);
});

test('backup import preserves identity and malformed storage is never replaced', async ({ page }) => {
  const id = await create(page);
  const exported = await page.evaluate((key) => localStorage.getItem(key)!, key);
  await page.getByRole('button', { name: '← the people shelf' }).click();
  await page.getByLabel('Import Mycelium backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).people.map((p: {id: string}) => p.id), key)).toEqual([id]);
  await page.evaluate((key) => localStorage.setItem(key, '{broken save'), key);
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The shelf couldn’t be opened.' })).toBeVisible();
  await expect(page.getByRole('button', { name: '＋ make the first card' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '＋ new person', exact: true }).first()).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('{broken save');
});

test('an open editor preserves unrelated changes saved in another tab', async ({ page, context }) => {
  const id = await create(page);
  const other = await context.newPage();
  await other.goto(`${base}/mycelium?person=${id}`);
  await other.getByRole('button', { name: 'edit contact', exact: true }).click();
  await other.getByLabel('Role', { exact: true }).fill('Botanical illustrator');
  await page.getByRole('button', { name: 'edit contact', exact: true }).click();
  await page.getByLabel('Notes', { exact: false }).fill('A note saved from the other window.');
  await page.getByRole('button', { name: 'save contact', exact: true }).click();
  await other.getByRole('button', { name: 'save contact', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Contact details' }).getByText('Botanical illustrator · The garden studio', { exact: true })).toBeVisible();
  await expect(page.getByText('A note saved from the other window.', { exact: true })).toBeVisible();
  await other.close();
});

test('shelf and editor remain accessible at desktop and phone widths', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: '← the people shelf' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Open Juniper Moss', exact: true }).click();
  await page.getByRole('button', { name: 'edit contact', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('tab', { name: 'the card', exact: true }).click();
  await page.getByRole('button', { name: 'moon garden', exact: true }).click();
  await expect(page.locator('.person-card')).toHaveClass(/dark-plate/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/mycelium/workshop-wide.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/mycelium/workshop-phone.png', fullPage: true });
});
