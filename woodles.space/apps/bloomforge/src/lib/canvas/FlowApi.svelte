<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';

	/**
	 * `useSvelteFlow()` only resolves inside the flow's own context, so this
	 * has to be a child of `<SvelteFlow>` even though it draws nothing. Handing
	 * the instance back up through a prop lets the canvas drive the camera
	 * from ordinary event handlers instead of every caller needing to sit
	 * inside the tree.
	 */
	interface Props {
		onready: (flow: ReturnType<typeof useSvelteFlow>) => void;
	}

	let { onready }: Props = $props();

	// svelte-ignore state_referenced_locally
	onready(useSvelteFlow());
</script>
