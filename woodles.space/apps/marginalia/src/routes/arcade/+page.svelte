<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { book, fmt } from '$lib/witch/book.svelte';
	import { startTick, stopTick } from '$lib/witch/tick';
	import { resourceGains, type ResourceGain } from '$lib/witch/resourceGains.svelte';
	import { arcadeNotices, type ArcadeNotice } from '$lib/arcade/arcadeNotices.svelte';
	import Arcade from '$lib/arcade/Arcade.svelte';
	import ActivePetPanel from '$lib/arcade/ActivePetPanel.svelte';
	import type { BestiaryCreature } from '$lib/witch/bestiaryDb';

	let activeGame = $state<string | null>(null);
	let activePet = $state<BestiaryCreature | null>(null);
	let theaterMode = $state(false);

	// resource-gain popups, anchored to the meter they belong to. Seeded to
	// the queue's current tail so a fresh mount doesn't replay stale gains.
	let activeGains = $state<ResourceGain[]>([]);
	let lastSeenGainId = resourceGains.length ? resourceGains[resourceGains.length - 1].id : 0;
	let gainTimers: ReturnType<typeof setTimeout>[] = [];

	function gainsFor(kind: ResourceGain['kind']) {
		return activeGains.filter((g) => g.kind === kind);
	}

	$effect(() => {
		const fresh = resourceGains.filter((g) => g.id > lastSeenGainId);
		if (fresh.length === 0) return;
		lastSeenGainId = resourceGains[resourceGains.length - 1].id;
		for (const gain of fresh) {
			activeGains = [...activeGains, gain];
			const timer = setTimeout(() => {
				activeGains = activeGains.filter((g) => g.id !== gain.id);
			}, 1100);
			gainTimers.push(timer);
		}
	});

	// short-lived toolbar banners — e.g. "today's plays are spent" — same
	// queue-and-seed pattern as the gain popups above, just longer-lived
	// since they carry a sentence instead of a number.
	let activeNotices = $state<ArcadeNotice[]>([]);
	let lastSeenNoticeId = arcadeNotices.length ? arcadeNotices[arcadeNotices.length - 1].id : 0;
	let noticeTimers: ReturnType<typeof setTimeout>[] = [];

	$effect(() => {
		const fresh = arcadeNotices.filter((n) => n.id > lastSeenNoticeId);
		if (fresh.length === 0) return;
		lastSeenNoticeId = arcadeNotices[arcadeNotices.length - 1].id;
		for (const notice of fresh) {
			activeNotices = [...activeNotices, notice];
			const timer = setTimeout(() => {
				activeNotices = activeNotices.filter((n) => n.id !== notice.id);
			}, 4000);
			noticeTimers.push(timer);
		}
	});

	function onFocus() {
		void book.refreshBestiaryCreatures();
	}

	function persist() {
		book.persist();
	}

	function setActiveGame(gameId: string | null) {
		activeGame = gameId;
		if (!gameId) theaterMode = false;
		if (gameId) {
			stopTick();
			book.persist();
		} else {
			startTick();
		}
	}

	function setTheaterMode(enabled: boolean) {
		theaterMode = enabled;
	}

	onMount(() => {
		book.hydrate();
		void book.refreshBestiaryCreatures();
		startTick();
		window.addEventListener('beforeunload', persist);
		window.addEventListener('focus', onFocus);
	});

	onDestroy(() => {
		stopTick();
		for (const timer of gainTimers) clearTimeout(timer);
		for (const timer of noticeTimers) clearTimeout(timer);
		if (typeof window !== 'undefined') {
			window.removeEventListener('beforeunload', persist);
			window.removeEventListener('focus', onFocus);
			book.persist();
		}
	});
</script>

<svelte:head>
	<title>arcade · marginalia</title>
</svelte:head>

