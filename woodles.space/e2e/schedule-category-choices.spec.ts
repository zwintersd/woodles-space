import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { addScheduleItem } from './support/schedule-planner';

test('suggestion categories become independent choice options with persistent learner draws', async ({ page }) => {
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const studio = (window as any).ScheduleStudio;
    localStorage.setItem(studio.STORAGE_KEY, JSON.stringify({
      plans: [studio.sanitizePlan({ id: 'category-plan', learner: 'Sam', days: [] })],
      suggestionPools: [studio.sanitizeSuggestionPool({ id: 'breaks', title: 'Break ideas', animation: 'instant', rerollMode: 'limited', maxRerolls: 1,
        candidates: [{ id: 'stretch', title: 'Stretch', category: 'Movement', duration: 5 }, { id: 'read', title: 'Read', category: 'Quiet', duration: 5 }, { id: 'long', title: 'Long walk', category: 'Long', duration: 30 }] })]
    }));
  });
  await page.goto('/schedules/generator?plan=category-plan&day=monday');
  await addScheduleItem(page, 'choice');
  await page.locator('[data-action="add-category-option"][data-category="Long"]').click();
  await expect(page.locator('#choiceError')).toContainText('No suggestions');
  await page.locator('[data-action="add-category-option"][data-category="Movement"]').click();
  await page.locator('[data-action="add-category-option"][data-category="Quiet"]').click();
  await page.locator('#choiceForm button[type="submit"]').click();
  await page.reload();
  const choice = await page.evaluate(() => JSON.parse(localStorage.getItem('woodles.schedule-planner.v1')!).plans[0].days[0].activities[0]);
  expect(choice.options.map((option: any) => option.kind)).toEqual(['suggestion', 'suggestion']);
  expect(choice.options[0].candidates.map((candidate: any) => candidate.title)).toEqual(['Stretch']);
  await page.evaluate(() => {
    const key = 'woodles.schedule-planner.v1'; const workspace = JSON.parse(localStorage.getItem(key)!);
    workspace.suggestionPools = []; localStorage.setItem(key, JSON.stringify(workspace));
    const imported = (window as any).ScheduleStudio.sanitizePlan(workspace.plans[0]);
    if (imported.days[0].activities[0].options[0].candidates[0].title !== 'Stretch') throw new Error('Transfer lost category');
  });
  await page.goto('/schedules/view?plan=category-plan&day=monday');
  await page.getByRole('button', { name: 'Movement', exact: true }).click();
  await page.locator('[data-suggestion-draw]').click();
  await expect(page.locator('.suggestion-result h3')).toHaveText('Stretch');
  await page.getByRole('button', { name: 'Quiet', exact: true }).click();
  await page.locator('[data-suggestion-draw]').click();
  await expect(page.locator('.suggestion-result h3')).toHaveText('Read');
  await page.getByRole('button', { name: 'Movement', exact: true }).click();
  await expect(page.locator('.suggestion-result h3')).toHaveText('Stretch');
  await page.locator('[data-suggestion-accept]').click();
  await page.reload();
  await expect(page.locator('.suggestion-result h3')).toHaveText('Stretch');
  const axe = await new AxeBuilder({ page }).include('#timeline').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations).toEqual([]);
});
