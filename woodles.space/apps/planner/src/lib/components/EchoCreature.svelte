<script lang="ts">
	import { INTERVAL_KIND_OPTIONS, sporeStats, sporesSince } from '$lib/instrument';
	import { store } from '$lib/store.svelte';
	import type { IntervalKind } from '$lib/types';
	import { dateKey } from '$lib/utils';

	type GrowthPoint = {
		kind: IntervalKind;
		x: number;
		y: number;
	};

	const GROWTH_POINTS: GrowthPoint[] = [
		{ kind: 'clinic', x: 65, y: 62 },
		{ kind: 'writing', x: 177, y: 34 },
		{ kind: 'build', x: 292, y: 70 },
		{ kind: 'movement', x: 318, y: 172 },
		{ kind: 'care', x: 252, y: 239 },
		{ kind: 'rest', x: 106, y: 239 },
		{ kind: 'elsewhere', x: 38, y: 164 }
	];
	const componentId = $props.id();

	function beginningOfRecentWindow(now: Date): string {
		const beginning = new Date(now);
		beginning.setDate(beginning.getDate() - 6);
		return dateKey(beginning);
	}

	function growth(count: number): number {
		return Math.min(1, Math.sqrt(Math.max(0, count)) / 4);
	}

	function moteRadius(count: number): number {
		return 4 + growth(count) * 7;
	}

	function formatCount(count: number): string {
		return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(count);
	}

	let lifetimeStats = $derived(sporeStats(store.sporeEvents));
	let today = $derived(dateKey(store.now));
	let recentEvents = $derived(
		sporesSince(store.sporeEvents, beginningOfRecentWindow(store.now)).filter(
			(event) => event.date <= today
		)
	);
	let recentTotal = $derived(recentEvents.reduce((sum, event) => sum + event.amount, 0));
	let lifetimeTotal = $derived(store.sporeEvents.reduce((sum, event) => sum + event.amount, 0));
	let isNapping = $derived(recentTotal === 0);

	let growthPoints = $derived(
		GROWTH_POINTS.map((point) => ({
			...point,
			count: lifetimeStats[point.kind],
			radius: moteRadius(lifetimeStats[point.kind])
		}))
	);

	let statRows = $derived(
		INTERVAL_KIND_OPTIONS.map((option) => ({
			...option,
			count: lifetimeStats[option.kind],
			growth: growth(lifetimeStats[option.kind])
		}))
	);

	let statusCopy = $derived.by(() => {
		if (!isNapping) {
			return `${formatCount(recentTotal)} ${recentTotal === 1 ? 'spore has' : 'spores have'} arrived in the last seven days. Echo is awake and growing.`;
		}
		if (lifetimeTotal > 0) {
			return 'No new spores this week. Echo is curled up for an ordinary, well-earned nap.';
		}
		return 'A quiet first nap. The first honest interval mark will wake Echo.';
	});

	let creatureDescription = $derived(
		`Echo is ${isNapping ? 'peacefully napping' : 'awake'}. ${formatCount(lifetimeTotal)} lifetime ${lifetimeTotal === 1 ? 'spore' : 'spores'} shape its seven traits.`
	);
</script>

<section
	class="echo-panel"
	class:napping={isNapping}
	aria-labelledby={`${componentId}-title`}
	aria-describedby={`${componentId}-status ${componentId}-rule`}
	data-state={isNapping ? 'napping' : 'awake'}
