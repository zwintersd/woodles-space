<script lang="ts">
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { WELCOME } from '$lib/onboarding.copy';
</script>

<div class="welcome">
	<div class="welcome-card">
		<!-- Top flourish — broad rule with central glyph -->
		<div class="welcome-flourish top" aria-hidden="true">
			<span class="flo-line"></span>
			<span class="flo-mark">❦</span>
			<span class="flo-line"></span>
		</div>

		<!-- Central mark — soft breathing -->
		<div class="welcome-mark" aria-hidden="true">
			<span class="mark-frame">⁂</span>
			<span class="mark-glyph">∴</span>
		</div>

		<p class="welcome-stamp" aria-hidden="true">
			<span class="stamp-line"></span>
			<span class="stamp-text">a planner · est. the present moment</span>
			<span class="stamp-line"></span>
		</p>

		<h1 class="welcome-heading">{WELCOME.heading}</h1>
		<p class="welcome-sub">{WELCOME.subheading}</p>

		<!-- Inner rule — narrower -->
		<div class="welcome-rule" aria-hidden="true">
			<span class="rule-line"></span>
			<span class="rule-dot">∽</span>
			<span class="rule-line"></span>
		</div>

		<div class="welcome-actions">
			<button class="welcome-cta" onclick={() => onboarding.beginFlow()}>
				<span class="cta-pre">❧</span>
				<span>{WELCOME.cta}</span>
			</button>
			<button class="welcome-skip" onclick={() => onboarding.quickStart()}>
				open planner now
			</button>
		</div>

		<p class="welcome-foot">
			quick-start available
			<span class="foot-sep">·</span>
			six small questions
			<span class="foot-sep">·</span>
			revisable any time
		</p>
	</div>
</div>

<style>
	.welcome {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(1.5rem, 5vw, 3rem);
	}

	.welcome-card {
		max-width: 560px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
	}

	/* ── top + central flourish ───────────────────────────────────── */
	.welcome-flourish {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		max-width: 22rem;
	}

	.flo-line {
		flex: 1;
		height: 1px;
		background: var(--p-accent);
		opacity: 0.45;
	}

	.flo-mark {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		font-size: 1rem;
		line-height: 1;
		opacity: 0.85;
	}

	.welcome-mark {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 4.8rem;
		height: 4.8rem;
		margin-top: 0.4rem;
	}

	.mark-frame {
		position: absolute;
		font-family: var(--pl-font-fell);
		font-size: 4.4rem;
		color: var(--p-accent);
		opacity: 0.18;
		line-height: 1;
		animation: mark-rotate 38s linear infinite;
	}

	.mark-glyph {
		position: relative;
		font-family: var(--pl-font-fell);
		font-size: 2.2rem;
		color: var(--p-accent);
		opacity: 0.9;
		line-height: 1;
		animation: mark-breathe 4.5s ease-in-out infinite;
	}

	@keyframes mark-rotate {
		0%   { transform: rotate(0)        scale(1);    }
		50%  { transform: rotate(180deg)   scale(1.04); }
		100% { transform: rotate(360deg)   scale(1);    }
	}

	@keyframes mark-breathe {
		0%, 100% { opacity: 0.7; transform: translateY(0); }
		50%      { opacity: 1;   transform: translateY(-2px); }
	}

	/* ── stamp line ───────────────────────────────────────────────── */
	.welcome-stamp {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-family: var(--pl-font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--p-muted);
		opacity: 0.55;
	}

	.stamp-line {
		width: 1.4rem;
		height: 1px;
		background: var(--p-muted);
		opacity: 0.45;
	}

	.stamp-text { white-space: nowrap; }

	/* ── headings ─────────────────────────────────────────────────── */
	.welcome-heading {
		font-family: var(--pl-font-optical);
		font-weight: 300;
		font-style: italic;
		font-size: clamp(2.2rem, 6vw, 3.4rem);
		line-height: 1.08;
		color: var(--p-text);
		letter-spacing: -0.02em;
		font-variation-settings: 'opsz' 144, 'SOFT' 80;
		margin-top: 0.4rem;
	}

	.welcome-sub {
		font-family: var(--pl-font-body);
		font-size: clamp(1rem, 2.2vw, 1.15rem);
		line-height: 1.55;
		color: var(--p-muted);
		opacity: 0.85;
	}

	.welcome-rule {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		max-width: 18rem;
		margin: 0.5rem 0 0.25rem;
	}

	.rule-line {
		flex: 1;
		height: 1px;
		background: var(--p-border);
	}

	.rule-dot {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.7;
		font-size: 0.95rem;
		line-height: 1;
	}

	/* ── CTA ──────────────────────────────────────────────────────── */
	.welcome-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	.welcome-cta {
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
		transition: background var(--pl-transition-fast), color var(--pl-transition-fast);
	}

	.welcome-cta:hover {
		background: var(--p-accent);
		color: var(--p-bg);
	}

	.welcome-cta:hover .cta-pre { transform: rotate(-12deg) translateY(-1px); }

	.cta-pre {
		font-family: var(--pl-font-fell);
		font-size: 0.95rem;
		line-height: 1;
		opacity: 0.85;
		transition: transform var(--pl-transition-fast);
	}

	.welcome-skip {
		font-family: var(--pl-font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		color: var(--p-muted);
		border: 1px solid var(--p-border);
		background: color-mix(in srgb, var(--p-surface) 65%, transparent);
		padding: 10px 18px;
		border-radius: var(--pl-radius-pill);
		transition: border-color var(--pl-transition-fast), color var(--pl-transition-fast), background var(--pl-transition-fast);
	}

	.welcome-skip:hover {
		color: var(--p-text);
		border-color: var(--p-accent);
		background: var(--p-surface);
	}

	.welcome-foot {
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
	}

	.foot-sep {
		font-family: var(--pl-font-fell);
		color: var(--p-accent);
		opacity: 0.6;
	}
</style>
