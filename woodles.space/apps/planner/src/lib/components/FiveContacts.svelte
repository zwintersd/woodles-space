<script lang="ts">
	import { tick } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { activeContacts } from '$lib/openLoops';
	import type { FiveContactsRound } from '$lib/types';

	let selectedId = $state('');
	let note = $state('');
	let linkedLoopId = $state('');
	let reflection = $state('');
	let reflectionFor = $state('');
	let feedback = $state('');
	let countButton: HTMLButtonElement | undefined = $state();
	let finishHeading: HTMLHeadingElement | undefined = $state();
	let activeRounds = $derived(store.fiveContactsRounds.filter(round => round.status === 'active'));
	let round = $derived(store.fiveContactsRounds.find(item => item.id === selectedId) ?? activeRounds[0] ?? null);
	let contacts = $derived(round ? activeContacts(round) : []);
	let additionalContacts = $derived(round?.contacts.filter(contact => !contact.removedAt && !contacts.some(counted => counted.id === contact.id)).sort((a, b) => a.at.localeCompare(b.at) || (a.sequence ?? 0) - (b.sequence ?? 0) || a.id.localeCompare(b.id)) ?? []);
	let loops = $derived(store.openLoops.filter(loop => loop.status === 'open' || loop.status === 'paused'));
	let history = $derived(store.fiveContactsRounds.filter(item => item.status !== 'active').sort((a, b) => b.startedAt.localeCompare(a.startedAt)));

	$effect(() => {
		if (round?.id !== reflectionFor) {
			reflectionFor = round?.id ?? '';
			reflection = round?.reflectionNote ?? '';
			note = '';
			linkedLoopId = '';
			feedback = '';
		}
	});

	function dateLabel(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.valueOf()) ? 'Saved round' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	function loopLabel(id: string): string {
		return store.openLoops.find(loop => loop.id === id)?.title ?? 'Linked loop unavailable';
	}

	async function start(): Promise<void> {
		const next = store.startFiveContactsRound();
		selectedId = next.id;
		queueSync();
		await tick();
		countButton?.focus();
	}

	async function count(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!round || round.status !== 'active') return;
		const id = round.id;
		selectedId = id;
		const added = store.countContact(id, { note: note.trim() || undefined, linkedLoopId: linkedLoopId || undefined });
		if (!added) {
			feedback = 'This round is already finished.';
			return;
		}
		queueSync();
		note = '';
		linkedLoopId = '';
		feedback = '';
		await tick();
		if (store.fiveContactsRounds.find(item => item.id === id)?.status === 'completed') finishHeading?.focus();
		else countButton?.focus();
	}

	async function undo(): Promise<void> {
		if (!round || !contacts.length) return;
		store.undoContact(round.id);
		queueSync();
		feedback = 'Last contact removed.';
		await tick();
		countButton?.focus();
	}

	async function stop(): Promise<void> {
		if (!round) return;
		const id = round.id;
		selectedId = id;
		store.stopFiveContactsRound(id);
		queueSync();
		await tick();
		finishHeading?.focus();
	}

	function saveReflection(): void {
		if (!round) return;
		store.reflectFiveContactsRound(round.id, reflection.trim());
		queueSync();
		feedback = 'Reflection saved.';
	}

	function viewRound(item: FiveContactsRound): void {
		selectedId = item.id;
	}
</script>

