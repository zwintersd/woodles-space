<script lang="ts">
	import { untrack } from 'svelte';
	import { garden } from '$lib/garden.svelte';
	import { ACCENT_COLOR, GLYPH_PRESETS, coverAccent, coverBlurb, coverGlyph } from '$lib/cover';
	import { SPORE_ACCENTS, type Spore, type SporeAccent } from '$lib/types';

	// Choosing a cover is always optional — the derived one is already good.
	// This exists for the entry you care about, not as a step you owe.

	let { spore, onclose }: { spore: Spore; onclose: () => void } = $props();

	// Seeded from the spore on open, then owned by the form. `untrack` says
	// that deliberately: this popover is mounted fresh each time it opens, so
	// the initial read is the intent, not a missed reaction.
	let accent = $state<SporeAccent>(untrack(() => coverAccent(spore)));
	let glyph = $state(untrack(() => coverGlyph(spore)));
	let blurb = $state(untrack(() => spore.blurb ?? ''));

	let previewBlurb = $derived(blurb.trim() || coverBlurb({ ...spore, blurb: undefined }));

	function save() {
		garden.setCover(spore.id, {
			accent,
			glyph: glyph.trim() || undefined,
			blurb: blurb.trim() || undefined
		});
		onclose();
	}

	function reset() {
		garden.setCover(spore.id, { accent: undefined, glyph: undefined, blurb: undefined });
		onclose();
	}
</script>

<div class="cover-editor" role="dialog" aria-label="Cover">
	<div class="preview" style="--accent: {ACCENT_COLOR[accent]}">
		<span class="preview-glyph">{glyph.trim() || '✦'}</span>
	</div>

	<p class="field-label">accent</p>
	<div class="swatches">
		{#each SPORE_ACCENTS as option}
			<button
				class="swatch"
				style="background: {ACCENT_COLOR[option]}"
				aria-label={option}
				aria-pressed={accent === option}
				onclick={() => (accent = option)}
			></button>
		{/each}
	</div>

	<p class="field-label">emblem</p>
	<div class="glyphs">
		{#each GLYPH_PRESETS as option}
			<button
				class="glyph-btn"
				aria-pressed={glyph === option}
				onclick={() => (glyph = option)}
			>{option}</button>
		{/each}
	</div>
	<input class="glyph-input" bind:value={glyph} maxlength="2" placeholder="or type your own" />

	<p class="field-label">blurb</p>
	<textarea
		class="blurb-input"
		bind:value={blurb}
		rows="2"
		placeholder={previewBlurb}
	></textarea>
	<p class="hint">Left blank, the opening lines are used.</p>

	<div class="actions">
		<button class="btn-primary" onclick={save}>save cover</button>
		<button class="btn-ghost" onclick={reset}>use the default</button>
		<button class="btn-ghost" onclick={onclose}>cancel</button>
	</div>
</div>

<style>
	.cover-editor {
		position: absolute;
		left: 0;
		top: calc(100% + 8px);
		z-index: var(--g-z-panel);
		width: 280px;
		max-width: 86vw;
		padding: var(--g-space-md);
		background: var(--g-surface);
		border: 1px solid var(--g-border-strong);
		border-radius: var(--g-radius-md);
		box-shadow: var(--g-shadow-hover);
	}

	.preview {
		height: 60px;
		margin-bottom: var(--g-space-md);
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		border-radius: var(--g-radius-sm);
		background: radial-gradient(
			ellipse 80% 70% at 50% 40%,
			color-mix(in srgb, var(--accent) 16%, var(--g-surface)),
			var(--g-bg) 72%
		);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.preview-glyph {
		font-family: var(--g-font-display);
		font-size: 24px;
		color: var(--accent);
	}

	.field-label {
		font-family: var(--g-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--g-muted);
		margin-bottom: var(--g-space-xs);
	}

	.swatches,
	.glyphs {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-bottom: var(--g-space-sm);
	}

	.swatch {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
	}

	.swatch[aria-pressed='true'] {
		border-color: var(--g-text);
	}

	.glyph-btn {
		width: 26px;
		height: 26px;
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		background: var(--g-bg);
		color: var(--g-text);
		cursor: pointer;
	}

	.glyph-btn[aria-pressed='true'] {
		border-color: var(--g-flight);
		color: var(--g-flight);
	}

	.glyph-input,
	.blurb-input {
		width: 100%;
		font-family: var(--g-font-body);
		font-size: 0.82rem;
		color: var(--g-text);
		background: var(--g-bg);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: 0.35rem 0.6rem;
		margin-bottom: var(--g-space-sm);
		resize: vertical;
	}

	.hint {
		font-size: 0.68rem;
		color: var(--g-muted);
		margin-bottom: var(--g-space-md);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--g-space-xs);
	}

	.btn-primary,
	.btn-ghost {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		border-radius: var(--g-radius-pill);
		padding: 0.35rem 0.75rem;
		cursor: pointer;
		border: 1px solid var(--g-border);
	}

	.btn-primary {
		background: var(--g-flight);
		color: var(--g-on-flight);
		border-color: var(--g-flight);
	}

	.btn-ghost {
		background: transparent;
		color: var(--g-text-dim);
	}

	.btn-ghost:hover {
		border-color: var(--g-border-strong);
	}
</style>
