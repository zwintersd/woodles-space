<script lang="ts">
	// Renders whatever's new in the achievementToasts queue as a short-lived
	// banner, then lets it go — the achievement itself is already persisted
	// (Book.achievementsUnlocked) by the time this ever sees it. Same
	// queue-and-seed pattern as the arcade route's notice stack
	// (routes/arcade/+page.svelte), brought to the main game surface, which
	// had no toast mechanism of its own before this.
	import { achievementToasts, type AchievementToast } from './achievementToasts.svelte';

	const TOAST_MS = 5200;

	let active = $state<AchievementToast[]>([]);
	let lastSeenId = achievementToasts.length ? achievementToasts[achievementToasts.length - 1].id : 0;
	let timers: ReturnType<typeof setTimeout>[] = [];

	$effect(() => {
		const fresh = achievementToasts.filter((t) => t.id > lastSeenId);
		if (fresh.length === 0) return;
		lastSeenId = achievementToasts[achievementToasts.length - 1].id;
		for (const toast of fresh) {
			active = [...active, toast];
			const timer = setTimeout(() => {
				active = active.filter((t) => t.id !== toast.id);
			}, TOAST_MS);
			timers.push(timer);
		}
	});

	$effect(() => {
		return () => {
			for (const timer of timers) clearTimeout(timer);
		};
	});
</script>

{#if active.length > 0}
	<div class="achievement-stack" aria-live="polite">
		{#each active as toast (toast.id)}
			<p class="achievement-toast">
				<span class="kicker">achievement</span>
				<span class="name">{toast.achievement.title}</span>
				<span class="note">{toast.achievement.note}</span>
			</p>
		{/each}
	</div>
{/if}

<style>
	.achievement-stack {
		position: fixed;
		top: 4.4rem;
		right: 1rem;
		z-index: 60;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
		pointer-events: none;
	}
	.achievement-toast {
		margin: 0;
		max-width: 18rem;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.5rem 0.75rem;
		text-align: right;
		background: var(--panel);
		border: 1px solid var(--rule);
		border-right: 2px solid var(--leafeon-pink);
		border-radius: 0.4rem;
		box-shadow: 0 4px 14px rgba(52, 40, 29, 0.18);
		animation: achievement-pop 5.2s ease-out forwards;
	}
	.kicker {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--periwinkle);
	}
	.name {
		font-family: var(--font-display);
		font-size: 1.05rem;
		color: var(--leafeon-pink);
	}
	.note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--muted);
	}
	@keyframes achievement-pop {
		0% {
			opacity: 0;
			transform: translateY(-0.4rem);
		}
		6% {
			opacity: 1;
			transform: translateY(0);
		}
		90% {
			opacity: 1;
			transform: translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateY(-0.3rem);
		}
	}
	@media (max-width: 520px) {
		.achievement-stack {
			left: 0.6rem;
			right: 0.6rem;
			top: 3.6rem;
			align-items: stretch;
		}
		.achievement-toast {
			text-align: left;
			max-width: none;
		}
	}
</style>
