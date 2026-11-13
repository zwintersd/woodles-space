// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { PlannerStore } from './store.svelte';
import { mergePlannerBlobs } from './sync.svelte';
import { buildDayIntervals, planLine } from './instrument';
import type { Appointment, PlannerBlob } from './types';

describe('appointments', () => {
	let store: PlannerStore;

	beforeEach(() => {
		localStorage.clear();
		store = new PlannerStore();
	});

	it('puts a one-off appointment on its own date and no other', () => {
		const saved = store.saveAppointment({
			date: '2027-03-02',
			title: ' Dentist ',
			startTime: '15:00',
			endTime: '16:00'
		});

		expect(saved).toMatchObject({ title: 'Dentist', date: '2027-03-02' });
		expect(store.getBlocksForDateKey('2027-03-02')).toContainEqual({
			id: `apt-${saved!.id}`,
			startTime: '15:00',
			endTime: '16:00',
			title: 'Dentist',
			overlay: 'appointment'
		});
		expect(
			store.getBlocksForDateKey('2027-03-09').some((block) => block.overlay === 'appointment')
		).toBe(false);
	});

	it('refuses a blank title, a bad date, or an end that is not after the start', () => {
		const base = { date: '2027-03-02', title: 'Dentist', startTime: '15:00', endTime: '16:00' };
		expect(store.saveAppointment({ ...base, title: '  ' })).toBeNull();
		expect(store.saveAppointment({ ...base, date: 'tuesday' })).toBeNull();
		expect(store.saveAppointment({ ...base, endTime: '15:00' })).toBeNull();
		expect(store.appointments).toEqual([]);
	});

	it('edits in place, removes, and survives a reload', () => {
		const first = store.saveAppointment({
			date: '2027-03-02',
			title: 'Dentist',
			startTime: '15:00',
			endTime: '16:00'
		})!;
		store.saveAppointment({ ...first, startTime: '14:00', endTime: '15:00' });
		expect(store.appointments).toHaveLength(1);
		expect(new PlannerStore().getAppointmentsForDay('2027-03-02')[0]).toMatchObject({
			id: first.id,
			startTime: '14:00'
		});

		store.removeAppointment(first.id);
		expect(new PlannerStore().appointments).toEqual([]);
	});

	it('is what the interval reads as planned while it runs', () => {
		const saved = store.saveAppointment({
			date: '2027-03-02',
			title: 'Dentist',
			startTime: '10:00',
			endTime: '11:00'
		})!;
		const now = new Date(2027, 2, 2, 10, 20);
		const blocks = store.getBlocksForDate(now);
		const current = buildDayIntervals(now, blocks, [], '07:00', '22:00', 15, now).find(
			(row) => row.state === 'current'
		)!;

		expect(current.plannedBlock?.id).toBe(`apt-${saved.id}`);
		expect(planLine(current, blocks)).toMatch(/^planned: Dentist, until 11:00/);
	});
});

describe('appointments across devices', () => {
	function blob(appointments: Appointment[]): PlannerBlob {
		return {
			shapes: [],
			weekPattern: { days: ['', '', '', '', '', '', ''] },
			days: {},
			obligations: [],
			rituals: [],
			tasks: [],
			settings: {} as PlannerBlob['settings'],
			domains: [],
			appointments
		};
	}
	const dentist: Appointment = {
		id: 'a1',
		date: '2027-03-02',
		title: 'Dentist',
		startTime: '15:00',
		endTime: '16:00',
		updatedAt: '2027-02-01T10:00:00.000Z'
	};

	it('keeps appointments made on either device', () => {
		const vet = { ...dentist, id: 'a2', title: 'Vet' };
		const merged = mergePlannerBlobs(blob([dentist]), blob([vet]));
		expect(merged.appointments?.map((item) => item.id).sort()).toEqual(['a1', 'a2']);
	});

	it('takes the later edit of the same appointment', () => {
		const moved = { ...dentist, startTime: '09:00', endTime: '10:00', updatedAt: '2027-02-02T10:00:00.000Z' };
		expect(mergePlannerBlobs(blob([moved]), blob([dentist])).appointments).toEqual([moved]);
		expect(mergePlannerBlobs(blob([dentist]), blob([moved])).appointments).toEqual([moved]);
	});
});
