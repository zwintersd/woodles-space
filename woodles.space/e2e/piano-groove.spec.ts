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

	test('your notes sit clearly above the full backing loop', async ({ page }) => {
		await page.goto('/piano/groove');
		await page.keyboard.press('q');
		await page.evaluate(() => {
			const Tone = (window as any).Tone;
			const meter = new Tone.Meter({ smoothing: 0 });
			Tone.getDestination().connect(meter);
			(window as any).peakOver = (ms: number) =>
				new Promise<number>((resolve) => {
					let peak = -Infinity;
					const iv = setInterval(() => { peak = Math.max(peak, meter.getValue()); }, 5);
					setTimeout(() => { clearInterval(iv); resolve(peak); }, ms);
				});
		});

		// play enough to bring every backing layer in, then listen to it alone
		for (let i = 0; i < 20; i++) {
			await page.keyboard.press('qwertasdfg'[i % 10]);
			await page.waitForTimeout(140);
		}
		await page.waitForTimeout(500);
		expect(await page.evaluate(() => (window as any).__groove.layer)).toBeGreaterThanOrEqual(3);
		const backing = await page.evaluate(() => (window as any).peakOver(1200));

		const solo = async (letter: string) => {
			await page.evaluate(() => { (window as any).__groove.voices.fade.gain.value = 0; });
			await page.waitForTimeout(400);
			const peak = page.evaluate(() => (window as any).peakOver(500));
			await page.keyboard.press(letter);
			return peak;
		};
		for (const letter of ['q', 'a', 'z']) {
			expect(await solo(letter), `${letter} vs backing ${backing}`).toBeGreaterThan(backing + 3);
		}
	});

	test('the loop builds with your playing and stops when you go quiet', async ({ page }) => {
		test.setTimeout(30_000);
		await page.goto('/piano/groove');
		await page.keyboard.press('q');
		const groove = () => page.evaluate(() => {
			const g = (window as any).__groove;
			return { layer: g.layer as number, running: g.running as boolean };
		});
		await expect.poll(groove).toEqual({ layer: 1, running: true });

		for (let i = 0; i < 16; i++) {
			await page.keyboard.press('asdfg'[i % 5]);
			await page.waitForTimeout(120);
		}
		await expect.poll(async () => (await groove()).layer).toBeGreaterThanOrEqual(3);

		await expect.poll(async () => (await groove()).running, { timeout: 12_000 }).toBe(false);
		await page.keyboard.press('k');
		await expect.poll(groove).toEqual({ layer: 1, running: true });
	});

	test('cat mode meows over the backing and plays every letter without errors', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await page.goto('/piano/groove');
			const cat = page.locator('#cat-btn');
			await expect(cat).toHaveAttribute('aria-pressed', 'false');
			await cat.click();
			await expect(cat).toHaveAttribute('aria-pressed', 'true');

			await page.keyboard.press('q');
			await page.evaluate(() => {
				const Tone = (window as any).Tone;
				const meter = new Tone.Meter({ smoothing: 0 });
				Tone.getDestination().connect(meter);
				(window as any).peakOver = (ms: number) =>
					new Promise<number>((resolve) => {
						let peak = -Infinity;
						const iv = setInterval(() => { peak = Math.max(peak, meter.getValue()); }, 5);
						setTimeout(() => { clearInterval(iv); resolve(peak); }, ms);
					});
			});
			for (let i = 0; i < 20; i++) {
				await page.keyboard.press('qwertasdfg'[i % 10]);
				await page.waitForTimeout(140);
			}
			await page.waitForTimeout(500);
			const backing = await page.evaluate(() => (window as any).peakOver(1200));
			await page.evaluate(() => { (window as any).__groove.voices.fade.gain.value = 0; });
			await page.waitForTimeout(400);
			const meow = page.evaluate(() => (window as any).peakOver(600));
			await page.keyboard.press('q');
			expect(await meow, `meow vs backing ${backing}`).toBeGreaterThan(backing + 3);

			for (const letter of 'abcdefghijklmnopqrstuvwxyz') await page.keyboard.press(letter);
			for (let i = 0; i < 5; i++) await page.keyboard.press('Space');
			await cat.click();
			await expect(cat).toHaveAttribute('aria-pressed', 'false');
		});
	});

	test('?cat opens straight into cat mode', async ({ page }) => {
		await page.goto('/piano/groove?cat');
		await expect(page.locator('#cat-btn')).toHaveAttribute('aria-pressed', 'true');
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
