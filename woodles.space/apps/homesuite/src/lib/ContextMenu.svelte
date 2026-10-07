<script lang="ts">
	import { onMount } from 'svelte';
	import type { HomeSuiteContextAction } from '@shared/homesuiteBridge';
	let { label, detail, items, x, y, onRun, onClose }: {
		label: string; detail: string; items: HomeSuiteContextAction[]; x: number; y: number;
		onRun: (id: string) => void; onClose: (restoreFocus: boolean) => void;
	} = $props();
	let menu: HTMLDivElement;
	let left = $state(8);
	let top = $state(8);
	function buttons() { return [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; }
	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape' || event.key === 'Tab') {
			if (event.key === 'Escape') event.preventDefault();
			event.stopPropagation(); onClose(true); return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault(); event.stopPropagation();
		const options = buttons();
		const index = options.indexOf(document.activeElement as HTMLButtonElement);
		const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
			(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
		options[next]?.focus();
	}
	onMount(() => {
		const fit = () => {
			const rect = menu.getBoundingClientRect();
			left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
			top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
		};
		fit(); buttons()[0]?.focus();
		const outside = (event: PointerEvent) => { if (!menu.contains(event.target as Node)) onClose(false); };
		const blur = () => { if (document.activeElement?.tagName === 'IFRAME') onClose(false); };
		const dismiss = () => onClose(false);
		const scroll = (event: Event) => { if (!menu.contains(event.target as Node)) dismiss(); };
		window.addEventListener('pointerdown', outside, true);
		window.addEventListener('blur', blur);
		window.addEventListener('resize', dismiss);
		window.addEventListener('scroll', scroll, true);
		return () => {
			window.removeEventListener('pointerdown', outside, true);
			window.removeEventListener('blur', blur);
			window.removeEventListener('resize', dismiss);
			window.removeEventListener('scroll', scroll, true);
		};
	});
</script>

<div class="context-menu" bind:this={menu} role="menu" aria-label={`Actions for ${label}`} tabindex="-1" style:left={`${left}px`} style:top={`${top}px`} onkeydown={keydown} oncontextmenu={(event) => event.preventDefault()}>
	<div class="context-heading" role="presentation"><strong>{label}</strong><small>{detail}</small></div>
	{#each items as item, index (item.id)}
		{#if index > 0 && item.group !== items[index - 1].group}<div class="context-divider" role="separator"></div>{/if}
		<button role="menuitem" class:danger={item.group === 'danger'} disabled={item.enabled === false} onclick={() => onRun(item.id)}>
			<span>{item.label}{#if item.detail}<small>{item.detail}</small>{/if}</span>
		</button>
	{/each}
</div>

<style>
	.context-menu { position: fixed; z-index: 120; width: min(290px, calc(100vw - 16px)); max-height: calc(100dvh - 16px); overflow-y: auto; padding: 6px; border: 1px solid var(--hs-line-strong); border-radius: 12px; background: var(--hs-raised); color: var(--hs-ink); box-shadow: 0 14px 45px var(--hs-shadow); font: 13px var(--font-sans, system-ui, sans-serif); }
	.context-heading { padding: 9px 10px 11px; display: grid; gap: 4px; }
	.context-heading strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
	small { color: var(--hs-muted); font-size: 11px; line-height: 1.4; display: block; }
	.context-divider { height: 1px; margin: 5px 4px; background: var(--hs-line); }
	button { width: 100%; min-height: 35px; padding: 8px 10px; text-align: left; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
	button:hover:not(:disabled), button:focus-visible { background: var(--hs-hover); outline: 2px solid var(--hs-focus); outline-offset: -2px; }
	button:disabled { color: var(--hs-muted); cursor: default; }
	button.danger { color: var(--hs-danger-ink); }
	button.danger:hover:not(:disabled) { background: var(--hs-danger-bg); }
	@media (pointer: coarse) { button { min-height: 44px; } }
</style>
