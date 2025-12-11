/**
 * Email Context Configuration
 *
 * SSOT for context-specific email functionality.
 * Each context (course, dgr, platform) defines how to:
 * - Load recipients
 * - Build template variables from recipient data
 * - Provide sample/test data
 *
 * @module email/context-config
 */

export type EmailContext = 'course' | 'dgr' | 'platform';

export interface EmailRecipient {
	id: string;
	displayName: string;
	email: string;
	/** Raw data from the API - context-specific shape */
	raw: Record<string, unknown>;
}

export interface EmailVariable {
	name: string;
	description: string;
	/** If true, requires additional context (e.g., session selection) */
	contextDependent?: boolean;
}

export interface EmailContextConfig {
	/** Human-readable label for this context */
	label: string;

	/** API endpoint to fetch recipients. Returns function that takes contextId */
	getRecipientsUrl: (contextId?: string) => string;

	/** Transform API response into normalized EmailRecipient[] */
	normalizeRecipients: (apiResponse: unknown) => EmailRecipient[];

	/**
	 * Build template variables from a recipient
	 * @param recipient - Normalized recipient with raw data
	 * @param contextData - Additional context passed from parent (course, cohorts, etc.)
	 * @param origin - Site origin for building URLs
	 */
	buildVariables: (
		recipient: EmailRecipient,
		contextData: Record<string, unknown>,
		origin: string
	) => Record<string, string>;

	/** Sample data for "preview without selecting real recipient" */
	sampleRecipient: {
		displayName: string;
		email: string;
		variables: Record<string, string>;
	};

	/** Available variables for this context */
	variables: EmailVariable[];
}

// =====================================================
// COURSE CONTEXT
// =====================================================

const COURSE_VARIABLES: EmailVariable[] = [
	{ name: 'firstName', description: 'Student first name' },
	{ name: 'lastName', description: 'Student last name' },
	{ name: 'fullName', description: 'Student full name' },
	{ name: 'email', description: 'Student email address' },
	{ name: 'hubName', description: 'Student hub assignment' },
	{ name: 'courseName', description: 'Course name' },
	{ name: 'courseSlug', description: 'Course URL identifier' },
	{ name: 'cohortName', description: 'Cohort name' },
	{ name: 'startDate', description: 'Cohort start date' },
	{ name: 'endDate', description: 'Cohort end date' },
	{ name: 'sessionNumber', description: 'Session number', contextDependent: true },
	{ name: 'sessionTitle', description: 'Session title', contextDependent: true },
	{ name: 'currentSession', description: 'Current cohort session' },
	{ name: 'loginLink', description: 'Course login page' },
	{ name: 'dashboardLink', description: 'Course dashboard' },
	{ name: 'materialsLink', description: 'Course materials page' },
	{ name: 'reflectionLink', description: 'Reflections page' },
	{ name: 'supportEmail', description: 'Support contact email' }
];

