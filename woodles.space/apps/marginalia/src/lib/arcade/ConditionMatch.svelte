<script lang="ts">
	import { onDestroy } from 'svelte';
	import ArcadeHud from './ArcadeHud.svelte';
	import ArcadePetPerks from './ArcadePetPerks.svelte';
	import ArcadeProgress from './ArcadeProgress.svelte';
	import { fmt } from '$lib/witch/book.svelte';
	import { clamp } from './arcadeMath';
	import { arcadeStartLabel } from './arcadeLabels';
	import { payReward, previewReward as previewArcadeReward } from './arcadeRewards';
	import { loadArcadeRecord, recordArcadeRun } from './arcadeRecords';
	import {
		buildTilePool,
		conditionLabel,
		emergenceForPair,
		selectRoundEmergences,
		type ConditionMatchTile
	} from './conditionMatchPairs';
	import type { Emergence } from '$lib/witch/content/emergences';
	import {
		coreStatValue,
		statTier,
		type ArcadeActivePet,
		type ArcadeStatEffects
	} from './arcadeStats';

	interface Props {
		onclose: () => void;
		activePet?: ArcadeActivePet;
	}
	let { onclose, activePet = null }: Props = $props();

	type Phase = 'ready' | 'running' | 'complete';

	const MAX_REWARD = 30;
	const DIFFICULTIES: { pairs: number; label: string }[] = [
		{ pairs: 3, label: '3 pairs' },
		{ pairs: 4, label: '4 pairs' },
		{ pairs: 6, label: '6 pairs' }
	];
	const BASE_MATCH_LOCKOUT_MS = 750;
	const BASE_MISMATCH_LINGER_MS = 900;
	const FLOURISH_MS = 1300;
	const PEEK_MS = 900;

	let phase = $state<Phase>('ready');
	let pairCount = $state(4);
	let tiles = $state<ConditionMatchTile[]>([]);
	let matchedTileIds = $state<Set<string>>(new Set());
	let flippedTileIds = $state<string[]>([]);
	let matches = $state(0);
	let mismatches = $state(0);
	let moves = $state(0);
	let streak = $state(0);
	let bestStreak = $state(0);
	let streakShields = $state(0);
	let peekChargesLeft = $state(0);
	let peeking = $state(false);
	let lastEmergenceFound = $state<Emergence | null>(null);
	let elapsed = $state(0);
	let rounds = $state(0);
	let awarded = $state(0);
	let bestScore = $state(loadArcadeRecord('condition-match').bestScore);

	let tickInterval: ReturnType<typeof setInterval> | null = null;
	let startedAt = 0;
	let matchTimer: ReturnType<typeof setTimeout> | null = null;
	let mismatchTimer: ReturnType<typeof setTimeout> | null = null;
	let peekTimer: ReturnType<typeof setTimeout> | null = null;
	let flourishTimer: ReturnType<typeof setTimeout> | null = null;

	const bodyTier = $derived(statTier(coreStatValue(activePet, 'body')));
	const mindTier = $derived(statTier(coreStatValue(activePet, 'mind')));
	const graceTier = $derived(statTier(coreStatValue(activePet, 'grace')));
	const heartTier = $derived(statTier(coreStatValue(activePet, 'heart')));

	const matchLockoutMs = $derived(clamp(BASE_MATCH_LOCKOUT_MS - bodyTier * 150, 300, BASE_MATCH_LOCKOUT_MS));
	const mismatchLingerMs = $derived(BASE_MISMATCH_LINGER_MS + graceTier * 300);
	const flipDurationMs = $derived(clamp(260 - bodyTier * 40, 120, 260));

	const statEffects = $derived<ArcadeStatEffects>({
		body: (_value, tier) => (tier > 0 ? `quicker flip, -${tier * 150}ms lockout` : 'standard flip speed'),
		mind: (_value, tier) => (tier > 0 ? `${tier} peek charge${tier === 1 ? '' : 's'}` : 'no peeks'),
		grace: (_value, tier) => (tier > 0 ? `longer look at a miss` : 'quick mismatch hide'),
		heart: (_value, tier) => (tier > 0 ? `${tier} streak shield${tier === 1 ? '' : 's'}` : 'streak breaks on a miss')
	});

	const progress = $derived(phase === 'ready' ? 0 : pairCount > 0 ? matches / pairCount : 0);
	const previewReward = $derived(rewardFor(matches, mismatches, elapsed));
	const startLabel = $derived(arcadeStartLabel(phase, rounds));
	const shellStyle = $derived(`--flip-duration:${flipDurationMs}ms`);

	function rewardFor(m: number, miss: number, secs: number): number {
		const raw = m * 6 - miss * 2 - Math.floor(secs / 6);
		return previewArcadeReward(raw, MAX_REWARD);
	}

	function isMatched(tile: ConditionMatchTile): boolean {
		return matchedTileIds.has(tile.tileId);
	}

	function isFlipped(tile: ConditionMatchTile): boolean {
		return flippedTileIds.includes(tile.tileId);
	}

	function isFaceUp(tile: ConditionMatchTile): boolean {
		return peeking || isMatched(tile) || isFlipped(tile);
	}

	function clearTimers() {
		if (matchTimer) clearTimeout(matchTimer);
		if (mismatchTimer) clearTimeout(mismatchTimer);
		if (peekTimer) clearTimeout(peekTimer);
		if (flourishTimer) clearTimeout(flourishTimer);
		matchTimer = mismatchTimer = peekTimer = flourishTimer = null;
	}

	function stopTicking() {
		if (tickInterval) clearInterval(tickInterval);
		tickInterval = null;
	}

	function startTicking() {
		startedAt = Date.now();
		elapsed = 0;
		tickInterval = setInterval(() => {
			elapsed = (Date.now() - startedAt) / 1000;
		}, 200);
	}

	function start() {
		stopTicking();
		clearTimers();
		const selected = selectRoundEmergences(pairCount);
		tiles = buildTilePool(selected);
		matchedTileIds = new Set();
		flippedTileIds = [];
		matches = 0;
		mismatches = 0;
		moves = 0;
		streak = 0;
		bestStreak = 0;
		streakShields = heartTier;
		peekChargesLeft = mindTier;
		peeking = false;
		lastEmergenceFound = null;
		awarded = 0;
		phase = 'running';
		startTicking();
	}

	function flipTile(tileId: string) {
		if (phase !== 'running' || peeking) return;
		if (matchedTileIds.has(tileId) || flippedTileIds.includes(tileId)) return;
		if (flippedTileIds.length >= 2) return;

		flippedTileIds = [...flippedTileIds, tileId];
		if (flippedTileIds.length === 2) resolveTurn();
	}

	function resolveTurn() {
		moves += 1;
		const [aId, bId] = flippedTileIds;
		const a = tiles.find((t) => t.tileId === aId);
		const b = tiles.find((t) => t.tileId === bId);
		if (!a || !b) return;

		const emergence = emergenceForPair(a.conditionId, b.conditionId);

		if (emergence) {
			lastEmergenceFound = emergence;
			matchTimer = setTimeout(() => {
				matchedTileIds = new Set([...matchedTileIds, aId, bId]);
				flippedTileIds = [];
				matches += 1;
				streak += 1;
				bestStreak = Math.max(bestStreak, streak);
				flourishTimer = setTimeout(() => {
					lastEmergenceFound = null;
				}, FLOURISH_MS);
				if (matchedTileIds.size === tiles.length) finish();
			}, matchLockoutMs);
		} else {
			mismatches += 1;
			mismatchTimer = setTimeout(() => {
				if (streak > 0) {
					if (streakShields > 0) {
						streakShields -= 1;
					} else {
						streak = 0;
					}
				}
				flippedTileIds = [];
			}, mismatchLingerMs);
		}
	}

	function peek() {
		if (phase !== 'running' || peeking || flippedTileIds.length >= 2 || peekChargesLeft <= 0) return;
		peekChargesLeft -= 1;
		peeking = true;
		peekTimer = setTimeout(() => {
			peeking = false;
		}, PEEK_MS);
	}

	function finish() {
		if (phase !== 'running') return;
		stopTicking();
		clearTimers();
		phase = 'complete';
		rounds += 1;
		const finalElapsed = elapsed;
		awarded = payReward(rewardFor(matches, mismatches, finalElapsed), MAX_REWARD);
		const points = Math.max(0, matches * 20 - mismatches * 5 - Math.floor(finalElapsed));
		const record = recordArcadeRun('condition-match', {
			score: points,
			summary: {
				pairCount,
				matches,
				mismatches,
				moves,
				bestStreak,
				elapsedSeconds: Math.round(finalElapsed),
				awarded
			}
		});
		bestScore = record.bestScore;
	}

	onDestroy(() => {
		stopTicking();
		clearTimers();
	});
