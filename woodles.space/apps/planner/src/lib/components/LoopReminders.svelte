<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { laterTime, type LaterChoice } from '$lib/reminders';
	import type { LoopReminder } from '$lib/types';

	let due = $derived(store.getDueReminders(store.now));
	let message = $state('');
	const titleFor = (id: string) => store.openLoops.find(loop => loop.id === id)?.title ?? 'An open loop';
	const timeFor = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	const closedAt = (reminder: LoopReminder) => store.loopEvents.find(event => event.id === reminder.afterEventId)?.occurredAt;

	function thanks(reminder: LoopReminder) {
		store.endLoopReminder(reminder.id, 'acknowledged');
		queueSync(); message = 'Reminder finished.';
	}
	function later(reminder: LoopReminder, choice: LaterChoice) {
		const next = laterTime(choice, new Date(), store.settings.wakeAnchor);
		store.moveLoopReminder(reminder.id, next);
		queueSync(); message = `Moved to ${timeFor(next.toISOString())}.`;
	}
	function needIsBack(reminder: LoopReminder) {
		store.recordLoopEvent({ loopId: reminder.loopId, type: 'reopened' });
		store.endLoopReminder(reminder.id, 'acknowledged');
		queueSync(); message = `Next cycle of “${titleFor(reminder.loopId)}” started.`;
	}
</script>

{#if due.length || message}
	<section class="reminders" aria-labelledby="reminders-heading" data-testid="loop-reminders">
		<p class="kicker">only the ones you set</p>
		<h2 id="reminders-heading">{due.length === 1 ? 'A reminder you asked for' : due.length ? 'Reminders you asked for' : 'Reminders'}</h2>
		{#each due as reminder (reminder.id)}
			{@const title = titleFor(reminder.loopId)}
			<article aria-label={`Reminder: ${title}`}>
				<strong>{title}</strong>
				{#if reminder.afterEventId && closedAt(reminder)}<p>The last cycle closed {timeFor(closedAt(reminder)!)}. The rhythm you chose has passed.</p>{/if}
				{#if reminder.note}<p class="note">{reminder.note}</p>{/if}
				<small>Set for {timeFor(reminder.dueAt)}</small>
				<div class="actions">
					{#if reminder.afterEventId}
						<button type="button" onclick={() => needIsBack(reminder)}>Need is back</button>
						<button type="button" onclick={() => later(reminder, 'day')}>Not yet</button>
						<button type="button" onclick={() => thanks(reminder)}>Thanks</button>
					{:else}
						<button type="button" onclick={() => thanks(reminder)}>Thanks</button>
						<button type="button" onclick={() => later(reminder, 'hour')}>In an hour</button>
						<button type="button" onclick={() => later(reminder, 'tomorrow')}>Tomorrow</button>
					{/if}
				</div>
			</article>
		{/each}
		{#if message}<p class="feedback" role="status">{message}</p>{/if}
	</section>
{/if}

<style>
	.reminders { border: 1px solid var(--car-vellum-edge); border-radius: .9rem; padding: 1rem 1.1rem; background: var(--car-vellum); outline: 1px solid var(--car-gilt-rule); outline-offset: -6px; box-shadow: 0 .8rem 2.4rem var(--car-shadow); color: var(--car-ink); font: .8rem/1.45 var(--car-body); }
	.kicker { margin: 0; color: var(--car-ink-soft); font: .58rem var(--car-mono); letter-spacing: .08em; }
	h2 { font: 400 1.3rem/1.15 var(--car-fell); margin: .2rem 0 .4rem; }
	article { display: grid; gap: .25rem; padding: .6rem 0; border-top: 1px solid var(--car-line); overflow-wrap: anywhere; }
	p { margin: 0; }
	.note { white-space: pre-wrap; }
	small, .feedback { color: var(--car-ink-soft); font-size: .7rem; }
	.feedback { margin-top: .4rem; }
	.actions { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .35rem; }
	button { color: var(--car-ink); background: #ffffff80; border: 1px solid #44365b33; border-radius: .5rem; padding: .5rem .65rem; font: inherit; cursor: pointer; min-height: 2.4rem; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
</style>
