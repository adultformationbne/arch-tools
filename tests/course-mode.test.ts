import { describe, it, expect } from 'vitest';
import {
	getCourseSettings,
	getEffectiveCourseSettings,
	isHubLeaderMode
} from '$lib/types/course-settings';

/**
 * Course mode. A hub-leader course has no reflections, quizzes, attendance,
 * chat or community feed, but the flags stored on the course are left alone:
 * the admin form reads and saves them, and overwriting them would leave every
 * feature off after switching a course back to a cohort course.
 */

const stored = {
	mode: 'hub_leader',
	features: {
		reflectionsEnabled: true,
		attendanceEnabled: true,
		chatEnabled: true,
		quizzesEnabled: true,
		publicPagesEnabled: true
	}
};

describe('Course mode', () => {
	it('defaults to a standard cohort course', () => {
		expect(getCourseSettings({}).mode).toBe('standard');
		expect(getCourseSettings(null).mode).toBe('standard');
		expect(getCourseSettings({ mode: 'something_else' }).mode).toBe('standard');
		expect(isHubLeaderMode(getCourseSettings({}))).toBe(false);
	});

	it('recognises a hub-leader course', () => {
		expect(isHubLeaderMode(getCourseSettings(stored))).toBe(true);
	});

	it('leaves a standard course exactly as stored', () => {
		const settings = getEffectiveCourseSettings({ features: stored.features });
		expect(settings.features?.reflectionsEnabled).toBe(true);
		expect(settings.features?.chatEnabled).toBe(true);
	});

	it('switches the cohort features off for a hub-leader course', () => {
		const features = getEffectiveCourseSettings(stored).features;
		expect(features?.reflectionsEnabled).toBe(false);
		expect(features?.attendanceEnabled).toBe(false);
		expect(features?.chatEnabled).toBe(false);
		expect(features?.quizzesEnabled).toBe(false);
		expect(features?.communityFeedEnabled).toBe(false);
		expect(features?.hubsEnabled).toBe(false);
	});

	it('does not touch features that still apply', () => {
		expect(getEffectiveCourseSettings(stored).features?.publicPagesEnabled).toBe(true);
	});

	it('does not rewrite the stored flags that the admin form edits', () => {
		const raw = getCourseSettings(stored);
		getEffectiveCourseSettings(stored);
		expect(raw.features?.reflectionsEnabled).toBe(true);
		expect(getCourseSettings(stored).features?.chatEnabled).toBe(true);
	});
});
