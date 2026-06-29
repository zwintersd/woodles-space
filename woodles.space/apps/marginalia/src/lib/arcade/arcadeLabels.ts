export type ArcadeStartLabel = 'start' | 'again' | 'restart';

export function arcadeStartLabel(phase: string, rounds: number): ArcadeStartLabel {
	if (phase === 'running') return 'restart';
	return rounds > 0 ? 'again' : 'start';
}

export function arcadeReadyAgainLabel(rounds: number): 'ready?' | 'again?' {
	return rounds > 0 ? 'again?' : 'ready?';
}
