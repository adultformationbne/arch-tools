<script>
	import { GraduationCap } from 'lucide-svelte';
	import { apiPost } from '$lib/utils/api-handler.js';
	import { toastValidationError } from '$lib/utils/toast-helpers.js';

	let { isOpen = false, userId = null, userName = '', cohorts = [], onClose, onEnrolled } = $props();
	let enrollmentLoading = $state(false);
	let newEnrollment = $state({
		cohortId: '',
		role: 'student'
	});

	function getCohortLabel(cohort) {
		if (!cohort) return 'Unknown';
		const courseName = cohort.module?.course?.name || 'Unknown Course';
		const moduleName = cohort.module?.name || '';
		return `${courseName} - ${cohort.name}`;
	}

	async function addEnrollment(event) {
		event?.preventDefault();
		if (!newEnrollment.cohortId) {
			toastValidationError('Cohort', 'must be selected');
			return;
		}

		enrollmentLoading = true;

		try {
			await apiPost(
				'/api/admin/enrollments',
				{
					userId: userId,
					cohortId: newEnrollment.cohortId,
					role: newEnrollment.role
				},
				{
					loadingMessage: 'Enrolling user in course',
					loadingTitle: 'Adding enrollment...',
					successMessage: 'User enrolled successfully',
					successTitle: 'Success!'
				}
			);

			onEnrolled?.();
			onClose?.();
			newEnrollment = {
				cohortId: '',
				role: 'student'
			};
		} catch (error) {
			console.error('Error adding enrollment:', error);
		} finally {
			enrollmentLoading = false;
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 px-4">
		<div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-2 flex items-center">
					<GraduationCap class="h-5 w-5 mr-2" />
					Add Course Enrollment
				</h3>
				<p class="text-sm text-gray-600 mb-4">
					Enroll {userName} in a course
				</p>

				<form onsubmit={addEnrollment} class="space-y-4">
					<div>
						<label for="cohortId" class="block text-sm font-medium text-gray-700">Select Cohort</label>
						<select
							id="cohortId"
							bind:value={newEnrollment.cohortId}
							required
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
						>
							<option value="">Choose a cohort...</option>
							{#each cohorts as cohort}
								<option value={cohort.id}>
									{getCohortLabel(cohort)}
								</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="enrollmentRole" class="block text-sm font-medium text-gray-700">Enrollment Role</label>
						<select
							id="enrollmentRole"
							bind:value={newEnrollment.role}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
						>
							<option value="student">Participant</option>
							<option value="coordinator">Hub Coordinator</option>
						</select>
						<p class="mt-1 text-xs text-gray-500">
							Note: Course management is via platform modules, not enrollment roles.
						</p>
					</div>

					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							onclick={() => {
								onClose?.();
								newEnrollment = {
									cohortId: '',
									role: 'student'
								};
							}}
							disabled={enrollmentLoading}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={enrollmentLoading}
							class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							{enrollmentLoading ? 'Enrolling...' : 'Enroll User'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