const courseContext: EmailContextConfig = {
	label: 'Course',

	getRecipientsUrl: (courseSlug) => `/api/courses/${courseSlug}/enrollments?status=active&limit=100`,

	normalizeRecipients: (apiResponse: unknown) => {
		const response = apiResponse as { enrollments?: Array<Record<string, unknown>> };
		const enrollments = response?.enrollments || [];
		return enrollments.map((e) => ({
			id: e.id as string,
			displayName: (e.full_name as string) || 'Unknown',
			email: (e.email as string) || '',
			raw: e
		}));
	},

	buildVariables: (recipient, contextData, origin) => {
		const raw = recipient.raw;
		const course = contextData.course as Record<string, unknown> | undefined;
		const cohorts = contextData.cohorts as Array<Record<string, unknown>> | undefined;

		// Find cohort for this enrollment
		const cohort = cohorts?.find((c) => c.id === raw.cohort_id);

		const fullName = (raw.full_name as string) || '';
		const nameParts = fullName.split(' ');
		const firstName = nameParts[0] || '';
		const lastName = nameParts.slice(1).join(' ') || '';

		const courseSlug = (course?.slug as string) || '';

		return {
			firstName,
			lastName,
			fullName,
			email: (raw.email as string) || '',
			hubName: ((raw.courses_hubs as Record<string, unknown>)?.name as string) || '',
			courseName: (course?.name as string) || '',
			courseSlug,
			cohortName: (cohort?.name as string) || '',
			startDate: cohort?.start_date
				? new Date(cohort.start_date as string).toLocaleDateString()
				: '',
			endDate: cohort?.end_date ? new Date(cohort.end_date as string).toLocaleDateString() : '',
			sessionNumber: String((raw.current_session as number) || (cohort?.current_session as number) || ''),
			sessionTitle: '', // Would need session lookup
			currentSession: String((cohort?.current_session as number) || ''),
			loginLink: `${origin}/courses/${courseSlug}`,
			dashboardLink: `${origin}/courses/${courseSlug}/dashboard`,
			materialsLink: `${origin}/courses/${courseSlug}/materials`,
			reflectionLink: `${origin}/courses/${courseSlug}/reflections`,
			supportEmail: 'support@archdiocesanministries.org.au'
		};
	},

	sampleRecipient: {
		displayName: 'Sample Student',
		email: 'sample@example.com',
		variables: {
			firstName: 'John',
			lastName: 'Smith',
			fullName: 'John Smith',
			email: 'john.smith@example.com',
			hubName: 'Sample Hub',
			courseName: 'Sample Course',
			courseSlug: 'sample-course',
			cohortName: 'Sample Cohort 2025',
			startDate: 'January 1, 2025',
			endDate: 'March 31, 2025',
			sessionNumber: '1',
			sessionTitle: 'Introduction',
			currentSession: '1',
			loginLink: 'https://example.com/courses/sample-course',
			dashboardLink: 'https://example.com/courses/sample-course/dashboard',
			materialsLink: 'https://example.com/courses/sample-course/materials',
			reflectionLink: 'https://example.com/courses/sample-course/reflections',
			supportEmail: 'support@archdiocesanministries.org.au'
		}
	},

	variables: COURSE_VARIABLES
};

// =====================================================
// DGR CONTEXT
// =====================================================

const DGR_VARIABLES: EmailVariable[] = [
	{ name: 'contributor_name', description: 'Contributor full name' },
	{ name: 'contributor_first_name', description: 'Contributor first name (with title if applicable, e.g. "Fr Michael")' },
	{ name: 'contributor_title', description: 'Contributor title (Fr, Sr, Br, Deacon)' },
	{ name: 'contributor_email', description: 'Contributor email address' },
	{ name: 'write_url', description: 'Personal writing portal URL' },
	{ name: 'write_url_button', description: 'Styled button for portal link' },
	{ name: 'due_date', description: 'Formatted due date', contextDependent: true },
	{ name: 'due_date_text', description: 'Relative date text', contextDependent: true },
	{ name: 'liturgical_date', description: 'Liturgical day name', contextDependent: true },
	{ name: 'gospel_reference', description: 'Gospel reading reference', contextDependent: true }
];

