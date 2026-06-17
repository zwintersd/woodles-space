<script lang="ts">
	import { book, fmt, stageLabel, STAGE_KNOWN } from './book.svelte';
	import { STAGE_INSIGHT_MULT, DISTILL_INSIGHT_COST, DISTILL_ESSENCE_GAIN } from './tuning';
	import { domainVerb, type Life, type LifeCategory } from './content/life';

	const categories: { id: LifeCategory; label: string }[] = [
		{ id: 'aquatic', label: 'in the water' },
		{ id: 'terrestrial', label: 'on the land' },
		{ id: 'atmospheric', label: 'in the sky' }
	];

	const nextStageName = (stage: number) => stageLabel[Math.min(stage + 1, STAGE_KNOWN)];

	// effective insight/sec this life is currently contributing
	function yields(l: Life): number {
		return l.insightWeight * (STAGE_INSIGHT_MULT[book.stageOf(l.id)] ?? 0) * book.favorMult;
	}

	// a plain-language read on a life's idle character, for min/maxing
	function character(l: Life): string {
		const rich = l.insightWeight >= 1.3 ? 'rich' : l.insightWeight <= 0.8 ? 'thin' : 'steady';
		const pace = l.studyEase >= 1.2 ? 'quick to know' : l.studyEase <= 0.8 ? 'slow to know' : 'even pace';
		return `${rich} · ${pace}`;
	}

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
</script>

<div class="world">
	<header class="mode-head">
		<h2>the world</h2>
		<p class="mode-sub">
			she wrote one condition. the world answered with dozens of things. it goes
			on living whether or not she is looking — but it shows her more when she does.
		</p>
	</header>

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
				<button
					class="ap-btn"
					disabled={book.insight < book.attentionUpgradeCost}
					onclick={() => book.expandAttention()}
				>
					widen her attention — {fmt(book.attentionUpgradeCost)} insight
				</button>
			{:else}
				<span class="ap-note">her attention is as wide as it goes, in this world.</span>
			{/if}
			<button class="ap-btn" disabled={!book.canDistill()} onclick={() => book.distillEssence()}>
				distill {DISTILL_INSIGHT_COST} insight → {DISTILL_ESSENCE_GAIN} essence
			</button>
		</div>
	</section>

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
					<h3 class="cat-label">{cat.label}</h3>
					<div class="cards">
						{#each here as l (l.id)}
							{@const stage = book.stageOf(l.id)}
							{@const known = stage >= STAGE_KNOWN}
							{@const attending = book.isAttending(l.id)}
							{@const boundSprite = creatureImageSrc(l.id)}
							{@const boundPixelated = creatureIsPixelated(l.id)}
							<article class="card" class:unlooked={stage === 0} class:attending class:known>
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
										{#if attending}
											<button class="look" onclick={() => book.lookCloser(l.id)}>
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
								{:else}
									<p class="intervene">
										she knows it now — enough to {domainVerb[l.domain]} it kindly.
										<span class="soon">(intervention arrives in a later pass.)</span>
									</p>
								{/if}

								{#if book.bestiaryCreatures.length > 0}
									<div class="bind-row">
										{#if book.spriteBindings[l.id]}
											<span class="bind-name">
												{book.boundCreatureFor(l.id)?.name ?? '—'}
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
											{#each book.bestiaryCreatures as c (c.id)}
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
														<span class="pick-domain">{c.domain}</span>
													</button>
												</li>
											{/each}
										</ul>
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
	.ap-note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--muted);
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
	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
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
	}
	.attend:hover:not(:disabled),
	.look:hover {
		border-color: var(--cyan);
		color: var(--cyan);
	}
	.release:hover {
		border-color: var(--print-pink);
		color: var(--print-pink);
	}
	.intervene {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--leafeon-pink);
		margin: 0;
	}
	.soon {
		color: var(--muted);
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
	.pick-domain {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}
</style>
