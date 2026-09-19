<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { dateKey } from '$lib/utils';
	import { mentions, letterHref } from '$lib/mentions.svelte';
	import { INTERVAL_KIND_OPTIONS } from '$lib/instrument';
	let {
		onopenpiles,
		onopenroutines,
		onopensurge
	}: { onopenpiles: () => void; onopenroutines: () => void; onopensurge: () => void } = $props();
	let selectedDate = $state(dateKey(store.now));
	let note = $state(''),
		notice = $state(''),
		compareDate = $state('');
	let dates = $derived(
		[
			...new Set([
				dateKey(store.now),
				...store.intervalObservations.map((o) => o.date),
				...store.routinePractices.map((p) => p.date),
				...store.surgeDrafts.map((d) => dateKey(new Date(d.createdAt))),
				...Object.keys(store.dayOverrides),
				...store.sleepLogs.map((s) => s.date),
				...store.signalEntries.map((s) => s.date),
				...store.tasks.map((t) => t.targetDate).filter((d): d is string => Boolean(d))
			])
		].sort((a, b) => b.localeCompare(a))
	);
	let observations = $derived(store.getObservationsForDate(selectedDate));
	let practices = $derived(store.routinePractices.filter((p) => p.date === selectedDate));
	let ideas = $derived(
		store.surgeDrafts.filter((d) => dateKey(new Date(d.createdAt)) === selectedDate)
	);
	let tasks = $derived(store.getTasksForDay(selectedDate));
	let pileId = $derived(store.dayOverrides[selectedDate]?.dayShapeId);
	let comparable = $derived(
		dates.filter(
			(d) => d !== selectedDate && pileId && store.dayOverrides[d]?.dayShapeId === pileId
		)
	);
	let comparison = $derived(compareDate ? store.getObservationsForDate(compareDate) : []);
	$effect(() => {
		void mentions.refresh();
	});
	$effect(() => {
		note = store.dayOverrides[selectedDate]?.note ?? '';
		compareDate = '';
		notice = '';
	});
	function save() {
		store.saveDayNote(selectedDate, note);
		queueSync();
		notice = 'Note saved.';
	}
</script>

