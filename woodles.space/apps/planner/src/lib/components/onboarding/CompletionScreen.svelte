<script lang="ts">
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { COMPLETION } from '$lib/onboarding.copy';
</script>

<div class="completion">
	<div class="completion-card">
		<!-- Wax-seal style stamp -->
		<div class="seal" aria-hidden="true">
			<svg class="seal-ring" viewBox="0 0 120 120">
				<defs>
					<path id="seal-curve-top" d="M 60 60 m -46 0 a 46 46 0 1 1 92 0" />
					<path id="seal-curve-bot" d="M 60 60 m -46 0 a 46 46 0 1 0 92 0" />
				</defs>
				<circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="0.75" opacity="0.45" />
				<circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.7" stroke-dasharray="2 3" />

				<text class="seal-text" font-size="6.5">
					<textPath href="#seal-curve-top" startOffset="50%" text-anchor="middle">
						· CARILLON · CALIBRATED ·
					</textPath>
				</text>
				<text class="seal-text" font-size="6.5">
					<textPath href="#seal-curve-bot" startOffset="50%" text-anchor="middle">
						· EST. THIS WEEK ·
					</textPath>
				</text>
			</svg>
			<span class="seal-glyph">❦</span>
		</div>

		<p class="completion-stamp">
			<span class="stamp-line"></span>
			<span class="stamp-text">six of six · complete</span>
			<span class="stamp-line"></span>
		</p>

		<h1 class="completion-heading">{COMPLETION.heading}</h1>
		<p class="completion-body">{COMPLETION.body}</p>

		<button class="completion-cta" onclick={() => onboarding.finish()}>
			<span class="cta-pre">❧</span>
			<span>{COMPLETION.cta}</span>
		</button>

		<p class="completion-foot">
			the bells are tuned
			<span class="foot-sep">·</span>
			the calendar is calm
			<span class="foot-sep">·</span>
			you may proceed
		</p>
	</div>
</div>

<style>
	.completion {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(1.5rem, 5vw, 3rem);
	}

	.completion-card {
		max-width: 540px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.05rem;
	}

	/* ── seal ─────────────────────────────────────────────────────── */
	.seal {
		position: relative;
		width: clamp(7rem, 18vw, 9rem);
		height: clamp(7rem, 18vw, 9rem);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--p-accent);
		margin-bottom: 0.5rem;
		animation: seal-arrive 1.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.seal-ring {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		animation: seal-rotate 60s linear infinite;
	}

	.seal-text {
		font-family: var(--pl-font-mono);
		fill: currentColor;
		letter-spacing: 0.18em;
		opacity: 0.75;
	}

	.seal-glyph {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		font-size: clamp(2rem, 5vw, 2.6rem);
		line-height: 1;
		position: relative;
		z-index: 1;
		animation: glyph-arrive 1.6s ease-out;
	}

	@keyframes seal-arrive {
		0%   { transform: scale(0.4) rotate(-22deg); opacity: 0; }
		60%  { transform: scale(1.08) rotate(6deg);  opacity: 1; }
		100% { transform: scale(1)    rotate(0);     opacity: 1; }
	}

	@keyframes seal-rotate {
		0%   { transform: rotate(0); }
		100% { transform: rotate(360deg); }
	}

	@keyframes glyph-arrive {
		0%   { transform: scale(0.3) rotate(-30deg); opacity: 0; }
		60%  { transform: scale(1.2) rotate(8deg);   opacity: 1; }
		100% { transform: scale(1)   rotate(0);      opacity: 1; }
	}

	/* ── stamp line ───────────────────────────────────────────────── */
	.completion-stamp {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-family: var(--pl-font-mono);
		font-size: 0.56rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.6;
	}

	.stamp-line {
		width: 1.4rem;
		height: 1px;
		background: var(--p-accent);
		opacity: 0.55;
	}

	.stamp-text { white-space: nowrap; }

	/* ── headings ─────────────────────────────────────────────────── */
	.completion-heading {
		font-family: var(--pl-font-optical);
		font-weight: 300;
		font-style: italic;
		font-size: clamp(2rem, 5.5vw, 3rem);
		line-height: 1.1;
		color: var(--p-text);
		letter-spacing: -0.018em;
		font-variation-settings: 'opsz' 144, 'SOFT' 80;
	}

	.completion-body {
		font-family: var(--pl-font-body);
		font-size: 1.05rem;
		line-height: 1.55;
		color: var(--p-muted);
		opacity: 0.9;
	}

	/* ── CTA ──────────────────────────────────────────────────────── */
	.completion-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-family: var(--pl-font-mono);
		font-size: 0.82rem;
		letter-spacing: 0.16em;
		color: var(--p-text);
		border: 1px solid var(--p-accent);
		background: var(--p-accent-soft);
		padding: 12px 26px;
		border-radius: var(--pl-radius-pill);
		margin-top: 0.5rem;
		transition: background var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.completion-cta:hover { background: var(--p-accent); color: var(--p-bg); }
	.completion-cta:hover .cta-pre { transform: rotate(-12deg) translateY(-1px); }

	.cta-pre {
		font-family: var(--pl-font-fell);
		font-size: 0.95rem;
		line-height: 1;
		opacity: 0.85;
		transition: transform var(--pl-transition-fast);
	}

	.completion-foot {
		font-family: var(--pl-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.15em;
		text-transform: lowercase;
		color: var(--p-muted);
		opacity: 0.5;
		margin-top: 0.6rem;
		display: inline-flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		font-style: italic;
	}

	.foot-sep {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.6;
		font-style: normal;
	}
</style>
