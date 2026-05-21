import type { BlockTemplate, DayType } from './types';
import { timeToMinutes, nowMinutes } from './utils';

const WEEKDAY_BLOCKS: BlockTemplate[] = [
	{
		id: 'morning-routine',
		startTime: '06:30',
		endTime: '07:20',
		title: 'Morning routine',
		bellId: 'block-start',
		voicePrompt: '06:30. Morning.',
		flourishEligible: true
	},
	{
		id: 'leave-kp',
		startTime: '07:20',
		endTime: '07:50',
		title: 'Leave for KP',
		bellId: 'block-start',
		voicePrompt: '07:20. Leave for KP.'
	},
	{
		id: 'at-kp',
		startTime: '07:50',
		endTime: '16:30',
		title: 'At KP',
		bellId: 'block-start',
		voicePrompt: '07:50. At KP.'
	},
	{
		id: 'commute-home',
		startTime: '16:30',
		endTime: '17:05',
		title: 'Commute home',
		bellId: 'block-start',
		voicePrompt: '16:30. Clock out.'
	},
	{
		id: 'decompress',
		startTime: '17:05',
		endTime: '17:30',
		title: 'Decompress',
		bellId: 'block-start',
		voicePrompt: '17:05. Home. Change clothes, water, sit ten.',
		flourishEligible: true
	},
	{
		id: 'open-block',
		startTime: '17:30',
		endTime: '19:00',
		title: 'Open',
		bellId: 'block-start',
		voicePrompt: '17:30. Open block.',
		flourishEligible: true
	},
	{
		id: 'household-reset',
		startTime: '19:00',
		endTime: '19:45',
		title: 'Household reset',
		bellId: 'block-start',
		voicePrompt: '19:00. Household reset.'
	},
	{
		id: 'dinner-prep',
		startTime: '19:45',
		endTime: '20:00',
		title: 'Dinner prep',
		bellId: 'block-start',
		voicePrompt: '19:45. Dinner prep.'
	},
	{
		id: 'dinner',
		startTime: '20:00',
		endTime: '20:30',
		title: 'Dinner',
		bellId: 'meal',
		voicePrompt: '20:00. Dinner.',
		flourishEligible: true
	},
	{
		id: 'wind-down',
		startTime: '20:30',
		endTime: '21:30',
		title: 'Wind-down',
		bellId: 'block-start',
		voicePrompt: '20:30. Wind-down.',
		flourishEligible: true
	},
	{
		id: 'pre-bed',
		startTime: '21:30',
		endTime: '23:59',
		title: 'Pre-bed',
		bellId: 'wind-down',
		voicePrompt: '21:30. Lights out.'
	}
];

const WEEKEND_BLOCKS: BlockTemplate[] = [
	{
		id: 'weekend-morning',
		startTime: '08:00',
		endTime: '10:30',
		title: 'Morning',
		bellId: 'block-start',
		voicePrompt: 'Morning.',
		flourishEligible: true
	},
	{
		id: 'weekend-midmorning',
		startTime: '10:30',
		endTime: '13:00',
		title: 'Mid-morning',
		bellId: 'block-start',
		voicePrompt: '10:30.'
	},
	{
		id: 'weekend-afternoon',
		startTime: '13:00',
		endTime: '17:00',
		title: 'Afternoon',
		bellId: 'block-start',
		voicePrompt: '13:00. Afternoon.',
		flourishEligible: true
	},
	{
		id: 'weekend-evening',
		startTime: '17:00',
		endTime: '19:30',
		title: 'Evening',
		bellId: 'block-start',
		voicePrompt: '17:00. Evening.',
		flourishEligible: true
	},
	{
		id: 'weekend-dinner-prep',
		startTime: '19:30',
		endTime: '20:00',
		title: 'Dinner prep',
		bellId: 'block-start',
		voicePrompt: '19:30. Dinner prep.'
	},
	{
		id: 'weekend-dinner',
		startTime: '20:00',
		endTime: '21:00',
		title: 'Dinner',
		bellId: 'meal',
		voicePrompt: '20:00. Dinner.',
		flourishEligible: true
	},
	{
		id: 'weekend-late-evening',
		startTime: '21:00',
		endTime: '23:30',
		title: 'Late evening',
		bellId: 'block-start',
		voicePrompt: '21:00. Late evening.',
		flourishEligible: true
	},
	{
		id: 'weekend-pre-bed',
		startTime: '23:30',
		endTime: '23:59',
		title: 'Pre-bed',
		bellId: 'wind-down',
		voicePrompt: '23:30. Last call.'
	}
];

export function getTemplate(dayType: DayType): BlockTemplate[] {
	return dayType === 'weekday-work' ? WEEKDAY_BLOCKS : WEEKEND_BLOCKS;
}

export function isWeekendDate(date: Date): boolean {
	const day = date.getDay();
	return day === 0 || day === 6;
}

export function defaultDayType(date: Date): DayType {
	return isWeekendDate(date) ? 'day-off' : 'weekday-work';
}

export function getCurrentBlock(dayType: DayType, date: Date): BlockTemplate | null {
	const blocks = getTemplate(dayType);
	const mins = nowMinutes(date);
	for (const block of blocks) {
		const start = timeToMinutes(block.startTime);
		const end = timeToMinutes(block.endTime);
		if (mins >= start && mins < end) return block;
	}
	return null;
}

export function getNextBlock(dayType: DayType, date: Date): BlockTemplate | null {
	const blocks = getTemplate(dayType);
	const mins = nowMinutes(date);
	for (const block of blocks) {
		const start = timeToMinutes(block.startTime);
		if (start > mins) return block;
	}
	return null;
}

export function minutesRemaining(block: BlockTemplate, date: Date): number {
	return Math.max(0, timeToMinutes(block.endTime) - nowMinutes(date));
}

export function minutesUntilBlock(block: BlockTemplate, date: Date): number {
	return Math.max(0, timeToMinutes(block.startTime) - nowMinutes(date));
}

export function blockDurationMinutes(block: BlockTemplate): number {
	return timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
}
