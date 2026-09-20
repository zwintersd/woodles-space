<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { INTERVAL_KIND_OPTIONS, type DayInterval } from '$lib/instrument';
	import { uid } from '$lib/utils';
	import type { SampleTag, MomentDetails as Details } from '$lib/types';
	import MomentDetails from './MomentDetails.svelte';
	import { cleanDetails } from '$lib/momentDetails';

	let { interval }: { interval: DayInterval | null } = $props();
	const colors = ['#aa526b', '#8061a8', '#467f92', '#98702f', '#548068', '#6676a0'];
	const defaults: SampleTag[] = INTERVAL_KIND_OPTIONS.filter(o => o.kind !== 'elsewhere').map((o, i) => ({ id: o.kind, name: o.label, color: colors[i], kind: o.kind }));
	let tags = $derived(store.settings.sampleTags ?? defaults);
	let drafts = $state<Record<string, { text: string; tagId: string; fallback?: SampleTag; details: Details }>>({});
	let draft = $derived(interval ? drafts[interval.key] : undefined);
	let editing = $state(false);
	let tagDraft = $state<SampleTag[]>([]);
	let feedback = $state('');
	let labelError = $state('');
	$effect(() => {
		if (!interval || drafts[interval.key]) return;
		const observation = interval.observation;
		const own = observation?.intervalStart === interval.startTime ? observation : undefined;
		const tag = own?.sampleTag === undefined ? defaults.find(t => t.kind === own?.kind) : own.sampleTag;
		drafts[interval.key] = { text: own?.label ?? '', tagId: tag?.id ?? '', fallback: tag ?? undefined, details: { ...own?.details } };
		feedback = '';
	});
	let chosen = $derived(tags.find(t => t.id === draft?.tagId) ?? (draft?.fallback?.id === draft?.tagId ? draft?.fallback : undefined));
	function saveSample() {
		if (!interval || !draft?.text.trim()) return;
		const existing = interval.observation?.intervalStart === interval.startTime ? interval.observation : undefined;
		store.observeInterval({ date: interval.date, intervalStart: interval.startTime, label: draft.text, kind: chosen?.kind ?? 'elsewhere', sampleTag: chosen ? { ...chosen } : null, details: cleanDetails(draft.details), source: existing?.source ?? 'live', note: existing?.note });
		queueSync();
		feedback = existing ? 'Changes saved.' : 'Moment saved.';
	}
	function saveLabels() {
		if (tagDraft.some(t => !t.name.trim())) { labelError = 'Give every label a name, or remove it.'; return; }
		if (new Set(tagDraft.map(t => t.name.trim().toLowerCase())).size !== tagDraft.length) { labelError = 'Use a different name for each label.'; return; }
		store.updateSettings({ sampleTags: tagDraft.map(t => ({ ...t, name: t.name.trim() })) });
		if (draft?.tagId && !tagDraft.some(t => t.id === draft.tagId) && draft.fallback?.id !== draft.tagId) draft.tagId = '';
		queueSync();
		editing = false;
	}
</script>

