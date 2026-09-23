<script lang="ts">
	import { ratingChanges } from '$lib/momentTrackers';
	import { DETAIL_FIELDS, detailSummary } from '$lib/momentDetails';
	import type { IntervalObservation } from '$lib/types';
	let { observations, onselect }: { observations: IntervalObservation[]; onselect: (start: string) => void } = $props();
	let filter = $state('');
	let sorted = $derived([...observations].sort((a,b) => b.intervalStart.localeCompare(a.intervalStart)));
	let visible = $derived(sorted.filter(o => `${o.label} ${o.sampleTag?.name ?? ''} ${detailSummary(o.details)} ${(o.trackerAnswers ?? []).map(a => `${a.tracker.name} ${a.value}`).join(' ')} ${Object.values(o.details ?? {}).join(' ')}`.toLowerCase().includes(filter.toLowerCase())));
	let changes = $derived(ratingChanges(observations));
</script>

<details class="review" open>
	<summary>Day so far <small>{observations.length} recorded moment{observations.length === 1 ? '' : 's'}</small></summary>
	{#if changes.length}<div class="changes" aria-label="Recorded changes today">{#each changes as change}
		{@const field = DETAIL_FIELDS.find(f => f.key === change.key)!}
		<div><strong>{field.title}</strong><span>{field.scale![change.first - 1]} → {field.scale![change.last - 1]}</span><small>{change.from}–{change.to} · {change.count} ratings</small></div>
	{/each}</div>{/if}
	{#if observations.length}<label class="search">Find a moment<input aria-label="Find a moment" bind:value={filter} placeholder="Words, labels, or details…" /></label>{/if}
	<div class="moments">{#each visible as moment (moment.id)}
		<button type="button" class="moment" onclick={() => onselect(moment.intervalStart)} aria-label={`Reopen ${moment.intervalStart}: ${moment.label}`}>
			<time>{moment.intervalStart}</time><div><strong>{moment.label}</strong>
			{#if moment.sampleTag}<span class="label" style:--label-color={moment.sampleTag.color}>{moment.sampleTag.name}</span>{/if}
			{#if detailSummary(moment.details)}<small>{detailSummary(moment.details)}</small>{/if}
			{#each moment.trackerAnswers ?? [] as a}<small>{a.tracker.name}: {typeof a.value === 'boolean' ? a.value ? 'Yes' : 'No' : a.value}{a.tracker.type === 'rating' ? '/5' : ''}</small>{/each}
			{#if moment.details?.helped}<small>Helped: {moment.details.helped}</small>{/if}
			{#if moment.details?.friction}<small>Harder: {moment.details.friction}</small>{/if}
			</div><span aria-hidden="true">↗</span>
		</button>
	{:else}<p>{observations.length ? 'No matching moments.' : 'Saved moments will appear here.'}</p>{/each}</div>
	<small class="footnote">Only recorded answers are shown. Missing ratings are not filled in.</small>
</details>

<style>
	.review { border: 1px solid var(--car-line); border-radius: .85rem; padding: .8rem 1rem; color: var(--car-cream); background: var(--car-wash); font: .8rem var(--car-body); }
	.review[open] { padding-bottom: 1rem; }
	summary { cursor: pointer; padding: .15rem 0; }
	summary small { margin-left: .5rem; }
	small { font-size: .7rem; opacity: .8; }
	.changes { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .5rem; margin-top: .75rem; }
	.changes > div { display: grid; gap: .3rem; padding: .65rem; background: var(--car-wash); border-radius: .5rem; }
	.search { display: grid; gap: .35rem; margin: .8rem 0; }
	input { min-width: 0; width: 100%; border: 1px solid var(--car-line); background: var(--car-wash); border-radius: .5rem; padding: .55rem; color: inherit; }
	.moments { max-height: 25rem; overflow: auto; margin-top: .5rem; }
	.moment { width: 100%; display: flex; gap: .65rem; align-items: start; padding: .65rem; border: 0; border-bottom: 1px solid var(--car-line); background: transparent; color: inherit; text-align: left; cursor: pointer; font: inherit; }
	.moment:hover { background: var(--car-wash); }
	.moment > div { flex: 1; min-width: 0; display: grid; gap: .25rem; overflow-wrap: anywhere; }
	time { font: .7rem var(--car-mono); }
	.label { border-left: 3px solid var(--label-color); padding-left: .4rem; font-size: .7rem; }
	.footnote { display: block; margin-top: .6rem; }
	:focus-visible { outline: 2px solid var(--car-pink); outline-offset: 2px; }
</style>
