# Toast Notification System Guide

## Overview

The toast notification system provides a centralized way to display user feedback messages in the AHWGP Editor application. Built with Svelte 5's new rune syntax, it supports multiple notification types, multi-step processes, and automatic dismissal.

## Installation

The toast system is already set up in the project. To use it in any component:

```javascript
import { toast } from '$lib/stores/toast.svelte.js';
import ToastContainer from '$lib/components/ToastContainer.svelte';
```

**Important:** Add `<ToastContainer />` once at the root level of your page (typically at the bottom).

## Basic Usage

### Simple Notifications

```javascript
// Success notification
toast.success({
	title: 'Success!',
	message: 'Your changes have been saved',
	duration: 3000 // milliseconds (optional, default: 5000)
});

// Error notification
toast.error({
	title: 'Error',
	message: 'Failed to save changes',
	duration: 5000
});

// Warning notification
toast.warning({
	title: 'Warning',
	message: 'Please review your input',
	duration: 4000
});

// Info notification
toast.info({
	title: 'Note',
	message: 'New updates are available',
	duration: 3000
});
```

### Loading States

```javascript
// Show a loading toast (infinite duration by default)
const toastId = toast.loading({
	title: 'Processing...',
	message: 'Please wait while we save your data'
});

// Later, update it to show success
toast.updateToast(toastId, {
	title: 'Complete!',
	message: 'Your data has been saved',
	type: 'success',
	duration: 3000
});

// Or dismiss it if needed
toast.dismiss(toastId);
```

## Advanced Features

### Multi-Step Toasts

Perfect for workflows with multiple stages:

```javascript
const toastId = toast.multiStep({
	steps: [
		{
			title: 'Validating...',
			message: 'Checking your input',
			type: 'info'
		},
		{
			title: 'Processing...',
			message: 'Saving to database',
			type: 'loading'
		},
		{
			title: 'Uploading...',
			message: 'Sending files to server',
			type: 'loading'
		},
		{
			title: 'Success!',
			message: 'Everything is complete',
			type: 'success'
		}
	],
	closeable: false // Prevent closing during process
});

// Progress through steps
await validateData();
toast.nextStep(toastId);

await saveToDatabase();
toast.nextStep(toastId);

await uploadFiles();
toast.nextStep(toastId);

// Auto-dismiss after completion
setTimeout(() => toast.dismiss(toastId), 3000);
```

### Manual Step Control

```javascript
// Jump to specific step
toast.updateStep(toastId, 2); // Go to step 3 (0-indexed)

// Update current step's content
toast.updateToast(toastId, {
	message: 'Almost done...'
});
```

### Closeable Control

```javascript
// Non-closeable toast (good for critical operations)
toast.info({
	title: 'System Update',
	message: 'Please do not close this window',
	closeable: false,
	duration: -1 // Infinite duration
});
```

### Callbacks

```javascript
toast.success({
	title: 'Deleted',
	message: 'Item has been removed',
	onClose: () => {
		console.log('User closed the toast');
		// Perform cleanup or other actions
	}
});
```

## Configuration Options

### Toast Options

| Option      | Type     | Default | Description                                                  |
| ----------- | -------- | ------- | ------------------------------------------------------------ |
| `title`     | string   | ''      | Main heading of the toast                                    |
| `message`   | string   | ''      | Detailed message content                                     |
| `type`      | string   | 'info'  | Toast type: 'success', 'error', 'warning', 'info', 'loading' |
| `duration`  | number   | 5000    | Auto-dismiss time in milliseconds (-1 for infinite)          |
| `closeable` | boolean  | true    | Whether the toast can be manually closed                     |
| `steps`     | array    | null    | Array of step objects for multi-step toasts                  |
| `onClose`   | function | null    | Callback when toast is dismissed                             |

### Duration Constants

```javascript
import { DURATIONS } from '$lib/stores/toast.svelte.js';

toast.success({
	title: 'Quick message',
	duration: DURATIONS.short // 3000ms
});
 c 
// Available durations:
// DURATIONS.short    = 3000ms
// DURATIONS.medium   = 5000ms (default)
// DURATIONS.long     = 8000ms
// DURATIONS.infinite = -1
```

