<script lang="ts">
	import {
		BookOpen,
		Plus,
		Trash2,
		MoreVertical,
		ChevronRight,
		Upload,
		X,
		Image
	} from '$lib/icons';
	import { Card } from '$lib/design-system';
	import { Button } from '$lib/design-system';
	import Modal from '$lib/components/Modal.svelte';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';

	let { data } = $props();
	const courses = $derived(data.courses || []);
	const managers = $derived(data.managers || []);
	const userRole = $derived(data.userRole);
	const userProfile = $derived(data.userProfile);

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
		metadata: '{}'
	});

	// Theme data (kept separate, merged into settings at submit time)
	let themeData = $state({
		accentDark: '#334642',
		accentLight: '#c59a6b',
		fontFamily: 'Inter'
	});

	// Loading states
	let isSubmitting = $state(false);
	let isUploadingLogo = $state(false);

	// Manager assignment
	let selectedManagerIds = $state([]);

	// Logo state
	let logoUrl = $state('');
	let logoPath = $state('');
	let logoPreview = $state('');
	let logoFile = $state<File | null>(null);

	// Base settings JSON (for advanced settings textarea, excludes theme/branding)
	let baseSettingsJson = $state('{}');

	// Reset form data
	function resetForm() {
		formData = { name: '', slug: '', description: '', metadata: '{}' };
		selectedManagerIds = [];
		themeData = { accentDark: '#334642', accentLight: '#c59a6b', fontFamily: 'Inter' };
		baseSettingsJson = '{}';
		isSubmitting = false;
		logoUrl = '';
		logoPath = '';
		logoPreview = '';
		logoFile = null;
	}

	// Handle logo file selection
	function handleLogoSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
		if (!allowedTypes.includes(file.type)) {
			toastError('Logo must be an image (JPEG, PNG, GIF, WebP, or SVG)');
			return;
		}

		if (file.size > 2 * 1024 * 1024) {
			toastError('Logo must be less than 2MB');
			return;
		}

		logoFile = file;
		logoPreview = URL.createObjectURL(file);
	}

	// Upload logo to server
	async function uploadLogo(courseSlug: string): Promise<string | null> {
		if (!logoFile) return logoUrl || null;

		isUploadingLogo = true;
		try {
			const uploadFormData = new FormData();
			uploadFormData.append('logo', logoFile);
			uploadFormData.append('courseSlug', courseSlug);

			const response = await fetch('/api/admin/courses/upload-logo', {
				method: 'POST',
				body: uploadFormData
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to upload logo');
			}

			const result = await response.json();
			logoUrl = result.url;
			logoPath = result.path;
			return result.url;
		} catch (error) {
			console.error('Logo upload error:', error);
			toastError(error instanceof Error ? error.message : 'Failed to upload logo');
			return null;
		} finally {
			isUploadingLogo = false;
		}
	}

	// Remove logo
	function removeLogo() {
		logoUrl = '';
		logoPath = '';
		logoPreview = '';
		logoFile = null;
	}

	// Theme changes just update local state (merged at submit time)
	function handleThemeChange(theme: any) {
		themeData = theme;
	}

	// Build final settings JSON from base settings + theme + branding
	function buildSettingsJson(): string {
		let settings: Record<string, any> = {};
		try {
			settings = JSON.parse(baseSettingsJson || '{}');
		} catch {
			settings = {};
		}
		settings.theme = themeData;
		settings.branding = {
			...(settings.branding || {}),
			logoUrl: logoUrl,
			showLogo: !!logoUrl
		};
		return JSON.stringify(settings, null, 2);
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
			metadata: JSON.stringify(course.metadata || {}, null, 2)
		};
		// Extract theme from settings
		if (course.settings?.theme) {
			themeData = {
				accentDark: course.settings.theme.accentDark || '#334642',
				accentLight: course.settings.theme.accentLight || '#c59a6b',
				fontFamily: course.settings.theme.fontFamily || 'Inter'
			};
		} else {
			themeData = { accentDark: '#334642', accentLight: '#c59a6b', fontFamily: 'Inter' };
		}
		// Store base settings (without theme/branding, for the advanced textarea)
		const settingsCopy = { ...(course.settings || {}) };
		delete settingsCopy.theme;
		delete settingsCopy.branding;
		baseSettingsJson = JSON.stringify(settingsCopy, null, 2);
		// Extract logo from branding settings
		if (course.settings?.branding?.logoUrl) {
			logoUrl = course.settings.branding.logoUrl;
			logoPreview = course.settings.branding.logoUrl;
		} else {
			logoUrl = '';
			logoPreview = '';
		}
		logoFile = null;
		logoPath = '';
		// Find which managers are assigned to this course
		selectedManagerIds = managers
			.filter(m => m.assigned_course_ids?.includes(course.id))
			.map(m => m.id);
		showEditModal = true;
	}

	// Open delete modal
	function openDeleteModal(course: any) {
		selectedCourse = course;
		showDeleteModal = true;
	}

	// Enhance callback with optional pre-submit hook
	function handleFormResult(options?: { beforeSubmit?: (fd: FormData) => Promise<void> }) {
		return async ({ formData: fd, cancel }: any) => {
			isSubmitting = true;

			try {
				if (options?.beforeSubmit) {
					await options.beforeSubmit(fd);
				}
			} catch (error) {
				isSubmitting = false;
				toastError(error instanceof Error ? error.message : 'Pre-submit error');
				cancel();
				return;
			}

			return async ({ result }: any) => {
				isSubmitting = false;
				if (result.type === 'success') {
					const msg = result.data?.message || 'Success';
					toastSuccess(msg, 'Success');
					showCreateModal = false;
					showEditModal = false;
					showDeleteModal = false;
					resetForm();
					await invalidateAll();
				} else if (result.type === 'failure') {
					const msg = result.data?.message || 'An error occurred';
					toastError(msg, 'Error');
				} else {
					await applyAction(result);
				}
			};
		};
	}

	// Get status badge color
	function getStatusColor(status: string) {
		const colors = {
			draft: 'bg-gray-100 text-gray-700',
			active: 'bg-green-100 text-green-700',
			archived: 'bg-orange-100 text-orange-700'
		};
		return colors[status] || 'bg-gray-100 text-gray-700';
	}

	// Check if user can delete a course
	function canDeleteCourse(course: any) {
		if (userRole === 'admin') return true;
		if (userRole === 'manager') {
			const createdByRole = course.metadata?.created_by_role;
			const createdByUserId = course.metadata?.created_by_user_id;
			return createdByRole === 'manager' && createdByUserId === userProfile?.id;
		}
		return false;
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
						Create and manage courses for your organisation
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
					{@const logoUrl = course.settings?.branding?.logoUrl}
					<Card padding="none" shadow="md" class="flex h-full flex-col overflow-hidden transition-all hover:shadow-lg">
						<a
							href="/admin/courses/{course.slug}"
							class="flex flex-1 flex-col"
						>
							<!-- Logo Header -->
							<div
								class="flex h-24 flex-shrink-0 items-center justify-center"
								style="background-color: {accentDark};"
							>
								{#if logoUrl}
									<img
										src={logoUrl}
										alt="{course.name} logo"
										class="h-14 max-w-[180px] object-contain"
									/>
								{:else}
									<BookOpen class="h-10 w-10" style="color: {accentLight};" />
								{/if}
							</div>

							<div class="flex-1 p-6">
								<div class="mb-2">
									<h3 class="text-xl font-semibold" style="color: {accentDark};">
										{course.name}
									</h3>
									<p class="mt-1 text-sm font-mono text-gray-500">/{course.slug}</p>
								</div>

								{#if course.description}
									<p class="line-clamp-3 text-sm text-gray-600">
										{course.description}
									</p>
								{/if}
							</div>
						</a>

						<!-- Footer -->
						<div
							class="mt-auto flex items-center justify-between border-t px-6 py-3"
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
	<form
		method="POST"
		action="?/create"
		use:enhance={handleFormResult({
			beforeSubmit: async (fd) => {
				if (logoFile && formData.slug) {
					const uploadedUrl = await uploadLogo(formData.slug);
					if (uploadedUrl) logoUrl = uploadedUrl;
				}
				fd.set('settings', buildSettingsJson());
			}
		})}
	>
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

			<!-- Logo Upload -->
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h3 class="mb-3 text-sm font-semibold text-gray-700">Course Logo</h3>
				<p class="mb-3 text-xs text-gray-600">
					Upload a logo that will appear in the course navigation. Max 2MB, JPEG/PNG/GIF/WebP/SVG.
				</p>

				{#if logoPreview}
					<div class="flex items-center gap-4 mb-3">
						<div class="relative">
							<img
								src={logoPreview}
								alt="Logo preview"
								class="h-16 w-auto max-w-[200px] object-contain rounded border border-gray-200 bg-white p-2"
							/>
							<button
								type="button"
								onclick={removeLogo}
								class="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 transition-colors"
								title="Remove logo"
							>
								<X size={12} />
							</button>
						</div>
						<span class="text-xs text-gray-500">
							{logoFile ? logoFile.name : 'Current logo'}
						</span>
					</div>
				{/if}

				<label class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50">
					<input
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
						onchange={handleLogoSelect}
						class="hidden"
					/>
					{#if logoPreview}
						<Upload size={16} />
						<span>Replace logo</span>
					{:else}
						<Image size={16} />
						<span>Upload logo</span>
					{/if}
				</label>
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
							Settings (theme & branding merged automatically)
						</label>
						<textarea
							id="settings"
							bind:value={baseSettingsJson}
							rows="3"
							class="block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
						></textarea>
					</div>
				</div>
			</details>
		</div>

		<!-- Form footer (inside form so submit button works natively) -->
		<div class="-mx-6 -mb-6 mt-6 border-t border-gray-200 bg-gray-50 px-6 py-4">
			<div class="flex justify-end gap-3">
				<Button variant="secondary" onclick={() => (showCreateModal = false)}>Cancel</Button>
				<Button variant="primary" type="submit" loading={isSubmitting || isUploadingLogo}>
					{isUploadingLogo ? 'Uploading...' : 'Create Course'}
				</Button>
			</div>
		</div>
	</form>
</Modal>

<!-- Edit Course Modal -->
<Modal
	isOpen={showEditModal}
	title="Edit Course"
	size="lg"
	onClose={() => (showEditModal = false)}
>
	<form
		method="POST"
		action="?/update"
		use:enhance={handleFormResult({
			beforeSubmit: async (fd) => {
				if (logoFile && formData.slug) {
					const uploadedUrl = await uploadLogo(formData.slug);
					if (uploadedUrl) logoUrl = uploadedUrl;
				} else if (!logoPreview && logoUrl) {
					logoUrl = '';
				}
				fd.set('settings', buildSettingsJson());
			}
		})}
	>
		<input type="hidden" name="course_id" value={selectedCourse?.id || ''} />
		{#each selectedManagerIds as managerId}
			<input type="hidden" name="manager_ids" value={managerId} />
		{/each}

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

			<!-- Logo Upload -->
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h3 class="mb-3 text-sm font-semibold text-gray-700">Course Logo</h3>
				<p class="mb-3 text-xs text-gray-600">
					Upload a logo that will appear in the course navigation. Max 2MB, JPEG/PNG/GIF/WebP/SVG.
				</p>

				{#if logoPreview}
					<div class="flex items-center gap-4 mb-3">
						<div class="relative">
							<img
								src={logoPreview}
								alt="Logo preview"
								class="h-16 w-auto max-w-[200px] object-contain rounded border border-gray-200 bg-white p-2"
							/>
							<button
								type="button"
								onclick={removeLogo}
								class="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 transition-colors"
								title="Remove logo"
							>
								<X size={12} />
							</button>
						</div>
						<span class="text-xs text-gray-500">
							{logoFile ? logoFile.name : 'Current logo'}
						</span>
					</div>
				{/if}

				<label class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50">
					<input
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
						onchange={handleLogoSelect}
						class="hidden"
					/>
					{#if logoPreview}
						<Upload size={16} />
						<span>Replace logo</span>
					{:else}
						<Image size={16} />
						<span>Upload logo</span>
					{/if}
				</label>
			</div>

			<!-- Manager Assignment -->
			{#if managers.length > 0}
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
					<h3 class="mb-3 text-sm font-semibold text-gray-700">Assigned Managers</h3>
					<p class="mb-3 text-xs text-gray-600">
						Select which course managers can access and manage this course.
					</p>
					<div class="space-y-2 max-h-48 overflow-y-auto">
						{#each managers as manager}
							<label class="flex items-center gap-3 rounded p-2 hover:bg-gray-100 cursor-pointer">
								<input
									type="checkbox"
									checked={selectedManagerIds.includes(manager.id)}
									onchange={(e) => {
										if (e.target.checked) {
											selectedManagerIds = [...selectedManagerIds, manager.id];
										} else {
											selectedManagerIds = selectedManagerIds.filter(id => id !== manager.id);
										}
									}}
									class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<UserAvatar user={manager} size="sm" />
								<div class="flex-1 text-sm">
									<div class="font-medium text-gray-900">{manager.full_name}</div>
									<div class="text-xs text-gray-500">{manager.email}</div>
								</div>
							</label>
						{/each}
					</div>
				</div>
			{/if}

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
							Settings (theme & branding merged automatically)
						</label>
						<textarea
							id="edit_settings"
							bind:value={baseSettingsJson}
							rows="3"
							class="block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
						></textarea>
					</div>
				</div>
			</details>
		</div>

		<!-- Form footer (inside form so submit button works natively) -->
		<div class="-mx-6 -mb-6 mt-6 border-t border-gray-200 bg-gray-50 px-6 py-4">
			<div class="flex items-center justify-between">
				{#if canDeleteCourse(selectedCourse)}
					<Button
						variant="danger"
						onclick={() => {
							showEditModal = false;
							openDeleteModal(selectedCourse);
						}}
					>
						Delete Course
					</Button>
				{:else}
					<div></div>
				{/if}
				<div class="flex gap-3">
					<Button variant="secondary" onclick={() => (showEditModal = false)}>Cancel</Button>
					<Button variant="primary" type="submit" loading={isSubmitting || isUploadingLogo}>
						{isUploadingLogo ? 'Uploading...' : 'Save Changes'}
					</Button>
				</div>
			</div>
		</div>
	</form>
</Modal>

<!-- Delete Confirmation Modal -->
<Modal
	isOpen={showDeleteModal}
	title="Delete Course"
	size="sm"
	onClose={() => (showDeleteModal = false)}
>
	<form method="POST" action="?/delete" use:enhance={handleFormResult()}>
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

		<!-- Form footer -->
		<div class="-mx-6 -mb-6 mt-6 border-t border-gray-200 bg-gray-50 px-6 py-4">
			<div class="flex justify-end gap-3">
				<Button variant="secondary" onclick={() => (showDeleteModal = false)}>Cancel</Button>
				<Button variant="danger" type="submit" loading={isSubmitting}>
					Delete Course
				</Button>
			</div>
		</div>
	</form>
</Modal>

<style>
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
