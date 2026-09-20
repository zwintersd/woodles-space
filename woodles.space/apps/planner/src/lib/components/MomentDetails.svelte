<script lang="ts">
	import { tick } from 'svelte';
	import { DETAIL_FIELDS, hasDetail, suggestMomentDetails, type DetailKey } from '$lib/momentDetails';
	import type { IntervalObservation, MomentDetails } from '$lib/types';
	let { details = $bindable<MomentDetails>({}), text, tagName, date, start, previous, onchange } : {
		details: MomentDetails; text: string; tagName?: string; date: string; start: string;
		previous: IntervalObservation[]; onchange: () => void;
	} = $props();
	let active = $state<DetailKey | null>(null);
	let dismissed = $state<DetailKey[]>([]);
	let browsing = $state(false);
	let quiet = $state(false);
	let field = $derived(DETAIL_FIELDS.find(f => f.key === active));
	let answered = $derived(DETAIL_FIELDS.filter(f => hasDetail(details, f.key)));
	let offers = $derived(suggestMomentDetails({ text, tagName, details, date, start, previous, dismissed }));
	async function open(key: DetailKey) {
		active = key; browsing = false;
		await tick();
		document.querySelector<HTMLElement>('#moment-detail-editor button, #moment-detail-editor textarea')?.focus();
	}
	function clear(key: DetailKey) {
		const next = { ...details }; delete next[key]; details = next;
		dismissed = [...dismissed, key]; active = null; onchange();
	}
</script>

<section class="moment-details" aria-label="Optional moment details">
	{#if answered.length}<div class="recorded" aria-label="Details added">
		{#each answered as item (item.key)}<button type="button" onclick={() => open(item.key)}>{item.title}{item.scale ? ` · ${item.scale[Number(details[item.key]) - 1]}` : ' ✓'}</button>{/each}
	</div>{/if}
	{#if !active && !quiet && offers.length}
		<div class="offer-heading"><span>Worth adding?</span><button type="button" onclick={() => quiet = true}>Hide suggestions</button></div>
		<div class="offers">{#each offers as offer (offer.key)}
			<div class="offer" data-testid="detail-offer">
				<button type="button" class="offer-main" onclick={() => open(offer.key)}><strong>Add {DETAIL_FIELDS.find(f => f.key === offer.key)?.title.toLowerCase()}</strong><small>{offer.reason}</small></button>
				<button type="button" class="dismiss" aria-label={`Dismiss ${offer.key} suggestion`} onclick={() => dismissed = [...dismissed, offer.key]}>×</button>
			</div>
		{/each}</div>
	{/if}
	{#if field}<div class="detail-panel" id="moment-detail-editor">
		<p id="detail-question">{field.question}</p>
		{#if field.scale}<div class="rating" role="group" aria-labelledby="detail-question">
			{#each field.scale as label, index}<button type="button" aria-pressed={details[field.key] === index + 1} onclick={() => { details = { ...details, [field.key]: index + 1 }; onchange(); }}>{label}</button>{/each}
		</div>{:else}<textarea aria-labelledby="detail-question" rows="2" placeholder={field.placeholder} value={details[field.key] ?? ''} oninput={event => { details = { ...details, [field.key]: event.currentTarget.value }; onchange(); }}></textarea>{/if}
		<div class="panel-actions"><small>Included when you save this moment.</small><button type="button" onclick={() => active = null}>Done</button>{#if hasDetail(details, field.key)}<button type="button" onclick={() => clear(field!.key)}>Remove detail</button>{/if}</div>
	</div>{/if}
	<details bind:open={browsing} class="detail-menu">
		<summary>More details <small>optional</small></summary>
		<p>Only log what feels useful. Blank fields stay unrecorded.</p>
		<div class="choices">{#each DETAIL_FIELDS as item}<button type="button" onclick={() => open(item.key)}>{item.title}{hasDetail(details, item.key) ? ' ✓' : ''}</button>{/each}</div>
		{#if quiet || dismissed.length}<button class="reset" type="button" onclick={() => { quiet = false; dismissed = []; browsing = false; }}>Show suggestions again</button>{/if}
	</details>
</section>

<style>
	.moment-details { margin-top: 0.8rem; border-top: 1px solid #44365b22; padding-top: 0.65rem; }
	button { cursor: pointer; border: 1px solid #44365b30; background: #ffffff70; border-radius: 0.5rem; color: var(--car-ink); padding: 0.4rem 0.55rem; font: 0.75rem var(--car-body); }
	button:active { transform: translateY(1px); }
	button:focus-visible, summary:focus-visible, textarea:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
	.recorded, .choices { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.recorded { margin-bottom: 0.5rem; }
	.recorded button { background: var(--car-pink-wash); border-radius: 99px; }
	.offer-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.75rem; margin-bottom: 0.4rem; }
	.offer-heading button { background: transparent; border: 0; font-size: 0.65rem; }
	.offers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
	.offer { display: flex; border: 1px dashed #44365b40; border-radius: 0.5rem; background: #ffffff40; }
	.offer-main { flex: 1; min-width: 0; text-align: left; border: 0; background: transparent; }
	.offer-main strong { display: block; font-weight: 500; margin-bottom: 0.2rem; }
	small { font-size: 0.68rem; color: var(--car-ink-soft); line-height: 1.4; }
	.dismiss { border: 0; align-self: start; background: transparent; min-width: 2rem; min-height: 2rem; }
	.detail-panel { padding: 0.75rem; background: #ffffff70; border: 1px solid #44365b25; border-radius: 0.65rem; animation: appear 160ms ease-out; }
	.detail-panel p { font-size: 0.85rem; margin-bottom: 0.6rem; }
	.rating { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.3rem; }
	.rating button { min-width: 0; min-height: 2.8rem; padding: 0.4rem 0.15rem; font-size: 0.7rem; box-shadow: 0 2px 0 #44365b20; }
	.rating button[aria-pressed='true'] { background: var(--car-pink-wash); border-color: var(--car-pink-dark); box-shadow: inset 0 2px 3px #44365b22; }
	textarea { width: 100%; resize: vertical; background: #ffffff80; color: var(--car-ink); border: 1px solid #44365b30; padding: 0.5rem; border-radius: 0.45rem; font: 0.9rem/1.4 var(--car-body); }
	.panel-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
	.panel-actions small { margin-right: auto; }
	.detail-menu { margin-top: 0.6rem; font-size: 0.75rem; }
	summary { cursor: pointer; padding: 0.25rem 0; }
	summary small { margin-left: 0.3rem; }
	.detail-menu p { color: var(--car-ink-soft); margin: 0.5rem 0; }
	.reset { margin-top: 0.5rem; }
	@keyframes appear { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
	@media (max-width: 500px) { .offers { grid-template-columns: 1fr; } }
	@media (prefers-reduced-motion: reduce) { .detail-panel { animation: none; } button:active { transform: none; } }
</style>
