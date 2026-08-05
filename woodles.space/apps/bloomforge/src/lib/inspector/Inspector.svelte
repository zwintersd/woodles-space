<script lang="ts">
	import {
		NOTATIONS,
		curveAt,
		describeEffect,
		entityIndex,
		nameLookup,
		num,
		upgradeMaxLevel,
		type Curve,
		type Effect,
		type EffectStat,
		type EntityKind
	} from '@woodles/incremental-core';
	import { currencyById, formatAmount } from '../format.js';
	import EmojiIcon from '../EmojiIcon.svelte';
	import { GLOSSARY } from '../glossary.js';
	import InfoTip from '../InfoTip.svelte';
	import { studio } from '../studio.svelte.js';
	import ConditionEditor from './ConditionEditor.svelte';
	import CurveEditor from './CurveEditor.svelte';
	import CurvePlot from './CurvePlot.svelte';
	import SymbolPicker from './SymbolPicker.svelte';

	const KIND_LABELS: Record<EntityKind, string> = {
		currency: 'Currency',
		generator: 'Generator',
		upgrade: 'Upgrade',
		prestige: 'Prestige Layer',
		unlock: 'Unlock',
		milestone: 'Milestone'
	};

	const selected = $derived(studio.selected);
	const names = $derived(nameLookup(studio.def));
	const issues = $derived(selected ? studio.issuesFor(selected.id) : []);

	const currency = $derived(studio.def.currencies.find((entry) => entry.id === selected?.id));
	const generator = $derived(studio.def.generators.find((entry) => entry.id === selected?.id));
	const upgrade = $derived(studio.def.upgrades.find((entry) => entry.id === selected?.id));
	const layer = $derived(studio.def.prestigeLayers.find((entry) => entry.id === selected?.id));
	const unlock = $derived(studio.def.unlocks.find((entry) => entry.id === selected?.id));
	const milestone = $derived(studio.def.milestones.find((entry) => entry.id === selected?.id));

	function rename(name: string): void {
		if (selected) studio.rename(selected.id, name);
	}

	const STATS: Record<EffectStat, string> = {
		rate: 'Output',
		critChance: 'Crit chance',
		costScale: 'Cost'
	};

	function effectTargets() {
		return [
			{ value: 'global', label: 'Everything' },
			...studio.def.generators.map((entry) => ({ value: `generator:${entry.id}`, label: entry.name })),
			...studio.def.currencies.map((entry) => ({ value: `currency:${entry.id}`, label: `All ${entry.name}` }))
		];
	}

	function targetValue(effect: Effect): string {
		return effect.target.type === 'global' ? 'global' : `${effect.target.type}:${effect.target.id}`;
	}

	function setTarget(index: number, value: string): void {
		const id = upgrade?.id;
		if (!id) return;
		const [type, entityId] = value.split(':');
		studio.edit((def) => {
			const found = def.upgrades.find((entry) => entry.id === id);
			if (!found) return;
			found.effects[index].target =
				type === 'global'
					? { type: 'global' }
					: type === 'generator'
						? { type: 'generator', id: entityId }
						: { type: 'currency', id: entityId };
		});
	}

	function patchEffect(index: number, patch: Partial<Effect>): void {
		const id = upgrade?.id;
		if (!id) return;
		studio.editQuietly((def) => {
			const found = def.upgrades.find((entry) => entry.id === id);
			if (found) Object.assign(found.effects[index], patch);
		});
	}

	function curveValue(curve: Curve, base: number, level: number): number {
		return curveAt(curve, base, level);
	}

	/** Only things a reset can actually wipe: balances, levels, owned upgrades. */
	function resettable() {
		return [...entityIndex(studio.def).values()].filter(
			(ref) => ref.kind === 'currency' || ref.kind === 'generator' || ref.kind === 'upgrade'
		);
	}

	function revealable(selfId: string) {
		return [...entityIndex(studio.def).values()].filter((ref) => ref.kind !== 'unlock' && ref.id !== selfId);
	}