const dgrContext: EmailContextConfig = {
	label: 'DGR',

	getRecipientsUrl: () => '/api/dgr-admin/contributors',

	normalizeRecipients: (apiResponse: unknown) => {
		const response = apiResponse as { contributors?: Array<Record<string, unknown>> };
		const contributors = response?.contributors || [];
		return contributors.map((c) => {
			const name = (c.name as string) || 'Unknown';
			const title = (c.title as string) || '';
			// Include title in display name if present (e.g., "Fr Michael Grace")
			const displayName = title ? `${title} ${name}` : name;
			return {
				id: c.id as string,
				displayName,
				email: (c.email as string) || '',
				raw: c
			};
		});
	},

	buildVariables: (recipient, _contextData, origin) => {
		const raw = recipient.raw;
		const name = (raw.name as string) || '';
		const title = (raw.title as string) || '';
		const firstName = name.split(' ')[0] || '';
		// Build addressed name: "Fr Michael" or just "Michael" if no title
		const addressedFirstName = title ? `${title} ${firstName}` : firstName;
		const accessToken = (raw.access_token as string) || '';
		const writeUrl = `${origin}/dgr/write/${accessToken}`;

		// Build the button HTML
		const writeUrlButton = `<a href="${writeUrl}" style="background-color:#009199;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Write Your Reflection</a>`;

		return {
			contributor_name: name,
			contributor_first_name: addressedFirstName,
			contributor_title: title,
			contributor_email: (raw.email as string) || '',
			write_url: writeUrl,
			write_url_button: writeUrlButton,
			// Context-dependent vars use sample values in test mode
			due_date: 'Monday, 15 January 2025',
			due_date_text: 'tomorrow',
			liturgical_date: 'Second Sunday in Ordinary Time',
			gospel_reference: 'John 2:1-11'
		};
	},

	sampleRecipient: {
		displayName: 'Sample Contributor',
		email: 'sample@example.com',
		variables: {
			contributor_name: 'Jane Doe',
			contributor_first_name: 'Jane',
			contributor_title: '',
			contributor_email: 'jane.doe@example.com',
			write_url: 'https://example.com/dgr/write/sample123',
			write_url_button:
				'<a href="https://example.com/dgr/write/sample123" style="background-color:#009199;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Write Your Reflection</a>',
			due_date: 'Monday, 15 January 2025',
			due_date_text: 'tomorrow',
			liturgical_date: 'Second Sunday in Ordinary Time',
			gospel_reference: 'John 2:1-11'
		}
	},

	variables: DGR_VARIABLES
};

// =====================================================
// PLATFORM CONTEXT (future)
// =====================================================

const PLATFORM_VARIABLES: EmailVariable[] = [
	{ name: 'userName', description: 'User full name' },
	{ name: 'userEmail', description: 'User email address' },
	{ name: 'platformName', description: 'Platform name' },
	{ name: 'supportEmail', description: 'Support contact email' }
];

const platformContext: EmailContextConfig = {
	label: 'Platform',

	getRecipientsUrl: () => '/api/admin/users',

	normalizeRecipients: (apiResponse: unknown) => {
		const users = (apiResponse as { users?: Array<Record<string, unknown>> })?.users || [];
		return users.map((u) => ({
			id: u.id as string,
			displayName: (u.full_name as string) || (u.email as string) || 'Unknown',
			email: (u.email as string) || '',
			raw: u
		}));
	},

	buildVariables: (recipient, _contextData, _origin) => {
		const raw = recipient.raw;
		return {
			userName: (raw.full_name as string) || '',
			userEmail: (raw.email as string) || '',
			platformName: 'Archdiocesan Ministries',
			supportEmail: 'support@archdiocesanministries.org.au'
		};
	},

	sampleRecipient: {
		displayName: 'Sample User',
		email: 'sample@example.com',
		variables: {
			userName: 'Sample User',
			userEmail: 'sample@example.com',
			platformName: 'Archdiocesan Ministries',
			supportEmail: 'support@archdiocesanministries.org.au'
		}
	},

	variables: PLATFORM_VARIABLES
};

// =====================================================
// EXPORTS
// =====================================================

export const EMAIL_CONTEXTS: Record<EmailContext, EmailContextConfig> = {
	course: courseContext,
	dgr: dgrContext,
	platform: platformContext
};

/**
 * Get context config by name
 */
export function getEmailContext(context: EmailContext): EmailContextConfig {
	return EMAIL_CONTEXTS[context];
}

/**
 * Substitute variables in a template string
 */
export function substituteVariables(
	template: string,
	variables: Record<string, string>
): string {
	if (!template) return '';

	let result = template;
	for (const [key, value] of Object.entries(variables)) {
		result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
	}
	return result;
}
