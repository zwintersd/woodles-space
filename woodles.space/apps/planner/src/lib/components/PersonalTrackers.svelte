<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { uid } from '$lib/utils';
	import type { MomentTracker, TrackerAnswer } from '$lib/types';
	let { answers = $bindable<TrackerAnswer[]>([]), active = $bindable<string | null>(null), onchange } : { answers: TrackerAnswer[]; active: string | null; onchange: () => void } = $props();
	let trackers = $derived(store.settings.momentTrackers ?? []);
	let tracker = $derived(answers.find(a => `custom:${a.tracker.id}` === active)?.tracker ?? trackers.find(t => `custom:${t.id}` === active));
	let answer = $derived(answers.find(a => a.tracker.id === tracker?.id));
	let managing = $state(false), expanded = $state(false), error = $state('');
	let draft = $state<MomentTracker[]>([]);
	function set(value: TrackerAnswer['value']) {
		if (!tracker) return;
		if (tracker.type === 'text' && typeof value === 'string' && !value.trim()) { answers = answers.filter(a => a.tracker.id !== tracker!.id); onchange(); return; }
		answers = [...answers.filter(a => a.tracker.id !== tracker.id), { tracker: { ...tracker }, value }]; onchange();
	}
	function save() {
		if (draft.some(t => !t.name.trim() || (t.type === 'rating' && (!t.low.trim() || !t.high.trim())))) { error = 'Name each tracker and both ends of every rating.'; return; }
		if (new Set(draft.map(t => t.name.trim().toLowerCase())).size !== draft.length) { error = 'Give each tracker a distinct name.'; return; }
		store.updateSettings({ momentTrackers: draft.map(t => ({ ...t, name: t.name.trim(), low: t.low.trim(), high: t.high.trim() })) }); queueSync(); managing = false;
	}
</script>

<div class="personal">
	{#if answers.length}<div class="chips">{#each answers as a (a.tracker.id)}<button type="button" onclick={() => active = `custom:${a.tracker.id}`}>{a.tracker.name} · {typeof a.value === 'boolean' ? a.value ? 'Yes' : 'No' : a.tracker.type === 'rating' ? `${a.value}/5` : 'noted'}</button>{/each}</div>{/if}
	{#if tracker}<div class="panel" aria-label="Personal tracker answer">
		<strong>{tracker.name}</strong>
		{#if tracker.type === 'rating'}<p>{tracker.low} → {tracker.high}</p><div class="rating" role="group" aria-label={tracker.name}>{#each [1,2,3,4,5] as n}<button type="button" aria-pressed={answer?.value === n} onclick={() => set(n)}>{n}</button>{/each}</div>
		{:else if tracker.type === 'check'}<div class="chips" role="group" aria-label={tracker.name}>{#each [true,false] as value}<button type="button" aria-pressed={answer?.value === value} onclick={() => set(value)}>{value ? 'Yes' : 'No'}</button>{/each}</div>
		{:else}<textarea aria-label={tracker.name} rows="2" value={typeof answer?.value === 'string' ? answer.value : ''} oninput={e => set(e.currentTarget.value)}></textarea>{/if}
		<div class="actions"><small>Included when you save the moment.</small><button type="button" onclick={() => active = null}>Done</button>{#if answer}<button type="button" onclick={() => { answers = answers.filter(a => a.tracker.id !== tracker!.id); active = null; onchange(); }}>Remove answer</button>{/if}</div>
	</div>{/if}
	<details bind:open={expanded}><summary>Your trackers <small>{trackers.length ? `${trackers.length} available` : 'make this your own'}</small></summary>
		<div class="chips">{#each trackers as t (t.id)}<button type="button" onclick={() => { active = `custom:${t.id}`; expanded = false; }}>{t.name}</button>{/each}</div>
		<button type="button" onclick={() => { draft = trackers.map(t => ({ ...t })); error = ''; managing = !managing; }}>Customize trackers</button>
		{#if managing}<div class="manager" aria-label="Customize trackers">
			<p>Add a rating, yes/no question, or a note. Optional cue words help choose when to offer it.</p>
			{#each draft as t, index (t.id)}<div class="tracker-edit">
				<label>Name<input aria-label={`Tracker ${index + 1} name`} bind:value={t.name} maxlength="60" /></label>
				<label>Answer<select aria-label={`Tracker ${index + 1} type`} bind:value={t.type}><option value="rating">Rating 1–5</option><option value="check">Yes / no</option><option value="text">Note</option></select></label>
				{#if t.type === 'rating'}<div class="ends"><label>1 means<input aria-label={`Tracker ${index + 1} low`} bind:value={t.low} maxlength="30" /></label><label>5 means<input aria-label={`Tracker ${index + 1} high`} bind:value={t.high} maxlength="30" /></label></div>{/if}
				<label>Offer when I mention<input aria-label={`Tracker ${index + 1} cues`} bind:value={t.cue} placeholder="reading, studying, writing" maxlength="200" /></label>
				<button type="button" onclick={() => draft = draft.filter(item => item.id !== t.id)} aria-label={`Remove tracker ${index + 1}`}>Remove tracker</button>
			</div>{/each}
			<div class="actions"><button type="button" onclick={() => draft = [...draft, { id: uid(), name: '', type: 'rating', cue: '', low: 'Low', high: 'High' }]}>Add tracker</button><button type="button" onclick={save}>Save trackers</button><button type="button" onclick={() => managing = false}>Cancel</button></div>
			<p role="status">{error}</p><small>Saved answers retain their original names and rating scales.</small>
		</div>{/if}
	</details>
</div>

<style>
	.personal { margin-top: .6rem; font: .75rem var(--car-body); }
	button, input, select, textarea { font: inherit; color: var(--car-ink); background: #ffffff80; border: 1px solid #44365b33; border-radius: .5rem; padding: .45rem .6rem; }
	button, summary { cursor: pointer; }
	button[aria-pressed='true'] { background: var(--car-pink-wash); border-color: var(--car-pink-dark); box-shadow: inset 0 2px 3px #44365b22; }
	.chips, .actions { display: flex; flex-wrap: wrap; gap: .4rem; margin: .5rem 0; align-items: center; }
	.chips button { border-radius: 99px; }
	.panel, .tracker-edit { border: 1px solid #44365b25; background: #ffffff50; padding: .7rem; border-radius: .65rem; margin: .5rem 0; }
	.rating { display: grid; grid-template-columns: repeat(5, 1fr); gap: .4rem; }
	.rating button { min-height: 2.5rem; }
	summary { padding: .3rem 0; }
	small { color: var(--car-ink-soft); font-size: .68rem; }
	summary small { margin-left: .4rem; }
	p { margin: .5rem 0; }
	textarea { width: 100%; resize: vertical; margin-top: .5rem; }
	label { display: grid; gap: .25rem; margin-bottom: .5rem; min-width: 0; }
	input, select { width: 100%; min-width: 0; }
	.ends { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
</style>
