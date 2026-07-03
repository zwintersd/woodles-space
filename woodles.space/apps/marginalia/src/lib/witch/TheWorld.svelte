<script lang="ts">
	import { book, fmt, stageLabel, STAGE_KNOWN, humanizeSeconds } from './book.svelte';
	import {
		STAGE_INSIGHT_MULT,
		DISTILL_INSIGHT_COST,
		DISTILL_ESSENCE_GAIN,
		LOOK_CLOSER_SECONDS,
		CATEGORY_MASTERY_BONUS
	} from './tuning';
	import { domainVerb, type Life, type LifeCategory } from './content/life';
	import MiniHex from './MiniHex.svelte';
	import NewWorldspaceUnlock from './NewWorldspaceUnlock.svelte';
	import WorldCanvas from './WorldCanvas.svelte';
	import FieldNotes from './FieldNotes.svelte';
	import WorldShapingDetails from './WorldShapingDetails.svelte';
	import { FEATURE_SPECS, SEDIMENT_UNLOCK_COVERAGE, type WorldFeatureId } from './worldShape';

	const categories: { id: LifeCategory; label: string }[] = [
		{ id: 'aquatic', label: 'in the water' },
		{ id: 'terrestrial', label: 'on the land' },
		{ id: 'atmospheric', label: 'in the sky' }
	];

	const nextStageName = (stage: number) => stageLabel[Math.min(stage + 1, STAGE_KNOWN)];

	// tend → tended, guide → guided, shape → shaped, invoke → invoked …
	const pastVerb = (v: string) => (v.endsWith('e') ? `${v}d` : `${v}ed`);

	// effective insight/sec this life is currently contributing
	function yields(l: Life): number {
		const mastery = book.categoryMastered[l.category] ? 1 + CATEGORY_MASTERY_BONUS : 1;
		return l.insightWeight * (STAGE_INSIGHT_MULT[book.stageOf(l.id)] ?? 0) * book.favorMult * mastery;
	}

	// a plain-language read on a life's idle character, for min/maxing
	function character(l: Life): string {
		const rich = l.insightWeight >= 1.3 ? 'rich' : l.insightWeight <= 0.8 ? 'thin' : 'steady';
		const pace = l.studyEase >= 1.2 ? 'quick to know' : l.studyEase <= 0.8 ? 'slow to know' : 'even pace';
		return `${rich} · ${pace}`;
	}

	// ── look-closer click feedback ────────────────────────────────────────────
	// consecutive clicks build a focus streak (book.focusStreak) that boosts
	// the study-seconds granted — the label intensifies to show it.

	interface FloatLabel {
		lifeId: string;
		key: number;
		value: string;
		zone: 'strip' | 'card';
		streak: number;
	}

	let floats = $state<FloatLabel[]>([]);
	let floatSeq = 0;

	function handleLookCloser(l: Life, zone: 'strip' | 'card') {
		book.lookCloser(l.id);
		const mult = book.focusMult;
		const streak = book.focusStreak;
		const secs = LOOK_CLOSER_SECONDS * l.studyEase * mult;
		const value = `+${Number.isInteger(secs) ? secs.toFixed(0) : secs.toFixed(1)}s${
			streak > 1 ? ` ×${mult.toFixed(2)}` : ''
		}`;
		// replace, don't stack — a fast streak clicks well inside the fade
		// window, and piled-up afterimages read as broken rather than lively.
		const key = ++floatSeq;
		floats = [...floats.filter((f) => !(f.lifeId === l.id && f.zone === zone)), { lifeId: l.id, key, value, zone, streak }];
		setTimeout(() => {
			floats = floats.filter((f) => f.key !== key);
		}, 900);
	}

	// ── stage-cross juice: a one-shot flash + toast when a card deepens ───────

	let prevStages: Record<string, number> = {};
	let flashingCards = $state<Record<string, boolean>>({});
	interface StageToast {
		lifeId: string;
		key: number;
		text: string;
	}
	let stageToasts = $state<StageToast[]>([]);
	let toastSeq = 0;

	function triggerStageCross(lifeId: string, newStage: number) {
		flashingCards = { ...flashingCards, [lifeId]: true };
		setTimeout(() => {
			flashingCards = { ...flashingCards, [lifeId]: false };
		}, 900);
		const key = ++toastSeq;
		stageToasts = [...stageToasts.filter((t) => t.lifeId !== lifeId), { lifeId, key, text: `→ ${stageLabel[newStage]}` }];
		setTimeout(() => {
			stageToasts = stageToasts.filter((t) => t.key !== key);
		}, 1400);
	}

	$effect(() => {
		for (const l of book.life) {
			const stage = book.stageOf(l.id);
			const prev = prevStages[l.id];
			if (prev !== undefined && stage > prev) triggerStageCross(l.id, stage);
			prevStages[l.id] = stage;
		}
	});

	// ── bestiary sprite binding ───────────────────────────────────────────────

	let bindingPickerLife = $state<string | null>(null);

	function openBindingPicker(lifeId: string) {
		bindingPickerLife = bindingPickerLife === lifeId ? null : lifeId;
	}

	function bindCreature(lifeId: string, creatureId: string) {
		book.setSpriteBinding(lifeId, creatureId);
		bindingPickerLife = null;
	}

	function unbindCreature(lifeId: string) {
		book.setSpriteBinding(lifeId, null);
		bindingPickerLife = null;
	}

	// The sprite to show for a life: isolatedSprite first, fall back to sprite.
	function creatureImageSrc(lifeId: string): string | null {
		const c = book.boundCreatureFor(lifeId);
		if (!c) return null;
		return c.isolatedSprite ?? c.sprite ?? null;
	}

	function creatureIsPixelated(lifeId: string): boolean {
		const c = book.boundCreatureFor(lifeId);
		return c?.pixelated ?? false;
	}

	// attended life in emergence order (stable ordering)
	const attendedLife = $derived(book.life.filter((l) => book.isAttending(l.id)));

	// true once the published bestiary gallery has filled in the binding pool
	// (ROADMAP.md week 5) — the picker surfaces the cross-link to /bestiary
	// only when there's actually something published to point at.
	const hasPublishedInPool = $derived(book.worldCreatures.some((c) => c.source === 'published'));

	// ── world shaping affordance ──────────────────────────────────────────────

	let shapingDetailsOpen = $state(false);

	const showWorldShaping = $derived(
		book.hasObservedAquaticLife ||
			book.worldShape.sedimentUnlocked ||
			book.worldShape.unlockedWorldspaces.includes('shallows')
	);
	const sedimentUnlockPct = Math.floor(SEDIMENT_UNLOCK_COVERAGE * 100);
	const sedimentPct = $derived(Math.floor(book.sedimentCoverage * 100));
	const sedimentPhrase = $derived.by(() => {
		if (book.sedimentCoverage >= SEDIMENT_UNLOCK_COVERAGE) return 'the floor has learned shallows.';
		if (book.sedimentCoverage >= 0.4) return 'the floor is gathering into shelves.';
		if (book.sedimentCoverage >= 0.18) return 'the water is keeping a little ground.';
		if (book.worldShape.sedimentUnlocked) return 'sand is beginning to remember where it fell.';
		return 'the water is not ready to hold ground yet.';
	});

	function featurePlaced(featureId: WorldFeatureId): boolean {
		return book.worldShape.placedFeatures.some((feature) => feature.featureId === featureId);
	}

	function featureActionLabel(featureId: WorldFeatureId): string {
		if (featurePlaced(featureId)) return 'settled';
		const reason = book.featurePlacementReason(featureId);
		if (reason === 'needs-sediment') return 'needs dense sediment';
		if (reason === 'locked') return 'locked';
		return 'settle feature';
	}
