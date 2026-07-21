const FORMAT = 'woodles-persistence';

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export type PersistenceIssueKind =
	| 'unavailable'
	| 'parse'
	| 'version'
	| 'migration'
	| 'validation'
	| 'quota'
	| 'write';

export type PersistenceIssue = {
	kind: PersistenceIssueKind;
	message: string;
};

export type LoadResult<T> = {
	value: T;
	source: 'primary' | 'backup' | 'fallback';
	migrated: boolean;
	issue: PersistenceIssue | null;
	savedAt: string | null;
	bytes: number;
};

export type SaveResult = {
	ok: boolean;
	savedAt: string | null;
	bytes: number;
	issue: PersistenceIssue | null;
};

export type ImportResult<T> = SaveResult & {
	value?: T;
	migrated: boolean;
};

export type VersionedStorageOptions<T> = {
	key: string;
	version: number;
	fallback: () => T;
	validate: (value: unknown) => value is T;
	migrate?: (value: unknown, fromVersion: number) => unknown;
	storage?: StorageLike | null;
	now?: () => string;
};

type Envelope<T = unknown> = {
	woodles: typeof FORMAT;
	schemaVersion: number;
	savedAt: string;
	data: T;
};

type Decoded<T> = {
	value: T;
	migrated: boolean;
	savedAt: string | null;
};

type DecodeResult<T> = { ok: true; decoded: Decoded<T> } | { ok: false; issue: PersistenceIssue };

