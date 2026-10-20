<script lang="ts">
	import {
		defaultCardStyle,
		cardPresets,
		FRAME_STYLES,
		FINISHES,
		TEXT_BOXES,
		CARD_FONTS,
		TEXTURES,
		BORDER_MAX,
		RADIUS_MAX,
		type CardStyle
	} from '@woodles/mycelium';

	let { style, onchange }: { style: CardStyle; onchange: (next: CardStyle) => void } = $props();

	function set(changes: Partial<CardStyle>) {
		onchange({ ...style, ...changes });
	}

	const pct = (n: number) => `${Math.round(n * 100)}%`;
</script>

{#snippet seg(value: string, options: { id: string; name: string }[], pick: (id: string) => void)}
	<div class="seg">
		{#each options as o (o.id)}
			<button type="button" class="seg-btn" class:on={value === o.id} aria-pressed={value === o.id} onclick={() => pick(o.id)}>{o.name}</button>
		{/each}
	</div>
{/snippet}

{#snippet range(label: string, value: number, min: number, max: number, step: number, read: string, setN: (n: number) => void)}
	<label class="row">
		<span class="row-label">{label}<span class="read">{read}</span></span>
		<input type="range" {min} {max} {step} {value} oninput={(e) => setN(e.currentTarget.valueAsNumber)} />
	</label>
{/snippet}

{#snippet color(label: string, value: string, setC: (c: string) => void)}
	<label class="swatch-row">
		<span class="row-label">{label}</span>
		<input type="color" {value} oninput={(e) => setC(e.currentTarget.value)} />
	</label>
{/snippet}

<div class="appearance">
	<!-- presets -->
	<details class="grp" open>
		<summary class="grp-h">presets</summary>
		<div class="grp-body">
		<div class="preset-grid">
			{#each cardPresets as p (p.id)}
				<button type="button" class="preset" title={p.note} onclick={() => onchange({ ...p.style })}>
					{p.name}
				</button>
			{/each}
		</div>
	</div>
	</details>

	<!-- frame -->
	<details class="grp" open>
		<summary class="grp-h">frame</summary>
		<div class="grp-body">
		{@render seg(style.frame, FRAME_STYLES, (id) => set({ frame: id as CardStyle['frame'] }))}
	</div>
	</details>

	<!-- colour -->
	<details class="grp">
		<summary class="grp-h">colour</summary>
		<div class="grp-body">
		<span class="mini">accent</span>
		{@render seg(style.accentMode, [{ id: 'domain', name: 'house pink' }, { id: 'custom', name: 'custom' }], (id) => set({ accentMode: id as CardStyle['accentMode'] }))}
		{#if style.accentMode === 'custom'}
			{@render color('accent', style.accent, (c) => set({ accent: c }))}
		{/if}

		<span class="mini">plate</span>
		{@render seg(style.bgMode, [{ id: 'domain', name: 'accent tint' }, { id: 'custom', name: 'custom' }], (id) => set({ bgMode: id as CardStyle['bgMode'] }))}
		{#if style.bgMode === 'domain'}
			{@render range('tint', style.tint, 0, 0.6, 0.01, pct(style.tint), (n) => set({ tint: n }))}
		{:else}
			{@render color('top', style.bg1, (c) => set({ bg1: c }))}
			{@render color('bottom', style.bg2, (c) => set({ bg2: c }))}
		{/if}
	</div>
	</details>

	<!-- finish -->
	<details class="grp">
		<summary class="grp-h">finish</summary>
		<div class="grp-body">
		{@render seg(style.finish, FINISHES, (id) => set({ finish: id as CardStyle['finish'] }))}
		{#if style.finish !== 'matte'}
			{@render range('intensity', style.finishIntensity, 0, 1, 0.01, pct(style.finishIntensity), (n) => set({ finishIntensity: n }))}
		{/if}
	</div>
	</details>

	<!-- edge -->
	<details class="grp">
		<summary class="grp-h">edge</summary>
		<div class="grp-body">
		{@render seg(style.borderMode, [{ id: 'auto', name: 'auto' }, { id: 'custom', name: 'custom' }], (id) => set({ borderMode: id as CardStyle['borderMode'] }))}
		{#if style.borderMode === 'custom'}
			{@render color('border', style.borderColor, (c) => set({ borderColor: c }))}
		{/if}
		{@render range('thickness', style.borderWidth, 0, BORDER_MAX, 0.5, `${style.borderWidth}px`, (n) => set({ borderWidth: n }))}
		{@render range('corner', style.radius, 0, RADIUS_MAX, 1, `${style.radius}px`, (n) => set({ radius: n }))}
	</div>
	</details>

	<!-- title -->
	<details class="grp">
		<summary class="grp-h">title</summary>
		<div class="grp-body">
		<label class="row">
			<span class="row-label">font</span>
			<select class="select" value={style.titleFont} onchange={(e) => set({ titleFont: e.currentTarget.value as CardStyle['titleFont'] })}>
				{#each CARD_FONTS as f (f.id)}
					<option value={f.id}>{f.name}</option>
				{/each}
			</select>
		</label>
		{@render seg(style.titleAlign, [{ id: 'left', name: 'left' }, { id: 'center', name: 'centre' }], (id) => set({ titleAlign: id as CardStyle['titleAlign'] }))}
		<span class="mini">colour</span>
		{@render seg(style.titleColorMode, [{ id: 'auto', name: 'auto' }, { id: 'domain', name: 'accent' }, { id: 'custom', name: 'custom' }], (id) => set({ titleColorMode: id as CardStyle['titleColorMode'] }))}
		{#if style.titleColorMode === 'custom'}
			{@render color('title', style.titleColor, (c) => set({ titleColor: c }))}
		{/if}
	</div>
	</details>

	<!-- text box -->
	<details class="grp">
		<summary class="grp-h">text box</summary>
		<div class="grp-body">
		{@render seg(style.textBox, TEXT_BOXES, (id) => set({ textBox: id as CardStyle['textBox'] }))}
	</div>
	</details>

	<!-- texture -->
	<details class="grp">
		<summary class="grp-h">texture</summary>
		<div class="grp-body">
		{@render seg(style.texture, TEXTURES, (id) => set({ texture: id as CardStyle['texture'] }))}
		{#if style.texture !== 'none'}
			{@render range('strength', style.textureOpacity, 0, 1, 0.01, pct(style.textureOpacity), (n) => set({ textureOpacity: n }))}
		{/if}
	</div>
	</details>

	<!-- elements -->
	<details class="grp">
		<summary class="grp-h">show</summary>
		<div class="grp-body">
		<div class="toggles">
			<button type="button" class="tog" class:on={style.showStats} aria-pressed={style.showStats} onclick={() => set({ showStats: !style.showStats })}>tags</button>
			<button type="button" class="tog" class:on={style.showTypeLine} aria-pressed={style.showTypeLine} onclick={() => set({ showTypeLine: !style.showTypeLine })}>role &amp; organization</button>
			<button type="button" class="tog" class:on={style.showFoundIn} aria-pressed={style.showFoundIn} onclick={() => set({ showFoundIn: !style.showFoundIn })}>location</button>
		</div>
	</div>
	</details>

	<button type="button" class="reset" onclick={() => onchange(defaultCardStyle())}>
		reset to the house frame
	</button>
</div>

<style>
	.appearance { display: flex; flex-direction: column; gap: var(--b-space-lg); min-width: 0; }

	.grp { border-bottom: 1px solid var(--b-border); padding-bottom: var(--b-space-md); }
	.grp-body { display: flex; flex-direction: column; gap: var(--b-space-sm); padding-top: var(--b-space-sm); }
	summary { cursor: pointer; padding: 0.6rem 0; }
	summary:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--b-on-accent); outline-offset: 3px; }
	.grp-h {
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--b-text);
	}
	.mini {
		font-family: var(--b-font-mono);
		font-size: 0.66rem;
		color: var(--b-text);
		margin-top: 0.1rem;
	}

	.preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--b-space-xs); }
	.preset {
		min-height: 2.75rem;
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		background: var(--b-surface-2);
		font-family: var(--b-font-codex);
		font-size: 0.92rem;
		color: var(--b-text);
		transition: all var(--b-transition-fast);
	}
	.preset:hover { border-color: var(--b-gold); transform: translateY(-1px); }

	.row { display: flex; flex-direction: column; gap: 0.2rem; }
	.row-label {
		display: flex;
		justify-content: space-between;
		font-family: var(--b-font-mono);
		font-size: 0.7rem;
		color: var(--b-text);
	}
	.read { color: var(--b-text); }
	input[type='range'] { width: 100%; min-width: 0; min-height: 2rem; accent-color: var(--b-gold); }

	.seg { display: flex; gap: 0; border: 1px solid var(--b-border); border-radius: var(--b-radius-sm); overflow: hidden; flex-wrap: wrap; }
	.seg-btn {
		flex: 1;
		min-width: 3.4rem;
		min-height: 2.75rem;
		padding: 0.32rem 0.3rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text);
		background: var(--b-surface-2);
		transition: all var(--b-transition-fast);
	}
	.seg-btn:not(:last-child) { border-right: 1px solid var(--b-border); }
	.seg-btn.on { background: var(--b-gold); color: var(--b-on-accent); }

	.select {
		width: 100%;
		max-width: 100%;
		min-height: 2.75rem;
		background: var(--b-surface-2);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.34rem 0.4rem;
		color: var(--b-text);
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
	}

	.swatch-row { display: flex; align-items: center; justify-content: space-between; gap: var(--b-space-sm); }
	.swatch-row input[type='color'] {
		width: 3.4rem;
		height: 1.8rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		background: none;
		padding: 0;
		cursor: pointer;
	}

	.toggles { display: flex; gap: var(--b-space-xs); flex-wrap: wrap; }
	.tog {
		flex: 1;
		min-width: 5rem;
		min-height: 2.75rem;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.34rem 0.4rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text);
		transition: all var(--b-transition-fast);
	}
	.tog:hover { border-color: var(--b-gold); background: var(--b-gold-soft); }
	.tog.on { background: var(--b-gold); color: var(--b-on-accent); border-color: var(--b-gold); }

	.reset {
		align-self: flex-start;
		min-height: 2.75rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text);
		transition: color var(--b-transition-fast);
	}
	.reset:hover { text-decoration: underline; }
	@media (prefers-reduced-motion: reduce) {
		.preset, .seg-btn, .tog, .reset { transition: none; }
		.preset:hover { transform: none; }
	}
</style>
