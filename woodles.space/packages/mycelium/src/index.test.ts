import { describe, expect, it } from 'vitest';
import {
	createPeopleStore, defaultCardStyle, isPerson, MAX_PORTRAIT_LENGTH, MYCELIUM_CHANGE_EVENT,
	MYCELIUM_STORAGE_KEY, MyceliumError, personRef, type PeopleResult, type PeopleStorage
} from './index';

class MemoryStorage implements PeopleStorage {
	data = new Map<string, string>();
	getItem(key: string) { return this.data.get(key) ?? null; }
	setItem(key: string, value: string) { this.data.set(key, value); }
}

function setup(storage = new MemoryStorage(), options: { now?: () => string; makeId?: () => string; eventTarget?: EventTarget } = {}) {
	let id = 0;
	const store = createPeopleStore({ storage, now: () => '2026-10-19T12:00:00.000Z', makeId: () => `person-${++id}`, ...options });
	return { store, storage };
}

describe('Mycelium canonical people', () => {
	it('starts empty and round-trips all fields without creating sample contacts', () => {
		const { store, storage } = setup();
		expect(store.loadPeople()).toEqual({ people: [], issue: null });
		expect(storage.data.size).toBe(0);
		const person = store.createPerson({
			name: 'Alex', pronouns: 'they/them', role: 'Artist', organization: 'Studio',
			emails: [{ id: 'email-1', label: 'Work', value: 'alex@example.com' }],
			phones: [{ id: 'phone-1', label: 'Mobile', value: '+1 555 123 4567' }],
			links: [{ id: 'link-1', label: 'Portfolio', value: 'https://example.com' }],
			location: 'New York', birthday: '1990-02-28', tags: ['friends'], notes: 'Likes paper.',
			portrait: 'data:image/png;base64,YWJj', favorite: true,
			cardStyle: { ...defaultCardStyle(), frame: 'cinema', finish: 'holo', texture: 'linen' }
		});
		expect(isPerson(person)).toBe(true);
		expect(store.getPerson(person.id)).toEqual(person);
		expect(JSON.parse(storage.getItem(MYCELIUM_STORAGE_KEY)!)).toMatchObject({ version: 1, people: [person] });
		person.tags.push('only the returned copy');
		expect(store.getPerson(person.id)?.tags).toEqual(['friends']);
	});

	it('resolves only the complete owner/kind/id identity and retains identity through edits', () => {
		const { store } = setup();
		const person = store.createPerson({ name: 'Alex' });
		expect(personRef(person.id)).toEqual({ app: 'mycelium', kind: 'person', id: person.id });
		expect(store.resolvePerson(personRef(person.id))).toEqual(person);
		expect(store.resolvePerson({ ...personRef(person.id), app: 'bestiary' })).toBeNull();
		expect(store.resolvePerson({ ...personRef(person.id), kind: 'creature' })).toBeNull();
		const edited = store.updatePerson(person.id, { name: 'Alex Rivera' });
		expect(edited).toMatchObject({ id: person.id, createdAt: person.createdAt, name: 'Alex Rivera' });
		expect(edited.updatedAt > person.updatedAt).toBe(true);
		expect(() => store.updatePerson(person.id, { id: 'different' } as never)).toThrow(MyceliumError);
	});

	it('re-reads canonical storage for each mutation instead of writing an old list', () => {
		const { store: firstTab, storage } = setup();
		const { store: secondTab } = setup(storage, { makeId: () => 'second-person' });
		const alex = firstTab.createPerson({ name: 'Alex' });
		const staleCard = firstTab.getPerson(alex.id)!;
		secondTab.createPerson({ name: 'Robin' });
		secondTab.updatePerson(alex.id, { organization: 'New studio' });
		firstTab.updatePerson(staleCard.id, { notes: 'A note from the first tab' });
		expect(firstTab.listPeople()).toHaveLength(2);
		expect(firstTab.getPerson(alex.id)).toMatchObject({ organization: 'New studio', notes: 'A note from the first tab' });
	});

	it('detects a storage change during mutation preparation and preserves that change', () => {
		const storage = new MemoryStorage();
		const { store: secondTab } = setup(storage, { makeId: () => 'second-person' });
		const { store: firstTab } = setup(storage, {
			makeId: () => { secondTab.createPerson({ name: 'Concurrent person' }); return 'first-person'; }
		});
		expect(() => firstTab.createPerson({ name: 'First person' })).toThrow('Contacts changed in another tab');
		expect(secondTab.listPeople().map((person) => person.name)).toEqual(['Concurrent person']);
	});

	it.each(['{', JSON.stringify({ format: 'woodles-mycelium', version: 2, people: [] }), JSON.stringify({ format: 'woodles-mycelium', version: 1, people: [{ id: 'partial' }] })])('fails closed on corrupt or future data and never overwrites it: %s', (raw) => {
		const { store, storage } = setup();
		storage.setItem(MYCELIUM_STORAGE_KEY, raw);
		expect(store.loadPeople()).toMatchObject({ people: [], issue: { kind: expect.any(String) } });
		expect(() => store.createPerson({ name: 'Alex' })).toThrow(MyceliumError);
		expect(() => store.importPeople(JSON.stringify({ format: 'woodles-mycelium', version: 1, people: [] }))).toThrow(MyceliumError);
		expect(() => store.exportPeople()).toThrow(MyceliumError);
		expect(storage.getItem(MYCELIUM_STORAGE_KEY)).toBe(raw);
	});

	it('reports blocked storage and quota failures without claiming a save', () => {
		const missing = createPeopleStore({ storage: null });
		expect(missing.loadPeople().issue?.kind).toBe('unavailable');
		const storage = new MemoryStorage();
		const { store } = setup(storage);
		store.createPerson({ name: 'Saved person' });
		const previous = storage.getItem(MYCELIUM_STORAGE_KEY);
		storage.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
		expect(() => store.createPerson({ name: 'Unsaved person' })).toThrow('Browser storage is full');
		expect(storage.getItem(MYCELIUM_STORAGE_KEY)).toBe(previous);
		expect(store.listPeople()).toHaveLength(1);
	});

	it('rejects invalid fields, duplicate detail identities, CSS injection, and oversized/unsafe portraits', () => {
		const { store, storage } = setup();
		for (const input of [
			{ name: ' ' }, { name: 'Alex', birthday: '1990-02-31' },
			{ name: 'Alex', emails: [{ id: 'same', label: '', value: 'a@a' }, { id: 'same', label: '', value: 'b@b' }] },
			{ name: 'Alex', cardStyle: { ...defaultCardStyle(), accent: '#fff;display:none' } },
			{ name: 'Alex', portrait: 'data:image/svg+xml;base64,YWJj' },
			{ name: 'Alex', portrait: `data:image/png;base64,${'a'.repeat(MAX_PORTRAIT_LENGTH)}` }
		]) expect(() => store.createPerson(input)).toThrow(MyceliumError);
		expect(storage.data.size).toBe(0);
	});

	it('exports and imports a strict merge by stable IDs, retaining other local people and newer local edits', () => {
		const { store: source } = setup();
		const alex = source.createPerson({ name: 'Alex', notes: 'Original' });
		const { store: destination } = setup(undefined, { makeId: () => 'local-person' });
		destination.createPerson({ name: 'Local contact' });
		expect(destination.importPeople(source.exportPeople())).toMatchObject({ added: 1, updated: 0, unchanged: 0 });
		expect(destination.listPeople()).toHaveLength(2);
		expect(destination.getPerson(alex.id)).toEqual(alex);
		source.updatePerson(alex.id, { notes: 'Newer export' });
		expect(destination.importPeople(source.exportPeople())).toMatchObject({ added: 0, updated: 1 });
		destination.updatePerson(alex.id, { notes: 'Newest local edit' });
		expect(destination.importPeople(source.exportPeople())).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
		expect(destination.getPerson(alex.id)?.notes).toBe('Newest local edit');
	});

	it('rejects the entire import when any record is invalid or IDs are duplicated', () => {
		const { store, storage } = setup();
		const person = store.createPerson({ name: 'Alex' });
		const previous = storage.getItem(MYCELIUM_STORAGE_KEY);
		for (const people of [[person, { ...person, id: 'other', name: '' }], [person, person]]) {
			expect(() => store.importPeople(JSON.stringify({ format: 'woodles-mycelium', version: 1, people }))).toThrow(MyceliumError);
			expect(storage.getItem(MYCELIUM_STORAGE_KEY)).toBe(previous);
		}
	});

	it('publishes successful local changes, observes other tabs, ignores unrelated keys, and cleans up', () => {
		const eventTarget = new EventTarget();
		const { store } = setup(undefined, { eventTarget });
		const results: PeopleResult[] = [];
		const cleanup = store.subscribePeople((result) => results.push(result));
		store.createPerson({ name: 'Alex' });
		expect(results.at(-1)?.people[0]?.name).toBe('Alex');
		const irrelevant = Object.assign(new Event('storage'), { key: 'other-key' });
		eventTarget.dispatchEvent(irrelevant);
		expect(results).toHaveLength(1);
		eventTarget.dispatchEvent(Object.assign(new Event('storage'), { key: MYCELIUM_STORAGE_KEY }));
		expect(results).toHaveLength(2);
		cleanup();
		eventTarget.dispatchEvent(new Event(MYCELIUM_CHANGE_EVENT));
		store.createPerson({ name: 'Robin' });
		expect(results).toHaveLength(2);
	});

	it('deletes only its own canonical person and leaves unresolved references harmless', () => {
		const { store, storage } = setup();
		const person = store.createPerson({ name: 'Alex' });
		storage.setItem('woodles.homesuite.folders.v1', 'shell metadata');
		expect(store.deletePerson(person.id)).toBe(true);
		expect(store.resolvePerson(personRef(person.id))).toBeNull();
		expect(store.deletePerson(person.id)).toBe(false);
		expect(storage.getItem('woodles.homesuite.folders.v1')).toBe('shell metadata');
	});
});
