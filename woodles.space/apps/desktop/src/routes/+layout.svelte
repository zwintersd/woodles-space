<script lang="ts">
	let { children } = $props();
</script>

<div class="os">
	<div class="desktop">
		{@render children()}
	</div>
	<div class="taskbar">
		<a href="/" class="taskbar-home">← woodles.space</a>
	</div>
</div>

<style>
	.os {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.desktop {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.taskbar {
		height: 48px;
		width: 100%;
		background: rgba(201, 191, 238, 0.4);
		display: flex;
		align-items: center;
		padding: 0 1rem;
	}

	.taskbar-home {
		font-family: 'DM Mono', monospace;
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		color: rgba(90, 74, 122, 0.7);
		text-decoration: none;
		transition: color 0.2s;
	}
	.taskbar-home:hover { color: rgba(90, 74, 122, 1); }
</style>
