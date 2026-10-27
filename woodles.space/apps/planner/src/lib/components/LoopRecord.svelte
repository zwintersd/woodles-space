<script lang="ts">
	import { tick } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { isLifecycleEvent } from '$lib/openLoops';
	import { toLocalInputValue } from '$lib/utils';
	import type { LoopEvent } from '$lib/types';

	let { event, label, titleFor, onreflect }: {
		event: LoopEvent; label: string; titleFor: (id?: string) => string; onreflect: (event: LoopEvent) => void;
	} = $props();

	let editing = $state(false), when = $state(''), loopId = $state(''), note = $state(''), message = $state('');
	let whenInput: HTMLInputElement | undefined = $state();
	let reflection = $derived(store.closureReflections.find(item => item.loopEventId === event.id));
	let lifecycle = $derived(isLifecycleEvent(event.type));
	const timeFor = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

	async function startEdit() {
		editing = !editing; message = '';
		if (!editing) return;
		when = toLocalInputValue(event.occurredAt); loopId = event.loopId ?? ''; note = event.note ?? '';
		await tick(); whenInput?.focus();
	}

	function save() {
		const at = new Date(when);
		if (!when || !Number.isFinite(at.getTime())) { message = 'Choose a valid time.'; return; }
		// Keep the original seconds when the minute shown wasn't changed.
		const occurredAt = toLocalInputValue(event.occurredAt) === when ? event.occurredAt : at.toISOString();
		const saved = store.updateLoopEvent(event.id, { occurredAt, note, loopId: lifecycle ? undefined : loopId || null });
		if (!saved) { message = 'That time is in the future. Choose when it happened.'; return; }
		queueSync(); editing = false; message = 'Event updated.';
	}
</script>

<article class="record">
	<strong>{titleFor(event.loopId)}</strong>
	<p>{label} · <time datetime={event.occurredAt}>{timeFor(event.occurredAt)}</time></p>
	{#if event.originalOccurredAt}<small>Time corrected · first entered as {timeFor(event.originalOccurredAt)}</small>{/if}
	{#if event.occurredAt !== event.recordedAt}<small>Entered {timeFor(event.recordedAt)}</small>{/if}
	{#if event.note}<p class="note">{event.note}</p>{/if}
	{#if reflection}<p>{reflection.descriptors.join(' · ')}</p>{#if reflection.note}<p class="note">{reflection.note}</p>{/if}{#if reflection.nextFeelsPossible}<small>Felt possible: {reflection.nextFeelsPossible === 'something' ? 'something else was approachable' : reflection.nextFeelsPossible === 'rest' ? 'rest' : 'nothing in particular'}</small>{/if}{/if}
	<div class="actions">
		<button type="button" aria-expanded={editing} onclick={startEdit} aria-label={`Edit ${label.toLowerCase()} event for ${titleFor(event.loopId)}`}>Edit event</button>
		{#if event.type === 'closed' || event.type === 'released'}<button type="button" onclick={() => onreflect(event)}>{reflection ? 'Edit reflection' : 'Add reflection'}</button>{/if}
	</div>
	{#if editing}<form class="panel" aria-label="Correct this event" onsubmit={submit => { submit.preventDefault(); save(); }}>
		<label>When it happened<input bind:this={whenInput} type="datetime-local" bind:value={when} max={toLocalInputValue(new Date().toISOString())} required /></label>
		{#if lifecycle}<small>Closures, pauses, releases and reopenings stay with their loop.</small>
		{:else}<label>Which loop?<select bind:value={loopId}><option value="">No linked loop</option>{#each store.openLoops as loop (loop.id)}<option value={loop.id}>{loop.title}</option>{/each}</select></label>{/if}
		<label>Event note <small>optional</small><textarea bind:value={note} rows="2"></textarea></label>
		<small>The time you first entered stays in the record.</small>
		<div class="actions"><button class="primary">Save event changes</button><button type="button" onclick={() => editing = false}>Cancel</button></div>
	</form>{/if}
	{#if message}<small role="status">{message}</small>{/if}
</article>

<style>
	.record { display: grid; gap: .3rem; border-bottom: 1px solid var(--car-line); padding: .75rem 0; overflow-wrap: anywhere; }
	p { margin: 0; }
	small { color: var(--car-ink-soft); font-size: .7rem; }
	.note { white-space: pre-wrap; }
	button, input, select, textarea { color: var(--car-ink); background: #ffffff80; border: 1px solid #44365b33; border-radius: .5rem; padding: .5rem .65rem; font: inherit; }
	button { cursor: pointer; }
	button.primary { color: var(--car-paper); background: var(--car-ink); }
	.actions { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; margin: .3rem 0; }
	.panel { border: 1px solid var(--car-line); background: var(--car-wash); padding: .85rem; border-radius: .7rem; margin: .3rem 0; }
	label { display: grid; gap: .3rem; margin: .6rem 0; }
	input, select, textarea { width: 100%; min-width: 0; box-sizing: border-box; }
	textarea { resize: vertical; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
</style>
