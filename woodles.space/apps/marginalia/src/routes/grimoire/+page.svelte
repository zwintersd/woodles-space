<script lang="ts">
	import { assumptions as defaultAssumptions } from '$lib/witch/content/assumptions';
	import { conditions as defaultConditions } from '$lib/witch/content/conditions';
	import { emergences as defaultEmergences } from '$lib/witch/content/emergences';
	import { journalSeeds as defaultJournalSeeds } from '$lib/witch/content/journal';
	import { world1Life as defaultLife } from '$lib/witch/content/life';
	import { titles as defaultTitles } from '$lib/witch/content/titles';

	type ActiveModule = 'life' | 'journal' | 'conditions' | 'emergences' | 'assumptions' | 'titles';

	let activeModule = $state<ActiveModule>('life');
	let copied = $state(false);

	// Reactive Lists for each module
	let lifeList = $state([...defaultLife]);
	let journalList = $state([...defaultJournalSeeds]);
	let conditionsList = $state([...defaultConditions]);
	let emergencesList = $state([...defaultEmergences]);
	let assumptionsList = $state([...defaultAssumptions]);
	let titlesList = $state([...defaultTitles]);

	// Selection Indices
	let selectedLifeIdx = $state(0);
	let selectedJournalIdx = $state(0);
	let selectedConditionIdx = $state(0);
	let selectedEmergenceIdx = $state(0);
	let selectedAssumptionIdx = $state(0);
	let selectedTitleIdx = $state(0);

	// Generators
	const generatedCode = $derived.by(() => {
		if (activeModule === 'life') {
			return `export const world1Life: Life[] = [\n` +
				lifeList.map(item => `\t{\n\t\tid: '${item.id}',\n\t\tname: '${item.name.replace(/'/g, "\\'")}',\n\t\tscientificName: '${item.scientificName.replace(/'/g, "\\'")}',\n\t\tcategory: '${item.category}',\n\t\tdomain: '${item.domain}',\n\t\trequires: [${item.requires.map(r => `'${r}'`).join(', ')}],\n\t\tinsightWeight: ${item.insightWeight},\n\t\tstudyEase: ${item.studyEase},\n\t\tnotice: '${item.notice.replace(/'/g, "\\'")}',\n\t\tobserve: '${item.observe.replace(/'/g, "\\'")}',\n\t\tstudy: '${item.study.replace(/'/g, "\\'")}',\n\t\tknow: '${item.know.replace(/'/g, "\\'")}'\n\t}`).join(',\n') +
				`\n];`;
		}
		if (activeModule === 'journal') {
			return `export const journalSeeds: JournalSeed[] = [\n` +
				journalList.map(item => `\t{\n\t\tid: '${item.id}',\n\t\tatConditions: ${item.atConditions},\n\t\tband: '${item.band}',\n\t\ttext: '${item.text.replace(/'/g, "\\'")}'\n\t}`).join(',\n') +
				`\n];`;
		}
		if (activeModule === 'conditions') {
			return `export const conditions: Condition[] = [\n` +
				conditionsList.map(item => `\t{\n\t\tid: '${item.id}',\n\t\tphrase: '${item.phrase.replace(/'/g, "\\'")}',\n\t\tname: '${item.name.replace(/'/g, "\\'")}',\n\t\tenables: '${item.enables.replace(/'/g, "\\'")}',\n\t\tcost: ${item.cost}\n\t}`).join(',\n') +
				`\n];`;
		}
		if (activeModule === 'emergences') {
			return `export const emergences: Emergence[] = [\n` +
				emergencesList.map(item => `\t{\n\t\tid: '${item.id}',\n\t\tname: '${item.name.replace(/'/g, "\\'")}',\n\t\tfrom: ['${item.from[0]}', '${item.from[1]}'],\n\t\tnote: '${item.note.replace(/'/g, "\\'")}'\n\t}`).join(',\n') +
				`\n];`;
		}
		if (activeModule === 'assumptions') {
			return `export const assumptions: Assumption[] = [\n` +
				assumptionsList.map(item => `\t{\n\t\tid: '${item.id}',\n\t\tgroup: '${item.group}',\n\t\ttext: '${item.text.replace(/'/g, "\\'")}'\n\t}`).join(',\n') +
				`\n];`;
		}
		return `export const titles: Title[] = [\n` +
			titlesList.map(item => `\t{\n\t\tid: '${item.id}',\n\t\tname: '${item.name.replace(/'/g, "\\'")}',\n\t\tearnedNote: '${item.earnedNote.replace(/'/g, "\\'")}'\n\t}`).join(',\n') +
			`\n];`;
	});

	function handleCopy() {
		navigator.clipboard.writeText(generatedCode).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}

	// Entity Creators
	function addLife() {
		const id = 'new_life_' + Date.now().toString(36).slice(-4);
		lifeList = [...lifeList, {
			id,
			name: 'new species',
			scientificName: 'Species novum',
			category: 'aquatic',
			domain: 'plant',
			requires: [],
			insightWeight: 1.0,
			studyEase: 1.0,
			notice: 'notice details...',
			observe: 'observation details...',
			study: 'study patterns...',
			know: 'what care would mean...'
		}];
		selectedLifeIdx = lifeList.length - 1;
	}

	function addJournal() {
		const id = 'new_journal_' + Date.now().toString(36).slice(-4);
		journalList = [...journalList, {
			id,
			atConditions: 0,
			band: 'even',
			text: 'The book feels warm...'
		}];
		selectedJournalIdx = journalList.length - 1;
	}

	function addCondition() {
		const id = 'new_cond_' + Date.now().toString(36).slice(-4);
		conditionsList = [...conditionsList, {
			id,
			phrase: 'let there be...',
			name: 'new condition',
			enables: 'description of effect...',
			cost: 1
		}];
		selectedConditionIdx = conditionsList.length - 1;
	}

	function addEmergence() {
		const id = 'new_em_' + Date.now().toString(36).slice(-4);
		emergencesList = [...emergencesList, {
			id,
			name: 'new emergence',
			from: [conditionsList[0]?.id || 'flow', conditionsList[1]?.id || 'holding'],
			note: 'what they became...'
		}];
		selectedEmergenceIdx = emergencesList.length - 1;
	}

	function addAssumption() {
		const id = 'new_assump_' + Date.now().toString(36).slice(-4);
		assumptionsList = [...assumptionsList, {
			id,
			group: 'temporal',
			text: 'an assumption...'
		}];
		selectedAssumptionIdx = assumptionsList.length - 1;
	}

	function addTitle() {
		const id = 'new_title_' + Date.now().toString(36).slice(-4);
		titlesList = [...titlesList, {
			id,
			name: 'The Scribe',
			earnedNote: 'she wrote until...'
		}];
		selectedTitleIdx = titlesList.length - 1;
	}

	// Delete Handlers
	function deleteItem(idx: number) {
		if (activeModule === 'life') {
			lifeList = lifeList.filter((_, i) => i !== idx);
			selectedLifeIdx = Math.max(0, selectedLifeIdx - 1);
		} else if (activeModule === 'journal') {
			journalList = journalList.filter((_, i) => i !== idx);
			selectedJournalIdx = Math.max(0, selectedJournalIdx - 1);
		} else if (activeModule === 'conditions') {
			conditionsList = conditionsList.filter((_, i) => i !== idx);
			selectedConditionIdx = Math.max(0, selectedConditionIdx - 1);
		} else if (activeModule === 'emergences') {
			emergencesList = emergencesList.filter((_, i) => i !== idx);
			selectedEmergenceIdx = Math.max(0, selectedEmergenceIdx - 1);
		} else if (activeModule === 'assumptions') {
			assumptionsList = assumptionsList.filter((_, i) => i !== idx);
			selectedAssumptionIdx = Math.max(0, selectedAssumptionIdx - 1);
		} else if (activeModule === 'titles') {
			titlesList = titlesList.filter((_, i) => i !== idx);
			selectedTitleIdx = Math.max(0, selectedTitleIdx - 1);
		}
	}

	// Helpers
	function toggleRequire(life: typeof lifeList[0], condId: string) {
		if (life.requires.includes(condId)) {
			life.requires = life.requires.filter(c => c !== condId);
		} else {
			life.requires = [...life.requires, condId];
		}
	}
