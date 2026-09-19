<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { uid, dateKey } from '$lib/utils';
	import type { Routine, RoutineStepResult } from '$lib/types';
	import RoutineRunner from './RoutineRunner.svelte';
	let selectedId = $state('');
	let editing = $state<Routine | null>(null);
	let archived = $state(false);
	let confirmDelete = $state(false);
	let notice = $state('');
	let results = $state<Record<string, RoutineStepResult>>({});
	let routines = $derived(
		store.routines.filter((r) => !r.deletedAt && Boolean(r.archived) === archived)
	);
	let selected = $derived(routines.find((r) => r.id === selectedId) ?? routines[0]);
	let practices = $derived(
		store.routinePractices
			.filter((p) => p.routineId === selected?.id)
			.sort((a, b) => b.date.localeCompare(a.date))
	);
	function edit(r: Routine) {
		editing = { ...r, steps: r.steps.map((s) => ({ ...s })) };
		confirmDelete = false;
	}
	function create() {
		edit({
			id: uid(),
			name: '',
			cue: '',
			steps: [{ id: uid(), label: '' }],
			createdAt: new Date().toISOString()
		});
	}
	function save() {
		if (
			!editing ||
			!editing.name.trim() ||
			!editing.steps.length ||
			editing.steps.some((s) => !s.label.trim())
		) {
			notice = 'Add a name and at least one step. Each step needs text.';
			return;
		}
		if (store.routines.some((r) => r.id === editing?.id)) store.updateRoutine(editing.id, editing);
		else {
			const r = store.addRoutine(
				editing.name,
				editing.steps.map((s) => s.label),
				editing.cue
			);
			if (r) selectedId = r.id;
		}
		editing = null;
		queueSync();
		notice = 'Routine saved.';
	}
	function move(i: number, offset: number) {
		if (!editing) return;
		const steps = [...editing.steps];
		[steps[i], steps[i + offset]] = [steps[i + offset], steps[i]];
		editing.steps = steps;
	}
	function record() {
		if (!selected) return;
		store.recordRoutinePractice(selected.id, results);
		queueSync();
		notice = 'Record saved.';
	}
</script>

<section class="workbench">
	<header class="wb-heading">
		<div>
			<p class="wb-kicker">Routines</p>
			<h1>Keep the steps you need.</h1>
			<p>Use a checklist, or edit the task analysis behind it.</p>
		</div>
		<button onclick={create}>+ New routine</button>
	</header>
	<div class="wb-grid">
		<aside>
			<div class="wb-actions">
				<button
					aria-pressed={!archived}
					onclick={() => {
						archived = false;
						editing = null;
					}}>Active</button
				><button
					aria-pressed={archived}
					onclick={() => {
						archived = true;
						editing = null;
					}}>Archived</button
				>
			</div>
			<div class="wb-list">
				{#each routines as r}<button
						aria-pressed={selected?.id === r.id}
						onclick={() => {
							selectedId = r.id;
							editing = null;
							results = {};
							confirmDelete = false;
						}}>{r.name}<small>{r.steps.length} steps</small></button
					>{:else}<p>No {archived ? 'archived' : 'active'} routines.</p>{/each}
			</div>
		</aside>
		<div>
			{#if editing}<form
					class="wb-card wb-paper"
					onsubmit={(e) => {
						e.preventDefault();
						save();
					}}
				>
					<h2>Edit routine</h2>
					<label>Routine name<input required bind:value={editing.name} /></label><label
						>Cue<input bind:value={editing.cue} placeholder="When will you use this?" /></label
					>
					{#each editing.steps as step, i (step.id)}<div class="wb-row">
							<label>Step {i + 1}<input required bind:value={step.label} /></label>
							<div class="wb-actions">
								<button
									type="button"
									disabled={i === 0}
									onclick={() => move(i, -1)}
									aria-label={'Move step ' + (i + 1) + ' up'}>↑</button
								><button
									type="button"
									disabled={i === editing.steps.length - 1}
									onclick={() => move(i, 1)}
									aria-label={'Move step ' + (i + 1) + ' down'}>↓</button
								><button
									type="button"
									onclick={() => {
										if (editing) editing.steps = editing.steps.filter((s) => s.id !== step.id);
									}}>Remove</button
								>
							</div>
						</div>{/each}
					<div class="wb-actions">
						<button
							type="button"
							onclick={() => {
								if (editing) editing.steps = [...editing.steps, { id: uid(), label: '' }];
							}}>+ Add step</button
						><button type="submit" class="primary">Save routine</button><button
							type="button"
							onclick={() => (editing = null)}>Cancel</button
						>
					</div>
				</form>
			{:else if selected}<div class="wb-actions">
					<button
						onclick={() => {
							if (selected) edit(selected);
						}}>Edit routine</button
					><button
						onclick={() => {
							if (!selected) return;
							edit({
								...selected,
								id: uid(),
								name: selected.name + ' copy',
								archived: false,
								steps: selected.steps.map((s) => ({ ...s, id: uid() }))
							});
						}}>Duplicate</button
					><button
						onclick={() => {
							if (!selected) return;
							store.updateRoutine(selected.id, { archived: !selected.archived });
							queueSync();
						}}
					>
						{selected.archived ? 'Restore' : 'Archive'}</button
					><button class="wb-danger" onclick={() => (confirmDelete = true)}>Delete…</button>
				</div>
				{#if confirmDelete}<div class="wb-card">
						<p>Delete this task analysis? Previous practice records will remain in Editions.</p>
						<button
							onclick={() => {
								if (selected) store.deleteRoutine(selected.id);
								confirmDelete = false;
								queueSync();
							}}>Delete routine</button
						><button onclick={() => (confirmDelete = false)}>Keep routine</button>
					</div>{/if}
				{#key selected.id}<RoutineRunner routine={selected} />{/key}
				<details class="wb-card">
					<summary>Practice records (optional)</summary>
					<p class="wb-note">
						The existing support log is available here. It does not hide steps or estimate your
						capacity.
					</p>
					{#each selected.steps as step}<label
							>{step.label}<select
								value={results[step.id] ?? ''}
								onchange={(e) =>
									(results = { ...results, [step.id]: e.currentTarget.value as RoutineStepResult })}
								><option value="" disabled>Choose a result</option><option value="independent"
									>Independent</option
								><option value="prompted">Prompted</option><option value="missed">Not today</option
								></select
							></label
						>{/each}
					<button disabled={!selected.steps.every((s) => results[s.id])} onclick={record}
						>Save today's record</button
					>
					{#each practices.slice(0, 6) as p}<p>
							{p.date} · {Math.round(p.independence * 100)}% independent
						</p>{/each}
				</details>{:else}<div class="wb-card wb-paper">
					<h2>Add your first routine</h2>
					<p>Write the steps in the order you use them. You can change them later.</p>
				</div>{/if}
		</div>
	</div>
	<p class="wb-notice" role="status">{notice}</p>
</section>