</script>

<div class="match-shell" style={shellStyle}>
	<ArcadeHud
		title="Condition Match"
		hint="pair conditions with what they give rise to"
		maxWidth="600px"
		scores={[
			{ label: 'pairs', value: `${matches}/${pairCount}` },
			{ label: 'best', value: bestScore },
			{ label: 'moves', value: moves },
			{ label: 'streak', value: streak, live: streak > 0, tone: 'yellow' },
			{ label: 'time', value: `${Math.floor(elapsed)}s` },
			{ label: 'prize', value: fmt(phase === 'complete' ? awarded : previewReward) }
		]}
		{startLabel}
		onstart={start}
		onclose={onclose}
	/>

	<ArcadeProgress value={progress} label="pairs found" tone="magic" maxWidth="600px" />

	<div class="perks-wrap">
		<ArcadePetPerks creature={activePet} effects={statEffects} />
	</div>

	<div class="match-field" class:idle={phase !== 'running'}>
		{#if phase === 'ready'}
			<div class="field-message">
				<strong>{rounds > 0 ? 'again?' : 'ready?'}</strong>
				<em>
					{rounds > 0
						? `${rounds} round${rounds === 1 ? '' : 's'} complete`
						: 'flip two tiles. if the pair gives rise to something real, it stays. if not, it hides again.'}
				</em>
				<div class="difficulty-row" role="group" aria-label="round size">
					{#each DIFFICULTIES as d (d.pairs)}
						<button
							type="button"
							class="diff-btn"
							class:selected={pairCount === d.pairs}
							onclick={() => (pairCount = d.pairs)}
						>
							{d.label}
						</button>
					{/each}
				</div>
			</div>
		{:else if phase === 'complete'}
			<div class="field-message">
				<strong>{awarded > 0 ? `+${fmt(awarded)} insight` : 'the page settles'}</strong>
				<em>
					{matches} pair{matches === 1 ? '' : 's'} found · {moves} moves · {Math.round(elapsed)}s · best streak {bestStreak}
				</em>
			</div>
		{:else}
			<div class="board-area">
				<p class="flourish" class:visible={!!lastEmergenceFound} aria-live="polite">
					{#if lastEmergenceFound}
						→ {lastEmergenceFound.name}: {lastEmergenceFound.note}
					{/if}
				</p>
				<div class="tile-grid" data-count={tiles.length}>
					{#each tiles as tile (tile.tileId)}
						{@const faceUp = isFaceUp(tile)}
						{@const matched = isMatched(tile)}
						{@const flipped = isFlipped(tile)}
						{@const mismatchFlash = flipped && flippedTileIds.length === 2 && !lastEmergenceFound}
						<button
							type="button"
							class="tile"
							class:face-up={faceUp}
							class:matched
							class:mismatch-flash={mismatchFlash}
							disabled={matched || flipped || flippedTileIds.length >= 2 || peeking}
							onclick={() => flipTile(tile.tileId)}
							aria-label={faceUp ? conditionLabel(tile.conditionId) : 'face-down tile'}
						>
							{#if faceUp}
								<span class="tile-label">{conditionLabel(tile.conditionId)}</span>
							{:else}
								<span class="tile-back" aria-hidden="true">🜁</span>
							{/if}
						</button>
					{/each}
				</div>
				<div class="stats-row">
					<span class="stat">{mismatches} missed</span>
					<span class="stat">{streakShields} shield{streakShields === 1 ? '' : 's'}</span>
					<button
						type="button"
						class="peek-btn"
						disabled={peekChargesLeft <= 0 || peeking || flippedTileIds.length >= 2}
						onclick={peek}
					>
						peek · {peekChargesLeft} left
					</button>
				</div>
			</div>
		{/if}
	</div>

	<p class="match-note">
		Every emergence in the Book comes from two written conditions. Find the right pairs to watch it
		bloom again. Rewards cap at {MAX_REWARD} insight.
	</p>
</div>

<style>
	.match-shell {
		padding: 1.2rem 1.4rem 1.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		background: var(--sol-base3);
		border-top: 2px solid var(--sol-base2);
	}

	.perks-wrap {
		width: min(600px, 100%);
	}

	/* ── main field ────────────────────────────────────────────────────────── */
	.match-field {
		width: min(600px, calc(100vw - 3rem));
		border-radius: 6px;
		border: 1px solid var(--sol-base2);
		background: linear-gradient(135deg, #eee8d5 0%, #fdf6e3 45%, #e7dfc7 100%);
		overflow: hidden;
	}
	.match-field.idle {
		display: grid;
		place-items: center;
		min-height: 14rem;
	}
	.field-message {
		display: grid;
		gap: 0.6rem;
		justify-items: center;
		text-align: center;
		padding: 2rem 1.4rem;
	}
	.field-message strong {
		font-family: var(--font-counter);
		font-size: 2.3rem;
		line-height: 1;
		color: var(--sol-base01);
		font-weight: 400;
	}
	.field-message em {
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--sol-base0);
	}

	.difficulty-row {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.3rem;
	}
	.diff-btn {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sol-base0);
		background: var(--sol-base2);
		border: 1px solid transparent;
		border-radius: 3px;
		padding: 0.32rem 0.7rem;
		transition: background 0.1s, color 0.1s;
	}
	.diff-btn:hover {
		background: var(--sol-base1);
		color: var(--sol-base3);
	}
	.diff-btn.selected {
		background: var(--sol-violet);
		color: var(--sol-base3);
		border-color: var(--sol-violet);
	}

	/* ── active board ──────────────────────────────────────────────────────── */
	.board-area {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.2rem 1.4rem 1.3rem;
	}

	.flourish {
		min-height: 1.6rem;
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.82rem;
		color: var(--sol-violet);
		opacity: 0;
		transition: opacity 0.2s;
	}
	.flourish.visible {
		opacity: 1;
	}

	.tile-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		gap: 0.55rem;
	}

	.tile {
		aspect-ratio: 4 / 3;
		border-radius: 5px;
		border: 1px solid var(--sol-base2);
		background: var(--sol-base01);
		display: grid;
		place-items: center;
		padding: 0.4rem;
		transition: background var(--flip-duration) ease, transform var(--flip-duration) ease, border-color 0.15s;
	}
	.tile:not(:disabled):hover {
		transform: translateY(-2px);
		border-color: var(--sol-cyan);
	}
	.tile:disabled {
		cursor: default;
	}
	.tile-back {
		font-size: 1.3rem;
		color: var(--sol-base1);
	}
	.tile.face-up {
		background: var(--sol-base3);
		border-color: var(--sol-blue);
	}
	.tile-label {
		font-family: var(--font-body);
		font-size: 0.86rem;
		text-align: center;
		color: var(--sol-base01);
		line-height: 1.2;
		word-break: break-word;
	}
	.tile.matched {
		background: color-mix(in srgb, var(--sol-base3) 70%, var(--sol-green));
		border-color: var(--sol-green);
	}
	.tile.matched .tile-label {
		color: var(--sol-base00);
	}
	.tile.mismatch-flash {
		background: color-mix(in srgb, var(--sol-base3) 75%, var(--sol-red));
		border-color: var(--sol-red);
	}

	.stats-row {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.peek-btn {
		margin-left: auto;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sol-base3);
		background: var(--sol-violet);
		border-radius: 3px;
		padding: 0.28rem 0.6rem;
		transition: background 0.1s, opacity 0.1s;
	}
	.peek-btn:hover:not(:disabled) {
		background: var(--sol-blue);
	}
	.peek-btn:disabled {
		background: var(--sol-base2);
		color: var(--sol-base1);
		cursor: default;
	}

	/* ── footer note ───────────────────────────────────────────────────────── */
	.match-note {
		max-width: 600px;
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--sol-base1);
		text-align: center;
	}

	@media (max-width: 520px) {
		.tile-grid {
			grid-template-columns: repeat(auto-fill, minmax(5.2rem, 1fr));
		}
		.tile-label {
			font-size: 0.76rem;
		}
	}
</style>
