<script lang="ts">
	import {
		BookOpen,
		Plus,
		Trash2,
		MoreVertical,
		ChevronRight
	} from 'lucide-svelte';
	import { Card } from '$lib/design-system';
	import { Button } from '$lib/design-system';
	import Modal from '$lib/components/Modal.svelte';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';

	let { data, form } = $props();
	const courses = data.courses || [];
	const userRole = data.userRole;

	// Modal states
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteModal = $state(false);
	let selectedCourse = $state(null);

	// Form data
	let formData = $state({
		name: '',
		slug: '',
		description: '',
		metadata: '{}',
		settings: '{}'
	});

	// Theme data
	let themeData = $state({
		accentDark: '#334642',
		accentLight: '#c59a6b',
		fontFamily: 'Inter'
	});

	// Loading states
	let isSubmitting = $state(false);

	// Reset form data
	function resetForm() {
		formData = {
			name: '',
			slug: '',
			description: '',
			metadata: '{}',
			settings: '{}'
		};
		themeData = {
			accentDark: '#334642',
			accentLight: '#c59a6b',
			fontFamily: 'Inter'
		};
	}

	// Update settings JSON when theme changes
	function handleThemeChange(theme: any) {
		themeData = theme;
		// Update the settings field with theme data
		const currentSettings = JSON.parse(formData.settings || '{}');
		currentSettings.theme = theme;
		formData.settings = JSON.stringify(currentSettings, null, 2);
	}

	// Open create modal
	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	// Open edit modal
	function openEditModal(course: any) {
		selectedCourse = course;
		formData = {
			name: course.name || '',
			slug: course.slug || '',
			description: course.description || '',
			metadata: JSON.stringify(course.metadata || {}, null, 2),
			settings: JSON.stringify(course.settings || {}, null, 2)
		};
		// Extract theme from settings
		if (course.settings?.theme) {
			themeData = {
				accentDark: course.settings.theme.accentDark || '#334642',
				accentLight: course.settings.theme.accentLight || '#c59a6b',
				fontFamily: course.settings.theme.fontFamily || 'Inter'
			};
		} else {
			themeData = {
				accentDark: '#334642',
				accentLight: '#c59a6b',
				fontFamily: 'Inter'
			};
		}
		showEditModal = true;
	}

	// Open delete modal
	function openDeleteModal(course: any) {
		selectedCourse = course;
		showDeleteModal = true;
	}

	// Handle form responses
	$effect(() => {
		if (form) {
			if (form.type === 'success') {
				toastSuccess(form.message, 'Success');
				showCreateModal = false;
				showEditModal = false;
				showDeleteModal = false;
				resetForm();
			} else if (form.type === 'error') {
				toastError(form.message, 'Error');
			}
		}
	});

	// Get status badge color
	function getStatusColor(status: string) {
		const colors = {
			draft: 'bg-gray-100 text-gray-700',
			active: 'bg-green-100 text-green-700',
			archived: 'bg-orange-100 text-orange-700'
		};
		return colors[status] || 'bg-gray-100 text-gray-700';
	}
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="flex items-center text-3xl font-bold text-gray-900">
					<BookOpen class="mr-3 h-8 w-8" />
					{#if userRole === 'admin'}
						Course Management
					{:else}
						My Courses
					{/if}
				</h1>
				<p class="mt-2 text-gray-600">
					{#if userRole === 'admin'}
						Create and manage courses for your organization
					{:else if courses.length === 0}
						You are not currently enrolled in any courses
					{:else}
						Select a course to continue
					{/if}
				</p>
			</div>
			{#if userRole === 'admin'}
				<Button variant="primary" icon={Plus} onclick={openCreateModal}>
					Create Course
				</Button>
			{/if}
		</div>

		<!-- Courses Grid -->
		{#if courses.length > 0}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each courses as course}
					{@const accentDark = course.settings?.theme?.accentDark || '#334642'}
					{@const accentLight = course.settings?.theme?.accentLight || '#c59a6b'}
					<Card padding="none" shadow="md" class="overflow-hidden transition-all hover:shadow-lg">
						<!-- Accent color bar at top -->
						<div
							class="h-2"
							style="background: linear-gradient(90deg, {accentDark} 0%, {accentLight} 100%);"
						></div>

						<a
							href="/admin/courses/{course.slug}"
							class="block"
						>
							<div class="p-6">
								<!-- Course Header -->
								<div class="mb-4 flex items-start justify-between">
									<div class="flex-1">
										<h3 class="text-xl font-semibold" style="color: {accentDark};">
											{course.name}
										</h3>
										<p class="mt-1 text-sm font-mono text-gray-500">/{course.slug}</p>
									</div>
									<div
										class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
										style="background-color: {accentLight};"
									>
										<ChevronRight class="h-5 w-5" style="color: {accentDark};" />
									</div>
								</div>

								<!-- Course Description -->
								{#if course.description}
									<p class="line-clamp-3 text-sm text-gray-600">
										{course.description}
									</p>
								{/if}
							</div>
						</a>

						<!-- Footer -->
						<div
							class="flex items-center justify-between border-t px-6 py-3"
							style="background-color: {accentLight}20; border-color: {accentLight};"
						>
							<span class="text-sm font-medium" style="color: {accentDark};">
								{course.moduleCount || 0} {course.moduleCount === 1 ? 'module' : 'modules'}
							</span>
							{#if userRole === 'admin'}
								<button
									onclick={(e) => {
										e.preventDefault();
										openEditModal(course);
									}}
									class="rounded-lg p-2 transition-all hover:scale-110"
									style="color: {accentDark};"
									title="Edit course settings"
								>
									<MoreVertical class="h-4 w-4" />
								</button>
							{/if}
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<!-- Empty State -->
			<Card padding="xl" class="text-center">
				<BookOpen class="mx-auto h-12 w-12 text-gray-400" />
				<h3 class="mt-4 text-lg font-medium text-gray-900">No courses yet</h3>
				<p class="mt-2 text-sm text-gray-500">
					{#if userRole === 'admin'}
						Get started by creating your first course.
					{:else}
						Contact an administrator to enroll in a course.
					{/if}
				</p>
				{#if userRole === 'admin'}
					<div class="mt-6">
						<Button variant="primary" icon={Plus} onclick={openCreateModal}>
							Create Your First Course
						</Button>
					</div>
				{/if}
			</Card>
		{/if}
	</div>
</div>

<!-- Create Course Modal -->
<Modal
	isOpen={showCreateModal}
	title="Create New Course"
	size="lg"
	onClose={() => (showCreateModal = false)}
>
	<form method="POST" action="?/create" use:enhance>
		<div class="space-y-4">
			<div class="space-y-4">
				<div>
					<label for="name" class="mb-1 block text-sm font-medium text-gray-700">
						Course Name *
					</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={formData.name}
						required
						class="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
						placeholder="Introduction to Theology"
					/>
				</div>

				<div>
					<label for="slug" class="mb-1 block text-sm font-medium text-gray-700">
						URL Slug *
					</label>
					<input
						type="text"
						id="slug"
						name="slug"
						bind:value={formData.slug}
						required
						class="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
						placeholder="intro-theology"
					/>
					<p class="mt-1 text-xs text-gray-500">
						Used in URLs (e.g., /courses/intro-theology). Use lowercase letters and hyphens only.
					</p>
				</div>

				<div>
					<label for="description" class="mb-1 block text-sm font-medium text-gray-700">
						Description
					</label>
					<textarea
						id="description"
						name="description"
						bind:value={formData.description}
						rows="3"
						class="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
						placeholder="A comprehensive introduction to theological studies..."
					></textarea>
				</div>
			</div>

			<!-- Theme Settings -->
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h3 class="mb-4 text-sm font-semibold text-gray-700">Course Theme & Branding</h3>
				<ThemeSelector
					accentDark={themeData.accentDark}
					accentLight={themeData.accentLight}
					fontFamily={themeData.fontFamily}
					onThemeChange={handleThemeChange}
				/>
			</div>

			<details class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<summary class="cursor-pointer text-sm font-medium text-gray-700">
					Advanced Settings (JSON)
				</summary>
				<div class="mt-4 space-y-4">
					<div>
						<label for="metadata" class="mb-1 block text-sm font-medium text-gray-700">
							Metadata
						</label>
						<textarea
							id="metadata"
							name="metadata"
							bind:value={formData.metadata}
							rows="3"
							class="block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
						></textarea>
					</div>

					<div>
						<label for="settings" class="mb-1 block text-sm font-medium text-gray-700">
							Settings (auto-updated with theme)
						</label>
						<textarea
							id="settings"
							name="settings"
							bind:value={formData.settings}
							rows="3"
							class="block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
						></textarea>
					</div>
				</div>
			</details>
		</div>
	</form>

	{#snippet footer()}
		<div class="flex justify-end gap-3">
			<Button variant="secondary" onclick={() => (showCreateModal = false)}>Cancel</Button>
			<Button
				variant="primary"
				loading={isSubmitting}
				onclick={() => {
					isSubmitting = true;
					document.querySelector('form[action="?/create"]').requestSubmit();
				}}
			>
				Create Course
			</Button>
		</div>
	{/snippet}
</Modal>

<!-- Edit Course Modal -->
<Modal
	isOpen={showEditModal}
	title="Edit Course"
	size="lg"
	onClose={() => (showEditModal = false)}
>
	<form method="POST" action="?/update" use:enhance>
		<input type="hidden" name="course_id" value={selectedCourse?.id || ''} />

		<div class="space-y-4">
			<div class="space-y-4">
				<div>
					<label for="edit_name" class="mb-1 block text-sm font-medium text-gray-700">
						Course Name *
					</label>
					<input
						type="text"
						id="edit_name"
						name="name"
						bind:value={formData.name}
						required
						class="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
					/>
				</div>

				<div>
					<label for="edit_slug" class="mb-1 block text-sm font-medium text-gray-700">
						URL Slug *
					</label>
					<input
						type="text"
						id="edit_slug"
						name="slug"
						bind:value={formData.slug}
						required
						class="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
					/>
					<p class="mt-1 text-xs text-gray-500">
						Used in URLs (e.g., /courses/{formData.slug}). Use lowercase letters and hyphens only.
					</p>
				</div>

				<div>
					<label for="edit_description" class="mb-1 block text-sm font-medium text-gray-700">
						Description
					</label>
					<textarea
						id="edit_description"
						name="description"
						bind:value={formData.description}
						rows="3"
						class="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
					></textarea>
				</div>
			</div>

			<!-- Theme Settings -->
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h3 class="mb-4 text-sm font-semibold text-gray-700">Course Theme & Branding</h3>
				<ThemeSelector
					accentDark={themeData.accentDark}
					accentLight={themeData.accentLight}
					fontFamily={themeData.fontFamily}
					onThemeChange={handleThemeChange}
				/>
			</div>

			<details class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<summary class="cursor-pointer text-sm font-medium text-gray-700">
					Advanced Settings (JSON)
				</summary>
				<div class="mt-4 space-y-4">
					<div>
						<label for="edit_metadata" class="mb-1 block text-sm font-medium text-gray-700">
							Metadata
						</label>
						<textarea
							id="edit_metadata"
							name="metadata"
							bind:value={formData.metadata}
							rows="3"
							class="block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
						></textarea>
					</div>

					<div>
						<label for="edit_settings" class="mb-1 block text-sm font-medium text-gray-700">
							Settings (auto-updated with theme)
						</label>
						<textarea
							id="edit_settings"
							name="settings"
							bind:value={formData.settings}
							rows="3"
							class="block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
						></textarea>
					</div>
				</div>
			</details>
		</div>
	</form>

	{#snippet footer()}
		<div class="flex items-center justify-between">
			<Button
				variant="danger"
				onclick={() => {
					showEditModal = false;
					openDeleteModal(selectedCourse);
				}}
			>
				Delete Course
			</Button>
			<div class="flex gap-3">
				<Button variant="secondary" onclick={() => (showEditModal = false)}>Cancel</Button>
				<Button
					variant="primary"
					loading={isSubmitting}
					onclick={() => {
						isSubmitting = true;
						document.querySelector('form[action="?/update"]').requestSubmit();
					}}
				>
					Save Changes
				</Button>
			</div>
		</div>
	{/snippet}
</Modal>

<!-- Delete Confirmation Modal -->
<Modal
	isOpen={showDeleteModal}
	title="Delete Course"
	size="sm"
	onClose={() => (showDeleteModal = false)}
>
	<form method="POST" action="?/delete" use:enhance>
		<input type="hidden" name="course_id" value={selectedCourse?.id || ''} />

		<div class="space-y-4">
			<div class="flex items-center justify-center">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600"
				>
					<Trash2 class="h-6 w-6" />
				</div>
			</div>

			<div class="text-center">
				<p class="text-sm text-gray-600">
					Are you sure you want to delete <strong>{selectedCourse?.name}</strong>?
				</p>
				<p class="mt-2 text-sm text-red-600">
					This action cannot be undone. All course data, modules, cohorts, and enrollments will be
					affected.
				</p>
			</div>
		</div>
	</form>

	{#snippet footer()}
		<div class="flex justify-end gap-3">
			<Button variant="secondary" onclick={() => (showDeleteModal = false)}>Cancel</Button>
			<Button
				variant="danger"
				loading={isSubmitting}
				onclick={() => {
					isSubmitting = true;
					document.querySelector('form[action="?/delete"]').requestSubmit();
				}}
			>
				Delete Course
			</Button>
		</div>
	{/snippet}
</Modal>

<style>
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
