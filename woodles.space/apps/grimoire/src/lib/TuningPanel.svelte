<script lang="ts">
	import { SHAPES } from '@woodles/dynamics';
	import {
		TUNING_GROUPS,
		UNTUNED_SHAPES,
		fieldValue,
		setFieldValue,
		defaultFieldValue,
		type TuningField
	} from './tuningFields';
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

	<div class="preamble">
		<p>
			None of these groups is a bespoke mechanic. Each one is an instance of a shape from
			<code>@woodles/dynamics</code> — the badge names which, and the line under it says what that shape
			does anywhere, not just here.
		</p>
		<p class="untuned">
			<span>Three of the thirteen have no numbers to turn, so they aren't below —</span>
			{#each UNTUNED_SHAPES as id (id)}
				<span class="shape-chip">{id} · {SHAPES[id].name}</span>
			{/each}
			<span>are structural: what the world is made of rather than how it's set.</span>
		</p>
	</div>

	{#each TUNING_GROUPS as group (group.key)}
		<section>
			<div class="group-head">
				<div>
					<div class="title-row">
						<h3>{group.title}</h3>
						{#each group.shapes as id (id)}
							<span class="shape-chip" title={SHAPES[id].name}>{id} · {SHAPES[id].name}</span>
						{/each}
					</div>
					<p class="blurb">{group.blurb}</p>
					<div class="shape-gloss">
						{#each group.shapes as id (id)}
							<p><span class="shape-name">{SHAPES[id].name}</span> — {SHAPES[id].does}</p>
						{/each}
						{#if group.shapeNote}
							<p class="shape-note">{group.shapeNote}</p>
						{/if}
					</div>
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

	.preamble {
		font-size: 0.8rem;
		color: var(--muted);
		line-height: 1.55;
		margin: -0.5rem 0 0;
		max-width: 44rem;
	}

	.preamble p {
		margin: 0;
	}

	.preamble code {
		font-family: var(--font-mono, ui-monospace, monospace);
	}

	/* Chips inline in a sentence need the baseline handled, or they ride high
	   and the line spacing goes ragged. */
	.preamble .untuned {
		margin-top: 0.4rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.title-row {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.25rem;
	}

	h3 {
		font-size: 0.95rem;
		margin: 0;
	}

	.shape-chip {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--rule);
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		color: var(--accent-strong, var(--text));
		white-space: nowrap;
	}

	.blurb {
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.4;
		margin: 0;
		max-width: 42rem;
	}

	/* The general statement, set apart from the World-1-specific blurb above
	   it — reading them in sequence is the whole point: what this is here,
	   then what this kind of thing is anywhere. */
	.shape-gloss {
		margin-top: 0.45rem;
		padding-left: 0.6rem;
		border-left: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
		max-width: 42rem;
	}

	.shape-gloss p {
		font-size: 0.74rem;
		line-height: 1.45;
		color: var(--muted);
		margin: 0;
	}

	.shape-gloss p + p {
		margin-top: 0.3rem;
	}

	.shape-name {
		color: var(--accent-strong, var(--text));
	}

	.shape-note {
		font-style: italic;
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
