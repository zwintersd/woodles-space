<script lang="ts">
	import { onMount } from 'svelte';
	import { MAX_SWATCHES, PALETTE, RESET_APPEARANCE, TYPE_KEYS, patchAppearance, type AppearancePatch, type ItemAppearance } from './appearance';
	import type { WhiteboardItem } from './model';
	let { items, swatches, clipboard, preview, apply, cancel, copy, saveSwatch, removeSwatch, position }: {
		items: WhiteboardItem[]; swatches: string[]; clipboard: ItemAppearance | null;
		preview: (patch: AppearancePatch) => void; apply: (patch: AppearancePatch) => void; cancel: () => void;
		copy: (appearance: ItemAppearance) => void; saveSwatch: (color: string) => void; removeSwatch: (color: string) => void;
		position: { left: number; top: number };
	} = $props();
	let patch = $state<AppearancePatch>({});
	let target = $state<'fill' | 'ink' | 'outline' | 'highlight'>('fill');
	let closeButton: HTMLButtonElement;
	let copied = $state(false);
	const lettering = $derived(items.some((item) => item.type !== 'image'));
	const typography = $derived(items.some((item) => ['lettering', 'slip', 'card'].includes(item.type)));
	const materials = $derived(items.some((item) => item.type === 'slip' || item.type === 'card'));
	const onlyLettering = $derived(items.every((item) => item.type === 'lettering'));
	const appearances = $derived(items.map((item) => patchAppearance(item, patch) ?? {}));
	const changed = $derived(items.some((item, index) => JSON.stringify(item.appearance ?? {}) !== JSON.stringify(appearances[index])));
	function eligible(item: WhiteboardItem, key: keyof ItemAppearance) {
		if ((TYPE_KEYS as readonly string[]).includes(key)) return ['lettering', 'slip', 'card'].includes(item.type);
		if (key === 'material') return item.type === 'slip' || item.type === 'card';
		return key !== 'ink' || item.type !== 'image';
	}
	function common<K extends keyof ItemAppearance>(key: K): ItemAppearance[K] | undefined {
		const matching = items.map((item, index) => ({ item, a: appearances[index] })).filter(({ item }) => eligible(item, key));
		const first = matching[0]?.a[key];
		return matching.every(({ a }) => a[key] === first) ? first : undefined;
	}
	function stateLabel(key: keyof ItemAppearance): string {
		const matching = items.map((item, index) => ({ item, a: appearances[index] })).filter(({ item }) => eligible(item, key));
		return new Set(matching.map(({ a }) => a[key])).size > 1 ? 'Mixed' : common(key) === undefined ? 'Original' : '';
	}
	function change(next: AppearancePatch) { patch = { ...patch, ...next }; preview(patch); }
	function replace(next: ItemAppearance) { patch = { ...RESET_APPEARANCE, ...next }; preview(patch); }
	function pick(color: string) { change({ [target]: color }); }
	const color = $derived(common(target) ?? (target === 'fill' ? '#fffdf8' : '#604c46'));
	onMount(() => closeButton.focus({ preventScroll: true }));
</script>

