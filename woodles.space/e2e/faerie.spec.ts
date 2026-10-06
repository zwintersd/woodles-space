import { expect, test, type Page } from '@playwright/test';

async function mountFaerie(page: Page) {
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto('/packages/faerie/playground/');
  await page.evaluate(async () => {
    const moduleUrl = '/packages/faerie/src/index.js';
    const { createFaerie } = await import(moduleUrl);
    (window as any).faerie?.destroy();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;min-height:1900px;background:#edf0f4;color:#17212a';
    document.body.innerHTML = `
      <input id="editor" aria-label="Your notes" style="position:absolute;left:100px;top:24px;width:240px;height:32px">
      <button id="target" style="position:absolute;left:100px;top:110px;width:140px;height:50px">Important thing</button>
      <div id="scroller" style="position:absolute;left:100px;top:260px;width:340px;height:220px;overflow:auto">
        <div style="height:800px;position:relative">
          <button id="nested-target" style="position:absolute;left:45px;top:100px;width:130px;height:45px">Inside a panel</button>
        </div>
      </div>
      <button id="far-target" style="position:absolute;left:100px;top:1500px;width:140px;height:50px">Further down</button>`;
    const faerie = createFaerie({ motion: 'reduced' });
    faerie.element.setAttribute('data-testid', 'faerie');
    (window as any).testFaerie = faerie;
    (window as any).faerieEvents = [];
    for (const name of ['faerie-statechange', 'faerie-dismiss', 'faerie-action']) {
      faerie.element.addEventListener(name, (event: CustomEvent) => {
        (window as any).faerieEvents.push({ name, detail: event.detail });
      });
    }
  });
}

async function ringFollows(page: Page, target: string) {
  await expect.poll(async () => page.evaluate((selector) => {
    const target = document.querySelector(selector)!.getBoundingClientRect();
    const faerie = (window as any).testFaerie ?? (window as any).faerie;
    const ring = faerie.element.shadowRoot.querySelector('.ring').getBoundingClientRect();
    return Math.max(
      Math.abs((ring.left + ring.right) / 2 - (target.left + target.right) / 2),
      Math.abs((ring.top + ring.bottom) / 2 - (target.top + target.bottom) / 2)
    );
  }, target)).toBeLessThan(2);
}

test.beforeEach(async ({ page }) => {
  await mountFaerie(page);
});

test('attention cues follow element movement, resizing, and nested scrolling', async ({ page }) => {
  expect(await page.evaluate(() => (window as any).testFaerie.attend('#target', { message: 'Look here.' }))).toBe(true);
  await expect(page.getByTestId('faerie')).toHaveAttribute('data-state', 'attending');
  await expect(page.getByTestId('faerie').locator('.message')).toHaveText('Look here.');
  await ringFollows(page, '#target');

  await page.locator('#target').evaluate((target) => {
    target.style.left = '460px';
    target.style.width = '230px';
  });
  await ringFollows(page, '#target');
  await expect.poll(async () => page.getByTestId('faerie').locator('.ring').evaluate((ring) => ring.getBoundingClientRect().width)).toBeGreaterThan(230);

  expect(await page.evaluate(() => (window as any).testFaerie.attend('#nested-target'))).toBe(true);
  await ringFollows(page, '#nested-target');
  await page.locator('#scroller').evaluate((scroller) => { scroller.scrollTop = 65; });
  await ringFollows(page, '#nested-target');

  // This rectangle remains in the page viewport, but the panel clips it away.
  await page.locator('#scroller').evaluate((scroller) => { scroller.scrollTop = 180; });
  await expect(page.getByTestId('faerie')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('faerie').locator('.ring')).toBeHidden();
  expect(await page.evaluate(() => (window as any).testFaerie.attend('#nested-target'))).toBe(false);
  expect(await page.evaluate(() => (window as any).testFaerie.attend('#nested-target', { scroll: true }))).toBe(true);
  await ringFollows(page, '#nested-target');
});

