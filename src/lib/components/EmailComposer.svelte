<script>
	/**
	 * EmailComposer Component
	 * Reusable component for composing and sending ad-hoc emails
	 *
	 * Used for:
	 * - DGR reminder emails
	 * - Mid-week cohort messages
	 * - Missed reflection reminders
	 * - Any manual email sending
	 *
	 * @component
	 * @example
	 * <EmailComposer
	 *   recipients={[{ email: 'john@example.com', name: 'John' }]}
	 *   prefilledSubject="DGR Reminder"
	 *   prefilledMessage="Your reflection is due soon..."
	 *   onSend={handleSend}
	 * />
	 */

	import { apiPost } from '$lib/utils/api-handler.js';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';

	/** @type {Array<{email: string, name?: string}>} Array of recipient objects */
	export let recipients = [];

	/** @type {string} Pre-filled subject line */
	export let prefilledSubject = '';

	/** @type {string} Pre-filled message body */
	export let prefilledMessage = '';

	/** @type {string} Email type for logging */
	export let emailType = 'adhoc';

	/** @type {(subject: string, message: string) => Promise<void>} Callback when send is clicked */
	export let onSend = null;

	let subject = $state(prefilledSubject);
	let message = $state(prefilledMessage);
	let isSending = $state(false);
	let showPreview = $state(false);

	// Character counts for feedback
	const subjectLength = $derived(subject.length);
	const messageLength = $derived(message.length);
	const recipientCount = $derived(recipients.length);

	async function handleSend() {
		// Validation
		if (!subject.trim()) {
			toastError('Please enter a subject line');
			return;
		}

		if (!message.trim()) {
			toastError('Please enter a message');
			return;
		}

		if (recipients.length === 0) {
			toastError('No recipients selected');
			return;
		}

		// Confirm before sending
		const confirmed = confirm(
			`Send email to ${recipientCount} recipient${recipientCount > 1 ? 's' : ''}?`
		);

		if (!confirmed) return;

		isSending = true;

		try {
			if (onSend) {
				// Use custom send handler if provided
				await onSend(subject, message);
			} else {
				// Default: use API endpoint
				await apiPost('/api/email/send-bulk', {
					recipients: recipients.map(r => r.email),
					subject,
					message,
					emailType
				}, {
					loadingMessage: `Sending email to ${recipientCount} recipient${recipientCount > 1 ? 's' : ''}...`,
					successMessage: `Email sent successfully to ${recipientCount} recipient${recipientCount > 1 ? 's' : ''}!`
				});
			}

			// Clear form after successful send
			subject = '';
			message = '';
		} catch (error) {
			toastError(error.message || 'Failed to send email');
		} finally {
			isSending = false;
		}
	}

	function togglePreview() {
		showPreview = !showPreview;
	}

	// Update when prefilled props change
	$effect(() => {
		subject = prefilledSubject;
		message = prefilledMessage;
	});
</script>

<div class="email-composer">
	<div class="composer-header">
		<h3>Compose Email</h3>
		<div class="recipient-count">
			To: {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
		</div>
	</div>

	<div class="form-group">
		<label for="subject">
			Subject
			<span class="char-count">{subjectLength} characters</span>
		</label>
		<input
			id="subject"
			type="text"
			bind:value={subject}
			placeholder="Enter email subject..."
			disabled={isSending}
			maxlength="200"
		/>
	</div>

	<div class="form-group">
		<label for="message">
			Message
			<span class="char-count">{messageLength} characters</span>
		</label>
		<textarea
			id="message"
			bind:value={message}
			placeholder="Enter your message..."
			disabled={isSending}
			rows="12"
		></textarea>
		<div class="help-text">
			Plain text emails will be automatically formatted with professional styling.
		</div>
	</div>

	{#if recipients.length > 0}
		<details class="recipient-list">
			<summary>View recipients ({recipientCount})</summary>
			<ul>
				{#each recipients as recipient}
					<li>
						{#if recipient.name}
							<strong>{recipient.name}</strong> &lt;{recipient.email}&gt;
						{:else}
							{recipient.email}
						{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/if}

	<div class="actions">
		<button
			type="button"
			onclick={togglePreview}
			disabled={isSending || !subject.trim() || !message.trim()}
			class="btn-secondary"
		>
			{showPreview ? 'Hide Preview' : 'Preview Email'}
		</button>

		<button
			type="button"
			onclick={handleSend}
			disabled={isSending || !subject.trim() || !message.trim() || recipients.length === 0}
			class="btn-primary"
		>
			{isSending ? 'Sending...' : `Send Email (${recipientCount})`}
		</button>
	</div>

	{#if showPreview}
		<div class="email-preview">
			<h4>Email Preview</h4>
			<div class="preview-subject">
				<strong>Subject:</strong> {subject}
			</div>
			<div class="preview-body">
				{message}
			</div>
			<div class="preview-note">
				Note: Actual email will include professional formatting and branding.
			</div>
		</div>
	{/if}
</div>

<style>
	.email-composer {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
		background: white;
	}

	.composer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.composer-header h3 {
		margin: 0;
		font-size: 1.25rem;
	}

	.recipient-count {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: var(--color-text);
	}

	.char-count {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		font-weight: normal;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.9375rem;
	}

	.form-group textarea {
		resize: vertical;
		min-height: 200px;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(51, 70, 66, 0.1);
	}

	.help-text {
		margin-top: 0.5rem;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.recipient-list {
		margin-bottom: 1.25rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: 4px;
	}

	.recipient-list summary {
		cursor: pointer;
		font-weight: 500;
		user-select: none;
	}

	.recipient-list ul {
		margin: 0.75rem 0 0 0;
		padding-left: 1.5rem;
	}

	.recipient-list li {
		margin-bottom: 0.25rem;
		font-size: 0.875rem;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}

	.btn-secondary {
		background: white;
		color: var(--color-primary);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-bg-secondary);
	}

	.btn-primary:disabled,
	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.email-preview {
		margin-top: 1.5rem;
		padding: 1.5rem;
		background: var(--color-bg-secondary);
		border-radius: 4px;
		border: 1px solid var(--color-border);
	}

	.email-preview h4 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
	}

	.preview-subject {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.preview-body {
		white-space: pre-wrap;
		font-size: 0.9375rem;
		line-height: 1.6;
		margin-bottom: 1rem;
	}

	.preview-note {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		font-style: italic;
	}
</style>
