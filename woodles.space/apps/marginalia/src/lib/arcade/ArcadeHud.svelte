<script lang="ts">
	export interface ArcadeHudScore {
		label: string;
		value: string | number;
		live?: boolean;
		earned?: boolean;
		tone?: 'blue' | 'cyan' | 'green' | 'red' | 'violet' | 'yellow';
	}

	interface Props {
		title: string;
		hint: string;
		scores: ArcadeHudScore[];
		startLabel: string;
		onstart: () => void;
		onclose: () => void;
		maxWidth?: string;
	}

	let { title, hint, scores, startLabel, onstart, onclose, maxWidth = '540px' }: Props = $props();
	const hudStyle = $derived(`--arcade-hud-width:${maxWidth}`);
</script>

<div class="arcade-hud" style={hudStyle}>
	<div class="game-id">
		<span class="game-name">{title}</span>
		<span class="game-hint">{hint}</span>
	</div>
	<div class="score-group">
		{#each scores as score}
			<div
				class="score-box"
				class:live={score.live}
				class:earned={score.earned}
				data-tone={score.tone ?? 'cyan'}
			>
				<span class="score-label">{score.label}</span>
				<span class="score-val">{score.value}</span>
			</div>
		{/each}
	</div>
	<div class="btn-group">
		<button class="ctrl-btn" onclick={onstart}>{startLabel}</button>
		<button class="ctrl-btn back" onclick={onclose}>arcade</button>
	</div>
</div>

<style>
	.arcade-hud {
		width: 100%;
		max-width: var(--arcade-hud-width);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
	}
	.game-id {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.game-name {
		font-family: var(--font-counter);
		font-size: 2rem;
		line-height: 1;
		color: var(--sol-base01);
	}
	.game-hint {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.score-group {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.score-box {
		background: var(--sol-base2);
		border-radius: 3px;
		padding: 0.3rem 0.6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 3.2rem;
	}
	.score-box.live[data-tone='blue'] {
		background: color-mix(in srgb, var(--sol-base2) 70%, var(--sol-blue));
	}
	.score-box.live[data-tone='cyan'] {
		background: color-mix(in srgb, var(--sol-base2) 68%, var(--sol-cyan));
	}
	.score-box.live[data-tone='green'] {
		background: color-mix(in srgb, var(--sol-base2) 70%, var(--sol-green));
	}
	.score-box.live[data-tone='red'] {
		background: color-mix(in srgb, var(--sol-base2) 70%, var(--sol-red));
	}
	.score-box.live[data-tone='violet'] {
		background: color-mix(in srgb, var(--sol-base2) 68%, var(--sol-violet));
	}
	.score-box.live[data-tone='yellow'] {
		background: color-mix(in srgb, var(--sol-base2) 70%, var(--sol-yellow));
	}
	.score-box.earned {
		background: color-mix(in srgb, var(--sol-base2) 65%, var(--sol-yellow));
	}
	.score-label {
		font-family: var(--font-ui);
		font-size: 0.56rem;
		text-transform: uppercase;
		color: var(--sol-base1);
	}
	.score-val {
		font-family: var(--font-counter);
		font-size: 1.3rem;
		color: var(--sol-base01);
		line-height: 1.1;
	}
	.btn-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		align-items: flex-end;
	}
	.ctrl-btn {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		text-transform: uppercase;
		color: var(--sol-base3);
		background: var(--sol-base0);
		border-radius: 3px;
		padding: 0.24rem 0.6rem;
		white-space: nowrap;
		transition: background 0.1s;
	}
	.ctrl-btn:hover {
		background: var(--sol-base00);
	}
	.ctrl-btn.back {
		background: var(--sol-base2);
		color: var(--sol-base0);
	}
	.ctrl-btn.back:hover {
		background: var(--sol-base1);
		color: var(--sol-base3);
	}

	@media (max-width: 560px) {
		.arcade-hud {
			align-items: flex-start;
		}
		.btn-group {
			flex-direction: row;
			align-items: center;
		}
		.game-name {
			font-size: 1.7rem;
		}
		.score-box {
			min-width: 2.85rem;
			padding-inline: 0.48rem;
		}
	}
</style>
