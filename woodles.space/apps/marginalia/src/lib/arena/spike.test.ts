import { describe, expect, it } from 'vitest';
import {
	ARENA_H,
	ARENA_W,
	ENEMY_SPECS,
	MAX_CONCURRENT_ENEMIES,
	WAVES,
	createArenaState,
	stepArena,
	type ArenaInput,
	type ArenaState,
	type Enemy
} from './spike';

const idle: ArenaInput = { moveX: 0, moveY: 0, aimAngle: 0, attack: false, dash: false };

function run(state: ArenaState, input: ArenaInput, dt: number, frames: number) {
	for (let i = 0; i < frames; i += 1) stepArena(state, dt, input);
}

function enemyAt(id: number, pos: { x: number; y: number }, overrides: Partial<Enemy> = {}): Enemy {
	return {
		id,
		kind: 'swarmer',
		pos,
		hp: ENEMY_SPECS.swarmer.maxHp,
		hurtFlash: 0,
		contactCooldown: 0,
		fireCooldown: 0,
		...overrides
	};
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
		state.enemies.push(enemyAt(99, { x: state.player.pos.x + 30, y: state.player.pos.y }));
		const input: ArenaInput = { moveX: 0, moveY: 0, aimAngle: 0, attack: true, dash: false };
		stepArena(state, 1 / 60, input);
		expect(state.enemies[0].hp).toBeLessThan(ENEMY_SPECS.swarmer.maxHp);

		for (let i = 0; i < 10 && state.enemies.some((enemy) => enemy.id === 99); i += 1) {
			stepArena(state, 0.4, input);
		}
		expect(state.enemies.some((enemy) => enemy.id === 99)).toBe(false);
		expect(state.kills).toBe(1);
	});

	it('does not damage an enemy behind the player', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.enemies.push(enemyAt(1, { x: state.player.pos.x - 50, y: state.player.pos.y }));
		stepArena(state, 1 / 60, { moveX: 0, moveY: 0, aimAngle: 0, attack: true, dash: false });
		expect(state.enemies[0].hp).toBe(ENEMY_SPECS.swarmer.maxHp);
	});

	it('takes contact damage from an adjacent enemy, then gains brief invulnerability', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.enemies.push(enemyAt(2, { x: state.player.pos.x, y: state.player.pos.y }));
		stepArena(state, 1 / 60, idle);
		const afterFirstHit = state.player.hp;
		expect(afterFirstHit).toBeLessThan(100);

		stepArena(state, 1 / 60, idle);
		expect(state.player.hp).toBe(afterFirstHit);
	});

	it('grants invulnerability while dashing', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.enemies.push(enemyAt(3, { x: state.player.pos.x, y: state.player.pos.y }));
		stepArena(state, 1 / 60, { moveX: 1, moveY: 0, aimAngle: 0, attack: false, dash: true });
		expect(state.player.hp).toBe(100);
	});

	it("a brute hits harder and takes more hits to kill than a swarmer", () => {
		expect(ENEMY_SPECS.brute.maxHp).toBeGreaterThan(ENEMY_SPECS.swarmer.maxHp);
		expect(ENEMY_SPECS.brute.contactDamage).toBeGreaterThan(ENEMY_SPECS.swarmer.contactDamage);
	});

	it('a caster keeps its distance and fires a projectile toward the player', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.enemies.push(
			enemyAt(4, { x: state.player.pos.x + 150, y: state.player.pos.y }, { kind: 'caster', hp: ENEMY_SPECS.caster.maxHp, fireCooldown: 0 })
		);
		stepArena(state, 1 / 60, idle);
		expect(state.projectiles.length).toBe(1);
		const proj = state.projectiles[0];
		// caster sits to the right of the player; a shot aimed at the player moves left (negative x)
		expect(proj.vel.x).toBeLessThan(0);
	});

	it('a projectile damages the player on contact', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.projectiles.push({
			id: 1,
			pos: { x: state.player.pos.x, y: state.player.pos.y },
			vel: { x: 0, y: 0 },
			life: 1
		});
		stepArena(state, 1 / 60, idle);
		expect(state.player.hp).toBeLessThan(100);
		expect(state.projectiles.length).toBe(0);
	});

	it('spawns wave 1 over time without exceeding the concurrent cap', () => {
		const state = createArenaState();
		state.phase = 'running';
		const wave1Total = WAVES[0].swarmer + WAVES[0].brute + WAVES[0].caster;
		for (let i = 0; i < 40; i += 1) {
			stepArena(state, 0.5, idle);
			expect(state.enemies.length).toBeLessThanOrEqual(MAX_CONCURRENT_ENEMIES);
		}
		expect(state.spawnQueue.length).toBe(0);
		expect(state.nextEnemyId - 1).toBe(wave1Total);
	});

	it('clearing a wave heals the player and starts an intermission before the next wave', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.player.hp = 50;
		state.enemies = [];
		state.spawnQueue = [];
		stepArena(state, 1 / 60, idle);
		expect(state.phase).toBe('intermission');
		expect(state.wave).toBe(1);
		expect(state.player.hp).toBe(65);
		expect(state.spawnQueue.length).toBe(WAVES[1].swarmer + WAVES[1].brute + WAVES[1].caster);
	});

	it('the player can still move during an intermission', () => {
		const state = createArenaState();
		state.phase = 'intermission';
		state.intermissionTimer = 2;
		const startX = state.player.pos.x;
		stepArena(state, 1 / 60, { ...idle, moveX: 1 });
		expect(state.player.pos.x).toBeGreaterThan(startX);
	});

	it('an intermission ends and resumes running once its timer elapses', () => {
		const state = createArenaState();
		state.phase = 'intermission';
		state.intermissionTimer = 0.1;
		stepArena(state, 0.05, idle);
		expect(state.phase).toBe('intermission');
		stepArena(state, 0.05, idle);
		expect(state.phase).toBe('running');
	});

	it('clearing the last wave ends the run as cleared, not another intermission', () => {
		const state = createArenaState();
		state.phase = 'running';
		state.wave = WAVES.length - 1;
		state.enemies = [];
		state.spawnQueue = [];
		stepArena(state, 1 / 60, idle);
		expect(state.phase).toBe('cleared');
	});
});
