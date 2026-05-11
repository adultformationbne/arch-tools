/**
 * Default system email templates for courses.
 * These are generated for each course on creation and can be restored to defaults.
 */

export interface DefaultEmailTemplate {
	template_key: string;
	name: string;
	description: string;
	category: 'system';
	subject_template: string;
	body_template: string;
	available_variables: string[];
	trigger_event: string | null;
	is_deletable: false;
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
	{
		template_key: 'welcome_enrolled',
		name: 'Welcome to Course',
		description: 'Sent to participants when they are enrolled in a cohort',
		category: 'system',
		subject_template: 'Welcome to {{courseName}}!',
		body_template: `<p>Hi {{firstName}},</p>

<p>Welcome to <strong>{{courseName}}</strong>! We're so glad to have you with us.</p>

<p>Your course begins on <strong>{{startDate}}</strong>. Click the button below to access your course at any time.</p>

{{loginButton}}

<p>If you have any questions, don't hesitate to reach out at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>

<p>Blessings,</p>`,
		available_variables: [
			'firstName',
			'lastName',
			'fullName',
			'courseName',
			'cohortName',
			'startDate',
			'endDate',
			'loginLink',
			'loginButton',
			'dashboardLink',
			'supportEmail'
		],
		trigger_event: 'enrollment_created',
		is_deletable: false
	},
	{
		template_key: 'session_materials_ready',
		name: 'Session Materials Ready',
		description: 'Sent when new session materials become available',
		category: 'system',
		subject_template: 'Session {{sessionNumber}} materials are now available — {{courseName}}',
		body_template: `<p>Hi {{firstName}},</p>

<p>The materials for <strong>Session {{sessionNumber}}</strong> of <strong>{{courseName}}</strong> are now available.</p>

<p>Log in to access the new content.</p>

{{loginButton}}

<p>Blessings,</p>`,
		available_variables: [
			'firstName',
			'sessionNumber',
			'sessionTitle',
			'courseName',
			'cohortName',
			'loginLink',
			'loginButton',
			'materialsLink',
			'reflectionLink',
			'dashboardLink'
		],
		trigger_event: 'session_advanced',
		is_deletable: false
	},
	{
		template_key: 'reflection_reminder',
		name: 'Reflection Reminder',
		description: 'Reminder for participants with outstanding reflections',
		category: 'system',
		subject_template: 'Reminder: outstanding reflections in {{courseName}}',
		body_template: `<p>Hi {{firstName}},</p>

<p>This is a friendly reminder that you have outstanding reflections to complete in <strong>{{courseName}}</strong>.</p>

<p>Taking time to reflect helps you process and integrate what you're learning. Log in to submit your reflections.</p>

{{loginButton}}

<p>If you have any questions, contact us at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>

<p>Blessings,</p>`,
		available_variables: [
			'firstName',
			'fullName',
			'courseName',
			'cohortName',
			'loginLink',
			'loginButton',
			'reflectionLink',
			'dashboardLink',
			'supportEmail'
		],
		trigger_event: null,
		is_deletable: false
	},
	{
		template_key: 'login_instructions',
		name: 'Login Instructions',
		description: 'Instructions for accessing the course platform',
		category: 'system',
		subject_template: 'How to access {{courseName}}',
		body_template: `<p>Hi {{firstName}},</p>

<p>Accessing <strong>{{courseName}}</strong> is easy. We use a secure, passwordless login — just click the button below and we'll send a sign-in link to <strong>{{email}}</strong>.</p>

{{loginButton}}

<p>Open the email and click the link inside to log in instantly. The link is valid for a short time, so use it promptly.</p>

<p>If you have any trouble, contact us at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>

<p>Blessings,</p>`,
		available_variables: [
			'firstName',
			'fullName',
			'email',
			'courseName',
			'cohortName',
			'loginLink',
			'loginButton',
			'dashboardLink',
			'supportEmail'
		],
		trigger_event: null,
		is_deletable: false
	},
	{
		template_key: 'reflection_overdue',
		name: 'Reflection Overdue',
		description: 'Manually sent to participants who have not submitted their reflection',
		category: 'system',
		subject_template: 'Gentle reminder: Session {{sessionNumber}} reflection — {{courseName}}',
		body_template: `<p>Hi {{firstName}},</p>

<p>Just a gentle reminder that your <strong>Session {{sessionNumber}}</strong> reflection for <strong>{{courseName}}</strong> is still outstanding.</p>

<p>Your reflections are an important part of the journey — please take a moment to log in and share your thoughts.</p>

{{loginButton}}

<p>If you're experiencing any difficulties, please reach out to us at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>

<p>Blessings,</p>`,
		available_variables: [
			'firstName',
			'sessionNumber',
			'courseName',
			'cohortName',
			'loginLink',
			'loginButton',
			'reflectionLink',
			'dashboardLink',
			'supportEmail'
		],
		trigger_event: null,
		is_deletable: false
	},
	{
		template_key: 'reflection_marked',
		name: 'Reflection Marked Notification',
		description:
			'Sent to participants when their reflection has been reviewed. Limited to one email per day per participant.',
		category: 'system',
		subject_template: 'Your Session {{sessionNumber}} reflection has been reviewed — {{courseName}}',
		body_template: `<p>Hi {{firstName}},</p>

<p>Your <strong>Session {{sessionNumber}}</strong> reflection for <strong>{{courseName}}</strong> has been reviewed.</p>

<p>Log in to view your feedback.</p>

{{loginButton}}

<p>Keep up the great work!</p>`,
		available_variables: [
			'firstName',
			'lastName',
			'fullName',
			'email',
			'courseName',
			'courseSlug',
			'cohortName',
			'sessionNumber',
			'loginLink',
			'loginButton'
		],
		trigger_event: null,
		is_deletable: false
	}
];

/**
 * Get a specific default template by key
 */
export function getDefaultTemplate(templateKey: string): DefaultEmailTemplate | undefined {
	return DEFAULT_EMAIL_TEMPLATES.find((t) => t.template_key === templateKey);
}

/**
 * Get all default template keys
 */
export function getDefaultTemplateKeys(): string[] {
	return DEFAULT_EMAIL_TEMPLATES.map((t) => t.template_key);
}
