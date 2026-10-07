/**
 * Course Settings Types
 *
 * These settings are stored in the `courses.settings` JSONB column.
 * Use getCourseSettings() to safely access settings with defaults.
 */

/**
 * 'standard' = cohorts of participants working through sessions together.
 * 'hub_leader' = leaders log in, pick any session, and pass the public guide to
 * their own group. No reflections, quizzes, attendance, chat or progress tracking.
 */
export type CourseMode = 'standard' | 'hub_leader';

export interface CourseSettings {
	mode?: CourseMode;
	// Existing settings (preserve backward compatibility)
	theme?: {
		accentDark?: string;
		accentLight?: string;
		accentDarkest?: string;
		fontFamily?: string;
	};
	branding?: {
		logoUrl?: string;
		showLogo?: boolean;
	};

	// Coordinator Access Settings
	coordinatorAccess?: {
		// 'all' = coordinators see all sessions
		// number = how many sessions ahead coordinators can see vs students
		sessionsAhead: 'all' | number;
	};

	// Session Progression Rules
	sessionProgression?: {
		mode: 'manual' | 'auto_time' | 'require_completion';
		// For 'auto_time' mode: days after session unlock before auto-advancing
		autoAdvanceDays?: number;
		// For 'require_completion' mode: what must be completed
		completionRequirements?: {
			reflectionSubmitted?: boolean;
			attendanceMarked?: boolean;
		};
	};

	// Per-course legal/consent text shown on the enrolment signup page
	legal?: {
		text?: string;
		linkUrl?: string;
		linkLabel?: string;
		requireAcknowledgement?: boolean;
		checkboxLabel?: string;
	};

	// Feature Toggles
	features?: {
		reflectionsEnabled?: boolean;
		communityFeedEnabled?: boolean;
		attendanceEnabled?: boolean;
		enrollmentEnabled?: boolean;
		acceptPayments?: boolean;
		chatEnabled?: boolean;
		chatAllowParticipants?: boolean;
		materialsEnabled?: boolean;
		hubsEnabled?: boolean;
		quizzesEnabled?: boolean;
		maxCapacity?: number | null;
		requireApproval?: boolean;
		publicPagesEnabled?: boolean;
	};
}

// Default settings when not configured
export const DEFAULT_COURSE_SETTINGS: Required<
	Pick<CourseSettings, 'coordinatorAccess' | 'sessionProgression' | 'features'>
> = {
	coordinatorAccess: {
		sessionsAhead: 'all'
	},
	sessionProgression: {
		mode: 'manual',
		autoAdvanceDays: 7,
		completionRequirements: {
			reflectionSubmitted: true,
			attendanceMarked: false
		}
	},
	features: {
		reflectionsEnabled: true,
		communityFeedEnabled: false,
		attendanceEnabled: true,
		enrollmentEnabled: false,
		acceptPayments: false,
		chatEnabled: true,
		chatAllowParticipants: false,
		materialsEnabled: true,
		hubsEnabled: true,
		quizzesEnabled: true,
		maxCapacity: null,
		requireApproval: false,
		publicPagesEnabled: false
	}
};

/**
 * Safely get course settings with defaults applied.
 * Pass the raw settings from the database and get back a fully-typed object.
 */
