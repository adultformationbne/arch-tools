// Friendly labels for the system email_type strings that never go through a
// DB template (and so have no email_templates.name to fall back on).
const EMAIL_TYPE_LABELS: Record<string, string> = {
	welcome_enrolled: 'Welcome',
	self_enrollment_welcome: 'Welcome',
	batch_enrollment_invitation: 'Enrollment Invitation',
	group_registration_confirmation: 'Group Registration Confirmation',
	hub_enrollment_notification: 'Hub Enrollment Notification',
	enrollment_admin_notification: 'Admin Notification',
	payment_failure_admin_notification: 'Payment Failure Notification',
	payment_receipt: 'Payment Receipt',
	reflection_marked: 'Reflection Feedback',
	quiz_marked: 'Quiz Feedback',
	session_advance: 'Session Materials Ready',
	custom: 'Custom Email'
};

export function emailDisplayName(log: {
	email_type: string;
	email_templates?: { name?: string | null } | null;
}): string {
	return (
		log.email_templates?.name ||
		EMAIL_TYPE_LABELS[log.email_type] ||
		log.email_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
	);
}
