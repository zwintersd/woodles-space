import { expect, test } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';

test.describe('piano groove mode', () => {
	test('wakes on a key, plays every letter, and cycles palettes without errors', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await page.goto('/piano/groove');
			await expect(page.locator('#wake')).not.toHaveClass(/gone/);

			await page.keyboard.press('q');
			await expect(page.locator('#wake')).toHaveClass(/gone/);
			expect(await page.evaluate(() => (window as any).Tone.getTransport().state)).toBe('started');

			for (const letter of 'abcdefghijklmnopqrstuvwxyz') await page.keyboard.press(letter);
			for (let i = 0; i < 6; i++) await page.keyboard.press('Space');
		});
	});

	test('space swaps the backing groove on the next bar line', async ({ page }) => {
		await page.goto('/piano/groove');
		await page.keyboard.press('q');
		const bpm = () => page.evaluate(() => (window as any).Tone.getTransport().bpm.value);
		expect(await bpm()).toBe(115);

		await page.keyboard.press('Space');
		await expect(page.locator('#live')).toHaveText(/kawaii future bass, 128 bpm/);
		// drums mute now; the tempo only changes once the bar rolls over (<= ~2.1s)
		await expect.poll(bpm, { timeout: 5000 }).toBe(128);
	});

	test('quantize keeps hits on the 16th grid', async ({ page }) => {
		await page.goto('/piano/groove');
		await page.keyboard.press('q');
		await page.locator('#mode-quantize').click();
		await page.evaluate(() => {
			const w = window as any;
			w.__scheduled = [] as number[];
			const draw = w.Tone.Draw;
			const orig = draw.schedule.bind(draw);
			draw.schedule = (cb: () => void, time: number) => { w.__scheduled.push(time); return orig(cb, time); };
		});
		for (const letter of 'asdfghj') {
			await page.keyboard.press(letter);
			await page.waitForTimeout(37);
		}
		await page.waitForTimeout(300);
		const offsets = await page.evaluate(() => {
			const w = window as any;
			const t = w.Tone.getTransport();
			return (w.__scheduled as number[]).map((time) => {
				const x = t.getTicksAtTime(time) / (t.PPQ / 4);
				return Math.abs(x - Math.round(x));
			});
		});
		expect(offsets.length).toBeGreaterThanOrEqual(7);
		for (const off of offsets) expect(off).toBeLessThan(0.01);
	});

	test('toggles between instant and 16th-note quantize', async ({ page }) => {
		await page.goto('/piano/groove');
		const instant = page.locator('#mode-instant');
		const quantize = page.locator('#mode-quantize');
		await expect(instant).toHaveAttribute('aria-pressed', 'true');
		await quantize.click();
		await expect(quantize).toHaveAttribute('aria-pressed', 'true');
		await expect(instant).toHaveAttribute('aria-pressed', 'false');
	});

	test('piano links to groove mode and back', async ({ page }) => {
		await page.goto('/piano');
		await page.getByRole('link', { name: /groove mode/ }).click();
		await expect(page).toHaveURL(/\/piano\/groove$/);
		await page.getByRole('link', { name: /piano/ }).click();
		await expect(page).toHaveURL(/\/piano$/);
	});
});
