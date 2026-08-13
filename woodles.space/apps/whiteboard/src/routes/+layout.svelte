<script lang="ts">
	let { children } = $props();
</script>

<div class="whiteboard-root">
	{@render children()}
</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html),
	:global(body) {
		width: 100%;
		height: 100%;
		margin: 0;
	}

	:global(body) {
		overflow: hidden;
	}

	:global(button),
	:global(input),
	:global(textarea) {
		font: inherit;
	}

	:global(button) {
		border: 0;
		cursor: pointer;
	}

	.whiteboard-root {
		width: 100%;
		height: 100%;
	}
</style>
