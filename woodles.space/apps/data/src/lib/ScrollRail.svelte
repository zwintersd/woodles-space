<script lang="ts">
	import { onMount } from 'svelte';

	let { axis, viewportId, position, extent, visible, onScroll }: {
		axis: 'horizontal' | 'vertical';
		viewportId: string;
		position: number;
		extent: number;
		visible: number;
		onScroll: (position: number) => void;
	} = $props();
	let track: HTMLDivElement;
	let trackLength = $state(0);
	let dragging = $state(false);
	let drag: { pointer: number; start: number; position: number; scale: number } | null = null;
	const horizontal = $derived(axis === 'horizontal');
	const maximum = $derived(Math.max(0, extent - visible));
	const thumbLength = $derived(Math.min(trackLength, Math.max(48, trackLength * visible / Math.max(1, extent))));
	const travel = $derived(Math.max(0, trackLength - thumbLength));
	const offset = $derived(maximum ? Math.min(maximum, Math.max(0, position)) / maximum * travel : 0);
	const percentage = $derived(maximum ? Math.round(position / maximum * 100) : 0);

	onMount(() => {
		const measure = () => { trackLength = horizontal ? track.clientWidth : track.clientHeight; };
		const observer = new ResizeObserver(measure);
		observer.observe(track);
		measure();
		return () => observer.disconnect();
	});

	function coordinate(event: PointerEvent): number { return horizontal ? event.clientX : event.clientY; }
	function moveTo(next: number): void { onScroll(Math.min(maximum, Math.max(0, next))); }
	function beginDrag(event: PointerEvent): void {
		if (!event.isPrimary || event.button !== 0 || !travel) return;
		event.preventDefault();
		event.stopPropagation();
		const thumb = event.currentTarget as HTMLDivElement;
		thumb.focus({ preventScroll: true });
		thumb.setPointerCapture(event.pointerId);
		drag = { pointer: event.pointerId, start: coordinate(event), position, scale: maximum / travel };
		dragging = true;
	}
	function dragThumb(event: PointerEvent): void {
		if (drag?.pointer === event.pointerId) moveTo(drag.position + (coordinate(event) - drag.start) * drag.scale);
	}
	function endDrag(): void { drag = null; dragging = false; }
	function pageTrack(event: PointerEvent): void {
		if (!event.isPrimary || event.button !== 0) return;
		event.preventDefault();
		const bounds = track.getBoundingClientRect();
		const point = coordinate(event) - (horizontal ? bounds.left : bounds.top);
		moveTo(position + (point < offset ? -1 : 1) * visible * .85);
		track.querySelector<HTMLElement>('[role="scrollbar"]')?.focus({ preventScroll: true });
	}
	function keydown(event: KeyboardEvent): void {
		let next: number;
		if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = maximum;
		else if (event.key === 'PageUp') next = position - visible * .85;
		else if (event.key === 'PageDown') next = position + visible * .85;
		else if (event.key === (horizontal ? 'ArrowLeft' : 'ArrowUp')) next = position - (horizontal ? 80 : 37);
		else if (event.key === (horizontal ? 'ArrowRight' : 'ArrowDown')) next = position + (horizontal ? 80 : 37);
		else return;
		event.preventDefault();
		event.stopPropagation();
		moveTo(next);
	}
	function wheel(event: WheelEvent): void {
		event.preventDefault();
		const delta = horizontal ? event.deltaX || event.deltaY : event.deltaY;
		const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? visible : 1;
		moveTo(position + delta * unit);
	}
</script>

<div class="scroll-rail" class:horizontal class:vertical={!horizontal} class:dragging onwheel={wheel}>
	<button class="scroll-step backward" aria-label={horizontal ? 'Scroll table left' : 'Scroll table up'} title={horizontal ? 'Scroll left' : 'Scroll up'} disabled={position <= 0} onclick={() => moveTo(position - (horizontal ? 160 : 111))}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m9.5 4-4 4 4 4" /></svg>
	</button>
	<div class="scroll-track" bind:this={track} onpointerdown={pageTrack} role="presentation">
		<div
			class="scroll-thumb"
			role="scrollbar"
			tabindex="0"
			aria-label={horizontal ? 'Scroll table horizontally' : 'Scroll table vertically'}
			aria-controls={viewportId}
			aria-orientation={axis}
			aria-valuemin="0"
			aria-valuemax={Math.round(maximum)}
			aria-valuenow={Math.round(Math.min(maximum, Math.max(0, position)))}
			aria-valuetext={`${percentage}% ${horizontal ? 'across' : 'down'} the table`}
			title="Drag to explore · arrow keys, Page Up / Down, Home / End"
			style={horizontal ? `width:${thumbLength}px;left:${offset}px` : `height:${thumbLength}px;top:${offset}px`}
			onpointerdown={beginDrag}
			onpointermove={dragThumb}
			onpointerup={endDrag}
			onpointercancel={endDrag}
			onlostpointercapture={endDrag}
			onkeydown={keydown}
		>
			<span class="thumb-grip" aria-hidden="true"><i></i><svg viewBox="0 0 12 12"><path d="M6 1.5Q6.5 5.5 10.5 6 6.5 6.5 6 10.5 5.5 6.5 1.5 6 5.5 5.5 6 1.5Z" /></svg><i></i></span>
		</div>
	</div>
	<button class="scroll-step forward" aria-label={horizontal ? 'Scroll table right' : 'Scroll table down'} title={horizontal ? 'Scroll right' : 'Scroll down'} disabled={position >= maximum - 1} onclick={() => moveTo(position + (horizontal ? 160 : 111))}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m9.5 4-4 4 4 4" /></svg>
	</button>
</div>

