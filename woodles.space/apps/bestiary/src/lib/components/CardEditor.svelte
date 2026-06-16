<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import { domains, rarities } from '$lib/content/domains';
	import type { Domain, Rarity } from '$lib/content/domains';
	import type { CardSize } from '$lib/types';
	import { clampInt } from '$lib/utils';
	import {
		emptyComposition,
		cloneComposition,
		createImageLayer,
		coverScale,
		type Composition
	} from '$lib/composer';
	import { measureImage } from '$lib/render';
	import { exportCardPng, exportArtPng } from '$lib/cardImage';
	import CreatureCard from './CreatureCard.svelte';
	import SpriteInput from './SpriteInput.svelte';
	import SpriteStudio from './SpriteStudio.svelte';
	import StatBlock from './StatBlock.svelte';
	import AppearancePanel from './AppearancePanel.svelte';

	let creature = $derived(bestiary.activeCreature);

	// The workshop is organised as a set of benches; the tool rail picks which
	// one the right-hand panel is showing. "look" sits apart from the content
	// benches — it dresses the card rather than defining the creature.
	type Section = 'identity' | 'summoning' | 'stats' | 'sprite' | 'lore' | 'look';
	const contentBenches: { id: Section; glyph: string; label: string; note: string }[] = [
		{ id: 'identity', glyph: '❦', label: 'identity', note: 'name, kind & domain' },
		{ id: 'summoning', glyph: '✦', label: 'summoning', note: 'cost, rarity & numbers' },
		{ id: 'stats', glyph: '⬡', label: 'stats', note: 'the six capacities' },
		{ id: 'sprite', glyph: '✶', label: 'sprite', note: 'art & the studio' },
		{ id: 'lore', glyph: '✑', label: 'lore', note: 'abilities & flavor' }
	];
	const lookBench = { id: 'look' as Section, glyph: '✿', label: 'look & feel', note: 'frame, finish & colour' };
	const allBenches = [...contentBenches, lookBench];

	let section = $state<Section>('identity');
	let bench = $derived(allBenches.find((b) => b.id === section) ?? contentBenches[0]);

	// ── workshop layout & comfort (persisted; see bestiary.setWorkshop) ──
	let w = $derived(bestiary.workshop);
	// "focus" is simply both wings folded at once — no separate state to drift.
	let focusActive = $derived(w.railCollapsed && w.panelCollapsed);

	const SIZE_W: Record<CardSize, string> = {
		snug: 'clamp(230px, 22vw, 340px)',
		roomy: 'clamp(280px, 30vw, 460px)',
		grand: 'clamp(320px, 42vw, 640px)'
	};
	const sizes: { id: CardSize; label: string }[] = [
		{ id: 'snug', label: 'snug' },
		{ id: 'roomy', label: 'roomy' },
		{ id: 'grand', label: 'grand' }
	];
	let specimenW = $derived(SIZE_W[w.cardSize] ?? SIZE_W.roomy);
	let railW = $derived(w.railCollapsed ? '66px' : '236px');
	let gridCols = $derived(
		`${railW} minmax(0, 1fr)${w.panelCollapsed ? '' : ' clamp(330px, 26vw, 460px)'}`
	);

	function toggleFocus() {
		const next = !focusActive;
		bestiary.setWorkshop({ railCollapsed: next, panelCollapsed: next });
	}

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

	// ── export ─────────────────────────────────────────────────────────
	// A hidden, fixed-width copy of the card is rasterised so the PNG is crisp
	// regardless of the on-screen preview size.
	let exportNode = $state<HTMLDivElement>();
	let exporting = $state<null | 'card' | 'art'>(null);
	let exportError = $state<string | null>(null);

	async function saveCard() {
		if (!creature || !exportNode || exporting) return;
		exporting = 'card';
		exportError = null;
		try {
			await exportCardPng(exportNode, creature.name.trim() || 'creature', 2);
		} catch {
			exportError = 'could not render the card image';
		} finally {
			exporting = null;
		}
	}

	async function saveArt() {
		if (!creature?.sprite || exporting) return;
		exporting = 'art';
		exportError = null;
		try {
			await exportArtPng(creature.sprite, creature.name.trim() || 'creature');
		} catch {
			exportError = 'could not export the art';
		} finally {
			exporting = null;
		}
	}
