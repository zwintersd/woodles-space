<script lang="ts">
	import { entityIndex, type Condition, type GameDef } from '@woodles/incremental-core';

	/**
	 * A form for a structured predicate. This is the payoff for not shipping an
	 * expression language: "when lifetime Soft Petals reaches 1,000,000" is a
	 * dropdown and a number, and it can't be mistyped into something that parses
	 * but means the wrong thing.
	 *
	 * Groups (`all` / `any`) render read-only for now — nesting arbitrary trees
	 * in a 300px panel needs a real design, and an author who wants one can nest
	 * by hand in the exported JSON.
	 */
	interface Props {
		def: GameDef;
		condition: Condition;
		onchange: (condition: Condition) => void;
	}

	let { def, condition, onchange }: Props = $props();

	type SimpleMetric =
		| 'currencyAmount'
		| 'currencyLifetime'
		| 'generatorLevel'
		| 'upgradeOwned'
		| 'prestigeCount'
		| 'unequippedUpgrades';

	const METRIC_LABELS: Record<SimpleMetric, string> = {
		currencyAmount: 'Currency held',
		currencyLifetime: 'Currency earned (lifetime)',
		generatorLevel: 'Generator level',
		upgradeOwned: 'Upgrade level',
		prestigeCount: 'Prestige count',
		unequippedUpgrades: 'Upgrades left unequipped'
	};

	const isGroup = $derived('all' in condition || 'any' in condition);
	const metric = $derived(isGroup ? null : ((condition as { metric: SimpleMetric }).metric ?? null));

	const options = $derived.by(() => {
		const refs = [...entityIndex(def).values()];
		return {
			currency: refs.filter((ref) => ref.kind === 'currency'),
			generator: refs.filter((ref) => ref.kind === 'generator'),
			upgrade: refs.filter((ref) => ref.kind === 'upgrade'),
			prestige: refs.filter((ref) => ref.kind === 'prestige')
		};
	});

	/** The subject id whichever metric is selected refers to. */
	const subjectId = $derived.by(() => {
		if (isGroup) return '';
		const c = condition as Partial<Record<'currencyId' | 'generatorId' | 'upgradeId' | 'layerId', string>>;
		return c.currencyId ?? c.generatorId ?? c.upgradeId ?? c.layerId ?? '';
	});

	const threshold = $derived.by(() => {
		if (isGroup) return 0;
		const c = condition as { value?: number; level?: number; metric: SimpleMetric };
		return c.metric === 'upgradeOwned' ? (c.level ?? 1) : (c.value ?? 0);
	});

	function subjectsFor(next: SimpleMetric) {
		if (next === 'generatorLevel') return options.generator;
		if (next === 'upgradeOwned') return options.upgrade;
		if (next === 'prestigeCount') return options.prestige;
		if (next === 'unequippedUpgrades') return [];
		return options.currency;
	}

	function build(next: SimpleMetric, id: string, value: number): Condition {
		switch (next) {
			case 'generatorLevel':
				return { metric: 'generatorLevel', generatorId: id, op: '>=', value };
			case 'upgradeOwned':
				return { metric: 'upgradeOwned', upgradeId: id, level: Math.max(1, Math.round(value)) };
			case 'prestigeCount':
				return { metric: 'prestigeCount', layerId: id, op: '>=', value };
			case 'unequippedUpgrades':
				// A def-wide count, not a reference to any one entity.
				return { metric: 'unequippedUpgrades', op: '>=', value };
			default:
				return { metric: next, currencyId: id, op: '>=', value };
		}
	}

	function changeMetric(next: SimpleMetric): void {
		const candidates = subjectsFor(next);
		const keep = candidates.some((ref) => ref.id === subjectId) ? subjectId : (candidates[0]?.id ?? '');
		onchange(build(next, keep, threshold));
	}
</script>

{#if isGroup}
	<p class="grouped">
		A combined condition ({'all' in condition ? 'all of' : 'any of'}). Edit it in the exported JSON — the panel handles
		single conditions.
	</p>
{:else if metric}
	<div class="rows">
		<label class="row">
			<span class="bf-label">Measure</span>
			<select
				class="bf-select"
				value={metric}
				onchange={(event) => changeMetric(event.currentTarget.value as SimpleMetric)}
			>
				{#each Object.entries(METRIC_LABELS) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</label>

		{#if subjectsFor(metric).length}
			<label class="row">
				<span class="bf-label">Of</span>
				<select
					class="bf-select"
					value={subjectId}
					onchange={(event) => onchange(build(metric, event.currentTarget.value, threshold))}
				>
					{#each subjectsFor(metric) as ref (ref.id)}
						<option value={ref.id}>{ref.name}</option>
					{/each}
				</select>
			</label>
		{/if}

		<label class="row">
			<span class="bf-label">{metric === 'upgradeOwned' ? 'At level' : 'Reaches'}</span>
			<input
				class="bf-input"
				type="number"
				step="any"
				min={metric === 'upgradeOwned' ? 1 : undefined}
				value={threshold}
				oninput={(event) => onchange(build(metric, subjectId, Number(event.currentTarget.value)))}
			/>
		</label>
	</div>
{/if}

<style>
	.rows {
		display: grid;
		gap: 8px;
	}

	.row {
		display: grid;
		gap: 4px;
	}

	.grouped {
		margin: 0;
		padding: 8px 10px;
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface-sunk);
		font-size: 11px;
		color: var(--bf-muted);
		line-height: 1.45;
	}
</style>