<style>
	.scroll-rail {
		--rail-lilac: color-mix(in srgb, var(--hs-accent-light) 35%, var(--hs-raised));
		--rail-plum: color-mix(in srgb, var(--hs-accent) 58%, var(--hs-raised));
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 2px;
		background: linear-gradient(135deg, var(--hs-raised), var(--hs-sunk));
		user-select: none;
	}
	.horizontal { grid-area: 2 / 1; border-top: 1px solid var(--hs-line); }
	.vertical { grid-area: 1 / 2; flex-direction: column; border-left: 1px solid var(--hs-line); }
	.scroll-step {
		display: grid;
		place-items: center;
		flex: 0 0 16px;
		width: 16px;
		height: 16px;
		padding: 0;
		border: 1px solid var(--hs-line-strong);
		border-radius: 6px 7px 6px 7px;
		background: linear-gradient(145deg, var(--hs-raised), var(--hs-accent-soft));
		color: var(--hs-accent-text);
		box-shadow: inset 0 1px 0 var(--hs-raised), 0 1px 2px color-mix(in srgb, var(--hs-shadow) 40%, transparent);
		cursor: pointer;
		transition: border-color 120ms, box-shadow 120ms, transform 120ms;
	}
	.scroll-step svg { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
	.horizontal .forward svg { transform: rotate(180deg); }
	.vertical .backward svg { transform: rotate(90deg); }
	.vertical .forward svg { transform: rotate(-90deg); }
	.scroll-step:hover:not(:disabled) { border-color: var(--hs-accent-light); transform: translateY(-1px); box-shadow: 0 2px 4px color-mix(in srgb, var(--hs-shadow) 50%, transparent); }
	.scroll-step:active:not(:disabled) { transform: translateY(1px); box-shadow: inset 0 1px 3px var(--hs-shadow); }
	.scroll-step:disabled { opacity: .35; cursor: default; box-shadow: none; }
	.scroll-track { position: relative; flex: 1; min-width: 0; min-height: 0; align-self: stretch; cursor: pointer; touch-action: none; }
	.scroll-track::before {
		content: '';
		position: absolute;
		border: 1px solid var(--hs-line);
		border-radius: 999px;
		background: var(--hs-page);
		box-shadow: inset 0 1px 3px color-mix(in srgb, var(--hs-shadow) 35%, transparent);
	}
	.horizontal .scroll-track::before { inset: 5px 0; background-image: radial-gradient(circle, var(--hs-line-strong) .7px, transparent 1px); background-size: 14px 100%; }
	.vertical .scroll-track::before { inset: 0 5px; background-image: radial-gradient(circle, var(--hs-line-strong) .7px, transparent 1px); background-size: 100% 14px; }
	.scroll-thumb { position: absolute; display: grid; place-items: center; border-radius: 999px; outline: none; cursor: grab; touch-action: none; }
	.horizontal .scroll-thumb { top: 0; height: 100%; }
	.vertical .scroll-thumb { left: 0; width: 100%; }
	.scroll-thumb::before {
		content: '';
		position: absolute;
		border: 1px solid var(--rail-plum);
		border-radius: inherit;
		background: linear-gradient(180deg, var(--hs-raised) -35%, var(--rail-lilac) 35%, color-mix(in srgb, var(--hs-accent-light) 65%, var(--hs-raised)));
		box-shadow: inset 0 1px 1px var(--hs-raised), inset 0 -2px 3px color-mix(in srgb, var(--hs-accent) 18%, transparent), 0 2px 3px color-mix(in srgb, var(--hs-shadow) 65%, transparent);
		transition: inset 140ms, box-shadow 140ms, border-color 140ms;
	}
	.horizontal .scroll-thumb::before { inset: 2px 0; }
	.vertical .scroll-thumb::before { inset: 0 2px; background-image: linear-gradient(90deg, var(--hs-raised) -35%, var(--rail-lilac) 35%, color-mix(in srgb, var(--hs-accent-light) 65%, var(--hs-raised))); }
	.horizontal .scroll-thumb:hover::before, .horizontal.dragging .scroll-thumb::before { inset-block: 0; }
	.vertical .scroll-thumb:hover::before, .vertical.dragging .scroll-thumb::before { inset-inline: 0; }
	.scroll-thumb:hover::before { border-color: var(--hs-accent); }
	.dragging .scroll-thumb { cursor: grabbing; }
	.dragging .scroll-thumb::before { box-shadow: inset 0 2px 4px color-mix(in srgb, var(--hs-shadow) 65%, transparent), 0 1px 1px var(--hs-raised); }
	.scroll-thumb:focus-visible::before, .scroll-step:focus-visible { outline: 2px solid var(--hs-focus); outline-offset: 2px; }
	.thumb-grip { position: relative; display: flex; align-items: center; gap: 2px; color: var(--hs-accent); pointer-events: none; }
	.thumb-grip svg { width: 8px; height: 8px; fill: currentColor; filter: drop-shadow(0 1px 0 var(--hs-raised)); }
	.thumb-grip i { height: 5px; width: 1px; background: var(--rail-plum); box-shadow: 1px 0 0 var(--hs-raised); }
	.vertical .thumb-grip { transform: rotate(90deg); }
	@media (pointer: coarse) {
		.scroll-rail { gap: 4px; padding: 4px; }
		.scroll-step { flex-basis: 34px; width: 34px; height: 34px; border-radius: 13px 15px 13px 15px; }
		.scroll-step svg { width: 14px; height: 14px; }
		.horizontal .scroll-track::before { inset-block: 12px; }
		.vertical .scroll-track::before { inset-inline: 12px; }
	}
	@media (prefers-reduced-motion: reduce) { .scroll-step, .scroll-thumb::before { transition: none; } }
</style>
