<script lang="ts">
	import ArenaSpike from '$lib/arena/ArenaSpike.svelte';
</script>

<svelte:head>
	<title>arena · marginalia</title>
</svelte:head>

<div class="arena-page">
	<header class="arena-top">
		<a class="brand" href="/marginalia">marginalia</a>
		<div class="room-title">
			<span class="room-kicker">a separate room</span>
			<h1>arena</h1>
		</div>
	</header>
	<main class="arena-stage">
		<ArenaSpike />
	</main>
</div>

<style>
	.arena-page {
		min-height: 100vh;
		padding: 1rem clamp(0.8rem, 3vw, 2rem) 3rem;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.arena-top {
		width: min(100%, 840px);
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.4rem 0 1rem;
	}
	.brand {
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
	.arena-stage {
		width: min(100%, 840px);
		display: flex;
		justify-content: center;
	}
</style>
