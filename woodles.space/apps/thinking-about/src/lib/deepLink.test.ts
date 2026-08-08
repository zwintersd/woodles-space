import { describe, expect, it } from 'vitest';
import { ENTRY_PARAM, findTimeHref, parseEntryLink } from './deepLink';

describe('parseEntryLink', () => {
	it('reads the entry Carillon linked to', () => {
		expect(parseEntryLink('/thinking-about?entry=e1')).toBe('e1');
	});

	it('decodes an id that needed encoding on the way out', () => {
		expect(parseEntryLink('/thinking-about?entry=a%20b%26c')).toBe('a b&c');
	});

	it('reads nothing from an ordinary visit', () => {
		expect(parseEntryLink('/thinking-about')).toBeNull();
		expect(parseEntryLink('/thinking-about?other=1')).toBeNull();
	});

	it('treats an empty or blank id as no link, not as an entry called ""', () => {
		expect(parseEntryLink('/thinking-about?entry=')).toBeNull();
		expect(parseEntryLink('/thinking-about?entry=%20')).toBeNull();
	});

	it('survives a malformed URL rather than throwing on load', () => {
		expect(parseEntryLink('%%%not a url')).toBeNull();
	});
});

describe('findTimeHref', () => {
	it('points at Carillon through the manifest, not a hardcoded path', () => {
		expect(findTimeHref('e1')).toBe('/planner?thinking-about-entry=e1');
	});

	it('encodes the id it carries', () => {
		expect(findTimeHref('a b&c')).toBe('/planner?thinking-about-entry=a%20b%26c');
	});

	it('round-trips: what Carillon links back to is what this app parses', () => {
		// The two apps agree because both sides go through @woodles/app-manifest;
		// this pins that they actually do agree, not just that each is plausible.
		const href = `/thinking-about?${ENTRY_PARAM}=${encodeURIComponent('weird id&=?')}`;
		expect(parseEntryLink(href)).toBe('weird id&=?');
	});
});
