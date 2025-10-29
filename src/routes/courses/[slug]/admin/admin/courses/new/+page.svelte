<script>
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save } from 'lucide-svelte';

	let name = $state('');
	let short_name = $state('');
	let description = $state('');
	let duration_weeks = $state(null);
	let status = $state('draft');

	// Theme settings
	let accentLight = $state('var(--course-accent-light)');
	let accentDark = $state('var(--course-accent-dark)');
	let fontFamily = $state('Inter');

	let saving = $state(false);
	let error = $state('');

	async function handleSubmit() {
		if (!name || !short_name) {
			error = 'Name and short name are required';
			return;
		}

		saving = true;
		error = '';

		try {
			const response = await fetch('/api/courses/index', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					short_name,
					description,
					duration_weeks: duration_weeks ? parseInt(duration_weeks) : null,
					status,
					is_active: status === 'active',
					settings: {
						theme: {
							accentLight,
							accentDark,
							fontFamily
						}
					}
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to create course');
			}

			// Redirect to the new course detail page
			goto(`/admin/courses/${result.course.id}`);

		} catch (err) {
			console.error('Error creating course:', err);
			error = err.message || 'Failed to create course';
			saving = false;
		}
	}
</script>

<div class="px-16 py-8 max-w-4xl">
	<!-- Header -->
	<div class="mb-8">
		<a
			href="/admin/courses"
			class="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
		>
			<ArrowLeft size={20} />
			Back to Courses
		</a>
		<h1 class="text-3xl font-bold" style="color: var(--course-accent-dark);">Create New Course</h1>
		<p class="text-gray-600 mt-2">
			Set up a new course program with modules and cohorts
		</p>
	</div>

	<!-- Form -->
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
		<!-- Name -->
		<div>
			<label for="name" class="block text-sm font-semibold mb-2" style="color: var(--course-accent-dark);">
				Course Name *
			</label>
			<input
				id="name"
				type="text"
				bind:value={name}
				placeholder="e.g., Archdiocesan Center for Catholic Formation"
				required
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: var(--course-surface); --tw-ring-color: var(--course-accent-light);"
			/>
		</div>

		<!-- Short Name -->
		<div>
			<label for="short_name" class="block text-sm font-semibold mb-2" style="color: var(--course-accent-dark);">
				Short Name *
			</label>
			<input
				id="short_name"
				type="text"
				bind:value={short_name}
				placeholder="e.g., ACCF"
				required
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: var(--course-surface); --tw-ring-color: var(--course-accent-light);"
			/>
			<p class="text-sm text-gray-500 mt-1">Abbreviated name for display</p>
		</div>

		<!-- Description -->
		<div>
			<label for="description" class="block text-sm font-semibold mb-2" style="color: var(--course-accent-dark);">
				Description
			</label>
			<textarea
				id="description"
				bind:value={description}
				rows="4"
				placeholder="Brief description of the course program..."
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: var(--course-surface); --tw-ring-color: var(--course-accent-light);"
			></textarea>
		</div>

		<!-- Duration -->
		<div>
			<label for="duration_weeks" class="block text-sm font-semibold mb-2" style="color: var(--course-accent-dark);">
				Total Duration (weeks)
			</label>
			<input
				id="duration_weeks"
				type="number"
				bind:value={duration_weeks}
				min="1"
				placeholder="e.g., 32"
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: var(--course-surface); --tw-ring-color: var(--course-accent-light);"
			/>
			<p class="text-sm text-gray-500 mt-1">Total weeks to complete all modules</p>
		</div>

		<!-- Status -->
		<div>
			<label for="status" class="block text-sm font-semibold mb-2" style="color: var(--course-accent-dark);">
				Status
			</label>
			<select
				id="status"
				bind:value={status}
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: var(--course-surface); --tw-ring-color: var(--course-accent-light);"
			>
				<option value="draft">Draft</option>
				<option value="active">Active</option>
			</select>
			<p class="text-sm text-gray-500 mt-1">
				Draft courses are hidden from students until activated
			</p>
		</div>

		<!-- Theme Settings -->
		<div class="border-t pt-6" style="border-color: var(--course-surface);">
			<h3 class="text-lg font-semibold mb-4" style="color: var(--course-accent-dark);">Theme Settings</h3>

			<!-- Live Preview -->
			<div
				class="mb-6 p-8 rounded-lg transition-all duration-300 border-2"
				style="background-color: {accentDark}; font-family: {fontFamily}, sans-serif; border-color: {accentLight};"
			>
				<div class="text-center mb-4">
					<h4 class="text-2xl font-bold mb-2 text-white">
						{name || 'Your Course Name'}
					</h4>
					<p class="text-sm text-white opacity-80">Live Theme Preview</p>
				</div>
				<div
					class="p-6 rounded-lg text-center"
					style="background-color: {accentLight};"
				>
					<p class="font-semibold text-lg text-gray-900">
						Accent Light Button/Element
					</p>
					<p class="text-sm mt-2 text-gray-800">
						Buttons, links, and highlights
					</p>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<!-- Accent Light -->
				<div>
					<label for="accentLight" class="block text-sm font-semibold mb-2" style="color: var(--course-accent-dark);">
						Accent Light
					</label>
					<div class="flex gap-2">
						<input
							id="accentLight"
							type="color"
							bind:value={accentLight}
							class="h-12 w-20 border rounded-lg cursor-pointer"
							style="border-color: var(--course-surface);"
						/>
						<input
							type="text"
							bind:value={accentLight}
							placeholder="var(--course-accent-light)"
							class="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
							style="border-color: var(--course-surface); --tw-ring-color: var(--course-accent-light);"
						/>
					</div>
					<p class="text-sm text-gray-500 mt-1">Buttons, links, highlights (warm/bright)</p>
				</div>

				<!-- Accent Dark -->
				<div>
					<label for="accentDark" class="block text-sm font-semibold mb-2" style="color: var(--course-accent-dark);">
						Accent Dark
					</label>
					<div class="flex gap-2">
						<input
							id="accentDark"
							type="color"
							bind:value={accentDark}
							class="h-12 w-20 border rounded-lg cursor-pointer"
							style="border-color: var(--course-surface);"
						/>
						<input
							type="text"
							bind:value={accentDark}
							placeholder="var(--course-accent-dark)"
							class="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
							style="border-color: var(--course-surface); --tw-ring-color: var(--course-accent-light);"
						/>
					</div>
					<p class="text-sm text-gray-500 mt-1">Header/navigation background (dark/rich)</p>
				</div>
			</div>

			<!-- Font Family -->
			<div class="mt-4">
				<label for="fontFamily" class="block text-sm font-semibold mb-2" style="color: var(--course-accent-dark);">
					Font Family
				</label>
				<select
					id="fontFamily"
					bind:value={fontFamily}
					class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
					style="border-color: var(--course-surface); --tw-ring-color: var(--course-accent-light);"
				>
					<option value="Inter">Inter (Modern Sans-Serif)</option>
					<option value="Bebas Neue">Bebas Neue (Bold Display)</option>
					<option value="Merriweather">Merriweather (Classic Serif)</option>
				</select>
			</div>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
				{error}
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex gap-4 pt-4">
			<button
				type="submit"
				disabled={saving}
				class="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
				style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
			>
				<Save size={20} />
				{saving ? 'Creating...' : 'Create Course'}
			</button>
			<a
				href="/admin/courses"
				class="px-6 py-3 rounded-lg font-semibold border transition-colors"
				style="background-color: var(--course-surface); color: var(--course-accent-dark); border-color: var(--course-accent-light);"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
