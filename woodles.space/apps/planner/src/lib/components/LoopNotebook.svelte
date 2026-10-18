<script lang="ts">
	import { tick } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import type { LoopEvent, LoopEventType } from '$lib/types';

	const verbs: { value: LoopEventType; label: string }[] = [
		{ value: 'noticed', label: 'Noticed' }, { value: 'approached', label: 'Approached' },
		{ value: 'related_action', label: 'Related action' }, { value: 'progress', label: 'Progress' },
		{ value: 'paused', label: 'Paused' }, { value: 'closed', label: 'Closed' },
		{ value: 'released', label: 'Released' }, { value: 'reopened', label: 'Reopened' }
	];
	const descriptors = ['Lighter', 'Calmer', 'Clearer-headed', 'More activated', 'Satisfied', 'Less comfortable', 'No noticeable change', 'Something else'];
	let creating = $state(false), title = $state('');
	let recording = $state(false), loopId = $state(''), type = $state<LoopEventType>('noticed');
	let note = $state(''), occurred = $state(''), message = $state('');
	let reflectingId = $state(''), selected = $state<string[]>([]), reflectionNote = $state('');
	let next = $state<'something' | 'rest' | 'nothing' | ''>('');
	let reflectionHeading: HTMLHeadingElement | undefined = $state();
	let titleInput: HTMLInputElement | undefined = $state();
	let loopPicker: HTMLSelectElement | undefined = $state();
	let notebookHeading: HTMLHeadingElement | undefined = $state();
	let unresolved = $derived(store.openLoops.filter(loop => loop.status !== 'resolved'));
	let reflecting = $derived(store.loopEvents.find(event => event.id === reflectingId));
	let history = $derived([...store.loopEvents].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || (b.sequence ?? 0) - (a.sequence ?? 0) || b.id.localeCompare(a.id)));
	const titleFor = (id?: string) => store.openLoops.find(loop => loop.id === id)?.title ?? 'Unattributed observation';
	const timeFor = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	async function returnToNotebook() { await tick(); notebookHeading?.focus({ preventScroll: true }); }
	function dismissReflection() { reflectingId = ''; void returnToNotebook(); }

	async function newLoop() {
		creating = !creating;
		if (creating) { await tick(); titleInput?.focus(); }
	}
	function create() {
		const loop = store.createOpenLoop(title);
		if (!loop) return;
		queueSync(); title = ''; creating = false;
		message = `Saved “${loop.title}”.`;
		void returnToNotebook();
	}
	async function openRecorder(value: LoopEventType) {
		type = value; loopId = ''; note = ''; occurred = ''; recording = true;
		await tick(); loopPicker?.focus();
	}
	async function beginReflection(event: LoopEvent) {
		const saved = store.closureReflections.find(item => item.loopEventId === event.id);
		reflectingId = event.id; selected = [...(saved?.descriptors ?? [])];
		reflectionNote = saved?.note ?? ''; next = saved?.nextFeelsPossible ?? '';
		await tick(); reflectionHeading?.focus();
	}
	function log(value: LoopEventType, id?: string, eventNote?: string, at?: string) {
		const event = store.recordLoopEvent({ type: value, loopId: id || undefined, note: eventNote, occurredAt: at });
		if (!event) { message = 'Choose a loop for this event, or check its current state.'; return; }
		queueSync(); recording = false;
		message = `${verbs.find(verb => verb.value === value)?.label} recorded.`;
		if (value === 'closed' || value === 'released') void beginReflection(event);
	}
	function submitEvent() {
		const at = occurred ? new Date(occurred) : undefined;
		if (at && !Number.isFinite(at.getTime())) { message = 'Choose a valid event time.'; return; }
		log(type, loopId, note, at?.toISOString());
	}
	function toggleDescriptor(value: string) {
		if (selected.includes(value)) selected = selected.filter(item => item !== value);
		else selected = value === 'No noticeable change' ? [value] : [...selected.filter(item => item !== 'No noticeable change'), value];
	}
	function saveReflection() {
		if (!reflectingId) return;
		const saved = store.saveClosureReflection(reflectingId, { descriptors: selected, note: reflectionNote, nextFeelsPossible: next || undefined });
		if (!saved) return;
		queueSync(); reflectingId = ''; message = 'Reflection saved.'; void returnToNotebook();
	}
</script>

