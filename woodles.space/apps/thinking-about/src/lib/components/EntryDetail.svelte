<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import { columnLabel, sectionLabel, showsSchedule, showsSharedWith } from '$lib/constants';
	import { motionDuration } from '$lib/motion';
	import ColorPicker from './ColorPicker.svelte';

	let entry = $derived(thinkingAbout.activeEntry);

	let confirmDelete = $state(false);

	// Reset the delete confirmation whenever which entry is open changes,
	// so it never carries over from a previous visit to this panel.
	$effect(() => {
		entry?.id;
		confirmDelete = false;
	});

	function close(): void {
		thinkingAbout.closeEntry();
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if entry}
	{@const id = entry.id}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="scrim" onclick={close} transition:fade={{ duration: motionDuration(160) }}></div>
	<div
		class="detail"
		style:--chip-color={entry.color}
		role="dialog"
		aria-modal="true"
		aria-label="entry detail"
		transition:fly={{ x: 48, duration: motionDuration(260), easing: quintOut }}
	>
		<header class="detail-header">
			<span class="detail-breadcrumb">{columnLabel(entry.columnKey)} · {sectionLabel(entry.sectionKey)}</span>
			<button class="detail-close" onclick={close} aria-label="close">×</button>
		</header>

		<input
			class="detail-title"
			value={entry.title}
			placeholder="untitled"
			aria-label="title"
			oninput={(e) => thinkingAbout.updateEntry(id, { title: e.currentTarget.value })}
		/>

		<ColorPicker value={entry.color} onChange={(hex) => thinkingAbout.updateEntry(id, { color: hex })} />

		<div class="detail-field">
			<label for="ta-date-started">started</label>
			<div class="field-with-clear">
				<input
					id="ta-date-started"
					type="date"
					value={entry.dateStarted ?? ''}
					onchange={(e) => thinkingAbout.updateEntry(id, { dateStarted: e.currentTarget.value || null })}
				/>
				{#if entry.dateStarted}
					<button
						class="field-clear"
						onclick={() => thinkingAbout.updateEntry(id, { dateStarted: null })}
						title="clear started date"
						aria-label="clear started date"
					>
						×
					</button>
				{/if}
			</div>
		</div>

		{#if showsSharedWith(entry.sectionKey)}
			<div class="detail-field">
				<label for="ta-shared-with">shared with</label>
				<input
					id="ta-shared-with"
					type="text"
					value={entry.sharedWith ?? ''}
					placeholder="who else is in on this"
					oninput={(e) => thinkingAbout.updateEntry(id, { sharedWith: e.currentTarget.value })}
				/>
			</div>
		{/if}

		{#if showsSchedule(entry.columnKey)}
			<div class="detail-field">
				<label for="ta-schedule">schedule</label>
				<input
					id="ta-schedule"
					type="text"
					value={entry.schedule ?? ''}
					placeholder="e.g. Tuesdays after work"
					oninput={(e) => thinkingAbout.updateEntry(id, { schedule: e.currentTarget.value })}
				/>
			</div>
		{/if}

		<div class="detail-field">
			<label for="ta-notes">notes</label>
			<textarea
				id="ta-notes"
				class="detail-notes"
				placeholder="notes"
				value={entry.notes}
				oninput={(e) => thinkingAbout.updateEntry(id, { notes: e.currentTarget.value })}
			></textarea>
		</div>

		<footer class="detail-footer">
			<div class="footer-status">
				{#if entry.status === 'archived'}
					<span class="closed-note">closed {entry.dateClosed}</span>
					<button class="btn-ghost" onclick={() => thinkingAbout.reopenEntry(id)}>reopen</button>
				{:else}
					<button class="btn-ghost" onclick={() => thinkingAbout.archiveEntry(id)}>mark done</button>
				{/if}
			</div>

			<div class="footer-delete">
				{#if confirmDelete}
					<span class="confirm-label">delete for good?</span>
					<button class="btn-ghost" onclick={() => (confirmDelete = false)}>cancel</button>
					<button class="btn-danger" onclick={() => thinkingAbout.deleteEntry(id)}>delete</button>
				{:else}
					<button class="btn-danger-ghost" onclick={() => (confirmDelete = true)}>delete</button>
				{/if}
			</div>
		</footer>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(32, 33, 36, 0.28);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		z-index: var(--ta-z-detail);
	}

	.detail {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: calc(var(--ta-z-detail) + 1);
		width: min(420px, 100vw);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--chip-color) 12%, transparent) 0%, transparent 160px),
			var(--ta-surface);
		box-shadow: var(--ta-shadow-md);
		padding: 1.1rem 1.3rem 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overflow-y: auto;
		border-left: 4px solid var(--chip-color);
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.detail-breadcrumb {
		font-family: var(--ta-font-sans);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ta-muted);
	}

	.detail-close {
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		font-size: 1.1rem;
		line-height: 1;
		color: var(--ta-muted);
		transition: background var(--ta-transition-fast), color var(--ta-transition-fast), transform var(--ta-transition-spring);
	}

	.detail-close:hover {
		background: var(--ta-bg-subtle);
		color: var(--ta-text);
		transform: var(--ta-lift-hover) scale(1.06);
	}

	.detail-close:active {
		transform: var(--ta-lift-press);
	}

	.detail-title {
		font-family: var(--ta-font-sans);
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--ta-text);
		padding: 0.2rem 0;
		border-bottom: 1px solid transparent;
		transition: border-color var(--ta-transition-fast);
	}

	.detail-title:focus-visible {
		border-color: var(--ta-border);
		outline: none;
	}

	.detail-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.detail-field label {
		font-family: var(--ta-font-sans);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ta-muted);
	}

	.detail-field input[type='text'],
	.detail-field input[type='date'] {
		font-family: var(--ta-font-sans);
		font-size: 0.88rem;
		color: var(--ta-text);
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-sm);
		transition: border-color var(--ta-transition-fast), box-shadow var(--ta-transition-fast);
	}

	.detail-field input[type='text']:focus-visible,
	.detail-field input[type='date']:focus-visible {
		border-color: var(--ta-accent);
		box-shadow: 0 0 0 3px var(--ta-accent-soft);
		outline: none;
	}

	.field-with-clear {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.field-with-clear input {
		flex: 1;
		min-width: 0;
	}

	.field-clear {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: var(--ta-muted);
		font-size: 1rem;
		line-height: 1;
		transition: background var(--ta-transition-fast), color var(--ta-transition-fast), transform var(--ta-transition-spring);
	}

	.field-clear:hover {
		background: var(--ta-danger-soft);
		color: var(--ta-danger);
		transform: scale(1.12);
	}

	.field-clear:active {
		transform: var(--ta-lift-press);
	}

	.detail-notes {
		font-family: var(--ta-font-sans);
		font-size: 0.85rem;
		color: var(--ta-text);
		line-height: 1.5;
		min-height: 6rem;
		resize: vertical;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-sm);
		transition: border-color var(--ta-transition-fast), box-shadow var(--ta-transition-fast);
	}

	.detail-notes:focus-visible {
		border-color: var(--ta-accent);
		box-shadow: 0 0 0 3px var(--ta-accent-soft);
		outline: none;
	}

	.detail-footer {
		margin-top: auto;
		padding-top: 0.9rem;
		border-top: 1px solid var(--ta-border-soft);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.footer-status,
	.footer-delete {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.footer-delete {
		justify-content: flex-end;
	}

	.closed-note {
		font-family: var(--ta-font-mono);
		font-size: 0.7rem;
		color: var(--ta-muted);
	}

	.confirm-label {
		font-family: var(--ta-font-sans);
		font-size: 0.76rem;
		color: var(--ta-danger);
		margin-right: 0.1rem;
	}

	.btn-ghost,
	.btn-danger,
	.btn-danger-ghost {
		font-family: var(--ta-font-sans);
		font-size: 0.76rem;
		padding: 0.35rem 0.7rem;
		border-radius: var(--ta-radius-sm);
		border: 1px solid var(--ta-border);
		transition: border-color var(--ta-transition-fast), color var(--ta-transition-fast), background var(--ta-transition-fast), transform var(--ta-transition-spring);
	}

	.btn-ghost:hover,
	.btn-danger:hover,
	.btn-danger-ghost:hover {
		transform: var(--ta-lift-hover);
	}

	.btn-ghost:active,
	.btn-danger:active,
	.btn-danger-ghost:active {
		transform: var(--ta-lift-press);
	}

	.btn-ghost {
		color: var(--ta-text-dim);
	}

	.btn-ghost:hover {
		border-color: var(--ta-accent);
		color: var(--ta-accent);
	}

	.btn-danger-ghost {
		color: var(--ta-danger);
		border-color: transparent;
	}

	.btn-danger-ghost:hover {
		background: var(--ta-danger-soft);
	}

	.btn-danger {
		color: #fff;
		background: var(--ta-danger);
		border-color: var(--ta-danger);
	}

	.btn-danger:hover {
		background: color-mix(in srgb, var(--ta-danger) 85%, black);
	}

	@media (max-width: 520px) {
		.detail {
			width: 100vw;
		}
	}
</style>