<div class="composer" style:--sample-color={chosen?.color ?? '#8061a8'}>
	<form onsubmit={(event) => { event.preventDefault(); saveSample(); }}>
		<label class="entry-label" for="moment-entry">{interval?.state === 'past' ? 'What was happening?' : 'What’s happening now?'}</label>
		<textarea id="moment-entry" placeholder="A few words about this moment…" rows="3" value={draft?.text ?? ''} disabled={!draft} oninput={(event) => { if (draft) draft.text = event.currentTarget.value; feedback = ''; }}></textarea>
		<div class="labels-heading"><span>Color label <small>optional</small></span><button type="button" onclick={() => { tagDraft = tags.map(t => ({ ...t })); labelError = ''; editing = !editing; }}>Edit labels</button></div>
		<div class="labels" role="group" aria-label="Sample color label">
			<button type="button" class="tag" aria-pressed={!draft?.tagId} disabled={!draft} onclick={() => { if (draft) draft.tagId = ''; feedback = ''; }}>No label</button>
			{#each tags as tag (tag.id)}
				<button type="button" class="tag" style:--tag-color={tag.color} aria-pressed={draft?.tagId === tag.id} disabled={!draft} onclick={() => { if (draft) draft.tagId = tag.id; feedback = ''; }}><i aria-hidden="true"></i>{tag.name}</button>
			{/each}
			{#if chosen && !tags.some(t => t.id === chosen.id)}<span class="retired">{chosen.name} · saved label</span>{/if}
		</div>
		{#if interval && draft}{#key interval.key}<MomentDetails bind:details={draft.details} text={draft.text} tagName={chosen?.name} date={interval.date} start={interval.startTime} previous={store.getObservationsForDate(interval.date)} onchange={() => feedback = ''} />{/key}{/if}
		<div class="save-row"><span role="status">{feedback || (interval ? 'Your words first. Add a label if it helps.' : 'Outside sampling hours. Add an earlier activity below.')}</span><button class="save" disabled={!draft?.text.trim()}>{interval?.observation?.intervalStart === interval?.startTime && interval?.observation ? 'Save changes' : 'Save moment'}</button></div>
	</form>
	{#if editing}
		<form class="label-editor" aria-label="Edit sample labels" onsubmit={(event) => { event.preventDefault(); saveLabels(); }}>
			<p>Name your labels and choose their colors.</p>
			{#each tagDraft as tag, index (tag.id)}
				<div class="label-row"><input type="color" aria-label={`Label ${index + 1} color`} bind:value={tag.color} /><input aria-label={`Label ${index + 1} name`} bind:value={tag.name} required maxlength="40" /><button type="button" aria-label={`Remove label ${index + 1}`} onclick={() => tagDraft = tagDraft.filter(t => t.id !== tag.id)}>Remove</button></div>
			{/each}
			<div class="editor-actions"><button type="button" onclick={() => tagDraft = [...tagDraft, { id: uid(), name: '', color: colors[tagDraft.length % colors.length], kind: 'elsewhere' }]}>Add label</button><button type="submit">Save labels</button><button type="button" onclick={() => editing = false}>Cancel</button></div>
			<p role="status">{labelError}</p>
			<small>Changes apply to future saves. Recorded moments keep their saved labels.</small>
		</form>
	{/if}
</div>

<style>
	.composer { margin-top: 1rem; }
	.entry-label { display: block; font: 500 clamp(1.6rem, 2.5vw, 2.2rem)/1.1 var(--car-display); margin-bottom: 0.7rem; }
	textarea { display: block; width: 100%; resize: vertical; min-height: 6rem; border: 1px solid #44365b33; border-left: 4px solid var(--sample-color); border-radius: 0.65rem; background: #ffffff80; box-shadow: inset 0 2px 5px #44365b12; padding: 0.8rem; color: var(--car-ink); font: 1rem/1.5 var(--car-body); transition: border-color 180ms ease; }
	.labels-heading, .save-row { display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; margin: 0.8rem 0 0.5rem; }
	.labels-heading { font: 0.75rem var(--car-body); }
	small, .save-row span { color: var(--car-ink-soft); font-size: 0.7rem; }
	.labels-heading small { margin-left: 0.3rem; }
	button { cursor: pointer; color: var(--car-ink); border: 1px solid #44365b2b; border-radius: 0.5rem; background: #ffffff60; padding: 0.45rem 0.6rem; font: 0.7rem var(--car-body); }
	.labels { display: flex; flex-wrap: wrap; gap: 0.5rem; }
	.tag { display: inline-flex; gap: 0.4rem; align-items: center; min-height: 2.25rem; border-radius: 99px; box-shadow: 0 2px 0 #44365b22; transition: transform 140ms ease, box-shadow 140ms ease; }
	.tag i { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--tag-color); flex-shrink: 0; }
	.tag[aria-pressed='true'] { border-color: var(--tag-color, var(--car-ink)); box-shadow: inset 0 1px 3px #44365b33; background: #ffffffb0; transform: translateY(2px); }
	.tag:hover:not(:disabled) { transform: translateY(-1px); }
	button:active:not(:disabled) { transform: translateY(2px); }
	.save { background: var(--car-ink); color: var(--car-paper); padding: 0.65rem 0.9rem; white-space: nowrap; }
	button:disabled { opacity: 0.45; cursor: default; }
	.label-editor { border-top: 1px dashed #44365b55; padding-top: 0.8rem; margin-top: 1rem; }
	.label-editor p { font-size: 0.8rem; margin-bottom: 0.6rem; }
	.label-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
	.label-row input:not([type='color']) { min-width: 0; flex: 1; padding: 0.4rem; border: 1px solid #44365b33; border-radius: 0.4rem; background: #ffffff80; color: var(--car-ink); }
	input[type='color'] { width: 2rem; height: 2rem; padding: 2px; border: 0; background: transparent; }
	.editor-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
	.retired { font-size: 0.7rem; padding: 0.5rem; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
	@media (prefers-reduced-motion: reduce) { textarea, .tag { transition: none; } .tag, button:active:not(:disabled), .tag:hover:not(:disabled), .tag[aria-pressed='true'] { transform: none; } }
</style>
