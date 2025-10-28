<script>
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save } from 'lucide-svelte';

	let name = $state('');
	let short_name = $state('');
	let description = $state('');
	let duration_weeks = $state(null);
	let status = $state('draft');

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
					is_active: status === 'active'
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
		<h1 class="text-3xl font-bold" style="color: #334642;">Create New Course</h1>
		<p class="text-gray-600 mt-2">
			Set up a new course program with modules and cohorts
		</p>
	</div>

	<!-- Form -->
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
		<!-- Name -->
		<div>
			<label for="name" class="block text-sm font-semibold mb-2" style="color: #334642;">
				Course Name *
			</label>
			<input
				id="name"
				type="text"
				bind:value={name}
				placeholder="e.g., Archdiocesan Center for Catholic Formation"
				required
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: #eae2d9; --tw-ring-color: #c59a6b;"
			/>
		</div>

		<!-- Short Name -->
		<div>
			<label for="short_name" class="block text-sm font-semibold mb-2" style="color: #334642;">
				Short Name *
			</label>
			<input
				id="short_name"
				type="text"
				bind:value={short_name}
				placeholder="e.g., ACCF"
				required
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: #eae2d9; --tw-ring-color: #c59a6b;"
			/>
			<p class="text-sm text-gray-500 mt-1">Abbreviated name for display</p>
		</div>

		<!-- Description -->
		<div>
			<label for="description" class="block text-sm font-semibold mb-2" style="color: #334642;">
				Description
			</label>
			<textarea
				id="description"
				bind:value={description}
				rows="4"
				placeholder="Brief description of the course program..."
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: #eae2d9; --tw-ring-color: #c59a6b;"
			></textarea>
		</div>

		<!-- Duration -->
		<div>
			<label for="duration_weeks" class="block text-sm font-semibold mb-2" style="color: #334642;">
				Total Duration (weeks)
			</label>
			<input
				id="duration_weeks"
				type="number"
				bind:value={duration_weeks}
				min="1"
				placeholder="e.g., 32"
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: #eae2d9; --tw-ring-color: #c59a6b;"
			/>
			<p class="text-sm text-gray-500 mt-1">Total weeks to complete all modules</p>
		</div>

		<!-- Status -->
		<div>
			<label for="status" class="block text-sm font-semibold mb-2" style="color: #334642;">
				Status
			</label>
			<select
				id="status"
				bind:value={status}
				class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
				style="border-color: #eae2d9; --tw-ring-color: #c59a6b;"
			>
				<option value="draft">Draft</option>
				<option value="active">Active</option>
			</select>
			<p class="text-sm text-gray-500 mt-1">
				Draft courses are hidden from students until activated
			</p>
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
				style="background-color: #c59a6b; color: #1e2322;"
			>
				<Save size={20} />
				{saving ? 'Creating...' : 'Create Course'}
			</button>
			<a
				href="/admin/courses"
				class="px-6 py-3 rounded-lg font-semibold border transition-colors"
				style="background-color: #eae2d9; color: #334642; border-color: #c59a6b;"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
