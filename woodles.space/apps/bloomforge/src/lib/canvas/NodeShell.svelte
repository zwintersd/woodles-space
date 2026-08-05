<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { EntityKind, ValidationIssue } from '@woodles/incremental-core';
	import type { Snippet } from 'svelte';
	import EmojiIcon from '../EmojiIcon.svelte';

	/**
	 * The card every entity node wears: type-tinted border, icon, name, and a
	 * slot for whatever stat that kind leads with. Keeping the chrome in one
	 * place is what makes six node types feel like one family.
	 */
	interface Props {
		kind: EntityKind;
		icon: string;
		name: string;
		selected?: boolean;
		dimmed?: boolean;
		issues?: ValidationIssue[];
		subtitle?: string;
		children?: Snippet;
	}

	let { kind, icon, name, selected = false, dimmed = false, issues = [], subtitle, children }: Props = $props();

	const worst = $derived(
		issues.some((issue) => issue.severity === 'error')
			? 'error'
			: issues.length
				? 'warning'
				: null
	);
	const issueTitle = $derived(issues.map((issue) => issue.message).join('\n'));
</script>

<div class="node" data-kind={kind} class:selected class:dimmed>
	<Handle type="target" position={Position.Top} />

	<header>
		<span class="icon"><EmojiIcon char={icon} size={13} /></span>
		<span class="name">{name}</span>
		{#if worst}
			<span class="badge" data-severity={worst} title={issueTitle}>
				{worst === 'error' ? '!' : '?'}
				<span class="sr-only">{issues.length} {worst === 'error' ? 'errors' : 'warnings'}: {issueTitle}</span>
			</span>
		{/if}
	</header>

	{#if subtitle}
		<p class="subtitle">{subtitle}</p>
	{/if}

	{#if children}
		<div class="body">{@render children()}</div>
	{/if}

	<Handle type="source" position={Position.Bottom} />
</div>

<style>
	.node {
		--tint: var(--bf-upgrade);
		--tint-soft: var(--bf-upgrade-soft);
		--tint-line: var(--bf-upgrade-line);

		min-width: 168px;
		max-width: 230px;
		padding: 10px 12px;
		border: 1.5px solid var(--tint-line);
		border-radius: var(--bf-radius);
		background: var(--bf-surface);
		box-shadow: var(--bf-shadow-card);
		transition: box-shadow 140ms ease, border-color 140ms ease, transform 140ms ease;
	}

	.node[data-kind='currency'] {
		--tint: var(--bf-currency);
		--tint-soft: var(--bf-currency-soft);
		--tint-line: var(--bf-currency-line);
	}
	.node[data-kind='generator'] {
		--tint: var(--bf-generator);
		--tint-soft: var(--bf-generator-soft);
		--tint-line: var(--bf-generator-line);
	}
	.node[data-kind='upgrade'] {
		--tint: var(--bf-upgrade);
		--tint-soft: var(--bf-upgrade-soft);
		--tint-line: var(--bf-upgrade-line);
	}
	.node[data-kind='prestige'] {
		--tint: var(--bf-prestige);
		--tint-soft: var(--bf-prestige-soft);
		--tint-line: var(--bf-prestige-line);
	}
	.node[data-kind='unlock'] {
		--tint: var(--bf-unlock);
		--tint-soft: var(--bf-unlock-soft);
		--tint-line: var(--bf-unlock-line);
	}
	.node[data-kind='milestone'] {
		--tint: var(--bf-milestone);
		--tint-soft: var(--bf-milestone-soft);
		--tint-line: var(--bf-milestone-line);
	}

	.node.selected {
		border-color: var(--tint);
		box-shadow: var(--bf-shadow-lift), 0 0 0 3px var(--tint-soft);
	}

	/* Locked behind an unlock during a run — visible, but plainly not yours yet. */
	.node.dimmed {
		opacity: 0.55;
		filter: saturate(0.5);
	}

	header {
		display: flex;
		align-items: center;
		gap: 7px;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: var(--bf-radius-pill);
		background: var(--tint-soft);
		font-size: 13px;
		flex: none;
	}

	.name {
		font-weight: 650;
		font-size: 13px;
		color: var(--bf-ink);
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.badge {
		margin-left: auto;
		display: grid;
		place-items: center;
		width: 17px;
		height: 17px;
		flex: none;
		border-radius: var(--bf-radius-pill);
		font-size: 11px;
		font-weight: 700;
		cursor: help;
	}

	.badge[data-severity='error'] {
		background: var(--bf-danger-soft);
		color: var(--bf-danger);
	}

	.badge[data-severity='warning'] {
		background: var(--bf-warn-soft);
		color: var(--bf-warn);
	}

	.subtitle {
		margin: 6px 0 0;
		font-size: 11px;
		color: var(--bf-muted);
		line-height: 1.35;
	}

	.body {
		margin-top: 8px;
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
