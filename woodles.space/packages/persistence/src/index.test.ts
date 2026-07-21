import { describe, expect, it } from 'vitest';
import { createVersionedStorage, formatBytes, serializedBytes, type StorageLike } from './index';

type Document = { title: string; tags: string[] };

const isDocument = (value: unknown): value is Document =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as Document).title === 'string' &&
	Array.isArray((value as Document).tags) &&
	(value as Document).tags.every((tag) => typeof tag === 'string');

function setup(storage = new MemoryStorage()) {
	return createVersionedStorage<Document>({
		key: 'test.document',
		version: 2,
		fallback: () => ({ title: 'fallback', tags: [] }),
		validate: isDocument,
		migrate: (value, fromVersion) => {
			if (fromVersion === 1 && typeof value === 'object' && value !== null) {
				return { ...value, tags: [] };
			}
			return value;
		},
		storage,
		now: () => '2026-07-21T16:00:00.000Z'
	});
}

describe('versioned persistence', () => {
	it('round-trips a validated document through storage and export', () => {
		const storage = new MemoryStorage();
		const persistence = setup(storage);
		const document = { title: 'Moon notes', tags: ['night'] };

		expect(persistence.save(document).ok).toBe(true);
		expect(persistence.load()).toMatchObject({ value: document, source: 'primary' });

		persistence.clear();
		const imported = persistence.importText(persistence.exportText(document));
		expect(imported).toMatchObject({ ok: true, value: document, migrated: false });
		expect(persistence.load().value).toEqual(document);
	});

	it('migrates an older envelope before returning it', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			'test.document',
			JSON.stringify({
				woodles: 'woodles-persistence',
				schemaVersion: 1,
				savedAt: '2025-01-01T00:00:00.000Z',
				data: { title: 'Old note' }
			})
		);

		expect(setup(storage).load()).toMatchObject({
			value: { title: 'Old note', tags: [] },
			migrated: true,
			source: 'primary'
		});
	});

	it('restores a last-known-good backup when the primary is corrupt', () => {
		const storage = new MemoryStorage();
		const persistence = setup(storage);
		persistence.save({ title: 'First', tags: [] });
		persistence.save({ title: 'Second', tags: [] });
		storage.setItem('test.document', '{broken');

		const result = persistence.load();
		expect(result).toMatchObject({
			value: { title: 'First', tags: [] },
			source: 'backup',
			issue: { kind: 'parse' }
		});
		expect(JSON.parse(storage.getItem('test.document') ?? '{}').data.title).toBe('First');
	});

	it('rejects malformed imports without replacing the primary', () => {
		const persistence = setup();
		persistence.save({ title: 'Kept', tags: [] });

		const result = persistence.importText(JSON.stringify({ title: 42, tags: [] }));
		expect(result).toMatchObject({ ok: false, issue: { kind: 'validation' } });
		expect(persistence.load().value.title).toBe('Kept');
	});

	it('reports quota failures instead of swallowing them', () => {
		const storage = new MemoryStorage();
		storage.failWrites = true;
		const result = setup(storage).save({ title: 'No room', tags: [] });
		expect(result).toMatchObject({ ok: false, issue: { kind: 'quota' } });
	});

	it('reports UTF-8 sizes in readable units', () => {
		expect(serializedBytes('🌙')).toBe(4);
		expect(formatBytes(1536)).toBe('1.5 KB');
	});
});

class MemoryStorage implements StorageLike {
	readonly values = new Map<string, string>();
	failWrites = false;

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		if (this.failWrites) throw new DOMException('full', 'QuotaExceededError');
		this.values.set(key, value);
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}
}
