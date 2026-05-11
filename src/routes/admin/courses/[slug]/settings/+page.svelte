<script>
	import { Save, Upload, X, Loader2, PenSquare, MessageCircle, Calendar, BookOpen, MapPin, Tag, UserPlus, Link, Zap } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { invalidateAll } from '$app/navigation';
	import DocumentUpload from '$lib/components/DocumentUpload.svelte';
	import { getCourseSettings, DEFAULT_COURSE_SETTINGS } from '$lib/types/course-settings.js';

	let { data } = $props();

	// Derived values from data
	const courseSlug = $derived(data.courseSlug);
	const course = $derived(data.course);

	// Form state
	let saving = $state(false);
	let uploadingLogo = $state(false);

	// Settings state - initialized with empty defaults, synced via $effect
	let settings = $state({
		name: '',
		shortName: '',
		description: '',
		theme: {
			accentDark: '#334642',
			accentLight: '#c59a6b',
			fontFamily: 'Inter'
		},
		branding: {
			logoUrl: '',
			showLogo: true
		},
		emailBranding: {
			replyToEmail: ''
		},
		coordinatorAccess: {
			sessionsAhead: /** @type {'all' | number} */ ('all')
		},
		sessionProgression: {
			mode: 'manual',
			autoAdvanceDays: 7,
			completionRequirements: {
				reflectionSubmitted: true,
				attendanceMarked: false
			}
		},
		features: {
			reflectionsEnabled: true,
			communityFeedEnabled: true,
			chatEnabled: true,
			chatAllowParticipants: false,
			attendanceEnabled: true,
			materialsEnabled: true,
			hubsEnabled: true,
			enrollmentEnabled: false,
			acceptPayments: false,
			discountCodes: false,
		}
	});

	// State for coordinator access limited mode
	/** @type {number} */
	let sessionsAheadCount = $state(2);

	// Sync form state when course data changes
	$effect(() => {
		if (course) {
			// Basic info from course object
			settings.name = course.name || '';
			settings.shortName = course.short_name || '';
			settings.description = course.description || '';

			// Theme settings
			settings.theme.accentDark = course.settings?.theme?.accentDark || '#334642';
			settings.theme.accentLight = course.settings?.theme?.accentLight || '#c59a6b';
			settings.theme.fontFamily = course.settings?.theme?.fontFamily || 'Inter';

			// Branding settings
			settings.branding.logoUrl = course.settings?.branding?.logoUrl || '';
			settings.branding.showLogo = course.settings?.branding?.showLogo ?? true;

			// Email branding
			settings.emailBranding.replyToEmail = course.email_branding_config?.reply_to_email || '';

			// Use getCourseSettings to get defaults for advanced settings
			const parsedSettings = getCourseSettings(course.settings);

			// Coordinator access
			settings.coordinatorAccess.sessionsAhead = parsedSettings.coordinatorAccess?.sessionsAhead ?? 'all';
			sessionsAheadCount = typeof parsedSettings.coordinatorAccess?.sessionsAhead === 'number'
				? parsedSettings.coordinatorAccess.sessionsAhead
				: 2;

			// Session progression
			settings.sessionProgression.mode = parsedSettings.sessionProgression?.mode ?? 'manual';
			settings.sessionProgression.autoAdvanceDays = parsedSettings.sessionProgression?.autoAdvanceDays ?? 7;
			settings.sessionProgression.completionRequirements.reflectionSubmitted = parsedSettings.sessionProgression?.completionRequirements?.reflectionSubmitted ?? true;
			settings.sessionProgression.completionRequirements.attendanceMarked = parsedSettings.sessionProgression?.completionRequirements?.attendanceMarked ?? false;

			// Feature toggles
			settings.features.reflectionsEnabled = parsedSettings.features?.reflectionsEnabled ?? true;
			settings.features.communityFeedEnabled = parsedSettings.features?.communityFeedEnabled ?? true;
			settings.features.chatEnabled = parsedSettings.features?.chatEnabled ?? true;
			settings.features.chatAllowParticipants = parsedSettings.features?.chatAllowParticipants ?? false;
			settings.features.attendanceEnabled = parsedSettings.features?.attendanceEnabled ?? true;
			settings.features.materialsEnabled = parsedSettings.features?.materialsEnabled ?? true;
			settings.features.quizzesEnabled = parsedSettings.features?.quizzesEnabled ?? true;
			settings.features.hubsEnabled = parsedSettings.features?.hubsEnabled ?? true;
			const legacyPayments = parsedSettings.features?.['paymentsEnabled'];
			settings.features.enrollmentEnabled = parsedSettings.features?.enrollmentEnabled ?? legacyPayments ?? false;
			settings.features.acceptPayments = parsedSettings.features?.acceptPayments ?? legacyPayments ?? false;
			settings.features.discountCodes = parsedSettings.features?.discountCodes ?? legacyPayments ?? false;
		}
	});

	// Derived state for coordinator access radio selection
	let coordinatorAccessMode = $derived(
		settings.coordinatorAccess.sessionsAhead === 'all' ? 'all' : 'limited'
	);

	/** @param {Event} event */
	async function handleLogoUpload(event) {
		const file = /** @type {HTMLInputElement} */ (event.target)?.files?.[0];
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
			toastError(error instanceof Error ? error.message : 'Failed to upload logo');
		} finally {
			uploadingLogo = false;
		}
	}

	function removeLogo() {
		settings.branding.logoUrl = '';
	}

	/** @param {'all' | 'limited'} mode */
	function setCoordinatorAccessMode(mode) {
		if (mode === 'all') {
			settings.coordinatorAccess.sessionsAhead = 'all';
		} else {
			settings.coordinatorAccess.sessionsAhead = sessionsAheadCount;
		}
	}

	/** @param {number} value */
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
			toastError(error instanceof Error ? error.message : 'Failed to save settings');
		} finally {
			saving = false;
		}
	}

	// Feature toggle style helpers
	/** @param {boolean} enabled */
	function toggleCardStyle(enabled) {
		if (enabled) {
			return `border-color: ${settings.theme.accentDark}40; background-color: ${settings.theme.accentLight}25;`;
		}
		return '';
	}

	/** @param {boolean} enabled */
	function toggleIconStyle(enabled) {
		if (enabled) {
			return `background-color: ${settings.theme.accentDark}; color: white;`;
		}
		return '';
	}

	/** @param {boolean} enabled */
	function toggleTrackStyle(enabled) {
		if (enabled) {
			return `background-color: ${settings.theme.accentDark};`;
		}
		return '';
	}

	function toggleSubBorderStyle() {
		return `border-color: ${settings.theme.accentDark}20;`;
	}
