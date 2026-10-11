<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import ScrollRail from './ScrollRail.svelte';

	let { children, label }: { children: Snippet; label: string } = $props();
	const componentId = $props.id();
	const viewportId = `${componentId}-viewport`;
	let viewport: HTMLDivElement;
	let content: HTMLDivElement;
	let enhanced = $state(false);
	let left = $state(0);
	let top = $state(0);
	let width = $state(0);
	let height = $state(0);
	let scrollWidth = $state(0);
	let scrollHeight = $state(0);
	const horizontal = $derived(scrollWidth > width + 1);
	const vertical = $derived(scrollHeight > height + 1);

	function measure(): void {
		width = viewport.clientWidth;
		height = viewport.clientHeight;
		scrollWidth = viewport.scrollWidth;
		scrollHeight = viewport.scrollHeight;
		left = viewport.scrollLeft;
		top = viewport.scrollTop;
	}
	onMount(() => {
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		observer.observe(content);
		enhanced = true;
		measure();
		return () => observer.disconnect();
	});
</script>

<div class="scroll-frame" class:enhanced class:horizontal class:vertical>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Focus lets keyboard users scroll the region, including with native scrollbars in forced colors.) -->
	<div class="table-scroll" id={viewportId} bind:this={viewport} onscroll={measure} role="region" aria-label={label} tabindex="0">
		<div class="scroll-content" bind:this={content}>{@render children()}</div>
	</div>
	{#if enhanced && horizontal}<ScrollRail axis="horizontal" {viewportId} position={left} extent={scrollWidth} visible={width} onScroll={(next) => { viewport.scrollLeft = next; }} />{/if}
	{#if enhanced && vertical}<ScrollRail axis="vertical" {viewportId} position={top} extent={scrollHeight} visible={height} onScroll={(next) => { viewport.scrollTop = next; }} />{/if}
	{#if enhanced && horizontal && vertical}
		<div class="scroll-corner" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 12C2-1 0 13 12 12ZM12 12C25 2 11 0 12 12ZM12 12C22 25 24 11 12 12ZM12 12C-1 22 13 24 12 12Z" /><circle cx="12" cy="12" r="2" /></svg></div>
	{/if}
</div>

<style>
	.scroll-frame { --rail-size: 34px; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
	.scroll-frame.enhanced.horizontal { grid-template-rows: minmax(0, 1fr) var(--rail-size); }
	.scroll-frame.enhanced.vertical { grid-template-columns: minmax(0, 1fr) var(--rail-size); }
	.table-scroll { grid-area: 1 / 1; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; outline: none; }
	.table-scroll:focus-visible { box-shadow: inset 0 0 0 2px var(--hs-focus); }
	.enhanced .table-scroll { scrollbar-width: none; }
	.enhanced .table-scroll::-webkit-scrollbar { display: none; }
	.scroll-content { width: max-content; min-width: 100%; }
	.scroll-corner { grid-area: 2 / 2; display: grid; place-items: center; border-top: 1px solid var(--hs-line); border-left: 1px solid var(--hs-line); background: var(--hs-sunk); }
	.scroll-corner svg { width: 20px; height: 20px; fill: var(--hs-accent-soft); stroke: var(--hs-accent-light); stroke-width: 1; }
	.scroll-corner circle { fill: var(--hs-accent-light); stroke: none; }
	@media (pointer: coarse) { .scroll-frame { --rail-size: 44px; } }
	@media (forced-colors: active) {
		.scroll-frame.enhanced.horizontal, .scroll-frame.enhanced.vertical { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
		.enhanced .table-scroll { scrollbar-width: auto; }
		.enhanced .table-scroll::-webkit-scrollbar { display: initial; }
		.scroll-frame :global(.scroll-rail), .scroll-corner { display: none; }
	}
</style>
