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
