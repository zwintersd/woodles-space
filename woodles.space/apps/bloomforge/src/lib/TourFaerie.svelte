<script lang="ts">
	import { onMount } from 'svelte';
	import { createFaerie, type Faerie } from '@woodles/faerie';
	import { tour } from './tour.svelte.js';
	import { resolveTourTarget, TOUR_PLACEMENT } from './tourFaerie.js';

	/**
	 * Faerie as the tour's pointer. The banner above the canvas owns the words,
	 * the hint and the progress; Faerie only goes to the thing the step is about
	 * and outlines it. It deliberately carries no hint bubble: wherever the
	 * bubble fits it lands on the banner or the canvas — the same mistake
	 * `TourCard` records making with a floating card — and it would only repeat
	 * the hint pill the banner is already showing. It reads the tour and never
	 * writes to it, so a step can't be completed, or skipped, by anything Faerie
	 * does.
	 *
	 * Raw rather than deep state: `Faerie` is a DOM-owning object, not data.
	 */
	let faerie = $state.raw<Faerie | null>(null);

	onMount(() => {
		const instance = createFaerie({ tone: 'lilac', size: 48 });
		// Mounted resting; the tour decides when it appears.
		instance.hide();
		faerie = instance;
		return () => {
			faerie = null;
			instance.destroy();
		};
	});

	$effect(() => {
		if (!faerie) return;
		const step = tour.step;

		if (step) {
			// A resolver rather than an element: the dock swaps panels under the
			// button the step points at, and the sidebar re-renders its rows.
			faerie.attend(() => resolveTourTarget(step.target, document), {
				placement: TOUR_PLACEMENT[step.target],
				// The banner already says what to do; a focus button would raise a bubble.
				focusButton: false
			});
		} else if (tour.active && tour.finished) {
			faerie.celebrate(tour.track === 'advanced' ? "That's the whole schema." : "That's the loop.");
		} else {
			faerie.hide();
		}
	});
</script>
