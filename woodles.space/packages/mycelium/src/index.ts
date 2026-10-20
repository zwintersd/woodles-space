import { defaultCardStyle, normalizeCardStyle, type CardStyle } from './cardstyle';

export * from './cardstyle';

export const MYCELIUM_STORAGE_KEY = 'woodles.mycelium.people.v1';
export const MYCELIUM_STORAGE_VERSION = 1;
export const MYCELIUM_CHANGE_EVENT = 'woodles:mycelium-people-changed';
/** Keep portraits small enough to share the origin's localStorage with other apps. */
export const MAX_PORTRAIT_LENGTH = 500_000;

export type ContactDetail = { id: string; label: string; value: string };

export type Person = {
	id: string;
	name: string;
	pronouns: string;
	role: string;
	organization: string;
	emails: ContactDetail[];
	phones: ContactDetail[];
	links: ContactDetail[];
	location: string;
	/** Empty or an ISO calendar date (YYYY-MM-DD). */
	birthday: string;
	tags: string[];
	notes: string;
	portrait: string | null;
	favorite: boolean;
	cardStyle: CardStyle;
	createdAt: string;
	updatedAt: string;
};

export type PersonInput = Pick<Person, 'name'> & Partial<Omit<Person, 'id' | 'name' | 'createdAt' | 'updatedAt'>>;
/** Structurally compatible with the shared HomeSuite WoodlesRef, without app imports. */
export type PersonRef = { app: 'mycelium'; kind: 'person'; id: string };
export type WoodlesRef = { app: string; kind: string; id: string };
export type MyceliumIssue = {
	kind: 'unavailable' | 'parse' | 'version' | 'validation' | 'quota' | 'write' | 'conflict' | 'missing';
	message: string;
};
export type PeopleResult = { people: Person[]; issue: MyceliumIssue | null };
export type PeopleImportResult = { people: Person[]; added: number; updated: number; unchanged: number };

export class MyceliumError extends Error {
	constructor(public readonly issue: MyceliumIssue) {
		super(issue.message);
		this.name = 'MyceliumError';
	}
}

export interface PeopleStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

type PeopleEnvelope = { format: 'woodles-mycelium'; version: number; people: Person[] };
type StoreOptions = {
	storage?: PeopleStorage | null;
	now?: () => string;
	makeId?: () => string;
	eventTarget?: EventTarget | null;
};
type Snapshot = PeopleResult & { raw: string | null; storage: PeopleStorage | null };

const PERSON_KEYS = ['id', 'name', 'pronouns', 'role', 'organization', 'emails', 'phones', 'links', 'location', 'birthday', 'tags', 'notes', 'portrait', 'favorite', 'cardStyle', 'createdAt', 'updatedAt'];
const INPUT_KEYS = PERSON_KEYS.filter((key) => !['id', 'createdAt', 'updatedAt'].includes(key));
const STYLE_KEYS = Object.keys(defaultCardStyle());
const COLOR_KEYS = ['accent', 'bg1', 'bg2', 'borderColor', 'titleColor'] as const;

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function text(value: unknown, max = 1_000): value is string {
	return typeof value === 'string' && value.length <= max;
}

function validId(value: unknown): value is string {
	return typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(value);
}

function isoDate(value: unknown): value is string {
	return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
		Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function birthday(value: unknown): value is string {
	return value === '' || (typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) &&
		isoDate(`${value}T00:00:00.000Z`));
}

function details(value: unknown): value is ContactDetail[] {
	return Array.isArray(value) && value.length <= 100 && value.every((item) =>
		record(item) && exactKeys(item, ['id', 'label', 'value']) && validId(item.id) &&
		text(item.label, 100) && text(item.value, 2_000)) &&
		new Set(value.map((item: ContactDetail) => item.id)).size === value.length;
}

function validStyle(value: unknown): value is CardStyle {
	if (!record(value) || !exactKeys(value, STYLE_KEYS)) return false;
	const normalized = normalizeCardStyle(value);
	return STYLE_KEYS.every((key) => value[key] === normalized[key as keyof CardStyle]) &&
		COLOR_KEYS.every((key) => typeof value[key] === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value[key]));
}

function validPortrait(value: unknown): value is string | null {
	return value === null || (typeof value === 'string' && value.length <= MAX_PORTRAIT_LENGTH &&
		/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(value));
}

