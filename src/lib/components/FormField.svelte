<!--
  FormField - A reusable form field component with built-in validation

  Features:
  - Consistent styling across the app
  - Built-in validation with real-time feedback
  - Support for various input types
  - Error display with proper ARIA attributes
  - Label and help text support

  @example
  <FormField
    label="Email Address"
    type="email"
    bind:value={email}
    validators={[validators.required, validators.email]}
    placeholder="Enter your email"
  />
-->

<script>
	import { validateField } from '$lib/utils/form-validator.js';

	let {
		// Required props
		label = '',
		type = 'text',
		value = $bindable(''),

		// Validation
		validators = [],
		validateOnBlur = true,
		validateOnInput = false,
		showError = true,

		// Input attributes
		placeholder = '',
		required = false,
		disabled = false,
		readonly = false,
		id = '',
		name = '',
		autocomplete = '',

		// Styling
		class: className = '',
		fieldClass = '',
		labelClass = '',
		errorClass = '',

		// Textarea specific
		rows = 3,
		cols = undefined,

		// Select specific
		options = [],

		// Additional props
		helpText = '',
		...restProps
	} = $props();

	// Generate unique ID if not provided
	const fieldId = id || `field-${Math.random().toString(36).substr(2, 9)}`;

	// Validation state
	let error = $state('');
	let touched = $state(false);
	let validationTriggered = $state(false);

	// Validate field
	function validate() {
		if (!validators.length) return '';
		return validateField(value, validators, label || 'Field');
	}

	// Handle input events
	function handleInput(event) {
		value = event.target.value;

		if (validateOnInput && touched) {
			error = validate();
		}
	}

	function handleBlur() {
		touched = true;
		validationTriggered = true;

		if (validateOnBlur) {
			error = validate();
		}
	}

	function handleFocus() {
		// Clear error on focus if user is actively editing
		if (error && validateOnInput) {
			error = '';
		}
	}

	// Public validation method for parent components
	export function validateNow() {
		touched = true;
		validationTriggered = true;
		error = validate();
		return !error;
	}

	// Public method to clear validation
	export function clearValidation() {
		error = '';
		touched = false;
		validationTriggered = false;
	}

	// Reactive validation when validators change
	$effect(() => {
		if (validationTriggered && validators.length) {
			error = validate();
		}
	});

	// Determine if field should show as invalid
	$derived: isInvalid = (() => !!(error && touched && showError))();
	$derived: showValidationError = (() => isInvalid && error)();

	// CSS classes
	$derived: baseFieldClasses = (() => `
		block w-full rounded-md border text-sm transition-colors
		focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none
		disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
		${isInvalid
			? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500'
			: 'border-gray-300 focus:border-blue-500'
		}
		${fieldClass}
	`.trim())();

	$derived: baseLabelClasses = (() => `
		block text-sm font-medium
		${isInvalid ? 'text-red-700' : 'text-gray-700'}
		${required ? "after:content-['*'] after:text-red-500" : ''}
		${labelClass}
	`.trim())();
</script>

<div class="form-field {className}">
	<!-- Label -->
	{#if label}
		<label for={fieldId} class={baseLabelClasses}>
			{label}
		</label>
	{/if}

	<!-- Help text -->
	{#if helpText && !showValidationError}
		<p class="text-xs text-gray-600 mb-1" id="{fieldId}-help">
			{helpText}
		</p>
	{/if}

	<!-- Input based on type -->
	{#if type === 'textarea'}
		<textarea
			{...restProps}
			id={fieldId}
			{name}
			{placeholder}
			{required}
			{disabled}
			{readonly}
			{rows}
			{cols}
			{autocomplete}
			class={baseFieldClasses}
			aria-invalid={isInvalid}
			aria-describedby={showValidationError ? `${fieldId}-error` : helpText ? `${fieldId}-help` : undefined}
			{value}
			oninput={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
		></textarea>
	{:else if type === 'select'}
		<select
			{...restProps}
			id={fieldId}
			{name}
			{required}
			{disabled}
			{autocomplete}
			class={baseFieldClasses}
			aria-invalid={isInvalid}
			aria-describedby={showValidationError ? `${fieldId}-error` : helpText ? `${fieldId}-help` : undefined}
			{value}
			onchange={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
		>
			{#if placeholder}
				<option value="" disabled selected={!value}>
					{placeholder}
				</option>
			{/if}
			{#each options as option}
				{#if typeof option === 'string'}
					<option value={option}>{option}</option>
				{:else}
					<option value={option.value}>{option.label}</option>
				{/if}
			{/each}
		</select>
	{:else}
		<input
			{...restProps}
			{type}
			id={fieldId}
			{name}
			{placeholder}
			{required}
			{disabled}
			{readonly}
			{autocomplete}
			class={baseFieldClasses}
			aria-invalid={isInvalid}
			aria-describedby={showValidationError ? `${fieldId}-error` : helpText ? `${fieldId}-help` : undefined}
			{value}
			oninput={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
		/>
	{/if}

	<!-- Error message -->
	{#if showValidationError}
		<p
			class="mt-1 text-xs text-red-600 {errorClass}"
			id="{fieldId}-error"
			role="alert"
		>
			{error}
		</p>
	{/if}
</div>

<style>
	.form-field {
		margin-bottom: 1rem;
	}

	.form-field > * + * {
		margin-top: 0.25rem;
	}

	/* Custom focus styles for better accessibility */
	.form-field input:focus,
	.form-field textarea:focus,
	.form-field select:focus {
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
	}

	/* Error state focus styles */
	.form-field input[aria-invalid="true"]:focus,
	.form-field textarea[aria-invalid="true"]:focus,
	.form-field select[aria-invalid="true"]:focus {
		box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5);
	}
</style>