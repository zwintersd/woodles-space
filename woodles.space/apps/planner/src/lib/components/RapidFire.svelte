<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { RAPID_PICK_LIMITS, RAPID_SIZES, RAPID_SLOTS, RAPID_SLOTS_NARROW, atLimit, pick, startRound, toEndorsement, unpick, type RapidItem, type RapidOptions, type RapidRound, type RapidSource } from '$lib/rapidFire';
	import type { MomentEndorsement } from '$lib/types';

	let { sources, options, initialKey = '', onfinish, oncancel, onsource, onoptions }: { sources: RapidSource[]; options: RapidOptions; initialKey?: string; onfinish: (endorsement: MomentEndorsement) => void; oncancel: () => void; onsource?: (key: string) => void; onoptions?: (patch: Partial<RapidOptions>) => void } = $props();

	// The motion's three jobs, in order: the flash confirms the pick, the fade
	// shows it left, and the arrival in the same slot is the one new thing to
	// look at. Kept in step with the keyframes below.
	const LEAVE_MS = 360;
	const ARRIVE_MS = 320;
	type Phase = 'idle' | 'leaving' | 'arriving';

	let chosenKey = $state('');
	let source = $derived(sources.find((entry) => entry.key === (chosenKey || initialKey)) ?? sources[0]);
	let round = $state<RapidRound | null>(null);
	/** What each slot is showing — trails `round.slots` while a pick fades out. */
	let shown = $state<(RapidItem | null)[]>([]);
	let phase = $state<Phase[]>([]);
	let announcement = $state('');
	let dealt = '';
	let settingsOpen = $state(false);
	/** Settings that shape the deal changed under a round with picks in it. */
	let pendingDeal = $state(false);
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 600px)').matches;

	function later(run: () => void, ms: number): void {
		const timer = setTimeout(() => { timers.delete(timer); run(); }, ms);
		timers.add(timer);
	}
	onDestroy(() => timers.forEach(clearTimeout));

	function deal(items: readonly RapidItem[]): void {
		timers.forEach(clearTimeout);
		timers.clear();
		round = startRound(items, options.size || (narrow() ? RAPID_SLOTS_NARROW : RAPID_SLOTS), Math.random, { shuffle: options.shuffle, refill: options.refill });
		pendingDeal = false;
		shown = [...round.slots];
		phase = round.slots.map(() => 'idle');
		announcement = '';
	}
	// Deal once per source and per shape of deal. The shelf can refresh under an
	// open round; reshuffling then would move every chip the person is in the
	// middle of reading. A settings change redeals only a round nothing has been
	// picked from — otherwise it waits for the next one rather than drop picks.
	$effect(() => {
		const key = source?.key ?? '';
		const shape = `${key}|${options.size}|${options.shuffle}|${options.refill}`;
		if (shape === dealt) return;
		untrack(() => {
			if (key === dealt.split('|')[0] && round?.picks.length) { pendingDeal = true; return; }
			dealt = shape;
			if (source) deal(source.items); else round = null;
		});
	});
	function redeal(): void {
		if (!source) return;
		dealt = `${source.key}|${options.size}|${options.shuffle}|${options.refill}`;
		deal(source.items);
	}
	let locked = $derived(Boolean(round && atLimit(round, options.maxPicks)));

	/** Bring a slot's display up to the round, fading the newcomer in. */
	function arrive(slot: number): void {
		const next = round?.slots[slot] ?? null;
		shown[slot] = next;
		if (!next || still()) { phase[slot] = 'idle'; return; }
		phase[slot] = 'arriving';
		later(() => { if (phase[slot] === 'arriving') phase[slot] = 'idle'; }, ARRIVE_MS);
	}

	function choose(slot: number): void {
		const item = shown[slot];
		if (!round || !item || locked || phase[slot] === 'leaving' || round.slots[slot]?.id !== item.id) return;
		round = pick(round, slot);
		const next = round.slots[slot];
		announcement = next ? `Picked ${item.label}. New: ${next.label}.` : `Picked ${item.label}.`;
		if (still()) { arrive(slot); return; }
		phase[slot] = 'leaving';
		later(() => arrive(slot), LEAVE_MS);
	}

	function undo(id: string): void {
		if (!round) return;
		const item = round.picks.find((entry) => entry.id === id);
		round = unpick(round, id);
		round.slots.forEach((entry, slot) => { if (phase[slot] !== 'leaving' && shown[slot]?.id !== entry?.id) arrive(slot); });
		if (item) announcement = `Put ${item.label} back.`;
	}

	function changeSource(key: string): void {
		chosenKey = key;
		onsource?.(key);
	}

	let left = $derived(round ? round.slots.filter(Boolean).length : 0);