export function isPerson(value: unknown): value is Person {
	if (!record(value) || !exactKeys(value, PERSON_KEYS)) return false;
	return validId(value.id) && text(value.name, 200) && value.name.trim().length > 0 &&
		text(value.pronouns, 100) && text(value.role, 200) && text(value.organization, 200) &&
		details(value.emails) && details(value.phones) && details(value.links) && text(value.location, 500) &&
		birthday(value.birthday) && Array.isArray(value.tags) && value.tags.length <= 100 &&
		value.tags.every((tag) => text(tag, 100) && tag.trim().length > 0) &&
		text(value.notes, 50_000) && validPortrait(value.portrait) && typeof value.favorite === 'boolean' &&
		validStyle(value.cardStyle) && isoDate(value.createdAt) && isoDate(value.updatedAt) &&
		value.createdAt <= value.updatedAt;
}

function fail(kind: MyceliumIssue['kind'], message: string): never {
	throw new MyceliumError({ kind, message });
}

function decode(raw: string): Person[] {
	let document: unknown;
	try { document = JSON.parse(raw); }
	catch { return fail('parse', 'Mycelium could not read the saved contacts. The original data has been kept.'); }
	if (!record(document) || document.format !== 'woodles-mycelium') {
		return fail('validation', 'This is not a Mycelium contact file.');
	}
	if (document.version !== MYCELIUM_STORAGE_VERSION) {
		return fail('version', 'This contact file uses an unsupported Mycelium version.');
	}
	if (!exactKeys(document, ['format', 'version', 'people']) || !Array.isArray(document.people) ||
		!document.people.every(isPerson) || new Set(document.people.map((person: Person) => person.id)).size !== document.people.length) {
		return fail('validation', 'Mycelium found invalid contact data. No contacts were changed.');
	}
	return document.people;
}

function encode(people: Person[], pretty = false): string {
	return JSON.stringify({ format: 'woodles-mycelium', version: MYCELIUM_STORAGE_VERSION, people } satisfies PeopleEnvelope, null, pretty ? 2 : undefined);
}

export function personRef(id: string): PersonRef {
	if (!validId(id)) return fail('validation', 'A person reference needs a valid contact ID.');
	return { app: 'mycelium', kind: 'person', id };
}

