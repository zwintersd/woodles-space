<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { INTERVAL_KIND_OPTIONS, type DayInterval } from '$lib/instrument';
	import { uid } from '$lib/utils';
	import type { SampleTag, MomentDetails as Details, MomentNoticing, TrackerAnswer } from '$lib/types';
	import { cleanTrackerAnswers } from '$lib/momentTrackers';
	import MomentDetails from './MomentDetails.svelte';
	import { cleanDetails, cleanNoticings } from '$lib/momentDetails';
	import { thinkingAboutShelf } from '$lib/thinkingAboutShelf.svelte';

	let { interval, timeLabel, bellNote, onbellclick, editingPast = false, onreturnnow, onsaved }: { interval: DayInterval | null; timeLabel: string; bellNote: string; onbellclick?: () => void; editingPast?: boolean; onreturnnow?: () => void; onsaved?: () => void } = $props();
	const colors = ['#aa526b', '#8061a8', '#467f92', '#98702f', '#548068', '#6676a0'];
	const defaults: SampleTag[] = INTERVAL_KIND_OPTIONS.filter(o => o.kind !== 'elsewhere').map((o, i) => ({ id: o.kind, name: o.label, color: colors[i], kind: o.kind }));
	let tags = $derived(store.settings.sampleTags ?? defaults);
	let drafts = $state<Record<string, { text: string; tagId: string; fallback?: SampleTag; details: Details; answers: TrackerAnswer[]; noticings: MomentNoticing[]; linkedLoopIds: string[]; thinkingAboutEntryId: string }>>({});
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
		drafts[interval.key] = { text: own?.label ?? '', tagId: tag?.id ?? '', fallback: tag ?? undefined, details: { ...own?.details }, answers: (own?.trackerAnswers ?? []).map(a => ({ tracker: { ...a.tracker }, value: a.value })), noticings: (own?.noticings ?? []).map(n => ({ ...n })), linkedLoopIds: [...(own?.linkedLoopIds ?? [])], thinkingAboutEntryId: own?.thinkingAboutEntryId ?? '' };
		feedback = '';
	});
	let chosen = $derived(tags.find(t => t.id === draft?.tagId) ?? (draft?.fallback?.id === draft?.tagId ? draft?.fallback : undefined));
	// The moment's own shelf tag, independent of any task scheduled for the
	// block — this is what lets a sitting be offered without a task ever
	// having existed.
	let shelfEntry = $derived(draft?.thinkingAboutEntryId ? thinkingAboutShelf.find(draft.thinkingAboutEntryId) : null);
	function pickShelfEntry(entryId: string): void {
		if (draft) draft.thinkingAboutEntryId = entryId;
	}
	function clearShelfEntry(): void {
		if (draft) draft.thinkingAboutEntryId = '';
	}
	function saveSample() {
		if (!interval || !draft?.text.trim()) return;
		const existing = interval.observation?.intervalStart === interval.startTime ? interval.observation : undefined;
		store.observeInterval({ date: interval.date, intervalStart: interval.startTime, label: draft.text, kind: chosen?.kind ?? 'elsewhere', sampleTag: chosen ? { ...chosen } : null, details: cleanDetails(draft.details), trackerAnswers: cleanTrackerAnswers(draft.answers), noticings: cleanNoticings(draft.noticings), linkedLoopIds: [...draft.linkedLoopIds], source: existing?.source ?? 'live', note: existing?.note, thinkingAboutEntryId: draft.thinkingAboutEntryId || undefined });
		queueSync();
		feedback = existing ? 'Changes saved.' : 'Moment saved.';
		onsaved?.();
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
	<div class="composer-grid">
		<div class="sample-primary">
			<div class="sampler-meta">
				<div><p class="interval-clock">{timeLabel}</p>{#if onbellclick}<button type="button" class="bell-note bell-button" aria-label={`bell settings — ${bellNote}`} data-testid="bell-status" onclick={onbellclick}>{bellNote}</button>{:else}<p class="bell-note">{bellNote}</p>{/if}</div>
				<span class="sample-source">momentary sample</span>
			</div>
			{#if editingPast}<button type="button" class="return-now" onclick={onreturnnow}>Return to now</button>{/if}
			<form onsubmit={(event) => { event.preventDefault(); saveSample(); }}>
				<label class="entry-label" for="moment-entry">{interval?.state === 'past' ? 'What was happening?' : 'What’s happening now?'}</label>
				<textarea id="moment-entry" placeholder="A few words about this moment…" rows="3" value={draft?.text ?? ''} disabled={!draft} oninput={(event) => { if (draft) draft.text = event.currentTarget.value; feedback = ''; }}></textarea>
				{#if shelfEntry}
					<p class="shelf-link" data-testid="moment-shelf-link">
						<span class="shelf-dot" style:background={shelfEntry.color}></span>
						<span>about <strong>{shelfEntry.title}</strong></span>
						<button type="button" class="shelf-clear" onclick={clearShelfEntry}>unlink</button>
					</p>
				{:else if draft && thinkingAboutShelf.entries.length > 0}
					<div class="shelf-picker" data-testid="moment-shelf-picker">
						<p class="shelf-kicker">or something you're in the middle of</p>
						<div class="shelf-strip">
							{#each thinkingAboutShelf.entries as entry (entry.id)}
								<button type="button" class="shelf-chip" style:--chip={entry.color} onclick={() => pickShelfEntry(entry.id)}>
									{entry.title}
								</button>
							{/each}
						</div>
					</div>
				{/if}
				<div class="labels-heading"><span>Color label <small>optional</small></span><button type="button" onclick={() => { tagDraft = tags.map(t => ({ ...t })); labelError = ''; editing = !editing; }}>Edit labels</button></div>
				<div class="labels" role="group" aria-label="Sample color label">
					<button type="button" class="tag" aria-pressed={!draft?.tagId} disabled={!draft} onclick={() => { if (draft) draft.tagId = ''; feedback = ''; }}>No label</button>
					{#each tags as tag (tag.id)}
						<button type="button" class="tag" style:--tag-color={tag.color} aria-pressed={draft?.tagId === tag.id} disabled={!draft} onclick={() => { if (draft) draft.tagId = tag.id; feedback = ''; }}><i aria-hidden="true"></i>{tag.name}</button>
					{/each}
					{#if chosen && !tags.some(t => t.id === chosen.id)}<span class="retired">{chosen.name} · saved label</span>{/if}
				</div>
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
		<aside class="checkin-panel" aria-labelledby="checkin-heading">
			<div class="glass-portrait" aria-hidden="true"><span></span></div>
			<div class="checkin-content">
			<header><h2 id="checkin-heading">Anything else you notice?</h2><p>Optional · touch only what matters</p></header>
			{#if interval && draft}{#key interval.key}<MomentDetails bind:details={draft.details} bind:answers={draft.answers} bind:noticings={draft.noticings} bind:linkedLoopIds={draft.linkedLoopIds} text={draft.text} tagName={chosen?.name} date={interval.date} start={interval.startTime} previous={store.getObservationsForDate(interval.date)} onchange={() => feedback = ''} />{/key}
			{:else}<p class="checkin-empty">Optional notes are available while recording a moment.</p>{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	.composer { margin-top: 0; }
	.composer-grid { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(18rem, 0.95fr); gap: 1rem; align-items: start; }
	.sample-primary { min-width: 0; }
	.sampler-meta { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
	.interval-clock { margin: 0; color: var(--car-ink); font: 400 clamp(1.25rem, 2.3vw, 1.75rem)/1.15 var(--car-counter); font-variant-numeric: lining-nums tabular-nums; letter-spacing: -0.025em; }
	.bell-note { margin: 0.3rem 0 0; color: var(--car-ink-soft); font: 0.58rem var(--car-mono); letter-spacing: 0.08em; }
	.bell-button { display: block; border: 0; border-radius: 0.3rem; background: transparent; padding: 0.2rem 0.25rem; margin-left: -0.25rem; text-align: left; text-decoration: underline dotted; text-underline-offset: 0.25em; min-height: 1.6rem; }
	.bell-button:hover { color: var(--car-ink); background: #ffffff60; }
	.sample-source { border-top: 1px solid var(--car-gilt-rule); border-bottom: 3px double var(--car-gilt-rule); padding: 0.35rem 0.45rem; color: var(--car-ink-soft); font: 0.56rem var(--car-mono); letter-spacing: 0.1em; text-transform: uppercase; }
	.return-now { margin-bottom: 0.65rem; border: 1px solid #44365b2b; border-radius: 0.5rem; background: #ffffff60; padding: 0.4rem 0.6rem; color: var(--car-ink); font: 0.7rem var(--car-body); cursor: pointer; }
	.checkin-panel { min-width: 0; overflow: hidden; border: 1px solid #136f7c45; border-radius: 5rem 5rem 0.6rem 0.6rem; background: linear-gradient(145deg, #e6eadb, #f2eddb 75%); box-shadow: 0 4px 0 #c6c7af, inset 0 0 1.4rem #8d814315; }
	.glass-portrait { position: relative; height: 10rem; overflow: hidden; border-bottom: 3px double #c6a86c; background: var(--car-orn-chart) right -4rem center / 20rem no-repeat, radial-gradient(ellipse at 50% 100%, #205154, #281b36 75%); }
	.glass-portrait span { position: absolute; inset: 0.25rem 0 0; background: var(--car-orn-window) center / auto 100% no-repeat; filter: drop-shadow(0 0 0.6rem #be946f45); }
	.checkin-content { padding: 1.1rem; }
	.checkin-panel header { margin-bottom: 0.65rem; }
	.checkin-panel h2 { margin: 0; color: var(--car-ink); font: 400 1.4rem/1.05 var(--car-fell); }
	.checkin-panel header p { margin: 0.25rem 0 0; color: var(--car-ink-soft); font: 0.72rem var(--car-body); }
	.checkin-empty { color: var(--car-ink-soft); font-size: 0.8rem; }
	.entry-label { display: block; font: 400 clamp(1.7rem, 2.6vw, 2.3rem)/1.1 var(--car-fell); margin-bottom: 0.7rem; }
	textarea { display: block; width: 100%; resize: vertical; min-height: 7.4rem; border: 1px solid #44365b33; border-left: 3px solid var(--sample-color); border-radius: 0.3rem 0.3rem 0.9rem 0.3rem; background: repeating-linear-gradient(180deg, transparent 0 calc(1.7rem - 1px), #b8862b16 calc(1.7rem - 1px) 1.7rem) left 0.75rem top 0.8rem / calc(100% - 1.5rem) 100% no-repeat, #fffaf0; box-shadow: inset 0 2px 5px #44365b0c; padding: 0.8rem; color: var(--car-ink); font: 1rem/1.7rem var(--car-body); transition: border-color 180ms ease; }
	/* The shelf, borrowed from TaskEditDrawer's composer — same chips, same
	   colour-from-the-board so an entry reads as the same object here. */
	.shelf-picker { margin-top: 0.6rem; }
	.shelf-kicker { color: var(--car-ink-soft); font-size: 0.72rem; margin-bottom: 0.35rem; }
	.shelf-strip { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.shelf-chip { font-size: 0.78rem; color: var(--car-ink); padding: 0.25rem 0.6rem; border: 1px solid #44365b2b; border-left: 3px solid var(--chip, var(--car-ink)); border-radius: 0.35rem; background: #ffffff60; }
	.shelf-chip:hover, .shelf-chip:focus-visible { border-color: var(--sample-color); }
	.shelf-link { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.6rem; color: var(--car-ink-soft); font-size: 0.78rem; }
	.shelf-link strong { color: var(--car-ink); font-weight: 500; }
	.shelf-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; flex: none; }
	.shelf-clear { border: 0; background: transparent; padding: 0; margin-left: auto; color: var(--car-ink-soft); font-size: 0.72rem; text-decoration: underline; }
	.shelf-clear:hover { color: var(--car-ink); }
	.labels-heading, .save-row { display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; margin: 0.8rem 0 0.5rem; }
	.labels-heading { font: 0.75rem var(--car-body); }
	small, .save-row span { color: var(--car-ink-soft); font-size: 0.7rem; }
	.labels-heading small { margin-left: 0.3rem; }
	button { cursor: pointer; color: var(--car-ink); border: 1px solid #44365b2b; border-radius: 0.5rem; background: #ffffff60; padding: 0.45rem 0.6rem; font: 0.7rem var(--car-body); }
	.labels { display: flex; flex-wrap: wrap; gap: 0.5rem; }
	.tag { display: inline-flex; gap: 0.5rem; align-items: center; min-height: 2.25rem; border-radius: 0.35rem 0.75rem 0.35rem 0.75rem; box-shadow: 0 2px 0 #44365b18; transition: transform 140ms ease, box-shadow 140ms ease; }
	.tag i { width: 0.55rem; height: 0.55rem; border-radius: 1px; background: var(--tag-color); box-shadow: inset 1px 1px 0 #ffffff80, 0 0 0 1px #2a1d2e80; transform: rotate(45deg); flex-shrink: 0; }
	.tag[aria-pressed='true'] { border-color: var(--tag-color, var(--car-ink)); box-shadow: inset 0 1px 3px #44365b33; background: #ffffffb0; transform: translateY(2px); }
	.tag:hover:not(:disabled) { transform: translateY(-1px); }
	button:active:not(:disabled) { transform: translateY(2px); }
	.save { border: 1px solid #6a1831; border-radius: 0.4rem 0.4rem 0.9rem 0.4rem; background: linear-gradient(145deg, #8e2849, #65213d); box-shadow: inset 0 0 0 2px #e7ba6950, 0 3px 0 #4a1931; color: var(--car-paper); padding: 0.7rem 1.1rem; white-space: nowrap; }
	button:disabled { opacity: 0.45; cursor: default; }
	.label-editor { border-top: 1px dashed #44365b55; padding-top: 0.8rem; margin-top: 1rem; }
	.label-editor p { font-size: 0.8rem; margin-bottom: 0.6rem; }
	.label-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
	.label-row input:not([type='color']) { min-width: 0; flex: 1; padding: 0.4rem; border: 1px solid #44365b33; border-radius: 0.4rem; background: #ffffff80; color: var(--car-ink); }
	input[type='color'] { width: 2rem; height: 2rem; padding: 2px; border: 0; background: transparent; }
	.editor-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
	.retired { font-size: 0.7rem; padding: 0.5rem; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
	@media (max-width: 900px) { .composer-grid { grid-template-columns: minmax(0, 1fr); } .checkin-panel { border-radius: 2.5rem 2.5rem 0.6rem 0.6rem; } .checkin-content { padding: 0.85rem; } .glass-portrait { height: 7.5rem; } .sampler-meta { gap: 0.6rem; } .sample-source { max-width: 7rem; font-size: 0.52rem; } }
	@media (prefers-reduced-motion: reduce) { textarea, .tag { transition: none; } .tag, button:active:not(:disabled), .tag:hover:not(:disabled), .tag[aria-pressed='true'] { transform: none; } }
</style>
