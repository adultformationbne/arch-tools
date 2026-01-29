<script>
	import { Save, Upload, X, Loader2 } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { invalidateAll } from '$app/navigation';
	import DocumentUpload from '$lib/components/DocumentUpload.svelte';
	import { getCourseSettings, DEFAULT_COURSE_SETTINGS } from '$lib/types/course-settings.js';

	let { data } = $props();

	const courseSlug = $derived(data.courseSlug);
	let course = $state(null);

	// Sync course data
	$effect(() => {
		course = data.course;
	});

	// Get current settings with defaults applied
	const currentSettings = $derived(getCourseSettings(course?.settings));

	// Form state
	let saving = $state(false);
	let uploadingLogo = $state(false);

	// Settings state
	let settings = $state({
		name: course.name || '',
		shortName: course.short_name || '',
		description: course.description || '',
		theme: {
			accentDark: course.settings?.theme?.accentDark || '#334642',
			accentLight: course.settings?.theme?.accentLight || '#c59a6b',
			fontFamily: course.settings?.theme?.fontFamily || 'Inter'
		},
		branding: {
			logoUrl: course.settings?.branding?.logoUrl || '',
			showLogo: course.settings?.branding?.showLogo ?? true
		},
		emailBranding: {
			replyToEmail: course.email_branding_config?.reply_to_email || ''
		},
		// New settings
		coordinatorAccess: {
			sessionsAhead: currentSettings.coordinatorAccess?.sessionsAhead ?? 'all'
		},
		sessionProgression: {
			mode: currentSettings.sessionProgression?.mode ?? 'manual',
			autoAdvanceDays: currentSettings.sessionProgression?.autoAdvanceDays ?? 7,
			completionRequirements: {
				reflectionSubmitted: currentSettings.sessionProgression?.completionRequirements?.reflectionSubmitted ?? true,
				attendanceMarked: currentSettings.sessionProgression?.completionRequirements?.attendanceMarked ?? false
			}
		},
		features: {
			reflectionsEnabled: currentSettings.features?.reflectionsEnabled ?? true,
			communityFeedEnabled: currentSettings.features?.communityFeedEnabled ?? true,
			attendanceEnabled: currentSettings.features?.attendanceEnabled ?? true
		}
	});

	// Derived state for coordinator access radio selection
	let coordinatorAccessMode = $derived(
		settings.coordinatorAccess.sessionsAhead === 'all' ? 'all' : 'limited'
	);
	let sessionsAheadCount = $state(
		typeof currentSettings.coordinatorAccess?.sessionsAhead === 'number'
			? currentSettings.coordinatorAccess.sessionsAhead
			: 2
	);

	async function handleLogoUpload(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			toastError('Please upload an image file');
			return;
		}

		// Validate file size (max 2MB)
		const maxSize = 2 * 1024 * 1024;
		if (file.size > maxSize) {
			toastError('File must be less than 2MB');
			return;
		}

		uploadingLogo = true;

		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('action', 'upload_logo');

			const response = await fetch(`/admin/courses/${courseSlug}/settings/api`, {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.error || 'Failed to upload logo');
			}

			settings.branding.logoUrl = result.url;
			toastSuccess('Logo uploaded successfully');
		} catch (error) {
			console.error('Logo upload error:', error);
			toastError(error.message || 'Failed to upload logo');
		} finally {
			uploadingLogo = false;
		}
	}

	function removeLogo() {
		settings.branding.logoUrl = '';
	}

	function setCoordinatorAccessMode(mode) {
		if (mode === 'all') {
			settings.coordinatorAccess.sessionsAhead = 'all';
		} else {
			settings.coordinatorAccess.sessionsAhead = sessionsAheadCount;
		}
	}

	function updateSessionsAheadCount(value) {
		sessionsAheadCount = value;
		if (coordinatorAccessMode === 'limited') {
			settings.coordinatorAccess.sessionsAhead = value;
		}
	}

	async function saveSettings() {
		saving = true;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/settings/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_settings',
					settings: {
						name: settings.name,
						short_name: settings.shortName,
						description: settings.description,
						settings: {
							theme: settings.theme,
							branding: settings.branding,
							coordinatorAccess: settings.coordinatorAccess,
							sessionProgression: settings.sessionProgression,
							features: settings.features
						},
						email_branding_config: {
							reply_to_email: settings.emailBranding.replyToEmail || null
						}
					}
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.error || 'Failed to save settings');
			}

			toastSuccess('Settings saved successfully');
			await invalidateAll();
		} catch (error) {
			console.error('Save error:', error);
			toastError(error.message || 'Failed to save settings');
		} finally {
			saving = false;
		}
	}
