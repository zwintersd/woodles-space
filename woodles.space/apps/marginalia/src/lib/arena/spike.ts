import { clamp, distance, normalize, type Dot } from '../arcade/arcadeMath';

export const ARENA_W = 840;
export const ARENA_H = 480;
export const PLAYER_RADIUS = 16;
export const PLAYER_MAX_HP = 100;
export const ENEMY_RADIUS = 14;
export const ATTACK_RANGE = 62;
export const ATTACK_ARC = Math.PI / 2;

const PLAYER_SPEED = 230;
const HURT_IFRAME = 0.5;

const ENEMY_SPEED = 110;
const ENEMY_MAX_HP = 30;
const ENEMY_CONTACT_DAMAGE = 10;
const ENEMY_CONTACT_COOLDOWN = 0.6;
const MAX_ENEMIES = 3;
const SPAWN_INTERVAL = 1.6;
// Golden angle: cycling the spawn angle by this each time spreads spawn
// points around the border without needing a random source in the sim.
const SPAWN_ANGLE_STEP = 2.399963;

const ATTACK_DAMAGE = 15;
const ATTACK_COOLDOWN = 0.35;
const ATTACK_VISUAL_TIME = 0.12;
const ATTACK_LUNGE = 14;
const ATTACK_KNOCKBACK = 26;
const POINT_BLANK_RANGE = PLAYER_RADIUS + ENEMY_RADIUS + 6;

const DASH_SPEED = 560;
const DASH_TIME = 0.16;
const DASH_COOLDOWN = 0.8;

const SHAKE_DECAY = 3.2;
const SHAKE_ON_HIT = 0.12;
const SHAKE_ON_KILL = 0.22;

export type Phase = 'ready' | 'running' | 'over';

export interface Player {
	pos: Dot;
	facing: number;
	hp: number;
	attackCooldown: number;
	attackTimer: number;
	dashCooldown: number;
	dashTimer: number;
	dashDir: Dot;
	hurtFlash: number;
}

export interface Enemy {
	id: number;
	pos: Dot;
	hp: number;
	hurtFlash: number;
	contactCooldown: number;
}

export interface ArenaInput {
	moveX: number;
	moveY: number;
	aimAngle: number;
	attack: boolean;
	dash: boolean;
}

export interface ArenaState {
	phase: Phase;
	player: Player;
	enemies: Enemy[];
	kills: number;
	nextEnemyId: number;
	spawnAngle: number;
	spawnTimer: number;
	shake: number;
}

export function createArenaState(): ArenaState {
	return {
		phase: 'ready',
		player: {
			pos: { x: ARENA_W / 2, y: ARENA_H / 2 },
			facing: 0,
			hp: PLAYER_MAX_HP,
			attackCooldown: 0,
			attackTimer: 0,
			dashCooldown: 0,
			dashTimer: 0,
			dashDir: { x: 1, y: 0 },
			hurtFlash: 0
		},
		enemies: [],
		kills: 0,
		nextEnemyId: 1,
		spawnAngle: 0,
		spawnTimer: 0,
		shake: 0
	};
}

