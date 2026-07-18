<script lang="ts">
	interface Props {
		roomId: string;
	}

	let { roomId }: Props = $props();
</script>

<g class="paper-scene" aria-hidden="true">
	<image
		class="paper-texture"
		href="/arcade/living-paper-texture.webp"
		width="540"
		height="320"
		preserveAspectRatio="none"
	/>
	<rect class="paper-wash" width="540" height="320" rx="6" />

	{#if roomId === 'foyer'}
		<g class="scene-foyer">
			<path class="paper-curtain" d="M 18 44 q 24 15 48 0 v 62 q -24 15 -48 0 Z" />
			<path class="paper-curtain" d="M 472 44 q 24 15 48 0 v 62 q -24 15 -48 0 Z" />
			<path class="shelf-line" d="M 32 282 h 54 m 350 0 h 54" />
			<path class="pressed-vine" d="M 70 276 q 8 -30 23 -43 q 11 -10 3 -22 m -11 27 q 20 3 24 15" />
			<path class="pressed-vine right" d="M 468 276 q -8 -30 -23 -43 q -11 -10 -3 -22 m 11 27 q -20 3 -24 15" />
		</g>
	{:else if roomId === 'shaft'}
		<g class="scene-shaft">
			<path class="ink-drip" d="M 44 42 v 86 q 0 14 9 22 q 9 -8 9 -22 V 42 Z" />
			<path class="ink-drip small" d="M 84 42 v 50 q 0 9 6 15 q 6 -6 6 -15 V 42 Z" />
			<path class="bookmark" d="M 466 34 h 20 v 86 l -10 -11 l -10 11 Z" />
			<path class="thread-line" d="M 134 56 q 46 26 16 68 q -18 28 20 44" />
		</g>
	{:else if roomId === 'alcove'}
		<g class="scene-alcove">
			<path class="thorn-vine" d="M 28 274 q 36 -54 75 -30 q 22 12 40 -12" />
			<path class="thorn-vine right" d="M 512 274 q -36 -54 -75 -30 q -22 12 -40 -12" />
			<path class="margin-flower" d="M 70 86 q 12 -18 24 0 q -12 18 -24 0 M 82 74 v 24" />
			<path class="margin-flower" d="M 450 86 q 12 -18 24 0 q -12 18 -24 0 M 462 74 v 24" />
		</g>
	{:else if roomId === 'vault'}
		<g class="scene-vault">
			<path class="illumination" d="M 34 54 h 72 v 46 h -72 Z M 42 62 h 56 v 30 h -56 Z" />
			<path class="illumination-mark" d="M 64 84 l 10 -14 l 10 14 l -10 14 Z" />
			<path class="gilded-rule" d="M 146 66 h 144 M 146 82 h 116 M 146 98 h 132" />
			<path class="archive-sun" d="M 468 64 l 8 14 l 16 -2 l -2 16 l 14 8 l -14 8 l 2 16 l -16 -2 l -8 14 l -8 -14 l -16 2 l 2 -16 l -14 -8 l 14 -8 l -2 -16 l 16 2 Z" />
		</g>
	{:else if roomId === 'wing-walk'}
		<g class="scene-wing-walk">
			<path class="paper-cloud" d="M 58 80 q 18 -22 37 0 q 20 -14 36 8 q -21 14 -72 6 Z" />
			<path class="paper-cloud" d="M 390 78 q 17 -20 36 0 q 19 -12 35 8 q -23 14 -70 6 Z" />
			<path class="flight-thread" d="M 154 78 q 60 -36 114 2 q 48 32 110 -10" />
		</g>
	{:else}
		<g class="scene-return-press">
			<path class="press-block" d="M 44 70 h 58 v 38 h -58 Z M 60 58 h 26 v 12 h -26 Z" />
			<path class="press-block" d="M 438 70 h 58 v 38 h -58 Z M 454 58 h 26 v 12 h -26 Z" />
			<path class="ribbon-loop" d="M 136 92 q 36 -36 72 0 t 72 0 t 72 0" />
			<path class="type-rule" d="M 176 120 h 186 M 192 134 h 154" />
		</g>
	{/if}

	<g class="paper-motes">
		<circle cx="84" cy="138" r="2" />
		<circle cx="194" cy="84" r="1.5" />
		<circle cx="358" cy="118" r="2" />
		<circle cx="468" cy="206" r="1.5" />
	</g>
</g>

<style>
	.paper-texture {
		opacity: 0.28;
		mix-blend-mode: multiply;
	}
	.paper-wash {
		fill: rgba(253, 246, 227, 0.36);
	}
	.paper-scene :global(path),
	.paper-scene :global(circle) {
		vector-effect: non-scaling-stroke;
	}
	.paper-curtain {
		fill: rgba(108, 113, 196, 0.1);
		stroke: rgba(108, 113, 196, 0.3);
		stroke-width: 1.5;
	}
	.shelf-line,
	.pressed-vine,
	.thread-line,
	.flight-thread {
		fill: none;
		stroke: rgba(38, 139, 210, 0.34);
		stroke-linecap: round;
		stroke-width: 1.5;
	}
	.pressed-vine.right,
	.thorn-vine.right {
		transform: scaleX(-1);
		transform-origin: center;
	}
	.ink-drip {
		fill: rgba(38, 139, 210, 0.12);
		stroke: rgba(38, 139, 210, 0.3);
		stroke-width: 1.5;
	}
	.ink-drip.small {
		opacity: 0.72;
	}
	.bookmark {
		fill: rgba(211, 54, 130, 0.13);
		stroke: rgba(211, 54, 130, 0.35);
		stroke-width: 1.5;
	}
	.thorn-vine {
		fill: none;
		stroke: rgba(220, 50, 47, 0.34);
		stroke-linecap: round;
		stroke-width: 2;
	}
	.margin-flower {
		fill: rgba(211, 54, 130, 0.1);
		stroke: rgba(211, 54, 130, 0.38);
		stroke-width: 1.5;
	}
	.illumination {
		fill: rgba(181, 137, 0, 0.08);
		stroke: rgba(181, 137, 0, 0.34);
		stroke-width: 1.5;
	}
	.illumination-mark,
	.archive-sun {
		fill: rgba(181, 137, 0, 0.14);
		stroke: rgba(181, 137, 0, 0.46);
		stroke-width: 1.5;
	}
	.gilded-rule,
	.type-rule {
		fill: none;
		stroke: rgba(181, 137, 0, 0.3);
		stroke-linecap: round;
		stroke-width: 1.5;
	}
	.paper-cloud {
		fill: rgba(238, 232, 213, 0.64);
		stroke: rgba(108, 113, 196, 0.22);
		stroke-width: 1.5;
	}
	.press-block {
		fill: rgba(88, 110, 117, 0.08);
		stroke: rgba(88, 110, 117, 0.3);
		stroke-width: 1.5;
	}
	.ribbon-loop {
		fill: none;
		stroke: rgba(211, 54, 130, 0.32);
		stroke-linecap: round;
		stroke-width: 2;
	}
	.paper-motes circle {
		fill: rgba(181, 137, 0, 0.34);
		animation: paper-drift 4s ease-in-out infinite alternate;
	}
	.paper-motes circle:nth-child(2) {
		animation-delay: -1.4s;
	}
	.paper-motes circle:nth-child(3) {
		animation-delay: -2.1s;
	}
	@keyframes paper-drift {
		to {
			transform: translateY(-7px);
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.paper-motes circle {
			animation: none;
		}
	}
</style>
