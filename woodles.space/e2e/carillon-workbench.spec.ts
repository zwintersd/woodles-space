import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route=>route.fulfill({status:200,body:''}));
	await page.addInitScript(()=>{
		if (!localStorage.getItem('planner.settings.v1')) localStorage.setItem('planner.settings.v1',JSON.stringify({onboardingComplete:true,bellsEnabled:false,fixedPaletteMode:'late-afternoon'}));
	});
	await page.goto('/planner');
}
async function section(page:Page,name:string) {
	await page.getByRole('navigation',{name:'Carillon sections'}).getByRole('button',{name:new RegExp(name)}).click();
}

test('edits a pile, isolates today, and reloads the saved day',async({page})=>{
	const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
	await open(page);await section(page,'Day piles');
	await page.getByRole('button',{name:'+ New day pile',exact:true}).click();
	await page.getByLabel('Pile name').fill('Home test day');
	await page.getByRole('button',{name:'+ Add activity',exact:true}).click();
	await page.getByLabel('Activity 1',{exact:true}).fill('Read at home');
	await page.getByRole('button',{name:'Save pile',exact:true}).click();
	await page.getByRole('button',{name:'Use saved pile today',exact:true}).click();
	await section(page,'Today');
	await expect(page.getByText('Read at home',{exact:true})).toBeVisible();
	await page.getByRole('button',{name:'Change today',exact:true}).click();
	await page.getByLabel('Activity 1',{exact:true}).fill('Read outside today');
	await page.getByRole('button',{name:'Save today only',exact:true}).click();
	await page.reload();
	await expect(page.getByText('Read outside today',{exact:true})).toBeVisible();
	await section(page,'Day piles');
	await page.getByRole('button',{name:/Home test day.*1 activities/}).click();
	await expect(page.getByLabel('Activity 1',{exact:true})).toHaveValue('Read at home');
	expect(errors).toEqual([]);
});

test('edits, reorders, archives, restores, and deletes a routine',async({page})=>{
	await open(page);await section(page,'Routines');
	await page.getByRole('button',{name:'+ New routine',exact:true}).click();
	await page.getByLabel('Routine name',{exact:true}).fill('Test arrival');
	await page.getByLabel('Step 1',{exact:true}).fill('Put down bag');
	await page.getByRole('button',{name:'+ Add step',exact:true}).click();
	await page.getByLabel('Step 2',{exact:true}).fill('Open notes');
	await page.getByRole('button',{name:'Move step 2 up',exact:true}).click();
	await page.getByRole('button',{name:'Save routine',exact:true}).click();
	await expect(page.getByRole('checkbox',{name:'Open notes'})).toBeVisible();
	await page.getByRole('checkbox',{name:'Open notes'}).check();
	await page.getByRole('button',{name:'Edit routine',exact:true}).click();
	await expect(page.getByLabel('Step 1',{exact:true})).toHaveValue('Open notes');
	await page.getByLabel('Routine name',{exact:true}).fill('Revised arrival');
	await page.getByRole('button',{name:'Save routine',exact:true}).click();
	await page.getByRole('button',{name:'Archive',exact:true}).click();
	await page.getByRole('button',{name:'Archived',exact:true}).click();
	await expect(page.getByRole('heading',{name:'Revised arrival'})).toBeVisible();
	await page.getByRole('button',{name:'Restore',exact:true}).click();
	await page.getByRole('button',{name:'Active',exact:true}).click();
	await page.getByRole('button',{name:/Revised arrival.*2 steps/}).click();
	await page.getByRole('button',{name:'Delete…',exact:true}).click();
	await page.getByRole('button',{name:'Delete routine',exact:true}).click();
	await page.reload();await section(page,'Routines');
	await expect(page.getByRole('button',{name:/Revised arrival.*2 steps/})).toHaveCount(0);
});

