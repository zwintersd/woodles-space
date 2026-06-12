export function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function now(): string {
	return new Date().toISOString();
}

export function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateShort(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
