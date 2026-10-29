<script lang="ts">
	import { MAX_STACK_COLUMNS, type StackItem } from './model';
	import { stackColumns } from './geometry';

	let { stack, change, compact = false, disabled = false }: {
		stack: StackItem; change: (value: string) => void; compact?: boolean; disabled?: boolean;
	} = $props();
</script>

<label data-whiteboard-ui class:compact onpointerdown={(event) => event.stopPropagation()}>
	<span>Columns</span>
	<select aria-label="Stack columns" title="Columns" {disabled} value={String(stack.columns ?? '')} onchange={(event) => change(event.currentTarget.value)}>
		<option value="">Auto ({stackColumns({ ...stack, columns: undefined })})</option>
		{#each Array.from({ length: MAX_STACK_COLUMNS }, (_, index) => index + 1) as columns}
			<option value={columns}>{columns}</option>
		{/each}
	</select>
</label>

<style>
	label { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #74625b; font-size: 12px; }
	select { min-height: 30px; padding: 3px 6px; border: 1px solid #d9ccc0; border-radius: 7px; background: #fffdf7; color: #604c46; font: inherit; cursor: pointer; }
	select:focus-visible { outline: 2px solid #a66670; outline-offset: 2px; }
	select:disabled { opacity: .55; cursor: default; }
	.compact { flex: none; gap: 4px; font-size: 10px; }
	.compact span { display: none; }
	.compact select { max-width: 72px; min-height: 25px; padding: 2px 3px; font-size: 10px; }
</style>