function angleDiff(a: number, b: number): number {
	return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function spawnPoint(angle: number): Dot {
	const radius = Math.max(ARENA_W, ARENA_H) * 0.62;
	const cx = ARENA_W / 2;
	const cy = ARENA_H / 2;
	return {
		x: clamp(cx + Math.cos(angle) * radius, ENEMY_RADIUS, ARENA_W - ENEMY_RADIUS),
		y: clamp(cy + Math.sin(angle) * radius, ENEMY_RADIUS, ARENA_H - ENEMY_RADIUS)
	};
}

export function stepArena(state: ArenaState, dt: number, input: ArenaInput): void {
	if (state.phase !== 'running') return;

	const player = state.player;
	player.attackCooldown = Math.max(0, player.attackCooldown - dt);
	player.attackTimer = Math.max(0, player.attackTimer - dt);
	player.dashCooldown = Math.max(0, player.dashCooldown - dt);
	player.hurtFlash = Math.max(0, player.hurtFlash - dt);
	state.shake = Math.max(0, state.shake - dt * SHAKE_DECAY);

	if (input.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
		const move = normalize(input.moveX, input.moveY);
		player.dashDir =
			move.x === 0 && move.y === 0 ? normalize(Math.cos(input.aimAngle), Math.sin(input.aimAngle)) : move;
		player.dashTimer = DASH_TIME;
		player.dashCooldown = DASH_COOLDOWN;
	}

	if (player.dashTimer > 0) {
		player.pos.x += player.dashDir.x * DASH_SPEED * dt;
		player.pos.y += player.dashDir.y * DASH_SPEED * dt;
		player.dashTimer = Math.max(0, player.dashTimer - dt);
	} else if (input.moveX !== 0 || input.moveY !== 0) {
		const move = normalize(input.moveX, input.moveY);
		player.pos.x += move.x * PLAYER_SPEED * dt;
		player.pos.y += move.y * PLAYER_SPEED * dt;
	}
	player.pos.x = clamp(player.pos.x, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS);
	player.pos.y = clamp(player.pos.y, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS);
	player.facing = input.aimAngle;

	if (input.attack && player.attackCooldown <= 0 && player.dashTimer <= 0) {
		player.attackCooldown = ATTACK_COOLDOWN;
		player.attackTimer = ATTACK_VISUAL_TIME;
		player.pos.x += Math.cos(player.facing) * ATTACK_LUNGE;
		player.pos.y += Math.sin(player.facing) * ATTACK_LUNGE;
		player.pos.x = clamp(player.pos.x, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS);
		player.pos.y = clamp(player.pos.y, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS);
		resolveAttack(state);
	}

	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		enemy.hurtFlash = Math.max(0, enemy.hurtFlash - dt);
		enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);

		const toPlayer = normalize(player.pos.x - enemy.pos.x, player.pos.y - enemy.pos.y);
		enemy.pos.x += toPlayer.x * ENEMY_SPEED * dt;
		enemy.pos.y += toPlayer.y * ENEMY_SPEED * dt;

		const invulnerable = player.dashTimer > 0 || player.hurtFlash > 0;
		if (!invulnerable && enemy.contactCooldown <= 0 && distance(player.pos, enemy.pos) <= PLAYER_RADIUS + ENEMY_RADIUS) {
			player.hp = Math.max(0, player.hp - ENEMY_CONTACT_DAMAGE);
			player.hurtFlash = HURT_IFRAME;
			enemy.contactCooldown = ENEMY_CONTACT_COOLDOWN;
			state.shake = Math.max(state.shake, SHAKE_ON_HIT);
			if (player.hp <= 0) state.phase = 'over';
		}
	}

	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

	if (state.enemies.length < MAX_ENEMIES) {
		state.spawnTimer -= dt;
		if (state.spawnTimer <= 0) {
			state.spawnAngle += SPAWN_ANGLE_STEP;
			state.enemies.push({
				id: state.nextEnemyId++,
				pos: spawnPoint(state.spawnAngle),
				hp: ENEMY_MAX_HP,
				hurtFlash: 0,
				contactCooldown: 0
			});
			state.spawnTimer = SPAWN_INTERVAL;
		}
	}
}

function resolveAttack(state: ArenaState): void {
	const player = state.player;
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		const toEnemy = { x: enemy.pos.x - player.pos.x, y: enemy.pos.y - player.pos.y };
		const gap = distance(player.pos, enemy.pos);
		if (gap > ATTACK_RANGE + ENEMY_RADIUS) continue;
		// Past point-blank the bearing to the enemy is well-defined and has to
		// fall inside the swing arc. At point-blank range (an enemy already
		// touching the player) that bearing is dominated by sub-pixel noise
		// from the chase AI and can point almost anywhere — an enemy glued to
		// you should never dodge a swing on an angle technicality.
		if (gap > POINT_BLANK_RANGE) {
			const angleToEnemy = Math.atan2(toEnemy.y, toEnemy.x);
			if (Math.abs(angleDiff(angleToEnemy, player.facing)) > ATTACK_ARC / 2) continue;
		}

		enemy.hp -= ATTACK_DAMAGE;
		enemy.hurtFlash = 0.15;
		const push = normalize(toEnemy.x, toEnemy.y);
		enemy.pos.x = clamp(enemy.pos.x + push.x * ATTACK_KNOCKBACK, ENEMY_RADIUS, ARENA_W - ENEMY_RADIUS);
		enemy.pos.y = clamp(enemy.pos.y + push.y * ATTACK_KNOCKBACK, ENEMY_RADIUS, ARENA_H - ENEMY_RADIUS);
		state.shake = Math.max(state.shake, enemy.hp <= 0 ? SHAKE_ON_KILL : SHAKE_ON_HIT);
		if (enemy.hp <= 0) state.kills += 1;
	}
}
