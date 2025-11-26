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
		description: 'Sent to students when they are enrolled in a cohort',
		category: 'system',
		subject_template: 'Welcome to {{courseName}}!',
		body_template: `Hi {{firstName}},

Welcome to {{courseName}}! We're excited to have you in our {{cohortName}} cohort.

Your course begins on {{startDate}}. You can access your dashboard here:
{{dashboardLink}}

If you have any questions, please contact us at {{supportEmail}}.

Blessings,
The {{courseName}} Team`,
		available_variables: [
			'firstName',
			'lastName',
			'fullName',
			'courseName',
			'cohortName',
			'startDate',
			'loginLink',
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
		subject_template: 'Session {{sessionNumber}} Materials Now Available',
		body_template: `Hi {{firstName}},

Great news! The materials for Session {{sessionNumber}} are now available in {{courseName}}.

View Materials:
{{materialsLink}}

Don't forget to submit your reflection after reviewing the materials.

Blessings,
The {{courseName}} Team`,
		available_variables: [
			'firstName',
			'sessionNumber',
			'sessionTitle',
			'courseName',
			'cohortName',
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
		description: 'Reminder for students with outstanding reflections',
		category: 'system',
		subject_template: 'You have reflections to complete in {{courseName}}',
		body_template: `Hi {{firstName}},

This is a friendly reminder that you have outstanding reflections to complete in {{courseName}}.

Please visit your reflections page to submit them:
{{reflectionLink}}

Completing your reflections helps you process and integrate what you're learning.

Blessings,
The {{courseName}} Team`,
		available_variables: [
			'firstName',
			'fullName',
			'courseName',
			'cohortName',
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
		subject_template: 'How to Access {{courseName}}',
		body_template: `Hi {{firstName}},

Here's how to access {{courseName}}:

1. Go to: {{loginLink}}
2. Enter your email address: {{email}}
3. Click "Sign In" to receive a magic link
4. Check your email and click the link to log in

Once logged in, you'll find:
- Your Dashboard: Overview of your progress
- Materials: Session content and resources
- Reflections: Submit and view your reflections

If you have any trouble logging in, please contact {{supportEmail}}.

Blessings,
The {{courseName}} Team`,
		available_variables: [
			'firstName',
			'fullName',
			'email',
			'courseName',
			'cohortName',
			'loginLink',
			'dashboardLink',
			'supportEmail'
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