<section class="notebook" id="open-loop-notebook" aria-labelledby="loop-heading" data-testid="loop-notebook">
	<header><div><p class="kicker">optional · whenever you notice</p><h2 id="loop-heading" tabindex="-1" bind:this={notebookHeading}>Open loops</h2></div><button type="button" onclick={newLoop} aria-expanded={creating}>New loop</button></header>
	<p class="intro">An unfinished intention can simply stay here.</p>
	{#if creating}<form class="panel" onsubmit={event => { event.preventDefault(); create(); }}>
		<label>Loop title<input bind:this={titleInput} bind:value={title} maxlength="200" required placeholder="Reply to Mom" /></label>
		<div class="actions"><button class="primary" disabled={!title.trim()}>Save loop</button><button type="button" onclick={() => { creating = false; void returnToNotebook(); }}>Cancel</button></div>
	</form>{/if}
	<div class="actions" aria-label="Record a loop event">
		<button type="button" onclick={() => openRecorder('noticed')}>Notice</button>
		<button type="button" onclick={() => openRecorder('approached')}>Did something</button>
		<button type="button" onclick={() => openRecorder('closed')}>Closed / let go</button>
	</div>
	{#if recording}<form class="panel" aria-label="Loop event" onsubmit={event => { event.preventDefault(); submitEvent(); }}>
		<label for="event-loop">Which loop?</label><select id="event-loop" bind:this={loopPicker} bind:value={loopId}><option value="">No linked loop</option>{#each store.openLoops as loop (loop.id)}<option value={loop.id}>{loop.title} · {loop.status}</option>{/each}</select>
		<label for="event-type">What happened?</label><select id="event-type" bind:value={type}>{#each verbs as verb}<option value={verb.value}>{verb.label}</option>{/each}</select>
		<label>Event note <small>optional</small><textarea bind:value={note} rows="2" placeholder="What did you notice or do?"></textarea></label>
		<details><summary>Event time <small>optional</small></summary><label>When it happened<input type="datetime-local" bind:value={occurred} /></label><small>Leave blank for now. This is separate from the sampling bell.</small></details>
		<div class="actions"><button class="primary" disabled={!loopId && ['closed', 'released', 'reopened', 'paused'].includes(type)}>Save event</button><button type="button" onclick={() => recording = false}>Cancel</button></div>
	</form>{/if}
	{#if reflecting}<section class="panel reflection" aria-labelledby="closure-heading" data-testid="closure-reflection">
		<p class="kicker">{titleFor(reflecting.loopId)} · {reflecting.type === 'released' ? 'released' : 'closed'}</p>
		<h3 id="closure-heading" tabindex="-1" bind:this={reflectionHeading}>What changed, if anything?</h3>
		<div class="chips" role="group" aria-label="Observed changes">{#each descriptors as descriptor}<button type="button" aria-pressed={selected.includes(descriptor)} onclick={() => toggleDescriptor(descriptor)}>{descriptor}</button>{/each}</div>
		<label>Reflection note <small>optional</small><textarea bind:value={reflectionNote} rows="2" placeholder="Where did you notice it—in your body, attention, or willingness to act?"></textarea></label>
		<p class="question">What feels possible now? <small>optional</small></p>
		<div class="chips" role="group" aria-label="What feels possible now?">
			{#each [{ value: 'something' as const, label: 'Something else is approachable' }, { value: 'rest' as const, label: 'Rest' }, { value: 'nothing' as const, label: 'Nothing in particular' }] as choice}<button type="button" aria-pressed={next === choice.value} onclick={() => next = next === choice.value ? '' : choice.value}>{choice.label}</button>{/each}
			<button type="button" onclick={() => next = ''}>Skip this question</button>
		</div>
		<div class="actions"><button type="button" class="primary" disabled={!selected.length && !reflectionNote.trim() && !next} onclick={saveReflection}>Save reflection</button><button type="button" onclick={dismissReflection}>Skip reflection</button></div>
		<p class="intro">You can stop here.</p>
	</section>{/if}
	<details class="loop-list"><summary>Your loops <small>{unresolved.length} open or paused</small></summary>
		{#each store.openLoops as loop (loop.id)}<article class="loop-row" aria-label={loop.title}>
			<div><strong>{loop.title}</strong><small>{loop.status === 'resolved' ? loop.resolution === 'released' ? 'Released' : 'Closed' : loop.status === 'paused' ? 'Paused' : 'Open'}</small></div>
			<div class="actions">{#if loop.status !== 'resolved'}<button type="button" onclick={() => log('closed', loop.id)}>Close loop</button><button type="button" onclick={() => log('released', loop.id)}>Let go</button>{:else}<button type="button" onclick={() => log('reopened', loop.id)}>Reopen loop</button>{/if}</div>
		</article>{:else}<p class="intro">No loops recorded. A moment needs no loop.</p>{/each}
	</details>
	{#if history.length}<details class="history"><summary>Loop record <small>{history.length} events</small></summary>
		<div class="records">{#each history as event (event.id)}
			{@const reflection = store.closureReflections.find(item => item.loopEventId === event.id)}
			<article class="record"><strong>{titleFor(event.loopId)}</strong><p>{verbs.find(verb => verb.value === event.type)?.label} · <time datetime={event.occurredAt}>{timeFor(event.occurredAt)}</time></p>
				{#if event.occurredAt !== event.recordedAt}<small>Entered {timeFor(event.recordedAt)}</small>{/if}
				{#if event.note}<p class="note">{event.note}</p>{/if}
				{#if reflection}<p>{reflection.descriptors.join(' · ')}</p>{#if reflection.note}<p class="note">{reflection.note}</p>{/if}{#if reflection.nextFeelsPossible}<small>Felt possible: {reflection.nextFeelsPossible === 'something' ? 'something else was approachable' : reflection.nextFeelsPossible === 'rest' ? 'rest' : 'nothing in particular'}</small>{/if}{/if}
				{#if event.type === 'closed' || event.type === 'released'}<button type="button" onclick={() => beginReflection(event)}>{reflection ? 'Edit reflection' : 'Add reflection'}</button>{/if}
			</article>
		{/each}</div>
	</details>{/if}
	<p class="feedback" role="status">{message}</p>
</section>

<style>
	.notebook { min-width: 0; border: 1px solid var(--car-line); border-radius: .9rem; padding: 1rem; background: var(--car-paper); color: var(--car-ink); font: .8rem/1.45 var(--car-body); scroll-margin-top: 1rem; }
	header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
	h2 { font: 500 1.5rem/1.1 var(--car-display); margin: .2rem 0; }
	h3 { font: 500 1.35rem/1.2 var(--car-display); margin: .4rem 0 .7rem; }
	.kicker { color: var(--car-ink-soft); font: .58rem var(--car-mono); letter-spacing: .08em; }
	.intro, small { color: var(--car-ink-soft); }
	.intro { margin: .5rem 0; }
	small { font-size: .7rem; }
	button, input, select, textarea { color: var(--car-ink); background: #ffffff80; border: 1px solid #44365b33; border-radius: .5rem; padding: .5rem .65rem; font: inherit; }
	button, summary { cursor: pointer; }
	button:disabled { opacity: .5; cursor: default; }
	button.primary { color: var(--car-paper); background: var(--car-ink); }
	.actions, .chips { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; margin: .6rem 0; }
	.chips button { border-radius: 99px; }
	button[aria-pressed='true'] { background: var(--car-pink-wash); border-color: var(--car-pink-dark); }
	.panel { border: 1px solid var(--car-line); background: var(--car-wash); padding: .85rem; border-radius: .7rem; margin: .7rem 0; }
	label { display: grid; gap: .3rem; margin: .6rem 0; }
	input, textarea, select { width: 100%; min-width: 0; }
	textarea { resize: vertical; }
	.question { margin-top: .75rem; }
	summary { padding: .3rem 0; }
	summary small { margin-left: .4rem; }
	.loop-list, .history { border-top: 1px solid var(--car-line); margin-top: .65rem; padding-top: .4rem; }
	.loop-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .6rem; border-bottom: 1px solid var(--car-line); padding: .6rem 0; }
	.loop-row > div:first-child { display: grid; gap: .2rem; min-width: 0; overflow-wrap: anywhere; }
	.records { max-height: 22rem; overflow: auto; }
	.record { display: grid; gap: .3rem; border-bottom: 1px solid var(--car-line); padding: .75rem 0; overflow-wrap: anywhere; }
	.record button { justify-self: start; }
	.note { white-space: pre-wrap; }
	.feedback:empty { display: none; }
	.feedback { margin-top: .6rem; color: var(--car-ink-soft); }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
</style>