test('missing and removed targets release their cue safely', async ({ page }) => {
  expect(await page.evaluate(() => (window as any).testFaerie.attend('#absent'))).toBe(false);
  await expect(page.getByTestId('faerie')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('faerie').locator('.ring')).toBeHidden();

  await page.evaluate(() => (window as any).testFaerie.attend(() => document.querySelector('#target'), { message: 'A temporary target.' }));
  await expect(page.getByTestId('faerie').locator('.ring')).toBeVisible();
  await page.locator('#target').evaluate((target) => target.remove());
  await expect(page.getByTestId('faerie')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('faerie').locator('.ring')).toBeHidden();
  await expect(page.getByTestId('faerie').locator('.hint')).toBeHidden();
});

test('scrolling to an offscreen target requires an explicit request', async ({ page }) => {
  await page.locator('#editor').focus();
  expect(await page.evaluate(() => (window as any).testFaerie.attend('#far-target', { message: 'Further down.' }))).toBe(false);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('#editor')).toBeFocused();

  expect(await page.evaluate(() => (window as any).testFaerie.attend('#far-target', { scroll: true, message: 'Here it is.' }))).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await ringFollows(page, '#far-target');
  await expect(page.getByTestId('faerie').locator('.message')).toHaveText('Here it is.');
  await expect(page.locator('#editor')).toBeFocused();
});

test('hints preserve focus, announce their text, run actions, and dismiss by Escape', async ({ page }) => {
  await page.locator('#editor').focus();
  await page.evaluate(() => {
    (window as any).actionCount = 0;
    (window as any).testFaerie.attend('#target', {
      message: 'You can open this when you are ready.',
      action: { label: 'Open the thing', onSelect: () => { (window as any).actionCount += 1; } }
    });
  });
  await expect(page.locator('#editor')).toBeFocused();
  await expect(page.getByTestId('faerie').locator('[aria-live]')).toContainText('You can open this when you are ready.');
  await page.getByTestId('faerie').getByRole('button', { name: 'Focus target', exact: true }).click();
  await expect(page.locator('#target')).toBeFocused();
  await page.getByTestId('faerie').getByRole('button', { name: 'Open the thing' }).click();
  expect(await page.evaluate(() => (window as any).actionCount)).toBe(1);
  expect(await page.evaluate(() => (window as any).faerieEvents.some((event: any) => event.name === 'faerie-action'))).toBe(true);

  await page.locator('#editor').focus();
  await page.evaluate(() => (window as any).testFaerie.say('A small reminder.'));
  await expect(page.locator('#editor')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('faerie')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('faerie').locator('.hint')).toBeHidden();
  await expect(page.locator('#editor')).toBeFocused();
  expect(await page.evaluate(() => (window as any).faerieEvents.some((event: any) => event.name === 'faerie-dismiss'))).toBe(true);
});

test('reduced motion removes animation and mobile cues stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#target').evaluate((target) => {
    target.style.left = '330px';
    target.style.top = '760px';
    target.style.width = '50px';
  });
  await page.evaluate(() => (window as any).testFaerie.attend('#target', {
    placement: 'right',
    message: 'A long helpful explanation that should still fit beside this little glowing guide on a narrow screen.',
    action: { label: 'Continue', onSelect: () => {} }
  }));

  for (const selector of ['.flight', '.hint']) {
    const bounds = await page.getByTestId('faerie').locator(selector).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  }
  const motion = await page.getByTestId('faerie').locator('.body').evaluate((body) => ({
    animation: getComputedStyle(body).animationName,
    transition: getComputedStyle(body.parentElement!).transitionDuration
  }));
  expect(motion).toEqual({ animation: 'none', transition: '0s' });
  await expect(page.getByTestId('faerie').getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.getByTestId('faerie').locator('.close').click();
  await expect(page.getByTestId('faerie').locator('.hint')).toBeHidden();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => (window as any).testFaerie.configure({ motion: 'auto' }));
  expect(await page.getByTestId('faerie').locator('.body').evaluate((body) => getComputedStyle(body).animationName)).toBe('none');
});

