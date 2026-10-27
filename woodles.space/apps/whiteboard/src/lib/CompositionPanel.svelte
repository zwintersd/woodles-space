<script lang="ts">
	import { onMount } from 'svelte';
	import type { WhiteboardItem } from './model';
	let { items, locked, units, rotatable, snap, position, command, rotate, snapping, caption, close }: {
		items: WhiteboardItem[]; locked: boolean; units: number; rotatable: boolean; snap: boolean;
		position: { left: number; top: number }; command: (name: string) => void; rotate: (degrees: number) => void;
		snapping: (enabled: boolean) => void; caption: (text: string) => void; close: () => void;
	} = $props();
	let closeButton: HTMLButtonElement;
	const grouped = $derived(items.some((item) => item.groupId));
	const photo = $derived(items.length === 1 && items[0].type === 'image' ? items[0] : null);
	const angle = $derived(items.every((item) => item.rotation === items[0]?.rotation) ? items[0]?.rotation ?? 0 : undefined);
	onMount(() => closeButton.focus({ preventScroll: true }));
</script>

<div class="composition-panel" role="dialog" tabindex="-1" aria-label="Arrange selection" data-whiteboard-ui style={`left:${position.left}px;top:${position.top}px;--panel-top:${position.top}px;`}>
	<header><h2>Arrange</h2><button bind:this={closeButton} class="close" aria-label="Close arrange" onclick={close}>×</button></header>
	<div class="body">
		<p>{items.length} {items.length === 1 ? 'object' : 'objects'}{locked ? ' · locked' : grouped ? ' · grouped' : ''}</p>
		<fieldset disabled={locked}><legend>Layers</legend><div class="grid">
			<button onclick={() => command('front')}>To front</button><button onclick={() => command('forward')}>Forward</button>
			<button onclick={() => command('back')}>To back</button><button onclick={() => command('backward')}>Backward</button>
		</div></fieldset>
		<div class="row"><button disabled={locked || items.filter((item) => item.type !== 'connector' && !(item.type === 'card' && item.stackId)).length < 2} onclick={() => command('group')}>Group</button><button disabled={locked || !grouped} onclick={() => command('ungroup')}>Ungroup</button><button onclick={() => command(locked ? 'unlock' : 'lock')}>{locked ? 'Unlock' : 'Lock'}</button></div>
		<details><summary>Align & space</summary><fieldset disabled={locked || units < 2}><legend class="sr-only">Align objects or groups</legend><div class="grid three">
			{#each ['left', 'center', 'right', 'top', 'middle', 'bottom'] as alignment}<button aria-label={`Align ${alignment}`} onclick={() => command(`align-${alignment}`)}>{alignment}</button>{/each}
		</div></fieldset><div class="row"><button disabled={locked || units < 3} onclick={() => command('align-horizontal')}>Space across</button><button disabled={locked || units < 3} onclick={() => command('align-vertical')}>Space down</button></div><p class="note">A group stays together as one piece.</p></details>
		{#if rotatable}<label class="rotation">Rotation <input aria-label="Object rotation" type="number" min="-180" max="180" step="1" disabled={locked} placeholder="Mixed" value={angle ?? ''} onchange={(event) => { const value = Number(event.currentTarget.value); if (Number.isFinite(value) && value >= -180 && value <= 180) rotate(value); }} /><span>°</span></label><p class="note">{items.length === 1 ? 'Drag the round handle. Shift holds 15° steps.' : 'Sets each object’s angle, keeping its position.'}</p>{/if}
		{#if photo}<label class="caption">Photo caption <input aria-label="Photo caption" type="text" disabled={locked} placeholder="A few words beneath the photo…" value={photo.caption ?? ''} oninput={(event) => caption(event.currentTarget.value)} /></label>{/if}
		<label class="snap"><input type="checkbox" aria-label="Snap to alignment guides" checked={snap} onchange={(event) => snapping(event.currentTarget.checked)} /> Snap to alignment guides</label>
	</div>
</div>

<style>
	.composition-panel { position: absolute; z-index: 100; width: min(280px, calc(100vw - 24px)); max-height: calc(100dvh - var(--panel-top) - 96px); display: flex; flex-direction: column; border: 1px solid #d9ccc0; border-radius: 18px; background: #fffdf7; color: #584b44; font: 12px var(--font-body, system-ui, sans-serif); box-shadow: 0 14px 45px #49362e26; touch-action: auto; }
	header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #ede4d8; } h2 { margin: 0; font: 21px Georgia, serif; } .body { padding: 0 14px 14px; overflow-y: auto; overscroll-behavior: contain; } p { color: #806e65; } button, input { box-sizing: border-box; min-height: 32px; border: 1px solid #dfd2c5; border-radius: 7px; background: #faf5eb; color: #584b44; padding: 6px 8px; font: inherit; } button { cursor: pointer; } button:hover:not(:disabled) { background: #eadbd7; } button:disabled, fieldset:disabled { opacity: .45; cursor: default; } button:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid #a66670; outline-offset: 2px; } .close { border: 0; background: transparent; font-size: 20px; width: 30px; padding: 0; }
	fieldset { border: 0; padding: 0; margin: 12px 0; min-width: 0; } legend { color: #806e65; margin-bottom: 6px; } .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; } .three { grid-template-columns: repeat(3, 1fr); } .row { display: flex; gap: 6px; margin: 12px 0; } .row button { flex: 1; font-size: 11px; padding-inline: 4px; } details { border-block: 1px solid #ede4d8; padding: 10px 0; margin: 12px 0; } summary { cursor: pointer; min-height: 26px; color: #806e65; } .note { font-size: 10px; line-height: 1.5; margin: 6px 0; } .rotation { display: flex; align-items: center; gap: 8px; margin-top: 14px; } input[type=number] { width: 82px; margin-left: auto; background: white; } .snap { display: flex; align-items: center; gap: 6px; margin-top: 16px; } input[type=checkbox] { accent-color: #a66670; min-height: 18px; } .caption { display: grid; gap: 6px; margin-top: 14px; } .caption input { width: 100%; background: white; } .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
	@media(max-width: 600px) { .composition-panel { left: 12px !important; top: auto !important; bottom: 100px; max-height: calc(100dvh - 190px); } }
</style>
