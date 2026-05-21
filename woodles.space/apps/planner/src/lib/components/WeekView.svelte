<script lang="ts">
	let { stub = 'week' }: { stub?: string } = $props();

	const labels: Record<string, string> = {
		week: 'week view',
		month: 'month view',
		year: 'year scroll'
	};
</script>

<div class="stub-view">
	<p class="stub-label">{labels[stub] ?? stub}</p>
	<p class="stub-sub">coming soon.</p>
</div>

<style>
	.stub-view {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		gap: 0.5rem;
	}

	.stub-label {
		font-family: var(--pl-font-display);
		font-size: 2rem;
		font-weight: 400;
		color: var(--p-text);
		opacity: 0.3;
		letter-spacing: -0.01em;
	}

	.stub-sub {
		font-family: var(--pl-font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		color: var(--p-muted);
		opacity: 0.4;
	}
</style>
