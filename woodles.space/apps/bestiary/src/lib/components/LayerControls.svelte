<script lang="ts">
	import {
		BLEND_MODES,
		MIN_SCALE,
		MAX_SCALE,
		MAX_BLUR,
		MAX_OUTLINE,
		defaultFilters,
		defaultOutline,
		filtersAreDefault,
		type Fill,
		type Filters,
		type Outline,
		type ImageLayer,
		type FillLayer,
		type BlendMode
	} from '$lib/composer';
	import type { StudioState } from '$lib/studio.svelte';

	let { studio }: { studio: StudioState } = $props();

	let layer = $derived(studio.selected);

	function up(changes: Partial<ImageLayer> | Partial<FillLayer>) {
		studio.updateSelected(changes as never);
	}

	const pct = (n: number) => `${Math.round(n * 100)}%`;

	// ── fill helpers (shared by the backdrop fill and the outline fill) ──

	function nextFillType(cur: Fill, type: Fill['type']): Fill {
		const from = 'from' in cur ? cur.from : 'color' in cur ? cur.color : '#bfe4ff';
		const to = 'to' in cur ? cur.to : '#eaf6ff';
		if (type === 'solid') return { type: 'solid', color: from };
		if (type === 'linear') return { type: 'linear', from, to, angle: 180 };
		return { type: 'radial', from, to };
	}

	// backdrop fill
	function bgType(t: Fill['type']) {
		const l = layer;
		if (l?.kind === 'fill') studio.commit(() => up({ fill: nextFillType(l.fill, t) }));
	}
	function bgCommit(p: Partial<Fill>) {
		const l = layer;
		if (l?.kind === 'fill') studio.commit(() => up({ fill: { ...l.fill, ...p } as Fill }));
	}
	function bgLive(p: Partial<Fill>) {
		const l = layer;
		if (l?.kind === 'fill') up({ fill: { ...l.fill, ...p } as Fill });
	}

	// ── outline ──────────────────────────────────────────────────────
	function toggleOutline() {
		const l = layer;
		if (l?.kind === 'image') studio.commit(() => up({ outline: l.outline ? null : defaultOutline() }));
	}
	function setOutline(p: Partial<Outline>) {
		const l = layer;
		if (l?.kind === 'image' && l.outline) up({ outline: { ...l.outline, ...p } });
	}
	function olType(t: Fill['type']) {
		const l = layer;
		if (l?.kind === 'image' && l.outline)
			studio.commit(() => up({ outline: { ...l.outline!, fill: nextFillType(l.outline!.fill, t) } }));
	}
	function olCommit(p: Partial<Fill>) {
		const l = layer;
		if (l?.kind === 'image' && l.outline)
			studio.commit(() =>
				up({ outline: { ...l.outline!, fill: { ...l.outline!.fill, ...p } as Fill } })
			);
	}
	function olLive(p: Partial<Fill>) {
		const l = layer;
		if (l?.kind === 'image' && l.outline)
			up({ outline: { ...l.outline, fill: { ...l.outline.fill, ...p } as Fill } });
	}

	// ── filters ──────────────────────────────────────────────────────
	function setFilter(p: Partial<Filters>) {
		const l = layer;
		if (l?.kind === 'image') up({ filters: { ...l.filters, ...p } });
	}
	function resetFilters() {
		const l = layer;
		if (l?.kind === 'image') studio.commit(() => up({ filters: defaultFilters() }));
	}
</script>

{#snippet range(
	label: string,
	value: number,
	min: number,
	max: number,
	step: number,
	read: string,
	set: (n: number) => void
)}
	<label class="row">
		<span class="row-label">{label}<span class="read">{read}</span></span>
		<input type="range" {min} {max} {step} {value} oninput={(e) => set(e.currentTarget.valueAsNumber)} />
	</label>
{/snippet}

