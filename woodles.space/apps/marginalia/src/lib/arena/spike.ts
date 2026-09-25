import { clamp, distance, normalize, type Dot } from '../arcade/arcadeMath';

export const ARENA_W = 840;
export const ARENA_H = 480;
export const PLAYER_RADIUS = 16;
export const PLAYER_MAX_HP = 100;
export const ATTACK_RANGE = 62;
export const ATTACK_ARC = Math.PI / 2;
export const PROJECTILE_RADIUS = 6;
export const MAX_CONCURRENT_ENEMIES = 4;

const PLAYER_SPEED = 230;
const HURT_IFRAME = 0.5;

const SPAWN_INTERVAL = 1.3;
// Golden angle: cycling the spawn angle by this each time spreads spawn
// points around the border without needing a random source in the sim.
const SPAWN_ANGLE_STEP = 2.399963;

const ATTACK_DAMAGE = 15;
const ATTACK_COOLDOWN = 0.35;
const ATTACK_VISUAL_TIME = 0.12;
const ATTACK_LUNGE = 14;
const ATTACK_KNOCKBACK = 26;
// Past point-blank (this margin beyond the two colliders' combined radius)
// the bearing to an enemy is well-defined and has to fall inside the swing
// arc. At point-blank range that bearing is dominated by sub-pixel noise
// from the chase AI and can point almost anywhere — an enemy glued to you
// should never dodge a swing on an angle technicality.
const POINT_BLANK_MARGIN = 6;

const DASH_SPEED = 560;
const DASH_TIME = 0.16;
const DASH_COOLDOWN = 0.8;

const SHAKE_DECAY = 3.2;
const SHAKE_ON_HIT = 0.12;
const SHAKE_ON_KILL = 0.22;

const INTERMISSION_TIME = 3;
const INTERMISSION_HEAL = 15;

const CASTER_STANDOFF = 230;
const CASTER_STANDOFF_BAND = 20;
const CASTER_FIRE_RANGE = 320;
const CASTER_FIRE_INTERVAL = 1.7;
const PROJECTILE_SPEED = 260;
const PROJECTILE_DAMAGE = 9;
const PROJECTILE_LIFE = 2.6;

export type Phase = 'ready' | 'running' | 'intermission' | 'over' | 'cleared';
export type EnemyKind = 'swarmer' | 'brute' | 'caster';

interface EnemySpecEntry {
	radius: number;
	speed: number;
	maxHp: number;
	contactDamage: number;
	contactCooldown: number;
}

export const ENEMY_SPECS: Record<EnemyKind, EnemySpecEntry> = {
	swarmer: { radius: 14, speed: 110, maxHp: 30, contactDamage: 10, contactCooldown: 0.6 },
	brute: { radius: 20, speed: 78, maxHp: 70, contactDamage: 16, contactCooldown: 0.7 },
	caster: { radius: 13, speed: 70, maxHp: 15, contactDamage: 6, contactCooldown: 0.6 }
};

interface WaveSpec {
	swarmer: number;
	brute: number;
	caster: number;
}

export const WAVES: WaveSpec[] = [
	{ swarmer: 3, brute: 0, caster: 0 },
	{ swarmer: 4, brute: 1, caster: 0 },
	{ swarmer: 3, brute: 1, caster: 1 },
	{ swarmer: 5, brute: 2, caster: 1 },
	{ swarmer: 4, brute: 2, caster: 2 }
];

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
	kind: EnemyKind;
	pos: Dot;
	hp: number;
	hurtFlash: number;
	contactCooldown: number;
	fireCooldown: number;
}

export interface Projectile {
	id: number;
	pos: Dot;
	vel: Dot;
	life: number;
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
	projectiles: Projectile[];
	kills: number;
	nextEnemyId: number;
	nextProjectileId: number;
	spawnAngle: number;
	spawnTimer: number;
	wave: number;
	spawnQueue: EnemyKind[];
	intermissionTimer: number;
	shake: number;
}

