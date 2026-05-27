<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { STEP_COPY, SHAPE_DESCRIPTIONS } from '$lib/onboarding.copy';
	import { timeToMinutes } from '$lib/utils';
	import type { WeekPattern, DayShape } from '$lib/types';
	import StepShell from './StepShell.svelte';

	const copy = STEP_COPY[4];

	// Mon-first display order; indices map back to Date.getDay() (0=Sun..6=Sat).
	const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
	const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	// Local working copy of the pattern — saved on advance.
	let working = $state<string[]>([...store.weekPattern.days]);

	// Track which shape is selected on the palette (visual hint only).
	let activeShapeId = $state<string | null>(store.dayShapes[0]?.id ?? null);

	function assign(dayOfWeek: number, shapeId: string) {
		const next = [...working];
		next[dayOfWeek] = shapeId;
		working = next;
		activeShapeId = shapeId;
	}

	function advance() {
		store.setWeekPattern({ days: working as WeekPattern['days'] });
		onboarding.advance();
	}

	// ── day-arc rendering ──────────────────────────────────────────
	// A horizontal bar from 06:00 to 24:00 with each block as a segment.
	const ARC_START = 6 * 60;
	const ARC_END = 24 * 60;
	const ARC_RANGE = ARC_END - ARC_START;

	type Segment = { left: number; width: number; title: string };

	function arcSegments(shape: DayShape): Segment[] {
		return shape.blocks
			.filter((b) => timeToMinutes(b.endTime) > ARC_START && timeToMinutes(b.startTime) < ARC_END)
			.map((b) => {
				const start = Math.max(ARC_START, timeToMinutes(b.startTime));
				const end = Math.min(ARC_END, timeToMinutes(b.endTime));
				return {
					left: ((start - ARC_START) / ARC_RANGE) * 100,
					width: ((end - start) / ARC_RANGE) * 100,
					title: b.title
				};
			});
	}
</script>

<StepShell
	eyebrow={copy.eyebrow}
	heading={copy.heading}
	subprompt={copy.subprompt}
	cta={copy.cta}
	stage={5}
	onAdvance={advance}
