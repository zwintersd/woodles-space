<script lang="ts">
	import { game, fmt } from '$lib/state/game.svelte';
	import { practices } from '$lib/content/practices';

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(t);
	});

	function cooldownLeft(id: string): number {
		const ready = game.practiceCooldowns[id] ?? 0;
		void now;
		return Math.max(0, ready - now);
	}

	const palinodeAvailable = $derived(
		game.hasUpgrade('palinode') && !game.palinodeUsedThisRun
	);
</script>

<section class="practices">
	<h3>reading practices</h3>
	<div class="row">
		{#each practices as p (p.id)}
			{@const left = cooldownLeft(p.id)}
			{@const ready = left === 0 && game.glosses >= p.cost}
			<button
				type="button"
				disabled={!ready}
				onclick={() => game.invokePractice(p.id)}
				title={p.description}
			>
				<span class="name">— {p.name} —</span>
				<span class="meta">
					{fmt(p.cost)} g
					{#if left > 0}
						· {(left / 1000).toFixed(0)}s
					{/if}
				</span>
				<span class="desc">{p.description}</span>
			</button>
		{/each}
		{#if palinodeAvailable}
			<button type="button" class="palinode" onclick={() => game.invokePalinode()}>
				<span class="name">— palinode —</span>
				<span class="meta">once per run</span>
				<span class="desc">retract everything you have written this run for a 30s ten-fold burst.</span>
			</button>
		{/if}
	</div>
</section>

<style>
	.practices {
		padding: 0 1rem;
	}
	h3 {
		font-family: var(--font-ui);
		font-weight: 500;
		font-size: 0.78rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.6rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--rule);
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.5rem;
	}
	button {
		text-align: left;
		padding: 0.55rem 0.7rem;
		border-radius: 4px;
		background: var(--panel);
		border: 1px solid transparent;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	button:hover:not(:disabled) {
		border-color: var(--cyan);
		background: var(--panel-accent);
	}
	.name {
		font-family: var(--font-display);
		color: var(--cream);
	}
	.meta {
		font-family: var(--font-counter);
		color: var(--cyan);
		font-size: 0.95rem;
	}
	.desc {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--muted);
		font-size: 0.84rem;
	}
	.palinode .name,
	.palinode:hover .name {
		color: var(--leafeon-pink);
	}
</style>
