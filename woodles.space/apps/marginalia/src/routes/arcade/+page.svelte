<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { book, fmt } from '$lib/witch/book.svelte';
	import { startTick, stopTick } from '$lib/witch/tick';
	import Arcade from '$lib/arcade/Arcade.svelte';
	import ActivePetPanel from '$lib/arcade/ActivePetPanel.svelte';
	import type { BestiaryCreature } from '$lib/witch/bestiaryDb';

	let activeGame = $state<string | null>(null);
	let activePet = $state<BestiaryCreature | null>(null);

	function onFocus() {
		void book.refreshBestiaryCreatures();
	}

	function persist() {
		book.persist();
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
			<p>side room</p>
			<h1>arcade</h1>
		</div>
		<div class="meters" aria-label="current book resources">
			<span><b>{fmt(book.insight)}</b> insight</span>
			<span><b>{book.essence}</b> essence</span>
			<span><b>{Math.round(book.favor)}</b> favor</span>
		</div>
	</header>

	<main class="arcade-layout">
		<section class="game-column" aria-label="arcade games">
			<Arcade {activePet} bestiaryCreatures={book.bestiaryCreatures} onactivechange={(gameId) => (activeGame = gameId)} />
		</section>
		<ActivePetPanel locked={activeGame !== null} onpetchange={(pet) => (activePet = pet)} />
	</main>
</div>

<style>
	.arcade-page {
		min-height: 100vh;
		padding: 1rem clamp(0.8rem, 3vw, 2rem) 3rem;
		background:
			radial-gradient(circle at 12% 8%, rgba(108, 229, 232, 0.12), transparent 22rem),
			radial-gradient(circle at 88% 12%, rgba(240, 143, 184, 0.1), transparent 24rem),
			var(--bg);
	}
	.arcade-top {
		width: min(100%, 76rem);
		margin: 0 auto 1rem;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
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
		text-align: center;
	}
	.room-title p {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--leafeon-pink);
	}
	.room-title h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.1rem, 7vw, 4.2rem);
		line-height: 0.95;
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
		font-size: 1.1rem;
		line-height: 1;
		color: var(--cyan);
		font-weight: 400;
		letter-spacing: 0;
	}
	.arcade-layout {
		width: min(100%, 76rem);
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
		gap: 1rem;
		align-items: start;
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
		.arcade-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
