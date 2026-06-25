<script lang="ts">
	import { untrack } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { dateKey } from '$lib/utils';

	let localTitle = $state('');
	let localDomainId = $state('');
	let localTargetDate = $state('');
	let localTargetBlockId = $state('');
	let localDuration = $state('');
	let localNotes = $state('');
	let localStatus = $state<'open' | 'done' | 'dropped'>('open');
	let titleInput: HTMLInputElement | undefined = $state();

	// The sheet serves two modes from one form: editing an existing task, or
	// composing a brand-new one. `open` is true for either.
	const composing = $derived(store.composing && store.editingTaskId == null);
	const open = $derived(store.editingTaskId != null || composing);

	// Sync local fields when a session opens — keyed on the editing ID (edit) or
	// the composing flag (create). untrack() keeps store.tasks/composeDefaults
	// reads from becoming reactive dependencies of this effect.
	$effect(() => {
		const id = store.editingTaskId;
		const isComposing = store.composing;
		if (id != null) {
			untrack(() => {
				const t = store.tasks.find((t) => t.id === id);
				if (t) {
					localTitle = t.title;
					localDomainId = t.domainId ?? '';
					localTargetDate = t.targetDate ?? '';
					localTargetBlockId = t.targetBlockId ?? '';
					localDuration = t.estimatedDuration != null ? String(t.estimatedDuration) : '';
					localNotes = t.notes ?? '';
					localStatus = t.status;
				}
			});
			setTimeout(() => titleInput?.focus(), 30);
		} else if (isComposing) {
			untrack(() => {
				const d = store.composeDefaults;
				localTitle = '';
				localDomainId = d.domainId ?? '';
				localTargetDate = d.targetDate ?? dateKey(store.now);
				localTargetBlockId = d.targetBlockId ?? '';
				localDuration = d.estimatedDuration != null ? String(d.estimatedDuration) : '';
				localNotes = d.notes ?? '';
				localStatus = 'open';
			});
			setTimeout(() => titleInput?.focus(), 30);
		}
	});

	// Block options follow the chosen day, so scheduling for a future date shows
	// that day's real blocks. With no date set, fall back to every known block.
	const blockOptions = $derived(
		localTargetDate ? store.getBlocksForDateKey(localTargetDate) : store.getAllBlocks()
	);

	// Changing the day invalidates a block picked for the old day.
	function handleDateChange() {
		localTargetBlockId = '';
	}

	function commitAndClose() {
		if (composing) {
			if (localTitle.trim()) {
				store.addTask({
					title: localTitle.trim(),
					domainId: localDomainId || undefined,
					targetDate: localTargetDate || undefined,
					targetBlockId: localTargetBlockId || undefined,
					estimatedDuration: localDuration ? parseInt(localDuration, 10) : undefined,
					notes: localNotes.trim() || undefined
				});
			}
			store.cancelCompose();
			return;
		}

		const id = store.editingTaskId;
		if (!id) return;
		if (localTitle.trim()) {
			store.updateTask(id, {
				title: localTitle.trim(),
				domainId: localDomainId || undefined,
				targetDate: localTargetDate || undefined,
				targetBlockId: localTargetBlockId || undefined,
				estimatedDuration: localDuration ? parseInt(localDuration, 10) : undefined,
				notes: localNotes.trim() || undefined
			});
		}
		store.closeTaskEdit();
	}

	function handleDrop() {
		const id = store.editingTaskId;
		if (!id) return;
		store.dropTask(id);
		store.closeTaskEdit();
	}

	function handleStatusToggle() {
		const id = store.editingTaskId;
		if (!id) return;
		if (localStatus === 'done') {
			store.reopenTask(id);
			localStatus = 'open';
		} else {
			store.completeTask(id);
			localStatus = 'done';
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) commitAndClose();
	}}
/>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="ted-backdrop" onclick={commitAndClose}></div>
{/if}

