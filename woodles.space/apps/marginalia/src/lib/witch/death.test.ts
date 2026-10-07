// The life cycle: sustained dire stress in a fragile world kills a life, the
// death feeds the soil, and the life returns once what killed it has cleared.
// What is *known* about it is never lost along the way.

import { describe, expect, it } from 'vitest';
import { Book, STAGE_KNOWN } from './book.svelte';
import { conditions } from './content/conditions';

function starvedBook(): Book {
	const b = new Book();
	b.essence = 10_000;
	for (const c of conditions) b.writeCondition(c.id);
	for (const l of b.world.allRevealedLife) b.world.state.observation[l.id] = STAGE_KNOWN;
	return b;
}

/** Hold every stock at the floor, the way a world with nothing left to give would. */
function starve(b: Book, seconds: number) {
	for (let i = 0; i < seconds * 10; i++) {
		b.world.state.stocks = { nutrients: 0, oxygen: 0, moisture: 0 };
		b.tick(0.1);
	}
}

describe('the life cycle', () => {
	it('a healthy world kills nothing', () => {
		const b = new Book();
		b.essence = 10_000;
		b.writeCondition('holding');
		b.world.state.observation['salt_deposit'] = STAGE_KNOWN;
		for (let i = 0; i < 6000; i++) b.tick(0.1); // ten minutes
		expect(Object.keys(b.world.state.deaths)).toEqual([]);
	});

	it('a starved world loses its life, but not what was learned about it', () => {
		const b = starvedBook();
		const before = b.life.length;
		expect(before).toBeGreaterThan(0);
		starve(b, 200);
		expect(Object.keys(b.world.state.deaths).length).toBeGreaterThan(0);
		expect(b.life.length).toBeLessThan(before);
		for (const id of Object.keys(b.world.state.deaths)) {
			expect(b.stageOf(id)).toBe(STAGE_KNOWN);
		}
	});

	it('a death feeds the soil', () => {
		const b = starvedBook();
		// run until the first death, then check the pulse landed on the stock
		let died = false;
		for (let i = 0; i < 4000 && !died; i++) {
			b.world.state.stocks = { nutrients: 0, oxygen: 0, moisture: 0 };
			b.tick(0.1);
			died = Object.keys(b.world.state.deaths).length > 0;
		}
		expect(died).toBe(true);
		expect(b.world.state.stocks.nutrients).toBeGreaterThanOrEqual(12);
	});

	it('the dead return once the stress clears', () => {
		const b = starvedBook();
		starve(b, 200);
		const dead = Object.keys(b.world.state.deaths);
		expect(dead.length).toBeGreaterThan(0);
		// hand the world back a comfortable middle and let it settle
		b.world.state.stocks = { nutrients: 60, oxygen: 65, moisture: 55 };
		for (let i = 0; i < 4000; i++) b.tick(0.1);
		for (const id of dead) expect(id in b.world.state.deaths).toBe(false);
		expect(b.life.map((l) => l.id)).toEqual(expect.arrayContaining(dead));
	});
});