/** Browser defaults; dependency injection keeps the data contract testable without Svelte. */
export function createPeopleStore(options: StoreOptions = {}) {
	const now = options.now ?? (() => new Date().toISOString());
	const makeId = options.makeId ?? (() => globalThis.crypto?.randomUUID?.() ?? `person-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
	const events = () => options.eventTarget !== undefined ? options.eventTarget : typeof window === 'undefined' ? null : window;

	function snapshot(): Snapshot {
		let storage: PeopleStorage | null = null;
		try {
			storage = options.storage !== undefined ? options.storage : typeof localStorage === 'undefined' ? null : localStorage;
			if (!storage) return fail('unavailable', 'Browser storage is unavailable. Contacts could not be loaded.');
			const raw = storage.getItem(MYCELIUM_STORAGE_KEY);
			return { raw, storage, people: raw === null ? [] : decode(raw), issue: null };
		} catch (error) {
			return { raw: null, storage, people: [], issue: error instanceof MyceliumError ? error.issue : {
				kind: 'unavailable', message: 'Browser storage could not be read. Contacts have been kept as they were.'
			} };
		}
	}

	function ready(): Snapshot {
		const result = snapshot();
		if (result.issue) throw new MyceliumError(result.issue);
		return result;
	}

	function loadPeople(): PeopleResult {
		const { people, issue } = snapshot();
		return { people, issue };
	}

	function listPeople(): Person[] { return ready().people; }
	function getPerson(id: string): Person | null { return listPeople().find((person) => person.id === id) ?? null; }

	function timestamp(after?: string): string {
		const stamp = now();
		if (!isoDate(stamp)) return fail('validation', 'Mycelium could not determine the current time.');
		return after && stamp <= after ? new Date(Date.parse(after) + 1).toISOString() : stamp;
	}

	function save(previous: Snapshot, people: Person[]): void {
		if (!people.every(isPerson)) return fail('validation', 'Check the contact fields before saving.');
		try {
			if (!previous.storage) return fail('unavailable', 'Browser storage is unavailable.');
			// Refuse a write if the snapshot changed while the mutation was being prepared.
			if (previous.storage.getItem(MYCELIUM_STORAGE_KEY) !== previous.raw) {
				return fail('conflict', 'Contacts changed in another tab. Try saving again.');
			}
			previous.storage.setItem(MYCELIUM_STORAGE_KEY, encode(people));
		} catch (error) {
			if (error instanceof MyceliumError) throw error;
			const quota = record(error) && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
			return fail(quota ? 'quota' : 'write', quota
				? 'Browser storage is full. Try a smaller portrait or export your contacts before freeing space.'
				: 'The browser could not save this contact. Your saved contacts have been kept.');
		}
		events()?.dispatchEvent(new Event(MYCELIUM_CHANGE_EVENT));
	}

	function checkInput(input: unknown): asserts input is Partial<PersonInput> {
		if (!record(input) || Object.keys(input).some((key) => !INPUT_KEYS.includes(key))) {
			return fail('validation', 'Contact changes contain unsupported fields.');
		}
	}

	function createPerson(input: PersonInput): Person {
		checkInput(input);
		const previous = ready();
		const stamp = timestamp();
		const person: Person = {
			pronouns: '', role: '', organization: '', emails: [], phones: [], links: [],
			location: '', birthday: '', tags: [], notes: '', portrait: null, favorite: false,
			cardStyle: defaultCardStyle(), ...input, id: makeId(), createdAt: stamp, updatedAt: stamp
		};
		if (!isPerson(person)) return fail('validation', `Check the contact fields. A name is required; portraits must be PNG, JPEG, WebP, or GIF under ${MAX_PORTRAIT_LENGTH / 1_000} KB of encoded data.`);
		if (previous.people.some((existing) => existing.id === person.id)) return fail('conflict', 'A contact with that ID already exists. Try creating the card again.');
		save(previous, [...previous.people, person]);
		return structuredClone(person);
	}

	function updatePerson(id: string, patch: Partial<PersonInput>): Person {
		checkInput(patch);
		const previous = ready();
		const current = previous.people.find((person) => person.id === id);
		if (!current) return fail('missing', 'This contact no longer exists.');
		const person = { ...current, ...patch, updatedAt: timestamp(current.updatedAt) };
		if (!isPerson(person)) return fail('validation', 'Check the contact fields before saving.');
		save(previous, previous.people.map((item) => item.id === id ? person : item));
		return structuredClone(person);
	}

	function deletePerson(id: string): boolean {
		const previous = ready();
		if (!previous.people.some((person) => person.id === id)) return false;
		save(previous, previous.people.filter((person) => person.id !== id));
		return true;
	}

	function resolvePerson(ref: WoodlesRef): Person | null {
		return ref?.app === 'mycelium' && ref.kind === 'person' && validId(ref.id) ? getPerson(ref.id) : null;
	}

	function subscribePeople(callback: (result: PeopleResult) => void): () => void {
		const target = events();
		if (!target) return () => {};
		const onChange = () => callback(loadPeople());
		const onStorage = (event: Event) => {
			const storageEvent = event as StorageEvent;
			if (storageEvent.key !== null && storageEvent.key !== MYCELIUM_STORAGE_KEY) return;
			let storage: PeopleStorage | null = null;
			try { storage = options.storage !== undefined ? options.storage : typeof localStorage === 'undefined' ? null : localStorage; } catch { /* Report through loadPeople. */ }
			if (storageEvent.storageArea && storageEvent.storageArea !== storage) return;
			onChange();
		};
		target.addEventListener(MYCELIUM_CHANGE_EVENT, onChange);
		target.addEventListener('storage', onStorage);
		return () => {
			target.removeEventListener(MYCELIUM_CHANGE_EVENT, onChange);
			target.removeEventListener('storage', onStorage);
		};
	}

	function exportPeople(): string { return encode(ready().people, true); }

	function importPeople(json: string): PeopleImportResult {
		const incoming = decode(json);
		const previous = ready();
		const merged = new Map(previous.people.map((person) => [person.id, person]));
		let added = 0, updated = 0, unchanged = 0;
		for (const person of incoming) {
			const current = merged.get(person.id);
			if (!current) { merged.set(person.id, person); added++; }
			else if (person.updatedAt > current.updatedAt) {
				merged.set(person.id, { ...person, createdAt: current.createdAt < person.createdAt ? current.createdAt : person.createdAt });
				updated++;
			} else { unchanged++; }
		}
		const people = [...merged.values()];
		if (added || updated) save(previous, people);
		return { people, added, updated, unchanged };
	}

	return { loadPeople, listPeople, getPerson, createPerson, updatePerson, deletePerson, resolvePerson, subscribePeople, exportPeople, importPeople };
}

const browserStore = createPeopleStore();
export const { loadPeople, listPeople, getPerson, createPerson, updatePerson, deletePerson, resolvePerson, subscribePeople, exportPeople, importPeople } = browserStore;
