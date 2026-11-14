<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { RAPID_SLOTS, RAPID_SLOTS_NARROW, pick, startRound, toEndorsement, unpick, type RapidItem, type RapidRound, type RapidSource } from '$lib/rapidFire';
	import type { MomentEndorsement } from '$lib/types';

	let { sources, initialKey = '', onfinish, oncancel, onsource }: { sources: RapidSource[]; initialKey?: string; onfinish: (endorsement: MomentEndorsement) => void; oncancel: () => void; onsource?: (key: string) => void } = $props();

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
	let dealtKey = '';
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
		round = startRound(items, narrow() ? RAPID_SLOTS_NARROW : RAPID_SLOTS);
		shown = [...round.slots];
		phase = round.slots.map(() => 'idle');
		announcement = '';
	}
	// Deal once per source. The shelf can refresh under an open round; reshuffling
	// then would move every chip the person is in the middle of reading.
	$effect(() => {
		const key = source?.key ?? '';
		if (key === dealtKey) return;
		dealtKey = key;
		untrack(() => { if (source) deal(source.items); else round = null; });
	});

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
		if (!round || !item || phase[slot] === 'leaving' || round.slots[slot]?.id !== item.id) return;
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
	</header>

	{#if round && source}
		<div class="grid" role="group" aria-label={`Candidates from ${source.title}`}>
			{#each shown as item, slot (slot)}
				{#if item}
					<button type="button" class="chip {phase[slot]}" style:--chip={item.color ?? 'var(--car-gilt-rule)'} aria-disabled={phase[slot] === 'leaving'} onclick={() => choose(slot)}>
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
			<span class="tally">{#if left === 0}That’s all of them.{:else if round.pool.length}{round.pool.length} more behind these{:else}Nothing more behind these{/if}</span>
			<button type="button" class="back" onclick={oncancel}>Back to writing</button>
			<button type="button" class="done" data-testid="rapid-fire-done" onclick={() => { if (round && source) onfinish(toEndorsement(round, source)); }}>
				{left === 0 ? 'Save moment' : round.picks.length ? 'Nothing left fits · save' : 'Nothing fits · save'}
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
	@media (max-width: 600px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } header { flex-direction: column; } .source { max-width: 100%; } }
	@media (prefers-reduced-motion: reduce) { .chip { transition: none; } .chip.leaving, .chip.arriving { animation: none; } .chip.idle:hover { transform: none; } }
</style>
