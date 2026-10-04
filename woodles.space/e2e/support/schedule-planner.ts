import type { Page } from '@playwright/test';

export async function addScheduleItem(page: Page, kind: 'activity' | 'choice' | 'video' | 'suggestion' | 'open-slot' | 'library') {
  await page.locator('[data-action="add-item"]').click();
  await page.locator(`#addItemDialog [data-action="add-${kind}"]`).click();
}

export async function openScheduleTools(page: Page, scope: 'plan' | 'day') {
  const tools = page.locator(`.${scope}-tools`);
  if (await tools.getAttribute('open') === null) await tools.locator('summary').click();
}

export async function openActivitySection(page: Page, section: 'details' | 'steps') {
  const disclosure = page.locator(section === 'details' ? '.activity-details' : '.activity-steps-disclosure');
  if (await disclosure.getAttribute('open') === null) await disclosure.locator(':scope > summary').click();
}

export async function openVisualPicker(page: Page, form = '#activityForm') {
  const toggle = page.locator(`${form} [data-action="toggle-visual-picker"]`);
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}
