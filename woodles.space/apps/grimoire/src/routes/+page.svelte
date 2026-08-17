<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { LiveWorld } from '$lib/liveWorld.svelte';
	import { TuningState } from '$lib/tuning.svelte';
	import TuningPanel from '$lib/TuningPanel.svelte';
	import BalancePanel from '$lib/BalancePanel.svelte';
	import { world1Def } from '@woodles/witch-engine';

	const tuning = new TuningState();
	const live = new LiveWorld(tuning.def);

	onMount(() => {
		live.start();
		return () => live.pause();
	});

	// Reruns on every tuning change: `.def` walks every leaf of `tuning.groups`
	// on read, so this effect tracks all of them. Skips its own first run —
	// `live` was already built with today's tuning above. `rebuild` itself
	// reads and writes `live`'s own $state (running, elapsed, …); left
	// untracked, that read would make this effect depend on `live` too, and
	// the write inside the same run would then retrigger it — an infinite
	// loop `untrack` exists specifically to prevent.
	let mounted = false;
	$effect(() => {
		const def = tuning.def;
		if (!mounted) {
			mounted = true;
			return;
		}
		untrack(() => live.rebuild(def));
	});

	function formatSeconds(seconds: number): string {
		const whole = Math.floor(seconds);
		const minutes = Math.floor(whole / 60);
		const secs = whole % 60;
		return `${minutes}:${String(secs).padStart(2, '0')}`;
	}
</script>

<main>
	<header>
		<p class="eyebrow">grimoire · a tuning instrument for World 1</p>
		<h1>Grimoire</h1>
		<p class="lede">
			{world1Def.meta.title}, run straight off <code>@woodles/witch-engine</code> — the same engine
			apps/marginalia and the balance harness both run. Change a number below and the world on the right
			rebuilds against it immediately; run the comparison at the bottom to see what it did to the numbers
			BALANCE.md checks.
		</p>
	</header>

	<div class="layout">
		<aside class="playtest">
			<div class="playtest-head">
				<h2>Playtest</h2>
				<span class="tag">every condition pre-written</span>
			</div>
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
		</aside>

		<div class="main-column">
			<TuningPanel {tuning} />
			<BalancePanel {tuning} />
		</div>
	</div>
</main>

<style>
	main {
		max-width: 76rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}

	header {
		max-width: 44rem;
		margin-bottom: 2.5rem;
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
		font-size: 1.6rem;
		line-height: 1.3;
		margin: 0 0 1rem;
	}

	.lede {
		color: var(--muted);
		line-height: 1.6;
		margin: 0;
	}

	.lede code {
		font-family: var(--font-mono, ui-monospace, monospace);
	}

	.layout {
		display: grid;
		grid-template-columns: 17rem 1fr;
		gap: 2.5rem;
		align-items: start;
	}

	@media (max-width: 56rem) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.playtest {
		position: sticky;
		top: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 1px solid var(--rule);
		border-radius: 0.75rem;
		padding: 1.1rem;
		background: var(--surface);
	}

	.playtest-head {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.playtest-head h2 {
		font-size: 1rem;
		margin: 0;
	}

	.tag {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.68rem;
		color: var(--muted);
	}

	.main-column {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		min-width: 0;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		flex-wrap: wrap;
	}

	button {
		font: inherit;
		padding: 0.45rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--rule);
		background: var(--accent);
		color: var(--lapis, var(--text));
		cursor: pointer;
	}

	.elapsed {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.8rem;
		color: var(--muted);
	}

	.readout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		margin: 0;
	}

	.readout div {
		border: 1px solid var(--rule);
		border-radius: 0.5rem;
		padding: 0.55rem 0.65rem;
		background: var(--bg);
	}

	dt {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	dd {
		margin: 0.1rem 0 0;
		font-size: 1.1rem;
		font-variant-numeric: tabular-nums;
	}
</style>