>
	<div class="portrait-wrap">
		<svg
			class="echo-portrait"
			viewBox="0 0 360 278"
			role="img"
			aria-labelledby={`${componentId}-svg-title ${componentId}-svg-description`}
			focusable="false"
		>
			<title id={`${componentId}-svg-title`}>Echo, the Carillon creature</title>
			<desc id={`${componentId}-svg-description`}>{creatureDescription}</desc>

			<defs>
				<linearGradient id={`${componentId}-body-wash`} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stop-color="var(--p-surface)" />
					<stop offset="0.58" stop-color="var(--p-accent-soft)" />
					<stop offset="1" stop-color="var(--p-surface)" />
				</linearGradient>
				<radialGradient id={`${componentId}-belly-glow`}>
					<stop offset="0" stop-color="var(--p-highlight)" stop-opacity="0.52" />
					<stop offset="1" stop-color="var(--p-highlight)" stop-opacity="0" />
				</radialGradient>
			</defs>

			<circle class="echo-halo" cx="180" cy="142" r="90" />
			<circle class="echo-halo echo-halo-inner" cx="180" cy="142" r="72" />

			<g class="growth-constellation" aria-hidden="true">
				{#each growthPoints as point (point.kind)}
					<path
						class="growth-thread"
						class:has-growth={point.count > 0}
						d={`M 180 142 L ${point.x} ${point.y}`}
					/>
					<circle
						class="growth-mote"
						class:has-growth={point.count > 0}
						cx={point.x}
						cy={point.y}
						r={point.radius}
					/>
					{#if point.count > 0}
						<circle
							class="growth-mote-core"
							cx={point.x}
							cy={point.y}
							r={Math.max(2, point.radius * 0.32)}
						/>
					{/if}
				{/each}
			</g>

			<g class="sleep-nest" aria-hidden="true">
				<path d="M103 218 C131 240 229 240 257 218 C236 254 124 254 103 218Z" />
				<path d="M125 226 C150 235 210 235 235 226" />
			</g>

			<g class="echo-being" class:awake={!isNapping} class:asleep={isNapping}>
				<path
					class="echo-tail"
					d="M232 169 C270 153 278 123 258 109 C292 111 303 147 281 174 C265 194 245 198 227 195"
				/>

				<path
					class="echo-ear echo-ear-left"
					d="M133 112 C104 104 91 79 102 57 C128 64 145 83 147 111Z"
					fill={`url(#${componentId}-body-wash)`}
					style:opacity={0.42 + growth(lifetimeStats.clinic) * 0.58}
				/>
				<path
					class="echo-ear echo-ear-right"
					d="M212 111 C216 82 232 64 258 57 C268 82 254 106 226 114Z"
					fill={`url(#${componentId}-body-wash)`}
					style:opacity={0.42 + growth(lifetimeStats.clinic) * 0.58}
				/>
				<path class="ear-line" d="M111 71 C124 81 135 93 139 106" />
				<path class="ear-line" d="M249 71 C235 82 225 94 220 108" />

				<path
					class="echo-body"
					d="M118 124 C125 99 148 87 180 88 C213 88 237 101 243 126
						C251 158 247 199 224 218 C204 235 156 235 136 218
						C112 198 109 158 118 124Z"
					fill={`url(#${componentId}-body-wash)`}
				/>

				<circle
					class="belly-glow"
					cx="180"
					cy="176"
					r={28 + growth(lifetimeStats.care) * 12}
					fill={`url(#${componentId}-belly-glow)`}
					style:opacity={0.34 + growth(lifetimeStats.care) * 0.5}
				/>

				<g
					class="craft-marks"
					aria-hidden="true"
					style:opacity={0.25 + growth(lifetimeStats.build) * 0.68}
				>
					<path d="M151 193 Q180 211 209 193" />
					<path d="M155 202 Q180 218 205 202" />
					<path d="M163 211 Q180 221 197 211" />
				</g>

				<g
					class="voice-bell"
					aria-hidden="true"
					style:opacity={0.3 + growth(lifetimeStats.writing) * 0.7}
				>
					<path d="M168 161 Q180 149 192 161 L188 171 Q180 177 172 171Z" />
					<circle cx="180" cy="173" r={2.2 + growth(lifetimeStats.writing) * 2.4} />
				</g>

				<path
					class="range-wing range-wing-left"
					d="M121 151 C96 154 90 176 108 189 C102 172 112 164 126 168"
					style:opacity={0.28 + growth(lifetimeStats.movement) * 0.72}
				/>
				<path
					class="range-wing range-wing-right"
					d="M239 151 C264 154 270 176 252 189 C258 172 248 164 234 168"
					style:opacity={0.28 + growth(lifetimeStats.movement) * 0.72}
				/>

				<path
					class="hush-mark"
					d="M157 104 Q180 84 203 104 Q180 96 157 104Z"
					style:opacity={0.28 + growth(lifetimeStats.rest) * 0.72}
				/>

				{#if isNapping}
					<g class="sleeping-face">
						<path d="M145 139 Q155 148 165 139" />
						<path d="M195 139 Q205 148 215 139" />
						<path d="M175 157 Q180 160 185 157" />
					</g>
					<g class="sleep-notes" aria-hidden="true">
						<text x="239" y="101">z</text>
						<text x="255" y="82">z</text>
					</g>
				{:else}
					<g class="awake-face">
						<ellipse cx="155" cy="140" rx="8" ry="10" />
						<ellipse cx="205" cy="140" rx="8" ry="10" />
						<circle cx={157 + growth(lifetimeStats.elsewhere) * 2} cy="138" r="2.5" />
						<circle cx={207 + growth(lifetimeStats.elsewhere) * 2} cy="138" r="2.5" />
						<path d="M169 156 Q180 166 191 156" />
					</g>
				{/if}
			</g>
		</svg>

		<div class="portrait-caption" aria-hidden="true">
			<span class="state-dot"></span>
			<span>{isNapping ? 'napping softly' : 'awake in the spore garden'}</span>
		</div>
	</div>

	<div class="echo-copy">
		<header class="echo-header">
			<div>
				<p class="eyebrow">ECHOES · REINFORCEMENT GARDEN</p>
				<h2 id={`${componentId}-title`}>Echo</h2>
			</div>
			<div class="spore-total" aria-label={`${formatCount(lifetimeTotal)} spores all time`}>
				<strong>{formatCount(lifetimeTotal)}</strong>
				<span>all-time spores</span>
			</div>
		</header>

		<p id={`${componentId}-status`} class="status" aria-live="polite">{statusCopy}</p>

		<ul class="stat-grid" aria-label="Echo's lifetime growth by observed interval kind">
			{#each statRows as row (row.kind)}
				<li class="stat" style={`--growth: ${row.growth}`}>
					<span class="stat-glyph" aria-hidden="true">{row.glyph}</span>
					<span class="stat-copy">
						<strong>{row.stat}</strong>
						<small>{row.shortLabel}</small>
					</span>
					<span
						class="stat-count"
						aria-label={`${formatCount(row.count)} ${row.kind} ${row.count === 1 ? 'spore' : 'spores'}`}
					>
						{formatCount(row.count)}
					</span>
				</li>
			{/each}
		</ul>

		<p id={`${componentId}-rule`} class="growth-rule">
			One spore adds one mark to its matching trait. Quiet weeks never take marks away.
		</p>
	</div>
</section>

<style>
	.echo-panel {
		--echo-line: color-mix(in srgb, var(--p-accent) 28%, var(--p-border));
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
		gap: clamp(1.25rem, 4vw, 2.75rem);
		align-items: center;
		position: relative;
		overflow: hidden;
		padding: clamp(1rem, 3vw, 1.75rem);
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-lg);
		background:
			radial-gradient(circle at 14% 14%, var(--p-accent-soft), transparent 38%),
			linear-gradient(145deg, var(--p-surface), color-mix(in srgb, var(--p-bg) 62%, var(--p-surface)));
		box-shadow: var(--pl-shadow-card);
		color: var(--p-text);
		isolation: isolate;
	}

	.echo-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		opacity: 0.42;
		background-image:
			linear-gradient(var(--p-border) 1px, transparent 1px),
			linear-gradient(90deg, var(--p-border) 1px, transparent 1px);
		background-size: 2.25rem 2.25rem;
		mask-image: linear-gradient(90deg, black, transparent 68%);
		pointer-events: none;
	}

	.portrait-wrap {
		min-width: 0;
		text-align: center;
	}

	.echo-portrait {
		display: block;
		width: min(100%, 24rem);
		height: auto;
		margin-inline: auto;
		overflow: visible;
		color: var(--p-text);
	}

	.echo-halo {
		fill: var(--p-accent-soft);
		opacity: 0.4;
		stroke: var(--echo-line);
		stroke-width: 1;
		stroke-dasharray: 2 8;
	}

	.echo-halo-inner {
		fill: none;
		opacity: 0.62;
		stroke-dasharray: 1 7;
	}

	.growth-thread {
		fill: none;
		stroke: var(--echo-line);
		stroke-width: 1;
		stroke-dasharray: 2 7;
		opacity: 0.38;
	}

	.growth-thread.has-growth {
		stroke: var(--p-accent);
		opacity: 0.44;
	}

	.growth-mote {
		fill: var(--p-surface);
		stroke: var(--echo-line);
		stroke-width: 1.5;
		stroke-dasharray: 2 3;
		opacity: 0.65;
		transition:
			r var(--pl-transition-spring),
			opacity var(--pl-transition-medium);
	}

	.growth-mote.has-growth {
		fill: color-mix(in srgb, var(--p-accent) 34%, var(--p-surface));
		stroke: var(--p-accent);
		stroke-dasharray: none;
		opacity: 1;
	}

	.growth-mote-core {
		fill: var(--p-highlight);
		opacity: 0.9;
	}

	.sleep-nest {
		fill: color-mix(in srgb, var(--p-accent-soft) 72%, var(--p-surface));
		stroke: var(--echo-line);
		stroke-width: 1.5;
		stroke-linecap: round;
		opacity: 0.76;
	}

	.echo-being {
		transform-box: fill-box;
		transform-origin: center bottom;
	}

	.echo-being.awake {
		animation: echo-breathe 4.8s ease-in-out infinite;
	}

	.echo-being.asleep {
		animation: echo-sleep 6.4s ease-in-out infinite;
	}

	.echo-body,
	.echo-ear {
		stroke: var(--p-text);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.echo-body {
		filter: drop-shadow(0 8px 8px var(--p-accent-soft));
	}

	.echo-ear {
		transition: opacity var(--pl-transition-medium);
	}

	.ear-line,
	.craft-marks,
	.range-wing,
	.hush-mark,
	.sleeping-face,
	.awake-face path {
		fill: none;
		stroke: var(--p-text);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.ear-line {
		opacity: 0.33;
	}

	.echo-tail {
		fill: color-mix(in srgb, var(--p-accent) 22%, var(--p-surface));
		stroke: var(--p-text);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.82;
	}

	.belly-glow {
		transition:
			r var(--pl-transition-spring),
			opacity var(--pl-transition-medium);
	}

	.craft-marks,
	.range-wing,
	.hush-mark {
		transition: opacity var(--pl-transition-medium);
	}

	.voice-bell {
		fill: color-mix(in srgb, var(--p-highlight) 48%, var(--p-surface));
		stroke: var(--p-text);
		stroke-width: 1.5;
		stroke-linejoin: round;
		transition: opacity var(--pl-transition-medium);
	}

	.awake-face ellipse {
		fill: var(--p-surface);
		stroke: var(--p-text);
		stroke-width: 2;
	}

	.awake-face circle {
		fill: var(--p-text);
		transition: cx var(--pl-transition-medium);
	}

	.sleep-notes {
		fill: var(--p-muted);
		font-family: var(--pl-font-display);
		font-size: 18px;
		font-style: italic;
		opacity: 0.72;
		animation: sleep-notes 4.8s ease-in-out infinite;
	}

	.portrait-caption {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: -0.45rem;
		font-family: var(--pl-font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--p-muted);
	}

	.state-dot {
		width: 0.42rem;
		height: 0.42rem;
		border-radius: 50%;
		background: var(--p-accent);
		box-shadow: 0 0 0 4px var(--p-accent-soft);
	}

	.napping .state-dot {
		background: var(--p-muted);
		box-shadow: 0 0 0 4px var(--p-border);
	}

	.echo-copy {
		min-width: 0;
	}

	.echo-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		padding-bottom: 0.8rem;
		border-bottom: 1px solid var(--p-border);
	}

	.eyebrow {
		margin: 0 0 0.25rem;
		font-family: var(--pl-font-mono);
		font-size: 0.57rem;
		letter-spacing: 0.16em;
		color: var(--p-accent);
	}

	h2 {
		margin: 0;
		font-family: var(--pl-font-display);
		font-size: clamp(2rem, 5vw, 3.15rem);
		font-weight: 400;
		line-height: 0.9;
		letter-spacing: -0.025em;
	}

	.spore-total {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		flex: 0 0 auto;
		font-family: var(--pl-font-mono);
		color: var(--p-muted);
	}

	.spore-total strong {
		font-family: var(--pl-font-display);
		font-size: 1.45rem;
		font-weight: 400;
		line-height: 1;
		color: var(--p-text);
	}

	.spore-total span {
		margin-top: 0.25rem;
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.status {
		margin: 0;
		padding: 0.85rem 0;
		font-family: var(--pl-font-body);
		font-size: 0.84rem;
		line-height: 1.55;
		color: var(--p-muted);
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.stat {
		display: grid;
		grid-template-columns: 1.65rem minmax(0, 1fr) auto;
		align-items: center;
		min-width: 0;
		min-height: 2.65rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--p-accent-soft) calc(22% + var(--growth) * 58%), transparent),
				transparent 72%
			),
			color-mix(in srgb, var(--p-surface) 78%, transparent);
	}

	.stat-glyph {
		font-family: var(--pl-font-display);
		font-size: 1rem;
		color: var(--p-accent);
		text-align: center;
	}

	.stat-copy {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.08;
	}

	.stat-copy strong {
		overflow: hidden;
		font-family: var(--pl-font-body);
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--p-text);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stat-copy small {
		margin-top: 0.2rem;
		overflow: hidden;
		font-family: var(--pl-font-mono);
		font-size: 0.49rem;
		letter-spacing: 0.07em;
		color: var(--p-muted);
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.stat-count {
		min-width: 1.8rem;
		padding: 0.18rem 0.4rem;
		border-radius: var(--pl-radius-pill);
		background: var(--p-accent-soft);
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		font-variant-numeric: tabular-nums;
		text-align: center;
		color: var(--p-text);
	}

	.growth-rule {
		margin: 0.75rem 0 0;
		padding-top: 0.65rem;
		border-top: 1px dashed var(--p-border);
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		line-height: 1.5;
		letter-spacing: 0.04em;
		color: var(--p-muted);
	}

	@keyframes echo-breathe {
		0%,
		100% {
			transform: translateY(0) rotate(-0.4deg);
		}
		50% {
			transform: translateY(-4px) rotate(0.4deg);
		}
	}

	@keyframes echo-sleep {
		0%,
		100% {
			transform: translateY(1px) scaleY(0.985);
		}
		50% {
			transform: translateY(0) scaleY(1);
		}
	}

	@keyframes sleep-notes {
		0%,
		100% {
			opacity: 0.2;
			transform: translateY(3px);
		}
		50% {
			opacity: 0.72;
			transform: translateY(-3px);
		}
	}

	@media (max-width: 760px) {
		.echo-panel {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.75rem;
		}

		.echo-portrait {
			width: min(100%, 20rem);
		}

		.portrait-caption {
			margin-top: -0.9rem;
		}
	}

	@media (max-width: 430px) {
		.echo-panel {
			padding: 0.85rem;
			border-radius: var(--pl-radius-md);
		}

		.echo-header {
			align-items: flex-start;
		}

		.stat-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.stat {
			min-height: 2.45rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.echo-being,
		.sleep-notes {
			animation: none;
		}

		.growth-mote,
		.belly-glow,
		.echo-ear,
		.craft-marks,
		.range-wing,
		.hush-mark,
		.voice-bell,
		.awake-face circle {
			transition: none;
		}
	}

	@media print {
		.echo-panel {
			box-shadow: none;
			break-inside: avoid;
		}

		.echo-panel::before {
			display: none;
		}
	}
</style>