function buildSpawnQueue(waveIndex: number): EnemyKind[] {
	const spec = WAVES[waveIndex];
	if (!spec) return [];
	const groups: { kind: EnemyKind; remaining: number }[] = [
		{ kind: 'swarmer', remaining: spec.swarmer },
		{ kind: 'brute', remaining: spec.brute },
		{ kind: 'caster', remaining: spec.caster }
	];
	const queue: EnemyKind[] = [];
	while (groups.some((group) => group.remaining > 0)) {
		for (const group of groups) {
			if (group.remaining > 0) {
				queue.push(group.kind);
				group.remaining -= 1;
			}
		}
	}
	return queue;
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
		projectiles: [],
		kills: 0,
		nextEnemyId: 1,
		nextProjectileId: 1,
		spawnAngle: 0,
		spawnTimer: 0,
		wave: 0,
		spawnQueue: buildSpawnQueue(0),
		intermissionTimer: 0,
		shake: 0
	};
}

function angleDiff(a: number, b: number): number {
	return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function spawnPoint(angle: number, radius: number): Dot {
	const ring = Math.max(ARENA_W, ARENA_H) * 0.62;
	const cx = ARENA_W / 2;
	const cy = ARENA_H / 2;
	return {
		x: clamp(cx + Math.cos(angle) * ring, radius, ARENA_W - radius),
		y: clamp(cy + Math.sin(angle) * ring, radius, ARENA_H - radius)
	};
}

function spawnEnemy(state: ArenaState, kind: EnemyKind): void {
	const spec = ENEMY_SPECS[kind];
	state.spawnAngle += SPAWN_ANGLE_STEP;
	state.enemies.push({
		id: state.nextEnemyId++,
		kind,
		pos: spawnPoint(state.spawnAngle, spec.radius),
		hp: spec.maxHp,
		hurtFlash: 0,
		contactCooldown: 0,
		fireCooldown: CASTER_FIRE_INTERVAL * 0.5
	});
}

export function stepArena(state: ArenaState, dt: number, input: ArenaInput): void {
	if (state.phase !== 'running' && state.phase !== 'intermission') return;

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

	if (state.phase === 'intermission') {
		state.intermissionTimer = Math.max(0, state.intermissionTimer - dt);
		if (state.intermissionTimer <= 0) state.phase = 'running';
		return;
	}

	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		updateEnemy(state, enemy, dt);
	}
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

	for (const proj of state.projectiles) {
		proj.pos.x += proj.vel.x * dt;
		proj.pos.y += proj.vel.y * dt;
		proj.life -= dt;
		if (proj.life <= 0) continue;
		const invulnerable = player.dashTimer > 0 || player.hurtFlash > 0;
		if (invulnerable) continue;
		if (distance(player.pos, proj.pos) <= PLAYER_RADIUS + PROJECTILE_RADIUS) {
			player.hp = Math.max(0, player.hp - PROJECTILE_DAMAGE);
			player.hurtFlash = HURT_IFRAME;
			state.shake = Math.max(state.shake, SHAKE_ON_HIT);
			proj.life = 0;
			if (player.hp <= 0) state.phase = 'over';
		}
	}
	state.projectiles = state.projectiles.filter(
		(proj) => proj.life > 0 && proj.pos.x > -40 && proj.pos.x < ARENA_W + 40 && proj.pos.y > -40 && proj.pos.y < ARENA_H + 40
	);

	if (state.phase === 'over') return;

	if (state.enemies.length < MAX_CONCURRENT_ENEMIES && state.spawnQueue.length > 0) {
		state.spawnTimer -= dt;
		if (state.spawnTimer <= 0) {
			const kind = state.spawnQueue.shift();
			if (kind) spawnEnemy(state, kind);
			state.spawnTimer = SPAWN_INTERVAL;
		}
	}

	if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
		if (state.wave + 1 < WAVES.length) {
			state.wave += 1;
			state.spawnQueue = buildSpawnQueue(state.wave);
			state.spawnTimer = 0;
			state.phase = 'intermission';
			state.intermissionTimer = INTERMISSION_TIME;
			player.hp = Math.min(PLAYER_MAX_HP, player.hp + INTERMISSION_HEAL);
		} else {
			state.phase = 'cleared';
		}
	}
}

