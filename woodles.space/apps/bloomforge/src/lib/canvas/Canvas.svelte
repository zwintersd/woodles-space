<script lang="ts">
	import {
		Background,
		BackgroundVariant,
		Controls,
		SvelteFlow,
		type Connection,
		type Edge,
		type Node,
		type NodeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { currencyById } from '../format.js';
	import { deriveEdges, deriveNodes } from '@woodles/incremental-core';
	import { applyConnection } from '../connect.js';
	import EmojiIcon from '../EmojiIcon.svelte';
	import { playtest } from '../playtest.svelte.js';
	import { studio } from '../studio.svelte.js';
	import CurrencyNode from './nodes/CurrencyNode.svelte';
	import GeneratorNode from './nodes/GeneratorNode.svelte';
	import MilestoneNode from './nodes/MilestoneNode.svelte';
	import NoteNode from './nodes/NoteNode.svelte';
	import PrestigeNode from './nodes/PrestigeNode.svelte';
	import UnlockNode from './nodes/UnlockNode.svelte';
	import UpgradeNode from './nodes/UpgradeNode.svelte';

	interface Props {
		/** Surfaced by the shell as a transient toast. */
		onmessage?: (message: string) => void;
	}

	let { onmessage }: Props = $props();

	const nodeTypes: NodeTypes = {
		currency: CurrencyNode,
		generator: GeneratorNode,
		upgrade: UpgradeNode,
		prestige: PrestigeNode,
		unlock: UnlockNode,
		milestone: MilestoneNode,
		note: NoteNode
	};

	/**
	 * Svelte Flow owns these arrays while it drags and selects, so they are
	 * plain `$state.raw` rather than `$derived`. The effect below rebuilds them
	 * from the def — and because positions are only written back on drag *stop*,
	 * the def doesn't change mid-drag and the rebuild can't fight the drag.
	 */
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	$effect(() => {
		nodes = buildNodes();
	});

	$effect(() => {
		edges = buildEdges();
	});

	function buildNodes(): Node[] {
		const entities = deriveNodes(studio.def).map((node) => ({
			id: node.id,
			type: node.kind,
			position: { ...node.position },
			data: {},
			selected: studio.selectedId === node.id,
			// The note is dragged by its whole surface; entity cards keep the
			// default handles so an edge can be pulled off them.
			class: 'bf-node'
		}));

		const notes = studio.def.notes.map((note) => ({
			id: note.id,
			type: 'note',
			position: { ...note.position },
			data: {},
			selectable: false,
			class: 'bf-note'
		}));

		return [...entities, ...notes];
	}

	function buildEdges(): Edge[] {
		const running = playtest.running;

		return deriveEdges(studio.def).map((edge) => {
			const base: Edge = {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				type: 'bezier',
				label: edge.label,
				class: `bf-edge bf-edge--${edge.kind}`
			};

			switch (edge.kind) {
				case 'production': {
					// Tinted with what flows along it, so a two-currency economy
					// reads at a glance.
					const colour = currencyById(studio.def, edge.target)?.color ?? 'var(--bf-generator)';
					return { ...base, animated: running, style: `stroke: ${colour}; stroke-width: 2;` };
				}
				case 'modifier':
					return { ...base, style: 'stroke: var(--bf-upgrade); stroke-width: 1.75;' };
				case 'award':
					return { ...base, animated: running, style: 'stroke: var(--bf-prestige); stroke-width: 1.75;' };
				case 'requirement':
					return {
						...base,
						style: 'stroke: var(--bf-faint); stroke-width: 1.5; stroke-dasharray: 5 4;'
					};
			}
		});
	}

	function onconnect(connection: Connection): void {
		let outcome = { ok: false, message: '' };
		studio.edit((def) => {
			outcome = applyConnection(def, connection.source, connection.target);
		});
		// A refused drag still pushed a history entry; take it straight back so
		// undo doesn't end up with a no-op step in it.
		if (!outcome.ok) studio.undo();
		onmessage?.(outcome.message);
	}
</script>

<div class="canvas">
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		{onconnect}
		fitView
		fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
		minZoom={0.2}
		maxZoom={2}
		nodesDraggable
		elementsSelectable
		deleteKey={null}
		proOptions={{ hideAttribution: false }}
		onnodedragstart={() => studio.beginGesture()}
		onnodedragstop={({ targetNode, nodes: dragged }) => {
			for (const node of dragged.length ? dragged : targetNode ? [targetNode] : []) {
				if (studio.def.notes.some((note) => note.id === node.id)) studio.moveNote(node.id, node.position);
				else studio.moveNode(node.id, node.position);
			}
		}}
		onnodeclick={({ node }) => {
			if (!studio.def.notes.some((note) => note.id === node.id)) studio.select(node.id);
		}}
		onpaneclick={() => studio.select(null)}
		onedgeclick={({ edge }) => studio.select(edge.source)}
	>
		<Background variant={BackgroundVariant.Dots} gap={26} size={1.4} bgColor="var(--bf-canvas)" patternColor="#e6dbe9" />
		<Controls showLock={false} />
	</SvelteFlow>

	<!-- Decorative garden corners, per the mockup. Purely atmosphere. -->
	<span class="corner corner--tl"><EmojiIcon char="🌸" size={26} /></span>
	<span class="corner corner--br"><EmojiIcon char="🌿" size={26} /></span>
</div>

<style>
	.canvas {
		position: relative;
		height: 100%;
		border-radius: var(--bf-radius-lg);
		border: 1px solid var(--bf-rule);
		background: var(--bf-canvas);
		box-shadow: var(--bf-shadow-soft);
		overflow: hidden;
	}

	.corner {
		position: absolute;
		opacity: 0.22;
		pointer-events: none;
		user-select: none;
	}

	.corner--tl {
		top: 14px;
		left: 16px;
	}

	.corner--br {
		right: 16px;
		bottom: 52px;
	}

	.canvas :global(.svelte-flow) {
		background: var(--bf-canvas);
	}

	/* Svelte Flow draws its own node chrome; ours is the card inside. */
	.canvas :global(.svelte-flow__node) {
		border: 0;
		padding: 0;
		background: none;
		border-radius: var(--bf-radius);
		font-family: var(--bf-font-sans);
	}

	.canvas :global(.svelte-flow__node.selected) {
		box-shadow: none;
	}

	.canvas :global(.svelte-flow__handle) {
		width: 8px;
		height: 8px;
		border: 1.5px solid var(--bf-surface);
		background: var(--bf-faint);
		opacity: 0;
		transition: opacity 120ms ease, background 120ms ease;
	}

	.canvas :global(.svelte-flow__node:hover .svelte-flow__handle),
	.canvas :global(.svelte-flow__node.selected .svelte-flow__handle) {
		opacity: 1;
	}

	.canvas :global(.svelte-flow__handle:hover) {
		background: var(--bf-accent);
	}

	.canvas :global(.svelte-flow__edge-text) {
		font-size: 10px;
		fill: var(--bf-muted);
		font-family: var(--bf-font-sans);
	}

	.canvas :global(.svelte-flow__edge-textbg) {
		fill: var(--bf-canvas);
	}

	.canvas :global(.svelte-flow__controls) {
		box-shadow: var(--bf-shadow-soft);
		border-radius: var(--bf-radius-sm);
		overflow: hidden;
	}

	.canvas :global(.svelte-flow__controls-button) {
		border-bottom: 1px solid var(--bf-rule);
		background: var(--bf-surface);
		fill: var(--bf-ink-soft);
	}

	.canvas :global(.svelte-flow__controls-button:hover) {
		background: var(--bf-accent-soft);
	}

	.canvas :global(.svelte-flow__attribution) {
		background: transparent;
		font-size: 9px;
	}

	.canvas :global(.svelte-flow__attribution a) {
		color: var(--bf-faint);
	}
</style>
