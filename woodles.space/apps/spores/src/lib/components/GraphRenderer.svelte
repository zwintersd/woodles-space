<script lang="ts">
	import { tick as simTick, initNodes, kineticEnergy, type SimNode } from '$lib/graph';

	interface GraphNode {
		id: string;
		name: string;
		type?: string;
		role?: string;
		faction?: string;
		description?: string;
		voiceActor?: string;
	}

	interface GraphEdge {
		from: string;
		to: string;
		type?: string;
		label?: string;
	}

	interface GraphScript {
		title: string;
		description?: string;
		nodes: GraphNode[];
		edges: GraphEdge[];
	}

	let { graphScript, onclose }: { graphScript: GraphScript; onclose: () => void } = $props();

	// ── simulation state ───────────────────────────────────────────────

	let svgEl: SVGSVGElement;
	let svgWidth = $state(800);
	let svgHeight = $state(600);

	// SimNodes with their linked GraphNode for display
	interface RichNode extends SimNode {
		graphNode: GraphNode;
	}

	let simNodes = $state<RichNode[]>([]);

	let animating = $state(false);
	let rafId = 0;

	function startSim() {
		const rawSim = initNodes(graphScript.nodes.map((n) => n.id), 220);
		simNodes = rawSim.map((sn) => ({
			...sn,
			graphNode: graphScript.nodes.find((n) => n.id === sn.id)!
		}));
		animating = true;
		scheduleFrame();
	}

	function scheduleFrame() {
		rafId = requestAnimationFrame(() => {
			simTick(simNodes, graphScript.edges);
			// Svelte 5 proxy tracks in-place mutations on $state arrays
			simNodes = simNodes;
			const energy = kineticEnergy(simNodes);
			if (energy > 0.08) scheduleFrame();
			else animating = false;
		});
	}

	function restartSim() {
		if (!animating) {
			animating = true;
			scheduleFrame();
		}
	}

	$effect(() => {
		startSim();
		return () => cancelAnimationFrame(rafId);
	});

	// ── pan / zoom ─────────────────────────────────────────────────────

	let panX = $state(0);
	let panY = $state(0);
	let zoom = $state(1);

	let isPanning = $state(false);
	let panStartX = 0;
	let panStartY = 0;
	let panStartPX = 0;
	let panStartPY = 0;

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = -e.deltaY * 0.001;
		const newZoom = Math.max(0.25, Math.min(4, zoom * (1 + delta)));
		if (!svgEl) { zoom = newZoom; return; }
		const rect = svgEl.getBoundingClientRect();
		const mx = e.clientX - rect.left - svgWidth / 2;
		const my = e.clientY - rect.top - svgHeight / 2;
		panX = mx - (mx - panX) * (newZoom / zoom);
		panY = my - (my - panY) * (newZoom / zoom);
		zoom = newZoom;
	}

	function handleBgDown(e: PointerEvent) {
		if ((e.target as SVGElement).closest('.graph-node')) return;
		isPanning = true;
		panStartX = e.clientX;
		panStartY = e.clientY;
		panStartPX = panX;
		panStartPY = panY;
		(e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
	}

	function handleBgMove(e: PointerEvent) {
		if (!isPanning) return;
		panX = panStartPX + (e.clientX - panStartX);
		panY = panStartPY + (e.clientY - panStartY);
	}

	function handleBgUp() {
		isPanning = false;
	}

	// ── node drag ──────────────────────────────────────────────────────

	let draggingId = $state<string | null>(null);

	function screenToSim(clientX: number, clientY: number) {
		if (!svgEl) return { x: 0, y: 0 };
		const rect = svgEl.getBoundingClientRect();
		return {
			x: (clientX - rect.left - svgWidth / 2 - panX) / zoom,
			y: (clientY - rect.top - svgHeight / 2 - panY) / zoom
		};
	}

	function handleNodeDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		draggingId = id;
		const node = simNodes.find((n) => n.id === id);
		if (node) node.pinned = true;
		(e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
	}

	function handleNodeMove(e: PointerEvent, id: string) {
		if (draggingId !== id) return;
		const pos = screenToSim(e.clientX, e.clientY);
		const node = simNodes.find((n) => n.id === id);
		if (node) { node.x = pos.x; node.y = pos.y; node.vx = 0; node.vy = 0; }
		restartSim();
	}

	function handleNodeUp(_e: PointerEvent, _id: string) {
		draggingId = null;
	}

	// ── selection ──────────────────────────────────────────────────────

	let selectedId = $state<string | null>(null);
	let hoveredId = $state<string | null>(null);

	function handleNodeClick(e: PointerEvent, id: string) {
		e.stopPropagation();
		selectedId = selectedId === id ? null : id;
	}

	function handleCanvasClick() {
		selectedId = null;
	}

	let selectedNode = $derived(
		selectedId ? simNodes.find((n) => n.id === selectedId)?.graphNode ?? null : null
	);

	// ── visual helpers ─────────────────────────────────────────────────

	const FACTION_PALETTE = [
		'#f08fb8', '#6ce5e8', '#c4a86a', '#b8a8e8',
		'#a8c4e8', '#e8a8c4', '#a8e8c4', '#e8c4a8',
		'#c8a8e8', '#a8e8e8'
	];

	function factionHash(s: string): number {
		let h = 0;
		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
		return Math.abs(h);
	}

	function nodeColor(gn: GraphNode): string {
		const faction = gn.faction ?? gn.type ?? 'unknown';
		return FACTION_PALETTE[factionHash(faction) % FACTION_PALETTE.length];
	}

	function nodeRadius(gn: GraphNode): number {
		switch (gn.role) {
			case 'protagonist': return 26;
			case 'deuteragonist': case 'antagonist': return 22;
			case 'supporting': return 18;
			case 'minor': return 14;
			default: return 18;
		}
	}

	const EDGE_COLORS: Record<string, string> = {
		bond:       'rgba(240,143,184,0.55)',
		friendship: 'rgba(240,143,184,0.55)',
		rivalry:    'rgba(232,120,100,0.65)',
		enemy:      'rgba(200,70,70,0.65)',
		romance:    'rgba(255,100,170,0.75)',
		family:     'rgba(200,168,100,0.62)',
		ally:       'rgba(108,229,232,0.55)',
		mentor:     'rgba(168,196,232,0.6)',
		voiced_by:  'rgba(130,120,180,0.35)'
	};

	function edgeColor(type?: string): string {
		return EDGE_COLORS[type ?? ''] ?? 'rgba(162,150,200,0.38)';
	}

	function edgePath(ax: number, ay: number, bx: number, by: number): string {
		const mx = (ax + bx) / 2;
		const my = (ay + by) / 2;
		const dx = bx - ax;
		const dy = by - ay;
		const len = Math.sqrt(dx * dx + dy * dy) || 1;
		const offset = len * 0.18;
		const cpx = mx - (dy / len) * offset;
		const cpy = my + (dx / len) * offset;
		return `M ${ax} ${ay} Q ${cpx} ${cpy} ${bx} ${by}`;
	}

	// Lookup SimNode by id for edge drawing
	function nodePos(id: string): { x: number; y: number } | null {
		return simNodes.find((n) => n.id === id) ?? null;
	}

	// Edge label position: point on the bezier at t=0.5 with a small offset
	function edgeLabelPos(
		ax: number, ay: number, bx: number, by: number
	): { x: number; y: number } {
		const mx = (ax + bx) / 2;
		const my = (ay + by) / 2;
		const dx = bx - ax;
		const dy = by - ay;
		const len = Math.sqrt(dx * dx + dy * dy) || 1;
		return {
			x: mx - (dy / len) * (len * 0.18) * 0.5,
			y: my + (dx / len) * (len * 0.18) * 0.5
		};
	}

	// Highlight edges adjacent to the selected node
	function edgeHighlighted(edge: GraphEdge): boolean {
		if (!selectedId && !hoveredId) return false;
		const focus = selectedId ?? hoveredId;
		return edge.from === focus || edge.to === focus;
	}

	// Dim nodes not connected to the selected node
	function nodeDimmed(id: string): boolean {
		if (!selectedId) return false;
		if (id === selectedId) return false;
		return !graphScript.edges.some((e) => e.from === selectedId && e.to === id || e.to === selectedId && e.from === id);
	}

	// ── resize ─────────────────────────────────────────────────────────

	let containerEl: HTMLDivElement;

	$effect(() => {
		if (!containerEl) return;
		const ro = new ResizeObserver((entries) => {
			const r = entries[0].contentRect;
			svgWidth = r.width;
			svgHeight = r.height;
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	// ── keyboard ───────────────────────────────────────────────────────

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="graph-overlay" role="dialog" aria-modal="true" aria-label="Relationship graph">
	<div class="graph-header">
		<button class="close-btn" onclick={onclose}>← back</button>
		<div class="header-info">
			<h2 class="series-title">{graphScript.title}</h2>
			{#if graphScript.description}
				<p class="series-desc">{graphScript.description}</p>
			{/if}
		</div>
		<div class="graph-legend">
			{#each Object.entries(EDGE_COLORS).slice(0, 6) as [type, color]}
				<span class="legend-item">
					<span class="legend-line" style="background:{color}"></span>
					{type}
				</span>
			{/each}
		</div>
	</div>

	<div class="graph-body">
		<!-- SVG canvas -->
		<div class="canvas-wrap" bind:this={containerEl}>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<svg
				bind:this={svgEl}
				class="graph-svg"
				width={svgWidth}
				height={svgHeight}
				onclick={handleCanvasClick}
				onwheel={handleWheel}
				onpointerdown={handleBgDown}
				onpointermove={handleBgMove}
				onpointerup={handleBgUp}
				role="img"
				aria-label="Character relationship graph"
			>
				<g transform="translate({svgWidth / 2 + panX},{svgHeight / 2 + panY}) scale({zoom})">
					<!-- edges -->
					<g class="edges">
						{#each graphScript.edges as edge}
							{@const a = nodePos(edge.from)}
							{@const b = nodePos(edge.to)}
							{#if a && b}
								{@const highlighted = edgeHighlighted(edge)}
								{@const lp = edgeLabelPos(a.x, a.y, b.x, b.y)}
								<path
									d={edgePath(a.x, a.y, b.x, b.y)}
									stroke={edgeColor(edge.type)}
									stroke-width={highlighted ? 2.5 : 1.5}
									fill="none"
									opacity={highlighted ? 1 : 0.65}
									class="edge-path"
								/>
								{#if highlighted && edge.label}
									<text
										x={lp.x}
										y={lp.y}
										class="edge-label"
										fill="rgba(226,218,240,0.85)"
										text-anchor="middle"
										font-size="10"
									>{edge.label}</text>
								{/if}
							{/if}
						{/each}
					</g>

					<!-- nodes -->
					<g class="nodes">
						{#each simNodes as sn}
							{@const gn = sn.graphNode}
							{@const r = nodeRadius(gn)}
							{@const col = nodeColor(gn)}
							{@const isSelected = selectedId === sn.id}
							{@const isHovered = hoveredId === sn.id}
							{@const dimmed = nodeDimmed(sn.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<g
								class="graph-node"
								transform="translate({sn.x},{sn.y})"
								style="cursor:pointer"
								opacity={dimmed ? 0.28 : 1}
								onpointerdown={(e) => handleNodeDown(e, sn.id)}
								onpointermove={(e) => handleNodeMove(e, sn.id)}
								onpointerup={(e) => handleNodeUp(e, sn.id)}
								onclick={(e) => handleNodeClick(e, sn.id)}
								onpointerenter={() => (hoveredId = sn.id)}
								onpointerleave={() => (hoveredId = null)}
								role="button"
								tabindex="0"
								aria-label={gn.name}
							>
								<!-- glow ring when selected -->
								{#if isSelected}
									<circle r={r + 8} fill="none" stroke={col} stroke-width="2" opacity="0.4" />
								{/if}
								<!-- outer ring on hover -->
								{#if isHovered && !isSelected}
									<circle r={r + 5} fill="none" stroke={col} stroke-width="1.5" opacity="0.35" />
								{/if}
								<!-- main circle with radial gradient -->
								<circle r={r} fill={col} opacity={isSelected ? 1 : 0.85} />
								<!-- inner highlight -->
								<circle r={r * 0.45} cx={-r * 0.2} cy={-r * 0.2} fill="white" opacity="0.12" />
								<!-- pinned indicator -->
								{#if sn.pinned}
									<circle r={3} cx={r - 3} cy={-(r - 3)} fill="white" opacity="0.6" />
								{/if}
								<!-- name label -->
								<text
									y={r + 14}
									class="node-label"
									text-anchor="middle"
									font-size="11"
									fill={isSelected || isHovered ? col : 'rgba(226,218,240,0.85)'}
									font-weight={isSelected ? '600' : '400'}
								>{gn.name}</text>
								{#if gn.faction && (isSelected || isHovered)}
									<text
										y={r + 26}
										class="node-sublabel"
										text-anchor="middle"
										font-size="9"
										fill="rgba(162,150,200,0.75)"
									>{gn.faction}</text>
								{/if}
							</g>
						{/each}
					</g>
				</g>
			</svg>

			{#if animating}
				<div class="sim-badge">simulating…</div>
			{/if}

			<div class="canvas-controls">
				<button class="ctrl-btn" onclick={() => { zoom = Math.min(4, zoom * 1.2); }} title="Zoom in">+</button>
				<button class="ctrl-btn" onclick={() => { zoom = Math.max(0.25, zoom / 1.2); }} title="Zoom out">−</button>
				<button class="ctrl-btn" onclick={() => { panX = 0; panY = 0; zoom = 1; }} title="Reset view">⊙</button>
				<button class="ctrl-btn" onclick={startSim} title="Re-run simulation">↺</button>
			</div>
		</div>

		<!-- Node detail panel -->
		{#if selectedNode}
			{@const connections = graphScript.edges.filter(
				(e) => e.from === selectedNode.id || e.to === selectedNode.id
			)}
			<aside class="node-panel">
				<div class="panel-header">
					<div class="panel-dot" style="background:{nodeColor(selectedNode)}"></div>
					<h3 class="panel-name">{selectedNode.name}</h3>
				</div>
				{#if selectedNode.role}
					<div class="panel-row">
						<span class="panel-key">role</span>
						<span class="panel-val">{selectedNode.role}</span>
					</div>
				{/if}
				{#if selectedNode.faction}
					<div class="panel-row">
						<span class="panel-key">faction</span>
						<span class="panel-val">{selectedNode.faction}</span>
					</div>
				{/if}
				{#if selectedNode.description}
					<p class="panel-desc">{selectedNode.description}</p>
				{/if}
				{#if selectedNode.voiceActor}
					<div class="panel-row">
						<span class="panel-key">voice</span>
						<span class="panel-val">{selectedNode.voiceActor}</span>
					</div>
				{/if}

				{#if connections.length > 0}
					<div class="panel-connections">
						<p class="panel-key">connections</p>
						{#each connections as edge}
							{@const otherId = edge.from === selectedNode.id ? edge.to : edge.from}
							{@const otherNode = graphScript.nodes.find((n) => n.id === otherId)}
							{#if otherNode}
								<button
									class="conn-item"
									onclick={() => { selectedId = otherId; }}
								>
									<span
										class="conn-dot"
										style="background:{nodeColor(otherNode)}"
									></span>
									<span class="conn-name">{otherNode.name}</span>
									{#if edge.label}
										<span class="conn-label">{edge.label}</span>
									{:else if edge.type}
										<span class="conn-label">{edge.type}</span>
									{/if}
								</button>
							{/if}
						{/each}
					</div>
				{/if}
			</aside>
		{/if}
	</div>
</div>

<style>
	.graph-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--g-z-overlay, 40);
		background: var(--g-bg, #0d0d1a);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* ── header ── */
	.graph-header {
		flex: 0 0 auto;
		display: flex;
		align-items: flex-start;
		gap: var(--g-space-lg, 1.75rem);
		padding: var(--g-space-md, 1rem) var(--g-space-lg, 1.75rem);
		border-bottom: 1px solid var(--g-rule, rgba(162,150,200,0.15));
		background: var(--g-surface, #13132a);
	}

	.close-btn {
		flex: 0 0 auto;
		font-family: var(--g-font-mono);
		font-size: 0.78rem;
		color: var(--g-muted, #6a6480);
		margin-top: 0.2rem;
		transition: color 0.15s ease;
		white-space: nowrap;
	}
	.close-btn:hover { color: var(--g-flight, #f08fb8); }

	.header-info { flex: 1; min-width: 0; }

	.series-title {
		font-family: var(--g-font-display);
		font-size: 1.5rem;
		font-weight: 400;
		color: var(--g-text, #e2daf0);
		line-height: 1.2;
		margin: 0 0 0.25rem;
	}

	.series-desc {
		font-size: 0.82rem;
		color: var(--g-text-dim, #a09ab8);
		line-height: 1.5;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.graph-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		align-items: center;
		flex: 0 0 auto;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--g-font-mono);
		font-size: 0.68rem;
		color: var(--g-muted, #6a6480);
	}

	.legend-line {
		display: inline-block;
		width: 18px;
		height: 2px;
		border-radius: 1px;
	}

	/* ── body ── */
	.graph-body {
		flex: 1;
		display: flex;
		min-height: 0;
		overflow: hidden;
	}

	/* ── canvas ── */
	.canvas-wrap {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.graph-svg {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
		user-select: none;
	}

	.graph-svg:active { cursor: grabbing; }

	.node-label {
		font-family: var(--g-font-mono, 'DM Mono', monospace);
		pointer-events: none;
	}

	.node-sublabel {
		font-family: var(--g-font-mono, 'DM Mono', monospace);
		pointer-events: none;
	}

	.edge-label {
		font-family: var(--g-font-mono, 'DM Mono', monospace);
		pointer-events: none;
	}

	.graph-node { outline: none; }

	.sim-badge {
		position: absolute;
		bottom: var(--g-space-md, 1rem);
		left: 50%;
		transform: translateX(-50%);
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		color: var(--g-muted, #6a6480);
		background: var(--g-surface, #13132a);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-pill);
		padding: 0.2rem 0.7rem;
		pointer-events: none;
	}

	.canvas-controls {
		position: absolute;
		bottom: var(--g-space-md, 1rem);
		right: var(--g-space-md, 1rem);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.ctrl-btn {
		width: 32px;
		height: 32px;
		background: var(--g-surface, #13132a);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-sm);
		color: var(--g-text-dim, #a09ab8);
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s, color 0.15s;
	}
	.ctrl-btn:hover { border-color: var(--g-flight); color: var(--g-flight); }

	/* ── node detail panel ── */
	.node-panel {
		flex: 0 0 280px;
		background: var(--g-surface, #13132a);
		border-left: 1px solid var(--g-rule);
		overflow-y: auto;
		padding: var(--g-space-lg, 1.75rem) var(--g-space-md, 1rem);
		display: flex;
		flex-direction: column;
		gap: var(--g-space-md, 1rem);
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm, 0.5rem);
	}

	.panel-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex: 0 0 auto;
	}

	.panel-name {
		font-family: var(--g-font-display);
		font-size: 1.25rem;
		font-weight: 400;
		color: var(--g-text, #e2daf0);
		margin: 0;
		line-height: 1.2;
	}

	.panel-row {
		display: flex;
		gap: var(--g-space-sm, 0.5rem);
		align-items: baseline;
	}

	.panel-key {
		font-family: var(--g-font-mono);
		font-size: 0.68rem;
		color: var(--g-muted, #6a6480);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		flex: 0 0 auto;
		min-width: 52px;
	}

	.panel-val {
		font-size: 0.88rem;
		color: var(--g-text-dim, #a09ab8);
	}

	.panel-desc {
		font-family: var(--g-font-body);
		font-size: 0.88rem;
		line-height: 1.6;
		color: var(--g-text-dim, #a09ab8);
		margin: 0;
	}

	.panel-connections {
		display: flex;
		flex-direction: column;
		gap: var(--g-space-xs, 0.25rem);
		margin-top: var(--g-space-xs, 0.25rem);
	}

	.conn-item {
		display: flex;
		align-items: center;
		gap: var(--g-space-sm, 0.5rem);
		width: 100%;
		text-align: left;
		padding: 0.3rem 0.4rem;
		border-radius: var(--g-radius-sm);
		transition: background 0.15s;
		cursor: pointer;
	}
	.conn-item:hover { background: var(--g-surface-2, #1a1a35); }

	.conn-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: 0 0 auto;
	}

	.conn-name {
		font-size: 0.85rem;
		color: var(--g-text-dim, #a09ab8);
		flex: 1;
	}

	.conn-label {
		font-family: var(--g-font-mono);
		font-size: 0.68rem;
		color: var(--g-muted, #6a6480);
	}

	/* scrollbar */
	.node-panel::-webkit-scrollbar { width: 4px; }
	.node-panel::-webkit-scrollbar-track { background: transparent; }
	.node-panel::-webkit-scrollbar-thumb { background: var(--g-border); border-radius: 2px; }
</style>
