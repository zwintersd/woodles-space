import { expect, test } from '@playwright/test';

test.describe('Hygge motion workshop', () => {
	test('loads the Manim catalog and lets a study be inspected', async ({ page }) => {
		await page.goto('/hygge/motion');

		await expect(page.getByRole('heading', { name: 'motion, held up to the light.' })).toBeVisible();
		await expect(page.locator('.study-button')).toHaveCount(5);

		const video = page.locator('#preview-video');
		const poster = page.getByRole('img', { name: 'ink bloom representative still' });
		await expect(video).toHaveAttribute('src', '/animations/exports/arcade/ink-bloom.webm');
		await expect(poster).toHaveAttribute('src', '/animations/exports/arcade/ink-bloom.png');
		await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(320);

		await page.getByRole('button', { name: 'Preview orbiting motes' }).click();
		await expect(page.getByRole('heading', { name: 'orbiting motes' })).toBeVisible();
		await expect(video).toHaveAttribute('src', '/animations/exports/arcade/orbiting-motes.webm');
		await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(0);
		expect(await video.evaluate((element: HTMLVideoElement) => element.loop)).toBe(true);

		await page.getByRole('button', { name: 'Preview triple corn svg lab' }).click();
		await expect(page.getByRole('heading', { name: 'triple corn svg lab' })).toBeVisible();
		await expect(video).toHaveAttribute(
			'src',
			'/animations/exports/arcade/triple-corn-svg.webm'
		);
		await expect(page.getByRole('img', { name: 'triple corn svg lab representative still' })).toHaveAttribute(
			'src',
			'/animations/exports/arcade/triple-corn-svg.png'
		);
		await expect(page.getByRole('link', { name: 'triple-corn.svg' })).toHaveAttribute(
			'href',
			'/animations/assets/triple-corn.svg'
		);
		await expect(page.getByRole('link', { name: 'open in SVG bench' })).toHaveAttribute(
			'href',
			'/hygge/motion/svg?recipe=%2Fanimations%2Fsvg-recipes%2Ftriple-corn.json'
		);
		expect(await video.evaluate((element: HTMLVideoElement) => element.loop)).toBe(false);

		await page.getByRole('button', { name: 'Preview diamonds svg study' }).click();
		await expect(page.getByRole('heading', { name: 'diamonds svg study' })).toBeVisible();
		await expect(video).toHaveAttribute('src', '/animations/exports/arcade/diamonds-svg.webm');
		await expect(page.getByRole('link', { name: 'diamonds.svg' })).toHaveAttribute(
			'href',
			'/animations/assets/diamonds.svg'
		);

		await page.getByRole('button', { name: 'ink', exact: true }).click();
		await page.getByRole('button', { name: '160px', exact: true }).click();
		await page.getByRole('button', { name: '1.25×', exact: true }).click();
		await expect(page.locator('#preview-stage')).toHaveAttribute('data-background', 'ink');
		expect(
			await page.evaluate(() => ({
				size: getComputedStyle(document.documentElement).getPropertyValue('--preview-size').trim(),
				speed: (document.querySelector('#preview-video') as HTMLVideoElement).playbackRate
			}))
		).toEqual({ size: '160px', speed: 1.25 });
	});

	test('uses the checked-in keyframe when reduced motion is preferred', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/hygge/motion');

		const poster = page.getByRole('img', { name: 'ink bloom representative still' });
		await expect(poster).toBeVisible();
		await expect(page.locator('#preview-video')).toBeHidden();
		await expect(page.locator('#playback-state')).toContainText('reduced motion');
	});
});
