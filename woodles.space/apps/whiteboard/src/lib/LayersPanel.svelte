<script lang="ts">
	import { onMount } from 'svelte';
	import { isLocked } from './composition';
	import { itemLabel } from './navigation';
	import type { WhiteboardItem } from './model';
	let { items, selected, choose, toggleLock, close }: { items: WhiteboardItem[]; selected: string[]; choose: (id: string) => void; toggleLock: (id: string) => void; close: () => void } = $props();
	let closeButton: HTMLButtonElement;
	onMount(() => closeButton.focus({ preventScroll: true }));
</script>

<aside class="layers-panel" aria-label="Board layers" data-whiteboard-ui>
	<header><div><h2>Layers</h2><p>Front to back · {items.length} objects</p></div><button bind:this={closeButton} aria-label="Close layers" onclick={close}>×</button></header>
	<ul>{#each items.slice().reverse() as item (item.id)}<li class:chosen={selected.includes(item.id)}>
		<button class="choose" aria-pressed={selected.includes(item.id)} aria-label={`Find ${itemLabel(item)}`} onclick={() => choose(item.id)}><span aria-hidden="true">{item.type === 'lettering' ? 'T' : item.type === 'image' ? '▧' : item.type === 'frame' ? '▢' : item.type === 'stack' ? '▤' : '▱'}</span><span class="name">{itemLabel(item)}<small>{item.type}{item.groupId ? ' · grouped' : ''}</small></span></button>
		<button class="lock" aria-label={`${isLocked(items, item) ? 'Unlock' : 'Lock'} ${itemLabel(item)}`} title={isLocked(items, item) ? 'Unlock' : 'Lock'} onclick={() => toggleLock(item.id)}><svg aria-hidden="true" width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="8" width="10" height="8" rx="2" fill="currentColor" fill-opacity={isLocked(items, item) ? 0.18 : 0} /><path d={isLocked(items, item) ? 'M5 8V5a3 3 0 0 1 6 0v3' : 'M5 8V5a3 3 0 0 1 5.8-1'} /><path d="M8 11v2" /></svg></button>
	</li>{/each}</ul>
	{#if !items.length}<p class="empty">Your objects will be listed here.</p>{/if}
</aside>

<style>
	.layers-panel { position: absolute; z-index: 95; top: max(110px, calc(var(--chrome-bottom, 0px) + 10px)); right: 20px; width: min(264px, calc(100vw - 24px)); max-height: calc(100dvh - max(110px, calc(var(--chrome-bottom, 0px) + 10px)) - 100px); display: flex; flex-direction: column; border: 1px solid #d9ccc0; border-radius: 17px; background: #fffdf7; color: #584b44; box-shadow: 0 10px 35px #49362e20; font: 12px var(--font-body, system-ui, sans-serif); touch-action: auto; }
	header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #ede4d8; } h2 { margin: 0; font: 21px Georgia, serif; } p { margin: 4px 0 0; font-size: 10px; color: #806e65; } button { color: inherit; font: inherit; background: transparent; border: 0; border-radius: 7px; cursor: pointer; min-height: 32px; } button:focus-visible { outline: 2px solid #a66670; outline-offset: 1px; } header button { font-size: 20px; width: 30px; } ul { list-style: none; padding: 6px; margin: 0; overflow-y: auto; overscroll-behavior: contain; } li { display: flex; align-items: center; border-radius: 10px; } li:hover { background: #f6eee5; } li.chosen { background: #f0e1de; } .choose { display: flex; align-items: center; gap: 10px; padding: 8px; min-width: 0; flex: 1; text-align: left; } .choose > span:first-child { width: 20px; color: #9b6872; font: 17px Georgia, serif; text-align: center; } .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } small { display: block; color: #927f73; font-size: 10px; margin-top: 3px; } .lock { flex: none; width: 32px; color: #9b6872; } .lock:hover { background: #e7d5d0; } .empty { padding: 16px; }
	@media(max-width: 600px) { .layers-panel { right: 12px; } }
</style>
