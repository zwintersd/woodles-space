<script lang="ts">
	import {
		BLEND_MODES,
		MIN_SCALE,
		MAX_SCALE,
		MAX_BLUR,
		type Fill,
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

	// Discrete fill edits (colour pickers) each land as one undo step — the
	// panel's begin/end can miss a native colour dialog that resolves after
	// pointerup, so these self-commit.
	function setFill(patch: Partial<Fill>) {
		const l = layer;
		if (!l || l.kind !== 'fill') return;
		studio.commit(() => up({ fill: { ...l.fill, ...patch } as Fill }));
	}

	// Continuous fill edits (the gradient angle slider) ride the panel's
	// begin/end bracket, so the whole drag collapses into one history step.
	function setFillLive(patch: Partial<Fill>) {
		const l = layer;
		if (!l || l.kind !== 'fill') return;
		up({ fill: { ...l.fill, ...patch } as Fill });
	}

	function changeFillType(type: Fill['type']) {
		const l = layer;
		if (!l || l.kind !== 'fill') return;
		const cur = l.fill;
		const from = 'from' in cur ? cur.from : 'color' in cur ? cur.color : '#bfe4ff';
		const to = 'to' in cur ? cur.to : '#eaf6ff';
		let next: Fill;
		if (type === 'solid') next = { type: 'solid', color: from };
		else if (type === 'linear') next = { type: 'linear', from, to, angle: 180 };
		else next = { type: 'radial', from, to };
		studio.commit(() => up({ fill: next }));
	}

	const pct = (n: number) => `${Math.round(n * 100)}%`;
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
		<input
			type="range"
			{min}
			{max}
			{step}
			{value}
			oninput={(e) => set(e.currentTarget.valueAsNumber)}
		/>
	</label>
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

		<!-- shared: opacity · blur · blend -->
		{@render range('opacity', layer.opacity, 0, 1, 0.01, pct(layer.opacity), (n) =>
			up({ opacity: n })
		)}
		{@render range('blur', layer.blur, 0, MAX_BLUR, 0.002, pct(layer.blur / MAX_BLUR), (n) =>
			up({ blur: n })
		)}

		<label class="row">
			<span class="row-label">blend</span>
			<select
				class="select"
				value={layer.blend}
				onchange={(e) => up({ blend: e.currentTarget.value as BlendMode })}
			>
				{#each BLEND_MODES as b (b.id)}
					<option value={b.id}>{b.name}</option>
				{/each}
			</select>
		</label>

		{#if layer.kind === 'image'}
			{@render range(
				'scale',
				layer.scale,
				MIN_SCALE,
				MAX_SCALE,
				0.01,
				`${layer.scale.toFixed(2)}×`,
				(n) => up({ scale: n })
			)}
			{@render range(
				'rotation',
				layer.rotation,
				-180,
				180,
				1,
				`${Math.round(layer.rotation)}°`,
				(n) => up({ rotation: n })
			)}
			{@render range('position x', layer.x, -1, 1, 0.01, layer.x.toFixed(2), (n) => up({ x: n }))}
			{@render range('position y', layer.y, -1, 1, 0.01, layer.y.toFixed(2), (n) => up({ y: n }))}

			<div class="toggles">
				<button type="button" class="tog" class:on={layer.flipX} onclick={() => up({ flipX: !layer.flipX })}>flip ⇆</button>
				<button type="button" class="tog" class:on={layer.flipY} onclick={() => up({ flipY: !layer.flipY })}>flip ⇅</button>
				<button
					type="button"
					class="tog"
					class:on={!layer.smooth}
					title="render without smoothing — for pixel art"
					onclick={() => up({ smooth: !layer.smooth })}>pixel</button
				>
			</div>
		{:else}
			<div class="fill-editor">
				<div class="seg">
					{#each ['solid', 'linear', 'radial'] as const as t (t)}
						<button
							type="button"
							class="seg-btn"
							class:on={layer.fill.type === t}
							onclick={() => changeFillType(t)}>{t}</button
						>
					{/each}
				</div>

				{#if layer.fill.type === 'solid'}
					<label class="swatch-row">
						<span class="row-label">colour</span>
						<input
							type="color"
							value={layer.fill.color}
							oninput={(e) => setFill({ color: e.currentTarget.value })}
						/>
					</label>
				{:else}
					<label class="swatch-row">
						<span class="row-label">from</span>
						<input
							type="color"
							value={layer.fill.from}
							oninput={(e) => setFill({ from: e.currentTarget.value })}
						/>
					</label>
					<label class="swatch-row">
						<span class="row-label">to</span>
						<input
							type="color"
							value={layer.fill.to}
							oninput={(e) => setFill({ to: e.currentTarget.value })}
						/>
					</label>
					{#if layer.fill.type === 'linear'}
						{@render range('angle', layer.fill.angle, 0, 360, 1, `${Math.round(layer.fill.angle)}°`, (n) =>
							setFillLive({ angle: n })
						)}
					{/if}
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--b-space-sm);
	}
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

	input[type='range'] {
		width: 100%;
		accent-color: var(--b-gold);
		height: 1.1rem;
	}

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

	.swatch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--b-space-sm);
	}
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
