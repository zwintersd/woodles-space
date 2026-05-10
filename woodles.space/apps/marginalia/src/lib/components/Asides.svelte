<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { game, fmt } from '$lib/state/game.svelte';
	import { pickAside, asideReward } from '$lib/content/asides';

	// Fragments drift from right to left across a slim strip. Click captures
	// one for a small payout in glosses. Spawn cadence eases up as the player
	// clicks more, so the strip never overcrowds.

	const STRIP_HEIGHT_PX = 38;
	const SPEED_PX_MS = 0.04;             // slow drift, easy to read and click
	const MIN_SPAWN_MS = 6_000;           // baseline gap between spawns
	const MAX_SPAWN_MS = 11_000;
	const MAX_ON_SCREEN = 3;
	const FADE_MS = 420;

	interface Fragment {
		id: number;
		text: string;
		// position from the right edge of the strip, in px
		spawnedAt: number;
		// stable y inside the strip
		y: number;
		// 'live' = drifting, 'caught' = clicked (animate out), 'gone' = stale
		state: 'live' | 'caught';
		caughtAt?: number;
		caughtGain?: number;
	}

	let stripEl: HTMLDivElement | undefined = $state();
	let stripWidth = $state(560);
	let fragments = $state<Fragment[]>([]);
	let nextId = 0;
	let now = $state(performance.now());
	let nextSpawnAt = 0;
	let rafId = 0;

	function spawnIfDue(ts: number) {
		if (fragments.filter((f) => f.state === 'live').length >= MAX_ON_SCREEN) return;
		if (ts < nextSpawnAt) return;
		const text = pickAside();
		fragments.push({
			id: ++nextId,
			text,
			spawnedAt: ts,
			y: 6 + ((Math.random() * (STRIP_HEIGHT_PX - 22)) | 0),
			state: 'live'
		});
		nextSpawnAt = ts + MIN_SPAWN_MS + Math.random() * (MAX_SPAWN_MS - MIN_SPAWN_MS);
	}

	function tick(ts: number) {
		now = ts;
		spawnIfDue(ts);

		// cull caught fragments after fade duration; cull live fragments that
		// have drifted past the left edge.
		const surv: Fragment[] = [];
		for (const f of fragments) {
			if (f.state === 'caught') {
				if (ts - (f.caughtAt ?? ts) < FADE_MS) surv.push(f);
				continue;
			}
			const x = stripWidth - (ts - f.spawnedAt) * SPEED_PX_MS;
			if (x > -180) surv.push(f);
		}
		fragments = surv;

		rafId = requestAnimationFrame(tick);
	}

	function fragmentX(f: Fragment): number {
		return stripWidth - (now - f.spawnedAt) * SPEED_PX_MS;
	}

	function capture(f: Fragment) {
		if (f.state !== 'live') return;
		const reward = asideReward(f.text);
		f.state = 'caught';
		f.caughtAt = now;
		f.caughtGain = reward;
		game.gainStrayGloss(reward, f.text);
	}

	let resizeObserver: ResizeObserver | undefined;

	onMount(() => {
		if (stripEl) {
			stripWidth = stripEl.clientWidth || stripWidth;
			resizeObserver = new ResizeObserver((entries) => {
				stripWidth = entries[0]?.contentRect.width ?? stripWidth;
			});
			resizeObserver.observe(stripEl);
		}
		// small intro pause so the very first fragment doesn't appear with the page
		nextSpawnAt = performance.now() + 2500;
		rafId = requestAnimationFrame(tick);
	});

	onDestroy(() => {
		cancelAnimationFrame(rafId);
		resizeObserver?.disconnect();
	});

	const liveCount = $derived(fragments.filter((f) => f.state === 'live').length);
</script>

<div class="asides" aria-label="stray phrases — click to capture">
	<span class="ledger" aria-hidden="true">stray phrases</span>
	<div class="strip" bind:this={stripEl}>
		{#each fragments as f (f.id)}
			{@const x = fragmentX(f)}
			{#if f.state === 'live' && x > -180 && x < stripWidth + 20}
				<button
					class="frag"
					type="button"
					style="left: {x}px; top: {f.y}px"
					onclick={() => capture(f)}
				>{f.text}</button>
			{:else if f.state === 'caught'}
				{@const age = now - (f.caughtAt ?? now)}
				{@const op = Math.max(0, 1 - age / FADE_MS)}
				<span
					class="frag caught"
					style="left: {fragmentX(f)}px; top: {f.y}px; opacity: {op.toFixed(3)}"
					aria-hidden="true"
				>+{fmt(f.caughtGain ?? 0)}</span>
			{/if}
		{/each}
	</div>
	{#if liveCount === 0}
		<span class="empty" aria-hidden="true">— quiet —</span>
	{/if}
</div>

<style>
	.asides {
		position: relative;
		max-width: 44rem;
		margin: 0.4rem auto 0.6rem;
		padding: 0 1rem;
	}

	.ledger {
		display: block;
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--rule);
		text-align: center;
		margin-bottom: 0.2rem;
	}

	.strip {
		position: relative;
		height: 38px;
		overflow: hidden;
		border-top: 1px dashed var(--rule);
		border-bottom: 1px dashed var(--rule);
	}

	.frag {
		position: absolute;
		white-space: nowrap;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.92rem;
		line-height: 1;
		color: var(--muted);
		background: none;
		border: 1px dashed transparent;
		border-radius: 3px;
		padding: 2px 6px;
		cursor: pointer;
		transition: color 120ms ease, border-color 120ms ease;
	}

	.frag:hover {
		color: var(--cyan);
		border-color: var(--cyan);
	}

	.frag.caught {
		font-family: var(--font-counter);
		font-style: normal;
		color: var(--leafeon-pink);
		pointer-events: none;
		border: none;
		padding: 2px 0;
	}

	.empty {
		position: absolute;
		left: 50%;
		top: calc(50% + 2px);
		transform: translate(-50%, -50%);
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--rule);
		pointer-events: none;
	}
</style>