</script>

<section class="rapid" aria-labelledby="rapid-heading" data-testid="rapid-fire">
	<header>
		<div>
			<h3 id="rapid-heading">What’s on your mind?</h3>
			<p>Tap everything that fits. Each pick makes room for another.</p>
		</div>
		{#if sources.length > 1}
			<label class="source">from
				<select value={source?.key} onchange={(event) => changeSource(event.currentTarget.value)} data-testid="rapid-fire-source">
					{#each sources as entry (entry.key)}<option value={entry.key}>{entry.title} · {entry.items.length}</option>{/each}
				</select>
			</label>
		{:else if source}<span class="source">from {source.title}</span>{/if}
		<button type="button" class="cog" aria-label="Rapid fire settings" aria-expanded={settingsOpen} aria-controls="rapid-settings" title="Settings" data-testid="rapid-fire-settings-open" onclick={() => settingsOpen = !settingsOpen}>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
		</button>
	</header>

	{#if settingsOpen}
		<form class="settings" id="rapid-settings" aria-label="Rapid fire settings" data-testid="rapid-fire-settings" onsubmit={(event) => event.preventDefault()}>
			<fieldset>
				<legend>Grid</legend>
				<label>Chips at once
					<select value={String(options.size)} onchange={(event) => onoptions?.({ size: Number(event.currentTarget.value) })} data-testid="rapid-fire-size">
						{#each RAPID_SIZES as size (size)}<option value={String(size)}>{size ? size : 'Fit the screen'}</option>{/each}
					</select>
				</label>
				<label class="check"><input type="checkbox" checked={options.shuffle} onchange={(event) => onoptions?.({ shuffle: event.currentTarget.checked })} /><span>Shuffle <small>off keeps the list’s own order</small></span></label>
			</fieldset>
			<fieldset>
				<legend>Round</legend>
				<label class="check"><input type="checkbox" checked={options.refill} data-testid="rapid-fire-refill" onchange={(event) => onoptions?.({ refill: event.currentTarget.checked })} /><span>Refill each pick <small>off shows one fixed page</small></span></label>
				<label>Pick limit
					<select value={String(options.maxPicks)} onchange={(event) => onoptions?.({ maxPicks: Number(event.currentTarget.value) })} data-testid="rapid-fire-limit">
						{#each RAPID_PICK_LIMITS as limit (limit)}<option value={String(limit)}>{limit ? limit === 1 ? '1 · a single choice' : limit : 'No limit'}</option>{/each}
					</select>
				</label>
			</fieldset>
			<fieldset>
				<legend>Record</legend>
				<label class="check"><input type="checkbox" checked={options.saveOnFinish} onchange={(event) => onoptions?.({ saveOnFinish: event.currentTarget.checked })} /><span>Save the moment when the round ends <small>off returns to the entry first</small></span></label>
				<label class="check"><input type="checkbox" checked={options.keepPassed} onchange={(event) => onoptions?.({ keepPassed: event.currentTarget.checked })} /><span>Keep what was shown but not picked <small>for comparing over time</small></span></label>
			</fieldset>
			{#if pendingDeal}<p class="pending" role="status">Grid changes start with the next round. <button type="button" class="back" onclick={redeal}>Deal again now</button></p>{/if}
		</form>
	{/if}

	{#if round && source}
		<div class="grid" role="group" aria-label={`Candidates from ${source.title}`}>
			{#each shown as item, slot (slot)}
				{#if item}
					<button type="button" class="chip {phase[slot]}" class:locked style:--chip={item.color ?? 'var(--car-gilt-rule)'} aria-disabled={locked || phase[slot] === 'leaving'} onclick={() => choose(slot)}>
						<span>{item.label}</span>
					</button>
				{:else}
					<span class="chip spent" aria-hidden="true"></span>
				{/if}
			{/each}
		</div>

		<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

		{#if round.picks.length}
			<div class="picked" data-testid="rapid-fire-picked">
				<span class="picked-kicker">picked · {round.picks.length}</span>
				{#each round.picks as item (item.id)}
					<button type="button" class="picked-chip" aria-label={`Put ${item.label} back`} title="Put back" onclick={() => undo(item.id)}>{item.label}<i aria-hidden="true">×</i></button>
				{/each}
			</div>
		{/if}

		<footer>
			<span class="tally">{#if locked}That’s your {options.maxPicks === 1 ? 'pick' : options.maxPicks}. Put one back to change it.{:else if left === 0}That’s all of them.{:else if !round.refill}One page · {round.total} in the list{:else if round.pool.length}{round.pool.length} more behind these{:else}Nothing more behind these{/if}</span>
			<button type="button" class="back" onclick={oncancel}>Back to writing</button>
			<button type="button" class="done" data-testid="rapid-fire-done" onclick={() => { if (round && source) onfinish(toEndorsement(round, source, options.keepPassed)); }}>
				{locked || left === 0 ? (options.saveOnFinish ? 'Save moment' : 'Done') : `${round.picks.length ? 'Nothing left fits' : 'Nothing fits'} · ${options.saveOnFinish ? 'save' : 'done'}`}
			</button>
		</footer>
	{:else}
		<p class="none">Nothing to pick from yet.</p>
		<footer><button type="button" class="back" onclick={oncancel}>Back to writing</button></footer>
	{/if}
</section>

<style>
	.rapid { border: 1px solid #44365b2b; border-left: 3px solid var(--sample-color, var(--car-gilt-rule)); border-radius: 0.3rem 0.3rem 0.9rem 0.3rem; background: #fffaf0; box-shadow: inset 0 2px 5px #44365b0c; padding: 0.9rem; }
	header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.8rem; }
	h3 { margin: 0; color: var(--car-ink); font: 400 clamp(1.4rem, 2.2vw, 1.9rem)/1.1 var(--car-fell); }
	header p { margin: 0.25rem 0 0; color: var(--car-ink-soft); font: 0.75rem var(--car-body); }
	.source { display: inline-flex; align-items: center; gap: 0.4rem; flex: none; max-width: 50%; color: var(--car-ink-soft); font: 0.7rem var(--car-body); }
	select { min-width: 0; max-width: 12rem; min-height: 2rem; border: 1px solid #44365b33; border-radius: 0.4rem; background: #ffffff90; padding: 0.25rem 0.4rem; color: var(--car-ink); font: 0.75rem var(--car-body); }

	.cog { display: inline-grid; place-items: center; flex: none; width: 2rem; height: 2rem; border: 1px solid #44365b2b; border-radius: 50%; background: #ffffff60; padding: 0; color: var(--car-ink-soft); cursor: pointer; }
	.cog:hover, .cog[aria-expanded='true'] { color: var(--car-ink); background: #ffffffb0; }
	.settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.6rem 1rem; margin-bottom: 0.8rem; border: 1px dashed #44365b40; border-radius: 0.5rem; background: #ffffff70; padding: 0.7rem 0.8rem; color: var(--car-ink); font: 0.75rem var(--car-body); }
	fieldset { display: grid; align-content: start; gap: 0.45rem; min-width: 0; margin: 0; border: 0; padding: 0; }
	legend { margin-bottom: 0.35rem; padding: 0; color: var(--car-ink-soft); font: 0.58rem var(--car-mono); letter-spacing: 0.1em; text-transform: uppercase; }
	.settings label { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; min-height: 2rem; }
	.settings .check { justify-content: flex-start; align-items: flex-start; cursor: pointer; }
	.settings input { width: 1rem; height: 1rem; margin: 0.1rem 0 0; flex: none; accent-color: #8e2849; }
	.settings small { display: block; color: var(--car-ink-soft); font-size: 0.68rem; }
	.pending { grid-column: 1 / -1; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin: 0; color: var(--car-ink-soft); }
	.chip.locked { opacity: 0.5; cursor: default; }
	.chip.locked.idle:hover { transform: none; border-color: #44365b2b; border-left-color: var(--chip); }

	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.25rem, 1fr)); gap: 0.45rem; }
	.chip { display: flex; align-items: center; min-width: 0; min-height: 2.9rem; border: 1px solid #44365b2b; border-left: 3px solid var(--chip); border-radius: 0.35rem 0.75rem 0.35rem 0.75rem; background: #ffffffa8; box-shadow: 0 2px 0 #44365b18; padding: 0.35rem 0.6rem; color: var(--car-ink); font: 0.82rem/1.2 var(--car-body); text-align: left; cursor: pointer; transition: transform 140ms ease, border-color 140ms ease; }
	.chip span { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
	.chip.idle:hover { transform: translateY(-1px); border-color: var(--car-ink-soft); border-left-color: var(--chip); }
	.chip.spent { border-style: dashed; border-left-width: 1px; background: transparent; box-shadow: none; opacity: 0.35; cursor: default; }
	.chip.leaving { cursor: default; animation: rapid-leave 360ms ease-in forwards; }
	.chip.arriving { animation: rapid-arrive 320ms ease-out; }
	/* Flash, hold, then go: confirmation first, departure second. */
	@keyframes rapid-leave {
		0% { background: #ffffffa8; transform: scale(1); opacity: 1; }
		22%, 50% { background: #f0d48a; border-color: #b8862b; box-shadow: 0 0 0 3px #e7ba6955; transform: scale(1.04); opacity: 1; }
		100% { background: #f0d48a; transform: scale(0.96); opacity: 0; }
	}
	/* The ring is the only thing moving on the grid, so the eye lands on it. */
	@keyframes rapid-arrive {
		0% { opacity: 0; transform: translateY(5px); box-shadow: 0 0 0 3px #e7ba6900; }
		55% { opacity: 1; transform: none; box-shadow: 0 0 0 3px #e7ba6966; }
		100% { box-shadow: 0 0 0 3px #e7ba6900; }
	}

	.picked { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; margin-top: 0.8rem; border-top: 1px dashed #44365b40; padding-top: 0.65rem; }
	.picked-kicker { color: var(--car-ink-soft); font: 0.58rem var(--car-mono); letter-spacing: 0.1em; text-transform: uppercase; margin-right: 0.2rem; }
	.picked-chip { display: inline-flex; align-items: center; gap: 0.35rem; min-height: 1.75rem; border: 1px solid #b8862b70; border-radius: 1rem; background: #f0d48a55; padding: 0.15rem 0.55rem; color: var(--car-ink); font: 0.72rem var(--car-body); cursor: pointer; }
	.picked-chip i { color: var(--car-ink-soft); font-style: normal; }

	footer { display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.85rem; }
	.tally { margin-right: auto; color: var(--car-ink-soft); font: 0.7rem var(--car-body); }
	.back { border: 1px solid #44365b2b; border-radius: 0.5rem; background: #ffffff60; padding: 0.45rem 0.6rem; color: var(--car-ink); font: 0.7rem var(--car-body); cursor: pointer; }
	.done { border: 1px solid #6a1831; border-radius: 0.4rem 0.4rem 0.9rem 0.4rem; background: linear-gradient(145deg, #8e2849, #65213d); box-shadow: inset 0 0 0 2px #e7ba6950, 0 3px 0 #4a1931; padding: 0.7rem 1.1rem; color: var(--car-paper); font: 0.7rem var(--car-body); white-space: nowrap; cursor: pointer; }
	.none { color: var(--car-ink-soft); font: 0.8rem var(--car-body); }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
	@media (max-width: 600px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } header { flex-wrap: wrap; } header > div { flex-basis: 100%; } .source { max-width: calc(100% - 3rem); margin-right: auto; } }
	@media (prefers-reduced-motion: reduce) { .chip { transition: none; } .chip.leaving, .chip.arriving { animation: none; } .chip.idle:hover { transform: none; } }
</style>
