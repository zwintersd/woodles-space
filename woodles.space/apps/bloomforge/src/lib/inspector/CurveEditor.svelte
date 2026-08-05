<script lang="ts">
	import { CURVE_KINDS, defaultCurve, describeCurve, type Curve, type CurveKind } from '@woodles/incremental-core';
	import InfoTip from '../InfoTip.svelte';

	/**
	 * Picks a curve kind and its parameters. Switching kind swaps in that kind's
	 * default rather than trying to translate parameters between shapes — a
	 * "growth" and an "exponent" mean different things, and a silent
	 * mistranslation is worse than an obvious reset. Because every kind
	 * evaluates to the base at level 1, the entity's starting behaviour survives
	 * the switch either way.
	 */
	interface Props {
		label: string;
		curve: Curve;
		onchange: (curve: Curve) => void;
		help?: string;
	}

	let { label, curve, onchange, help }: Props = $props();

	const KIND_LABELS: Record<CurveKind, string> = {
		geometric: 'Geometric',
		linear: 'Linear',
		polynomial: 'Polynomial',
		steps: 'Steps'
	};

	function setKind(kind: CurveKind): void {
		if (kind === curve.kind) return;
		onchange(defaultCurve(kind));
	}

	function addBreakpoint(): void {
		if (curve.kind !== 'steps') return;
		const last = curve.breakpoints.at(-1);
		onchange({
			kind: 'steps',
			breakpoints: [...curve.breakpoints, { level: (last?.level ?? 0) + 25, multiplier: 2 }]
		});
	}

	function editBreakpoint(index: number, patch: { level?: number; multiplier?: number }): void {
		if (curve.kind !== 'steps') return;
		onchange({
			kind: 'steps',
			breakpoints: curve.breakpoints.map((breakpoint, i) => (i === index ? { ...breakpoint, ...patch } : breakpoint))
		});
	}

	function removeBreakpoint(index: number): void {
		if (curve.kind !== 'steps') return;
		onchange({ kind: 'steps', breakpoints: curve.breakpoints.filter((_, i) => i !== index) });
	}
</script>

<div class="curve">
	<div class="head">
		<span class="label-row">
			<span class="bf-label">{label}</span>
			{#if help}<InfoTip text={help} />{/if}
		</span>
		<span class="summary">{describeCurve(curve)}</span>
	</div>

	<div class="kinds" role="group" aria-label="{label} shape">
		{#each CURVE_KINDS as kind (kind)}
			<button type="button" class="kind" aria-pressed={curve.kind === kind} onclick={() => setKind(kind)}>
				{KIND_LABELS[kind]}
			</button>
		{/each}
	</div>

	{#if curve.kind === 'geometric'}
		<label class="param">
			<span>Growth per level</span>
			<input
				class="bf-input"
				type="number"
				step="0.01"
				min="0.01"
				value={curve.growth}
				oninput={(event) => onchange({ kind: 'geometric', growth: Number(event.currentTarget.value) })}
			/>
		</label>
	{:else if curve.kind === 'linear'}
		<label class="param">
			<span>Added per level</span>
			<input
				class="bf-input"
				type="number"
				step="any"
				value={curve.slope}
				oninput={(event) => onchange({ kind: 'linear', slope: Number(event.currentTarget.value) })}
			/>
		</label>
	{:else if curve.kind === 'polynomial'}
		<label class="param">
			<span>Exponent</span>
			<input
				class="bf-input"
				type="number"
				step="0.1"
				value={curve.exponent}
				oninput={(event) => onchange({ kind: 'polynomial', exponent: Number(event.currentTarget.value) })}
			/>
		</label>
	{:else}
		<div class="steps">
			{#each curve.breakpoints as breakpoint, index (index)}
				<div class="step">
					<label>
						<span class="sr-only">Breakpoint level</span>
						<input
							class="bf-input"
							type="number"
							min="1"
							step="1"
							value={breakpoint.level}
							oninput={(event) => editBreakpoint(index, { level: Number(event.currentTarget.value) })}
						/>
					</label>
					<span class="times">×</span>
					<label>
						<span class="sr-only">Breakpoint multiplier</span>
						<input
							class="bf-input"
							type="number"
							min="0.01"
							step="0.1"
							value={breakpoint.multiplier}
							oninput={(event) => editBreakpoint(index, { multiplier: Number(event.currentTarget.value) })}
						/>
					</label>
					<button type="button" class="drop" onclick={() => removeBreakpoint(index)} aria-label="Remove breakpoint">
						×
					</button>
				</div>
			{/each}
			<button type="button" class="bf-button add" onclick={addBreakpoint}>+ Breakpoint</button>
		</div>
	{/if}
</div>

<style>
	.curve {
		margin-bottom: 12px;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 5px;
	}

	.label-row {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.summary {
		font-size: 10.5px;
		color: var(--bf-faint);
		font-family: var(--bf-font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kinds {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 3px;
		padding: 3px;
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface-sunk);
		margin-bottom: 8px;
	}

	.kind {
		padding: 4px 2px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--bf-muted);
		font-size: 10.5px;
		cursor: pointer;
	}

	.kind[aria-pressed='true'] {
		background: var(--bf-surface);
		color: var(--bf-accent-strong);
		font-weight: 650;
		box-shadow: var(--bf-shadow-soft);
	}

	.param {
		display: grid;
		gap: 4px;
	}

	.param span {
		font-size: 11px;
		color: var(--bf-muted);
	}

	.steps {
		display: grid;
		gap: 5px;
	}

	.step {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto;
		align-items: center;
		gap: 5px;
	}

	.times {
		color: var(--bf-faint);
		font-size: 11px;
	}

	.drop {
		width: 22px;
		height: 22px;
		border: 0;
		border-radius: var(--bf-radius-sm);
		background: none;
		color: var(--bf-faint);
		font-size: 15px;
		line-height: 1;
		cursor: pointer;
	}

	.drop:hover {
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
	}

	.add {
		justify-self: start;
		font-size: 11px;
		padding: 4px 10px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
