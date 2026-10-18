<script lang="ts">
	import { tick } from 'svelte';
	import { DETAIL_FIELDS, hasDetail, type DetailKey } from '$lib/momentDetails';
	import type { IntervalObservation, MomentDetails, MomentNoticing, TrackerAnswer } from '$lib/types';
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { trackerOffer } from '$lib/momentTrackers';
	import { loopCandidate, suggestLoopLinks } from '$lib/loopInference';
	import PersonalTrackers from './PersonalTrackers.svelte';
	let { details = $bindable<MomentDetails>({}), answers = $bindable<TrackerAnswer[]>([]), noticings = $bindable<MomentNoticing[]>([]), linkedLoopIds = $bindable<string[]>([]), text, date, start, previous, onchange } : {
		answers: TrackerAnswer[]; noticings: MomentNoticing[]; linkedLoopIds: string[];
		details: MomentDetails; text: string; tagName?: string; date: string; start: string;
		previous: IntervalObservation[]; onchange: () => void;
	} = $props();
	const channels: { channel: MomentNoticing['channel']; title: string; question: string; placeholder: string }[] = [
		{ channel: 'body', title: 'In my body', question: 'What sensation? Where?', placeholder: 'Tight shoulders, warmth, a pit in my stomach…' },
		{ channel: 'attention', title: 'In my attention', question: 'What do you notice in your attention?', placeholder: 'Drifting, absorbed, returning to something…' },
		{ channel: 'behavior', title: 'In my actions', question: 'What do you notice in your actions?', placeholder: 'Starting, switching, resting, doing something nearby…' }
	];
	let active = $state<string | null>(null);
	let dismissedTrackers = $state<string[]>([]);
	let browsing = $state(false);
	let linking = $state(false);
	let loopTitle = $state('');
	let loopError = $state('');
	let loopTitleInput: HTMLInputElement | undefined = $state();
	let notLinks = $state<string[]>([]);
	let candidateWaved = $state('');
	// Offers read the moment's words; nothing is linked or created until a click.
	let linkOffer = $derived(suggestLoopLinks([text, ...noticings.map(n => n.note)].join(' '), store.openLoops, [...linkedLoopIds, ...noticings.flatMap(n => n.linkedLoopIds ?? []), ...notLinks])[0]);
	let candidate = $derived(linking ? null : loopCandidate(text, store.openLoops));
	const loopName = (id: string) => store.openLoops.find(loop => loop.id === id)?.title ?? 'Saved loop';
	let field = $derived(DETAIL_FIELDS.find(f => f.key === active));
	let answered = $derived(DETAIL_FIELDS.filter(f => hasDetail(details, f.key)));
	let customOffer = $derived(trackerOffer(store.settings.momentTrackers ?? [], answers, text, date, start, previous, dismissedTrackers));
	function toggleChannel(channel: MomentNoticing['channel']) {
		noticings = noticings.some(n => n.channel === channel) ? noticings.filter(n => n.channel !== channel) : [...noticings, { channel, note: '' }];
		onchange();
	}
	function noteChannel(channel: MomentNoticing['channel'], note: string) {
		noticings = noticings.map(n => n.channel === channel ? { ...n, note } : n);
		onchange();
	}
	/** A link on one noticing, separate from the moment as a whole. */
	function linkNoticing(channel: MomentNoticing['channel'], loopId: string, linked: boolean) {
		if (!loopId) return;
		noticings = noticings.map(n => n.channel !== channel ? n : {
			...n, linkedLoopIds: linked ? [...new Set([...(n.linkedLoopIds ?? []), loopId])] : (n.linkedLoopIds ?? []).filter(id => id !== loopId)
		});
		onchange();
	}
	async function nameCandidate(title: string) {
		linking = true; loopTitle = title; loopError = '';
		await tick(); loopTitleInput?.focus();
	}
	async function open(key: DetailKey) {
		active = key;
		await tick();
		document.querySelector<HTMLElement>('#moment-detail-editor button, #moment-detail-editor textarea')?.focus();
	}
	function clear(key: DetailKey) {
		const next = { ...details }; delete next[key]; details = next;
		active = null; onchange();
	}
	function toggleLoop(id: string) {
		linkedLoopIds = linkedLoopIds.includes(id) ? linkedLoopIds.filter(loopId => loopId !== id) : [...linkedLoopIds, id];
		onchange();
	}
	function createLoop() {
		const loop = store.createOpenLoop(loopTitle);
		if (!loop) { loopError = 'Give the loop a name to keep it in your notebook.'; return; }
		linkedLoopIds = [...new Set([...linkedLoopIds, loop.id])];
		loopTitle = ''; loopError = ''; queueSync(); onchange();
	}
</script>