<section class="five-contacts" aria-labelledby="five-contacts-heading" data-testid="five-contacts">
	<header>
		<h2 id="five-contacts-heading">Five Contacts</h2>
		<span class="optional">optional</span>
	</header>
	{#if activeRounds.length > 1}
		<label class="round-picker">Continue a round
			<select value={round?.status === 'active' ? round.id : ''} onchange={event => selectedId = event.currentTarget.value}>
				{#if round?.status !== 'active'}<option value="" disabled>Choose an active round</option>{/if}
				{#each activeRounds as active (active.id)}
					<option value={active.id}>{dateLabel(active.startedAt)} · {activeContacts(active).length} / 5</option>
				{/each}
			</select>
		</label>
	{/if}
	{#if round?.status === 'active'}
		<div class="round" data-testid="five-contacts-active">
			<p class="counter" role="status" aria-live="polite" aria-atomic="true"><strong>{contacts.length}</strong><span> / 5 contacts</span></p>
			<p class="hint">Small contacts count. Stay with something or switch as you go.</p>
			<form onsubmit={count}>
				<details class="contact-details">
					<summary>Add a note or loop <span>optional</span></summary>
					<label>Note for the next contact<textarea bind:value={note} rows="2" maxlength="2000" placeholder="Picked up a towel, switched to the kitchen…"></textarea></label>
					{#if loops.length}
						<label>Link the next contact to a loop
							<select bind:value={linkedLoopId}><option value="">No linked loop</option>{#each loops as loop (loop.id)}<option value={loop.id}>{loop.title}{loop.status === 'paused' ? ' (paused)' : ''}</option>{/each}</select>
						</label>
					{/if}
				</details>
				<div class="actions"><button type="submit" class="primary" bind:this={countButton}>Count a contact</button><button type="button" disabled={!contacts.length} onclick={undo}>Undo</button></div>
			</form>
			<button type="button" class="quiet" onclick={stop}>Stop this round</button>
		</div>
	{:else if round}
		<div class="round finished" data-testid="five-contacts-finished">
			<h3 tabindex="-1" bind:this={finishHeading}>{round.status === 'completed' ? 'Five contacts complete.' : 'Round stopped.'}</h3>
			<p class="hint">{round.status === 'stopped' ? `${contacts.length} / 5 contacts recorded. ` : ''}You can stop here.</p>
			<p class="hint">Finishing a round leaves any linked loops as they are.</p>
			<form onsubmit={event => { event.preventDefault(); saveReflection(); }}>
				<label>Anything feel different? <span class="optional">optional</span><textarea bind:value={reflection} rows="2" maxlength="4000" placeholder="A change, no change, or anything you noticed"></textarea></label>
				<div class="actions"><button type="submit">Save reflection</button><button type="button" onclick={() => { selectedId = ''; feedback = ''; }}>Done</button>{#if round.status === 'completed'}<button type="button" onclick={undo}>Undo last contact</button>{/if}</div>
			</form>
		</div>
	{:else}
		<p class="hint">Five contacts, chosen as you go. No task list or timer needed.</p>
		<button type="button" class="start" onclick={start}>Start Five Contacts</button>
	{/if}
	{#if feedback}<p class="feedback" role="status">{feedback}</p>{/if}
	{#if contacts.length && round}
		<details class="recorded"><summary>Recorded contacts <span>{contacts.length}</span></summary>
			<ol>{#each contacts as contact (contact.id)}<li>{contact.note || 'Contact recorded'}<small>{dateLabel(contact.at)}</small>{#if contact.linkedLoopId}<small>Loop: {loopLabel(contact.linkedLoopId)}</small>{/if}</li>{/each}</ol>
		</details>
	{/if}
	{#if additionalContacts.length}
		<details class="additional"><summary>Other contacts arrived from another device.</summary>
			<p class="hint">This round still counts five. These other recorded contacts are kept here.</p>
			<ul>{#each additionalContacts as contact (contact.id)}<li>{contact.note || 'Contact recorded'}<small>{dateLabel(contact.at)}</small>{#if contact.linkedLoopId}<small>Loop: {loopLabel(contact.linkedLoopId)}</small>{/if}</li>{/each}</ul>
		</details>
	{/if}
	{#if history.length}
		<details class="history"><summary>Past rounds <span>{history.length}</span></summary>
			<ul>{#each history as past (past.id)}<li><button type="button" class="past-round" onclick={() => viewRound(past)}><span>{dateLabel(past.startedAt)}</span><small>{past.status === 'completed' ? 'Complete' : 'Stopped'} · {activeContacts(past).length} / 5</small></button>{#if past.reflectionNote}<p>{past.reflectionNote}</p>{/if}</li>{/each}</ul>
		</details>
	{/if}
</section>

<style>
	.five-contacts { border: 1px solid var(--car-vellum-edge); border-radius: 1rem; background: var(--car-corners), var(--car-vellum); outline: 1px solid var(--car-gilt-rule); outline-offset: -6px; box-shadow: 0 .8rem 2.4rem var(--car-shadow); padding: 1.1rem 1.2rem; color: var(--car-ink); font: .78rem var(--car-body); }
	header { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; }
	h2 { margin: 0; font: 1.4rem var(--car-fell); }
	h2::after { content: ''; display: block; width: 8.5rem; height: .85rem; margin-top: .3rem; background: var(--car-orn-divider) left center / contain no-repeat; }
	h3 { margin: .9rem 0 .3rem; font: 1.3rem var(--car-fell); }
	.optional, summary span, .hint, small { color: var(--car-ink-soft); }
	.optional { font-size: .68rem; font-weight: normal; }
	.hint { line-height: 1.6; margin: .5rem 0 .8rem; }
	.counter { display: flex; align-items: baseline; gap: .25rem; margin: .8rem 0 .2rem; font-family: var(--car-mono); }
	.counter strong { font: 2rem var(--car-display); }
	button, select, textarea { font: inherit; color: var(--car-ink); border: 1px solid #44365b33; border-radius: .5rem; background: #ffffff90; padding: .55rem .7rem; }
	button { cursor: pointer; min-height: 2.5rem; }
	button:disabled { opacity: .5; cursor: default; }
	.primary, .start { background: var(--car-pink-wash); border-color: #a7667e66; }
	.primary { flex: 1; }
	.actions { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; margin: .7rem 0; }
	.quiet { background: transparent; border-color: transparent; padding: .35rem 0; color: var(--car-ink-soft); }
	label { display: grid; gap: .35rem; line-height: 1.5; margin: .7rem 0; }
	textarea, select { width: 100%; min-width: 0; box-sizing: border-box; }
	textarea { resize: vertical; }
	details { border-top: 1px solid #44365b18; margin-top: .75rem; padding-top: .65rem; }
	.contact-details { margin-top: .5rem; border: 0; padding: 0; }
	summary { cursor: pointer; line-height: 1.6; }
	summary span { font-size: .68rem; margin-left: .3rem; }
	ol { margin: .5rem 0 0; padding-left: 1.2rem; }
	ol li, .additional li { margin: .45rem 0; line-height: 1.5; overflow-wrap: anywhere; }
	small { display: block; font-size: .68rem; }
	.history ul { list-style: none; padding: 0; margin: .6rem 0 0; }
	.history li + li { margin-top: .55rem; }
	.past-round { text-align: left; display: grid; gap: .25rem; width: 100%; }
	.history li p { margin: .35rem .25rem .7rem; white-space: pre-wrap; overflow-wrap: anywhere; }
	.feedback { color: var(--car-ink-soft); margin: .5rem 0; }
	:focus-visible { outline: 2px solid var(--car-pink-dark); outline-offset: 3px; }
	@media print { .five-contacts { display: none; } }
</style>
