<script lang="ts">
	import { untrack } from 'svelte';
	import { store } from '$lib/store.svelte';

	let localTitle = $state('');
	let localDomainId = $state('');
	let localTargetDate = $state('');
	let localTargetBlockId = $state('');
	let localDuration = $state('');
	let localNotes = $state('');
	let localStatus = $state<'open' | 'done' | 'dropped'>('open');
	let titleInput: HTMLInputElement | undefined = $state();

	// Sync local fields only when the editing ID changes — not on every task mutation.
	// untrack() prevents store.tasks access from becoming a reactive dependency here.
	$effect(() => {
		const id = store.editingTaskId;
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
		}
	});

	const allBlocks = $derived(store.getAllBlocks());

	function commitAndClose() {
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
		if (e.key === 'Escape' && store.editingTaskId != null) commitAndClose();
	}}
/>

{#if store.editingTaskId != null}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="ted-backdrop" onclick={commitAndClose}></div>
{/if}

<div class="ted-sheet" class:open={store.editingTaskId != null}>
	{#if store.editingTaskId != null}
		<div class="ted-handle"></div>

		<div class="ted-header">
			<span class="ted-eyebrow">task</span>
			<button class="ted-close" onclick={commitAndClose}>save</button>
		</div>

		<div class="ted-body">
			<input
				bind:this={titleInput}
				bind:value={localTitle}
				class="ted-title-input"
				placeholder="task title"
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
					<label class="ted-label" for="ted-date">date</label>
					<input id="ted-date" type="date" class="ted-input" bind:value={localTargetDate} />
				</div>

				<div class="ted-field">
					<label class="ted-label" for="ted-block">block</label>
					<select id="ted-block" class="ted-select" bind:value={localTargetBlockId}>
						<option value="">— none —</option>
						{#each allBlocks as b (b.id)}
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
