import { describe, it, expect } from 'vitest';
import { buildCourseVariablesFromEnrollment } from '$lib/email/context-config';

/**
 * The support address in an email is the course's own reply-to. The admin email
 * dialog previews emails in the browser from the course object it is handed, so
 * that object has to carry the email settings; without them the preview showed
 * another course's address.
 */
describe('support email in course emails', () => {
	const enrollment = { full_name: 'Test Leader', email: 'leader@example.com' };
	const origin = 'https://app.example.org';

	it("uses the course's own reply-to address", () => {
		const course = { slug: 'alivingunion', name: 'A Living Union', email_branding_config: { reply_to_email: 'formation@example.org' } };
		const variables = buildCourseVariablesFromEnrollment(enrollment, course, undefined, origin);
		expect(variables.supportEmail).toBe('formation@example.org');
	});

	it('uses a different address for a different course', () => {
		const course = { slug: 'cli', name: 'CLI', email_branding_config: { reply_to_email: 'leadership@example.org' } };
		expect(buildCourseVariablesFromEnrollment(enrollment, course, undefined, origin).supportEmail).toBe('leadership@example.org');
	});
});
