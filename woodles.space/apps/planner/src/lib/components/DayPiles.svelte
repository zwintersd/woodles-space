<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { queueSync } from '$lib/sync.svelte';
	import type { DayShape, MomentumLevel, WeekPattern } from '$lib/types';

	const WEEKDAYS = [
		{ dayOfWeek: 1, short: 'Mon', long: 'Monday' },
		{ dayOfWeek: 2, short: 'Tue', long: 'Tuesday' },
		{ dayOfWeek: 3, short: 'Wed', long: 'Wednesday' },
		{ dayOfWeek: 4, short: 'Thu', long: 'Thursday' },
		{ dayOfWeek: 5, short: 'Fri', long: 'Friday' },
		{ dayOfWeek: 6, short: 'Sat', long: 'Saturday' },
		{ dayOfWeek: 0, short: 'Sun', long: 'Sunday' }
	] as const;

	const MOMENTUM_LEVELS: {
		value: MomentumLevel;
		label: string;
		note: string;
	}[] = [
		{ value: 'easy', label: 'easy', note: 'high probability' },
		{ value: 'steady', label: 'steady', note: 'bridge' },
		{ value: 'stretch', label: 'stretch', note: 'lower probability' }
	];

	let activePileId = $state<string | null>(
		store.getDayShape(store.now)?.id ?? store.dayShapes[0]?.id ?? null
	);
	let announcement = $state('');

	let activePile = $derived(
		store.dayShapes.find((shape) => shape.id === activePileId) ?? store.dayShapes[0] ?? null
	);
	let todayPile = $derived(store.getDayShape(store.now));
	let todayDayOfWeek = $derived(store.now.getDay());
	let todaySuggestedId = $derived(store.weekPattern.days[todayDayOfWeek]);

	function momentumFor(shape: DayShape, level: MomentumLevel): number {
		return shape.blocks.filter((block) => (block.momentum ?? 'steady') === level).length;
	}

	function suggestedDays(shapeId: string): string {
		return WEEKDAYS.filter(
			({ dayOfWeek }) => store.weekPattern.days[dayOfWeek] === shapeId
		)
			.map(({ short }) => short)
			.join(' · ');
	}

	function chooseToday(shape: DayShape): void {
		store.setDayShape(store.now, shape.id);
		activePileId = shape.id;
		announcement = `${shape.name} is now today's pile.`;
		queueSync();
	}

	function tuneBlock(
		shape: DayShape,
		blockId: string,
		blockTitle: string,
		momentum: MomentumLevel
	): void {
		store.updateBlockMomentum(shape.id, blockId, momentum);
		announcement = `${blockTitle} is rated ${momentum} in ${shape.name}.`;
		queueSync();
	}

	function sequencePile(shape: DayShape): void {
		store.sequenceDayPile(shape.id);
		announcement = `${shape.name} has been sequenced from easy on-ramps to stretch work.`;
		queueSync();
	}

	function setSuggestedPile(dayOfWeek: number, shapeId: string): void {
		const days = [...store.weekPattern.days];
		days[dayOfWeek] = shapeId;
		store.setWeekPattern({
			days: days as WeekPattern['days'],
			updatedAt: new Date().toISOString()
		});

		const weekday = WEEKDAYS.find((day) => day.dayOfWeek === dayOfWeek);
		const shape = store.dayShapes.find((pile) => pile.id === shapeId);
		announcement = `${weekday?.long ?? 'Weekday'} now suggests ${shape?.name ?? 'that pile'}.`;
		queueSync();
	}

	function cycleSuggestedPile(dayOfWeek: number): void {
		if (store.dayShapes.length === 0) return;
		const currentId = store.weekPattern.days[dayOfWeek];
		const currentIndex = store.dayShapes.findIndex((shape) => shape.id === currentId);
		const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % store.dayShapes.length;
		setSuggestedPile(dayOfWeek, store.dayShapes[nextIndex].id);
	}