export function createVersionedStorage<T>(options: VersionedStorageOptions<T>) {
	const backupKey = `${options.key}.backup`;
	const now = options.now ?? (() => new Date().toISOString());

	function resolveStorage(): StorageLike | null {
		if (options.storage !== undefined) return options.storage;
		return typeof localStorage === 'undefined' ? null : localStorage;
	}

	function envelope(value: T): Envelope<T> {
		return {
			woodles: FORMAT,
			schemaVersion: options.version,
			savedAt: now(),
			data: value
		};
	}

	function decode(text: string): DecodeResult<T> {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return failure('parse', 'The saved data is not valid JSON.');
		}

		let value = parsed;
		let version = 0;
		let savedAt: string | null = null;
		if (isEnvelope(parsed)) {
			value = parsed.data;
			version = parsed.schemaVersion;
			savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : null;
		}

		if (version > options.version) {
			return failure(
				'version',
				`This data uses schema ${version}, but this app supports schema ${options.version}.`
			);
		}

		const migrated = version !== options.version;
		if (migrated) {
			if (!options.migrate) {
				return failure('version', `No migration is available from schema ${version}.`);
			}
			try {
				value = options.migrate(value, version);
			} catch {
				return failure('migration', `Could not migrate data from schema ${version}.`);
			}
		}

		if (!options.validate(value)) {
			return failure('validation', 'The saved data does not match the expected shape.');
		}

		return { ok: true, decoded: { value, migrated, savedAt } };
	}

	function save(value: T): SaveResult {
		if (!options.validate(value)) {
			return saveFailure('validation', 'Refused to save data that does not match the expected shape.');
		}

		const storage = resolveStorage();
		if (!storage) return saveFailure('unavailable', 'Browser storage is unavailable.');

		try {
			const document = envelope(value);
			const body = JSON.stringify(document);
			const previous = storage.getItem(options.key);
			if (previous && decode(previous).ok) storage.setItem(backupKey, previous);
			storage.setItem(options.key, body);
			return {
				ok: true,
				savedAt: document.savedAt,
				bytes: serializedBytes(body),
				issue: null
			};
		} catch (error) {
			return saveError(error);
		}
	}

	function load(): LoadResult<T> {
		const storage = resolveStorage();
		if (!storage) return fallbackLoad('unavailable', 'Browser storage is unavailable.');

		let primary: string | null;
		try {
			primary = storage.getItem(options.key);
		} catch {
			return fallbackLoad('unavailable', 'Browser storage could not be read.');
		}

		if (primary) {
			const result = decode(primary);
			if (result.ok) {
				const migrationSave = result.decoded.migrated ? save(result.decoded.value) : null;
				return {
					value: result.decoded.value,
					source: 'primary',
					migrated: result.decoded.migrated,
					issue: migrationSave && !migrationSave.ok ? migrationSave.issue : null,
					savedAt: migrationSave?.savedAt ?? result.decoded.savedAt,
					bytes: migrationSave?.bytes || serializedBytes(primary)
				};
			}

			const recovered = loadBackup(storage, result.issue);
			if (recovered) return recovered;
			return fallbackLoad(result.issue.kind, result.issue.message);
		}

		const recovered = loadBackup(storage, {
			kind: 'validation',
			message: 'The primary save was missing, so the last-known-good backup was restored.'
		});
		return recovered ?? fallbackLoad(null, null);
	}

	function loadBackup(storage: StorageLike, primaryIssue: PersistenceIssue): LoadResult<T> | null {
		try {
			const backup = storage.getItem(backupKey);
			if (!backup) return null;
			const result = decode(backup);
			if (!result.ok) return null;
			let issue = primaryIssue;
			try {
				storage.setItem(options.key, backup);
			} catch {
				issue = {
					kind: 'write',
					message: `${primaryIssue.message} The backup was loaded, but browser storage could not repair the primary save.`
				};
			}
			return {
				value: result.decoded.value,
				source: 'backup',
				migrated: result.decoded.migrated,
				issue,
				savedAt: result.decoded.savedAt,
				bytes: serializedBytes(backup)
			};
		} catch {
			return null;
		}
	}

	function exportText(value: T, space = 2): string {
		if (!options.validate(value)) throw new Error('Cannot export invalid persistence data.');
		return JSON.stringify(envelope(value), null, space);
	}

	function importText(text: string): ImportResult<T> {
		const decoded = decode(text);
		if (!decoded.ok) {
			return {
				ok: false,
				migrated: false,
				savedAt: null,
				bytes: serializedBytes(text),
				issue: decoded.issue
			};
		}
		const result = save(decoded.decoded.value);
		return { ...result, value: result.ok ? decoded.decoded.value : undefined, migrated: decoded.decoded.migrated };
	}

	function clear(): void {
		const storage = resolveStorage();
		if (!storage) return;
		storage.removeItem(options.key);
		storage.removeItem(backupKey);
	}

	function fallbackLoad(kind: PersistenceIssueKind | null, message: string | null): LoadResult<T> {
		return {
			value: options.fallback(),
			source: 'fallback',
			migrated: false,
			issue: kind && message ? { kind, message } : null,
			savedAt: null,
			bytes: 0
		};
	}

	return { key: options.key, backupKey, load, save, exportText, importText, clear };
}

export function serializedBytes(value: unknown): number {
	const text = typeof value === 'string' ? value : JSON.stringify(value);
	return new TextEncoder().encode(text).byteLength;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function browserStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
	if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
	try {
		const estimate = await navigator.storage.estimate();
		return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
	} catch {
		return null;
	}
}

function isEnvelope(value: unknown): value is Envelope {
	if (!isRecord(value)) return false;
	return value.woodles === FORMAT && Number.isInteger(value.schemaVersion) && 'data' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure<T>(kind: PersistenceIssueKind, message: string): DecodeResult<T> {
	return { ok: false, issue: { kind, message } };
}

function saveFailure(kind: PersistenceIssueKind, message: string): SaveResult {
	return { ok: false, savedAt: null, bytes: 0, issue: { kind, message } };
}

function saveError(error: unknown): SaveResult {
	const quota = error instanceof DOMException &&
		(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
	return saveFailure(
		quota ? 'quota' : 'write',
		quota
			? 'Browser storage is full. Export a backup before removing anything.'
			: 'The browser could not save these changes.'
	);
}