</script>

<header class="topbar">
	<a class="brand" href="/marginalia">✦ grimoire studio · marginalia</a>
	<a class="ghost" href="/">exit</a>
</header>

<main class="studio-layout">
	<!-- Module Navigation Sidebar -->
	<aside class="sidebar">
		<button class:active={activeModule === 'life'} onclick={() => activeModule = 'life'}>life forms</button>
		<button class:active={activeModule === 'journal'} onclick={() => activeModule = 'journal'}>journal seeds</button>
		<button class:active={activeModule === 'conditions'} onclick={() => activeModule = 'conditions'}>conditions</button>
		<button class:active={activeModule === 'emergences'} onclick={() => activeModule = 'emergences'}>emergences</button>
		<button class:active={activeModule === 'assumptions'} onclick={() => activeModule = 'assumptions'}>assumptions</button>
		<button class:active={activeModule === 'titles'} onclick={() => activeModule = 'titles'}>titles</button>
	</aside>

	<!-- Left List Pane -->
	<section class="item-list-pane">
		<div class="pane-header">
			<h3>items</h3>
			{#if activeModule === 'life'}
				<button class="ghost tiny" onclick={addLife}>+ add life</button>
			{:else if activeModule === 'journal'}
				<button class="ghost tiny" onclick={addJournal}>+ add seed</button>
			{:else if activeModule === 'conditions'}
				<button class="ghost tiny" onclick={addCondition}>+ add cond</button>
			{:else if activeModule === 'emergences'}
				<button class="ghost tiny" onclick={addEmergence}>+ add em</button>
			{:else if activeModule === 'assumptions'}
				<button class="ghost tiny" onclick={addAssumption}>+ add assump</button>
			{:else if activeModule === 'titles'}
				<button class="ghost tiny" onclick={addTitle}>+ add title</button>
			{/if}
		</div>

		<div class="list-container">
			{#if activeModule === 'life'}
				{#each lifeList as item, i}
					<button class="list-item" class:active={selectedLifeIdx === i} onclick={() => selectedLifeIdx = i}>
						<span class="item-title">{item.name}</span>
						<span class="item-sub">{item.scientificName}</span>
					</button>
				{/each}
			{:else if activeModule === 'journal'}
				{#each journalList as item, i}
					<button class="list-item" class:active={selectedJournalIdx === i} onclick={() => selectedJournalIdx = i}>
						<span class="item-title">{item.id}</span>
						<span class="item-sub">Conditions: {item.atConditions} · {item.band}</span>
					</button>
				{/each}
			{:else if activeModule === 'conditions'}
				{#each conditionsList as item, i}
					<button class="list-item" class:active={selectedConditionIdx === i} onclick={() => selectedConditionIdx = i}>
						<span class="item-title">{item.phrase}</span>
						<span class="item-sub">{item.name} · cost {item.cost}</span>
					</button>
				{/each}
			{:else if activeModule === 'emergences'}
				{#each emergencesList as item, i}
					<button class="list-item" class:active={selectedEmergenceIdx === i} onclick={() => selectedEmergenceIdx = i}>
						<span class="item-title">{item.name}</span>
						<span class="item-sub">{item.from[0]} + {item.from[1]}</span>
					</button>
				{/each}
			{:else if activeModule === 'assumptions'}
				{#each assumptionsList as item, i}
					<button class="list-item" class:active={selectedAssumptionIdx === i} onclick={() => selectedAssumptionIdx = i}>
						<span class="item-title">{item.text}</span>
						<span class="item-sub">{item.group}</span>
					</button>
				{/each}
			{:else if activeModule === 'titles'}
				{#each titlesList as item, i}
					<button class="list-item" class:active={selectedTitleIdx === i} onclick={() => selectedTitleIdx = i}>
						<span class="item-title">{item.name}</span>
						<span class="item-sub">{item.id}</span>
					</button>
				{/each}
			{/if}
		</div>
	</section>

	<!-- Form Pane -->
	<section class="form-pane">
		<div class="pane-header">
			<h3>editor</h3>
			{#if activeModule === 'life' && lifeList[selectedLifeIdx]}
				<button class="ghost danger tiny" onclick={() => deleteItem(selectedLifeIdx)}>delete</button>
			{:else if activeModule === 'journal' && journalList[selectedJournalIdx]}
				<button class="ghost danger tiny" onclick={() => deleteItem(selectedJournalIdx)}>delete</button>
			{:else if activeModule === 'conditions' && conditionsList[selectedConditionIdx]}
				<button class="ghost danger tiny" onclick={() => deleteItem(selectedConditionIdx)}>delete</button>
			{:else if activeModule === 'emergences' && emergencesList[selectedEmergenceIdx]}
				<button class="ghost danger tiny" onclick={() => deleteItem(selectedEmergenceIdx)}>delete</button>
			{:else if activeModule === 'assumptions' && assumptionsList[selectedAssumptionIdx]}
				<button class="ghost danger tiny" onclick={() => deleteItem(selectedAssumptionIdx)}>delete</button>
			{:else if activeModule === 'titles' && titlesList[selectedTitleIdx]}
				<button class="ghost danger tiny" onclick={() => deleteItem(selectedTitleIdx)}>delete</button>
			{/if}
		</div>

		<div class="form-scroll">
			{#if activeModule === 'life' && lifeList[selectedLifeIdx]}
				{@const item = lifeList[selectedLifeIdx]}
				<div class="form-group">
					<label for="life-id">ID</label>
					<input id="life-id" type="text" bind:value={item.id} />
				</div>
				<div class="form-group">
					<label for="life-name">Common Name</label>
					<input id="life-name" type="text" bind:value={item.name} />
				</div>
				<div class="form-group">
					<label for="life-scientific">Scientific Name</label>
					<input id="life-scientific" type="text" bind:value={item.scientificName} />
				</div>
				<div class="form-row">
					<div class="form-group">
						<label for="life-category">Category</label>
						<select id="life-category" bind:value={item.category}>
							<option value="aquatic">aquatic</option>
							<option value="terrestrial">terrestrial</option>
							<option value="atmospheric">atmospheric</option>
						</select>
					</div>
					<div class="form-group">
						<label for="life-domain">Domain</label>
						<select id="life-domain" bind:value={item.domain}>
							<option value="plant">plant</option>
							<option value="animal">animal</option>
							<option value="ecosystem">ecosystem</option>
							<option value="geology">geology</option>
							<option value="weather">weather</option>
						</select>
					</div>
				</div>
				<div class="form-row">
					<div class="form-group">
						<label for="life-insight">Insight weight ({item.insightWeight})</label>
						<input id="life-insight" type="range" min="0.1" max="5.0" step="0.1" bind:value={item.insightWeight} />
					</div>
					<div class="form-group">
						<label for="life-ease">Study ease ({item.studyEase})</label>
						<input id="life-ease" type="range" min="0.1" max="3.0" step="0.1" bind:value={item.studyEase} />
					</div>
				</div>
				<div class="form-group">
					<span class="label-text">Requires (Select dependencies)</span>
					<div class="checkbox-grid">
						{#each conditionsList as c}
							<button class="chip-btn" class:active={item.requires.includes(c.id)} onclick={() => toggleRequire(item, c.id)}>
								{c.name}
							</button>
						{/each}
					</div>
				</div>
				<div class="form-group">
					<label for="life-notice">Stage 1: Notice (Unobserved description)</label>
					<textarea id="life-notice" rows="2" bind:value={item.notice}></textarea>
				</div>
				<div class="form-group">
					<label for="life-observe">Stage 2: Observe (First look description)</label>
					<textarea id="life-observe" rows="2" bind:value={item.observe}></textarea>
				</div>
				<div class="form-group">
					<label for="life-study">Stage 3: Study (Patterns observed)</label>
					<textarea id="life-study" rows="2" bind:value={item.study}></textarea>
				</div>
				<div class="form-group">
					<label for="life-know">Stage 4: Know (Full knowledge description)</label>
					<textarea id="life-know" rows="2" bind:value={item.know}></textarea>
				</div>

			{:else if activeModule === 'journal' && journalList[selectedJournalIdx]}
				{@const item = journalList[selectedJournalIdx]}
				<div class="form-group">
					<label for="journal-id">ID</label>
					<input id="journal-id" type="text" bind:value={item.id} />
				</div>
				<div class="form-row">
					<div class="form-group">
						<label for="journal-atconditions">At Conditions Written</label>
						<input id="journal-atconditions" type="number" min="0" max="30" bind:value={item.atConditions} />
					</div>
					<div class="form-group">
						<label for="journal-band">Favor Band</label>
						<select id="journal-band" bind:value={item.band}>
							<option value="low">low</option>
							<option value="even">even</option>
							<option value="high">high</option>
						</select>
					</div>
				</div>
				<div class="form-group">
					<label for="journal-text">Journal Text</label>
					<textarea id="journal-text" rows="8" bind:value={item.text}></textarea>
				</div>

			{:else if activeModule === 'conditions' && conditionsList[selectedConditionIdx]}
				{@const item = conditionsList[selectedConditionIdx]}
				<div class="form-group">
					<label for="cond-id">ID</label>
					<input id="cond-id" type="text" bind:value={item.id} />
				</div>
				<div class="form-group">
					<label for="cond-name">Name</label>
					<input id="cond-name" type="text" bind:value={item.name} />
				</div>
				<div class="form-group">
					<label for="cond-phrase">Phrase (Grimoire statement)</label>
					<input id="cond-phrase" type="text" bind:value={item.phrase} />
				</div>
				<div class="form-row">
					<div class="form-group">
						<label for="cond-enables">Enables</label>
						<input id="cond-enables" type="text" bind:value={item.enables} />
					</div>
					<div class="form-group" style="flex:0;min-width:100px">
						<label for="cond-cost">Cost</label>
						<input id="cond-cost" type="number" min="1" max="10" bind:value={item.cost} />
					</div>
				</div>

			{:else if activeModule === 'emergences' && emergencesList[selectedEmergenceIdx]}
				{@const item = emergencesList[selectedEmergenceIdx]}
				<div class="form-group">
					<label for="em-id">ID</label>
					<input id="em-id" type="text" bind:value={item.id} />
				</div>
				<div class="form-group">
					<label for="em-name">Name</label>
					<input id="em-name" type="text" bind:value={item.name} />
				</div>
				<div class="form-row">
					<div class="form-group">
						<label for="em-from-0">Prerequisite 1</label>
						<select id="em-from-0" bind:value={item.from[0]}>
							{#each conditionsList as c}
								<option value={c.id}>{c.name}</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="em-from-1">Prerequisite 2</label>
						<select id="em-from-1" bind:value={item.from[1]}>
							{#each conditionsList as c}
								<option value={c.id}>{c.name}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="form-group">
					<label for="em-note">Note (Narrative description)</label>
					<textarea id="em-note" rows="3" bind:value={item.note}></textarea>
				</div>

			{:else if activeModule === 'assumptions' && assumptionsList[selectedAssumptionIdx]}
				{@const item = assumptionsList[selectedAssumptionIdx]}
				<div class="form-group">
					<label for="assump-id">ID</label>
					<input id="assump-id" type="text" bind:value={item.id} />
				</div>
				<div class="form-group">
					<label for="assump-group">Group</label>
					<select id="assump-group" bind:value={item.group}>
						<option value="temporal">temporal</option>
						<option value="spatial">spatial</option>
						<option value="biochemical">biochemical</option>
						<option value="relational">relational</option>
					</select>
				</div>
				<div class="form-group">
					<label for="assump-text">Assumption Statement</label>
					<textarea id="assump-text" rows="3" bind:value={item.text}></textarea>
				</div>

			{:else if activeModule === 'titles' && titlesList[selectedTitleIdx]}
				{@const item = titlesList[selectedTitleIdx]}
				<div class="form-group">
					<label for="title-id">ID</label>
					<input id="title-id" type="text" bind:value={item.id} />
				</div>
				<div class="form-group">
					<label for="title-name">Title Name</label>
					<input id="title-name" type="text" bind:value={item.name} />
				</div>
				<div class="form-group">
					<label for="title-earned">Earned Note</label>
					<textarea id="title-earned" rows="3" bind:value={item.earnedNote}></textarea>
				</div>
			{/if}
		</div>
	</section>

	<!-- Preview & Output Pane -->
	<section class="preview-pane">
		<div class="pane-header">
			<h3>preview & output</h3>
			<button class="ghost tiny" onclick={handleCopy}>
				{copied ? 'copied!' : 'copy code'}
			</button>
		</div>

		<div class="preview-scroll">
			<!-- Previews -->
			<div class="preview-box">
				<h4>In-Game Representation</h4>
				{#if activeModule === 'life' && lifeList[selectedLifeIdx]}
					{@const item = lifeList[selectedLifeIdx]}
					<div class="ledger-mock">
						<div class="ledger-header">
							<h5>{item.name} <em>{item.scientificName}</em></h5>
							<span class="category-badge">{item.category} · {item.domain}</span>
						</div>
						<ul class="ledger-stages">
							<li><span class="stage-num">01</span> <span class="stage-text">{item.notice}</span></li>
							<li><span class="stage-num">02</span> <span class="stage-text">{item.observe}</span></li>
							<li><span class="stage-num">03</span> <span class="stage-text">{item.study}</span></li>
							<li><span class="stage-num">04</span> <span class="stage-text font-accent">{item.know}</span></li>
						</ul>
					</div>
				{:else if activeModule === 'journal' && journalList[selectedJournalIdx]}
					{@const item = journalList[selectedJournalIdx]}
					<div class="journal-mock">
						<p class="journal-label">from her journal</p>
						<p class="journal-text">{item.text}</p>
					</div>
				{:else if activeModule === 'conditions' && conditionsList[selectedConditionIdx]}
					{@const item = conditionsList[selectedConditionIdx]}
					<div class="condition-mock">
						<span class="spell-phrase">"{item.phrase}"</span>
						<span class="spell-enables">Enables: {item.enables}</span>
					</div>
				{:else}
					<p class="preview-placeholder">Live preview not applicable for this module.</p>
				{/if}
			</div>

			<!-- Generated Code Output -->
			<div class="code-box">
				<h4>Generated TypeScript</h4>
				<pre><code>{generatedCode}</code></pre>
			</div>
		</div>
	</section>
</main>

<style>
	:root {
		--bg: #0b0717;
		--text: #c5b8e0;
		--muted: #625085;
		--periwinkle: #a496f0;
		--leafeon-pink: #f5a3b8;
		--cyan: #8eddd4;
		--print-pink: #dbb8e8;
		--panel: rgba(18, 12, 34, 0.4);
		--panel-accent: rgba(245, 163, 184, 0.08);
		--rule: rgba(164, 150, 240, 0.15);
		--font-display: 'Cormorant Garamond', Georgia, serif;
		--font-body: 'Lora', Georgia, serif;
		--font-ui: 'Space Grotesk', system-ui, sans-serif;
		--font-mono: 'DM Mono', monospace;
		--font-hand: 'IM Fell DW Pica', Georgia, serif;
	}

	:global(html, body) {
		background-color: var(--bg);
		color: var(--text);
		font-family: var(--font-body);
		margin: 0;
		padding: 0;
		height: 100%;
		overflow: hidden;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 1.6rem;
		height: 48px;
		background: rgba(11, 7, 23, 0.75);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-bottom: 1px solid var(--rule);
	}
	.brand {
		font-family: var(--font-ui);
		font-size: 0.78rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--periwinkle);
		text-decoration: none;
	}
	.brand:hover {
		color: var(--leafeon-pink);
	}
	.ghost {
		font-family: var(--font-ui);
		color: var(--periwinkle);
		font-size: 0.78rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: none;
	}
	.ghost:hover {
		color: var(--cyan);
	}
	.ghost.tiny {
		font-size: 0.65rem;
	}
	.ghost.danger {
		color: #e8859a;
	}

	.studio-layout {
		display: grid;
		grid-template-columns: 180px 240px 1fr 1fr;
		height: calc(100vh - 48px);
		background: #080512;
	}

	/* Sidebar */
	.sidebar {
		background: #06040d;
		border-right: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		padding: 1rem 0;
	}
	.sidebar button {
		background: none;
		border: none;
		font-family: var(--font-ui);
		text-transform: uppercase;
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		color: var(--muted);
		padding: 0.8rem 1.2rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.sidebar button:hover {
		color: var(--periwinkle);
		background: rgba(164, 150, 240, 0.05);
	}
	.sidebar button.active {
		color: var(--leafeon-pink);
		background: rgba(245, 163, 184, 0.06);
		border-left: 2px solid var(--leafeon-pink);
	}

	/* Item List Pane */
	.item-list-pane {
		border-right: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		background: #080512;
	}
	.pane-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.8rem 1.1rem;
		border-bottom: 1px solid var(--rule);
		background: rgba(18, 12, 34, 0.2);
	}
	.pane-header h3 {
		font-family: var(--font-ui);
		text-transform: uppercase;
		font-size: 0.74rem;
		letter-spacing: 0.16em;
		color: var(--periwinkle);
		margin: 0;
	}
	.list-container {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
	.list-item {
		background: none;
		border: none;
		border-bottom: 1px solid rgba(164, 150, 240, 0.08);
		padding: 0.9rem 1.1rem;
		text-align: left;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		transition: background 0.18s ease;
	}
	.list-item:hover {
		background: rgba(164, 150, 240, 0.04);
	}
	.list-item.active {
		background: rgba(245, 163, 184, 0.05);
	}
	.item-title {
		font-family: var(--font-display);
		font-size: 1.05rem;
		color: var(--text);
	}
	.list-item.active .item-title {
		color: var(--leafeon-pink);
	}
	.item-sub {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	/* Form Pane */
	.form-pane {
		border-right: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		background: #090615;
	}
	.form-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.form-group label, .form-group .label-text {
		font-family: var(--font-ui);
		font-size: 0.64rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--periwinkle);
		opacity: 0.85;
		display: inline-block;
	}
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.8rem;
	}
	input[type="text"], input[type="number"], select, textarea {
		background: var(--panel);
		color: var(--text);
		border: 1px solid var(--rule);
		border-radius: 4px;
		font-family: var(--font-body);
		font-size: 0.92rem;
		padding: 0.5rem 0.65rem;
		outline: none;
		transition: border-color 0.2s ease;
	}
	input:focus, select:focus, textarea:focus {
		border-color: var(--leafeon-pink);
	}
	input[type="range"] {
		accent-color: var(--leafeon-pink);
		background: var(--panel);
		height: 6px;
		border-radius: 3px;
		outline: none;
	}
	.checkbox-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding: 0.2rem 0;
	}
	.chip-btn {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		text-transform: lowercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		background: var(--panel);
		border: 1px solid var(--rule);
		border-radius: 100px;
		padding: 4px 12px;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.chip-btn:hover {
		color: var(--periwinkle);
		border-color: var(--periwinkle);
	}
	.chip-btn.active {
		color: var(--bg);
		background: var(--leafeon-pink);
		border-color: var(--leafeon-pink);
	}

	/* Preview Pane */
	.preview-pane {
		display: flex;
		flex-direction: column;
		background: #080512;
	}
	.preview-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 1.6rem;
	}
	.preview-box {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.preview-box h4, .code-box h4 {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
		margin: 0;
	}
	.preview-placeholder {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.86rem;
		color: var(--muted);
		padding: 1rem 0;
	}

	/* Ledger Mock */
	.ledger-mock {
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: var(--panel);
		padding: 1rem;
	}
	.ledger-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		border-bottom: 1px solid rgba(164, 150, 240, 0.15);
		padding-bottom: 0.5rem;
		margin-bottom: 0.8rem;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.ledger-header h5 {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 400;
		color: var(--cream);
		margin: 0;
	}
	.ledger-header h5 em {
		font-size: 0.78rem;
		font-family: var(--font-mono);
		font-style: italic;
		color: var(--muted);
		margin-left: 0.4rem;
	}
	.category-badge {
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.ledger-stages {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ledger-stages li {
		display: flex;
		gap: 0.8rem;
		align-items: flex-start;
		font-size: 0.86rem;
		line-height: 1.45;
	}
	.stage-num {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		color: var(--muted);
		margin-top: 0.15rem;
	}
	.stage-text {
		color: var(--text);
	}
	.font-accent {
		color: var(--leafeon-pink);
		font-style: italic;
	}

	/* Journal Mock */
	.journal-mock {
		border-left: 2px solid var(--leafeon-pink);
		background: var(--panel-accent);
		padding: 0.8rem 1rem;
		border-radius: 0 4px 4px 0;
	}
	.journal-label {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0 0 0.3rem;
	}
	.journal-text {
		font-family: var(--font-hand);
		font-size: 1.15rem;
		line-height: 1.45;
		color: var(--cream);
		margin: 0;
	}

	/* Condition Mock */
	.condition-mock {
		border: 1px dashed var(--rule);
		border-radius: 6px;
		padding: 0.8rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		background: rgba(18, 12, 34, 0.15);
	}
	.spell-phrase {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-style: italic;
		color: var(--cyan);
	}
	.spell-enables {
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--muted);
	}

	/* Code box */
	.code-box {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.code-box pre {
		background: #04030a;
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 0.9rem;
		overflow-x: auto;
		margin: 0;
	}
	.code-box code {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text);
		line-height: 1.5;
	}

	@media (max-width: 1200px) {
		.studio-layout {
			grid-template-columns: 160px 200px 1fr 1fr;
		}
	}
</style>