<section class="workbench">
	<header class="wb-heading">
		<div>
			<p class="wb-kicker">Editions · review</p>
			<h1>Look back at the day.</h1>
			<p>Review your records and decide what to change next time.</p>
		</div>
		<label
			>Review date<input type="date" max={dateKey(store.now)} bind:value={selectedDate} /></label
		>
	</header>
	<div class="wb-strip">
		{#each dates.slice(0, 14) as date}<button
				aria-pressed={selectedDate === date}
				onclick={() => (selectedDate = date)}>{date}</button
			>{/each}
	</div>
	<div class="wb-grid">
		<aside>
			<section class="wb-card">
				<h2>Recorded activity</h2>
				<p>{observations.length} observations</p>
				{#each INTERVAL_KIND_OPTIONS as option}{@const count = observations.filter(
						(o) => o.kind === option.kind
					).length}{#if count}<p>{option.shortLabel} · {count}</p>{/if}{/each}
				<p class="wb-note">
					Counts describe recorded moments, not the proportion of your day. Recalled stretches count
					as one record.
				</p>
			</section>
			<section class="wb-card">
				<h2>Make a change</h2>
				<div class="wb-list">
					<button onclick={onopenpiles}>Edit day piles</button><button onclick={onopenroutines}
						>Revise routines</button
					><button onclick={onopensurge}>Review ideas</button>
				</div>
			</section>
			{#if comparable.length}<section class="wb-card">
					<h2>Same day pile</h2>
					<label
						>Compare recorded days<select bind:value={compareDate}
							><option value="">Choose a date</option>{#each comparable as date}<option value={date}
									>{date}</option
								>{/each}</select
						></label
					>{#if compareDate}<p>
							{selectedDate}: {observations.length} records<br />{compareDate}: {comparison.length} records
						</p>
						{#each INTERVAL_KIND_OPTIONS as option}<p>
								{option.shortLabel}: {observations.filter((o) => o.kind === option.kind).length} / {comparison.filter(
									(o) => o.kind === option.kind
								).length}
							</p>{/each}
						<p class="wb-note">
							These days have a saved reference to the same pile. Activities and recording coverage
							may differ.
						</p>{/if}
				</section>{/if}
		</aside>
		<div>
			<article class="wb-card wb-paper">
				<p class="wb-kicker">Carillon · Edition</p>
				<h2>{selectedDate}</h2>
				{#if observations.length}<table>
						<thead><tr><th>Time</th><th>Planned</th><th>Recorded</th></tr></thead><tbody
							>{#each observations as o}<tr
									><td
										>{o.intervalStart}<br /><small
											>{o.source === 'recall'
												? 'Recalled · ' + o.intervalMinutes + ' min'
												: o.source === 'paper'
													? 'Paper'
													: 'Live'}</small
										></td
									><td>{o.plannedLabel ?? 'No activity planned'}</td><td
										>{o.label}{#if o.note}<p>{o.note}</p>{/if}</td
									></tr
								>{/each}</tbody
						>
					</table>{:else}<p>No observations for this day.</p>{/if}
				<p class="wb-note">
					Unrecorded intervals are not shown. Planned labels reflect what was saved with each
					observation.
				</p>
			</article>
			<form
				class="wb-card wb-paper"
				onsubmit={(e) => {
					e.preventDefault();
					save();
				}}
			>
				<h2>Your notes</h2>
				<label>What would you keep or change?<textarea rows="4" bind:value={note}></textarea></label
				><button class="primary">Save note</button>
				<p role="status">{notice}</p>
			</form>
			{#if practices.length}<section class="wb-card">
					<h2>Routine records</h2>
					{#each practices as practice}<details>
							<summary
								>{practice.routineName ??
									store.routines.find((r) => r.id === practice.routineId)?.name ??
									'Removed routine'} · {Math.round(practice.independence * 100)}% independent</summary
							>{#each practice.steps ?? store.routines.find((r) => r.id === practice.routineId)?.steps ?? [] as step}<p
								>
									{step.label}: {practice.results[step.id] ?? 'Unrecorded'}
								</p>{/each}
						</details>{/each}
				</section>{/if}
			{#if tasks.length}<section class="wb-card">
					<h2>Tasks</h2>
					{#each tasks as task}<div class="wb-row">
							<button onclick={() => store.openTaskEdit(task.id)}>{task.title}</button><span
								>{task.status} · edit or reschedule</span
							>
						</div>{/each}
				</section>{/if}
			{#if ideas.length}<section class="wb-card">
					<h2>Ideas saved</h2>
					{#each ideas as idea}<p>
							{idea.title} · {(idea.promotedTaskIds ?? []).length} linked tasks
						</p>{/each}<button onclick={onopensurge}>Open ideas</button>
				</section>{/if}
			{#if store.getSleepLog(selectedDate) || store.signalEntries.some((s) => s.date <= selectedDate && (s.endDate ?? s.date) >= selectedDate)}<section
					class="wb-card"
				>
					<h2>Context</h2>
					{#if store.getSleepLog(selectedDate)}<p>
							Sleep: {store.getSleepLog(selectedDate)?.quality}
						</p>{/if}{#each store.signalEntries.filter((s) => s.date <= selectedDate && (s.endDate ?? s.date) >= selectedDate) as signal}<p
						>
							{signal.label ?? signal.kind}{signal.note ? ' · ' + signal.note : ''}
						</p>{/each}
				</section>{/if}
			{#if mentions.forDay(selectedDate).length}<section class="wb-card">
					<h2>Written about</h2>
					{#each mentions.forDay(selectedDate) as letter}<p>
							<a class="wb-link" href={letterHref(letter.letterId)}
								>{letter.title || 'Untitled letter'}</a
							>
						</p>{/each}
				</section>{/if}
		</div>
	</div>
</section>