<section class="moment-details" aria-label="Optional moment details">
	<div class="chips noticing-chips" role="group" aria-label="Optional noticing categories">
		{#each channels as item (item.channel)}<button type="button" aria-pressed={noticings.some(n => n.channel === item.channel)} onclick={() => toggleChannel(item.channel)}>{item.title}</button>{/each}
	</div>
	{#each noticings as noticing (noticing.channel)}
		{@const item = channels.find(c => c.channel === noticing.channel)!}
		<label class="noticing-note">{item.question}<textarea rows="2" placeholder={item.placeholder} value={noticing.note} oninput={event => noteChannel(noticing.channel, event.currentTarget.value)}></textarea></label>
		{#if store.openLoops.length || noticing.linkedLoopIds?.length}<div class="noticing-links">
			{#each noticing.linkedLoopIds ?? [] as id (id)}<button type="button" class="linked-chip" aria-label={`Unlink ${loopName(id)} from this ${item.title.toLowerCase()} note`} onclick={() => linkNoticing(noticing.channel, id, false)}>{loopName(id)} ×</button>{/each}
			{#if store.openLoops.some(loop => !noticing.linkedLoopIds?.includes(loop.id))}<select aria-label={`Connect this ${item.title.toLowerCase()} note to a loop`} value="" onchange={event => { linkNoticing(noticing.channel, event.currentTarget.value, true); event.currentTarget.value = ''; }}>
				<option value="">Connect this note to a loop…</option>
				{#each store.openLoops.filter(loop => !noticing.linkedLoopIds?.includes(loop.id)) as loop (loop.id)}<option value={loop.id}>{loop.title}{loop.status === 'resolved' ? ' · resolved' : ''}</option>{/each}
			</select>{/if}
		</div>{/if}
	{/each}
	<div class="loop-actions"><button type="button" aria-expanded={linking} onclick={() => linking = !linking}>+ Link an open loop</button><a href="#open-loop-notebook">Close a loop</a></div>
	{#if linkOffer}<div class="offer loop-offer" data-testid="loop-link-offer"><p>Possibly about <strong>{linkOffer.title}</strong>?</p><div><button type="button" onclick={() => toggleLoop(linkOffer!.id)}>Link it</button><button type="button" onclick={() => notLinks = [...notLinks, linkOffer!.id]}>Not this</button></div></div>
	{:else if candidate && candidate !== candidateWaved}<div class="offer loop-offer" data-testid="loop-candidate-offer"><p>Keep “{candidate}” as an open loop?</p><div><button type="button" onclick={() => nameCandidate(candidate!)}>Name it as a loop</button><button type="button" onclick={() => candidateWaved = candidate!}>Not now</button></div></div>{/if}
	{#if linkedLoopIds.length}<div class="chips linked-loops" aria-label="Linked open loops">{#each linkedLoopIds as id (id)}<button type="button" aria-label={`Unlink ${store.openLoops.find(loop => loop.id === id)?.title ?? 'saved loop'}`} onclick={() => toggleLoop(id)}>{store.openLoops.find(loop => loop.id === id)?.title ?? 'Saved loop'} ×</button>{/each}</div>{/if}
	{#if linking}<div class="loop-picker">
		<p>Connect only if it seems useful. Sensations can stay unlinked.</p>
		{#if store.openLoops.length}<div class="loop-list" role="group" aria-label="Choose loops to link">{#each store.openLoops as loop (loop.id)}<label><input type="checkbox" checked={linkedLoopIds.includes(loop.id)} onchange={() => toggleLoop(loop.id)} /><span>{loop.title}{loop.status === 'resolved' ? ' · resolved' : ''}</span></label>{/each}</div>{/if}
		<form onsubmit={event => { event.preventDefault(); createLoop(); }}><label>New loop name <small>optional</small><input bind:this={loopTitleInput} bind:value={loopTitle} maxlength="160" placeholder="Reply to Mom" /></label><button type="submit" disabled={!loopTitle.trim()}>Create and link</button></form>
		<p role="status">{loopError}</p><small>Creating keeps the loop now. The link is included when you save the moment.</small>
	</div>{/if}
	<details bind:open={browsing} class="detail-menu">
		<summary>Additional trackers <small>optional</small></summary>
		<p>Choose a tracker to answer. Untouched ratings stay unmeasured.</p>
		{#if answered.length}<div class="chips recorded" aria-label="Details added">
			{#each answered as item (item.key)}<button type="button" onclick={() => open(item.key)}>{item.title}{item.scale ? ` · ${item.scale[Number(details[item.key]) - 1]}` : ' ✓'}</button>{/each}
		</div>{/if}
		<div class="chips choices" aria-label="Available legacy trackers">{#each DETAIL_FIELDS as item}<button type="button" onclick={() => open(item.key)}>{item.title}{hasDetail(details, item.key) ? ' ✓' : ''}</button>{/each}</div>
		{#if field}<div class="detail-panel" id="moment-detail-editor">
			<p id="detail-question">{field.question}</p>
			{#if field.scale}<p class="selected-rating" role="status">{typeof details[field.key] === 'number' ? `Recorded: ${field.scale[Number(details[field.key]) - 1]}` : 'Unmeasured'}</p>{/if}
			{#if field.scale}<div class="rating" role="group" aria-labelledby="detail-question">
				{#each field.scale as label, index}<button type="button" aria-pressed={details[field.key] === index + 1} onclick={() => { details = { ...details, [field.key]: index + 1 }; onchange(); }}>{label}</button>{/each}
			</div>{:else}<textarea aria-labelledby="detail-question" rows="2" placeholder={field.placeholder} value={details[field.key] ?? ''} oninput={event => { details = { ...details, [field.key]: event.currentTarget.value }; onchange(); }}></textarea>{/if}
			<div class="panel-actions"><small>Included when you save this moment.</small><button type="button" onclick={() => active = null}>Done</button>{#if hasDetail(details, field.key)}<button type="button" onclick={() => clear(field!.key)}>Remove detail</button>{/if}</div>
		</div>{/if}
		{#if customOffer}<div class="offer" data-testid="detail-offer"><button type="button" class="offer-main" onclick={() => active = `custom:${customOffer!.tracker.id}`}><strong>Add {customOffer.tracker.name}</strong><small>{customOffer.reason}</small></button><button type="button" class="dismiss" aria-label={`Dismiss ${customOffer.tracker.name} suggestion`} onclick={() => dismissedTrackers = [...dismissedTrackers, customOffer!.tracker.id]}>×</button></div>{/if}
		<PersonalTrackers bind:answers bind:active {onchange} />
	</details>
</section>

<style>
	.moment-details { margin-top: 0.65rem; border-top: 1px solid #44365b22; padding-top: 0.55rem; }
	button, input, textarea { color: var(--car-ink); border: 1px solid #44365b30; background: #ffffff70; border-radius: 0.5rem; padding: 0.45rem 0.6rem; font: 0.75rem var(--car-body); }
	button, summary { cursor: pointer; }
	button:active { transform: translateY(1px); }
	button:disabled { opacity: .5; cursor: default; }
	button[aria-pressed='true'] { background: var(--car-pink-wash); border-color: var(--car-pink-dark); box-shadow: inset 0 2px 3px #44365b22; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
	.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: .5rem 0; }
	.chips button { border-radius: 99px; }
	.noticing-chips button { min-height: 2.4rem; }
	label { display: grid; gap: .35rem; color: var(--car-ink); font: .78rem var(--car-body); }
	.noticing-note { margin: .7rem 0; }
	textarea { width: 100%; resize: vertical; font: 0.9rem/1.4 var(--car-body); }
	.loop-actions { display: flex; gap: .65rem; align-items: center; flex-wrap: wrap; margin: .7rem 0; }
	.loop-actions a { color: var(--car-ink-soft); font: .75rem var(--car-body); text-underline-offset: .2em; }
	.loop-picker, .detail-panel { padding: 0.75rem; background: #ffffff70; border: 1px solid #44365b25; border-radius: 0.65rem; }
	p { font: .78rem/1.45 var(--car-body); margin: .5rem 0; }
	.loop-list { display: grid; max-height: 11rem; overflow: auto; gap: .5rem; margin: .65rem 0; }
	.loop-list label { display: flex; align-items: center; gap: .4rem; overflow-wrap: anywhere; }
	.loop-list input { flex: none; }
	.loop-picker form { display: grid; gap: .4rem; }
	.loop-picker form button { justify-self: start; }
	.loop-picker input:not([type='checkbox']) { width: 100%; min-width: 0; }
	.linked-loops button { max-width: 100%; overflow-wrap: anywhere; }
	.noticing-links { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; margin: -.3rem 0 .7rem; }
	.noticing-links select { max-width: 100%; min-width: 0; color: var(--car-ink); border: 1px solid #44365b30; background: #ffffff70; border-radius: .5rem; padding: .35rem .5rem; font: .72rem var(--car-body); }
	.linked-chip { border-radius: 99px; font-size: .7rem; padding: .3rem .55rem; overflow-wrap: anywhere; max-width: 100%; }
	.loop-offer { display: grid; gap: .35rem; padding: .55rem .65rem; }
	.loop-offer p { margin: 0; }
	.loop-offer div { display: flex; flex-wrap: wrap; gap: .35rem; }
	.rating { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.3rem; }
	.rating button { min-width: 0; min-height: 2.8rem; padding: 0.4rem 0.15rem; font-size: 0.7rem; box-shadow: 0 2px 0 #44365b20; }
	.panel-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
	.panel-actions small { margin-right: auto; }
	.detail-menu { margin-top: 0.6rem; font-size: 0.75rem; }
	summary { padding: 0.25rem 0; }
	summary small { margin-left: 0.3rem; }
	small { font-size: 0.68rem; color: var(--car-ink-soft); line-height: 1.4; }
	.offer { display: flex; border: 1px dashed #44365b40; border-radius: 0.5rem; background: #ffffff40; margin: .65rem 0; }
	.offer-main { flex: 1; min-width: 0; text-align: left; border: 0; background: transparent; }
	.offer-main strong { display: block; font-weight: 500; margin-bottom: 0.2rem; }
	.dismiss { border: 0; align-self: start; background: transparent; min-width: 2rem; min-height: 2rem; }
	@media (max-width: 420px) { .rating { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (prefers-reduced-motion: reduce) { button:active { transform: none; } }
</style>