test('opens an activity directly and cancels without changing the plan', async ({ page }) => {
	await page.clock.setFixedTime(new Date('2026-09-19T12:00:00'));
	await open(page);
	const plan = page.getByRole('region', { name: "Today's plan" });
	await expect(plan.locator('.plan-row.now')).toHaveCount(1);
	const allCount = await plan.locator('.plan-row').count();
	await plan.getByRole('button', { name: 'From now', exact: true }).click();
	expect(await plan.locator('.plan-row').count()).toBeLessThan(allCount);
	await plan.getByRole('button', { name: 'From now', exact: true }).click();
	await expect(plan.locator('.plan-row')).toHaveCount(allCount);
	const activity = page.getByRole('button', { name: /^Edit activity:/ }).first();
	const original = await activity.getAttribute('aria-label');
	await activity.click();
	await expect(page.getByLabel('Activity 1', { exact: true })).toBeFocused();
	await page.getByLabel('Activity 1', { exact: true }).fill('Unsaved change');
	await expect(page.getByRole('button', { name: 'Change today', exact: true })).toBeDisabled();
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page.getByRole('button', { name: original!, exact: true })).toBeVisible();
	await expect(page.getByText('Unsaved change', { exact: true })).toHaveCount(0);
});

test('saves open entries with optional editable color labels', async ({ page }) => {
 await page.clock.setFixedTime(new Date('2026-09-19T12:00:00'));
 await open(page);
 const sampler = page.getByTestId('interval-sampler');
 await expect(sampler.getByRole('button', { name: /paper marks/i })).toHaveCount(0);
 const entry = sampler.getByLabel('What’s happening now?', { exact: true });
 await entry.fill('Reading outside');
 await sampler.getByRole('button', { name: 'Save moment', exact: true }).click();
 await page.reload();
 await expect(entry).toHaveValue('Reading outside');
 await expect(sampler.getByRole('button', { name: 'No label', exact: true })).toHaveAttribute('aria-pressed', 'true');
 await sampler.getByRole('button', { name: 'Edit labels', exact: true }).click();
 await sampler.getByLabel('Label 1 name', { exact: true }).fill('People');
 await sampler.getByLabel('Label 1 color', { exact: true }).fill('#338866');
 await sampler.getByRole('button', { name: 'Add label', exact: true }).click();
 await sampler.getByLabel('Label 7 name', { exact: true }).fill('Outside');
 await sampler.getByLabel('Label 7 color', { exact: true }).fill('#885533');
 await sampler.getByRole('button', { name: 'Save labels', exact: true }).click();
 await sampler.getByRole('button', { name: 'Outside', exact: true }).click();
 await expect(entry).toHaveValue('Reading outside');
 await sampler.getByRole('button', { name: 'Save changes', exact: true }).click();
 await page.reload();
 await expect(entry).toHaveValue('Reading outside');
 await expect(sampler.getByRole('button', { name: 'Outside', exact: true })).toHaveAttribute('aria-pressed', 'true');
 await expect(sampler.getByRole('button', { name: 'People', exact: true })).toBeVisible();
 await sampler.getByRole('button', { name: 'Edit labels', exact: true }).click();
 await sampler.getByLabel('Label 7 name', { exact: true }).fill('Garden');
 await sampler.getByRole('button', { name: 'Save labels', exact: true }).click();
 // Changing a label does not rewrite the snapshot already saved on the moment.
 const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
 expect(saved[0].sampleTag).toMatchObject({ name: 'Outside', color: '#885533' });
 await sampler.getByRole('button', { name: 'Edit labels', exact: true }).click();
 await sampler.getByRole('button', { name: 'Remove label 7', exact: true }).click();
 await sampler.getByRole('button', { name: 'Save labels', exact: true }).click();
 await sampler.getByRole('button', { name: 'No label', exact: true }).click();
 await entry.fill('Reading in the garden');
 await sampler.getByRole('button', { name: 'Save changes', exact: true }).click();
 await page.reload();
 await expect(entry).toHaveValue('Reading in the garden');
 await expect(sampler.getByRole('button', { name: 'Garden', exact: true })).toHaveCount(0);
 await expect(sampler.getByRole('button', { name: 'No label', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('offers contextual details without recording answers until save', async ({ page }, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.clock.setFixedTime(new Date('2026-09-19T12:00:00'));
	await page.addInitScript(() => { if (!localStorage.getItem('planner.observations.v1')) localStorage.setItem('planner.observations.v1', JSON.stringify([
		{ id: 'earlier', date: '2026-09-19', intervalStart: '09:00', source: 'live', kind: 'elsewhere', label: 'Slow start', details: { energy: 1 }, capturedAt: '', updatedAt: '' }
	])); });
	await open(page);
	const sampler = page.getByTestId('interval-sampler');
	await expect(sampler.getByTestId('detail-offer')).toHaveCount(0);
	await sampler.getByLabel('What’s happening now?', { exact: true }).fill('Working on notes');
	await expect(sampler.getByTestId('detail-offer')).toHaveCount(1);
	await expect(sampler.getByText('You recorded low energy at 09:00. Has it changed?')).toBeVisible();
	await sampler.getByRole('button', { name: /^Add energy/ }).click();
	const rating = sampler.getByRole('group', { name: 'How much energy do you have?' });
	await expect(rating.locator('[aria-pressed="true"]')).toHaveCount(0);
	await rating.getByRole('button', { name: 'Low', exact: true }).click();
	await sampler.getByRole('button', { name: 'Done', exact: true }).click();
	await sampler.getByRole('button', { name: /^Add body/ }).click();
	await sampler.getByLabel('What do you notice in your body?').fill('Tense shoulders');
	await expect(sampler.getByTestId('detail-offer')).toHaveCount(0);
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 1000 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		expect(await sampler.evaluate(el => [el.scrollTop, el.scrollLeft])).toEqual([0, 0]);
		await page.screenshot({ path: testInfo.outputPath(`moment-details-${width}.png`), fullPage: true, animations: 'disabled' });
	}
	let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved).toHaveLength(1);
	await sampler.getByRole('button', { name: 'Save moment', exact: true }).click();
	saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved.find((o: { intervalStart: string }) => o.intervalStart === '12:00').details).toEqual({ energy: 2, body: 'Tense shoulders' });
	await page.reload();
	const restored = page;
	const restoredSample = restored.getByTestId('interval-sampler');
	await restoredSample.getByRole('button', { name: 'Energy · Low', exact: true }).click();
	await restoredSample.getByRole('button', { name: 'Remove detail', exact: true }).click();
	await restoredSample.getByRole('button', { name: 'Save changes', exact: true }).click();
	await restored.reload();
	await expect(restoredSample.getByRole('button', { name: 'Energy · Low', exact: true })).toHaveCount(0);
	await restoredSample.getByRole('button', { name: 'Body ✓', exact: true }).click();
	await expect(restoredSample.getByLabel('What do you notice in your body?')).toHaveValue('Tense shoulders');
});

test('customizes trackers, offers relevant questions, and reopens them from the day review', async ({ page }, testInfo) => {
	await page.clock.setFixedTime(new Date('2026-09-20T12:00:00'));
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await open(page);
	const sampler = page.getByTestId('interval-sampler');
	await sampler.getByText('Your trackers', { exact: false }).click();
	await sampler.getByRole('button', { name: 'Customize trackers', exact: true }).click();
	await sampler.getByRole('button', { name: 'Add tracker', exact: true }).click();
	await sampler.getByLabel('Tracker 1 name', { exact: true }).fill('Focus');
	await sampler.getByLabel('Tracker 1 low', { exact: true }).fill('Scattered');
	await sampler.getByLabel('Tracker 1 high', { exact: true }).fill('Absorbed');
	await sampler.getByLabel('Tracker 1 cues', { exact: true }).fill('reading, writing');
	await sampler.getByRole('button', { name: 'Add tracker', exact: true }).click();
	await sampler.getByLabel('Tracker 2 name', { exact: true }).fill('Outside');
	await sampler.getByLabel('Tracker 2 type', { exact: true }).selectOption('check');
	await sampler.getByRole('button', { name: 'Save trackers', exact: true }).click();
	await sampler.getByLabel('What’s happening now?', { exact: true }).fill('Reading a book');
	await expect(sampler.getByTestId('detail-offer')).toHaveCount(2);
	await sampler.getByRole('button', { name: /^Add Focus/ }).click();
	await sampler.getByRole('group', { name: 'Focus', exact: true }).getByRole('button', { name: '4', exact: true }).click();
	await sampler.getByRole('button', { name: 'Done', exact: true }).click();
	await sampler.getByRole('button', { name: 'Outside', exact: true }).click();
	await sampler.getByRole('group', { name: 'Outside', exact: true }).getByRole('button', { name: 'No', exact: true }).click();
	await sampler.getByRole('button', { name: 'Save moment', exact: true }).click();
	await page.reload();
	await expect(sampler.getByRole('button', { name: 'Focus · 4/5', exact: true })).toBeVisible();
	await expect(sampler.getByRole('button', { name: 'Outside · No', exact: true })).toBeVisible();
	await page.locator('summary').filter({ hasText: 'Day so far' }).click();
	await page.getByLabel('Find a moment', { exact: true }).fill('Focus');
	await expect(page.getByRole('button', { name: 'Reopen 12:00: Reading a book', exact: true })).toBeVisible();
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 1000 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.screenshot({ path: testInfo.outputPath(`personal-trackers-${width}.png`), fullPage: true, animations: 'disabled' });
	}
	await page.getByRole('button', { name: 'Reopen 12:00: Reading a book', exact: true }).click();
	await sampler.getByRole('button', { name: 'Focus · 4/5', exact: true }).click();
	await expect(sampler.getByRole('group', { name: 'Focus', exact: true }).getByRole('button', { name: '4', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await page.evaluate(() => { const settings = JSON.parse(localStorage.getItem('planner.settings.v1') || '{}'); settings.wakeAnchor = '13:00'; localStorage.setItem('planner.settings.v1', JSON.stringify(settings)); });
	await page.reload();
	await page.locator('summary').filter({ hasText: 'Day so far' }).click();
	await page.getByRole('button', { name: 'Reopen 12:00: Reading a book', exact: true }).click();
	await expect(sampler.getByLabel('What was happening?', { exact: true })).toHaveValue('Reading a book');
	await sampler.getByRole('button', { name: 'Focus · 4/5', exact: true }).click();
	await expect(sampler.getByRole('group', { name: 'Focus', exact: true }).getByRole('button', { name: '4', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('extracts several idea tasks immediately and persists an edition note',async({page})=>{
	await open(page);await section(page,'Surge');
	await page.getByLabel('Title',{exact:true}).fill('Write a book');
	await page.getByLabel('Notes',{exact:true}).fill('Notes to retain.');
	await page.getByRole('button',{name:'Save idea',exact:true}).click();
	await page.getByLabel('One task per line').fill('Draft outline\nCollect sources');
	await page.getByRole('button',{name:'Create tasks without dates',exact:true}).click();
	await expect(page.getByRole('button',{name:'Draft outline',exact:true})).toBeVisible();
	await expect(page.getByRole('button',{name:'Collect sources',exact:true})).toBeVisible();
	await expect(page.getByLabel('Idea notes')).toHaveValue('Notes to retain.');
	await section(page,'Editions');
	await page.getByLabel('What would you keep or change?').fill('Keep time for reading.');
	await page.getByRole('button',{name:'Save note',exact:true}).click();
	await page.reload();await section(page,'Editions');
	await expect(page.getByLabel('What would you keep or change?')).toHaveValue('Keep time for reading.');
});

test('renders all workspaces at desktop and phone widths without overflow',async({page},testInfo)=>{
	const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
	await open(page);
	for (const width of [1440,390]) {
		await page.setViewportSize({width,height:1000});
		for(const name of ['Today','Day piles','Routines','Surge','Editions']) {
			await section(page,name);
			await expect(page.locator('#carillon-main')).toBeVisible();
			expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
			await page.screenshot({path:testInfo.outputPath(name.replaceAll(' ','-')+'-'+width+'.png'),fullPage:true});
		}
	}
	expect(errors).toEqual([]);
});
