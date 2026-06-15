<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import type { Creature } from '$lib/types';
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
	} from '$lib/cardstyle';

	let { creature }: { creature: Creature } = $props();

	let style = $derived(creature.cardStyle ?? defaultCardStyle());

	function set(changes: Partial<CardStyle>) {
		bestiary.updateCardStyle(creature.id, changes);
	}

	const pct = (n: number) => `${Math.round(n * 100)}%`;
</script>

{#snippet seg(value: string, options: { id: string; name: string }[], pick: (id: string) => void)}
	<div class="seg">
		{#each options as o (o.id)}
			<button type="button" class="seg-btn" class:on={value === o.id} onclick={() => pick(o.id)}>{o.name}</button>
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
	<section class="grp">
		<h4 class="grp-h">presets</h4>
		<div class="preset-grid">
			{#each cardPresets as p (p.id)}
				<button type="button" class="preset" title={p.note} onclick={() => bestiary.setCardStyle(creature.id, { ...p.style })}>
					{p.name}
				</button>
			{/each}
		</div>
	</section>

	<!-- frame -->
	<section class="grp">
		<h4 class="grp-h">frame</h4>
		{@render seg(style.frame, FRAME_STYLES, (id) => set({ frame: id as CardStyle['frame'] }))}
	</section>

	<!-- colour -->
	<section class="grp">
		<h4 class="grp-h">colour</h4>
		<span class="mini">accent</span>
		{@render seg(style.accentMode, [{ id: 'domain', name: 'domain' }, { id: 'custom', name: 'custom' }], (id) => set({ accentMode: id as CardStyle['accentMode'] }))}
		{#if style.accentMode === 'custom'}
			{@render color('accent', style.accent, (c) => set({ accent: c }))}
		{/if}

		<span class="mini">plate</span>
		{@render seg(style.bgMode, [{ id: 'domain', name: 'domain tint' }, { id: 'custom', name: 'custom' }], (id) => set({ bgMode: id as CardStyle['bgMode'] }))}
		{#if style.bgMode === 'domain'}
			{@render range('tint', style.tint, 0, 0.6, 0.01, pct(style.tint), (n) => set({ tint: n }))}
		{:else}
			{@render color('top', style.bg1, (c) => set({ bg1: c }))}
			{@render color('bottom', style.bg2, (c) => set({ bg2: c }))}
		{/if}
	</section>

	<!-- finish -->
	<section class="grp">
		<h4 class="grp-h">finish</h4>
		{@render seg(style.finish, FINISHES, (id) => set({ finish: id as CardStyle['finish'] }))}
		{#if style.finish !== 'matte'}
			{@render range('intensity', style.finishIntensity, 0, 1, 0.01, pct(style.finishIntensity), (n) => set({ finishIntensity: n }))}
		{/if}
	</section>

	<!-- edge -->
	<section class="grp">
		<h4 class="grp-h">edge</h4>
		{@render seg(style.borderMode, [{ id: 'auto', name: 'auto' }, { id: 'custom', name: 'custom' }], (id) => set({ borderMode: id as CardStyle['borderMode'] }))}
		{#if style.borderMode === 'custom'}
			{@render color('border', style.borderColor, (c) => set({ borderColor: c }))}
		{/if}
		{@render range('thickness', style.borderWidth, 0, BORDER_MAX, 0.5, `${style.borderWidth}px`, (n) => set({ borderWidth: n }))}
		{@render range('corner', style.radius, 0, RADIUS_MAX, 1, `${style.radius}px`, (n) => set({ radius: n }))}
	</section>

	<!-- title -->
	<section class="grp">
		<h4 class="grp-h">title</h4>
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
	</section>

	<!-- text box -->
	<section class="grp">
		<h4 class="grp-h">text box</h4>
		{@render seg(style.textBox, TEXT_BOXES, (id) => set({ textBox: id as CardStyle['textBox'] }))}
	</section>

	<!-- texture -->
	<section class="grp">
		<h4 class="grp-h">texture</h4>
		{@render seg(style.texture, TEXTURES, (id) => set({ texture: id as CardStyle['texture'] }))}
		{#if style.texture !== 'none'}
			{@render range('strength', style.textureOpacity, 0, 1, 0.01, pct(style.textureOpacity), (n) => set({ textureOpacity: n }))}
		{/if}
	</section>

	<!-- elements -->
	<section class="grp">
		<h4 class="grp-h">show</h4>
		<div class="toggles">
			<button type="button" class="tog" class:on={style.showStats} onclick={() => set({ showStats: !style.showStats })}>stat strip</button>
			<button type="button" class="tog" class:on={style.showTypeLine} onclick={() => set({ showTypeLine: !style.showTypeLine })}>type line</button>
			<button type="button" class="tog" class:on={style.showFoundIn} onclick={() => set({ showFoundIn: !style.showFoundIn })}>found in</button>
		</div>
	</section>

	<button type="button" class="reset" onclick={() => bestiary.resetCardStyle(creature.id)}>
		reset to the house frame
	</button>
</div>

<style>
	.appearance { display: flex; flex-direction: column; gap: var(--b-space-lg); }

	.grp { display: flex; flex-direction: column; gap: var(--b-space-sm); }
	.grp-h {
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--b-gold);
	}
	.mini {
		font-family: var(--b-font-mono);
		font-size: 0.66rem;
		color: var(--b-text-dim);
		margin-top: 0.1rem;
	}

	.preset-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--b-space-xs); }
	.preset {
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
		color: var(--b-text-dim);
	}
	.read { color: var(--b-muted); }
	input[type='range'] { width: 100%; accent-color: var(--b-gold); }

	.seg { display: flex; gap: 0; border: 1px solid var(--b-border); border-radius: var(--b-radius-sm); overflow: hidden; flex-wrap: wrap; }
	.seg-btn {
		flex: 1;
		min-width: 3.4rem;
		padding: 0.32rem 0.3rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text-dim);
		background: var(--b-surface-2);
		transition: all var(--b-transition-fast);
	}
	.seg-btn:not(:last-child) { border-right: 1px solid var(--b-border); }
	.seg-btn.on { background: var(--b-gold); color: var(--b-on-accent); }

	.select {
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
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.34rem 0.4rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text-dim);
		transition: all var(--b-transition-fast);
	}
	.tog:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.tog.on { background: var(--b-gold); color: var(--b-on-accent); border-color: var(--b-gold); }

	.reset {
		align-self: flex-start;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-muted);
		transition: color var(--b-transition-fast);
	}
	.reset:hover { color: var(--b-mythic); }
</style>
