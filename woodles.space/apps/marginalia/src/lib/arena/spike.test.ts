import { describe, expect, it } from 'vitest';
import { ARENA_H, ARENA_W, createArenaState, stepArena, type ArenaInput, type ArenaState } from './spike';

const idle: ArenaInput = { moveX: 0, moveY: 0, aimAngle: 0, attack: false, dash: false };

function run(state: ArenaState, input: ArenaInput, dt: number, frames: number) {
	for (let i = 0; i < frames; i += 1) stepArena(state, dt, input);
}

describe('arena spike sim', () => {
	it('does nothing before the run starts', () => {
		const state = createArenaState();
		const before = { ...state.player.pos };
		stepArena(state, 1 / 60, { ...idle, moveX: 1 });
		expect(state.player.pos).toEqual(before);
	});

	it('moves the player toward held input', () => {
		const state = createArenaState();
		state.phase = 'running';
		const startX = state.player.pos.x;
		run(state, { ...idle, moveX: 1 }, 1 / 60, 30);
		expect(state.player.pos.x).toBeGreaterThan(startX);
	});

	it('keeps the player inside the arena bounds', () => {
		const state = createArenaState();
		state.phase = 'running';
		run(state, { ...idle, moveX: -1, moveY: -1 }, 1 / 60, 300);
		expect(state.player.pos.x).toBeGreaterThanOrEqual(0);
		expect(state.player.pos.y).toBeGreaterThanOrEqual(0);
		expect(state.player.pos.x).toBeLessThanOrEqual(ARENA_W);
		expect(state.player.pos.y).toBeLessThanOrEqual(ARENA_H);
	});

	it('damages and eventually kills an enemy standing in the swing arc', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.enemies.push({
			id: 99,
			pos: { x: state.player.pos.x + 30, y: state.player.pos.y },
			hp: 30,
			hurtFlash: 0,
			contactCooldown: 0
		});
		const input: ArenaInput = { moveX: 0, moveY: 0, aimAngle: 0, attack: true, dash: false };
		stepArena(state, 1 / 60, input);
		expect(state.enemies[0].hp).toBeLessThan(30);

		for (let i = 0; i < 10 && state.enemies.some((enemy) => enemy.id === 99); i += 1) {
			stepArena(state, 0.4, input);
		}
		expect(state.enemies.some((enemy) => enemy.id === 99)).toBe(false);
		expect(state.kills).toBe(1);
	});

	it('does not damage an enemy behind the player', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.enemies.push({
			id: 1,
			pos: { x: state.player.pos.x - 50, y: state.player.pos.y },
			hp: 30,
			hurtFlash: 0,
			contactCooldown: 0
		});
		stepArena(state, 1 / 60, { moveX: 0, moveY: 0, aimAngle: 0, attack: true, dash: false });
		expect(state.enemies[0].hp).toBe(30);
	});

	it('takes contact damage from an adjacent enemy, then gains brief invulnerability', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.enemies.push({
			id: 2,
			pos: { x: state.player.pos.x, y: state.player.pos.y },
			hp: 30,
			hurtFlash: 0,
			contactCooldown: 0
		});
		stepArena(state, 1 / 60, idle);
		const afterFirstHit = state.player.hp;
		expect(afterFirstHit).toBeLessThan(100);

		stepArena(state, 1 / 60, idle);
		expect(state.player.hp).toBe(afterFirstHit);
	});

	it('grants invulnerability while dashing', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.enemies.push({
			id: 3,
			pos: { x: state.player.pos.x, y: state.player.pos.y },
			hp: 30,
			hurtFlash: 0,
			contactCooldown: 0
		});
		stepArena(state, 1 / 60, { moveX: 1, moveY: 0, aimAngle: 0, attack: false, dash: true });
		expect(state.player.hp).toBe(100);
	});

	it('spawns enemies over time, capped at the max', () => {
		const state = createArenaState();
		state.phase = 'running';
		run(state, idle, 0.5, 20);
		expect(state.enemies.length).toBeGreaterThan(0);
		expect(state.enemies.length).toBeLessThanOrEqual(3);
	});
});
