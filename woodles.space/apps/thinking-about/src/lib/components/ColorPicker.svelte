<script lang="ts">
	import { COLOR_SWATCHES } from '$lib/constants';

	let { value, onChange }: { value: string; onChange: (hex: string) => void } = $props();

	let isPreset = $derived(COLOR_SWATCHES.some((s) => s.hex.toLowerCase() === value.toLowerCase()));
</script>

<div class="color-picker">
	<div class="swatches" role="radiogroup" aria-label="entry color">
		{#each COLOR_SWATCHES as swatch (swatch.hex)}
			{@const selected = swatch.hex.toLowerCase() === value.toLowerCase()}
			<button
				class="swatch"
				class:selected
				style:--swatch-color={swatch.hex}
				title={swatch.name}
				aria-label={swatch.name}
				role="radio"
				aria-checked={selected}
				onclick={() => onChange(swatch.hex)}
			>
				{#if selected}
					<span class="check" aria-hidden="true">✓</span>
				{/if}
			</button>
		{/each}
	</div>
	<label class="custom-swatch" class:selected={!isPreset} title="custom color">
		<input
			type="color"
			{value}
			oninput={(e) => onChange(e.currentTarget.value)}
			aria-label="custom color"
		/>
	</label>
</div>

<style>
	.color-picker {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.swatch,
	.custom-swatch {
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 50%;
		border: none;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
		transition: transform var(--ta-transition-spring), box-shadow var(--ta-transition-fast);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.swatch {
		background: var(--swatch-color);
	}

	.swatch:hover,
	.custom-swatch:hover {
		transform: scale(1.18);
	}

	.swatch:active,
	.custom-swatch:active {
		transform: scale(0.95);
	}

	/* a white-then-dark double ring reads on every swatch color, light or
	   dark, unlike a plain border-color change */
	.swatch.selected,
	.custom-swatch.selected {
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.08),
			0 0 0 2px #fff,
			0 0 0 3.5px var(--ta-text-dim);
	}

	.check {
		color: #fff;
		font-size: 0.72rem;
		line-height: 1;
		text-shadow: 0 0 2px rgba(0, 0, 0, 0.6), 0 1px 1px rgba(0, 0, 0, 0.45);
	}

	.custom-swatch {
		position: relative;
		overflow: hidden;
		background: conic-gradient(from 90deg, #d50000, #f6bf26, #33b679, #039be5, #8e24aa, #d50000);
		display: inline-block;
	}

	.custom-swatch input {
		position: absolute;
		inset: -4px;
		width: calc(100% + 8px);
		height: calc(100% + 8px);
		opacity: 0;
		cursor: pointer;
		border: none;
		padding: 0;
	}
</style>