export function getCourseSettings(rawSettings: unknown): CourseSettings {
	const settings = (rawSettings ?? {}) as CourseSettings;

	return {
		mode: settings.mode === 'hub_leader' ? 'hub_leader' : 'standard',

		// Preserve existing settings as-is
		theme: settings.theme,
		branding: settings.branding,
		legal: settings.legal,

		// Apply defaults for new settings
		coordinatorAccess: {
			sessionsAhead: settings.coordinatorAccess?.sessionsAhead ?? DEFAULT_COURSE_SETTINGS.coordinatorAccess.sessionsAhead
		},
		sessionProgression: {
			mode: settings.sessionProgression?.mode ?? DEFAULT_COURSE_SETTINGS.sessionProgression.mode,
			autoAdvanceDays:
				settings.sessionProgression?.autoAdvanceDays ??
				DEFAULT_COURSE_SETTINGS.sessionProgression.autoAdvanceDays,
			completionRequirements: {
				reflectionSubmitted:
					settings.sessionProgression?.completionRequirements?.reflectionSubmitted ??
					DEFAULT_COURSE_SETTINGS.sessionProgression.completionRequirements!.reflectionSubmitted,
				attendanceMarked:
					settings.sessionProgression?.completionRequirements?.attendanceMarked ??
					DEFAULT_COURSE_SETTINGS.sessionProgression.completionRequirements!.attendanceMarked
			}
		},
		features: {
			reflectionsEnabled:
				settings.features?.reflectionsEnabled ?? DEFAULT_COURSE_SETTINGS.features.reflectionsEnabled,
			communityFeedEnabled:
				settings.features?.communityFeedEnabled ?? DEFAULT_COURSE_SETTINGS.features.communityFeedEnabled,
			attendanceEnabled:
				settings.features?.attendanceEnabled ?? DEFAULT_COURSE_SETTINGS.features.attendanceEnabled,
			enrollmentEnabled:
				settings.features?.enrollmentEnabled ?? (settings.features as any)?.paymentsEnabled ?? DEFAULT_COURSE_SETTINGS.features.enrollmentEnabled,
			acceptPayments:
				settings.features?.acceptPayments ?? (settings.features as any)?.paymentsEnabled ?? DEFAULT_COURSE_SETTINGS.features.acceptPayments,
			chatEnabled:
				settings.features?.chatEnabled ?? DEFAULT_COURSE_SETTINGS.features.chatEnabled,
			chatAllowParticipants:
				settings.features?.chatAllowParticipants ?? DEFAULT_COURSE_SETTINGS.features.chatAllowParticipants,
			materialsEnabled:
				settings.features?.materialsEnabled ?? DEFAULT_COURSE_SETTINGS.features.materialsEnabled,
			hubsEnabled:
				settings.features?.hubsEnabled ?? DEFAULT_COURSE_SETTINGS.features.hubsEnabled,
			quizzesEnabled:
				settings.features?.quizzesEnabled ?? DEFAULT_COURSE_SETTINGS.features.quizzesEnabled,
			maxCapacity:
				settings.features?.maxCapacity ?? DEFAULT_COURSE_SETTINGS.features.maxCapacity,
			requireApproval:
				settings.features?.requireApproval ?? DEFAULT_COURSE_SETTINGS.features.requireApproval,
			publicPagesEnabled:
				settings.features?.publicPagesEnabled ?? DEFAULT_COURSE_SETTINGS.features.publicPagesEnabled
		}
	};
}

export function isHubLeaderMode(settings: CourseSettings | null | undefined): boolean {
	return settings?.mode === 'hub_leader';
}

/** Features a hub-leader course never has, whatever is stored in `features`. */
const HUB_LEADER_FEATURE_OVERRIDES: NonNullable<CourseSettings['features']> = {
	reflectionsEnabled: false,
	communityFeedEnabled: false,
	attendanceEnabled: false,
	chatEnabled: false,
	chatAllowParticipants: false,
	quizzesEnabled: false,
	hubsEnabled: false,
	// The hub-leader home shows materials itself; this only hides the Materials tab.
	materialsEnabled: false
};

/**
 * getCourseSettings() with the course mode applied. Use this where participants
 * see the course (layout, navigation, dashboard). Admin screens must keep using
 * getCourseSettings(): they edit the stored flags, and saving the overridden
 * values back would leave every feature off after switching to 'standard'.
 */
export function getEffectiveCourseSettings(rawSettings: unknown): CourseSettings {
	const settings = getCourseSettings(rawSettings);
	if (!isHubLeaderMode(settings)) return settings;
	return { ...settings, features: { ...settings.features, ...HUB_LEADER_FEATURE_OVERRIDES } };
}

/**
 * The feature flags the admin screens should see. A hub-leader course has no
 * reflections, quizzes, attendance, chat, community feed or hubs, so the admin
 * menu and editors for them are hidden. Materials stay on: admins always manage
 * them (the participant side shows materials on the home page itself).
 */
export function getAdminCourseFeatures(rawSettings: unknown): NonNullable<CourseSettings['features']> {
	const stored = getCourseSettings(rawSettings);
	const effective = getEffectiveCourseSettings(rawSettings);
	return { ...effective.features, materialsEnabled: stored.features?.materialsEnabled };
}
