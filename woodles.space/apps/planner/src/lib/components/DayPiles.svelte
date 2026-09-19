<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import { uid } from '$lib/utils';
	import type { DayShape, WeekPattern } from '$lib/types';
	import BlockEditor from './BlockEditor.svelte';
	let selected = $state('');
	let draft = $state<DayShape | null>(null);
	let notice = $state('');
	let confirmDelete = $state(false);
	let archived = $state(false);
	let piles = $derived(
		store.dayShapes.filter((p) => !p.deletedAt && Boolean(p.archived) === archived)
	);
	const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	function edit(p: DayShape) {
		selected = p.id;
		draft = { ...p, blocks: p.blocks.map((b) => ({ ...b, flexible: b.flexible ?? false })) };
		confirmDelete = false;
	}
	function create() {
		edit({ id: uid(), name: 'New day pile', blocks: [] });
	}
	function save() {
		if (!draft) return;
		if (!store.savePile(draft)) {
			notice = 'Give each activity a name and an end time after its start.';
			return;
		}
		notice = 'Day pile saved.';
		queueSync();
	}
	function remove() {
		if (!draft) return;
		store.deletePile(draft.id);
		draft = null;
		selected = '';
		confirmDelete = false;
		notice = 'Day pile deleted. Dated plans are preserved.';
		queueSync();
	}
	function setWeek(day: number, id: string) {
		const values = [...store.weekPattern.days] as WeekPattern['days'];
		values[day] = id;
		store.setWeekPattern({ days: values, updatedAt: new Date().toISOString() });
		queueSync();
	}
</script>

<section class="workbench">
	<header class="wb-heading">
		<div>
			<p class="wb-kicker">Day piles</p>
			<h1>Arrange a day you can reuse.</h1>
			<p>Build a template, then adjust individual days as needed.</p>
		</div>
		<button onclick={create}>+ New day pile</button>
	</header>
	<div class="wb-grid">
		<aside>
			<div class="wb-actions">
				<button aria-pressed={!archived} onclick={() => (archived = false)}>Active</button><button
					aria-pressed={archived}
					onclick={() => (archived = true)}>Archived</button
				>
			</div>
			<div class="wb-list">
				{#each piles as pile}<button aria-pressed={selected === pile.id} onclick={() => edit(pile)}
						><strong>{pile.name}</strong><small>{pile.blocks.length} activities</small></button
					>{:else}<p>No {archived ? 'archived' : 'active'} piles.</p>{/each}
			</div>
		</aside>
		<div>
			{#if draft}<form
					class="wb-card wb-paper"
					onsubmit={(e) => {
						e.preventDefault();
						save();
					}}
				>
					<p class="wb-kicker">Template editor</p>
					<label>Pile name<input required bind:value={draft.name} /></label>
					<BlockEditor bind:blocks={draft.blocks} />
					<div class="wb-actions">
						<button class="primary" type="submit">Save pile</button><button
							type="button"
							onclick={() => {
								draft = null;
								selected = '';
							}}>Cancel</button
						>
						<button
							type="button"
							onclick={() => {
								if (!draft) return;
								edit({
									...draft,
									id: uid(),
									name: draft.name + ' copy',
									blocks: draft.blocks.map((b) => ({ ...b, id: uid() })),
									archived: false
								});
							}}>Duplicate</button
						>
					</div>
					{#if store.dayShapes.some((p) => p.id === draft?.id)}<div class="wb-actions">
							<button
								type="button"
								onclick={() => {
									if (!draft) return;
									store.setDayShape(store.now, draft.id);
									queueSync();
									notice = 'Saved pile selected for today. Unsaved edits are not applied.';
								}}>Use saved pile today</button
							>
							<button
								type="button"
								onclick={() => {
									if (!draft) return;
									store.archivePile(draft.id, !draft.archived);
									draft = null;
									selected = '';
									queueSync();
								}}
							>
								{draft.archived ? 'Restore' : 'Archive'}</button
							>
							<button type="button" class="wb-danger" onclick={() => (confirmDelete = true)}
								>Delete pile…</button
							>
						</div>{/if}
					{#if confirmDelete}<div role="group" aria-label="Confirm pile deletion">
							<p>
								Delete this template? Weekday assignments will be cleared. Saved day plans remain.
							</p>
							<button type="button" onclick={remove}>Delete pile</button><button
								type="button"
								onclick={() => (confirmDelete = false)}>Keep pile</button
							>
						</div>{/if}
				</form>{:else}<div class="wb-card wb-paper">
					<h2>Your day templates</h2>
					<p>
						Select a pile to edit it, or create one. Changes to a template apply to days that have
						not been customized.
					</p>
				</div>{/if}
		</div>
	</div>
	<section class="wb-card">
		<h2>Weekday defaults</h2>
		<div class="wb-row">
			{#each [1, 2, 3, 4, 5, 6, 0] as day}<label
					>{days[day]}<select
						value={store.weekPattern.days[day]}
						onchange={(e) => setWeek(day, e.currentTarget.value)}
						><option value="">No pile</option
						>{#each store.dayShapes.filter((p) => !p.deletedAt) as pile}<option value={pile.id}
								>{pile.name}{pile.archived ? ' (archived)' : ''}</option
							>{/each}</select
					></label
				>{/each}
		</div>
	</section>
	<p class="wb-notice" role="status">{notice}</p>
</section>