>
	<!-- Shape palette: cards with day-arc visualisation -->
	<div class="shape-palette" role="radiogroup" aria-label="day shape palette">
		{#each store.dayShapes as shape (shape.id)}
			{@const segs = arcSegments(shape)}
			<button
				class="shape-card"
				class:active={activeShapeId === shape.id}
				onclick={() => (activeShapeId = shape.id)}
				role="radio"
				aria-checked={activeShapeId === shape.id}
				title="pick this shape, then tap weekdays below"
			>
				<div class="shape-card-head">
					<span class="shape-card-name">{shape.name}</span>
					{#if shape.restful}
						<span class="shape-restful">restful</span>
					{/if}
				</div>
				<span class="shape-card-desc">
					{SHAPE_DESCRIPTIONS[shape.id] ?? `${shape.blocks.length} blocks`}
				</span>

				<!-- 18-hour arc: 6am → midnight -->
				<div class="shape-arc" aria-hidden="true">
					<div class="arc-track">
						{#each segs as s, i}
							<div
								class="arc-seg"
								class:alt={i % 2 === 1}
								style:left="{s.left}%"
								style:width="{s.width}%"
								title={s.title}
							></div>
						{/each}
					</div>
					<div class="arc-labels">
						<span>6a</span>
						<span>12p</span>
						<span>6p</span>
						<span>12a</span>
					</div>
				</div>
			</button>
		{/each}
	</div>

	<p class="rhythm-hint">
		<span class="rhythm-hint-mark">✦</span>
		pick a shape, then tap the days it belongs to.
		<span class="rhythm-hint-mark">✦</span>
	</p>

	<!-- Weekday tiles -->
	<div class="weekday-row">
		{#each WEEKDAY_ORDER as dow, i}
			{@const shapeId = working[dow]}
			{@const shape = store.dayShapes.find((s) => s.id === shapeId)}
			<button
				class="weekday-tile"
				class:restful={shape?.restful}
				onclick={() => activeShapeId && assign(dow, activeShapeId)}
				disabled={!activeShapeId}
				title={shape ? `${WEEKDAY_LABELS[i]} → ${shape.name}` : WEEKDAY_LABELS[i]}
			>
				<span class="weekday-dow">{WEEKDAY_LABELS[i]}</span>
				<span class="weekday-shape">{shape?.name ?? '—'}</span>
				{#if shape?.restful}
					<span class="weekday-mark" aria-hidden="true">❦</span>
				{/if}
			</button>
		{/each}
	</div>
</StepShell>

<style>
	/* ── shape palette ────────────────────────────────────────────── */
	.shape-palette {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.55rem;
	}

	.shape-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.9rem 0.95rem 0.7rem;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		background: var(--p-surface);
		text-align: left;
		transition: all var(--pl-transition-fast);
		opacity: 0.75;
		position: relative;
	}

	.shape-card:hover { opacity: 1; }

	.shape-card.active {
		opacity: 1;
		border-color: var(--p-accent);
		box-shadow: 0 0 0 1px var(--p-accent), var(--pl-shadow-card);
	}

	.shape-card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.shape-card-name {
		font-family: var(--pl-font-optical);
		font-weight: 400;
		font-style: italic;
		font-size: 1.2rem;
		color: var(--p-text);
		letter-spacing: -0.01em;
		font-variation-settings: 'opsz' 36;
	}

	.shape-restful {
		font-family: var(--pl-font-mono);
		font-size: 0.5rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.6;
	}

	.shape-card-desc {
		font-family: var(--pl-font-body);
		font-size: 0.74rem;
		line-height: 1.4;
		color: var(--p-muted);
		opacity: 0.85;
	}

	/* ── day-arc visualisation ────────────────────────────────────── */
	.shape-arc {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 0.25rem;
	}

	.arc-track {
		position: relative;
		height: 8px;
		background: var(--p-bg);
		border-radius: 100px;
		border: 1px solid var(--p-border);
		overflow: hidden;
	}

	.arc-seg {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--p-accent);
		opacity: 0.55;
		border-right: 1px solid color-mix(in srgb, var(--p-bg) 70%, transparent);
		transition: opacity var(--pl-transition-fast);
	}

	.arc-seg.alt {
		opacity: 0.78;
	}

	.shape-card.active .arc-seg { opacity: 0.85; }
	.shape-card.active .arc-seg.alt { opacity: 1; }

	.arc-labels {
		display: flex;
		justify-content: space-between;
		font-family: var(--pl-font-mono);
		font-size: 0.48rem;
		letter-spacing: 0.06em;
		color: var(--p-muted);
		opacity: 0.55;
		padding: 0 2px;
	}

	/* ── hint ─────────────────────────────────────────────────────── */
	.rhythm-hint {
		font-family: var(--pl-font-body);
		font-style: italic;
		font-size: 0.85rem;
		color: var(--p-muted);
		opacity: 0.85;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
	}

	.rhythm-hint-mark {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		font-size: 0.7rem;
		opacity: 0.6;
		font-style: normal;
	}

	/* ── weekday tiles ────────────────────────────────────────────── */
	.weekday-row {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
	}

	.weekday-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		padding: 0.85rem 0.25rem;
		min-height: 6rem;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		background: var(--p-bg);
		transition: all var(--pl-transition-fast);
		cursor: pointer;
		position: relative;
	}

	.weekday-tile:hover:not(:disabled) {
		border-color: var(--p-accent);
		background: color-mix(in srgb, var(--p-accent-soft) 60%, var(--p-bg));
	}

	.weekday-tile:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.weekday-tile.restful {
		background: color-mix(in srgb, var(--p-surface) 70%, var(--p-bg));
	}

	.weekday-dow {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.7;
	}

	.weekday-shape {
		font-family: var(--pl-font-body);
		font-size: 0.72rem;
		color: var(--p-text);
		text-align: center;
		font-style: italic;
		line-height: 1.2;
	}

	.weekday-mark {
		position: absolute;
		bottom: 0.3rem;
		font-family: var(--pl-font-fell);
		font-size: 0.65rem;
		color: var(--p-accent);
		opacity: 0.5;
		line-height: 1;
	}

	@media (max-width: 560px) {
		.weekday-row {
			grid-template-columns: repeat(4, 1fr);
		}
		.weekday-tile {
			min-height: 5rem;
		}
	}
</style>
