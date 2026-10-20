<script lang="ts">
	import { tick } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { laterTime, type LaterChoice } from '$lib/reminders';
	import { rhythmOffers } from '$lib/loopInference';
	import { daysLabel } from '$lib/loopAnalysis';
	import { toLocalInputValue } from '$lib/utils';
	import type { LoopEventType, OpenLoop } from '$lib/types';

	let { loop, onlog }: { loop: OpenLoop; onlog: (type: LoopEventType, loopId: string) => void } = $props();

	let panel = $state<'' | 'edit' | 'remind'>('');
	let title = $state(''), recurring = $state(false), rhythm = $state(''), remindAfter = $state(false);
	let when = $state(''), reminderNote = $state(''), message = $state('');
	let firstField: HTMLInputElement | undefined = $state();
	let reminders = $derived(store.getLiveReminders(loop.id));
	let lastClosed = $derived(loop.recurring ? store.loopEvents.filter(event => event.loopId === loop.id && event.type === 'closed').map(event => event.occurredAt).sort().at(-1) : undefined);
	let observedRhythm = $derived(rhythmOffers([loop], store.loopEvents)[0]);
	let statusText = $derived(loop.status === 'resolved'
		? loop.resolution === 'released' ? 'Released' : loop.recurring ? 'Between cycles' : 'Closed'
		: loop.status === 'paused' ? 'Paused' : 'Open');
	const timeFor = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	const notificationsSupported = typeof Notification !== 'undefined';

	async function toggle(next: 'edit' | 'remind') {
		message = '';
		panel = panel === next ? '' : next;
		if (panel === 'edit') {
			title = loop.title; recurring = Boolean(loop.recurring);
			rhythm = loop.rhythmDays ? String(loop.rhythmDays) : ''; remindAfter = Boolean(loop.remindAfterClosure);
		}
		if (panel === 'remind') { when = ''; reminderNote = ''; }
		if (panel) { await tick(); firstField?.focus(); }
	}

	function saveEdit() {
		const saved = store.updateOpenLoop(loop.id, { title, recurring, rhythmDays: rhythm, remindAfterClosure: remindAfter });
		if (!saved) { message = 'Give the loop a name.'; return; }
		queueSync(); panel = '';
		message = 'Loop details saved.';
	}

	function pick(choice: LaterChoice) {
		when = toLocalInputValue(laterTime(choice, new Date(), store.settings.wakeAnchor).toISOString());
	}

	function saveReminder() {
		const due = new Date(when);
		const saved = store.createLoopReminder(loop.id, due.toISOString(), reminderNote);
		if (!saved) { message = 'Choose a time from now on.'; return; }
		queueSync(); panel = '';
		message = `Reminder set for ${timeFor(saved.dueAt)}.`;
	}

	function cancelReminder(id: string) {
		store.endLoopReminder(id, 'cancelled');
		queueSync();
		message = 'Reminder cancelled.';
	}

	async function setNotifications(box: HTMLInputElement) {
		if (!box.checked) { store.updateSettings({ reminderNotifications: false }); queueSync(); return; }
		const refuse = (text: string) => { box.checked = false; message = text; };
		if (!notificationsSupported) { refuse('This browser can’t show notifications. Reminders still appear on Today.'); return; }
		const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
		if (permission !== 'granted') { refuse('Notifications are blocked for this site. Reminders still appear on Today.'); return; }
		store.updateSettings({ reminderNotifications: true }); queueSync();
	}
</script>