</script>

<div class="min-h-screen p-8" style="background-color: var(--course-accent-dark);">
	<div class="max-w-4xl mx-auto">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-white mb-2">Course Settings</h1>
			<p class="text-white/70">Manage course information, branding, and theme</p>
		</div>

		<!-- Settings Form -->
		<div class="bg-white rounded-lg shadow-lg">
			<!-- Basic Information Section -->
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>

				<div class="space-y-4">
					<div>
						<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
							Course Name
						</label>
						<input
							id="name"
							type="text"
							bind:value={settings.name}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Archdiocesan Centre for Catholic Formation"
						/>
					</div>

					<div>
						<label for="shortName" class="block text-sm font-medium text-gray-700 mb-1">
							Short Name
						</label>
						<input
							id="shortName"
							type="text"
							bind:value={settings.shortName}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="ACCF"
						/>
					</div>

					<div>
						<label for="description" class="block text-sm font-medium text-gray-700 mb-1">
							Description
						</label>
						<textarea
							id="description"
							bind:value={settings.description}
							rows="3"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="A brief description of the course..."
						></textarea>
					</div>
				</div>
			</div>

			<!-- Branding Section -->
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Branding</h2>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Course Logo
						</label>

						{#if settings.branding.logoUrl}
							<div class="flex items-start gap-4">
								<div class="relative">
									<img
										src={settings.branding.logoUrl}
										alt="Course logo"
										class="h-24 w-auto border border-gray-200 rounded-lg"
									/>
									<button
										onclick={removeLogo}
										class="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
										title="Remove logo"
									>
										<X size={14} />
									</button>
								</div>
								<div class="flex-1">
									<p class="text-sm text-gray-600 mb-2">
										Current logo uploaded
									</p>
									<label class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg cursor-pointer transition-colors">
										<Upload size={16} />
										<span class="text-sm font-medium">Replace Logo</span>
										<input
											type="file"
											accept="image/*"
											onchange={handleLogoUpload}
											class="hidden"
											disabled={uploadingLogo}
										/>
									</label>
								</div>
							</div>
						{:else}
							<label class="flex items-center justify-center gap-2 px-6 py-4 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-colors">
								{#if uploadingLogo}
									<Loader2 size={20} class="animate-spin" />
									<span class="text-sm font-medium text-gray-600">Uploading...</span>
								{:else}
									<Upload size={20} />
									<span class="text-sm font-medium text-gray-600">Upload Logo (PNG, JPG - Max 2MB)</span>
									<input
										type="file"
										accept="image/*"
										onchange={handleLogoUpload}
										class="hidden"
										disabled={uploadingLogo}
									/>
								{/if}
							</label>
						{/if}

						<div class="mt-3">
							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									bind:checked={settings.branding.showLogo}
									class="rounded border-gray-300"
								/>
								<span class="text-sm text-gray-700">Display logo on course pages</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<!-- Theme Section -->
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Theme</h2>

				<div class="space-y-4">
					<div>
						<label for="accentDark" class="block text-sm font-medium text-gray-700 mb-1">
							Accent Dark Color
						</label>
						<div class="flex gap-2">
							<input
								id="accentDark"
								type="color"
								bind:value={settings.theme.accentDark}
								class="h-10 w-20 border border-gray-300 rounded cursor-pointer"
							/>
							<input
								type="text"
								bind:value={settings.theme.accentDark}
								class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
								placeholder="#334642"
							/>
						</div>
					</div>

					<div>
						<label for="accentLight" class="block text-sm font-medium text-gray-700 mb-1">
							Accent Light Color
						</label>
						<div class="flex gap-2">
							<input
								id="accentLight"
								type="color"
								bind:value={settings.theme.accentLight}
								class="h-10 w-20 border border-gray-300 rounded cursor-pointer"
							/>
							<input
								type="text"
								bind:value={settings.theme.accentLight}
								class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
								placeholder="#c59a6b"
							/>
						</div>
					</div>

					<div>
						<label for="fontFamily" class="block text-sm font-medium text-gray-700 mb-1">
							Font Family
						</label>
						<select
							id="fontFamily"
							bind:value={settings.theme.fontFamily}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="Inter">Inter</option>
							<option value="system-ui">System UI</option>
							<option value="Georgia">Georgia</option>
							<option value="Times New Roman">Times New Roman</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Email Settings Section -->
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Email Settings</h2>

				<div class="space-y-4">
					<div>
						<label for="replyToEmail" class="block text-sm font-medium text-gray-700 mb-1">
							Reply-To Email Address
						</label>
						<input
							id="replyToEmail"
							type="email"
							bind:value={settings.emailBranding.replyToEmail}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="formation@bne.catholic.net.au"
						/>
						<p class="mt-1 text-sm text-gray-500">
							When participants reply to course emails, their replies will go to this address.
							Leave blank to use the platform default.
						</p>
					</div>
				</div>
			</div>

			<!-- Coordinator Access Section -->
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Coordinator Access</h2>
				<p class="text-sm text-gray-600 mb-4">
					Control how many sessions ahead coordinators can see compared to students
				</p>

				<div class="space-y-3">
					<label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" class:border-blue-500={coordinatorAccessMode === 'all'} class:bg-blue-50={coordinatorAccessMode === 'all'}>
						<input
							type="radio"
							name="coordinatorAccess"
							value="all"
							checked={coordinatorAccessMode === 'all'}
							onchange={() => setCoordinatorAccessMode('all')}
							class="w-4 h-4 text-blue-600"
						/>
						<div>
							<span class="font-medium text-gray-900">Coordinators can see all sessions</span>
							<p class="text-sm text-gray-500">Coordinators have full access to view all session materials</p>
						</div>
					</label>

					<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" class:border-blue-500={coordinatorAccessMode === 'limited'} class:bg-blue-50={coordinatorAccessMode === 'limited'}>
						<input
							type="radio"
							name="coordinatorAccess"
							value="limited"
							checked={coordinatorAccessMode === 'limited'}
							onchange={() => setCoordinatorAccessMode('limited')}
							class="w-4 h-4 text-blue-600 mt-1"
						/>
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium text-gray-900">Coordinators see</span>
								<input
									type="number"
									min="1"
									max="10"
									value={sessionsAheadCount}
									oninput={(e) => updateSessionsAheadCount(parseInt(e.target.value) || 1)}
									disabled={coordinatorAccessMode !== 'limited'}
									class="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
								/>
								<span class="font-medium text-gray-900">sessions ahead of students</span>
							</div>
							<p class="text-sm text-gray-500 mt-1">Coordinators can preview upcoming session materials before students</p>
						</div>
					</label>
				</div>
			</div>

			<!-- Session Progression Section -->
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Session Progression Rules</h2>
				<p class="text-sm text-gray-600 mb-4">
					Define how students advance through sessions
				</p>

				<div class="space-y-3">
					<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" class:border-blue-500={settings.sessionProgression.mode === 'manual'} class:bg-blue-50={settings.sessionProgression.mode === 'manual'}>
						<input
							type="radio"
							name="progressionMode"
							value="manual"
							bind:group={settings.sessionProgression.mode}
							class="w-4 h-4 text-blue-600 mt-1"
						/>
						<div>
							<span class="font-medium text-gray-900">Manual advancement only</span>
							<p class="text-sm text-gray-500">Admins must manually advance each student to the next session</p>
						</div>
					</label>

					<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" class:border-blue-500={settings.sessionProgression.mode === 'auto_time'} class:bg-blue-50={settings.sessionProgression.mode === 'auto_time'}>
						<input
							type="radio"
							name="progressionMode"
							value="auto_time"
							bind:group={settings.sessionProgression.mode}
							class="w-4 h-4 text-blue-600 mt-1"
						/>
						<div class="flex-1">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="font-medium text-gray-900">Auto-advance after</span>
								<input
									type="number"
									min="1"
									max="30"
									bind:value={settings.sessionProgression.autoAdvanceDays}
									disabled={settings.sessionProgression.mode !== 'auto_time'}
									class="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
								/>
								<span class="font-medium text-gray-900">days</span>
							</div>
							<p class="text-sm text-gray-500 mt-1">Students automatically advance after the specified number of days</p>
						</div>
					</label>

					<div class="p-3 border rounded-lg" class:border-blue-500={settings.sessionProgression.mode === 'require_completion'} class:bg-blue-50={settings.sessionProgression.mode === 'require_completion'}>
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="radio"
								name="progressionMode"
								value="require_completion"
								bind:group={settings.sessionProgression.mode}
								class="w-4 h-4 text-blue-600 mt-1"
							/>
							<div class="flex-1">
								<span class="font-medium text-gray-900">Require completion before advancing</span>
								<p class="text-sm text-gray-500 mt-1">Students must complete specific requirements before they can advance</p>
							</div>
						</label>

						{#if settings.sessionProgression.mode === 'require_completion'}
							<div class="mt-3 ml-7 space-y-2 p-3 bg-white rounded border border-gray-200">
								<p class="text-sm font-medium text-gray-700 mb-2">Requirements:</p>
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={settings.sessionProgression.completionRequirements.reflectionSubmitted}
										class="w-4 h-4 rounded border-gray-300 text-blue-600"
									/>
									<span class="text-sm text-gray-700">Reflection submitted</span>
								</label>
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={settings.sessionProgression.completionRequirements.attendanceMarked}
										class="w-4 h-4 rounded border-gray-300 text-blue-600"
									/>
									<span class="text-sm text-gray-700">Attendance marked</span>
								</label>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Feature Toggles Section -->
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Feature Toggles</h2>
				<p class="text-sm text-gray-600 mb-4">
					Enable or disable course features
				</p>

				<div class="space-y-3">
					<label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
						<input
							type="checkbox"
							bind:checked={settings.features.reflectionsEnabled}
							class="w-5 h-5 rounded border-gray-300 text-blue-600"
						/>
						<div>
							<span class="font-medium text-gray-900">Enable Reflections</span>
							<p class="text-sm text-gray-500">Allow students to submit reflections for each session</p>
						</div>
					</label>

					<label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
						<input
							type="checkbox"
							bind:checked={settings.features.communityFeedEnabled}
							class="w-5 h-5 rounded border-gray-300 text-blue-600"
						/>
						<div>
							<span class="font-medium text-gray-900">Enable Community Feed</span>
							<p class="text-sm text-gray-500">Allow students to view and post in the course community feed</p>
						</div>
					</label>

					<label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
						<input
							type="checkbox"
							bind:checked={settings.features.attendanceEnabled}
							class="w-5 h-5 rounded border-gray-300 text-blue-600"
						/>
						<div>
							<span class="font-medium text-gray-900">Enable Attendance Tracking</span>
							<p class="text-sm text-gray-500">Track and manage student attendance for each session</p>
						</div>
					</label>
				</div>
			</div>

			<!-- Actions -->
			<div class="p-6 flex justify-end gap-3">
				<button
					onclick={saveSettings}
					disabled={saving}
					class="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
				>
					{#if saving}
						<Loader2 size={18} class="animate-spin" />
						<span>Saving...</span>
					{:else}
						<Save size={18} />
						<span>Save Settings</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>