</script>

<aside class="inspector">
	{#if !selected}
		<div class="empty">
			<span><EmojiIcon char="🌸" size={26} /></span>
			<h2>Nothing selected</h2>
			<p>Pick a node on the canvas, or add one from the Systems list, to edit it here.</p>
		</div>
	{:else}
		{@const kind = selected.kind}
		<header>
			<div class="title">
				<h2>{names(selected.id)}</h2>
				<span class="kind" data-kind={kind}>{KIND_LABELS[kind]}</span>
			</div>
			<div class="tools">
				<button class="icon" type="button" onclick={() => studio.duplicate(selected.id)} title="Duplicate">⧉</button>
				<button class="icon danger" type="button" onclick={() => studio.remove(selected.id)} title="Delete">
					<EmojiIcon char="🗑" size={13} label="Delete" />
				</button>
			</div>
		</header>

		{#if issues.length}
			<ul class="issues">
				{#each issues as issue (issue.path + issue.message)}
					<li data-severity={issue.severity}>{issue.message}</li>
				{/each}
			</ul>
		{/if}

		<div class="body">
			<div class="bf-field">
				<label for="bf-name">Display Name</label>
				<input id="bf-name" class="bf-input" value={names(selected.id)} oninput={(e) => rename(e.currentTarget.value)} />
			</div>

			{#if currency}
				<div class="bf-field">
					<label for="bf-symbol">Symbol</label>
					<SymbolPicker
						id="bf-symbol"
						value={currency.symbol ?? ''}
						onselect={(char) => studio.editQuietly(() => (currency.symbol = char))}
					/>
				</div>

				<div class="bf-field">
					<label for="bf-colour">Color</label>
					<div class="colour">
						<input
							id="bf-colour"
							type="color"
							value={currency.color}
							oninput={(e) => studio.editQuietly(() => (currency.color = e.currentTarget.value))}
						/>
						<input
							class="bf-input"
							value={currency.color}
							oninput={(e) => studio.editQuietly(() => (currency.color = e.currentTarget.value))}
						/>
					</div>
				</div>

				<div class="bf-field">
					<label for="bf-places">Decimal Places</label>
					<input
						id="bf-places"
						class="bf-input"
						type="number"
						min="0"
						max="8"
						value={currency.format.decimalPlaces}
						oninput={(e) => studio.editQuietly(() => (currency.format.decimalPlaces = Number(e.currentTarget.value)))}
					/>
				</div>

				<div class="bf-field">
					<span class="bf-field-label">
						<label for="bf-notation">Notation</label>
						<InfoTip text={GLOSSARY.notation} />
					</span>
					<select
						id="bf-notation"
						class="bf-select"
						value={currency.format.notation}
						onchange={(e) =>
							studio.edit(() => (currency.format.notation = e.currentTarget.value as typeof currency.format.notation))}
					>
						{#each NOTATIONS as notation (notation)}
							<option value={notation}>{notation}</option>
						{/each}
					</select>
				</div>

				<div class="bf-field">
					<span class="bf-label">Formatting</span>
					<!-- Shows the same number four ways at once: the point of the
					     preview is choosing between notations, not confirming one. -->
					<div class="preview">{num.format(1234.56, currency.format)}</div>
					<div class="preview subtle">{num.format(1_234_567.89, currency.format)}</div>
				</div>

				<hr />

				<div class="bf-field">
					<div class="repeatable-row">
						<label class="inline" for="bf-spend-tax">
							<input
								id="bf-spend-tax"
								type="checkbox"
								checked={!!currency.spendTax}
								onchange={(e) =>
									studio.edit(() => {
										if (e.currentTarget.checked) {
											const other = studio.def.currencies.find((entry) => entry.id !== currency.id);
											currency.spendTax = { intoCurrencyId: other?.id ?? currency.id, rate: 0.25 };
										} else {
											delete currency.spendTax;
										}
									})}
							/>
							Taxes when spent
						</label>
						<InfoTip text={GLOSSARY.spendTax} />
					</div>
				</div>

				{#if currency.spendTax}
					{@const tax = currency.spendTax}
					<div class="bf-field">
						<label for="bf-tax-target">Feeds</label>
						<select
							id="bf-tax-target"
							class="bf-select"
							value={tax.intoCurrencyId}
							onchange={(e) => studio.edit(() => (tax.intoCurrencyId = e.currentTarget.value))}
						>
							{#each studio.def.currencies.filter((entry) => entry.id !== currency.id) as entry (entry.id)}
								<option value={entry.id}>{entry.name}</option>
							{/each}
						</select>
					</div>

					<div class="bf-field">
						<span class="bf-field-label">
							<label for="bf-tax-rate">Rate</label>
							<InfoTip text={GLOSSARY.spendTaxRate} />
						</span>
						<input
							id="bf-tax-rate"
							class="bf-input"
							type="number"
							step="0.01"
							min="0"
							value={tax.rate}
							oninput={(e) => studio.editQuietly(() => (tax.rate = Number(e.currentTarget.value)))}
						/>
					</div>

					<p class="hint">
						Spending 100 {currency.name} would mint {(tax.rate * 100).toFixed(2)}
						{currencyById(studio.def, tax.intoCurrencyId)?.name ?? tax.intoCurrencyId}, the instant it's spent.
					</p>
				{/if}
			{/if}

			{#if generator}
				{@const produces = currencyById(studio.def, generator.producesCurrencyId)}
				{@const priced = currencyById(studio.def, generator.cost.currencyId)}

				<div class="bf-field">
					<label for="bf-produces">Produces</label>
					<select
						id="bf-produces"
						class="bf-select"
						value={generator.producesCurrencyId}
						onchange={(e) => studio.edit(() => (generator.producesCurrencyId = e.currentTarget.value))}
					>
						{#each studio.def.currencies as entry (entry.id)}
							<option value={entry.id}>{entry.name}</option>
						{/each}
					</select>
				</div>

				<div class="bf-field">
					<label for="bf-rate">Base Gain (at level 1)</label>
					<input
						id="bf-rate"
						class="bf-input"
						type="number"
						step="any"
						min="0"
						value={generator.baseRate}
						oninput={(e) => studio.editQuietly(() => (generator.baseRate = Number(e.currentTarget.value)))}
					/>
				</div>

				<div class="bf-field">
					<label for="bf-owned">Starts Owned</label>
					<input
						id="bf-owned"
						class="bf-input"
						type="number"
						min="0"
						step="1"
						value={generator.startsOwned ?? 0}
						oninput={(e) => studio.editQuietly(() => (generator.startsOwned = Number(e.currentTarget.value)))}
					/>
				</div>

				<hr />

				<div class="bf-field">
					<label for="bf-cost-currency">Bought With</label>
					<select
						id="bf-cost-currency"
						class="bf-select"
						value={generator.cost.currencyId}
						onchange={(e) => studio.edit(() => (generator.cost.currencyId = e.currentTarget.value))}
					>
						{#each studio.def.currencies as entry (entry.id)}
							<option value={entry.id}>{entry.name}</option>
						{/each}
					</select>
				</div>

				<div class="bf-field">
					<label for="bf-cost-base">First Level Costs</label>
					<input
						id="bf-cost-base"
						class="bf-input"
						type="number"
						step="any"
						min="0"
						value={generator.cost.base}
						oninput={(e) => studio.editQuietly(() => (generator.cost.base = Number(e.currentTarget.value)))}
					/>
				</div>

				<CurveEditor
					label="Cost curve"
					help={GLOSSARY.costCurve}
					curve={generator.cost.curve}
					onchange={(curve) => studio.edit(() => (generator.cost.curve = curve))}
				/>
				<CurveEditor
					label="Output curve"
					help={GLOSSARY.outputCurve}
					curve={generator.rateCurve}
					onchange={(curve) => studio.edit(() => (generator.rateCurve = curve))}
				/>

				<CurvePlot
					series={[
						{ label: 'cost', colour: 'var(--bf-currency)', base: generator.cost.base, curve: generator.cost.curve },
						{ label: 'output', colour: 'var(--bf-generator)', base: generator.baseRate, curve: generator.rateCurve }
					]}
				/>

				<p class="hint">
					At level 50 this costs {formatAmount(
						curveValue(generator.cost.curve, generator.cost.base, 50),
						priced
					)} and makes {formatAmount(curveValue(generator.rateCurve, generator.baseRate, 50), produces)} / sec.
				</p>

				<hr />

				<div class="bf-field">
					<div class="repeatable-row">
						<label class="inline" for="bf-population">
							<input
								id="bf-population"
								type="checkbox"
								checked={!!generator.populationBoost}
								onchange={(e) =>
									studio.edit(() => {
										if (e.currentTarget.checked) {
											generator.populationBoost = { metric: 'unequippedUpgrades', perUnit: 0.1 };
										} else {
											delete generator.populationBoost;
										}
									})}
							/>
							Boosted by a live count
						</label>
						<InfoTip text={GLOSSARY.populationBoost} />
					</div>
				</div>

				{#if generator.populationBoost}
					{@const boost = generator.populationBoost}
					<p class="hint">Counts owned upgrades the player has left unequipped, across the whole game.</p>

					<div class="bf-field">
						<span class="bf-field-label">
							<label for="bf-population-perunit">Multiplier Per Unit</label>
							<InfoTip text={GLOSSARY.populationPerUnit} />
						</span>
						<input
							id="bf-population-perunit"
							class="bf-input"
							type="number"
							step="0.01"
							min="0"
							value={boost.perUnit}
							oninput={(e) => studio.editQuietly(() => (boost.perUnit = Number(e.currentTarget.value)))}
						/>
					</div>

					<p class="hint">At 5 unequipped upgrades this reads ×{(1 + boost.perUnit * 5).toFixed(2)}.</p>
				{/if}

				<div class="bf-field">
					<div class="repeatable-row">
						<label class="inline" for="bf-converts">
							<input
								id="bf-converts"
								type="checkbox"
								checked={!!generator.converts}
								onchange={(e) =>
									studio.edit(() => {
										if (e.currentTarget.checked) {
											const input = studio.def.currencies.find((entry) => entry.id !== generator.producesCurrencyId);
											generator.converts = { fromCurrencyId: input?.id ?? generator.producesCurrencyId, ratio: 1 };
										} else {
											delete generator.converts;
										}
									})}
							/>
							Converts a currency
						</label>
						<InfoTip text={GLOSSARY.converts} />
					</div>
				</div>

				{#if generator.converts}
					{@const conversion = generator.converts}
					<div class="bf-field">
						<label for="bf-converts-from">Consumes</label>
						<select
							id="bf-converts-from"
							class="bf-select"
							value={conversion.fromCurrencyId}
							onchange={(e) => studio.edit(() => (conversion.fromCurrencyId = e.currentTarget.value))}
						>
							{#each studio.def.currencies as entry (entry.id)}
								<option value={entry.id}>{entry.name}</option>
							{/each}
						</select>
					</div>

					<div class="bf-field">
						<span class="bf-field-label">
							<label for="bf-converts-ratio">Ratio</label>
							<InfoTip text={GLOSSARY.convertsRatio} />
						</span>
						<input
							id="bf-converts-ratio"
							class="bf-input"
							type="number"
							step="0.1"
							min="0.01"
							value={conversion.ratio}
							oninput={(e) => studio.editQuietly(() => (conversion.ratio = Number(e.currentTarget.value)))}
						/>
					</div>

					<p class="hint">
						{formatAmount(conversion.ratio, currencyById(studio.def, conversion.fromCurrencyId))} consumed per unit of {produces?.name ??
							'output'} made — throttled to whatever's actually on hand, never more than the curve above allows, only ever less.
					</p>
				{/if}
			{/if}

			{#if upgrade}
				<div class="bf-field">
					<label for="bf-desc">Description</label>
					<textarea
						id="bf-desc"
						class="bf-input"
						rows="2"
						value={upgrade.description ?? ''}
						oninput={(e) => studio.editQuietly(() => (upgrade.description = e.currentTarget.value))}
					></textarea>
				</div>

				<div class="bf-field">
					<label for="bf-up-currency">Bought With</label>
					<select
						id="bf-up-currency"
						class="bf-select"
						value={upgrade.cost.currencyId}
						onchange={(e) => studio.edit(() => (upgrade.cost.currencyId = e.currentTarget.value))}
					>
						{#each studio.def.currencies as entry (entry.id)}
							<option value={entry.id}>{entry.name}</option>
						{/each}
					</select>
				</div>

				<div class="bf-field">
					<label for="bf-up-cost">Cost</label>
					<input
						id="bf-up-cost"
						class="bf-input"
						type="number"
						step="any"
						min="0"
						value={upgrade.cost.amount}
						oninput={(e) => studio.editQuietly(() => (upgrade.cost.amount = Number(e.currentTarget.value)))}
					/>
				</div>

				<div class="bf-field">
					<div class="repeatable-row">
						<label class="inline" for="bf-repeat">
							<input
								id="bf-repeat"
								type="checkbox"
								checked={!!upgrade.repeatable}
								onchange={(e) =>
									studio.edit(() => {
										if (e.currentTarget.checked) {
											upgrade.repeatable = { maxLevel: 10, costCurve: { kind: 'geometric', growth: 2 } };
										} else {
											delete upgrade.repeatable;
										}
									})}
							/>
							Repeatable
						</label>
						<InfoTip text={GLOSSARY.repeatable} />
					</div>
				</div>

				{#if upgrade.repeatable}
					{@const repeatable = upgrade.repeatable}
					<div class="bf-field">
						<label for="bf-max">Max Level</label>
						<input
							id="bf-max"
							class="bf-input"
							type="number"
							min="1"
							step="1"
							value={repeatable.maxLevel}
							oninput={(e) => studio.editQuietly(() => (repeatable.maxLevel = Number(e.currentTarget.value)))}
						/>
					</div>
					<CurveEditor
						label="Cost curve"
						help={GLOSSARY.costCurve}
						curve={repeatable.costCurve}
						onchange={(curve) => studio.edit(() => (repeatable.costCurve = curve))}
					/>
					<CurvePlot
						series={[
							{ label: 'cost', colour: 'var(--bf-currency)', base: upgrade.cost.amount, curve: repeatable.costCurve }
						]}
						levels={Math.max(2, repeatable.maxLevel)}
					/>
				{/if}

				<hr />

				<div class="section-head">
					<span class="bf-field-label">
						<span class="bf-label">Effects ({upgrade.effects.length})</span>
						<InfoTip text={GLOSSARY.effectTarget} />
					</span>
					<button
						class="bf-button tiny"
						type="button"
						onclick={() =>
							studio.edit(() =>
								upgrade.effects.push({
									target: studio.def.generators[0]
										? { type: 'generator', id: studio.def.generators[0].id }
										: { type: 'global' },
									stat: 'rate',
									op: 'mul',
									value: 2
								})
							)}
					>
						+ Effect
					</button>
				</div>

				{#each upgrade.effects as effect, index (index)}
					<div class="effect">
						<p class="effect-summary">{describeEffect(effect, names)}</p>
						<div class="effect-grid">
							<select class="bf-select" value={targetValue(effect)} onchange={(e) => setTarget(index, e.currentTarget.value)}>
								{#each effectTargets() as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
							<select
								class="bf-select"
								value={effect.stat}
								onchange={(e) => patchEffect(index, { stat: e.currentTarget.value as EffectStat })}
							>
								{#each Object.entries(STATS) as [value, label] (value)}
									<option {value}>{label}</option>
								{/each}
							</select>
							<select
								class="bf-select"
								value={effect.op}
								onchange={(e) => patchEffect(index, { op: e.currentTarget.value as 'add' | 'mul' })}
							>
								<option value="mul">×</option>
								<option value="add">+</option>
							</select>
							<input
								class="bf-input"
								type="number"
								step="any"
								value={effect.value}
								oninput={(e) => patchEffect(index, { value: Number(e.currentTarget.value) })}
							/>
							<button
								class="drop"
								type="button"
								aria-label="Remove effect"
								onclick={() => studio.edit(() => upgrade.effects.splice(index, 1))}>×</button
							>
						</div>
					</div>
				{/each}

				<p class="hint">
					Applied once per owned level — at level {upgradeMaxLevel(upgrade)} a ×2 becomes ×{Math.pow(
						2,
						upgradeMaxLevel(upgrade)
					).toLocaleString()}.
				</p>

				{#if upgrade.purchasableWhen}
					<hr />
					<span class="bf-field-label">
						<span class="bf-label">Requires</span>
						<InfoTip text={GLOSSARY.requires} />
					</span>
					<ConditionEditor
						def={studio.def}
						condition={upgrade.purchasableWhen}
						onchange={(condition) => studio.editQuietly(() => (upgrade.purchasableWhen = condition))}
					/>
					<button
						class="bf-button tiny"
						type="button"
						onclick={() => studio.edit(() => delete upgrade.purchasableWhen)}>Remove requirement</button
					>
				{:else}
					<button
						class="bf-button tiny"
						type="button"
						onclick={() =>
							studio.edit(() => {
								const other = studio.def.upgrades.find((entry) => entry.id !== upgrade.id);
								upgrade.purchasableWhen = other
									? { metric: 'upgradeOwned', upgradeId: other.id, level: 1 }
									: { metric: 'currencyLifetime', currencyId: upgrade.cost.currencyId, op: '>=', value: 1000 };
							})}>+ Requirement</button
					>
				{/if}
			{/if}

			{#if layer}
				<div class="bf-field">
					<label for="bf-award">Awards</label>
					<select
						id="bf-award"
						class="bf-select"
						value={layer.currencyId}
						onchange={(e) => studio.edit(() => (layer.currencyId = e.currentTarget.value))}
					>
						{#each studio.def.currencies as entry (entry.id)}
							<option value={entry.id}>{entry.name}</option>
						{/each}
					</select>
				</div>

				<div class="bf-field">
					<label for="bf-source">Measured On (lifetime)</label>
					<select
						id="bf-source"
						class="bf-select"
						value={layer.gainFormula.sourceCurrencyId}
						onchange={(e) => studio.edit(() => (layer.gainFormula.sourceCurrencyId = e.currentTarget.value))}
					>
						{#each studio.def.currencies as entry (entry.id)}
							<option value={entry.id}>{entry.name}</option>
						{/each}
					</select>
				</div>

				<div class="bf-field">
					<span class="bf-field-label">
						<label for="bf-threshold">Threshold</label>
						<InfoTip text={GLOSSARY.threshold} />
					</span>
					<input
						id="bf-threshold"
						class="bf-input"
						type="number"
						step="any"
						min="1"
						value={layer.gainFormula.threshold}
						oninput={(e) => studio.editQuietly(() => (layer.gainFormula.threshold = Number(e.currentTarget.value)))}
					/>
				</div>

				<div class="bf-field">
					<span class="bf-field-label">
						<label for="bf-exponent">Exponent</label>
						<InfoTip text={GLOSSARY.exponent} />
					</span>
					<input
						id="bf-exponent"
						class="bf-input"
						type="number"
						step="0.05"
						min="0.05"
						value={layer.gainFormula.exponent}
						oninput={(e) => studio.editQuietly(() => (layer.gainFormula.exponent = Number(e.currentTarget.value)))}
					/>
				</div>

				<div class="bf-field">
					<span class="bf-field-label">
						<label for="bf-per-unit">Multiplier Per Unit</label>
						<InfoTip text={GLOSSARY.multiplierPerUnit} />
					</span>
					<input
						id="bf-per-unit"
						class="bf-input"
						type="number"
						step="0.001"
						min="0"
						value={layer.multiplier.perUnit}
						oninput={(e) => studio.editQuietly(() => (layer.multiplier.perUnit = Number(e.currentTarget.value)))}
					/>
				</div>

				<p class="hint">
					100 units would give ×{(1 + layer.multiplier.perUnit * 100).toFixed(2)} to all production.
				</p>

				<hr />

				<span class="bf-field-label">
					<span class="bf-label">Resets ({layer.resets.length})</span>
					<InfoTip text={GLOSSARY.resets} />
				</span>
				<ul class="checks">
					{#each resettable() as ref (ref.id)}
						<li>
							<label class="inline">
								<input
									type="checkbox"
									checked={layer.resets.includes(ref.id)}
									onchange={(e) =>
										studio.edit(() => {
											layer.resets = e.currentTarget.checked
												? [...layer.resets, ref.id]
												: layer.resets.filter((entry) => entry !== ref.id);
										})}
								/>
								{ref.name}
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			{#if unlock}
				<span class="bf-field-label">
					<span class="bf-label">Reveals ({unlock.reveals.length})</span>
					<InfoTip text={GLOSSARY.reveals} />
				</span>
				<ul class="checks">
					{#each revealable(unlock.id) as ref (ref.id)}
						<li>
							<label class="inline">
								<input
									type="checkbox"
									checked={unlock.reveals.includes(ref.id)}
									onchange={(e) =>
										studio.edit(() => {
											unlock.reveals = e.currentTarget.checked
												? [...unlock.reveals, ref.id]
												: unlock.reveals.filter((entry) => entry !== ref.id);
										})}
								/>
								{ref.name}
							</label>
						</li>
					{/each}
				</ul>

				<hr />
				<span class="bf-field-label">
					<span class="bf-label">Opens when</span>
					<InfoTip text={GLOSSARY.opensWhen} />
				</span>
				<ConditionEditor
					def={studio.def}
					condition={unlock.when}
					onchange={(condition) => studio.editQuietly(() => (unlock.when = condition))}
				/>
			{/if}

			{#if milestone}
				<span class="bf-field-label">
					<span class="bf-label">Reached when</span>
					<InfoTip text={GLOSSARY.reachedWhen} />
				</span>
				<ConditionEditor
					def={studio.def}
					condition={milestone.when}
					onchange={(condition) => studio.editQuietly(() => (milestone.when = condition))}
				/>
				<p class="hint">
					Milestones have no mechanical effect — they are the named posts a balance run measures time against.
				</p>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-left: 1px solid var(--bf-rule);
		background: var(--bf-surface);
	}

	header {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 14px 14px 10px;
		border-bottom: 1px solid var(--bf-rule);
	}

	.title {
		flex: 1;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 650;
		overflow-wrap: anywhere;
	}

	.kind {
		display: inline-block;
		margin-top: 3px;
		padding: 1px 8px;
		border-radius: var(--bf-radius-pill);
		font-size: 10px;
		font-weight: 600;
		background: var(--bf-accent-soft);
		color: var(--bf-accent);
	}

	.kind[data-kind='currency'] {
		background: var(--bf-currency-soft);
		color: var(--bf-currency);
	}
	.kind[data-kind='generator'] {
		background: var(--bf-generator-soft);
		color: var(--bf-generator);
	}
	.kind[data-kind='prestige'] {
		background: var(--bf-prestige-soft);
		color: var(--bf-prestige);
	}
	.kind[data-kind='unlock'] {
		background: var(--bf-unlock-soft);
		color: var(--bf-unlock);
	}
	.kind[data-kind='milestone'] {
		background: var(--bf-milestone-soft);
		color: var(--bf-milestone);
	}

	.tools {
		display: flex;
		gap: 3px;
	}

	.icon {
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: var(--bf-radius-sm);
		background: none;
		color: var(--bf-muted);
		font-size: 13px;
		cursor: pointer;
	}

	.icon:hover {
		background: var(--bf-surface-sunk);
		border-color: var(--bf-rule-strong);
	}

	.icon.danger:hover {
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
	}

	.issues {
		margin: 0;
		padding: 10px 14px;
		list-style: none;
		display: grid;
		gap: 5px;
		border-bottom: 1px solid var(--bf-rule);
	}

	.issues li {
		padding: 5px 9px;
		border-radius: var(--bf-radius-sm);
		font-size: 11px;
		line-height: 1.4;
	}

	.issues li[data-severity='error'] {
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
	}

	.issues li[data-severity='warning'] {
		background: var(--bf-warn-soft);
		color: var(--bf-warn);
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 14px;
	}

	hr {
		border: 0;
		border-top: 1px solid var(--bf-rule);
		margin: 14px 0;
	}

	.colour {
		display: grid;
		grid-template-columns: 34px 1fr;
		gap: 6px;
	}

	.colour input[type='color'] {
		width: 34px;
		height: 32px;
		padding: 2px;
		border: 1px solid var(--bf-rule-strong);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface);
		cursor: pointer;
	}

	.preview {
		padding: 7px 10px;
		border-radius: var(--bf-radius-sm);
		background: var(--bf-accent-soft);
		color: var(--bf-accent-strong);
		font-family: var(--bf-font-mono);
		font-size: 13px;
	}

	.preview.subtle {
		margin-top: 4px;
		background: var(--bf-surface-sunk);
		color: var(--bf-muted);
		font-size: 11px;
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 12.5px;
		color: var(--bf-ink-soft);
		text-transform: none;
		letter-spacing: 0;
		font-weight: 500;
	}

	.repeatable-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
	}

	.tiny {
		font-size: 11px;
		padding: 3px 9px;
	}

	.effect {
		margin-bottom: 9px;
		padding: 9px;
		border: 1px solid var(--bf-rule);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface-sunk);
	}

	.effect-summary {
		margin: 0 0 7px;
		font-size: 11px;
		color: var(--bf-upgrade);
		font-weight: 600;
	}

	.effect-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 5px;
	}

	.effect-grid select:first-child {
		grid-column: 1 / -1;
	}

	.drop {
		border: 0;
		border-radius: var(--bf-radius-sm);
		background: none;
		color: var(--bf-faint);
		font-size: 15px;
		cursor: pointer;
	}

	.drop:hover {
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
	}

	.checks {
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 3px;
		max-height: 190px;
		overflow-y: auto;
	}

	.hint {
		margin: 8px 0 0;
		padding: 8px 10px;
		border-radius: var(--bf-radius-sm);
		background: var(--bf-surface-sunk);
		font-size: 11px;
		line-height: 1.45;
		color: var(--bf-muted);
	}

	.empty {
		margin: auto;
		padding: 30px 24px;
		text-align: center;
		color: var(--bf-muted);
	}

	.empty span {
		display: inline-flex;
	}

	.empty h2 {
		margin: 10px 0 5px;
		font-family: var(--bf-font-display);
		font-size: 17px;
		color: var(--bf-ink-soft);
	}

	.empty p {
		margin: 0;
		font-size: 12px;
		line-height: 1.5;
	}
</style>
