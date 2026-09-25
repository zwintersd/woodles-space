import { describe, expect, it } from 'vitest';
import { risingEdge, type EdgeLatch } from './edgeLatch.js';

describe('risingEdge', () => {
	it('fires the first time the condition goes true', () => {
		const latch: EdgeLatch = { was: false };
		expect(risingEdge(latch, true)).toBe(true);
	});

	it('does not fire again while the condition keeps holding', () => {
		const latch: EdgeLatch = { was: false };
		risingEdge(latch, true);
		expect(risingEdge(latch, true)).toBe(false);
		expect(risingEdge(latch, true)).toBe(false);
	});

	it('never fires while the condition is false', () => {
		const latch: EdgeLatch = { was: false };
		expect(risingEdge(latch, false)).toBe(false);
	});

	it('fires again after a false in between — a real transition, not a sticky flag', () => {
		const latch: EdgeLatch = { was: false };
		risingEdge(latch, true);
		risingEdge(latch, false);
		expect(risingEdge(latch, true)).toBe(true);
	});
});
