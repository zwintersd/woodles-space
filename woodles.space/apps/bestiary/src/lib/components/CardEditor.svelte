<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import { domains, rarities } from '$lib/content/domains';
	import type { Domain, Rarity } from '$lib/content/domains';
	import { clampInt } from '$lib/utils';
	import {
		emptyComposition,
		cloneComposition,
		createImageLayer,
		coverScale,
		type Composition
	} from '$lib/composer';
	import { measureImage } from '$lib/render';
	import CreatureCard from './CreatureCard.svelte';
	import SpriteInput from './SpriteInput.svelte';
	import SpriteStudio from './SpriteStudio.svelte';
	import StatBlock from './StatBlock.svelte';

	let creature = $derived(bestiary.activeCreature);

	// ── sprite studio ──────────────────────────────────────────────────
	let studioOpen = $state(false);
	let studioInitial = $state<Composition | null>(null);
	let preparing = $state(false);

	// Seed the studio: a saved composition reopens as-is; a plain sprite comes
	// in as a single full-bleed layer; an artless card starts empty.
	async function openStudio() {
		if (!creature || preparing) return;
		if (creature.composition) {
			studioInitial = cloneComposition(creature.composition);
		} else if (creature.sprite) {
			preparing = true;
			try {
				const { naturalW, naturalH } = await measureImage(creature.sprite);
				const comp = emptyComposition();
				comp.layers = [
					createImageLayer({
						src: creature.sprite,
						naturalW,
						naturalH,
						name: creature.name.trim() || 'sprite',
						scale: coverScale(naturalW, naturalH),
						smooth: !creature.pixelated
					})
				];
				studioInitial = comp;
			} finally {
				preparing = false;
			}
		} else {
			studioInitial = emptyComposition();
		}
		studioOpen = true;
	}

	function handleStudioSave(comp: Composition, dataUrl: string) {
		if (creature) bestiary.setComposition(creature.id, comp, dataUrl);
		studioOpen = false;
	}

	function set(changes: Parameters<typeof bestiary.updateCreature>[1]) {
		if (creature) bestiary.updateCreature(creature.id, changes);
	}

	// numeric fields share one clamp + commit path
	function setNumber(field: 'cost' | 'power' | 'toughness', raw: number) {
		const min = field === 'cost' ? 0 : 0;
		set({ [field]: clampInt(raw, min, 99) });
	}
	function step(field: 'cost' | 'power' | 'toughness', delta: number) {
		if (!creature) return;
		setNumber(field, creature[field] + delta);
	}

	function handleSprite(dataUrl: string, pixelated: boolean) {
		if (creature) bestiary.setSprite(creature.id, dataUrl, pixelated);
	}
	function handleClearSprite() {
		if (creature) bestiary.clearSprite(creature.id);
	}

	function handleDuplicate() {
		if (!creature) return;
		const copy = bestiary.duplicateCreature(creature.id);
		if (copy) bestiary.openEditor(copy.id);
	}

	function handleDelete() {
		if (!creature) return;
		const label = creature.name.trim() || 'this creature';
		if (confirm(`Release ${label} from the bestiary? This cannot be undone.`)) {
			bestiary.deleteCreature(creature.id);
		}
	}
</script>

