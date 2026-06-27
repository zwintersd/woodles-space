<script lang="ts">
	import { tick } from 'svelte';
	import BubbleShooter from './BubbleShooter.svelte';
	import BulletHeaven from './BulletHeaven.svelte';
	import InsightRush from './InsightRush.svelte';
	import PaddleBreak from './PaddleBreak.svelte';
	import Snake from './Snake.svelte';
	import TowerDefense from './TowerDefense.svelte';
	import Inkblot from './Inkblot.svelte';
	import TwoZeroFourEight from './TwoZeroFourEight.svelte';
	import TypeWitch from './TypeWitch.svelte';
	import type { BestiaryCreature } from '$lib/witch/bestiaryDb';

	type GameStatus = 'play' | 'soon' | 'locked';

	interface MiniGame {
		id: string;
		icon: string;
		title: string;
		tagline: string;
		tags: string[];
		status: GameStatus;
		lockedHint?: string;
	}

	interface Props {
		activePet?: BestiaryCreature | null;
		bestiaryCreatures?: BestiaryCreature[];
		onactivechange?: (gameId: string | null) => void;
	}

	let { activePet = null, bestiaryCreatures = [], onactivechange }: Props = $props();

	let activeGame = $state<string | null>(null);
	let rootEl: HTMLDivElement;

	const games: MiniGame[] = [
		{
			id: 'inkblot',
			icon: '⬤',
			title: 'Inkblot',
			tagline: 'An image blooms slowly from ink. Press space to pause and name the creature before it fully resolves.',
			tags: ['recognition', 'observation'],
			status: 'play'
		},
		{
			id: 'stack-2048',
			icon: '▦',
			title: '2048',
			tagline: 'Slide the tiles. Merge the numbers. Reach 2048 before the board fills.',
			tags: ['puzzle', 'numbers'],
			status: 'play'
		},
		{
			id: 'type-witch',
			icon: '⌨',
			title: 'Type Witch',
			tagline: 'Race against the clock to transcribe Brianna\'s conditions before they dissolve.',
			tags: ['typing', 'timed'],
			status: 'play'
		},
		{
			id: 'condition-match',
			icon: '🜁',
			title: 'Condition Match',
			tagline: 'Flip tiles to pair conditions with their emergences. Memory as magic.',
			tags: ['memory', 'puzzle'],
			status: 'soon'
		},
		{
			id: 'insight-rush',
			icon: '✦',
			title: 'Insight Rush',
			tagline: 'Tap fast, tap true. Harvest a burst of insight before the moment closes.',
			tags: ['clicker', 'speed'],
			status: 'play'
		},
		{
			id: 'bullet-dot',
			icon: '•',
			title: 'Bullet Dot',
			tagline: 'The simplest bullet heaven possible: one dot, one swarm, automatic shots.',
			tags: ['action', 'survival'],
			status: 'play'
		},
		{
			id: 'margin-defense',
			icon: '⌂',
			title: 'Margin Defense',
			tagline: 'Place tiny towers along one route. Hold five waves before the margin breaks.',
			tags: ['tower', 'strategy'],
			status: 'play'
		},
		{
			id: 'margin-snake',
			icon: '∿',
			title: 'Margin Snake',
			tagline: 'Classic snake in a notebook grid. Eat marks, grow longer, avoid yourself.',
			tags: ['arcade', 'grid'],
			status: 'play'
		},
		{
			id: 'paddle-break',
			icon: '▭',
			title: 'Paddle Break',
			tagline: 'Pong hands, Breakout wall: keep the ball alive while the bricks come loose.',
			tags: ['arcade', 'reflex'],
			status: 'play'
		},
		{
			id: 'margin-bubbles',
			icon: '◌',
			title: 'Margin Bubbles',
			tagline: 'Bank shots into the canopy, match colors in threes, and keep the ceiling from pressing down.',
			tags: ['shooter', 'aim'],
			status: 'play'
		},
		{
			id: 'word-weave',
			icon: '🝩',
			title: 'Word Weave',
			tagline: 'Arrange scattered words into valid conditions. The Book will know if you\'re wrong.',
			tags: ['word', 'puzzle'],
			status: 'locked',
			lockedHint: 'unlocks after writing 8 conditions'
		},
		{
			id: 'star-catcher',
			icon: '★',
			title: 'Star Catcher',
			tagline: 'Guide falling stars into the margin before they blink out. Don\'t miss.',
			tags: ['action', 'reflex'],
			status: 'locked',
			lockedHint: 'unlocks after earning 3 reading stars'
		},
		{
			id: 'the-long-game',
			icon: '∞',
			title: 'The Long Game',
			tagline: 'A prestige loop within the loop. It watches you back.',
			tags: ['idle', 'meta'],
			status: 'locked',
			lockedHint: 'unlocks after witnessing a full lifecycle'
		}
	];

	const activeGameData = $derived(games.find((game) => game.id === activeGame) ?? null);

	async function showCabinetTop() {
		await tick();
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (!rootEl) return;
				const top = rootEl.getBoundingClientRect().top + window.scrollY - 12;
				window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
			});
		});
	}

	function openGame(gameId: string) {
		activeGame = gameId;
		onactivechange?.(activeGame);
		void showCabinetTop();
	}

	function closeGame() {
		activeGame = null;
		onactivechange?.(activeGame);
		void showCabinetTop();
	}

	const statusLabel: Record<GameStatus, string> = {
		play: 'play',
		soon: 'coming soon',
		locked: 'locked'
	};
