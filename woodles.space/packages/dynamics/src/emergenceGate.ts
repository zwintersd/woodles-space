/**
 * Shape H — Emergence Gate. An AND of arbitrary size, bought piecemeal,
 * applied once: an instance is revealed the moment every token it requires
 * has been permanently obtained. Nothing about a gate reverses — this
 * function is stateless on purpose; the permanence lives entirely in
 * `owned`, which the caller alone decides how to persist.
 */

export function isRevealed(required: readonly string[], owned: ReadonlySet<string>): boolean {
	return required.every((id) => owned.has(id));
}
