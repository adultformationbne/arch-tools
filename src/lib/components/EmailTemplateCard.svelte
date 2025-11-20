<script>
	import { Mail, Lock, FileText, Edit, Trash2, Eye, Clock } from 'lucide-svelte';

	let { template, courseSlug, onEdit, onDelete = null } = $props();

	const isSystem = $derived(template.category === 'system');
	const isDeletable = $derived(template.is_deletable);

	// Format date
	function formatDate(dateString) {
		if (!dateString) return 'Unknown';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Get trigger event display name
	function getTriggerDisplay(triggerEvent) {
		const triggers = {
			enrollment_accepted: 'When student accepts enrollment',
			session_advance: 'When session advances',
			manual: 'Manual send only',
			null: 'Manual send only'
		};
		return triggers[triggerEvent] || triggers.null;
	}
</script>

<div
	class="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
	style="border-color: var(--course-surface);"
>
	<!-- Header with Badge -->
	<div class="p-5 pb-4 border-b border-gray-100">
		<div class="flex items-start justify-between gap-3 mb-2">
			<div class="flex items-start gap-2 flex-1">
				{#if isSystem}
					<Lock size={18} class="mt-0.5 flex-shrink-0" style="color: var(--course-accent-dark);" />
				{:else}
					<FileText size={18} class="mt-0.5 flex-shrink-0" style="color: var(--course-accent-light);" />
				{/if}
				<div class="flex-1 min-w-0">
					<h3 class="font-semibold text-gray-900 text-lg leading-tight">
						{template.name}
					</h3>
					{#if isSystem}
						<div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-2"
							style="background-color: var(--course-accent-dark); color: white;">
							<Lock size={12} />
							System Template
						</div>
					{:else}
						<div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-2 bg-gray-100 text-gray-700">
							<FileText size={12} />
							Custom
						</div>
					{/if}
				</div>
			</div>
		</div>

		{#if template.description}
			<p class="text-sm text-gray-600 mt-2 line-clamp-2">
				{template.description}
			</p>
		{/if}
	</div>

	<!-- Content -->
	<div class="p-5 pt-4 space-y-3">
		<!-- Subject Line -->
		<div>
			<div class="text-xs font-medium text-gray-500 mb-1">Subject</div>
			<div class="text-sm text-gray-900 font-medium">
				{template.subject_template}
			</div>
		</div>

		<!-- Trigger Event (for system templates) -->
		{#if template.trigger_event || isSystem}
			<div class="flex items-start gap-2">
				<Clock size={14} class="mt-0.5 text-gray-400 flex-shrink-0" />
				<div class="text-xs text-gray-600">
					{getTriggerDisplay(template.trigger_event)}
				</div>
			</div>
		{/if}

		<!-- Variables Count -->
		{#if template.available_variables && template.available_variables.length > 0}
			<div class="text-xs text-gray-500">
				Uses {template.available_variables.length} variable{template.available_variables.length !== 1 ? 's' : ''}
			</div>
		{/if}

		<!-- Metadata -->
		<div class="text-xs text-gray-400 pt-2 border-t border-gray-100">
			Updated {formatDate(template.updated_at)}
		</div>
	</div>

	<!-- Actions -->
	<div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
		<!-- Edit Button -->
		<button
			onclick={onEdit}
			class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 text-gray-700"
		>
			<Edit size={14} />
			Edit
		</button>

		<!-- Delete Button (only for custom templates) -->
		{#if isDeletable && onDelete}
			<button
				onclick={onDelete}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-red-50 text-red-600"
			>
				<Trash2 size={14} />
				Delete
			</button>
		{:else if !isDeletable}
			<div class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 cursor-not-allowed">
				<Lock size={14} />
				Protected
			</div>
		{/if}
	</div>
</div>
