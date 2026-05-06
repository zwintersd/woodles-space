<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	const MONTHS = [
		'jan', 'feb', 'mar', 'apr', 'may', 'jun',
		'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
	];

	let date = $state('');
	let time = $state('');
	let tickClass = $state('');
	let interval: ReturnType<typeof setInterval> | undefined;

	function pad(n: number) {
		return String(n).padStart(2, '0');
	}

	function tick() {
		const now = new Date();
		date =
			DAYS[now.getDay()] +
			' ' +
			pad(now.getDate()) +
			' ' +
			MONTHS[now.getMonth()] +
			' ' +
			now.getFullYear();
		const t = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
		if (t !== time) {
			tickClass = '';
			// force reflow so animation restarts
			requestAnimationFrame(() => (tickClass = 'tick'));
			time = t;
		}
	}

	onMount(() => {
		tick();
		interval = setInterval(tick, 1000);
	});
	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

<span class="clock-date">{date}</span>
<span class="clock-sep">·</span>
<span class="clock-time {tickClass}">{time}</span>

<style>
	.clock-date {
		color: var(--muted);
		opacity: 0.7;
	}
	.clock-sep {
		color: var(--lavender);
		opacity: 0.9;
	}
	.clock-time {
		color: var(--text);
		opacity: 0.8;
	}
	.clock-time.tick {
		animation: tick-fade 0.45s ease;
	}
	@keyframes tick-fade {
		0% {
			opacity: 0.8;
		}
		20% {
			opacity: 0.3;
		}
		100% {
			opacity: 0.8;
		}
	}
</style>
