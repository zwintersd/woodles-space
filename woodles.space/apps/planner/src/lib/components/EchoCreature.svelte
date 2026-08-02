<script lang="ts">
	import { INTERVAL_KIND_OPTIONS, sporeStats, sporesSince } from '$lib/instrument';
	import { store } from '$lib/store.svelte';
	import { dateKey } from '$lib/utils';

	const componentId = $props.id();

	// ── the drawing ───────────────────────────────────────────────────
	// Echo is built from one silhouette plus seven features, one per
	// observed interval kind. Every feature is *attached* to that
	// silhouette and grows by geometry — a longer tail, a taller ear, a
	// bigger bell — never by fading in. The old portrait grew by opacity,
	// which meant a low trait rendered as a half-erased line floating
	// beside the creature rather than as a small version of itself.
	//
	//   clinic    → ears          (what Echo turns toward)
	//   writing   → the bell      (Carillon's own motif, held in its lap)
	//   build     → mended patch  (sewn wider, more stitches, as it fills)
	//   movement  → tail          (reach)
	//   care      → belly + cheeks(warmth)
	//   rest      → quiet rings   (the hush around it)
	//   elsewhere → spore feelers (what it wonders about)

	const CENTER = { x: 180, y: 170 };
	const MOTE_RING = { rx: 156, ry: 112 };
	const THREAD_START = { rx: 84, ry: 100 };

	function beginningOfRecentWindow(now: Date): string {
		const beginning = new Date(now);
		beginning.setDate(beginning.getDate() - 6);
		return dateKey(beginning);
	}

	function growth(count: number): number {
		return Math.min(1, Math.sqrt(Math.max(0, count)) / 4);
	}

	function formatCount(count: number): string {
		return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(count);
	}

	// The tail leaves the body at the hip and reaches further as movement
	// accumulates. Drawn behind the silhouette so the joint never shows.
	function tailPath(reach: number): string {
		const tipX = 256 + reach * 20;
		const tipY = 186 - reach * 40;
		return `M 210 232 C ${242 + reach * 8} ${240} ${272 + reach * 12} ${218 - reach * 8} ${tipX} ${tipY}`;
	}

	// A feeler per side, rising between the ears with a spore at the tip.
	// Rooted inside the silhouette so it appears to grow out of the crown.
	function feelerTip(side: -1 | 1, rise: number): { x: number; y: number } {
		return { x: CENTER.x + side * (14 + rise * 14), y: 78 - rise * 24 };
	}

	function feelerPath(side: -1 | 1, rise: number): string {
		const tip = feelerTip(side, rise);
		const rootX = CENTER.x + side * 6;
		return `M ${rootX} 100 C ${rootX} ${92 - rise * 6} ${tip.x - side * 7} ${tip.y + 12} ${tip.x} ${tip.y}`;
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

	// Trait growth, 0–1, in the same order as the stat list below so the
	// constellation and the readout agree about which mote is which.
	let traits = $derived(
		Object.fromEntries(
			INTERVAL_KIND_OPTIONS.map((option) => [option.kind, growth(lifetimeStats[option.kind])])
		) as Record<(typeof INTERVAL_KIND_OPTIONS)[number]['kind'], number>
	);

	let motes = $derived(
		INTERVAL_KIND_OPTIONS.map((option, index) => {
			// Half-step offset keeps a mote off the crown, where the ears are.
			const angle = ((-90 + (360 / INTERVAL_KIND_OPTIONS.length) * (index + 0.5)) * Math.PI) / 180;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const count = lifetimeStats[option.kind];
			return {
				kind: option.kind,
				count,
				// Threads begin clear of the silhouette, so a thread is a whole
				// visible line rather than a stub poking out from behind Echo.
				x1: CENTER.x + THREAD_START.rx * cos,
				y1: CENTER.y + THREAD_START.ry * sin,
				x2: CENTER.x + MOTE_RING.rx * cos,
				y2: CENTER.y + MOTE_RING.ry * sin,
				r: 3.5 + growth(count) * 7
			};
		})
	);

	let statRows = $derived(
		INTERVAL_KIND_OPTIONS.map((option) => ({
			...option,
			count: lifetimeStats[option.kind],
			growth: growth(lifetimeStats[option.kind])
		}))
	);

	let earScale = $derived(0.7 + traits.clinic * 0.65);
	let bell = $derived(13 + traits.writing * 13);
	// Craft is a patch sewn onto the coat: as it widens, its dashed
	// stitching runs longer, so the marks multiply with the trait.
	let patch = $derived({ w: 17 + traits.build * 15, h: 13 + traits.build * 8 });
	let bellyRadius = $derived(22 + traits.care * 14);
	let cheek = $derived(8 + traits.care * 4);
	let hush = $derived(traits.rest);

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
			viewBox="0 0 360 300"
			role="img"
			aria-labelledby={`${componentId}-svg-title ${componentId}-svg-description`}
			focusable="false"
		>
			<title id={`${componentId}-svg-title`}>Echo, the Carillon creature</title>
			<desc id={`${componentId}-svg-description`}>{creatureDescription}</desc>

			<defs>
				<linearGradient id={`${componentId}-body-wash`} x1="0" y1="0" x2="0.35" y2="1">
					<stop offset="0" stop-color="var(--echo-body-light)" />
					<stop offset="1" stop-color="var(--echo-body-deep)" />
				</linearGradient>
				<radialGradient id={`${componentId}-belly-glow`}>
					<stop offset="0" stop-color="var(--p-accent)" stop-opacity="0.28" />
					<stop offset="1" stop-color="var(--p-accent)" stop-opacity="0" />
				</radialGradient>
			</defs>

			<!-- the hush: quiet rings that close up as rest accumulates -->
			<g class="quiet-rings" aria-hidden="true">
				<ellipse
					cx={CENTER.x}
					cy={CENTER.y}
					rx="120"
					ry="104"
					stroke-dasharray={`${1 + hush * 4} ${9 - hush * 4}`}
				/>
				<ellipse
					cx={CENTER.x}
					cy={CENTER.y}
					rx="101"
					ry="88"
					stroke-dasharray={`${1 + hush * 3} ${11 - hush * 5}`}
				/>
			</g>

			<g class="growth-constellation" aria-hidden="true">
				{#each motes as mote (mote.kind)}
					<path
						class="growth-thread"
						class:has-growth={mote.count > 0}
						d={`M ${mote.x1} ${mote.y1} L ${mote.x2} ${mote.y2}`}
					/>
					<circle
						class="growth-mote"
						class:has-growth={mote.count > 0}
						cx={mote.x2}
						cy={mote.y2}
						r={mote.r}
					/>
					{#if mote.count > 0}
						<circle class="growth-mote-core" cx={mote.x2} cy={mote.y2} r={mote.r * 0.34} />
					{/if}
				{/each}
			</g>

			{#if isNapping}
				<g class="sleep-nest" aria-hidden="true">
					<path d="M100 244 C132 268 228 268 260 244 C240 282 120 282 100 244Z" />
					<path d="M124 252 C150 262 210 262 236 252" />
				</g>
			{/if}

			<ellipse class="echo-seat" cx={CENTER.x} cy="262" rx="70" ry="9" aria-hidden="true" />

			<g class="echo-being" class:awake={!isNapping} class:asleep={isNapping}>
				<!-- behind the silhouette: tail, ears, feelers -->
				<g class="echo-tail" aria-hidden="true">
					<path class="tail-outline" d={tailPath(traits.movement)} />
					<path class="tail-fill" d={tailPath(traits.movement)} />
				</g>

				<g class="echo-ears" aria-hidden="true">
					{#each [{ x: 148, rotate: -20, side: 1 }, { x: 212, rotate: 20, side: -1 }] as ear (ear.x)}
						<g transform={`translate(${ear.x} 112) rotate(${ear.rotate}) scale(1 ${earScale})`}>
							<path
								class="ear-shell"
								d="M -14 6 C -13 -14 -7 -31 0 -42 C 7 -31 13 -14 14 6 C 6 11 -6 11 -14 6 Z"
								fill={`url(#${componentId}-body-wash)`}
							/>
							<path
								class="ear-fold"
								d={`M ${5 * ear.side} 0 C ${4 * ear.side} -13 ${2 * ear.side} -22 0 -30`}
							/>
						</g>
					{/each}
				</g>

				<g class="echo-feelers" aria-hidden="true">
					{#each [-1, 1] as side (side)}
						<path class="feeler-stem" d={feelerPath(side as -1 | 1, traits.elsewhere)} />
						<circle
							class="feeler-spore"
							cx={feelerTip(side as -1 | 1, traits.elsewhere).x}
							cy={feelerTip(side as -1 | 1, traits.elsewhere).y}
							r={2.6 + traits.elsewhere * 2}
						/>
					{/each}
				</g>

				<path
					class="echo-body"
					d="M180 88 C215 88 244 113 248 152
						C252 190 242 226 224 244
						C211 256 149 256 136 244
						C118 226 108 190 112 152
						C116 113 145 88 180 88 Z"
					fill={`url(#${componentId}-body-wash)`}
				/>

				<circle
					class="belly-glow"
					cx={CENTER.x}
					cy="202"
					r={bellyRadius}
					fill={`url(#${componentId}-belly-glow)`}
					aria-hidden="true"
				/>

				<!-- craft: a mended patch, sewn wider with every few spores -->
				<rect
					class="craft-patch"
					x={147 - patch.w / 2}
					y={199 - patch.h / 2}
					width={patch.w}
					height={patch.h}
					rx="4"
					aria-hidden="true"
				/>

				<!-- voice: the carillon bell Echo holds, growing as it writes -->
				<g class="voice-bell" aria-hidden="true">
					<path class="bell-handle" d={`M ${CENTER.x} ${244 - bell} V ${244 - bell - 5}`} />
					<circle class="bell-handle-ring" cx={CENTER.x} cy={244 - bell - 7} r="2.6" />
					<path
						class="bell-body"
						d={`M ${CENTER.x - bell * 0.62} 244
							C ${CENTER.x - bell * 0.6} ${244 - bell * 0.55} ${CENTER.x - bell * 0.42} ${244 - bell} ${CENTER.x} ${244 - bell}
							C ${CENTER.x + bell * 0.42} ${244 - bell} ${CENTER.x + bell * 0.6} ${244 - bell * 0.55} ${CENTER.x + bell * 0.62} 244 Z`}
					/>
					<circle class="bell-clapper" cx={CENTER.x} cy="247" r="2.2" />
				</g>

				<g class="cheeks" aria-hidden="true">
					<ellipse cx="143" cy="162" rx={cheek} ry={cheek * 0.6} />
					<ellipse cx="217" cy="162" rx={cheek} ry={cheek * 0.6} />
				</g>

				{#if isNapping}
					<g class="echo-face asleep-face">
						<path d="M147 148 Q156 157 165 148" />
						<path d="M195 148 Q204 157 213 148" />
						<path class="nose" d="M175 165 Q180 162 185 165 Q180 172 175 165 Z" />
						<path d="M172 176 Q180 181 188 176" />
					</g>
					<g class="sleep-notes" aria-hidden="true">
						<text x="248" y="118">z</text>
						<text x="266" y="96">z</text>
					</g>
				{:else}
					<g class="echo-face awake-face">
						<ellipse class="eye" cx="156" cy="148" rx="9" ry="10.5" />
						<ellipse class="eye" cx="204" cy="148" rx="9" ry="10.5" />
						<circle class="pupil" cx="157" cy="149" r="3.4" />
						<circle class="pupil" cx="205" cy="149" r="3.4" />
						<circle class="glint" cx="153.6" cy="144.6" r="1.7" />
						<circle class="glint" cx="201.6" cy="144.6" r="1.7" />
						<path class="nose" d="M175 165 Q180 162 185 165 Q180 172 175 165 Z" />
						<path d="M169 174 Q180 184 191 174" />
					</g>
				{/if}

				<g class="paws" aria-hidden="true">
					<ellipse cx="152" cy="249" rx="15" ry="8" />
					<ellipse cx="208" cy="249" rx="15" ry="8" />
				</g>
			</g>
		</svg>

		<p class="portrait-caption" aria-hidden="true">
			<span class="state-dot"></span>
			<span>{isNapping ? 'napping softly' : 'awake in the spore garden'}</span>
		</p>
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
	/* Echo is a Carillon card, not a visitor from another palette. It
	   borrows the instrument's paper family through the --p-* names the
	   drawing already speaks, so it sits beside the field sheet as a
	   sibling at every hour of the day. */
	.echo-panel {
		--p-surface: var(--car-paper);
		--p-text: var(--car-ink);
		--p-muted: var(--car-ink-soft);
		--p-accent: var(--car-pink-dark);
		--p-accent-soft: var(--car-pink-wash);
		--p-highlight: var(--car-brass);
		--p-border: rgba(64, 50, 71, 0.16);
		--echo-line: rgba(141, 49, 83, 0.34);
		/* The silhouette has to be opaque: a translucent body let the tail
		   and the ear roots read straight through it. */
		--echo-body-light: color-mix(in srgb, var(--p-accent) 4%, var(--p-surface));
		--echo-body-deep: color-mix(in srgb, var(--p-accent) 20%, var(--p-surface));

		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
		gap: clamp(1rem, 3vw, 2.25rem);
		align-items: center;
		position: relative;
		overflow: hidden;
		padding: clamp(1rem, 3vw, 1.6rem);
		border: 1px solid var(--car-line);
		border-radius: 1rem 1rem 1rem 2.8rem;
		background:
			linear-gradient(rgba(81, 44, 71, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(81, 44, 71, 0.025) 1px, transparent 1px),
			var(--p-surface);
		background-size: 18px 18px;
		box-shadow: 0 1.25rem 3.5rem var(--car-shadow);
		color: var(--p-text);
		isolation: isolate;
	}

	.portrait-wrap {
		min-width: 0;
		text-align: center;
	}

	.echo-portrait {
		display: block;
		width: min(100%, 22rem);
		height: auto;
		margin-inline: auto;
		overflow: visible;
	}

	/* ── constellation ────────────────────────────────────────────── */

	.quiet-rings ellipse {
		fill: none;
		stroke: var(--echo-line);
		stroke-width: 1;
		opacity: 0.5;
	}

	.growth-thread {
		fill: none;
		stroke: var(--echo-line);
		stroke-width: 1;
		stroke-dasharray: 2 6;
		opacity: 0.4;
	}

	.growth-thread.has-growth {
		opacity: 0.72;
	}

	.growth-mote {
		fill: var(--p-surface);
		stroke: var(--echo-line);
		stroke-width: 1.4;
		stroke-dasharray: 2 3;
		transition: r var(--pl-transition-spring);
	}

	.growth-mote.has-growth {
		fill: color-mix(in srgb, var(--p-accent) 16%, var(--p-surface));
		stroke: var(--p-accent);
		stroke-dasharray: none;
	}

	.growth-mote-core {
		fill: var(--p-accent);
		opacity: 0.85;
	}

	/* ── the creature ─────────────────────────────────────────────── */

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
	.ear-shell {
		stroke: var(--p-text);
		stroke-width: 2.2;
		stroke-linejoin: round;
	}

	.echo-body {
		filter: drop-shadow(0 6px 10px var(--p-accent-soft));
	}

	.echo-seat {
		fill: var(--p-accent-soft);
		opacity: 0.55;
	}

	.ear-fold,
	.feeler-stem,
	.echo-face path {
		fill: none;
		stroke: var(--p-text);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.ear-fold {
		opacity: 0.3;
		stroke-width: 1.6;
	}

	/* Tail: an outline stroke under a fill stroke, so it reads as a
	   plush limb attached at the hip rather than a floating crescent. */
	.tail-outline,
	.tail-fill {
		fill: none;
		stroke-linecap: round;
		transition: d var(--pl-transition-spring);
	}

	.tail-outline {
		stroke: var(--p-text);
		stroke-width: 21;
	}

	.tail-fill {
		stroke: color-mix(in srgb, var(--p-accent) 12%, var(--p-surface));
		stroke-width: 17;
	}

	.feeler-stem {
		stroke-width: 1.8;
	}

	.feeler-spore {
		fill: color-mix(in srgb, var(--p-accent) 26%, var(--p-surface));
		stroke: var(--p-text);
		stroke-width: 1.6;
		transition: r var(--pl-transition-spring);
	}

	.belly-glow {
		transition: r var(--pl-transition-spring);
	}

	.craft-patch {
		fill: color-mix(in srgb, var(--p-accent) 10%, transparent);
		stroke: var(--p-text);
		stroke-width: 1.5;
		stroke-dasharray: 3 4;
		opacity: 0.5;
		transition:
			width var(--pl-transition-spring),
			height var(--pl-transition-spring);
	}

	.voice-bell .bell-handle,
	.voice-bell .bell-handle-ring {
		fill: none;
		stroke: var(--p-text);
		stroke-width: 1.8;
		stroke-linecap: round;
	}

	.voice-bell .bell-body {
		fill: color-mix(in srgb, var(--p-highlight) 48%, var(--p-surface));
		stroke: var(--p-text);
		stroke-width: 1.8;
		stroke-linejoin: round;
	}

	.voice-bell .bell-clapper {
		fill: var(--p-text);
	}

	.cheeks ellipse {
		fill: var(--p-accent);
		opacity: 0.22;
		transition: rx var(--pl-transition-spring);
	}

	.paws ellipse {
		fill: color-mix(in srgb, var(--p-accent) 12%, var(--p-surface));
		stroke: var(--p-text);
		stroke-width: 2;
	}

	.echo-face .eye {
		fill: var(--p-surface);
		stroke: var(--p-text);
		stroke-width: 2;
	}

	.echo-face .pupil {
		fill: var(--p-text);
	}

	.echo-face .glint {
		fill: var(--p-surface);
	}

	.echo-face .nose {
		fill: var(--p-accent);
		stroke: none;
	}

	.sleep-nest {
		fill: color-mix(in srgb, var(--p-accent-soft) 70%, var(--p-surface));
		stroke: var(--echo-line);
		stroke-width: 1.4;
		stroke-linecap: round;
		opacity: 0.8;
	}

	.sleep-notes {
		fill: var(--p-muted);
		font-family: var(--car-display);
		font-size: 19px;
		font-style: italic;
		animation: sleep-notes 4.8s ease-in-out infinite;
	}

	/* ── copy ─────────────────────────────────────────────────────── */

	.portrait-caption {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: -0.35rem;
		font-family: var(--car-mono);
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
		font-family: var(--car-mono);
		font-size: 0.57rem;
		letter-spacing: 0.16em;
		color: var(--p-accent);
	}

	h2 {
		margin: 0;
		font-family: var(--car-display);
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
		font-family: var(--car-mono);
		color: var(--p-muted);
	}

	.spore-total strong {
		font-family: var(--car-counter);
		font-size: 1.6rem;
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
		font-family: var(--car-body);
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
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--p-accent-soft) calc(22% + var(--growth) * 58%), transparent),
			transparent 72%
		);
	}

	.stat-glyph {
		font-family: var(--car-display);
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
		font-family: var(--car-body);
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--p-text);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stat-copy small {
		margin-top: 0.2rem;
		overflow: hidden;
		font-family: var(--car-mono);
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
		font-family: var(--car-mono);
		font-size: 0.62rem;
		font-variant-numeric: tabular-nums;
		text-align: center;
		color: var(--p-text);
	}

	.growth-rule {
		margin: 0.75rem 0 0;
		padding-top: 0.65rem;
		border-top: 1px dashed var(--p-border);
		font-family: var(--car-mono);
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
			width: min(100%, 19rem);
		}
	}

	@media (max-width: 430px) {
		.echo-panel {
			padding: 0.85rem;
			border-radius: 0.8rem 0.8rem 0.8rem 1.8rem;
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
		.craft-patch,
		.feeler-spore,
		.cheeks ellipse,
		.tail-outline,
		.tail-fill {
			transition: none;
		}
	}

	@media print {
		.echo-panel {
			box-shadow: none;
			break-inside: avoid;
		}
	}
</style>
