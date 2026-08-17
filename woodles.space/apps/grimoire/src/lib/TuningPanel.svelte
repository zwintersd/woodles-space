<script lang="ts">
	import { TUNING_GROUPS, fieldValue, setFieldValue, defaultFieldValue, type TuningField } from './tuningFields';
	import type { TuningState } from './tuning.svelte';

	let { tuning }: { tuning: TuningState } = $props();

	function onInput(field: TuningField, e: Event): void {
		const raw = (e.currentTarget as HTMLInputElement).value;
		if (raw === '') return;
		const value = Number(raw);
		if (Number.isNaN(value)) return;
		setFieldValue(tuning.groups, field, value);
	}
</script>

<div class="panel">
	<div class="panel-head">
		<h2>Tuning</h2>
		<button class="reset-all" onclick={() => tuning.resetAll()}>Reset all to World 1</button>
	</div>

	{#each TUNING_GROUPS as group (group.key)}
		<section>
			<div class="group-head">
				<div>
					<h3>{group.title}</h3>
					<p class="blurb">{group.blurb}</p>
				</div>
				{#if tuning.isGroupModified(group.key)}
					<button class="reset-group" onclick={() => tuning.resetGroup(group.key)}>reset</button>
				{/if}
			</div>
			<div class="fields">
				{#each group.fields as field (field.path.join('.'))}
					<label class:changed={fieldValue(tuning.groups, field) !== defaultFieldValue(field)}>
						<span class="field-label">{field.label}</span>
						<input
							type="number"
							step={field.step}
							min={field.min}
							max={field.max}
							value={fieldValue(tuning.groups, field)}
							oninput={(e) => onInput(field, e)}
						/>
					</label>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		font-size: 1.1rem;
		margin: 0;
	}

	.reset-all {
		font: inherit;
		font-size: 0.78rem;
		font-family: var(--font-mono, ui-monospace, monospace);
		color: var(--muted);
		background: none;
		border: 1px solid var(--rule);
		border-radius: 999px;
		padding: 0.3rem 0.75rem;
		cursor: pointer;
	}

	.reset-all:hover {
		color: var(--text);
		border-color: var(--accent-strong, var(--accent));
	}

	section {
		border: 1px solid var(--rule);
		border-radius: 0.75rem;
		padding: 1rem 1.1rem;
		background: var(--surface);
	}

	.group-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	h3 {
		font-size: 0.95rem;
		margin: 0 0 0.2rem;
	}

	.blurb {
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.4;
		margin: 0;
		max-width: 42rem;
	}

	.reset-group {
		flex: none;
		font: inherit;
		font-size: 0.72rem;
		font-family: var(--font-mono, ui-monospace, monospace);
		color: var(--accent-strong, var(--accent));
		background: none;
		border: 1px solid var(--rule);
		border-radius: 999px;
		padding: 0.2rem 0.6rem;
		cursor: pointer;
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 0.6rem 0.9rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-label {
		font-size: 0.7rem;
		color: var(--muted);
		line-height: 1.3;
	}

	label.changed .field-label {
		color: var(--accent-strong, var(--accent));
	}

	label.changed input[type='number'] {
		border-color: var(--accent-strong, var(--accent));
	}

	input[type='number'] {
		font: inherit;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.85rem;
		padding: 0.3rem 0.5rem;
		border-radius: 0.4rem;
		border: 1px solid var(--rule);
		background: var(--bg);
		color: var(--text);
	}

	input[type='number']:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>