</script>

<section class="day-piles" aria-labelledby="day-piles-title">
	<header class="instrument-header">
		<div>
			<p class="eyebrow">weekly preparation · day piles</p>
			<h2 id="day-piles-title">Choose the shape, not every decision.</h2>
			<p class="lede">
				Build complete ways a day can go. Rate each block once, then let momentum put
				the easier starts in front of the harder thing.
			</p>
		</div>

		<div class="today-readout" aria-label="Today's pile">
			<span class="readout-label">today is wearing</span>
			<strong>{todayPile?.name ?? 'no pile'}</strong>
			{#if todayPile && todayPile.id !== todaySuggestedId}
				<span class="readout-note">a one-day choice</span>
			{:else}
				<span class="readout-note">the weekday suggestion</span>
			{/if}
		</div>
	</header>

	{#if store.dayShapes.length === 0}
		<div class="empty-rack">
			<span aria-hidden="true">◇</span>
			<p>The rack is empty. Add a day shape to make your first pile.</p>
		</div>
	{:else}
		<div class="rack" aria-label="Day pile rack">
			{#each store.dayShapes as shape, index (shape.id)}
				{@const isToday = todayPile?.id === shape.id}
				{@const isActive = activePile?.id === shape.id}
				{@const days = suggestedDays(shape.id)}

				<article class="pile-card" class:active={isActive} class:today={isToday}>
					<div class="card-index" aria-hidden="true">
						{String(index + 1).padStart(2, '0')}
					</div>

					<button
						type="button"
						class="pile-select"
						aria-pressed={isActive}
						aria-label={`Tune ${shape.name}`}
						onclick={() => (activePileId = shape.id)}
					>
						<span class="pile-heading">
							<strong>{shape.name}</strong>
							{#if shape.restful}
								<span class="restful-mark">low draw</span>
							{/if}
						</span>

						<span class="pile-days">
							{days ? `suggested ${days}` : 'not yet in the week'}
						</span>

						<span class="momentum-map" aria-hidden="true">
							{#each shape.blocks as block (block.id)}
								<span class:easy={(block.momentum ?? 'steady') === 'easy'}
									class:steady={(block.momentum ?? 'steady') === 'steady'}
									class:stretch={(block.momentum ?? 'steady') === 'stretch'}></span>
							{/each}
						</span>

						<span class="pile-tally">
							<span><b>{momentumFor(shape, 'easy')}</b> easy</span>
							<span><b>{momentumFor(shape, 'steady')}</b> steady</span>
							<span><b>{momentumFor(shape, 'stretch')}</b> stretch</span>
						</span>
					</button>

					<button
						type="button"
						class="today-button"
						class:chosen={isToday}
						disabled={isToday}
						onclick={() => chooseToday(shape)}
						aria-label={isToday ? `${shape.name} is today's pile` : `Use ${shape.name} today`}
					>
						{isToday ? 'on today' : 'use today'}
					</button>
				</article>
			{/each}
		</div>

		{#if activePile}
			<section class="tuning-bench" aria-labelledby="tuning-title">
				<header class="bench-header">
					<div>
						<p class="bench-kicker">momentum chain</p>
						<h3 id="tuning-title">{activePile.name}</h3>
						<p>
							Rate how likely each start is on an ordinary version of this day.
							Times stay fixed when the pile is sequenced.
						</p>
					</div>
					<button
						type="button"
						class="sequence-button"
						onclick={() => sequencePile(activePile)}
					>
						<span aria-hidden="true">→</span>
						sequence easy to stretch
					</button>
				</header>

				<div class="block-list">
					{#each activePile.blocks as block, index (block.id)}
						{@const momentum = block.momentum ?? 'steady'}
						<div class="block-row">
							<div class="block-order" aria-hidden="true">
								{String(index + 1).padStart(2, '0')}
							</div>
							<div class="block-copy">
								<span class="block-time">{block.startTime}–{block.endTime}</span>
								<strong>{block.title}</strong>
							</div>
							<div
								class="momentum-control"
								role="group"
								aria-label={`Momentum for ${block.title}`}
							>
								{#each MOMENTUM_LEVELS as level (level.value)}
									<button
										type="button"
										class:active={momentum === level.value}
										aria-pressed={momentum === level.value}
										title={level.note}
										onclick={() =>
											tuneBlock(
												activePile,
												block.id,
												block.title,
												level.value
											)}
									>
										{level.label}
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section class="week-pattern" aria-labelledby="week-pattern-title">
			<header class="pattern-header">
				<div>
					<p class="bench-kicker">suggested rack</p>
					<h3 id="week-pattern-title">One useful default for each morning.</h3>
				</div>
				<p>Pick directly, or tap the arrow to cycle the pile.</p>
			</header>

			<div class="weekday-grid">
				{#each WEEKDAYS as weekday (weekday.dayOfWeek)}
					{@const shapeId = store.weekPattern.days[weekday.dayOfWeek]}
					{@const shape = store.dayShapes.find((pile) => pile.id === shapeId)}
					<div
						class="weekday-cell"
						class:today={todayDayOfWeek === weekday.dayOfWeek}
					>
						<div class="weekday-heading">
							<span>{weekday.short}</span>
							{#if todayDayOfWeek === weekday.dayOfWeek}
								<small>today</small>
							{/if}
						</div>
						<label>
							<span class="sr-only">Suggested pile for {weekday.long}</span>
							<select
								value={shape?.id ?? ''}
								onchange={(event) =>
									setSuggestedPile(
										weekday.dayOfWeek,
										event.currentTarget.value
									)}
							>
								{#if !shape}
									<option value="" disabled>choose a pile</option>
								{/if}
								{#each store.dayShapes as pile (pile.id)}
									<option value={pile.id}>{pile.name}</option>
								{/each}
							</select>
						</label>
						<button
							type="button"
							class="cycle-button"
							onclick={() => cycleSuggestedPile(weekday.dayOfWeek)}
							aria-label={`Cycle ${weekday.long}'s suggested pile; currently ${shape?.name ?? 'unassigned'}`}
							title="next pile"
						>
							<span aria-hidden="true">→</span>
						</button>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<p class="sr-only" aria-live="polite">{announcement}</p>
</section>

<style>
	.day-piles {
		--p-bg: var(--car-night);
		--p-surface: #24182f;
		--p-text: var(--car-cream);
		--p-muted: var(--car-mist);
		--p-accent: var(--car-pink);
		--p-accent-soft: var(--car-pink-wash);
		--p-border: var(--car-line);
		width: min(100%, 74rem);
		margin: 0 auto;
		padding: clamp(1rem, 3vw, 2rem);
		color: var(--p-text);
	}

	.instrument-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: clamp(1.5rem, 5vw, 4rem);
		align-items: end;
		padding: 0 0 clamp(1.4rem, 4vw, 2.4rem);
		border-bottom: 1px solid var(--p-border);
	}

	.eyebrow,
	.bench-kicker {
		margin: 0 0 0.4rem;
		font-family: var(--pl-font-mono);
		font-size: 0.56rem;
		line-height: 1.4;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--p-accent);
	}

	.instrument-header h2,
	.bench-header h3,
	.pattern-header h3 {
		margin: 0;
		font-family: var(--pl-font-optical);
		font-weight: 400;
		font-variation-settings: 'opsz' 42;
		letter-spacing: -0.025em;
	}

	.instrument-header h2 {
		max-width: 18ch;
		font-size: clamp(2rem, 5vw, 3.7rem);
		line-height: 0.98;
	}

	.lede {
		max-width: 60ch;
		margin: 1rem 0 0;
		font-family: var(--pl-font-body);
		font-size: clamp(0.86rem, 1.5vw, 1rem);
		line-height: 1.65;
		color: var(--p-muted);
	}

	.today-readout {
		min-width: 11.5rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--p-border);
		border-left: 3px solid var(--p-accent);
		background: color-mix(in srgb, var(--p-surface) 88%, transparent);
		box-shadow: var(--pl-shadow-card);
	}

	.today-readout span,
	.today-readout strong {
		display: block;
	}

	.readout-label,
	.readout-note {
		font-family: var(--pl-font-mono);
		font-size: 0.5rem;
		line-height: 1.35;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: var(--p-muted);
	}

	.today-readout strong {
		margin: 0.25rem 0;
		font-family: var(--pl-font-display);
		font-size: 1.25rem;
		font-weight: 500;
	}

	.readout-note {
		opacity: 0.65;
	}

	.rack {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: 0.65rem;
		padding: 1rem 0;
	}

	.pile-card {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto;
		min-height: 14.5rem;
		overflow: hidden;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		background:
			linear-gradient(var(--p-border) 1px, transparent 1px) 0 2.8rem / 100% 2.2rem,
			color-mix(in srgb, var(--p-surface) 94%, var(--p-bg));
		transition:
			transform var(--pl-transition-fast),
			border-color var(--pl-transition-fast),
			box-shadow var(--pl-transition-fast);
	}

	.pile-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--pl-shadow-hover);
	}

	.pile-card.active {
		border-color: color-mix(in srgb, var(--p-accent) 75%, var(--p-border));
		box-shadow: 0 0 0 1px var(--p-accent-soft), var(--pl-shadow-card);
	}

	.pile-card.today::after {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: 3px;
		background: var(--p-accent);
		pointer-events: none;
	}

	.card-index {
		position: absolute;
		top: 0.85rem;
		right: 0.85rem;
		font-family: var(--pl-font-mono);
		font-size: 0.52rem;
		letter-spacing: 0.12em;
		color: var(--p-muted);
		opacity: 0.5;
		pointer-events: none;
	}

	.pile-select {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: stretch;
		padding: 1rem 0.9rem 0.8rem;
		color: inherit;
		text-align: left;
	}

	.pile-heading {
		display: flex;
		min-height: 3.5rem;
		padding-right: 1.75rem;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
		gap: 0.3rem;
	}

	.pile-heading strong {
		font-family: var(--pl-font-optical);
		font-size: 1.35rem;
		font-weight: 450;
		font-variation-settings: 'opsz' 36;
		line-height: 1.05;
	}

	.restful-mark {
		font-family: var(--pl-font-mono);
		font-size: 0.46rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--p-muted);
	}

	.pile-days {
		min-height: 2.4rem;
		margin-top: 0.85rem;
		font-family: var(--pl-font-mono);
		font-size: 0.52rem;
		line-height: 1.4;
		letter-spacing: 0.06em;
		color: var(--p-muted);
	}

	.momentum-map {
		display: flex;
		width: 100%;
		height: 1.15rem;
		gap: 2px;
		align-items: end;
		margin-top: auto;
		padding-top: 1.1rem;
	}

	.momentum-map > span {
		flex: 1;
		min-width: 2px;
		border-radius: 1px 1px 0 0;
		background: var(--p-muted);
		opacity: 0.3;
	}

	.momentum-map > span.easy {
		height: 35%;
		background: var(--p-accent);
		opacity: 0.55;
	}

	.momentum-map > span.steady {
		height: 66%;
		opacity: 0.42;
	}

	.momentum-map > span.stretch {
		height: 100%;
		background: var(--p-text);
		opacity: 0.72;
	}

	.pile-tally {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.65rem;
		margin-top: 0.45rem;
		font-family: var(--pl-font-mono);
		font-size: 0.46rem;
		letter-spacing: 0.04em;
		color: var(--p-muted);
	}

	.pile-tally b {
		color: var(--p-text);
		font-weight: 500;
	}

	.today-button {
		position: relative;
		z-index: 1;
		margin: 0 0.75rem 0.75rem;
		padding: 0.52rem 0.75rem;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-pill);
		background: color-mix(in srgb, var(--p-bg) 75%, transparent);
		font-family: var(--pl-font-mono);
		font-size: 0.54rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--p-muted);
		transition:
			color var(--pl-transition-fast),
			border-color var(--pl-transition-fast),
			background var(--pl-transition-fast);
	}

	.today-button:hover:not(:disabled) {
		border-color: var(--p-accent);
		background: var(--p-accent-soft);
		color: var(--p-text);
	}

	.today-button.chosen {
		border-color: transparent;
		background: var(--p-accent-soft);
		color: var(--p-accent);
		opacity: 1;
	}

	.today-button:disabled {
		cursor: default;
	}

	.tuning-bench,
	.week-pattern {
		margin-top: clamp(1.5rem, 4vw, 2.5rem);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-lg);
		background: color-mix(in srgb, var(--p-surface) 88%, transparent);
		box-shadow: var(--pl-shadow-card);
	}

	.bench-header,
	.pattern-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		padding: clamp(1rem, 3vw, 1.5rem);
		border-bottom: 1px solid var(--p-border);
	}

	.bench-header h3,
	.pattern-header h3 {
		font-size: clamp(1.5rem, 3vw, 2.15rem);
		line-height: 1;
	}

	.bench-header p:not(.bench-kicker),
	.pattern-header > p {
		max-width: 53ch;
		margin: 0.6rem 0 0;
		font-family: var(--pl-font-body);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--p-muted);
	}

	.pattern-header > p {
		max-width: 28ch;
		margin: 0;
		text-align: right;
	}

	.sequence-button {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.6rem 0.85rem;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-pill);
		font-family: var(--pl-font-mono);
		font-size: 0.54rem;
		line-height: 1;
		letter-spacing: 0.07em;
		color: var(--p-muted);
		transition:
			border-color var(--pl-transition-fast),
			color var(--pl-transition-fast),
			background var(--pl-transition-fast);
	}

	.sequence-button span {
		color: var(--p-accent);
	}

	.sequence-button:hover {
		border-color: var(--p-accent);
		background: var(--p-accent-soft);
		color: var(--p-text);
	}

	.block-list {
		padding: 0 clamp(0.8rem, 2.5vw, 1.4rem) 0.8rem;
	}

	.block-row {
		display: grid;
		grid-template-columns: 2rem minmax(9rem, 1fr) auto;
		gap: clamp(0.55rem, 2vw, 1rem);
		align-items: center;
		min-height: 4.2rem;
		border-bottom: 1px solid var(--p-border);
	}

	.block-row:last-child {
		border-bottom: 0;
	}

	.block-order {
		font-family: var(--pl-font-mono);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		color: var(--p-accent);
		opacity: 0.7;
	}

	.block-copy {
		display: grid;
		grid-template-columns: minmax(6.4rem, auto) 1fr;
		gap: clamp(0.5rem, 2vw, 1.2rem);
		align-items: baseline;
		min-width: 0;
	}

	.block-copy strong {
		overflow: hidden;
		font-family: var(--pl-font-body);
		font-size: 0.86rem;
		font-weight: 500;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.block-time {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.04em;
		color: var(--p-muted);
	}

	.momentum-control {
		display: inline-grid;
		grid-template-columns: repeat(3, 1fr);
		overflow: hidden;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-pill);
	}

	.momentum-control button {
		min-width: 4.5rem;
		padding: 0.42rem 0.65rem;
		border-right: 1px solid var(--p-border);
		font-family: var(--pl-font-mono);
		font-size: 0.5rem;
		letter-spacing: 0.04em;
		color: var(--p-muted);
		transition:
			background var(--pl-transition-fast),
			color var(--pl-transition-fast);
	}

	.momentum-control button:last-child {
		border-right: 0;
	}

	.momentum-control button:hover {
		color: var(--p-text);
		background: color-mix(in srgb, var(--p-accent-soft) 50%, transparent);
	}

	.momentum-control button.active {
		background: var(--p-accent-soft);
		color: var(--p-text);
	}

	.weekday-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		padding: 0.75rem;
	}

	.weekday-cell {
		position: relative;
		min-width: 0;
		padding: 0.75rem;
		border-right: 1px solid var(--p-border);
	}

	.weekday-cell:last-child {
		border-right: 0;
	}

	.weekday-cell.today {
		background: color-mix(in srgb, var(--p-accent-soft) 45%, transparent);
	}

	.weekday-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.weekday-heading > span {
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--p-text);
	}

	.weekday-heading small {
		font-family: var(--pl-font-mono);
		font-size: 0.4rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--p-accent);
	}

	.weekday-cell label {
		display: block;
		min-width: 0;
	}

	.weekday-cell select {
		width: 100%;
		min-width: 0;
		padding: 0.45rem 1.4rem 0.45rem 0.45rem;
		overflow: hidden;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-sm);
		background:
			linear-gradient(45deg, transparent 50%, var(--p-muted) 50%)
				calc(100% - 0.65rem) calc(50% - 1px) / 4px 4px no-repeat,
			linear-gradient(135deg, var(--p-muted) 50%, transparent 50%)
				calc(100% - 0.4rem) calc(50% - 1px) / 4px 4px no-repeat,
			var(--p-bg);
		appearance: none;
		font-family: var(--pl-font-body);
		font-size: 0.68rem;
		color: var(--p-text);
		text-overflow: ellipsis;
	}

	.cycle-button {
		display: grid;
		width: 1.7rem;
		height: 1.7rem;
		margin: 0.5rem 0 0 auto;
		place-items: center;
		border: 1px solid var(--p-border);
		border-radius: 50%;
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		color: var(--p-muted);
		transition:
			color var(--pl-transition-fast),
			border-color var(--pl-transition-fast),
			transform var(--pl-transition-fast);
	}

	.cycle-button:hover {
		transform: translateX(2px);
		border-color: var(--p-accent);
		color: var(--p-accent);
	}

	button:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--p-accent);
		outline-offset: 2px;
	}

	.empty-rack {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin-top: 1rem;
		padding: 1.5rem;
		border: 1px dashed var(--p-border);
		border-radius: var(--pl-radius-md);
		font-family: var(--pl-font-body);
		color: var(--p-muted);
	}

	.empty-rack p {
		margin: 0;
	}

	.empty-rack > span {
		color: var(--p-accent);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 900px) {
		.weekday-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 1px;
			background: var(--p-border);
			padding: 0;
		}

		.weekday-cell {
			border: 0;
			background: var(--p-surface);
		}

		.weekday-cell.today {
			background: color-mix(in srgb, var(--p-accent-soft) 45%, var(--p-surface));
		}
	}

	@media (max-width: 700px) {
		.instrument-header {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.today-readout {
			width: min(100%, 18rem);
		}

		.bench-header,
		.pattern-header {
			align-items: flex-start;
			flex-direction: column;
		}

		.pattern-header > p {
			text-align: left;
		}

		.block-row {
			grid-template-columns: 1.5rem minmax(0, 1fr);
			padding: 0.7rem 0;
		}

		.block-copy {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}

		.momentum-control {
			grid-column: 2;
			width: min(100%, 18rem);
		}

		.momentum-control button {
			min-width: 0;
		}
	}

	@media (max-width: 460px) {
		.day-piles {
			padding-inline: 0.75rem;
		}

		.rack {
			display: flex;
			margin-inline: -0.75rem;
			padding-inline: 0.75rem;
			overflow-x: auto;
			scroll-snap-type: x proximity;
		}

		.pile-card {
			flex: 0 0 min(82vw, 16rem);
			scroll-snap-align: start;
		}

		.weekday-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pile-card,
		.cycle-button {
			transition: none;
		}
	}
</style>