</script>


{#if creature}
	<div
		class="workshop"
		class:calm={w.calm}
		class:hide-hints={!w.showHints}
		style={`grid-template-columns: ${gridCols};`}
	>
		<!-- ── the tool rail: pick a bench ─────────────────────────────── -->
		<nav class="rail" class:collapsed={w.railCollapsed}>
			<button class="back" onclick={() => bestiary.openCollection()} title="the shelf">
				<span class="back-glyph">←</span><span class="back-text">the shelf</span>
			</button>
			<p class="rail-title"><span class="rail-mark">✦</span> <span class="back-text">the workshop</span></p>

			<div class="rail-benches" role="tablist" aria-label="workbench">
				{#each contentBenches as b (b.id)}
					<button
						type="button"
						role="tab"
						class="bench"
						class:active={section === b.id}
						aria-selected={section === b.id}
						title={b.label}
						onclick={() => (section = b.id)}
					>
						<span class="bench-glyph">{b.glyph}</span>
						<span class="bench-text">
							<span class="bench-label">{b.label}</span>
							<span class="bench-note">{b.note}</span>
						</span>
					</button>
				{/each}

				<div class="rail-divider"><span>finish</span></div>

				<button
					type="button"
					role="tab"
					class="bench"
					class:active={section === lookBench.id}
					aria-selected={section === lookBench.id}
					title={lookBench.label}
					onclick={() => (section = lookBench.id)}
				>
					<span class="bench-glyph">{lookBench.glyph}</span>
					<span class="bench-text">
						<span class="bench-label">{lookBench.label}</span>
						<span class="bench-note">{lookBench.note}</span>
					</span>
				</button>
			</div>

			<div class="rail-actions">
				<button class="ghost" onclick={handleDuplicate} title="duplicate">
					<span class="act-glyph">⎘</span><span class="act-label">duplicate</span>
				</button>
				<button class="danger" onclick={handleDelete} title="release">
					<span class="act-glyph">✕</span><span class="act-label">release</span>
				</button>
				<button class="primary" onclick={() => bestiary.openCollection()} title="done">
					<span class="act-glyph">✓</span><span class="act-label">done</span>
				</button>
			</div>
		</nav>

		<!-- ── the stage: the specimen under the lamp ──────────────────── -->
		<section class="stage" class:focus-on={focusActive && !w.calm}>
			<!-- the lamp bar: the workshop's one, unmoving set of view controls -->
			<div class="stage-bar">
				<button
					type="button"
					class="bar-btn fold-rail"
					class:on={!w.railCollapsed}
					title={w.railCollapsed ? 'open the tools' : 'fold the tools away'}
					aria-pressed={!w.railCollapsed}
					onclick={() => bestiary.setWorkshop({ railCollapsed: !w.railCollapsed })}
				>
					<span class="bar-chev">{w.railCollapsed ? '»' : '«'}</span>
					<span class="bar-text">tools</span>
				</button>

				<div class="bar-center">
					<div class="size-seg" role="group" aria-label="specimen size">
						{#each sizes as s (s.id)}
							<button
								type="button"
								class="size-btn"
								class:on={w.cardSize === s.id}
								onclick={() => bestiary.setWorkshop({ cardSize: s.id })}
							>{s.label}</button>
						{/each}
					</div>
					<button
						type="button"
						class="bar-btn focus"
						class:on={focusActive}
						title="just you and the specimen"
						aria-pressed={focusActive}
						onclick={toggleFocus}
					>
						<span class="bar-chev">◎</span>
						<span class="bar-text">{focusActive ? 'unfocus' : 'focus'}</span>
					</button>
				</div>

				<button
					type="button"
					class="bar-btn fold-panel"
					class:on={!w.panelCollapsed}
					title={w.panelCollapsed ? 'open the controls' : 'fold the controls away'}
					aria-pressed={!w.panelCollapsed}
					onclick={() => bestiary.setWorkshop({ panelCollapsed: !w.panelCollapsed })}
				>
					<span class="bar-text">controls</span>
					<span class="bar-chev">{w.panelCollapsed ? '«' : '»'}</span>
				</button>
			</div>

			<div class="stage-scroll">
				<div class="stage-inner">
					{#if !w.calm && !w.reduceMotion}
						<span class="spark" aria-hidden="true">✦</span>
					{/if}
					<div class="specimen" style={`width: ${specimenW};`}>
						<CreatureCard {creature} />
					</div>
					<p class="preview-note">
						{section === 'look'
							? 'dress the card — every change shows here'
							: 'a living likeness — it changes as you work'}
					</p>
					<div class="export-row">
						<button class="exp" onclick={saveCard} disabled={!!exporting}>
							{exporting === 'card' ? 'saving…' : '↓ save card'}
						</button>
						{#if creature.sprite}
							<button class="exp ghost" onclick={saveArt} disabled={!!exporting}>
								{exporting === 'art' ? 'saving…' : 'art only'}
							</button>
						{/if}
					</div>
					{#if exportError}<p class="export-err">{exportError}</p>{/if}
				</div>
			</div>
		</section>

		<!-- ── the bench: the controls for the chosen tool ─────────────── -->
		{#if !w.panelCollapsed}
		<aside class="bench-panel">
			<header class="bench-head">
				<span class="bench-head-glyph">{bench.glyph}</span>
				<span class="bench-head-text">
					<h2 class="bench-head-title">{bench.label}</h2>
					<p class="bench-head-note">{bench.note}</p>
				</span>
			</header>

			<form class="bench-body" onsubmit={(e) => e.preventDefault()}>
				{#if section === 'identity'}
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
				{:else if section === 'summoning'}
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
				{:else if section === 'stats'}
					<StatBlock {creature} />
				{:else if section === 'sprite'}
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
				{:else if section === 'lore'}
					<fieldset class="group">
						<legend>the card text</legend>

						<label class="field">
							<span class="label">abilities <em>· rules text</em></span>
							<textarea
								class="area"
								rows="4"
								placeholder="what it does — e.g. “When this enters, draw the margin.”"
								value={creature.abilities}
								oninput={(e) => set({ abilities: e.currentTarget.value })}
							></textarea>
						</label>

						<label class="field">
							<span class="label">flavor <em>· italic, at the foot of the box</em></span>
							<textarea
								class="area"
								rows="3"
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
				{:else if section === 'look'}
					<AppearancePanel {creature} />
				{/if}
			</form>
		</aside>
		{/if}
	</div>

	<!-- hidden, fixed-width card used only for crisp PNG export -->
	<div class="export-stage" bind:this={exportNode} aria-hidden="true">
		<CreatureCard {creature} />
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
	/* ════════════════════════════════════════════════════════════════
	   THE WORKSHOP — a full-bleed three-zone bench:
	   rail (pick a tool) · stage (the specimen) · panel (its controls).
	   Each zone scrolls on its own so the card never leaves the lamp. */
	.workshop {
		height: 100%;
		display: grid;
		/* grid-template-columns is set inline so the rail & panel can fold */
		grid-template-columns: 236px minmax(0, 1fr) clamp(330px, 26vw, 460px);
		background:
			radial-gradient(120% 80% at 50% -10%, rgba(255, 216, 234, 0.5), transparent 60%),
			var(--b-bg-2);
		transition: grid-template-columns var(--b-transition-medium);
	}
	/* calm the lights: drop the lit wash for one quiet surface */
	.workshop.calm {
		background: var(--b-bg);
	}

	/* whispered notes, hushed: cut the inline descriptions to lighten the read */
	.hide-hints .bench-note,
	.hide-hints .bench-head-note,
	.hide-hints .preview-note,
	.hide-hints .hint-note,
	.hide-hints .studio-note,
	.hide-hints .label em {
		display: none;
	}

	/* ── the tool rail ──────────────────────────────────────────────── */
	.rail {
		display: flex;
		flex-direction: column;
		gap: var(--b-space-md);
		padding: var(--b-space-lg) var(--b-space-md);
		background: var(--b-surface);
		border-right: 1px solid var(--b-border);
		overflow-y: auto;
	}
	.back {
		align-self: flex-start;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-text-dim);
		transition: color var(--b-transition-fast);
	}
	.back:hover { color: var(--b-gold); }
	.back-glyph { font-size: 0.95rem; }
	.rail-title {
		font-family: var(--b-font-codex);
		font-size: 1.15rem;
		color: var(--b-text);
		letter-spacing: 0.02em;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.rail-mark { color: var(--b-gold); font-size: 0.9rem; }

	.act-glyph { display: none; }

	.rail-benches { display: flex; flex-direction: column; gap: 2px; }
	.bench {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.6rem;
		border-radius: var(--b-radius-md);
		border: 1px solid transparent;
		color: var(--b-text-dim);
		transition: background var(--b-transition-fast), color var(--b-transition-fast),
			border-color var(--b-transition-fast);
	}
	.bench-glyph {
		font-size: 1rem;
		width: 1.4rem;
		text-align: center;
		color: var(--b-muted);
		flex-shrink: 0;
		transition: color var(--b-transition-fast);
	}
	.bench-text { display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; }
	.bench-label { font-family: var(--b-font-mono); font-size: 0.82rem; }
	.bench-note {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.72rem;
		color: var(--b-muted);
	}
	.bench:hover { background: var(--b-gold-soft); color: var(--b-text); }
	.bench:hover .bench-glyph { color: var(--b-gold); }
	.bench.active {
		background: var(--b-gold-soft);
		border-color: var(--b-border-strong);
		color: var(--b-text);
	}
	.bench.active .bench-glyph { color: var(--b-gold); }

	.rail-divider {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		margin: var(--b-space-sm) 0.3rem;
		font-family: var(--b-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--b-muted);
	}
	.rail-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--b-rule);
	}

	.rail-actions {
		margin-top: auto;
		padding-top: var(--b-space-md);
		display: flex;
		flex-direction: column;
		gap: var(--b-space-sm);
	}
	.primary {
		background: var(--b-gold);
		color: var(--b-on-accent);
		border-radius: var(--b-radius-sm);
		padding: 0.5rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 600;
		font-family: var(--b-font-mono);
		transition: transform var(--b-transition-fast), box-shadow var(--b-transition-fast);
	}
	.primary:hover { transform: translateY(-1px); box-shadow: 0 0.4rem 1rem var(--b-gold-soft); }
	.ghost, .danger {
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
		font-family: var(--b-font-mono);
		color: var(--b-text-dim);
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast);
	}
	.ghost:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.danger { color: var(--b-muted); }
	.danger:hover { border-color: var(--b-mythic); color: var(--b-mythic); }

	/* ── rail folded to glyphs: the workshop, made small ───────────────── */
	.rail.collapsed { padding: var(--b-space-lg) 0.4rem; align-items: center; }
	.rail.collapsed .back-text,
	.rail.collapsed .rail-title,
	.rail.collapsed .bench-text,
	.rail.collapsed .act-label,
	.rail.collapsed .rail-divider { display: none; }
	.rail.collapsed .back { align-self: center; }
	.rail.collapsed .rail-benches { align-items: center; gap: var(--b-space-xs); }
	.rail.collapsed .bench { width: auto; justify-content: center; padding: 0.5rem; }
	.rail.collapsed .bench-glyph { width: auto; font-size: 1.15rem; }
	.rail.collapsed .rail-actions { align-items: center; gap: var(--b-space-xs); }
	.rail.collapsed .ghost,
	.rail.collapsed .danger,
	.rail.collapsed .primary { padding: 0.5rem; }
	.rail.collapsed .act-glyph { display: inline; font-size: 0.95rem; }

	/* ── the stage ──────────────────────────────────────────────────── */
	.stage {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
	}

	/* the lamp bar — the workshop's single, never-moving set of view controls */
	.stage-bar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--b-space-sm);
		padding: var(--b-space-sm) var(--b-space-md);
		border-bottom: 1px solid var(--b-rule);
		background: color-mix(in srgb, var(--b-surface) 55%, transparent);
		backdrop-filter: blur(6px);
	}
	.workshop.calm .stage-bar { background: var(--b-surface); backdrop-filter: none; }
	.bar-center { display: flex; align-items: center; gap: var(--b-space-sm); }
	.bar-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--b-font-mono);
		font-size: 0.74rem;
		color: var(--b-text-dim);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-pill);
		padding: 0.32rem 0.75rem;
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast),
			background var(--b-transition-fast);
	}
	.bar-btn:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.bar-btn.on { color: var(--b-text); border-color: var(--b-border-strong); }
	.bar-btn.focus.on {
		background: var(--b-gold);
		color: var(--b-on-accent);
		border-color: var(--b-gold);
	}
	.bar-chev { font-size: 0.85rem; line-height: 1; }

	.size-seg {
		display: inline-flex;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-pill);
		overflow: hidden;
	}
	.size-btn {
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text-dim);
		padding: 0.32rem 0.7rem;
		transition: background var(--b-transition-fast), color var(--b-transition-fast);
	}
	.size-btn:hover { color: var(--b-gold); }
	.size-btn.on { background: var(--b-gold-soft); color: var(--b-text); }

	.stage-scroll {
		flex: 1;
		overflow-y: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--b-space-xl);
		transition: background var(--b-transition-medium);
	}
	/* under the lamp: a soft spotlight when nothing else is in the room */
	.stage.focus-on .stage-scroll {
		background: radial-gradient(58% 52% at 50% 46%, transparent 38%, rgba(120, 90, 120, 0.12) 100%);
	}
	.stage-inner {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--b-space-md);
		width: 100%;
	}
	/* a drifting spark, the workshop breathing — hushed by calm & still air */
	.spark {
		position: absolute;
		top: -0.4rem;
		left: 50%;
		font-size: 1.1rem;
		color: var(--b-gold);
		opacity: 0.5;
		pointer-events: none;
		animation: spark-drift 7s ease-in-out infinite;
	}
	@keyframes spark-drift {
		0%, 100% { transform: translate(-50%, 0) rotate(0deg); opacity: 0.35; }
		50% { transform: translate(-50%, -12px) rotate(8deg); opacity: 0.75; }
	}
	.specimen {
		max-width: 100%;
		filter: drop-shadow(0 18px 40px rgba(206, 130, 175, 0.32));
		transition: transform var(--b-transition-spring), width var(--b-transition-medium);
	}
	.specimen:hover { transform: translateY(-4px) rotate(-0.4deg); }
	.workshop.calm .specimen { filter: drop-shadow(0 4px 12px rgba(150, 110, 140, 0.14)); }
	.workshop.calm .specimen:hover { transform: none; }
	.preview-note {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.82rem;
		color: var(--b-text-dim);
		text-align: center;
	}

	.export-row { display: flex; gap: var(--b-space-sm); justify-content: center; flex-wrap: wrap; }
	.exp {
		border: 1px solid var(--b-border-strong);
		border-radius: var(--b-radius-sm);
		padding: 0.45rem 0.9rem;
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-on-accent);
		background: var(--b-gold);
		transition: opacity var(--b-transition-fast), border-color var(--b-transition-fast),
			color var(--b-transition-fast);
	}
	.exp:hover:not(:disabled) { opacity: 0.88; }
	.exp:disabled { opacity: 0.5; }
	.exp.ghost {
		background: transparent;
		color: var(--b-text-dim);
		border-color: var(--b-border);
	}
	.exp.ghost:hover:not(:disabled) { border-color: var(--b-gold); color: var(--b-gold); opacity: 1; }
	.export-err {
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-mythic);
		text-align: center;
	}

	/* ── the bench panel ────────────────────────────────────────────── */
	.bench-panel {
		display: flex;
		flex-direction: column;
		background: var(--b-surface);
		border-left: 1px solid var(--b-border);
		overflow: hidden;
	}
	.bench-head {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		padding: var(--b-space-lg) var(--b-space-lg) var(--b-space-md);
		border-bottom: 1px solid var(--b-rule);
		flex-shrink: 0;
	}
	.bench-head-glyph { font-size: 1.3rem; color: var(--b-gold); }
	.bench-head-text { display: flex; flex-direction: column; gap: 0.1rem; }
	.bench-head-title {
		font-family: var(--b-font-codex);
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--b-text);
		line-height: 1.1;
	}
	.bench-head-note {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.76rem;
		color: var(--b-muted);
	}
	.bench-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--b-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--b-space-lg);
		min-width: 0;
	}

	/* ── narrow: fold the three zones into a single scrolling column ── */
	@media (max-width: 1024px) {
		.workshop {
			height: auto;
			min-height: 100%;
			display: flex;
			flex-direction: column;
		}
		/* the rail reads as a row of tabs again, regardless of the folded flag */
		.rail,
		.rail.collapsed {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: var(--b-space-sm);
			padding: var(--b-space-sm) var(--b-space-md);
			border-right: none;
			border-bottom: 1px solid var(--b-border);
			overflow-x: auto;
			position: sticky;
			top: 0;
			z-index: var(--b-z-panel);
		}
		.rail-title,
		.rail.collapsed .rail-title { display: none; }
		.rail.collapsed .back-text { display: inline; }
		/* every bench stays in view — wrapped chips, never a hidden scroll */
		.rail-benches,
		.rail.collapsed .rail-benches {
			flex-direction: row;
			flex-wrap: wrap;
			flex: 1 1 100%;
			min-width: 0;
			overflow: visible;
			align-items: center;
			gap: var(--b-space-xs);
		}
		.bench,
		.rail.collapsed .bench {
			width: auto;
			flex-shrink: 0;
			justify-content: flex-start;
			border-color: var(--b-border);
		}
		.rail.collapsed .bench-text { display: flex; }
		.bench-note { display: none; }
		.rail-divider,
		.rail.collapsed .rail-divider { display: none; }
		.rail-actions,
		.rail.collapsed .rail-actions {
			margin-top: 0;
			padding-top: 0;
			flex-direction: row;
			margin-left: auto;
		}
		.rail.collapsed .act-label { display: inline; }

		/* the lamp bar's fold toggles are spatial — meaningless once stacked */
		.fold-rail, .fold-panel { display: none; }
		.stage-bar { flex-wrap: wrap; justify-content: center; }

		.stage { overflow: visible; }
		.stage-scroll { overflow: visible; padding: var(--b-space-lg); }
		.stage.focus-on .stage-scroll { background: none; }
		.bench-panel { border-left: none; border-top: 1px solid var(--b-border); overflow: visible; }
		.bench-body { overflow-y: visible; }
	}

	/* the off-screen card the exporter rasterises — laid out, never shown */
	.export-stage {
		position: fixed;
		left: -10000px;
		top: 0;
		width: 640px;
		pointer-events: none;
		opacity: 1;
	}

	/* ── form internals (shared by every bench) ── */
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
