<script lang="ts">
	let { children } = $props();
</script>

<div class="os">
	<div class="desktop">
		{@render children()}
	</div>
	<div class="taskbar"></div>
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
	}
</style>