<div class="arcade-page">
	<header class="arcade-top">
		<a class="brand" href="/marginalia">marginalia</a>
		<div class="room-title">
			<span class="room-kicker">side room</span>
			<h1>arcade</h1>
		</div>
		<div class="meters" aria-label="current book resources">
			<span class="meter">
				<b>{fmt(book.insight)}</b> insight
				{#if book.insightPerSec > 0.05}
					<span class="rate">· {fmt(book.insightPerSec)}/s</span>
				{/if}
				{#each gainsFor('insight') as gain (gain.id)}
					<b class="gain-pop" class:trickle={gain.tone === 'trickle'} aria-hidden="true">
						+{gain.amount}
					</b>
				{/each}
			</span>
			<span class="meter">
				<b>{book.essence}</b> essence
				{#each gainsFor('essence') as gain (gain.id)}
					<b class="gain-pop essence" aria-hidden="true">+{gain.amount}</b>
				{/each}
			</span>
			<span class="meter"><b>{Math.round(book.favor)}</b> favor</span>
			</div>
			<div class="notice-stack">
				{#each activeNotices as notice (notice.id)}
					<p class="arcade-notice">{notice.text}</p>
				{/each}
			</div>
	</header>

	<main class="arcade-layout" class:playing={activeGame !== null} class:theater={theaterMode}>
		<section class="game-column" aria-label="arcade games">
			<Arcade
				{activePet}
				bestiaryCreatures={book.bestiaryCreatures}
				onactivechange={setActiveGame}
				ontheaterchange={setTheaterMode}
			/>
		</section>
		<aside class="companion-column" class:theater-hidden={theaterMode} aria-hidden={theaterMode}>
			<ActivePetPanel locked={activeGame !== null} onpetchange={(pet) => (activePet = pet)} />
		</aside>
	</main>
</div>

<style>
	.arcade-page {
		min-height: 100vh;
		padding: 1rem clamp(0.8rem, 3vw, 2rem) 3rem;
		background:
			radial-gradient(circle at 12% 8%, rgba(95, 122, 82, 0.12), transparent 22rem),
			radial-gradient(circle at 88% 12%, rgba(184, 80, 108, 0.1), transparent 24rem),
			var(--bg);
	}
	.arcade-top {
		position: sticky;
		top: 0;
		z-index: 20;
		width: min(100%, 76rem);
		margin: 0 auto 0.75rem;
		padding: 0.4rem 0;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		background: var(--bg);
		border-bottom: 1px solid var(--rule);
	}
	.brand {
		justify-self: start;
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
		text-decoration: none;
	}
	.brand:hover {
		color: var(--cyan);
	}
	.room-title {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		white-space: nowrap;
	}
	.room-kicker {
		font-family: var(--font-ui);
		font-size: 0.56rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--leafeon-pink);
	}
	.room-title h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.05rem, 2.4vw, 1.4rem);
		line-height: 1;
		color: var(--cream);
	}
	.meters {
		justify-self: end;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.7rem;
		flex-wrap: wrap;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.meters b {
		font-family: var(--font-counter);
		font-size: 1.2rem;
		line-height: 1;
		color: var(--cyan);
		font-weight: 400;
		letter-spacing: 0;
	}
	.meter {
		position: relative;
	}
	.rate {
		font-size: 0.55rem;
		letter-spacing: 0.08em;
		opacity: 0.75;
	}
	.meters .gain-pop {
		position: absolute;
		left: 50%;
		bottom: 100%;
		margin-bottom: 0.15rem;
		font-size: 0.95rem;
		color: var(--cyan);
		white-space: nowrap;
		pointer-events: none;
		animation: gain-pop-up 1.1s ease-out forwards;
	}
	.gain-pop.essence {
		color: var(--leafeon-pink);
	}
	.gain-pop.trickle {
		font-size: 0.78rem;
		opacity: 0.8;
	}
	@keyframes gain-pop-up {
		0% {
			opacity: 0;
			transform: translate(-50%, 0.3rem);
		}
		20% {
			opacity: 1;
			transform: translate(-50%, 0);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -0.85rem);
		}
	}
	.notice-stack {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0.4rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.4rem;
		z-index: 21;
		pointer-events: none;
	}
	.arcade-notice {
		margin: 0;
		padding: 0.4rem 0.7rem;
		max-width: 20rem;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.02em;
		line-height: 1.4;
		text-align: right;
		color: var(--text);
		background: var(--panel);
		border: 1px solid var(--rule);
		border-radius: 0.4rem;
		box-shadow: 0 4px 14px rgba(52, 40, 29, 0.12);
		animation: notice-pop 4s ease-out forwards;
	}
	@keyframes notice-pop {
		0% {
			opacity: 0;
			transform: translateY(-0.3rem);
		}
		8% {
			opacity: 1;
			transform: translateY(0);
		}
		85% {
			opacity: 1;
			transform: translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateY(-0.2rem);
		}
	}
	.arcade-layout {
		width: min(100%, 76rem);
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
		gap: 1rem;
		align-items: start;
	}
	.arcade-layout.playing {
		width: min(100%, 96rem);
		grid-template-columns: minmax(0, 1fr) minmax(17rem, 20rem);
	}
	.arcade-layout.playing.theater {
		width: min(100%, 92rem);
		grid-template-columns: minmax(0, 1fr);
	}
	.companion-column.theater-hidden {
		display: none;
	}
	.game-column {
		min-width: 0;
	}

	@media (max-width: 900px) {
		.arcade-top {
			grid-template-columns: 1fr;
			justify-items: center;
		}
		.brand,
		.meters {
			justify-self: center;
		}
		.meters {
			justify-content: center;
		}
		.notice-stack {
			right: 50%;
			transform: translateX(50%);
			align-items: center;
		}
		.arcade-notice {
			text-align: center;
		}
		.arcade-layout {
			grid-template-columns: 1fr;
		}
		.arcade-layout.playing {
			grid-template-columns: 1fr;
		}
	}
</style>
