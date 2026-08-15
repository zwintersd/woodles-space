<script lang="ts">
	import { onMount } from 'svelte';
	import { LiveWorld } from '$lib/liveWorld.svelte';
	import { exampleDef } from '$lib/exampleDef';

	const live = new LiveWorld(exampleDef);

	onMount(() => {
		live.start();
		return () => live.pause();
	});

	function formatSeconds(seconds: number): string {
		const whole = Math.floor(seconds);
		const minutes = Math.floor(whole / 60);
		const secs = whole % 60;
		return `${minutes}:${String(secs).padStart(2, '0')}`;
	}
</script>

<main>
	<p class="eyebrow">grimoire · proof of pipeline</p>
	<h1>Grimoire → @woodles/witch-engine → World.tick()</h1>
	<p class="lede">
		This page runs {exampleDef.meta.title} in the browser, ten seconds of game time per real second,
		with nothing between it and <code>@woodles/witch-engine</code>. Nothing here is tunable yet — that's
		the next step. This step is just proving the numbers actually move.
	</p>

	<div class="controls">
		<button onclick={() => (live.running ? live.pause() : live.start())}>
			{live.running ? 'Pause' : 'Resume'}
		</button>
		<span class="elapsed">{formatSeconds(live.elapsed)} elapsed</span>
	</div>

	<dl class="readout">
		<div>
			<dt>insight</dt>
			<dd>{live.insight.toFixed(1)}</dd>
		</div>
		<div>
			<dt>insight/sec</dt>
			<dd>{live.insightPerSec.toFixed(3)}</dd>
		</div>
		<div>
			<dt>favor</dt>
			<dd>{live.favor.toFixed(1)}</dd>
		</div>
		{#each Object.entries(live.stocks) as [id, value] (id)}
			<div>
				<dt>{id}</dt>
				<dd>{value.toFixed(1)}</dd>
			</div>
		{/each}
	</dl>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 3rem 1.5rem;
	}

	.eyebrow {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		margin: 0 0 0.5rem;
	}

	h1 {
		font-size: 1.5rem;
		line-height: 1.3;
		margin: 0 0 1rem;
	}

	.lede {
		color: var(--muted);
		line-height: 1.6;
		margin: 0 0 2rem;
	}

	.lede code {
		font-family: var(--font-mono, ui-monospace, monospace);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	button {
		font: inherit;
		padding: 0.5rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--rule);
		background: var(--accent);
		color: var(--lapis, var(--text));
		cursor: pointer;
	}

	.elapsed {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.85rem;
		color: var(--muted);
	}

	.readout {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 1rem;
		margin: 0;
	}

	.readout div {
		border: 1px solid var(--rule);
		border-radius: 0.5rem;
		padding: 0.75rem 0.9rem;
		background: var(--surface);
	}

	dt {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	dd {
		margin: 0.15rem 0 0;
		font-size: 1.3rem;
		font-variant-numeric: tabular-nums;
	}
</style>