</script>

<div class="min-h-screen p-3 sm:p-4 lg:p-6" style="background-color: var(--course-accent-dark);">
	<div class="max-w-4xl mx-auto">
		<!-- Header -->
		<div class="mb-4 sm:mb-6 lg:mb-8">
			<h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Course Settings</h1>
			<p class="text-sm sm:text-base text-white/70">Manage course information, branding, and theme</p>
		</div>

		<!-- Settings Form -->
		<div class="bg-white rounded-lg shadow-lg pb-20 sm:pb-0">
			<!-- Basic Information Section -->
			<div class="p-4 sm:p-5 lg:p-6 border-b border-gray-200">
				<h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Basic Information</h2>

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
			<div class="p-4 sm:p-5 lg:p-6 border-b border-gray-200">
				<h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Branding</h2>

				<div class="space-y-4">
					<div>
						<span class="block text-sm font-medium text-gray-700 mb-2">
							Course Logo
						</span>

						{#if settings.branding.logoUrl}
							<div class="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
								<div class="relative">
									<img
										src={settings.branding.logoUrl}
										alt="Course logo"
										class="h-20 sm:h-24 w-auto border border-gray-200 rounded-lg"
									/>
									<button
										onclick={removeLogo}
										class="absolute -top-2 -right-2 p-1.5 sm:p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
										title="Remove logo"
									>
										<X size={14} />
									</button>
								</div>
								<div class="flex-1 w-full sm:w-auto">
									<p class="text-sm text-gray-600 mb-2">
										Current logo uploaded
									</p>
									<label class="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg cursor-pointer transition-colors">
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
							<label class="flex flex-col sm:flex-row items-center justify-center gap-2 px-4 sm:px-6 py-6 sm:py-4 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-colors">
								{#if uploadingLogo}
									<Loader2 size={20} class="animate-spin" />
									<span class="text-sm font-medium text-gray-600">Uploading...</span>
								{:else}
									<Upload size={20} />
									<span class="text-sm font-medium text-gray-600 text-center">Upload Logo (PNG, JPG - Max 2MB)</span>
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
			<div class="p-4 sm:p-5 lg:p-6 border-b border-gray-200">
				<h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Theme</h2>

				<div class="space-y-4">
					<div>
						<label for="accentDark" class="block text-sm font-medium text-gray-700 mb-1">
							Accent Dark Color
						</label>
						<div class="flex flex-col sm:flex-row gap-2">
							<input
								id="accentDark"
								type="color"
								bind:value={settings.theme.accentDark}
								class="h-12 sm:h-10 w-full sm:w-20 border border-gray-300 rounded cursor-pointer"
							/>
							<input
								type="text"
								bind:value={settings.theme.accentDark}
								class="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
								placeholder="#334642"
							/>
						</div>
					</div>

					<div>
						<label for="accentLight" class="block text-sm font-medium text-gray-700 mb-1">
							Accent Light Color
						</label>
						<div class="flex flex-col sm:flex-row gap-2">
							<input
								id="accentLight"
								type="color"
								bind:value={settings.theme.accentLight}
								class="h-12 sm:h-10 w-full sm:w-20 border border-gray-300 rounded cursor-pointer"
							/>
							<input
								type="text"
								bind:value={settings.theme.accentLight}
								class="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
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
			<div class="p-4 sm:p-5 lg:p-6 border-b border-gray-200">
				<h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Email Settings</h2>

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
			<div class="p-4 sm:p-5 lg:p-6 border-b border-gray-200">
				<h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Coordinator Access</h2>
				<p class="text-sm text-gray-600 mb-3 sm:mb-4">
					Control how many sessions ahead coordinators can see compared to students
				</p>

				<div class="space-y-3">
					<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" class:border-blue-500={coordinatorAccessMode === 'all'} class:bg-blue-50={coordinatorAccessMode === 'all'}>
						<input
							type="radio"
							name="coordinatorAccess"
							value="all"
							checked={coordinatorAccessMode === 'all'}
							onchange={() => setCoordinatorAccessMode('all')}
							class="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0"
						/>
						<div>
							<span class="font-medium text-gray-900 text-sm sm:text-base">Coordinators can see all sessions</span>
							<p class="text-xs sm:text-sm text-gray-500">Coordinators have full access to view all session materials</p>
						</div>
					</label>

					<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" class:border-blue-500={coordinatorAccessMode === 'limited'} class:bg-blue-50={coordinatorAccessMode === 'limited'}>
						<input
							type="radio"
							name="coordinatorAccess"
							value="limited"
							checked={coordinatorAccessMode === 'limited'}
							onchange={() => setCoordinatorAccessMode('limited')}
							class="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0"
						/>
						<div class="flex-1 min-w-0">
							<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
								<span class="font-medium text-gray-900 text-sm sm:text-base">Coordinators see</span>
								<div class="flex items-center gap-2">
									<input
										type="number"
										min="1"
										max="10"
										value={sessionsAheadCount}
										oninput={(e) => updateSessionsAheadCount(parseInt(/** @type {HTMLInputElement} */ (e.target).value) || 1)}
										disabled={coordinatorAccessMode !== 'limited'}
										class="w-16 px-2 py-1.5 sm:py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
									/>
									<span class="font-medium text-gray-900 text-sm sm:text-base">sessions ahead</span>
								</div>
							</div>
							<p class="text-xs sm:text-sm text-gray-500 mt-1">Coordinators can preview upcoming session materials before students</p>
						</div>
					</label>
				</div>
			</div>

			<!-- Session Progression Section -->
			<div class="p-4 sm:p-5 lg:p-6 border-b border-gray-200">
				<h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Session Progression Rules</h2>
				<p class="text-sm text-gray-600 mb-3 sm:mb-4">
					Define how students advance through sessions
				</p>

				<div class="space-y-3">
					<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" class:border-blue-500={settings.sessionProgression.mode === 'manual'} class:bg-blue-50={settings.sessionProgression.mode === 'manual'}>
						<input
							type="radio"
							name="progressionMode"
							value="manual"
							bind:group={settings.sessionProgression.mode}
							class="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0"
						/>
						<div>
							<span class="font-medium text-gray-900 text-sm sm:text-base">Manual advancement only</span>
							<p class="text-xs sm:text-sm text-gray-500">Admins must manually advance each student to the next session</p>
						</div>
					</label>

					<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" class:border-blue-500={settings.sessionProgression.mode === 'auto_time'} class:bg-blue-50={settings.sessionProgression.mode === 'auto_time'}>
						<input
							type="radio"
							name="progressionMode"
							value="auto_time"
							bind:group={settings.sessionProgression.mode}
							class="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0"
						/>
						<div class="flex-1 min-w-0">
							<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-wrap">
								<span class="font-medium text-gray-900 text-sm sm:text-base">Auto-advance after</span>
								<div class="flex items-center gap-2">
									<input
										type="number"
										min="1"
										max="30"
										bind:value={settings.sessionProgression.autoAdvanceDays}
										disabled={settings.sessionProgression.mode !== 'auto_time'}
										class="w-16 px-2 py-1.5 sm:py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
									/>
									<span class="font-medium text-gray-900 text-sm sm:text-base">days</span>
								</div>
							</div>
							<p class="text-xs sm:text-sm text-gray-500 mt-1">Students automatically advance after the specified number of days</p>
						</div>
					</label>

					<div class="p-3 border rounded-lg" class:border-blue-500={settings.sessionProgression.mode === 'require_completion'} class:bg-blue-50={settings.sessionProgression.mode === 'require_completion'}>
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="radio"
								name="progressionMode"
								value="require_completion"
								bind:group={settings.sessionProgression.mode}
								class="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0"
							/>
							<div class="flex-1">
								<span class="font-medium text-gray-900 text-sm sm:text-base">Require completion before advancing</span>
								<p class="text-xs sm:text-sm text-gray-500 mt-1">Students must complete specific requirements before they can advance</p>
							</div>
						</label>

						{#if settings.sessionProgression.mode === 'require_completion'}
							<div class="mt-3 ml-0 sm:ml-7 space-y-2 p-3 bg-white rounded border border-gray-200">
								<p class="text-sm font-medium text-gray-700 mb-2">Requirements:</p>
								<label class="flex items-center gap-2 cursor-pointer py-1">
									<input
										type="checkbox"
										bind:checked={settings.sessionProgression.completionRequirements.reflectionSubmitted}
										class="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-300 text-blue-600"
									/>
									<span class="text-sm text-gray-700">Reflection submitted</span>
								</label>
								<label class="flex items-center gap-2 cursor-pointer py-1">
									<input
										type="checkbox"
										bind:checked={settings.sessionProgression.completionRequirements.attendanceMarked}
										class="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-300 text-blue-600"
									/>
									<span class="text-sm text-gray-700">Attendance marked</span>
								</label>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Feature Toggles Section -->
			<div class="p-4 sm:p-5 lg:p-6 border-b border-gray-200">
				<h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-1">Features</h2>
				<p class="text-sm text-gray-500 mb-4 sm:mb-5">
					Toggle features on or off for this course
				</p>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
					<!-- Reflections -->
					<button
						type="button"
						onclick={() => settings.features.reflectionsEnabled = !settings.features.reflectionsEnabled}
						class="relative flex flex-col p-4 sm:p-5 rounded-xl border-2 transition-all text-left group"
						class:border-gray-200={!settings.features.reflectionsEnabled}
						class:bg-gray-50={!settings.features.reflectionsEnabled}
						class:hover:border-gray-300={!settings.features.reflectionsEnabled}
						style={toggleCardStyle(settings.features.reflectionsEnabled)}
					>
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" class:bg-gray-200={!settings.features.reflectionsEnabled} class:text-gray-400={!settings.features.reflectionsEnabled} style={toggleIconStyle(settings.features.reflectionsEnabled)}>
									<PenSquare size={18} />
								</div>
								<span class="font-semibold text-gray-900">Reflections</span>
							</div>
							<div class="w-11 h-6 rounded-full transition-colors relative" class:bg-gray-300={!settings.features.reflectionsEnabled} style={toggleTrackStyle(settings.features.reflectionsEnabled)}>
								<div class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform" class:translate-x-5={settings.features.reflectionsEnabled} class:translate-x-0.5={!settings.features.reflectionsEnabled}></div>
							</div>
						</div>
						<p class="text-xs text-gray-500 leading-relaxed">Participants submit written reflections for each session</p>

						{#if settings.features.reflectionsEnabled}
							<div class="mt-3 pt-3 border-t" style={toggleSubBorderStyle()}>
								<label
									class="flex items-center gap-2.5 cursor-pointer"
									onclick={(e) => e.stopPropagation()}
								>
									<input
										type="checkbox"
										bind:checked={settings.features.communityFeedEnabled}
										class="w-4 h-4 rounded border-gray-300"
										style="accent-color: {settings.theme.accentDark};"
									/>
									<div>
										<span class="text-sm font-medium text-gray-700">Community Feed</span>
										<p class="text-xs text-gray-500">Participants can share reflections publicly and view others</p>
									</div>
								</label>
							</div>
						{/if}
					</button>

					<!-- Chat -->
					<button
						type="button"
						onclick={() => settings.features.chatEnabled = !settings.features.chatEnabled}
						class="relative flex flex-col p-4 sm:p-5 rounded-xl border-2 transition-all text-left group"
						class:border-gray-200={!settings.features.chatEnabled}
						class:bg-gray-50={!settings.features.chatEnabled}
						class:hover:border-gray-300={!settings.features.chatEnabled}
						style={toggleCardStyle(settings.features.chatEnabled)}
					>
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" class:bg-gray-200={!settings.features.chatEnabled} class:text-gray-400={!settings.features.chatEnabled} style={toggleIconStyle(settings.features.chatEnabled)}>
									<MessageCircle size={18} />
								</div>
								<span class="font-semibold text-gray-900">Chat</span>
							</div>
							<div class="w-11 h-6 rounded-full transition-colors relative" class:bg-gray-300={!settings.features.chatEnabled} style={toggleTrackStyle(settings.features.chatEnabled)}>
								<div class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform" class:translate-x-5={settings.features.chatEnabled} class:translate-x-0.5={!settings.features.chatEnabled}></div>
							</div>
						</div>
						<p class="text-xs text-gray-500 leading-relaxed">Messaging within each cohort</p>

						{#if settings.features.chatEnabled}
							<div class="mt-3 pt-3 border-t space-y-2" style={toggleSubBorderStyle()}>
								<div class="flex items-center gap-2 text-xs font-medium" style="color: {settings.theme.accentDark};">
									<MapPin size={12} />
									<span>Hub coordinators can always chat</span>
								</div>
								<label
									class="flex items-center gap-2.5 cursor-pointer"
									onclick={(e) => e.stopPropagation()}
								>
									<input
										type="checkbox"
										bind:checked={settings.features.chatAllowParticipants}
										class="w-4 h-4 rounded border-gray-300"
										style="accent-color: {settings.theme.accentDark};"
									/>
									<div>
										<span class="text-sm font-medium text-gray-700">Allow participants to chat</span>
										<p class="text-xs text-gray-500">All enrolled participants can send messages in their cohort chat</p>
									</div>
								</label>
							</div>
						{/if}
					</button>

					<!-- Attendance -->
					<button
						type="button"
						onclick={() => settings.features.attendanceEnabled = !settings.features.attendanceEnabled}
						class="relative flex flex-col p-4 sm:p-5 rounded-xl border-2 transition-all text-left group"
						class:border-gray-200={!settings.features.attendanceEnabled}
						class:bg-gray-50={!settings.features.attendanceEnabled}
						class:hover:border-gray-300={!settings.features.attendanceEnabled}
						style={toggleCardStyle(settings.features.attendanceEnabled)}
					>
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" class:bg-gray-200={!settings.features.attendanceEnabled} class:text-gray-400={!settings.features.attendanceEnabled} style={toggleIconStyle(settings.features.attendanceEnabled)}>
									<Calendar size={18} />
								</div>
								<span class="font-semibold text-gray-900">Attendance</span>
							</div>
							<div class="w-11 h-6 rounded-full transition-colors relative" class:bg-gray-300={!settings.features.attendanceEnabled} style={toggleTrackStyle(settings.features.attendanceEnabled)}>
								<div class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform" class:translate-x-5={settings.features.attendanceEnabled} class:translate-x-0.5={!settings.features.attendanceEnabled}></div>
							</div>
						</div>
						<p class="text-xs text-gray-500 leading-relaxed">Track and manage participant attendance for each session</p>
					</button>

					<!-- Materials -->
					<button
						type="button"
						onclick={() => settings.features.materialsEnabled = !settings.features.materialsEnabled}
						class="relative flex flex-col p-4 sm:p-5 rounded-xl border-2 transition-all text-left group"
						class:border-gray-200={!settings.features.materialsEnabled}
						class:bg-gray-50={!settings.features.materialsEnabled}
						class:hover:border-gray-300={!settings.features.materialsEnabled}
						style={toggleCardStyle(settings.features.materialsEnabled)}
					>
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" class:bg-gray-200={!settings.features.materialsEnabled} class:text-gray-400={!settings.features.materialsEnabled} style={toggleIconStyle(settings.features.materialsEnabled)}>
									<BookOpen size={18} />
								</div>
								<span class="font-semibold text-gray-900">Materials</span>
							</div>
							<div class="w-11 h-6 rounded-full transition-colors relative" class:bg-gray-300={!settings.features.materialsEnabled} style={toggleTrackStyle(settings.features.materialsEnabled)}>
								<div class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform" class:translate-x-5={settings.features.materialsEnabled} class:translate-x-0.5={!settings.features.materialsEnabled}></div>
							</div>
						</div>
						<p class="text-xs text-gray-500 leading-relaxed">Share session materials and resources with participants</p>
					</button>

					<!-- Quizzes -->
					<button
						type="button"
						onclick={() => settings.features.quizzesEnabled = !settings.features.quizzesEnabled}
						class="relative flex flex-col p-4 sm:p-5 rounded-xl border-2 transition-all text-left group"
						class:border-gray-200={!settings.features.quizzesEnabled}
						class:bg-gray-50={!settings.features.quizzesEnabled}
						class:hover:border-gray-300={!settings.features.quizzesEnabled}
						style={toggleCardStyle(settings.features.quizzesEnabled)}
					>
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" class:bg-gray-200={!settings.features.quizzesEnabled} class:text-gray-400={!settings.features.quizzesEnabled} style={toggleIconStyle(settings.features.quizzesEnabled)}>
									<Zap size={18} />
								</div>
								<span class="font-semibold text-gray-900">Quizzes</span>
							</div>
							<div class="w-11 h-6 rounded-full transition-colors relative" class:bg-gray-300={!settings.features.quizzesEnabled} style={toggleTrackStyle(settings.features.quizzesEnabled)}>
								<div class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform" class:translate-x-5={settings.features.quizzesEnabled} class:translate-x-0.5={!settings.features.quizzesEnabled}></div>
							</div>
						</div>
						<p class="text-xs text-gray-500 leading-relaxed">Enable quizzes for session assessments and marking</p>
					</button>

					<!-- Hub Groups -->
					<button
						type="button"
						onclick={() => settings.features.hubsEnabled = !settings.features.hubsEnabled}
						class="relative flex flex-col p-4 sm:p-5 rounded-xl border-2 transition-all text-left group"
						class:border-gray-200={!settings.features.hubsEnabled}
						class:bg-gray-50={!settings.features.hubsEnabled}
						class:hover:border-gray-300={!settings.features.hubsEnabled}
						style={toggleCardStyle(settings.features.hubsEnabled)}
					>
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" class:bg-gray-200={!settings.features.hubsEnabled} class:text-gray-400={!settings.features.hubsEnabled} style={toggleIconStyle(settings.features.hubsEnabled)}>
									<MapPin size={18} />
								</div>
								<span class="font-semibold text-gray-900">Hub Groups</span>
							</div>
							<div class="w-11 h-6 rounded-full transition-colors relative" class:bg-gray-300={!settings.features.hubsEnabled} style={toggleTrackStyle(settings.features.hubsEnabled)}>
								<div class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform" class:translate-x-5={settings.features.hubsEnabled} class:translate-x-0.5={!settings.features.hubsEnabled}></div>
							</div>
						</div>
						<p class="text-xs text-gray-500 leading-relaxed">Organise participants into hub groups with coordinators</p>
					</button>

				</div>

				<!-- Enrollment - Full Width -->
				<div class="mt-3 sm:mt-4">
					<button
						type="button"
						onclick={() => settings.features.enrollmentEnabled = !settings.features.enrollmentEnabled}
						class="relative w-full flex flex-col p-4 sm:p-5 rounded-xl border-2 transition-all text-left group"
						class:border-gray-200={!settings.features.enrollmentEnabled}
						class:bg-gray-50={!settings.features.enrollmentEnabled}
						class:hover:border-gray-300={!settings.features.enrollmentEnabled}
						style={toggleCardStyle(settings.features.enrollmentEnabled)}
					>
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2.5">
								<div class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" class:bg-gray-200={!settings.features.enrollmentEnabled} class:text-gray-400={!settings.features.enrollmentEnabled} style={toggleIconStyle(settings.features.enrollmentEnabled)}>
									<UserPlus size={18} />
								</div>
								<div>
									<span class="font-semibold text-gray-900">Enrollment</span>
									<p class="text-xs text-gray-500 leading-relaxed">Self-service signup via enrollment links, payments, and discount codes</p>
								</div>
							</div>
							<div class="w-11 h-6 rounded-full transition-colors relative shrink-0" class:bg-gray-300={!settings.features.enrollmentEnabled} style={toggleTrackStyle(settings.features.enrollmentEnabled)}>
								<div class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform" class:translate-x-5={settings.features.enrollmentEnabled} class:translate-x-0.5={!settings.features.enrollmentEnabled}></div>
							</div>
						</div>

						{#if settings.features.enrollmentEnabled}
							<div class="mt-3 pt-3 border-t space-y-3" style={toggleSubBorderStyle()} onclick={(e) => e.stopPropagation()}>
								<p class="text-xs text-gray-500">When disabled, participants are managed directly by admins with no self-service signup.</p>

								<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<!-- Accept Payments -->
									<label class="flex items-start gap-2.5 cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-white/50 transition-colors">
										<input
											type="checkbox"
											bind:checked={settings.features.acceptPayments}
											class="w-4 h-4 mt-0.5 rounded border-gray-300"
											style="accent-color: {settings.theme.accentDark};"
										/>
										<div>
											<span class="text-sm font-medium text-gray-700">Accept payments</span>
											<p class="text-xs text-gray-500">Enrollment links can include pricing via Stripe checkout</p>
										</div>
									</label>

									<!-- Discount Codes -->
										<label class="flex items-start gap-2.5 rounded-lg border border-gray-200 p-3 transition-colors {settings.features.acceptPayments ? 'cursor-pointer hover:bg-white/50' : 'opacity-50 pointer-events-none'}">
										<input
											type="checkbox"
											bind:checked={settings.features.discountCodes}
											disabled={!settings.features.acceptPayments}
											class="w-4 h-4 mt-0.5 rounded border-gray-300"
											style="accent-color: {settings.theme.accentDark};"
										/>
										<div>
											<span class="text-sm font-medium text-gray-700">Discount codes</span>
											<p class="text-xs text-gray-500">Create and manage discount codes for enrollment</p>
										</div>
									</label>
								</div>

								<!-- Max Capacity + Require Approval -->
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
									<!-- Max Capacity -->
									<div class="flex flex-col gap-1 rounded-lg border border-gray-200 p-3 bg-white/30" onclick={(e) => e.stopPropagation()}>
										<span class="text-sm font-medium text-gray-700">Max capacity</span>
										<input
											type="number"
											min="1"
											placeholder="Unlimited"
											value={settings.features.maxCapacity ?? ''}
											oninput={(e) => settings.features.maxCapacity = e.currentTarget.value ? parseInt(e.currentTarget.value) : null}
											class="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										/>
										<p class="text-xs text-gray-500">Course-wide cap across all cohorts</p>
									</div>

									<!-- Require Approval -->
									<label class="flex items-start gap-2.5 cursor-pointer rounded-lg border border-gray-200 p-3 bg-white/30 hover:bg-white/50 transition-colors" onclick={(e) => e.stopPropagation()}>
										<input
											type="checkbox"
											bind:checked={settings.features.requireApproval}
											class="w-4 h-4 mt-0.5 rounded border-gray-300"
											style="accent-color: {settings.theme.accentDark};"
										/>
										<div>
											<span class="text-sm font-medium text-gray-700">Require approval</span>
											<p class="text-xs text-gray-500">Participants must be approved before gaining access. Can be overridden per cohort.</p>
										</div>
									</label>
								</div>

							</div>
						{/if}
					</button>
				</div>
			</div>

			<!-- Actions - Desktop only (hidden on mobile, shown as sticky bar) -->
			<div class="hidden sm:block p-4 sm:p-5 lg:p-6">
				<div class="flex justify-end gap-3">
					<button
						onclick={saveSettings}
						disabled={saving}
						class="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
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

	<!-- Sticky Save Button for Mobile -->
	<div class="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 shadow-lg z-50">
		<button
			onclick={saveSettings}
			disabled={saving}
			class="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
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
