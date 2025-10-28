<script>
	import { ArrowLeft, BookOpen, Calendar, Users, Plus, Edit, Trash2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let course = $derived(data.course);
	let modules = $derived(data.modules || []);
	let cohorts = $derived(data.cohorts || []);
	let totalEnrollments = $derived(data.totalEnrollments || 0);

	let activeTab = $state('overview');
	let editing = $state(false);
	let savingStatus = $state(false);

	// Editable course fields
	let editName = $state(course.name);
	let editShortName = $state(course.short_name);
	let editDescription = $state(course.description);
	let editStatus = $state(course.status);

	async function saveChanges() {
		savingStatus = true;
		try {
			const response = await fetch('/api/courses/index', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: course.id,
					name: editName,
					short_name: editShortName,
					description: editDescription,
					status: editStatus
				})
			});

			if (!response.ok) {
				throw new Error('Failed to update course');
			}

			// Reload page to get fresh data
			window.location.reload();
		} catch (err) {
			console.error('Error saving changes:', err);
			alert('Failed to save changes');
		} finally {
			savingStatus = false;
		}
	}

	function cancelEditing() {
		editName = course.name;
		editShortName = course.short_name;
		editDescription = course.description;
		editStatus = course.status;
		editing = false;
	}
</script>

<div class="px-16 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href="/admin/courses"
			class="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
		>
			<ArrowLeft size={20} />
			Back to Courses
		</a>

		<div class="flex items-start justify-between">
			<div class="flex-1">
				{#if editing}
					<input
						type="text"
						bind:value={editName}
						class="text-3xl font-bold mb-2 px-3 py-1 border rounded-lg w-full"
						style="color: #334642; border-color: #eae2d9;"
					/>
					<input
						type="text"
						bind:value={editShortName}
						placeholder="Short name"
						class="text-lg mb-2 px-3 py-1 border rounded-lg"
						style="border-color: #eae2d9;"
					/>
				{:else}
					<h1 class="text-3xl font-bold" style="color: #334642;">
						{course.short_name}
					</h1>
					<p class="text-gray-600">{course.name}</p>
				{/if}

				<div class="flex items-center gap-4 mt-4">
					{#if editing}
						<select
							bind:value={editStatus}
							class="px-3 py-1 border rounded-lg text-sm"
							style="border-color: #eae2d9;"
						>
							<option value="draft">Draft</option>
							<option value="active">Active</option>
							<option value="archived">Archived</option>
						</select>
					{:else}
						<span
							class="px-3 py-1 text-xs font-semibold rounded-full"
							class:bg-green-100={course.status === 'active'}
							class:text-green-800={course.status === 'active'}
							class:bg-gray-100={course.status === 'draft'}
							class:text-gray-800={course.status === 'draft'}
							class:bg-red-100={course.status === 'archived'}
							class:text-red-800={course.status === 'archived'}
						>
							{course.status}
						</span>
					{/if}

					<span class="text-sm text-gray-500">
						Created {new Date(course.created_at).toLocaleDateString()}
					</span>
				</div>
			</div>

			<div class="flex gap-2">
				{#if editing}
					<button
						onclick={saveChanges}
						disabled={savingStatus}
						class="px-4 py-2 rounded-lg font-semibold"
						style="background-color: #c59a6b; color: #1e2322;"
					>
						{savingStatus ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={cancelEditing}
						class="px-4 py-2 rounded-lg font-semibold border"
						style="background-color: #eae2d9; color: #334642; border-color: #c59a6b;"
					>
						Cancel
					</button>
				{:else}
					<button
						onclick={() => editing = true}
						class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold border"
						style="background-color: #eae2d9; color: #334642; border-color: #c59a6b;"
					>
						<Edit size={18} />
						Edit
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
		<div class="bg-white border rounded-lg p-6" style="border-color: #eae2d9;">
			<div class="flex items-center gap-3 mb-2">
				<BookOpen size={24} style="color: #c59a6b;" />
				<span class="text-sm font-semibold text-gray-600">Modules</span>
			</div>
			<div class="text-3xl font-bold" style="color: #334642;">{modules.length}</div>
		</div>

		<div class="bg-white border rounded-lg p-6" style="border-color: #eae2d9;">
			<div class="flex items-center gap-3 mb-2">
				<Calendar size={24} style="color: #c59a6b;" />
				<span class="text-sm font-semibold text-gray-600">Cohorts</span>
			</div>
			<div class="text-3xl font-bold" style="color: #334642;">{cohorts.length}</div>
			<div class="text-sm text-gray-500 mt-1">
				{cohorts.filter(c => c.status === 'active').length} active
			</div>
		</div>

		<div class="bg-white border rounded-lg p-6" style="border-color: #eae2d9;">
			<div class="flex items-center gap-3 mb-2">
				<Users size={24} style="color: #c59a6b;" />
				<span class="text-sm font-semibold text-gray-600">Enrollments</span>
			</div>
			<div class="text-3xl font-bold" style="color: #334642;">{totalEnrollments}</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="border-b mb-6" style="border-color: #eae2d9;">
		<nav class="flex gap-8">
			<button
				onclick={() => activeTab = 'overview'}
				class="pb-4 px-2 font-semibold border-b-2 transition-colors"
				class:border-transparent={activeTab !== 'overview'}
				class:text-gray-500={activeTab !== 'overview'}
				style:border-color={activeTab === 'overview' ? '#c59a6b' : 'transparent'}
				style:color={activeTab === 'overview' ? '#334642' : undefined}
			>
				Overview
			</button>
			<button
				onclick={() => activeTab = 'modules'}
				class="pb-4 px-2 font-semibold border-b-2 transition-colors"
				class:border-transparent={activeTab !== 'modules'}
				class:text-gray-500={activeTab !== 'modules'}
				style:border-color={activeTab === 'modules' ? '#c59a6b' : 'transparent'}
				style:color={activeTab === 'modules' ? '#334642' : undefined}
			>
				Modules ({modules.length})
			</button>
			<button
				onclick={() => activeTab = 'cohorts'}
				class="pb-4 px-2 font-semibold border-b-2 transition-colors"
				class:border-transparent={activeTab !== 'cohorts'}
				class:text-gray-500={activeTab !== 'cohorts'}
				style:border-color={activeTab === 'cohorts' ? '#c59a6b' : 'transparent'}
				style:color={activeTab === 'cohorts' ? '#334642' : undefined}
			>
				Cohorts ({cohorts.length})
			</button>
		</nav>
	</div>

	<!-- Tab Content -->
	{#if activeTab === 'overview'}
		<div class="space-y-6">
			{#if editing}
				<div>
					<label class="block text-sm font-semibold mb-2" style="color: #334642;">
						Description
					</label>
					<textarea
						bind:value={editDescription}
						rows="4"
						class="w-full px-4 py-3 border rounded-lg"
						style="border-color: #eae2d9;"
					></textarea>
				</div>
			{:else if course.description}
				<div class="bg-white border rounded-lg p-6" style="border-color: #eae2d9;">
					<h3 class="text-lg font-semibold mb-3" style="color: #334642;">Description</h3>
					<p class="text-gray-700">{course.description}</p>
				</div>
			{/if}

			{#if course.duration_weeks}
				<div class="bg-white border rounded-lg p-6" style="border-color: #eae2d9;">
					<h3 class="text-lg font-semibold mb-3" style="color: #334642;">Duration</h3>
					<p class="text-gray-700">{course.duration_weeks} weeks total</p>
				</div>
			{/if}
		</div>
	{:else if activeTab === 'modules'}
		<div>
			<div class="flex justify-between items-center mb-6">
				<p class="text-gray-600">Manage modules for this course</p>
				<a
					href="/admin/modules?course_id={course.id}"
					class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold"
					style="background-color: #c59a6b; color: #1e2322;"
				>
					<Plus size={18} />
					Add Module
				</a>
			</div>

			{#if modules.length === 0}
				<div class="text-center py-12 bg-white border rounded-lg" style="border-color: #eae2d9;">
					<BookOpen size={48} class="mx-auto mb-4" style="color: #c59a6b;" />
					<p class="text-gray-600">No modules yet. Create your first module to get started.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each modules as module}
						<div class="bg-white border rounded-lg p-6" style="border-color: #eae2d9;">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<h4 class="text-lg font-semibold mb-2" style="color: #334642;">
										{module.name}
									</h4>
									{#if module.description}
										<p class="text-gray-600 mb-3">{module.description}</p>
									{/if}
									<div class="flex gap-4 text-sm text-gray-500">
										<span>{module.sessions?.[0]?.count || 0} sessions</span>
										<span>{module.cohorts?.length || 0} cohorts</span>
									</div>
								</div>
								<a
									href="/admin/modules?module_id={module.id}"
									class="text-sm px-3 py-2 border rounded-lg"
									style="border-color: #c59a6b; color: #334642;"
								>
									Manage
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else if activeTab === 'cohorts'}
		<div>
			<div class="flex justify-between items-center mb-6">
				<p class="text-gray-600">Scheduled cohort instances</p>
				<a
					href="/admin?course_id={course.id}"
					class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold"
					style="background-color: #c59a6b; color: #1e2322;"
				>
					<Plus size={18} />
					Create Cohort
				</a>
			</div>

			{#if cohorts.length === 0}
				<div class="text-center py-12 bg-white border rounded-lg" style="border-color: #eae2d9;">
					<Calendar size={48} class="mx-auto mb-4" style="color: #c59a6b;" />
					<p class="text-gray-600">No cohorts yet. Create a cohort to start enrolling students.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each cohorts as cohort}
						<div class="bg-white border rounded-lg p-6" style="border-color: #eae2d9;">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-3 mb-2">
										<h4 class="text-lg font-semibold" style="color: #334642;">
											{cohort.name}
										</h4>
										<span
											class="px-2 py-1 text-xs font-semibold rounded-full"
											class:bg-green-100={cohort.status === 'active'}
											class:text-green-800={cohort.status === 'active'}
											class:bg-gray-100={cohort.status !== 'active'}
											class:text-gray-800={cohort.status !== 'active'}
										>
											{cohort.status}
										</span>
									</div>
									<p class="text-sm text-gray-600 mb-2">
										Module: {cohort.module?.name || 'Unknown'}
									</p>
									<div class="flex gap-4 text-sm text-gray-500">
										<span>{new Date(cohort.start_date).toLocaleDateString()} - {new Date(cohort.end_date).toLocaleDateString()}</span>
										<span>{cohort.enrollments?.[0]?.count || 0} enrolled</span>
									</div>
								</div>
								<a
									href="/admin?cohort_id={cohort.id}"
									class="text-sm px-3 py-2 border rounded-lg"
									style="border-color: #c59a6b; color: #334642;"
								>
									Manage
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