</script>

<div class="world">
	<header class="mode-head">
		<h2>the world</h2>
		<p class="mode-sub">
			she wrote one condition. the world answered with dozens of things. it goes
			on living whether or not she is looking — but it shows her more when she does.
		</p>
	</header>

	<WorldCanvas />

	{#if book.pendingWorldspaceUnlock}
		<NewWorldspaceUnlock worldspace={book.pendingWorldspaceUnlock} />
	{/if}

	{#if showWorldShaping}
		<section class="shape-panel">
			<div class="shape-head">
				<div>
					<span class="shape-kicker">world shaping</span>
					<h3>{book.worldShape.activeWorldspace === 'shallows' ? 'the shallows' : 'water world'}</h3>
				</div>
				<button
					class="aperture"
					class:open={shapingDetailsOpen}
					aria-label={shapingDetailsOpen ? 'hide world details' : 'show world details'}
					aria-pressed={shapingDetailsOpen}
					onclick={() => (shapingDetailsOpen = !shapingDetailsOpen)}
				>
					<span></span>
				</button>
			</div>

			{#if !book.worldShape.sedimentUnlocked}
				<div class="shape-buy-row">
					<p>
						the first water has no floor yet. once she understands one aquatic life,
						she can spend the world's surplus on sediment.
					</p>
					<button class="shape-buy" disabled={!book.canBuySediment} onclick={() => book.buySediment()}>
						sift sediment · {fmt(book.sedimentUnlockCost)} insight
					</button>
				</div>
			{:else}
				<div class="sediment-readout">
					<div class="sediment-line">
						<span>{sedimentPhrase}</span>
						<strong>{sedimentPct}/{sedimentUnlockPct}%</strong>
					</div>
					<div class="sediment-meter" aria-hidden="true">
						<div style:width="{Math.min(100, (book.sedimentCoverage / SEDIMENT_UNLOCK_COVERAGE) * 100)}%"></div>
					</div>
					<p class="shape-note">
						sift sediment where her hand rests · {fmt(book.sedimentPourRate)} insight/s
					</p>
				</div>
			{/if}

			{#if book.worldShape.unlockedWorldspaces.includes('shallows')}
				<div class="worldspace-switch" aria-label="worldspace">
					<button
						class:active={book.worldShape.activeWorldspace === 'water'}
						onclick={() => book.enterWorldspace('water')}
					>
						water
					</button>
					<button
						class:active={book.worldShape.activeWorldspace === 'shallows'}
						onclick={() => book.enterWorldspace('shallows')}
					>
						shallows
					</button>
				</div>

				<section class="feature-panel">
					<div class="feature-head">
						<span>archaeological features</span>
						<small>{book.worldShape.placedFeatures.length}/{FEATURE_SPECS.length} settled</small>
					</div>
					<div class="feature-list">
						{#each FEATURE_SPECS as feature (feature.id)}
							<article class="feature-row" class:placed={featurePlaced(feature.id)}>
								<div>
									<h4>{feature.name}</h4>
									<p>{feature.short}</p>
									<span>{feature.effect}</span>
								</div>
								<button
									disabled={!book.canPlaceFeature(feature.id)}
									onclick={() => book.placeFeature(feature.id)}
								>
									{featureActionLabel(feature.id)}
								</button>
							</article>
						{/each}
					</div>
				</section>
			{/if}

			{#if shapingDetailsOpen}
				<WorldShapingDetails />
			{/if}
		</section>
	{/if}

	<section class="attention-panel">
		<div class="ap-line">
			<span class="ap-label">her attention</span>
			<span class="ap-meta">
				watching <span class="num">{book.attentionUsed}</span> of
				<span class="num">{book.attentionCapacity}</span>
			</span>
		</div>
		<div class="ap-actions">
			{#if book.attentionUpgradeCost !== null}
				<div class="ap-action">
					<button
						class="ap-btn"
						disabled={book.insight < book.attentionUpgradeCost}
						onclick={() => book.expandAttention()}
					>
						widen her attention — {fmt(book.attentionUpgradeCost)} insight
					</button>
					{#if book.insight < book.attentionUpgradeCost}
						<span class="ap-eta">{humanizeSeconds(book.attentionUpgradeEtaSeconds)} at this rate</span>
					{/if}
				</div>
			{:else}
				<span class="ap-note">her attention is as wide as it goes, in this world.</span>
			{/if}
			<div class="ap-action">
				<button class="ap-btn" disabled={!book.canDistill()} onclick={() => book.distillEssence()}>
					distill {DISTILL_INSIGHT_COST} insight → {DISTILL_ESSENCE_GAIN} essence
				</button>
				{#if !book.canDistill()}
					<span class="ap-eta">{humanizeSeconds(book.distillEtaSeconds)} at this rate</span>
				{/if}
			</div>
		</div>
	</section>

	<FieldNotes />

	{#if attendedLife.length > 0}
		<section class="attended-strip">
			<h3 class="strip-head">
				<span>attending</span>
				<span class="strip-count">{book.attentionUsed}/{book.attentionCapacity}</span>
			</h3>
			<ul class="strip-rows">
				{#each attendedLife as l (l.id)}
					{@const stage = book.stageOf(l.id)}
					{@const progress = book.stageProgress(l.id)}
					{@const creature = book.boundCreatureFor(l.id)}
					<li class="strip-row">
						<MiniHex {creature} />
						<div class="strip-content">
							<div class="strip-namerow">
								<span class="strip-name">{l.name}</span>
								<span class="strip-stage">
									{stageLabel[stage]} → {nextStageName(stage)}
								</span>
							</div>
							<div class="strip-progress" aria-hidden="true">
								<div class="strip-bar" style:width="{progress * 100}%"></div>
							</div>
							<div class="strip-action">
								{#each floats.filter((f) => f.lifeId === l.id && f.zone === 'strip') as f (f.key)}
									<span class="float-label" class:boosted={f.streak > 1} aria-live="polite"
										>{f.value}</span
									>
								{/each}
								<button class="look-btn" onclick={() => handleLookCloser(l, 'strip')}>
									look closer
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if book.life.length === 0}
		<p class="empty">
			the world is still rock and salt water and waiting. go back to the web and
			write a condition — life emerges from what you allow.
		</p>
	{:else}
		{#each categories as cat (cat.id)}
			{@const here = book.life.filter((l) => l.category === cat.id)}
			{#if here.length > 0}
				<section class="cat">
					<h3 class="cat-label">
						{cat.label}
						{#if book.categoryMastered[cat.id]}
							<span class="mastery-badge"
								>— fully known · +{Math.round(CATEGORY_MASTERY_BONUS * 100)}% insight</span
							>
						{/if}
					</h3>
					<div class="cards">
						{#each here as l (l.id)}
							{@const stage = book.stageOf(l.id)}
							{@const known = stage >= STAGE_KNOWN}
							{@const attending = book.isAttending(l.id)}
							{@const boundSprite = creatureImageSrc(l.id)}
							{@const boundPixelated = creatureIsPixelated(l.id)}
							<article
								class="card"
								class:unlooked={stage === 0}
								class:attending
								class:known
								class:just-crossed={flashingCards[l.id]}
							>
								{#if boundSprite}
									<div class="sprite-preview">
										<img
											src={boundSprite}
											alt={book.boundCreatureFor(l.id)?.name ?? ''}
											class="sprite-img"
											class:pixelated={boundPixelated}
										/>
									</div>
								{/if}

								<div class="card-head">
									<div class="naming">
										<h4>{l.name}</h4>
										<span class="sci">{l.scientificName}</span>
									</div>
									<span class="character">{character(l)}</span>
									{#each stageToasts.filter((t) => t.lifeId === l.id) as t (t.key)}
										<span class="stage-toast" aria-live="polite">{t.text}</span>
									{/each}
								</div>

								<p class="stage-text">{book.stageTextFor(l)}</p>

								<div class="yield-line">
									<span class="stage-badge">{stageLabel[stage]}</span>
									{#if yields(l) > 0}
										<span class="yield">yielding {fmt(yields(l))} insight/s</span>
									{:else}
										<span class="yield muted">not yet yielding</span>
									{/if}
								</div>

								{#if !known}
									<div class="progress" aria-hidden="true">
										<div class="bar" style:width="{book.stageProgress(l.id) * 100}%"></div>
									</div>
									<p class="toward">
										{#if attending}
											deepening toward <em>{nextStageName(stage)}</em> —
											{Math.floor(book.stageProgress(l.id) * 100)}%
										{:else}
											idle. attend to it and it will deepen toward
											<em>{nextStageName(stage)}</em>.
										{/if}
									</p>
									<div class="card-actions">
										{#each floats.filter((f) => f.lifeId === l.id && f.zone === 'card') as f (f.key)}
											<span class="float-label" class:boosted={f.streak > 1} aria-live="polite"
												>{f.value}</span
											>
										{/each}
										{#if attending}
											<button class="look" onclick={() => handleLookCloser(l, 'card')}>
												look closer
											</button>
											<button class="release" onclick={() => book.unattend(l.id)}>
												release
											</button>
										{:else}
											<button
												class="attend"
												disabled={!book.canAttend(l.id)}
												onclick={() => book.attend(l.id)}
											>
												{book.attentionFree > 0 ? 'attend' : 'no attention free'}
											</button>
										{/if}
									</div>
								{:else if book.hasIntervened(l.id)}
									<p class="intervened">
										<span class="verb-done">{pastVerb(domainVerb[l.domain])}.</span>
										<span class="intervened-line">“{book.interventionLineFor(l.id)}”</span>
									</p>
								{:else}
									{@const cost = book.interventionCostFor(l.id)}
									<div class="intervene">
										<p class="intervene-lead">
											she knows it now — enough to {domainVerb[l.domain]} it kindly.
										</p>
										<button
											class="act"
											disabled={!book.canIntervene(l.id)}
											onclick={() => book.intervene(l.id)}
										>
											{domainVerb[l.domain]} · {cost.insight} insight{#if cost.essence}
												+ {cost.essence} essence{/if}
										</button>
										<p class="intervene-or">or witness it, and leave it be.</p>
									</div>
								{/if}

								{#if book.worldCreatures.length > 0}
									{@const bound = book.boundCreatureFor(l.id)}
									<div class="bind-row">
										{#if bound}
											<span class="bind-name">
												{bound.name || '—'}
												{#if bound.source === 'published'}
													<span class="bind-source">from the bestiary at woodles.space</span>
												{/if}
											</span>
											<button class="bind-btn" onclick={() => openBindingPicker(l.id)}>
												change
											</button>
											<button class="bind-btn danger" onclick={() => unbindCreature(l.id)}>
												remove
											</button>
										{:else}
											<button class="bind-btn" onclick={() => openBindingPicker(l.id)}>
												bind creature sprite
											</button>
										{/if}
									</div>

									{#if bindingPickerLife === l.id}
										<ul class="bind-picker">
											{#each book.worldCreatures as c (c.id)}
												<li>
													<button
														class="pick-entry"
														class:active={book.spriteBindings[l.id] === c.id}
														onclick={() => bindCreature(l.id, c.id)}
													>
														{#if c.isolatedSprite ?? c.sprite}
															<img
																src={c.isolatedSprite ?? c.sprite ?? ''}
																alt=""
																class="pick-thumb"
																class:pixelated={c.pixelated}
															/>
														{:else}
															<span class="pick-thumb pick-thumb-empty">?</span>
														{/if}
														<span class="pick-name">{c.name || '(unnamed)'}</span>
														<span class="pick-tag" class:published={c.source === 'published'}>
															{c.source === 'published' ? 'the bestiary' : 'yours'}
														</span>
													</button>
												</li>
											{/each}
										</ul>
										{#if hasPublishedInPool}
											<p class="bind-cross-link">
												"the bestiary" creatures are Z's published collection —
												<a href="/bestiary">see them all at woodles.space</a>
											</p>
										{/if}
									{/if}
								{/if}
							</article>
						{/each}
					</div>
				</section>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.world {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.mode-head h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.5rem;
		color: var(--cyan);
		margin: 0 0 0.15rem;
	}
	.mode-sub {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--muted);
		margin: 0;
		max-width: 36rem;
	}
	.num {
		font-family: var(--font-counter);
		color: var(--leafeon-pink);
		font-size: 1.1em;
	}

	/* ── world shaping ───────────────────────────────────────────────────── */
	.shape-panel {
		border: 1px solid rgba(108, 229, 232, 0.24);
		border-radius: 4px;
		background:
			linear-gradient(180deg, rgba(108, 229, 232, 0.05), rgba(45, 45, 95, 0.24)),
			var(--panel);
		padding: 0.75rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.shape-head,
	.sediment-line,
	.feature-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.shape-kicker,
	.feature-head span {
		display: block;
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--cyan);
	}
	.shape-head h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.2rem;
		color: var(--cream);
		margin: 0.05rem 0 0;
	}
	.aperture {
		position: relative;
		width: 2.2rem;
		height: 2.2rem;
		flex: 0 0 auto;
		border: 1px solid var(--rule);
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: rgba(26, 26, 62, 0.55);
	}
	.aperture span,
	.aperture::before,
	.aperture::after {
		content: '';
		display: block;
		border-radius: 50%;
	}
	.aperture span {
		width: 0.58rem;
		height: 0.58rem;
		background: var(--periwinkle);
		box-shadow: 0 0 8px rgba(154, 150, 201, 0.35);
	}
	.aperture::before {
		position: absolute;
		width: 1.35rem;
		height: 1.35rem;
		border: 1px solid rgba(154, 150, 201, 0.42);
	}
	.aperture::after {
		position: absolute;
		width: 1.82rem;
		height: 1.82rem;
		border: 1px solid rgba(108, 229, 232, 0.2);
	}
	.aperture:hover,
	.aperture.open {
		border-color: var(--cyan);
	}
	.aperture.open span {
		background: var(--cyan);
	}
	.shape-buy-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}
	.shape-buy-row p,
	.shape-note {
		font-family: var(--font-body);
		font-size: 0.84rem;
		color: var(--muted);
		margin: 0;
	}
	.shape-buy,
	.worldspace-switch button,
	.feature-row button {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--cream);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.35rem 0.58rem;
		white-space: nowrap;
	}
	.shape-buy:hover:not(:disabled),
	.feature-row button:hover:not(:disabled) {
		border-color: var(--cyan);
		color: var(--cyan);
	}
	.sediment-readout {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.sediment-line span {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--muted);
	}
	.sediment-line strong {
		font-family: var(--font-counter);
		font-weight: 400;
		font-size: 1.1rem;
		color: var(--cyan);
		white-space: nowrap;
	}
	.sediment-meter {
		height: 6px;
		background: var(--bg);
		border-radius: 999px;
		overflow: hidden;
	}
	.sediment-meter div {
		height: 100%;
		background: linear-gradient(90deg, #ab8974, #d8be8e, var(--cyan));
		transition: width 160ms linear;
	}
	.worldspace-switch {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.worldspace-switch button.active {
		border-color: var(--cyan);
		color: var(--cyan);
		background: rgba(108, 229, 232, 0.07);
	}
	.feature-panel {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.feature-head small {
		font-family: var(--font-counter);
		font-size: 0.9rem;
		color: var(--muted);
	}
	.feature-list {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--rule);
	}
	.feature-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--rule);
	}
	.feature-row h4 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1rem;
		color: var(--cream);
		margin: 0;
	}
	.feature-row p {
		font-family: var(--font-body);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0.08rem 0;
	}
	.feature-row span {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.feature-row.placed {
		opacity: 0.75;
	}
	.feature-row.placed button {
		color: var(--periwinkle);
	}

	/* ── attention panel ─────────────────────────────────────────────────── */
	.attention-panel {
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel-accent);
		padding: 0.6rem 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ap-line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
	}
	.ap-label {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.ap-meta {
		font-family: var(--font-ui);
		font-size: 0.82rem;
		color: var(--muted);
	}
	.ap-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.ap-btn {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		color: var(--cream);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.35rem 0.6rem;
	}
	.ap-btn:hover:not(:disabled) {
		border-color: var(--cyan);
		color: var(--cyan);
	}
	.ap-btn:active:not(:disabled) {
		transform: scale(0.96);
	}
	.ap-note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.ap-action {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
	}
	.ap-eta {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		color: var(--muted);
		padding-left: 0.1rem;
	}

	/* ── attended strip ─────────────────────────────────────────────────────── */
	.attended-strip {
		border: 1px solid rgba(108, 229, 232, 0.22);
		border-radius: 4px;
		background: var(--panel);
		padding: 0.7rem 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.strip-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--cyan);
		margin: 0;
	}
	.strip-count {
		font-family: var(--font-counter);
		font-size: 0.78rem;
		color: var(--muted);
		letter-spacing: 0;
		text-transform: none;
	}
	.strip-rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.strip-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.strip-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.strip-namerow {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
	}
	.strip-name {
		font-family: var(--font-display);
		font-size: 0.95rem;
		color: var(--cream);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.strip-stage {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.strip-progress {
		height: 4px;
		background: var(--bg);
		border-radius: 2px;
		overflow: hidden;
	}
	.strip-bar {
		height: 100%;
		background: linear-gradient(90deg, var(--periwinkle), var(--cyan));
		transition: width 180ms linear;
	}
	.strip-action {
		position: relative;
	}
	.look-btn {
		width: 100%;
		font-family: var(--font-ui);
		font-size: 0.76rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--cyan);
		border: 1px solid rgba(108, 229, 232, 0.38);
		border-radius: 3px;
		padding: 0.32rem 0.6rem;
		text-align: center;
		transition: border-color 120ms, color 120ms, background 120ms, transform 80ms;
	}
	.look-btn:hover {
		border-color: var(--cyan);
		background: rgba(108, 229, 232, 0.07);
	}
	.look-btn:active {
		background: rgba(108, 229, 232, 0.14);
		transform: scale(0.94);
	}

	/* ── float label (shared between strip and card zones) ───────────────────── */
	.float-label {
		position: absolute;
		bottom: calc(100% + 2px);
		left: 50%;
		transform: translateX(-50%);
		font-family: var(--font-counter);
		font-size: 0.92rem;
		color: var(--cyan);
		pointer-events: none;
		white-space: nowrap;
		animation: float-up 0.9s ease-out forwards;
	}
	@keyframes float-up {
		0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
		60%  { opacity: 1; transform: translateX(-50%) translateY(-14px); }
		100% { opacity: 0; transform: translateX(-50%) translateY(-22px); }
	}
	.float-label.boosted {
		color: var(--leafeon-pink);
		font-size: 1.02rem;
		text-shadow: 0 0 6px rgba(240, 143, 184, 0.4);
	}

	/* card-actions needs position:relative for the card float anchor */
	.card-actions {
		position: relative;
	}

	.empty {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--muted);
		max-width: 34rem;
		margin: 0;
	}
	.cat-label {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.6rem;
	}
	.mastery-badge {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.68rem;
		letter-spacing: 0;
		text-transform: none;
		color: var(--leafeon-pink);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 0.7rem;
	}
	.card {
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel);
		padding: 0.7rem 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.card.unlooked {
		opacity: 0.72;
	}
	.card.attending {
		border-color: var(--cyan);
	}
	.card.known {
		background: var(--panel-accent);
		border-color: rgba(240, 143, 184, 0.4);
	}
	.card.just-crossed {
		animation: stage-flash 900ms ease-out;
	}
	@keyframes stage-flash {
		0% {
			border-color: var(--cyan);
			box-shadow: 0 0 12px rgba(108, 229, 232, 0.5);
		}
		100% {
			box-shadow: none;
		}
	}
	.card-head {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.stage-toast {
		position: absolute;
		top: -0.3rem;
		right: 0;
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--cyan);
		pointer-events: none;
		animation: float-up 1.4s ease-out forwards;
	}
	.naming {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
	}
	.card h4 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.05rem;
		color: var(--cream);
		margin: 0;
	}
	.sci {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.74rem;
		color: var(--periwinkle);
	}
	.character {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: right;
		white-space: nowrap;
	}
	.stage-text {
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--muted);
		margin: 0;
		flex: 1;
	}
	.yield-line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.stage-badge {
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.yield {
		font-family: var(--font-counter);
		font-size: 0.82rem;
		color: var(--cyan);
	}
	.yield.muted {
		color: var(--muted);
	}
	.progress {
		height: 5px;
		background: var(--bg);
		border-radius: 3px;
		overflow: hidden;
	}
	.bar {
		height: 100%;
		background: linear-gradient(90deg, var(--periwinkle), var(--cyan));
		transition: width 180ms linear;
	}
	.toward {
		font-family: var(--font-ui);
		font-size: 0.74rem;
		color: var(--muted);
		margin: 0;
	}
	.toward em {
		color: var(--cyan);
		font-style: normal;
	}
	.card-actions {
		display: flex;
		gap: 0.4rem;
	}
	.attend,
	.look,
	.release {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.3rem 0.55rem;
		color: var(--cream);
		transition: border-color 120ms, color 120ms, transform 80ms;
	}
	.attend:hover:not(:disabled),
	.look:hover {
		border-color: var(--cyan);
		color: var(--cyan);
	}
	.attend:active:not(:disabled),
	.look:active {
		transform: scale(0.94);
	}
	.release:hover {
		border-color: var(--print-pink);
		color: var(--print-pink);
	}
	.intervene {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.intervene-lead {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--leafeon-pink);
		margin: 0;
	}
	.act {
		align-self: flex-start;
		font-family: var(--font-ui);
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--cream);
		border: 1px solid var(--leafeon-pink);
		border-radius: 3px;
		padding: 0.35rem 0.6rem;
		background: var(--panel-accent);
		transition: color 120ms, box-shadow 120ms, transform 80ms;
	}
	.act:hover:not(:disabled) {
		color: var(--leafeon-pink);
		box-shadow: 0 0 8px rgba(240, 143, 184, 0.25);
	}
	.act:active:not(:disabled) {
		transform: scale(0.96);
	}
	.act:disabled {
		opacity: 0.45;
		border-color: var(--rule);
	}
	.intervene-or {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		font-style: italic;
		color: var(--muted);
		margin: 0;
	}
	.intervened {
		font-family: var(--font-body);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.verb-done {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--leafeon-pink);
	}
	.intervened-line {
		font-family: var(--font-hand);
		font-size: 1.05rem;
		line-height: 1.4;
		color: var(--cream);
	}

	/* ── bestiary creature sprite ────────────────────────────────────────── */
	.sprite-preview {
		display: flex;
		justify-content: center;
		padding: 0.3rem 0;
	}
	.sprite-img {
		max-width: 80px;
		max-height: 80px;
		object-fit: contain;
		border-radius: 3px;
	}
	.sprite-img.pixelated {
		image-rendering: pixelated;
	}

	/* ── binding controls ────────────────────────────────────────────────── */
	.bind-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
		padding-top: 0.2rem;
		border-top: 1px solid var(--rule);
		margin-top: 0.2rem;
	}
	.bind-name {
		font-family: var(--font-ui);
		font-size: 0.7rem;
		color: var(--leafeon-pink);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bind-source {
		display: block;
		white-space: normal;
		font-family: var(--font-ui);
		font-size: 0.62rem;
		font-style: italic;
		color: var(--periwinkle);
	}
	.bind-btn {
		font-family: var(--font-ui);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.22rem 0.45rem;
		color: var(--muted);
		white-space: nowrap;
	}
	.bind-btn:hover {
		border-color: var(--periwinkle);
		color: var(--periwinkle);
	}
	.bind-btn.danger:hover {
		border-color: var(--print-pink);
		color: var(--print-pink);
	}
	.bind-picker {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		max-height: 180px;
		overflow-y: auto;
		border: 1px solid var(--rule);
		border-radius: 3px;
		background: var(--bg);
		padding: 0.25rem;
	}
	.pick-entry {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0.3rem 0.4rem;
		border-radius: 3px;
		text-align: left;
		transition: background 80ms;
	}
	.pick-entry:hover {
		background: var(--panel-accent);
	}
	.pick-entry.active {
		background: var(--panel-accent);
		outline: 1px solid var(--periwinkle);
	}
	.pick-thumb {
		width: 32px;
		height: 32px;
		object-fit: contain;
		border-radius: 2px;
		flex-shrink: 0;
	}
	.pick-thumb.pixelated {
		image-rendering: pixelated;
	}
	.pick-thumb-empty {
		display: grid;
		place-items: center;
		background: var(--panel);
		color: var(--muted);
		font-family: var(--font-ui);
		font-size: 0.9rem;
	}
	.pick-name {
		font-family: var(--font-ui);
		font-size: 0.76rem;
		color: var(--cream);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pick-tag {
		flex-shrink: 0;
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}
	.pick-tag.published {
		color: var(--leafeon-pink);
	}
	.bind-cross-link {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		font-style: italic;
		color: var(--muted);
		margin: 0.3rem 0 0;
		padding: 0 0.1rem;
	}
	.bind-cross-link a {
		color: var(--cyan);
	}
	@media (max-width: 680px) {
		.shape-buy-row,
		.sediment-line,
		.feature-row {
			align-items: stretch;
			grid-template-columns: 1fr;
			flex-direction: column;
		}
		.feature-row button,
		.shape-buy {
			width: 100%;
		}
	}
</style>
