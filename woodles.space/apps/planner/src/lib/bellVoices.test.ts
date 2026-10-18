import { describe, expect, it } from 'vitest';
import { BELL_VOICES, hourStrikes, isBellVoice, notesEnd, peakLevel, voiceLoudness, voiceNotes, westminsterPhrases } from './bellVoices';

describe('bell voices as notes', () => {
	it('gives every voice a name and a sound, except silent', () => {
		for (const voice of BELL_VOICES) {
			expect(voice.name).toBeTruthy();
			const notes = voiceNotes(voice.id, { minute: 0 });
			if (voice.id === 'silent') expect(notes).toEqual([]);
			else {
				expect(notes.length).toBeGreaterThan(0);
				for (const note of notes) {
					expect(note.freq).toBeGreaterThan(20);
					expect(note.freq).toBeLessThan(8000);
					expect(note.gain).toBeGreaterThan(0);
					expect(note.gain).toBeLessThanOrEqual(1);
					expect(note.decay).toBeGreaterThan(0);
				}
			}
		}
		expect(isBellVoice('bowl')).toBe(true);
		expect(isBellVoice('kazoo')).toBe(false);
		expect(isBellVoice(undefined)).toBe(false);
	});

	it('keeps the original bell exactly as it sounded', () => {
		expect(voiceNotes('bell').map(note => [note.at, note.freq, note.type, note.decay])).toEqual([[0, 783.99, 'sine', 0.85], [0.035, 987.77, 'triangle', 0.85]]);
		expect(voiceNotes('soft-bell').map(note => note.freq)).toEqual([659.25, 783.99]);
	});

	it('rings the Westminster quarters by the clock face', () => {
		expect(westminsterPhrases(15)).toEqual([0]);
		expect(westminsterPhrases(30)).toEqual([1, 2]);
		expect(westminsterPhrases(45)).toEqual([3, 4, 0]);
		expect(westminsterPhrases(0)).toEqual([1, 2, 3, 4]);
		expect(westminsterPhrases(5)).toEqual([0]);
		// Six partials per struck note, four notes per phrase.
		expect(voiceNotes('westminster', { minute: 15 })).toHaveLength(24);
		expect(voiceNotes('westminster', { minute: 0 })).toHaveLength(96);
		const firstPrimes = voiceNotes('westminster', { minute: 15 }).filter((_, index) => index % 6 === 1).map(note => note.freq);
		expect(firstPrimes).toEqual([415.3, 369.99, 329.63, 246.94]);
		expect(notesEnd(voiceNotes('westminster', { minute: 0 }))).toBeGreaterThan(notesEnd(voiceNotes('westminster', { minute: 15 })));
	});

	it('counts the hour on a twelve-hour clock, after the voice', () => {
		const strikeCount = (hour: number) => new Set(hourStrikes(hour, 2).map(note => note.at)).size;
		expect(strikeCount(0)).toBe(12);
		expect(strikeCount(12)).toBe(12);
		expect(strikeCount(13)).toBe(1);
		expect(strikeCount(15)).toBe(3);
		expect(Math.min(...hourStrikes(15, 2).map(note => note.at))).toBeGreaterThan(2);
	});

	it('keeps every voice about as loud as the original bell on a small speaker, within headroom', () => {
		const reference = voiceLoudness(voiceNotes('bell'));
		for (const voice of BELL_VOICES.filter(item => item.id !== 'silent')) {
			for (const minute of [0, 15]) {
				const notes = voiceNotes(voice.id, { minute });
				expect(Math.abs(voiceLoudness(notes) - reference), `${voice.id} loudness`).toBeLessThanOrEqual(4);
				expect(peakLevel(notes), `${voice.id} peak`).toBeLessThanOrEqual(1.25);
			}
		}
		const strikes = hourStrikes(12, -0.8);
		expect(reference - voiceLoudness(strikes)).toBeLessThanOrEqual(8);
		expect(peakLevel(strikes)).toBeLessThanOrEqual(1.25);
		// The hour with every strike: one sequence, still within headroom.
		expect(peakLevel([...voiceNotes('westminster', { minute: 0 }), ...hourStrikes(12, notesEnd(voiceNotes('westminster', { minute: 0 })))])).toBeLessThanOrEqual(1.25);
	});
});