## Real-World Examples

### Form Submission with Feedback

```javascript
async function handleSubmit(e) {
	e.preventDefault();

	const toastId = toast.loading({
		title: 'Submitting form...',
		message: 'Please wait'
	});

	try {
		const response = await fetch('/api/submit', {
			method: 'POST',
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			toast.updateToast(toastId, {
				title: 'Success!',
				message: 'Form submitted successfully',
				type: 'success',
				duration: 3000
			});
		} else {
			throw new Error('Submission failed');
		}
	} catch (error) {
		toast.updateToast(toastId, {
			title: 'Submission Failed',
			message: error.message,
			type: 'error',
			duration: 5000
		});
	}
}
```

### File Upload with Progress

```javascript
async function uploadFile(file) {
	const toastId = toast.multiStep({
		steps: [
			{ title: 'Preparing upload...', type: 'info' },
			{ title: 'Uploading file...', type: 'loading' },
			{ title: 'Processing...', type: 'loading' },
			{ title: 'Complete!', type: 'success' }
		]
	});

	try {
		// Step 1: Prepare
		await prepareUpload(file);
		toast.nextStep(toastId);

		// Step 2: Upload
		await uploadToServer(file);
		toast.nextStep(toastId);

		// Step 3: Process
		await processFile(file);
		toast.nextStep(toastId);

		// Auto-dismiss after 3 seconds
		setTimeout(() => toast.dismiss(toastId), 3000);
	} catch (error) {
		toast.updateToast(toastId, {
			title: 'Upload Failed',
			message: error.message,
			type: 'error',
			closeable: true,
			duration: 5000
		});
	}
}
```

### Clipboard Operations

```javascript
async function copyToClipboard(text) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success({
			title: 'Copied!',
			message: 'Text copied to clipboard',
			duration: 2000
		});
	} catch (err) {
		toast.error({
			title: 'Copy Failed',
			message: 'Could not access clipboard',
			duration: 3000
		});
	}
}
```

## Best Practices

1. **Use appropriate types**: Match the toast type to the message context (success for completions, error for failures, etc.)

2. **Keep messages concise**: Titles should be short (2-3 words), messages should be one line when possible

3. **Set appropriate durations**:
   - Quick confirmations: 2-3 seconds
   - Important messages: 5 seconds
   - Errors: 5-8 seconds
   - Loading states: infinite until resolved

4. **Use multi-step for complex workflows**: Shows users progress through long operations

5. **Always handle errors**: Update loading toasts to error states rather than leaving them spinning

6. **Consider accessibility**: Important errors should have longer durations or require manual dismissal

7. **Don't overuse**: Too many toasts can overwhelm users - batch related notifications when possible

## Styling and Positioning

The toast container is positioned in the top-right corner by default. Toasts stack vertically with spacing between them. Each toast type has distinct colors:

- **Success**: Green background
- **Error**: Red background
- **Warning**: Yellow background
- **Info**: Blue background
- **Loading**: Gray background

The system uses Tailwind CSS classes and includes smooth animations for appearance and dismissal.

## Troubleshooting

### Toast not appearing

- Ensure `<ToastContainer />` is added to your page
- Check that you've imported the toast store correctly
- Verify no CSS is hiding the toast container (z-index issues)

### Toast dismissing too quickly

- Increase the `duration` value
- Use `duration: -1` for manual dismissal only

### Multi-step not progressing

- Ensure you're calling `toast.nextStep(toastId)` with the correct ID
- Check that the step index is within bounds

## API Reference

### Store Methods

- `toast.add(options)` - Add a custom toast
- `toast.success(options)` - Show success toast
- `toast.error(options)` - Show error toast
- `toast.warning(options)` - Show warning toast
- `toast.info(options)` - Show info toast
- `toast.loading(options)` - Show loading toast
- `toast.multiStep(options)` - Create multi-step toast
- `toast.dismiss(id)` - Dismiss specific toast
- `toast.clear()` - Dismiss all toasts
- `toast.updateToast(id, updates)` - Update toast properties
- `toast.nextStep(id)` - Progress to next step
- `toast.updateStep(id, stepIndex)` - Jump to specific step
