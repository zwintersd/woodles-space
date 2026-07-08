import { latestEntryTimestamp } from './entries';
import type { ThinkingAboutBlob } from './types';

export function blobUpdatedAt(blob: ThinkingAboutBlob | null | undefined): string | null {
	if (!blob) return null;
	return blob.updatedAt ?? latestEntryTimestamp(blob.entries) ?? null;
}

export function isThinkingAboutBlobNewer(
	local: ThinkingAboutBlob,
	remote: ThinkingAboutBlob
): boolean {
	const localUpdatedAt = blobUpdatedAt(local);
	const remoteUpdatedAt = blobUpdatedAt(remote);

	if (localUpdatedAt && remoteUpdatedAt && localUpdatedAt !== remoteUpdatedAt) {
		return localUpdatedAt > remoteUpdatedAt;
	}

	if (localUpdatedAt && !remoteUpdatedAt) return true;
	if (!localUpdatedAt && remoteUpdatedAt) return false;

	return (local.entries?.length ?? 0) > (remote.entries?.length ?? 0);
}
