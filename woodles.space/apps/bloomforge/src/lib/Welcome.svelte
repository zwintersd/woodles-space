<script lang="ts">
	/**
	 * Shown once, ever. It answers the only two questions a first-time visitor
	 * has — what is this, and where do I start — and then gets out of the way.
	 *
	 * A native `<dialog>` rather than a hand-rolled overlay: focus trapping,
	 * Escape, and the inert backdrop all come for free and all come correct.
	 */
	interface Props {
		onstart: () => void;
		onexplore: () => void;
	}

	let { onstart, onexplore }: Props = $props();
	let dialog: HTMLDialogElement;

	$effect(() => {
		dialog?.showModal();
	});
</script>

<dialog bind:this={dialog} onclose={onexplore} aria-labelledby="bf-welcome-title">
	<div class="art" aria-hidden="true">
		<span class="bloom">🌸</span>
		<span class="sprig sprig--a">✿</span>
		<span class="sprig sprig--b">🌿</span>
	</div>

	<h1 id="bf-welcome-title">Bloomforge Studio</h1>
	<p class="lede">
		A studio for <em>making</em> incremental games — not an incremental game. Wire up an economy as a graph, press play,
		and watch the curve you drew.
	</p>

	<ul class="beats">
		<li><span aria-hidden="true">🪙</span> Currencies and the generators that make them</li>
		<li><span aria-hidden="true">📈</span> Cost and output plotted while you tune them</li>
		<li><span aria-hidden="true">⏩</span> Ten hours of play, fast-forwarded, to find the wall</li>
	</ul>

	<div class="actions">
		<button class="bf-button bf-button--primary" type="button" onclick={onstart}>
			Build one with me · 2 min
		</button>
		<button class="bf-button" type="button" onclick={onexplore}>Poke at the example</button>
	</div>

	<p class="footnote">You can start the tour again any time from <strong>?</strong> in the toolbar.</p>
</dialog>

<style>
	dialog {
		width: min(440px, calc(100vw - 32px));
		padding: 0 26px 24px;
		border: 1px solid var(--bf-rule);
		border-radius: var(--bf-radius-lg);
		background: var(--bf-surface);
		box-shadow: var(--bf-shadow-lift);
		color: var(--bf-ink);
		font-family: var(--bf-font-sans);
		overflow: visible;
	}

	dialog::backdrop {
		background: rgba(84, 62, 96, 0.32);
		backdrop-filter: blur(3px);
	}

	.art {
		position: relative;
		height: 76px;
		margin: 0 -26px 4px;
		border-radius: var(--bf-radius-lg) var(--bf-radius-lg) 0 0;
		background: linear-gradient(150deg, var(--bf-accent-soft), var(--bf-prestige-soft) 60%, var(--bf-currency-soft));
		display: grid;
		place-items: center;
	}

	.bloom {
		font-size: 34px;
	}

	.sprig {
		position: absolute;
		font-size: 17px;
		opacity: 0.5;
	}

	.sprig--a {
		top: 14px;
		left: 26px;
	}

	.sprig--b {
		right: 24px;
		bottom: 12px;
	}

	h1 {
		margin: 16px 0 8px;
		font-family: var(--bf-font-display);
		font-size: 27px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--bf-accent-strong);
	}

	.lede {
		margin: 0 0 16px;
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--bf-ink-soft);
	}

	.lede em {
		font-style: italic;
		color: var(--bf-accent-strong);
	}

	.beats {
		margin: 0 0 20px;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 7px;
	}

	.beats li {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 12.5px;
		color: var(--bf-ink-soft);
	}

	.beats span {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		flex: none;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-surface-sunk);
		font-size: 13px;
	}

	.actions {
		display: grid;
		gap: 7px;
	}

	.actions :global(button) {
		justify-content: center;
		padding: 9px 14px;
		font-size: 13px;
	}

	.footnote {
		margin: 14px 0 0;
		font-size: 11px;
		text-align: center;
		color: var(--bf-faint);
	}

	.footnote strong {
		color: var(--bf-muted);
	}
</style>