{#if creature}
	<div class="editor">
		<header class="editor-head">
			<button class="back" onclick={() => bestiary.openCollection()}>← the shelf</button>
			<div class="head-actions">
				<button class="ghost" onclick={handleDuplicate}>duplicate</button>
				<button class="danger" onclick={handleDelete}>release</button>
				<button class="primary" onclick={() => bestiary.openCollection()}>done</button>
			</div>
		</header>

		<div class="editor-grid">
			<!-- live preview -->
			<aside class="preview">
				<div class="preview-card">
					<CreatureCard {creature} />
				</div>
				<p class="preview-note">a living likeness — it changes as you write</p>
			</aside>

			<!-- the form -->
			<form class="form" onsubmit={(e) => e.preventDefault()}>
				<!-- identity -->
				<fieldset class="group">
					<legend>identity</legend>

					<label class="field">
						<span class="label">name</span>
						<input
							class="text"
							type="text"
							placeholder="name this creature"
							value={creature.name}
							oninput={(e) => set({ name: e.currentTarget.value })}
						/>
					</label>

					<label class="field">
						<span class="label">kind <em>· the type line subtype</em></span>
						<input
							class="text"
							type="text"
							placeholder="Beast · Spirit Wisp · Construct…"
							value={creature.kind}
							oninput={(e) => set({ kind: e.currentTarget.value })}
						/>
					</label>

					<div class="field">
						<span class="label">domain <em>· its color identity</em></span>
						<div class="swatches">
							{#each domains as d (d.id)}
								<button
									type="button"
									class="swatch"
									class:active={creature.domain === d.id}
									style="--sw: var({d.colorVar})"
									title={d.note}
									onclick={() => set({ domain: d.id as Domain })}
								>
									<span class="sw-glyph">{d.glyph}</span>
									<span class="sw-name">{d.name}</span>
								</button>
							{/each}
						</div>
						<p class="hint-note">{domains.find((d) => d.id === creature?.domain)?.note}</p>
					</div>
				</fieldset>

				<!-- summoning -->
				<fieldset class="group">
					<legend>summoning</legend>

					<div class="field">
						<span class="label">essence cost</span>
						<div class="stepper">
							<button type="button" onclick={() => step('cost', -1)} aria-label="less essence">−</button>
							<input
								class="num"
								type="number"
								min="0"
								max="99"
								value={creature.cost}
								oninput={(e) => setNumber('cost', e.currentTarget.valueAsNumber)}
							/>
							<button type="button" onclick={() => step('cost', 1)} aria-label="more essence">+</button>
						</div>
					</div>

					<div class="field">
						<span class="label">rarity</span>
						<div class="segmented">
							{#each rarities as r (r.id)}
								<button
									type="button"
									class="seg"
									class:active={creature.rarity === r.id}
									style="--seg: var({r.colorVar})"
									title={r.note}
									onclick={() => set({ rarity: r.id as Rarity })}
								>
									<span class="seg-sym">{r.symbol}</span>
									{r.name}
								</button>
							{/each}
						</div>
					</div>

					<div class="stats-row">
						<div class="field">
							<span class="label">power</span>
							<div class="stepper">
								<button type="button" onclick={() => step('power', -1)} aria-label="less power">−</button>
								<input
									class="num"
									type="number"
									min="0"
									max="99"
									value={creature.power}
									oninput={(e) => setNumber('power', e.currentTarget.valueAsNumber)}
								/>
								<button type="button" onclick={() => step('power', 1)} aria-label="more power">+</button>
							</div>
						</div>
						<div class="field">
							<span class="label">toughness</span>
							<div class="stepper">
								<button type="button" onclick={() => step('toughness', -1)} aria-label="less toughness">−</button>
								<input
									class="num"
									type="number"
									min="0"
									max="99"
									value={creature.toughness}
									oninput={(e) => setNumber('toughness', e.currentTarget.valueAsNumber)}
								/>
								<button type="button" onclick={() => step('toughness', 1)} aria-label="more toughness">+</button>
							</div>
						</div>
					</div>
				</fieldset>

				<!-- stats -->
				<StatBlock {creature} />

				<!-- sprite -->
				<fieldset class="group">
					<legend>sprite</legend>
					<SpriteInput
						sprite={creature.sprite}
						pixelated={creature.pixelated}
						onpick={handleSprite}
						onclear={handleClearSprite}
					/>

					<button type="button" class="studio-open" onclick={openStudio} disabled={preparing}>
						<span class="so-glyph">✦</span>
						<span class="so-text">
							<span class="so-title">
								{preparing
									? 'opening the studio…'
									: creature.composition
										? 'edit in the sprite studio'
										: 'open the sprite studio'}
							</span>
							<span class="so-sub">layer a backdrop, trees, the creature & light</span>
						</span>
					</button>

					{#if creature.composition}
						<p class="studio-note">
							built from {creature.composition.layers.length} layer{creature.composition.layers
								.length === 1
								? ''
								: 's'} — reopen the studio to rearrange
						</p>
					{/if}

					{#if creature.sprite && !creature.composition}
						<label class="check">
							<input
								type="checkbox"
								checked={creature.pixelated}
								onchange={(e) => set({ pixelated: e.currentTarget.checked })}
							/>
							pixel art — keep edges crisp
						</label>
					{/if}
				</fieldset>

				<!-- text -->
				<fieldset class="group">
					<legend>the card text</legend>

					<label class="field">
						<span class="label">abilities <em>· rules text</em></span>
						<textarea
							class="area"
							rows="3"
							placeholder="what it does — e.g. “When this enters, draw the margin.”"
							value={creature.abilities}
							oninput={(e) => set({ abilities: e.currentTarget.value })}
						></textarea>
					</label>

					<label class="field">
						<span class="label">flavor <em>· italic, at the foot of the box</em></span>
						<textarea
							class="area"
							rows="2"
							placeholder="a line overheard about it"
							value={creature.flavor}
							oninput={(e) => set({ flavor: e.currentTarget.value })}
						></textarea>
					</label>

					<label class="field">
						<span class="label">found in <em>· where it was discovered</em></span>
						<input
							class="text"
							type="text"
							placeholder="a passage, a page, a margin…"
							value={creature.foundIn}
							oninput={(e) => set({ foundIn: e.currentTarget.value })}
						/>
					</label>
				</fieldset>
			</form>
		</div>
	</div>

	{#if studioOpen && studioInitial}
		<SpriteStudio
			initial={studioInitial}
			{creature}
			onsave={handleStudioSave}
			onclose={() => (studioOpen = false)}
		/>
	{/if}
{/if}

<style>
	.editor {
		padding: var(--b-space-lg) var(--b-space-lg) var(--b-space-2xl);
		max-width: 1080px;
		margin: 0 auto;
	}

	.editor-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--b-space-md);
		margin-bottom: var(--b-space-lg);
		flex-wrap: wrap;
	}
	.back {
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
		color: var(--b-text-dim);
		transition: color var(--b-transition-fast);
	}
	.back:hover { color: var(--b-gold); }
	.head-actions { display: flex; gap: var(--b-space-sm); }

	.primary {
		background: var(--b-gold);
		color: var(--b-on-accent);
		border-radius: var(--b-radius-sm);
		padding: 0.35rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 600;
		font-family: var(--b-font-mono);
	}
	.ghost, .danger {
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.35rem 0.8rem;
		font-size: 0.82rem;
		font-family: var(--b-font-mono);
		color: var(--b-text-dim);
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast);
	}
	.ghost:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.danger { color: var(--b-muted); }
	.danger:hover { border-color: var(--b-mythic); color: var(--b-mythic); }

	/* ── layout ── */
	.editor-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--b-space-xl);
	}
	@media (min-width: 880px) {
		.editor-grid {
			grid-template-columns: minmax(0, 1fr) 300px;
			align-items: start;
		}
		.form { grid-column: 1; grid-row: 1; }
		.preview { grid-column: 2; grid-row: 1; position: sticky; top: var(--b-space-lg); }
	}

	.preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--b-space-sm);
	}
	.preview-card { width: 100%; max-width: 290px; }
	.preview-note {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--b-muted);
		text-align: center;
	}

	/* ── form ── */
	.form { display: flex; flex-direction: column; gap: var(--b-space-lg); min-width: 0; }

	.group {
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-md);
		padding: var(--b-space-md);
		display: flex;
		flex-direction: column;
		gap: var(--b-space-md);
	}
	legend {
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--b-gold);
		padding: 0 var(--b-space-sm);
	}

	.field { display: flex; flex-direction: column; gap: var(--b-space-xs); min-width: 0; }
	.label {
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--b-text-dim);
	}
	.label em { color: var(--b-muted); font-style: italic; }

	.text, .area, .num {
		background: var(--b-surface-2);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.5rem 0.7rem;
		color: var(--b-text);
		font-family: var(--b-font-body);
		font-size: 0.95rem;
		transition: border-color var(--b-transition-fast);
		width: 100%;
	}
	.text:focus, .area:focus, .num:focus { border-color: var(--b-gold); }
	.area { line-height: 1.5; resize: vertical; min-height: 3rem; }

	.hint-note {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--b-muted);
	}

	/* domain swatches */
	.swatches { display: flex; flex-wrap: wrap; gap: var(--b-space-sm); }
	.swatch {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-pill);
		color: var(--b-text-dim);
		font-family: var(--b-font-mono);
		font-size: 0.74rem;
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast),
			background var(--b-transition-fast);
	}
	.sw-glyph { color: var(--sw); font-size: 0.9rem; }
	.swatch:hover { border-color: var(--sw); color: var(--b-text); }
	.swatch.active {
		border-color: var(--sw);
		color: var(--b-text);
		background: color-mix(in srgb, var(--sw) 16%, transparent);
		box-shadow: inset 0 0 0 1px var(--sw);
	}

	/* rarity segmented */
	.segmented { display: flex; flex-wrap: wrap; gap: var(--b-space-xs); }
	.seg {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		color: var(--b-text-dim);
		font-family: var(--b-font-mono);
		font-size: 0.74rem;
		transition: all var(--b-transition-fast);
	}
	.seg-sym { color: var(--seg); }
	.seg:hover { border-color: var(--seg); color: var(--b-text); }
	.seg.active {
		border-color: var(--seg);
		color: var(--b-on-accent);
		background: var(--seg);
	}
	.seg.active .seg-sym { color: var(--b-on-accent); }

	/* steppers */
	.stats-row { display: flex; gap: var(--b-space-md); flex-wrap: wrap; }
	.stats-row .field { flex: 1; min-width: 7rem; }
	.stepper {
		display: flex;
		align-items: stretch;
		gap: 0;
		width: fit-content;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		overflow: hidden;
	}
	.stepper button {
		width: 2rem;
		display: grid;
		place-items: center;
		font-size: 1.1rem;
		color: var(--b-text-dim);
		background: var(--b-surface-2);
		transition: background var(--b-transition-fast), color var(--b-transition-fast);
	}
	.stepper button:hover { background: var(--b-gold-soft); color: var(--b-gold); }
	.stepper .num {
		width: 3.2rem;
		text-align: center;
		border: none;
		border-left: 1px solid var(--b-border);
		border-right: 1px solid var(--b-border);
		border-radius: 0;
		font-family: var(--b-font-pixel);
		font-size: 1.1rem;
		padding: 0.4rem 0;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.stepper .num::-webkit-outer-spin-button,
	.stepper .num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

	.check {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-text-dim);
		cursor: pointer;
	}
	.check input { accent-color: var(--b-gold); width: 14px; height: 14px; }

	/* studio entry */
	.studio-open {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		width: 100%;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--b-border-strong);
		border-radius: var(--b-radius-md);
		background: linear-gradient(120deg, var(--b-gold-soft), transparent);
		text-align: left;
		transition: border-color var(--b-transition-fast), transform var(--b-transition-fast);
	}
	.studio-open:hover:not(:disabled) { border-color: var(--b-gold); transform: translateY(-1px); }
	.studio-open:disabled { opacity: 0.6; }
	.so-glyph { font-size: 1.2rem; color: var(--b-gold); }
	.so-text { display: flex; flex-direction: column; gap: 0.1rem; }
	.so-title {
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
		color: var(--b-text);
		letter-spacing: 0.02em;
	}
	.so-sub { font-family: var(--b-font-body); font-style: italic; font-size: 0.74rem; color: var(--b-muted); }
	.studio-note {
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		color: var(--b-muted);
	}
</style>