</script>

<div class="arcade-root" bind:this={rootEl}>
	<header class="arcade-header">
		<div class="marquee-rail" aria-hidden="true">
			<span class="marquee-inner">
				✦ THE ARCADE ✦ MINIGAMES ✦ DIVERSIONS ✦ PLAY ✦ THE ARCADE ✦ MINIGAMES ✦ DIVERSIONS ✦ PLAY ✦ THE ARCADE ✦ MINIGAMES ✦ DIVERSIONS ✦ PLAY ✦&nbsp;
			</span>
		</div>
		<div class="arcade-title-row">
			<h2 class="arcade-title">The Arcade</h2>
			<p class="arcade-sub">side games & small diversions — a corner of the study set aside for play</p>
		</div>
	</header>

	{#if activeGameData}
		<section class="active-game" aria-label="{activeGameData.title} game">
			<header class="active-head">
				<button class="back-to-games" onclick={closeGame}>← games</button>
				<div>
					<p class="active-kicker">now playing</p>
					<h3>{activeGameData.title}</h3>
				</div>
			</header>

			{#if activeGame === 'inkblot'}
				<Inkblot onclose={closeGame} creatures={bestiaryCreatures} />
			{:else if activeGame === 'stack-2048'}
				<TwoZeroFourEight onclose={closeGame} creature={activePet} />
			{:else if activeGame === 'insight-rush'}
				<InsightRush onclose={closeGame} />
			{:else if activeGame === 'bullet-dot'}
				<BulletHeaven onclose={closeGame} />
			{:else if activeGame === 'margin-defense'}
				<TowerDefense onclose={closeGame} />
			{:else if activeGame === 'margin-snake'}
				<Snake onclose={closeGame} />
			{:else if activeGame === 'paddle-break'}
				<PaddleBreak onclose={closeGame} />
			{:else if activeGame === 'margin-bubbles'}
				<BubbleShooter onclose={closeGame} />
			{:else if activeGame === 'type-witch'}
				<TypeWitch onclose={closeGame} />
			{/if}
		</section>
	{:else}
		<div class="game-grid">
			{#each games as game (game.id)}
				<article class="game-card status-{game.status}">
					<div class="card-top">
						<span class="game-icon" aria-hidden="true">{game.icon}</span>
						<span class="status-badge">{statusLabel[game.status]}</span>
					</div>
					<h3 class="game-title">{game.title}</h3>
					<p class="game-tagline">{game.tagline}</p>
					<footer class="card-footer">
						<div class="tag-row">
							{#each game.tags as tag}
								<span class="tag">{tag}</span>
							{/each}
						</div>
						{#if game.status === 'play'}
							<button class="play-btn" onclick={() => openGame(game.id)}>play →</button>
						{:else if game.status === 'soon'}
							<span class="play-placeholder">soon</span>
						{:else}
							<span class="play-placeholder locked-hint">{game.lockedHint}</span>
						{/if}
					</footer>
				</article>
			{/each}
		</div>
	{/if}

	<p class="arcade-note">
		More games are written as the study grows. Play unlocks small rewards that drift
		back into the main book.
	</p>
</div>

<style>
	/* ── Solarized Light tokens, scoped to .arcade-root ─────────────────── */
	.arcade-root {
		--sol-base3:  #fdf6e3;
		--sol-base2:  #eee8d5;
		--sol-base1:  #93a1a1;
		--sol-base0:  #657b83;
		--sol-base00: #586e75;
		--sol-base01: #073642;
		--sol-yellow:  #b58900;
		--sol-orange:  #cb4b16;
		--sol-red:     #dc322f;
		--sol-magenta: #d33682;
		--sol-violet:  #6c71c4;
		--sol-blue:    #268bd2;
		--sol-cyan:    #2aa198;
		--sol-green:   #859900;

		background: var(--sol-base3);
		border: 1px solid var(--sol-base2);
		border-radius: 5px;
		padding: 0;
		overflow: hidden;
		color: var(--sol-base00);
		font-family: var(--font-ui);
	}

	/* ── header / marquee ───────────────────────────────────────────────── */
	.arcade-header {
		background: var(--sol-base2);
		border-bottom: 2px solid var(--sol-yellow);
	}
	.marquee-rail {
		overflow: hidden;
		white-space: nowrap;
		background: var(--sol-yellow);
		color: var(--sol-base3);
		font-family: var(--font-counter);
		font-size: 0.95rem;
		letter-spacing: 0.12em;
		padding: 0.22rem 0;
	}
	.marquee-inner {
		display: inline-block;
		animation: marquee 28s linear infinite;
	}
	@keyframes marquee {
		from { transform: translateX(0); }
		to   { transform: translateX(-50%); }
	}
	.arcade-title-row {
		padding: 1rem 1.4rem 1.1rem;
	}
	.arcade-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2rem;
		color: var(--sol-base01);
		margin: 0 0 0.2rem;
		letter-spacing: 0.01em;
	}
	.arcade-sub {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.88rem;
		color: var(--sol-base1);
		margin: 0;
	}

	/* ── game grid ──────────────────────────────────────────────────────── */
	.game-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 1px;
		background: var(--sol-base2);
		border-top: 1px solid var(--sol-base2);
	}
	.game-card {
		background: var(--sol-base3);
		padding: 1.1rem 1.2rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: background 0.12s;
	}
	.game-card.status-play:hover {
		background: #f7f0d8;
	}
	.game-card.status-locked {
		opacity: 0.72;
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.game-icon {
		font-size: 1.45rem;
		line-height: 1;
		color: var(--sol-base0);
	}
	.status-badge {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		padding: 0.18rem 0.5rem;
		border-radius: 3px;
		font-weight: 600;
	}
	.status-play .status-badge {
		background: var(--sol-green);
		color: var(--sol-base3);
	}
	.status-soon .status-badge {
		background: var(--sol-base2);
		color: var(--sol-base0);
		border: 1px solid var(--sol-base1);
	}
	.status-locked .status-badge {
		background: var(--sol-base2);
		color: var(--sol-base1);
	}

	.game-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.2rem;
		color: var(--sol-base01);
		margin: 0;
	}
	.game-tagline {
		font-family: var(--font-body);
		font-size: 0.84rem;
		line-height: 1.5;
		color: var(--sol-base0);
		margin: 0;
		flex: 1;
	}

	/* ── active game screen ───────────────────────────────────────────────── */
	.active-game {
		background:
			linear-gradient(180deg, rgba(238, 232, 213, 0.62), transparent 8rem),
			var(--sol-base3);
		border-top: 1px solid var(--sol-base2);
		min-height: 36rem;
	}
	.active-head {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1.4rem;
		background: var(--sol-base2);
		border-bottom: 2px solid var(--sol-blue);
	}
	.back-to-games {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sol-base3);
		background: var(--sol-base0);
		border-radius: 3px;
		padding: 0.34rem 0.7rem;
		white-space: nowrap;
	}
	.back-to-games:hover {
		background: var(--sol-base00);
	}
	.active-kicker {
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--sol-base1);
		margin: 0 0 0.08rem;
	}
	.active-head h3 {
		font-family: var(--font-counter);
		font-weight: 400;
		font-size: 1.65rem;
		line-height: 1;
		color: var(--sol-base01);
		margin: 0;
	}

	/* ── card footer ────────────────────────────────────────────────────── */
	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin-top: 0.3rem;
		flex-wrap: wrap;
	}
	.tag-row {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}
	.tag {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sol-cyan);
		border: 1px solid var(--sol-cyan);
		border-radius: 2px;
		padding: 0.1rem 0.38rem;
	}
	.play-btn {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		background: var(--sol-blue);
		color: var(--sol-base3);
		border-radius: 3px;
		padding: 0.28rem 0.7rem;
		white-space: nowrap;
		transition: background 0.1s;
	}
	.play-btn:hover {
		background: var(--sol-violet);
	}
	.play-placeholder {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--sol-base1);
		font-style: italic;
		text-align: right;
	}
	.locked-hint {
		color: var(--sol-orange);
		font-style: normal;
		font-size: 0.64rem;
	}

	/* ── footer note ────────────────────────────────────────────────────── */
	.arcade-note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--sol-base1);
		text-align: center;
		padding: 0.9rem 1.4rem;
		margin: 0;
		border-top: 1px solid var(--sol-base2);
	}
	@media (max-width: 560px) {
		.active-head {
			grid-template-columns: 1fr;
		}
		.back-to-games {
			justify-self: start;
		}
	}
</style>