<div class="ted-sheet" class:open>
	{#if open}
		<div class="ted-handle"></div>

		<div class="ted-header">
			<span class="ted-eyebrow">{composing ? 'new thing' : 'thing'}</span>
			<button class="ted-close" onclick={commitAndClose}>
				{composing ? 'add' : 'save'}
			</button>
		</div>

		<div class="ted-body">
			<input
				bind:this={titleInput}
				bind:value={localTitle}
				class="ted-title-input"
				placeholder="what is it?"
				autocomplete="off"
				spellcheck="false"
			/>

			<div class="ted-fields">
				<div class="ted-field">
					<label class="ted-label" for="ted-domain">domain</label>
					<select id="ted-domain" class="ted-select" bind:value={localDomainId}>
						<option value="">— none —</option>
						{#each store.domains as d (d.id)}
							<option value={d.id}>{d.icon} {d.name}</option>
						{/each}
					</select>
				</div>

				<div class="ted-field">
					<label class="ted-label" for="ted-date">{composing ? 'when' : 'date'}</label>
					<input
						id="ted-date"
						type="date"
						class="ted-input"
						bind:value={localTargetDate}
						onchange={handleDateChange}
					/>
				</div>

				<div class="ted-field">
					<label class="ted-label" for="ted-block">block</label>
					<select id="ted-block" class="ted-select" bind:value={localTargetBlockId}>
						<option value="">{localTargetDate ? '— unscheduled —' : '— none —'}</option>
						{#each blockOptions as b (b.id)}
							<option value={b.id}>{b.startTime} · {b.title}</option>
						{/each}
					</select>
				</div>

				<div class="ted-field">
					<label class="ted-label" for="ted-dur">duration</label>
					<div class="ted-inline">
						<input
							id="ted-dur"
							type="number"
							min="1"
							max="480"
							class="ted-input ted-dur-input"
							bind:value={localDuration}
							placeholder="—"
						/>
						<span class="ted-unit">min</span>
					</div>
				</div>
			</div>

			<div class="ted-notes-wrap">
				<label class="ted-label" for="ted-notes">notes</label>
				<textarea
					id="ted-notes"
					class="ted-notes"
					bind:value={localNotes}
					placeholder="…"
					rows="3"
					spellcheck="false"
				></textarea>
			</div>
		</div>

		{#if composing}
			<div class="ted-actions ted-actions-compose">
				<span class="ted-hint">pick a day and a block, or leave it in the tray.</span>
			</div>
		{:else}
			<div class="ted-actions">
				<button class="ted-drop-btn" onclick={handleDrop}>drop</button>
				<button
					class="ted-status-btn"
					class:done={localStatus === 'done'}
					onclick={handleStatusToggle}
				>
					{localStatus === 'done' ? '✓ done' : '○ open'}
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.ted-backdrop {
		position: fixed;
		inset: 0;
		z-index: calc(var(--pl-z-modal) - 1);
		background: rgba(0, 0, 0, 0.15);
	}

	.ted-sheet {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%) translateY(100%);
		width: min(100vw, 500px);
		background: var(--p-surface);
		border-radius: 20px 20px 0 0;
		border: 1px solid var(--p-border);
		border-bottom: none;
		z-index: var(--pl-z-modal);
		transition: transform var(--pl-transition-medium);
		box-shadow: 0 -8px 32px var(--p-accent-soft);
		display: flex;
		flex-direction: column;
	}

	.ted-sheet.open {
		transform: translateX(-50%) translateY(0);
	}

	.ted-handle {
		width: 32px;
		height: 3px;
		background: var(--p-border);
		border-radius: 100px;
		margin: 10px auto 0;
		flex-shrink: 0;
	}

	.ted-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1.25rem 0.4rem;
		flex-shrink: 0;
	}

	.ted-eyebrow {
		font-family: var(--pl-font-mono);
		font-size: 0.52rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.5;
	}

	.ted-close {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 3px 10px;
		border-radius: var(--pl-radius-pill);
		opacity: 0.7;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast),
			border-color var(--pl-transition-fast);
	}

	.ted-close:hover {
		opacity: 1;
		color: var(--p-accent);
		border-color: var(--p-accent);
	}

	.ted-body {
		padding: 0 1.25rem 0.25rem;
		overflow-y: auto;
	}

	.ted-title-input {
		width: 100%;
		font-family: var(--pl-font-display);
		font-size: 1.65rem;
		font-weight: 400;
		color: var(--p-text);
		padding: 0.2rem 0 0.4rem;
		border-bottom: 1px solid var(--p-border);
		background: transparent;
		letter-spacing: -0.01em;
		margin-bottom: 0.75rem;
		transition: border-color var(--pl-transition-fast);
	}

	.ted-title-input:focus {
		outline: none;
		border-color: var(--p-accent);
	}

	.ted-title-input::placeholder {
		color: var(--p-muted);
		opacity: 0.4;
	}

	.ted-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem 1rem;
		margin-bottom: 0.75rem;
	}

	.ted-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.ted-label {
		font-family: var(--pl-font-mono);
		font-size: 0.48rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.55;
	}

	.ted-select,
	.ted-input {
		font-family: var(--pl-font-mono);
		font-size: 0.7rem;
		color: var(--p-text);
		background: var(--p-bg);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		padding: 4px 7px;
		transition: border-color var(--pl-transition-fast);
	}

	.ted-select:focus,
	.ted-input:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.ted-inline {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.ted-dur-input {
		width: 64px;
	}

	.ted-unit {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		color: var(--p-muted);
		opacity: 0.6;
	}

	.ted-notes-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.ted-notes {
		font-family: var(--pl-font-mono);
		font-size: 0.7rem;
		color: var(--p-text);
		background: var(--p-bg);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		padding: 6px 8px;
		resize: none;
		line-height: 1.5;
		transition: border-color var(--pl-transition-fast);
	}

	.ted-notes:focus {
		border-color: var(--p-accent);
		outline: none;
	}

	.ted-notes::placeholder {
		color: var(--p-muted);
		opacity: 0.4;
	}

	.ted-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1.25rem 1.25rem;
		border-top: 1px solid var(--p-border);
		flex-shrink: 0;
	}

	.ted-actions-compose {
		justify-content: flex-start;
	}

	.ted-hint {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.04em;
		color: var(--p-muted);
		opacity: 0.55;
		font-style: italic;
	}

	.ted-drop-btn {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		color: var(--p-muted);
		opacity: 0.45;
		transition: opacity var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.ted-drop-btn:hover {
		opacity: 1;
		color: var(--p-accent);
	}

	.ted-status-btn {
		margin-left: auto;
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		padding: 4px 12px;
		border-radius: var(--pl-radius-pill);
		transition: all var(--pl-transition-fast);
	}

	.ted-status-btn:hover {
		color: var(--p-accent);
		border-color: var(--p-accent);
	}

	.ted-status-btn.done {
		color: var(--p-accent);
		border-color: var(--p-accent);
		background: var(--p-accent-soft);
	}
</style>