{#snippet fillControls(
	fill: Fill,
	changeType: (t: Fill['type']) => void,
	commitPatch: (p: Partial<Fill>) => void,
	livePatch: (p: Partial<Fill>) => void
)}
	<div class="seg">
		{#each ['solid', 'linear', 'radial'] as const as t (t)}
			<button type="button" class="seg-btn" class:on={fill.type === t} onclick={() => changeType(t)}>{t}</button>
		{/each}
	</div>
	{#if fill.type === 'solid'}
		<label class="swatch-row">
			<span class="row-label">colour</span>
			<input type="color" value={fill.color} oninput={(e) => commitPatch({ color: e.currentTarget.value })} />
		</label>
	{:else}
		<label class="swatch-row">
			<span class="row-label">from</span>
			<input type="color" value={fill.from} oninput={(e) => commitPatch({ from: e.currentTarget.value })} />
		</label>
		<label class="swatch-row">
			<span class="row-label">to</span>
			<input type="color" value={fill.to} oninput={(e) => commitPatch({ to: e.currentTarget.value })} />
		</label>
		{#if fill.type === 'linear'}
			{@render range('angle', fill.angle, 0, 360, 1, `${Math.round(fill.angle)}°`, (n) =>
				livePatch({ angle: n })
			)}
		{/if}
	{/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="controls"
	onpointerdown={() => studio.begin()}
	onpointerup={() => studio.end()}
	onkeydown={() => studio.begin()}
	onkeyup={() => studio.end()}
	role="group"
	aria-label="layer controls"
>
	{#if !layer}
		<p class="none">select a layer to shape it — drag it on the stage, or tune it here.</p>
	{:else}
		<header class="ctl-head">
			<span class="ctl-kind">{layer.kind === 'image' ? '▣ image' : '▦ backdrop'}</span>
			<span class="ctl-name" title={layer.name}>{layer.name}</span>
		</header>

		{@render range('opacity', layer.opacity, 0, 1, 0.01, pct(layer.opacity), (n) => up({ opacity: n }))}
		{@render range('blur', layer.blur, 0, MAX_BLUR, 0.002, pct(layer.blur / MAX_BLUR), (n) =>
			up({ blur: n })
		)}

		<label class="row">
			<span class="row-label">blend</span>
			<select class="select" value={layer.blend} onchange={(e) => up({ blend: e.currentTarget.value as BlendMode })}>
				{#each BLEND_MODES as b (b.id)}
					<option value={b.id}>{b.name}</option>
				{/each}
			</select>
		</label>

		{#if layer.kind === 'image'}
			{@render range('scale', layer.scale, MIN_SCALE, MAX_SCALE, 0.01, `${layer.scale.toFixed(2)}×`, (n) =>
				up({ scale: n })
			)}
			{@render range('rotation', layer.rotation, -180, 180, 1, `${Math.round(layer.rotation)}°`, (n) =>
				up({ rotation: n })
			)}
			{@render range('position x', layer.x, -1, 1, 0.01, layer.x.toFixed(2), (n) => up({ x: n }))}
			{@render range('position y', layer.y, -1, 1, 0.01, layer.y.toFixed(2), (n) => up({ y: n }))}

			<div class="toggles">
				<button type="button" class="tog" class:on={layer.flipX} onclick={() => up({ flipX: !layer.flipX })}>flip ⇆</button>
				<button type="button" class="tog" class:on={layer.flipY} onclick={() => up({ flipY: !layer.flipY })}>flip ⇅</button>
				<button type="button" class="tog" class:on={!layer.smooth} title="render without smoothing — for pixel art" onclick={() => up({ smooth: !layer.smooth })}>pixel</button>
			</div>

			<!-- outline -->
			<section class="sub">
				<div class="sub-head">
					<span class="sub-title">outline</span>
					<button type="button" class="toggle" class:on={!!layer.outline} onclick={toggleOutline}>
						{layer.outline ? 'on' : 'off'}
					</button>
				</div>
				{#if layer.outline}
					<p class="sub-note">traced from the png's edges — best on cut-out art</p>
					{@render range('thickness', layer.outline.width, 0, MAX_OUTLINE, 0.002, pct(layer.outline.width / MAX_OUTLINE), (n) =>
						setOutline({ width: n })
					)}
					{@render range('softness', layer.outline.softness, 0, 1, 0.01, pct(layer.outline.softness), (n) =>
						setOutline({ softness: n })
					)}
					{@render fillControls(layer.outline.fill, olType, olCommit, olLive)}
				{/if}
			</section>

			<!-- filters -->
			<section class="sub">
				<div class="sub-head">
					<span class="sub-title">filters</span>
					{#if !filtersAreDefault(layer.filters)}
						<button type="button" class="toggle" onclick={resetFilters}>reset</button>
					{/if}
				</div>
				{@render range('brightness', layer.filters.brightness, 0, 2, 0.01, pct(layer.filters.brightness), (n) =>
					setFilter({ brightness: n })
				)}
				{@render range('contrast', layer.filters.contrast, 0, 2, 0.01, pct(layer.filters.contrast), (n) =>
					setFilter({ contrast: n })
				)}
				{@render range('saturation', layer.filters.saturate, 0, 3, 0.01, pct(layer.filters.saturate), (n) =>
					setFilter({ saturate: n })
				)}
				{@render range('hue', layer.filters.hue, -180, 180, 1, `${Math.round(layer.filters.hue)}°`, (n) =>
					setFilter({ hue: n })
				)}
				{@render range('sepia', layer.filters.sepia, 0, 1, 0.01, pct(layer.filters.sepia), (n) =>
					setFilter({ sepia: n })
				)}
				{@render range('grayscale', layer.filters.grayscale, 0, 1, 0.01, pct(layer.filters.grayscale), (n) =>
					setFilter({ grayscale: n })
				)}
				{@render range('invert', layer.filters.invert, 0, 1, 0.01, pct(layer.filters.invert), (n) =>
					setFilter({ invert: n })
				)}
			</section>
		{:else}
			<div class="fill-editor">
				{@render fillControls(layer.fill, bgType, bgCommit, bgLive)}
			</div>
		{/if}
	{/if}
</div>

<style>
	.controls { display: flex; flex-direction: column; gap: var(--b-space-sm); }
	.none {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.82rem;
		color: var(--b-muted);
		line-height: 1.5;
	}
	.ctl-head {
		display: flex;
		align-items: baseline;
		gap: var(--b-space-sm);
		padding-bottom: var(--b-space-xs);
		border-bottom: 1px solid var(--b-rule);
	}
	.ctl-kind {
		font-family: var(--b-font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--b-gold);
	}
	.ctl-name {
		font-family: var(--b-font-body);
		font-size: 0.86rem;
		color: var(--b-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row { display: flex; flex-direction: column; gap: 0.2rem; }
	.row-label {
		display: flex;
		justify-content: space-between;
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		color: var(--b-text-dim);
	}
	.read { color: var(--b-muted); }

	input[type='range'] { width: 100%; accent-color: var(--b-gold); height: 1.1rem; }

	.select {
		background: var(--b-surface-2);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.3rem 0.4rem;
		color: var(--b-text);
		font-family: var(--b-font-mono);
		font-size: 0.74rem;
	}

	.toggles { display: flex; gap: var(--b-space-xs); flex-wrap: wrap; margin-top: 0.2rem; }
	.tog {
		flex: 1;
		min-width: 4rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.32rem 0.4rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text-dim);
		transition: all var(--b-transition-fast);
	}
	.tog:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.tog.on { background: var(--b-gold); color: var(--b-on-accent); border-color: var(--b-gold); }

	/* sub-sections (outline, filters) */
	.sub {
		display: flex;
		flex-direction: column;
		gap: var(--b-space-sm);
		padding-top: var(--b-space-sm);
		margin-top: 0.2rem;
		border-top: 1px solid var(--b-rule);
	}
	.sub-head { display: flex; align-items: center; justify-content: space-between; }
	.sub-title {
		font-family: var(--b-font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--b-gold);
	}
	.sub-note { font-family: var(--b-font-body); font-style: italic; font-size: 0.72rem; color: var(--b-muted); margin: -0.2rem 0 0.1rem; }
	.toggle {
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-pill);
		padding: 0.16rem 0.55rem;
		font-family: var(--b-font-mono);
		font-size: 0.66rem;
		color: var(--b-text-dim);
		transition: all var(--b-transition-fast);
	}
	.toggle:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.toggle.on { background: var(--b-gold); color: var(--b-on-accent); border-color: var(--b-gold); }

	.fill-editor { display: flex; flex-direction: column; gap: var(--b-space-sm); }
	.seg { display: flex; gap: 0; border: 1px solid var(--b-border); border-radius: var(--b-radius-sm); overflow: hidden; }
	.seg-btn {
		flex: 1;
		padding: 0.32rem 0.3rem;
		font-family: var(--b-font-mono);
		font-size: 0.7rem;
		color: var(--b-text-dim);
		background: var(--b-surface-2);
		transition: all var(--b-transition-fast);
	}
	.seg-btn:not(:last-child) { border-right: 1px solid var(--b-border); }
	.seg-btn.on { background: var(--b-gold); color: var(--b-on-accent); }

	.swatch-row { display: flex; align-items: center; justify-content: space-between; gap: var(--b-space-sm); }
	.swatch-row input[type='color'] {
		width: 3.2rem;
		height: 1.7rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		background: none;
		padding: 0;
		cursor: pointer;
	}
</style>
