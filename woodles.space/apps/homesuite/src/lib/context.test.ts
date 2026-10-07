import { afterEach, expect, it, vi } from 'vitest';
import { createHomeSuiteContext } from '@shared/homesuiteContext';
import { HOMESUITE_CHANNEL, type HomeSuiteShellMessage } from '@shared/homesuiteBridge';

afterEach(() => vi.unstubAllGlobals());

it('executes only the enabled action of the current request, once', () => {
	const postMessage = vi.fn();
	vi.stubGlobal('window', { parent: { postMessage }, location: { origin: 'https://woodles.test' } });
	const context = createHomeSuiteContext();
	const first = vi.fn(), second = vi.fn(), disabled = vi.fn();
	const target = { label: 'One row', detail: 'Local record' };
	context.open({ x: 0, y: 0 }, target, [{ id: 'remove', label: 'Remove', run: first }]);
	const oldId = postMessage.mock.calls[0][0].requestId;
	context.open({ x: 10, y: 20 }, target, [{ id: 'remove', label: 'Remove', run: second }, { id: 'disabled', label: 'Disabled', enabled: false, run: disabled }]);
	const currentId = postMessage.mock.calls[1][0].requestId;
	const message = (id: string, commandId: string): HomeSuiteShellMessage => ({ channel: HOMESUITE_CHANNEL, source: 'shell', type: 'action', action: 'context-command', requestId: id, commandId });
	context.handle(message(oldId, 'remove'));
	expect(first).not.toHaveBeenCalled();
	context.handle(message(currentId, 'remove'));
	context.handle(message(currentId, 'remove'));
	expect(second).toHaveBeenCalledTimes(1);
	context.open({ x: 0, y: 0 }, target, [{ id: 'disabled', label: 'Disabled', enabled: false, run: disabled }]);
	context.handle(message(postMessage.mock.calls[2][0].requestId, 'disabled'));
	expect(disabled).not.toHaveBeenCalled();
	expect(postMessage.mock.calls[0][1]).toBe('https://woodles.test');
	expect(postMessage.mock.calls[0][0].target.actions[0]).not.toHaveProperty('run');
});

it('discards dismissed actions', () => {
	const postMessage = vi.fn();
	vi.stubGlobal('window', { parent: { postMessage }, location: { origin: 'https://woodles.test' } });
	const context = createHomeSuiteContext();
	const run = vi.fn();
	context.open({ x: 0, y: 0 }, { label: 'A', detail: '' }, [{ id: 'remove', label: 'Remove', run }]);
	const requestId = postMessage.mock.calls[0][0].requestId;
	context.handle({ channel: HOMESUITE_CHANNEL, source: 'shell', type: 'action', action: 'context-dismiss', requestId });
	context.handle({ channel: HOMESUITE_CHANNEL, source: 'shell', type: 'action', action: 'context-command', requestId, commandId: 'remove' });
	expect(run).not.toHaveBeenCalled();
});

it('sends a reactive reference as cloneable plain data', () => {
	const postMessage = vi.fn((message) => structuredClone(message));
	vi.stubGlobal('window', { parent: { postMessage }, location: { origin: 'https://woodles.test' } });
	const ref = new Proxy({ app: 'whiteboard', kind: 'board', id: 'board-1' }, {});
	expect(() => createHomeSuiteContext().open({ x: 0, y: 0 }, { label: 'A board', detail: 'Reference', ref }, [])).not.toThrow();
	expect(postMessage.mock.calls[0][0].target.ref).toEqual({ app: 'whiteboard', kind: 'board', id: 'board-1' });
});