<div class="appearance-tray" role="dialog" aria-modal="false" tabindex="-1" aria-label="Selection appearance" data-whiteboard-ui style={`left:${position.left}px;top:${position.top}px;--tray-top:${position.top}px;`}>
	<header><div><h2>Appearance</h2><p>{items.length === 1 ? 'A little personal touch' : `${items.length} objects · change them together`}</p></div><button bind:this={closeButton} class="close" aria-label="Close appearance" onclick={cancel}>×</button></header>
	<div class="tray-body">
		<div class="colour-fields">
			{#each (lettering ? ['fill', 'ink', 'outline'] : ['fill', 'outline']) as name}
				{@const key = name as 'fill' | 'ink' | 'outline'}
				<label class:target={target === key}>
					<span>{key === 'ink' ? 'Text' : key === 'fill' && items.every((i) => i.type === 'image') ? 'Mat' : key === 'outline' ? 'Outline' : 'Fill'}</span>
					<input aria-label={`${key === 'ink' ? 'Text' : key === 'outline' ? 'Outline' : 'Fill'} colour`} type="color" value={common(key) ?? (key === 'fill' ? '#fffdf8' : '#604c46')} onfocus={() => target = key} oninput={(event) => { target = key; change({ [key]: event.currentTarget.value }); }} />
					<small>{stateLabel(key)}</small>
				</label>
			{/each}
		</div>
		<div class="palette-heading"><label>Palette for <select aria-label="Palette target" bind:value={target}><option value="fill">fill / mat</option>{#if lettering}<option value="ink">text</option>{/if}<option value="outline">outline</option>{#if typography}<option value="highlight">highlight</option>{/if}</select></label></div>
		<div class="swatches">{#each PALETTE as swatch}<button class="swatch" style={`--swatch:${swatch}`} aria-label={`Use ${swatch} for ${target}`} title={swatch} onclick={() => pick(swatch)}></button>{/each}</div>
		<div class="palette-heading"><span>Your colours</span><button class="text-button" disabled={swatches.length >= MAX_SWATCHES || swatches.includes(color)} onclick={() => saveSwatch(color)}>+ Save colour</button></div>
		{#if swatches.length}<div class="swatches saved">{#each swatches as swatch}<button class="swatch" style={`--swatch:${swatch}`} aria-label={`Use saved ${swatch} for ${target}`} title={swatch} onclick={() => pick(swatch)}></button>{/each}</div>{:else}<p class="hint">Keep a few favourites on this board.</p>{/if}
		{#if typography}
			<details open={onlyLettering}><summary>Lettering</summary>
				<div class="detail-grid">
					<label>Font <select aria-label="Lettering font" value={common('font') ?? ''} onchange={(e) => change({ font: (e.currentTarget.value || null) as ItemAppearance['font'] | null })}><option value="">Original</option><option value="book">Book</option><option value="plain">Plain</option><option value="hand">Handwritten</option><option value="typewriter">Typewriter</option></select></label>
					<label>Size <input aria-label="Lettering size" type="number" min="12" max="120" placeholder={stateLabel('fontSize') || 'Size'} value={common('fontSize') ?? ''} oninput={(e) => { const size = Number(e.currentTarget.value); if (size >= 12 && size <= 120) change({ fontSize: size }); }} /></label>
					<label>Alignment <select aria-label="Text alignment" value={common('align') ?? ''} onchange={(e) => change({ align: (e.currentTarget.value || null) as ItemAppearance['align'] | null })}><option value="">Original</option><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
					<label>Line spacing <select aria-label="Line spacing" value={common('lineHeight') ?? ''} onchange={(e) => change({ lineHeight: e.currentTarget.value ? Number(e.currentTarget.value) : null })}><option value="">Original</option><option value="1">Close</option><option value="1.3">Easy</option><option value="1.6">Airy</option><option value="2">Double</option></select></label>
				</div>
				<div class="appearance-actions"><button aria-pressed={common('bold') === true} onclick={() => change({ bold: !common('bold') })}><b>Bold</b></button><button aria-pressed={common('italic') === true} onclick={() => change({ italic: !common('italic') })}><em>Italic</em></button><button onclick={() => change({ highlight: null })}>No highlight</button></div>
				{#if onlyLettering}<label class="backing">Backing <select aria-label="Lettering backing" value={common('backing') ?? 'none'} onchange={(e) => change({ backing: e.currentTarget.value as ItemAppearance['backing'] })}><option value="none">Just text</option><option value="label">Label</option><option value="banner">Banner</option><option value="strip">Paper strip</option></select></label>{/if}
			</details>
		{/if}
		{#if materials}<label class="backing">Paper <select aria-label="Paper material" value={common('material') ?? ''} onchange={(e) => change({ material: (e.currentTarget.value || null) as ItemAppearance['material'] | null })}><option value="">{stateLabel('material') || 'Original'}</option><option value="paper">Clean paper</option><option value="index">Index card</option><option value="sticky">Sticky note</option><option value="torn">Torn edge</option><option value="vellum">Vellum</option></select></label>{/if}
		<details><summary>More details</summary>
			<div class="detail-grid">
				<label>Outline weight <select aria-label="Outline weight" value={common('outlineWidth') ?? ''} onchange={(event) => change({ outlineWidth: event.currentTarget.value === '' ? null : Number(event.currentTarget.value) })}><option value="">{stateLabel('outlineWidth') || 'Original'}</option>{#each [0, 1, 2, 4, 8] as width}<option value={width}>{width === 0 ? 'None' : `${width} px`}</option>{/each}</select></label>
				<label>Outline style <select aria-label="Outline style" value={common('outlineStyle') ?? ''} onchange={(event) => change({ outlineStyle: (event.currentTarget.value || null) as ItemAppearance['outlineStyle'] | null })}><option value="">{stateLabel('outlineStyle') || 'Original'}</option><option>solid</option><option>dashed</option><option>dotted</option></select></label>
				<label>Corners <select aria-label="Corner treatment" value={common('corners') ?? ''} onchange={(event) => change({ corners: (event.currentTarget.value || null) as ItemAppearance['corners'] | null })}><option value="">{stateLabel('corners') || 'Original'}</option><option value="square">Square</option><option value="soft">Soft</option><option value="round">Round</option></select></label>
				<label>Shadow <select aria-label="Shadow" value={common('shadow') ?? ''} onchange={(event) => change({ shadow: (event.currentTarget.value || null) as ItemAppearance['shadow'] | null })}><option value="">{stateLabel('shadow') || 'Original'}</option><option value="none">None</option><option value="soft">Soft</option><option value="lifted">Lifted</option></select></label>
			</div>
			<label class="opacity">Opacity <output>{stateLabel('opacity') || `${Math.round((common('opacity') ?? 1) * 100)}%`}</output><input aria-label="Object opacity" type="range" min="20" max="100" step="5" value={(common('opacity') ?? 1) * 100} oninput={(event) => change({ opacity: Number(event.currentTarget.value) / 100 })} /></label>
			{#if swatches.length}<div class="remove-colours"><span>Remove a saved colour</span>{#each swatches as swatch}<button aria-label={`Remove saved ${swatch}`} title={`Remove ${swatch}`} onclick={() => removeSwatch(swatch)}><i style={`background:${swatch}`}></i>×</button>{/each}</div>{/if}
		</details>
		<div class="appearance-actions"><button disabled={items.length !== 1} onclick={() => { copy({ ...appearances[0] }); copied = true; }}>{copied ? 'Copied' : 'Copy look'}</button><button disabled={clipboard === null} onclick={() => { if (clipboard) replace(clipboard); }}>Paste look</button><button onclick={() => replace({})}>Original</button></div>
	</div>
	<footer><span>Preview on board</span><button onclick={cancel}>Cancel</button><button class="apply" disabled={!changed} onclick={() => apply(patch)}>Apply</button></footer>
</div>

<style>
	.appearance-tray { position: absolute; z-index: 100; width: min(300px, calc(100vw - 24px)); max-height: calc(100dvh - var(--tray-top) - 96px); display: flex; flex-direction: column; border: 1px solid #d9ccc0; border-radius: 18px; color: #584b44; background: #fffdf7; box-shadow: 0 14px 45px #49362e26, 0 2px 5px #49362e0f; font: 12px var(--font-body, system-ui, sans-serif); touch-action: auto; user-select: text; }
	header, footer { display: flex; gap: 8px; align-items: center; padding: 12px 14px; flex-shrink: 0; } header { border-bottom: 1px solid #ede4d8; } header div { flex: 1; } h2 { margin: 0; font: 21px var(--font-display, Georgia, serif); } p { margin: 3px 0 0; color: #837269; font-size: 11px; }
	button, select { border: 1px solid #dfd2c5; background: #faf5eb; border-radius: 7px; color: #584b44; padding: 6px 8px; font: inherit; cursor: pointer; min-height: 30px; } button:hover:not(:disabled) { background: #eadbd7; } button:disabled { opacity: .45; cursor: default; } button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid #a66670; outline-offset: 3px; } .close { font-size: 20px; border: 0; background: transparent; width: 30px; padding: 0; }
	.tray-body { padding: 12px 14px; overflow-y: auto; overscroll-behavior: contain; min-height: 0; } .colour-fields { display: flex; gap: 8px; } .colour-fields label { flex: 1; display: grid; gap: 4px; padding: 6px; border-radius: 9px; border: 1px solid #e8dfd3; } .colour-fields label.target { border-color: #ba8790; background: #f8efea; } small { min-height: 12px; color: #89766b; font-size: 10px; } input[type=color] { width: 100%; height: 27px; border: 0; padding: 0; background: transparent; cursor: pointer; }
	.palette-heading { display: flex; justify-content: space-between; align-items: center; gap: 5px; margin: 12px 0 6px; color: #806e65; } .palette-heading select { min-height: 26px; padding: 3px 5px; background: transparent; border: 0; color: #584b44; } .text-button { min-height: 26px; border: 0; padding: 3px 0; background: transparent; color: #85515d; font-size: 11px; }
	.swatches { display: flex; flex-wrap: wrap; gap: 5px; } button.swatch { width: 28px; height: 28px; min-height: 28px; padding: 0; background: var(--swatch); border: 1px solid #59443838; border-radius: 50%; box-shadow: inset 0 0 0 3px #ffffff66; } button.swatch:hover { background: var(--swatch); outline: 1px solid #a66670; outline-offset: 2px; } .hint { font-size: 11px; }
	details { margin: 14px 0 0; border-top: 1px solid #ede4d8; padding-top: 10px; } summary { cursor: pointer; color: #806e65; min-height: 26px; } .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0 12px; } .detail-grid label { display: grid; gap: 5px; } select { min-width: 0; width: 100%; } .palette-heading select { width: auto; } .opacity { display: block; } output { float: right; color: #806e65; } input[type=range] { width: 100%; margin: 10px 0; accent-color: #a66670; } .appearance-actions { display: flex; gap: 6px; margin-top: 14px; } .appearance-actions button { flex: 1; font-size: 11px; padding: 5px; }
	.remove-colours { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin-top: 8px; } .remove-colours span { width: 100%; font-size: 11px; color: #806e65; } .remove-colours button { padding: 2px 5px; display: flex; align-items: center; gap: 3px; } i { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #59443838; }
	input[type=number] { width: 100%; box-sizing: border-box; min-height: 30px; border: 1px solid #dfd2c5; background: #fffdf7; border-radius: 7px; color: #584b44; font: inherit; padding: 6px 8px; } .backing { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; margin-top: 12px; } button[aria-pressed=true] { background: #eadbd7; border-color: #ba8790; }
	footer { border-top: 1px solid #ede4d8; } footer span { flex: 1; font-size: 10px; color: #806e65; } .apply { background: #a66670; border-color: #a66670; color: white; }
	@media (max-width: 600px) { .appearance-tray { left: 12px !important; top: auto !important; bottom: 100px; max-height: calc(100dvh - var(--tray-top) - 100px); } }
</style>
