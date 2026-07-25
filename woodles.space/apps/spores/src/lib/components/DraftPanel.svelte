<script lang="ts">
	import { untrack } from 'svelte';
	import { garden } from '$lib/garden.svelte';
	import { buildBrief, ingestDraft } from '@woodles/spellcraft';
	import { htmlToText } from '@woodles/text';
	import { brokenTargets } from '$lib/wikilinks';
	import type { Spore } from '$lib/types';

	// "Draft it with a prompt" — the last of the Textbook's gestures, and the
	// reason the [[bracket]] syntax was chosen in the first place: the brief
	// asks a model for exactly the format a spore body already stores.
	//
	// Nothing here calls a model. You carry the prompt out and the answer back,
	// which is what keeps the Garden backend-free.

	let { spore, onclose }: { spore: Spore; onclose: () => void } = $props();

	let context = $state('');
	let diagnosis = $state(false);
	let pasted = $state('');
	let copied = $state(false);
	// Seeded on open, then owned by the form — the panel is mounted fresh each
	// time, so the initial read is the intent rather than a missed reaction.
	let mode = $state<'replace' | 'append'>(
		untrack(() => (spore.body.trim() ? 'append' : 'replace'))
	);

	let brief = $derived(
		buildBrief({
			topic: spore.title,
			output: 'fragment',
			// A spore's own tags are the closest thing it has to a subject.
			subject: spore.tags.filter((tag) => !tag.startsWith('from:')).join(', '),
			context,
			diagnosis
		})
	);

	let ingested = $derived(pasted.trim() ? ingestDraft(pasted, htmlToText) : '');
	let willSow = $derived(ingested ? brokenTargets(ingested, garden.spores) : []);

	async function copy() {
		await navigator.clipboard.writeText(brief);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function bring() {
		if (!ingested) return;
		const body =
			mode === 'append' && spore.body.trim() ? `${spore.body.trim()}\n\n${ingested}` : ingested;
		garden.updateSpore(spore.id, { body });

		// Every new concept the draft named becomes a seed, so one answer both
		// fills this entry and spawns the cluster around it.
		const sown = willSow.length;
		for (const target of willSow) garden.followLink(target, { from: spore });

		garden.handoffNotice = sown
			? `brought the draft in, and sowed ${sown} new ${sown === 1 ? 'seed' : 'seeds'}`
			: 'brought the draft in';
		onclose();
	}
</script>

<section class="draft-panel" aria-label="Draft with a prompt">
	<header class="panel-head">
		<h3>✦ draft it with a prompt</h3>
		<button class="btn-ghost" onclick={onclose}>close</button>
	</header>

	<p class="lede">
		Nothing here talks to a model. Copy the brief, paste it wherever you like, and
		bring the answer back.
	</p>

	<label class="field">
		<span class="field-label">your own relationship to this, if any</span>
		<input class="text-input" bind:value={context} placeholder="optional" />
	</label>

	<label class="check">
		<input type="checkbox" bind:checked={diagnosis} />
		<span>this is a diagnosis or health condition</span>
	</label>

	<div class="prompt-block">
		<div class="block-head">
			<span class="field-label">the brief</span>
			<button class="btn-primary" onclick={copy}>{copied ? 'copied' : 'copy'}</button>
		</div>
		<textarea class="prompt-output" readonly rows="8" value={brief}></textarea>
	</div>

	<div class="prompt-block">
		<span class="field-label">paste the answer</span>
		<textarea
			class="paste-input"
			bind:value={pasted}
			rows="6"
			placeholder="paste it here — html, markdown or plain prose all work"
		></textarea>
	</div>

	{#if ingested}
		<div class="outcome">
			{#if spore.body.trim()}
				<div class="mode-row" role="group" aria-label="how to bring it in">
					<button class="mode" class:active={mode === 'append'} onclick={() => (mode = 'append')}>
						add to what's here
					</button>
					<button class="mode" class:active={mode === 'replace'} onclick={() => (mode = 'replace')}>
						replace it
					</button>
				</div>
			{/if}
			{#if willSow.length > 0}
				<p class="sowing">
					will sow {willSow.length} new {willSow.length === 1 ? 'seed' : 'seeds'}:
					{willSow.slice(0, 6).join(', ')}{willSow.length > 6 ? '…' : ''}
				</p>
			{/if}
			<button class="btn-primary" onclick={bring}>✦ bring it into the entry</button>
		</div>
	{/if}
</section>

<style>
	.draft-panel {
		margin-top: var(--g-space-md);
		padding: var(--g-space-md);
		background: var(--g-surface);
		border: 1px solid var(--g-border-strong);
		border-radius: var(--g-radius-md);
		box-shadow: var(--g-shadow-card);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--g-space-sm);
	}

	.panel-head h3 {
		font-family: var(--g-font-display);
		font-size: 1.05rem;
		font-weight: 400;
		color: var(--g-text);
	}

	.lede {
		font-family: var(--g-font-body);
		font-size: 0.82rem;
		line-height: 1.5;
		color: var(--g-text-dim);
	}

	.field,
	.prompt-block {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs);
	}

	.field-label {
		font-family: var(--g-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--g-muted);
	}

	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--g-space-sm);
	}

	.check {
		display: flex;
		align-items: center;
		gap: var(--g-space-xs);
		font-family: var(--g-font-body);
		font-size: 0.82rem;
		color: var(--g-text-dim);
		cursor: pointer;
	}

	.text-input,
	.prompt-output,
	.paste-input {
		width: 100%;
		font-family: var(--g-font-mono);
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--g-text);
		background: var(--g-bg);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		padding: 0.4rem 0.6rem;
		resize: vertical;
	}

	.prompt-output {
		color: var(--g-text-dim);
	}

	.outcome {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-sm);
		padding-top: var(--g-space-sm);
		border-top: 1px solid var(--g-rule);
	}

	.mode-row {
		display: inline-flex;
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-pill);
		overflow: hidden;
		width: fit-content;
	}

	.mode {
		font-family: var(--g-font-mono);
		font-size: 0.68rem;
		padding: 0.3rem 0.7rem;
		background: transparent;
		color: var(--g-text-dim);
		border: none;
		cursor: pointer;
	}

	.mode.active {
		background: var(--g-flight-soft);
		color: var(--g-flight);
	}

	.sowing {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		color: var(--g-flight-active);
	}

	.btn-primary,
	.btn-ghost {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		border-radius: var(--g-radius-pill);
		padding: 0.35rem 0.8rem;
		cursor: pointer;
		border: 1px solid var(--g-border);
		width: fit-content;
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
