/**
 * Course Settings Types
 *
 * These settings are stored in the `courses.settings` JSONB column.
 * Use getCourseSettings() to safely access settings with defaults.
 */

export interface CourseSettings {
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

	// Feature Toggles
	features?: {
		reflectionsEnabled?: boolean;
		communityFeedEnabled?: boolean;
		attendanceEnabled?: boolean;
		enrollmentEnabled?: boolean;
		acceptPayments?: boolean;
		discountCodes?: boolean;
		chatEnabled?: boolean;
		chatAllowParticipants?: boolean;
		materialsEnabled?: boolean;
		hubsEnabled?: boolean;
		quizzesEnabled?: boolean;
		maxCapacity?: number | null;
		requireApproval?: boolean;
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
		communityFeedEnabled: true,
		attendanceEnabled: true,
		enrollmentEnabled: false,
		acceptPayments: false,
		discountCodes: false,
		chatEnabled: true,
		chatAllowParticipants: false,
		materialsEnabled: true,
		hubsEnabled: true,
		quizzesEnabled: true,
		maxCapacity: null,
		requireApproval: false
	}
};

/**
 * Safely get course settings with defaults applied.
 * Pass the raw settings from the database and get back a fully-typed object.
 */
export function getCourseSettings(rawSettings: unknown): CourseSettings {
	const settings = (rawSettings ?? {}) as CourseSettings;

	return {
		// Preserve existing settings as-is
		theme: settings.theme,
		branding: settings.branding,

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
			discountCodes:
				settings.features?.discountCodes ?? (settings.features as any)?.paymentsEnabled ?? DEFAULT_COURSE_SETTINGS.features.discountCodes,
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
				settings.features?.requireApproval ?? DEFAULT_COURSE_SETTINGS.features.requireApproval
		}
	};
}