test('new commands cancel old timers, and following can be stopped and destroyed', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => {
    (window as any).testFaerie.say('A fleeting hint.', { duration: 100 });
    (window as any).testFaerie.attend({ x: 480, y: 300 }, { message: 'This cue should remain.' });
  });
  await page.clock.fastForward(300);
  await expect(page.getByTestId('faerie')).toHaveAttribute('data-state', 'attending');
  await expect(page.getByTestId('faerie').locator('.message')).toHaveText('This cue should remain.');

  await page.evaluate(() => (window as any).testFaerie.follow());
  await expect(page.getByTestId('faerie')).toHaveAttribute('data-state', 'following');
  await page.mouse.move(600, 300);
  await page.clock.fastForward(100);
  const flight = await page.getByTestId('faerie').locator('.flight').boundingBox();
  expect(flight).not.toBeNull();
  expect(Math.hypot(flight!.x + flight!.width / 2 - 600, flight!.y + flight!.height / 2 - 300)).toBeLessThan(160);
  await page.evaluate(() => (window as any).testFaerie.follow(false));
  await expect(page.getByTestId('faerie')).toHaveAttribute('data-state', 'idle');

  await page.evaluate(() => (window as any).testFaerie.hide());
  await expect(page.getByTestId('faerie')).toBeHidden();
  await page.evaluate(() => (window as any).testFaerie.show());
  await expect(page.getByTestId('faerie')).toBeVisible();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    (window as any).testFaerie.say('A pending reminder.', { duration: 100 });
    (window as any).testFaerie.destroy();
    (window as any).testFaerie.destroy();
  });
  await page.mouse.move(200, 200);
  await page.keyboard.press('Escape');
  await page.clock.fastForward(500);
  await expect(page.getByTestId('faerie')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the playground tour visits three real targets and finishes cleanly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/packages/faerie/playground/');
  const faerie = page.locator('[data-faerie]');
  await page.getByRole('button', { name: 'Take a little tour' }).click();

  for (const [index, target] of ['#next-step', '#save-draft', '#collection-target'].entries()) {
    await expect(page.locator('#tour-progress')).toHaveText(`${index + 1} of 3`);
    await expect(faerie).toHaveAttribute('data-state', 'attending');
    await ringFollows(page, target);
    const action = faerie.getByRole('button', {
      name: index === 2 ? 'Lovely, thank you' : 'Next little stop', exact: true
    });
    await action.focus();
    await page.keyboard.press('Enter');
    if (index < 2) {
      await expect(faerie.getByRole('button', {
        name: index === 1 ? 'Lovely, thank you' : 'Next little stop', exact: true
      })).toBeFocused();
    }
  }

  await expect(page.locator('#tour-progress')).toBeHidden();
  await expect(page.locator('#stop-tour')).toBeHidden();
  await expect(faerie).toHaveAttribute('data-state', 'celebrating');
  await expect(page.locator('#playground-status')).toContainText('Tour complete');
  await expect(page.getByRole('button', { name: 'Take a little tour' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the playground controls change the companion and can guide to an offscreen discovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/packages/faerie/playground/');
  const faerie = page.locator('[data-faerie]');
  await page.getByRole('button', { name: 'Leaf glow', exact: true }).click();
  await expect(faerie).toHaveAttribute('data-tone', 'leaf');
  await expect(page.getByRole('button', { name: 'Leaf glow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Moonlight glow', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Keep movement gentle').check();
  await expect(faerie).toHaveAttribute('data-motion', 'reduced');
  expect(await faerie.locator('.body').evaluate((body) => getComputedStyle(body).animationName)).toBe('none');

  await page.getByRole('button', { name: 'Follow my pointer' }).click();
  await expect(faerie).toHaveAttribute('data-state', 'following');
  await expect(page.locator('#follow-pointer')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Let her rest', exact: true }).click();
  await expect(faerie).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#follow-pointer')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Hide Faerie', exact: true }).click();
  await expect(faerie).toBeHidden();
  await page.getByRole('button', { name: 'Show Faerie', exact: true }).click();
  await expect(faerie).toBeVisible();

  await page.getByLabel('What should she say?').fill('Your next step is down here.');
  await page.getByLabel('Where should she go?').selectOption('lower-target');
  await page.getByRole('button', { name: 'Guide my attention' }).click();
  await expect(faerie).toHaveAttribute('data-state', 'attending');
  await ringFollows(page, '#lower-target');
  await expect(faerie.locator('.message')).toHaveText('Your next step is down here.');
  await faerie.getByRole('button', { name: 'Got it, thank you', exact: true }).click();
  await expect(faerie).toHaveAttribute('data-state', 'idle');
  expect(errors).toEqual([]);
});