<article class="loop-row" aria-label={loop.title}>
	<div class="loop-main">
		<div class="loop-text">
			<strong>{loop.title}</strong>
			<small>{statusText}{loop.recurring ? ` · recurring${loop.rhythmDays ? ` · about every ${daysLabel(loop.rhythmDays)}` : ''}` : ''}</small>
			{#if lastClosed}<small>Last cycle closed {timeFor(lastClosed)}</small>{/if}
			{#each reminders as reminder (reminder.id)}<small class="reminder-line">Reminder {timeFor(reminder.dueAt)}{reminder.note ? ` · ${reminder.note}` : ''} <button type="button" class="link" onclick={() => cancelReminder(reminder.id)} aria-label={`Cancel reminder for ${loop.title} at ${timeFor(reminder.dueAt)}`}>cancel</button></small>{/each}
		</div>
		<div class="actions">
			{#if loop.status !== 'resolved'}
				<button type="button" onclick={() => onlog('closed', loop.id)}>{loop.recurring ? 'Close this cycle' : 'Close loop'}</button>
				<button type="button" onclick={() => onlog('released', loop.id)}>Let go</button>
			{:else}
				<button type="button" onclick={() => onlog('reopened', loop.id)}>{loop.recurring && loop.resolution === 'completed' ? 'Need is back' : 'Reopen loop'}</button>
			{/if}
		</div>
	</div>
	<div class="secondary">
		<button type="button" class="link" aria-expanded={panel === 'edit'} onclick={() => toggle('edit')}>Edit loop</button>
		{#if loop.status !== 'resolved'}<button type="button" class="link" aria-expanded={panel === 'remind'} onclick={() => toggle('remind')}>Remind me</button>{/if}
	</div>
	{#if panel === 'edit'}<form class="panel" aria-label={`Edit ${loop.title}`} onsubmit={event => { event.preventDefault(); saveEdit(); }}>
		<label>Loop title<input bind:this={firstField} bind:value={title} maxlength="200" required /></label>
		<label class="check"><input type="checkbox" bind:checked={recurring} /> This is a recurring need</label>
		<small>Closing a recurring loop ends one cycle. Nothing reopens by itself; you say when the need is back.</small>
		{#if recurring}
			<label>Usual rhythm, in days <small>optional</small><input type="number" min="0.5" max="365" step="0.5" bind:value={rhythm} placeholder="2" /></label>
			{#if observedRhythm}<p class="hint">Your cycles have run about every {daysLabel(observedRhythm.days)} across {observedRhythm.cycles} closures. <button type="button" class="link" onclick={() => rhythm = String(observedRhythm.days)}>Use {daysLabel(observedRhythm.days)}</button></p>{/if}
			<label class="check"><input type="checkbox" bind:checked={remindAfter} disabled={!Number(rhythm)} /> Remind me this long after each closed cycle</label>
		{/if}
		<div class="actions"><button class="primary" disabled={!title.trim()}>Save loop details</button><button type="button" onclick={() => panel = ''}>Cancel</button></div>
	</form>{/if}
	{#if panel === 'remind'}<form class="panel" aria-label={`Reminder for ${loop.title}`} onsubmit={event => { event.preventDefault(); saveReminder(); }}>
		<div class="chips" role="group" aria-label="Quick times">
			<button type="button" onclick={() => pick('hour')}>In an hour</button>
			<button type="button" onclick={() => pick('evening')}>This evening</button>
			<button type="button" onclick={() => pick('tomorrow')}>Tomorrow morning</button>
		</div>
		<label>Remind me at<input bind:this={firstField} type="datetime-local" bind:value={when} required /></label>
		<label>Reminder note <small>optional</small><input bind:value={reminderNote} maxlength="200" placeholder="Just the message, not the whole conversation" /></label>
		<label class="check"><input type="checkbox" checked={Boolean(store.settings.reminderNotifications)} onchange={event => setNotifications(event.currentTarget)} /> Also use browser notifications for reminders</label>
		<small>It appears on Today when it’s time{store.settings.reminderNotifications ? ', and as a notification outside quiet hours' : ''}. It won’t repeat.</small>
		<div class="actions"><button class="primary" disabled={!when}>Save reminder</button><button type="button" onclick={() => panel = ''}>Cancel</button></div>
	</form>{/if}
	{#if message}<p class="row-feedback" role="status">{message}</p>{/if}
</article>

<style>
	.loop-row { border-bottom: 1px solid var(--car-line); padding: .6rem 0; }
	.loop-main { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .6rem; }
	.loop-text { display: grid; gap: .2rem; min-width: 0; overflow-wrap: anywhere; }
	small { color: var(--car-ink-soft); font-size: .7rem; }
	button, input { color: var(--car-ink); background: #ffffff80; border: 1px solid #44365b33; border-radius: .5rem; padding: .5rem .65rem; font: inherit; }
	button { cursor: pointer; }
	button:disabled { opacity: .5; cursor: default; }
	button.primary { color: var(--car-paper); background: var(--car-ink); }
	.link { border: 0; background: transparent; padding: .2rem 0; color: var(--car-ink-soft); text-decoration: underline; text-underline-offset: .2em; font-size: .72rem; }
	.secondary { display: flex; gap: .9rem; margin-top: .25rem; }
	.reminder-line .link { font-size: .68rem; }
	.actions, .chips { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; margin: .5rem 0; }
	.chips button { border-radius: 99px; }
	.panel { border: 1px solid var(--car-line); background: var(--car-wash); padding: .85rem; border-radius: .7rem; margin: .6rem 0; }
	label { display: grid; gap: .3rem; margin: .6rem 0; }
	label.check { display: flex; align-items: center; gap: .45rem; }
	label.check input { width: auto; }
	input { width: 100%; min-width: 0; box-sizing: border-box; }
	.hint { margin: .3rem 0; color: var(--car-ink-soft); font-size: .72rem; }
	.row-feedback { margin: .3rem 0 0; color: var(--car-ink-soft); font-size: .72rem; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
</style>