function updateEnemy(state: ArenaState, enemy: Enemy, dt: number): void {
	const spec = ENEMY_SPECS[enemy.kind];
	enemy.hurtFlash = Math.max(0, enemy.hurtFlash - dt);
	enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);

	const player = state.player;
	const toPlayer = { x: player.pos.x - enemy.pos.x, y: player.pos.y - enemy.pos.y };
	const gap = Math.hypot(toPlayer.x, toPlayer.y);
	const dir = normalize(toPlayer.x, toPlayer.y);

	if (enemy.kind === 'caster') {
		const approach =
			gap > CASTER_STANDOFF + CASTER_STANDOFF_BAND ? 1 : gap < CASTER_STANDOFF - CASTER_STANDOFF_BAND ? -1 : 0;
		enemy.pos.x += dir.x * spec.speed * approach * dt;
		enemy.pos.y += dir.y * spec.speed * approach * dt;
		enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
		if (enemy.fireCooldown <= 0 && gap <= CASTER_FIRE_RANGE) {
			state.projectiles.push({
				id: state.nextProjectileId++,
				pos: { x: enemy.pos.x, y: enemy.pos.y },
				vel: { x: dir.x * PROJECTILE_SPEED, y: dir.y * PROJECTILE_SPEED },
				life: PROJECTILE_LIFE
			});
			enemy.fireCooldown = CASTER_FIRE_INTERVAL;
		}
	} else {
		enemy.pos.x += dir.x * spec.speed * dt;
		enemy.pos.y += dir.y * spec.speed * dt;
	}

	const invulnerable = player.dashTimer > 0 || player.hurtFlash > 0;
	if (!invulnerable && enemy.contactCooldown <= 0 && distance(player.pos, enemy.pos) <= PLAYER_RADIUS + spec.radius) {
		player.hp = Math.max(0, player.hp - spec.contactDamage);
		player.hurtFlash = HURT_IFRAME;
		enemy.contactCooldown = spec.contactCooldown;
		state.shake = Math.max(state.shake, SHAKE_ON_HIT);
		if (player.hp <= 0) state.phase = 'over';
	}
}

function resolveAttack(state: ArenaState): void {
	const player = state.player;
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		const spec = ENEMY_SPECS[enemy.kind];
		const toEnemy = { x: enemy.pos.x - player.pos.x, y: enemy.pos.y - player.pos.y };
		const gap = distance(player.pos, enemy.pos);
		if (gap > ATTACK_RANGE + spec.radius) continue;
		if (gap > PLAYER_RADIUS + spec.radius + POINT_BLANK_MARGIN) {
			const angleToEnemy = Math.atan2(toEnemy.y, toEnemy.x);
			if (Math.abs(angleDiff(angleToEnemy, player.facing)) > ATTACK_ARC / 2) continue;
		}

		enemy.hp -= ATTACK_DAMAGE;
		enemy.hurtFlash = 0.15;
		const push = normalize(toEnemy.x, toEnemy.y);
		enemy.pos.x = clamp(enemy.pos.x + push.x * ATTACK_KNOCKBACK, spec.radius, ARENA_W - spec.radius);
		enemy.pos.y = clamp(enemy.pos.y + push.y * ATTACK_KNOCKBACK, spec.radius, ARENA_H - spec.radius);
		state.shake = Math.max(state.shake, enemy.hp <= 0 ? SHAKE_ON_KILL : SHAKE_ON_HIT);
		if (enemy.hp <= 0) state.kills += 1;
	}
}
