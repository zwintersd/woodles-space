<script lang="ts">
	interface Props {
		value: number;
		label: string;
		tone?: 'blue' | 'danger' | 'green' | 'magic' | 'violet' | 'yellow';
		maxWidth?: string;
	}

	let { value, label, tone = 'blue', maxWidth = '540px' }: Props = $props();
	const clampedValue = $derived(Math.min(1, Math.max(0, value)));
	const trackStyle = $derived(`--arcade-progress:${clampedValue.toFixed(4)};--arcade-progress-width:${maxWidth}`);
</script>

<div class="arcade-progress tone-{tone}" style={trackStyle} aria-label={label}>
	<span></span>
</div>

<style>
	.arcade-progress {
		width: min(var(--arcade-progress-width), 100%);
		height: 0.45rem;
		border-radius: 999px;
		background: var(--sol-base2);
		overflow: hidden;
	}
	.arcade-progress span {
		display: block;
		width: calc(var(--arcade-progress) * 100%);
		height: 100%;
		transition: width 140ms linear;
	}
	.arcade-progress.tone-blue span {
		background: linear-gradient(90deg, var(--sol-green), var(--sol-cyan), var(--sol-blue));
	}
	.arcade-progress.tone-green span {
		background: linear-gradient(90deg, var(--sol-yellow), var(--sol-green), var(--sol-cyan));
	}
	.arcade-progress.tone-violet span {
		background: linear-gradient(90deg, var(--sol-cyan), var(--sol-blue), var(--sol-violet));
	}
	.arcade-progress.tone-magic span {
		background: linear-gradient(90deg, var(--sol-cyan), var(--sol-violet), var(--sol-yellow));
	}
	.arcade-progress.tone-yellow span {
		background: linear-gradient(90deg, var(--sol-orange), var(--sol-yellow), var(--sol-green));
	}
	.arcade-progress.tone-danger span {
		background: linear-gradient(90deg, var(--sol-cyan), var(--sol-yellow), var(--sol-orange), var(--sol-red));
	}
</style>
