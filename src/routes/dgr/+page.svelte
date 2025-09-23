<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRReviewModal from '$lib/components/DGRReviewModal.svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	import { onMount } from 'svelte';
	import { Eye, Send, ExternalLink } from 'lucide-svelte';

	let schedule = $state([]);
	let contributors = $state([]);
	let loading = $state(true);
	let activeTab = $state('schedule');
	let reviewModalOpen = $state(false);
	let selectedReflection = $state(null);
	
	// Promo tiles state - start with 1 tile, can add up to 3
	let promoTiles = $state([
		{ position: 1, image_url: '', title: '', link_url: '' }
	]);
	let savingTiles = $state(false);

	// Form states
	let generateForm = $state({
		startDate: new Date().toISOString().split('T')[0],
		days: 14
	});

	let newContributor = $state({
		name: '',
		email: '',
		preferred_days: [],
		day_of_month: null,
		notes: ''
	});

	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const statusColors = {
		pending: 'bg-yellow-100 text-yellow-800',
		submitted: 'bg-blue-100 text-blue-800',
		approved: 'bg-green-100 text-green-800',
		published: 'bg-purple-100 text-purple-800'
	};

	const statusOptions = [
		{ value: 'pending', label: 'Pending' },
		{ value: 'submitted', label: 'Needs Approval' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'published', label: 'Published' }
	];

	onMount(async () => {
		await Promise.all([loadSchedule(), loadContributors(), loadPromoTiles()]);
		loading = false;
	});

	async function loadSchedule() {
		try {
			const response = await fetch('/api/dgr-admin/schedule?days=30');
			const data = await response.json();

			if (data.error) throw new Error(data.error);
			schedule = data.schedule || [];
		} catch (error) {
			toast.error({
				title: 'Failed to load schedule',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function loadContributors() {
		try {
			const response = await fetch('/api/dgr-admin/contributors');
			const data = await response.json();

			if (data.error) throw new Error(data.error);
			contributors = data.contributors || [];
		} catch (error) {
			toast.error({
				title: 'Failed to load contributors',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function loadPromoTiles() {
		try {
			const response = await fetch('/api/dgr-admin/promo-tiles');
			const data = await response.json();

			if (data.error) throw new Error(data.error);
			
			// Update the promoTiles array with fetched data
			if (data.tiles && data.tiles.length > 0) {
				// Only include tiles that have image URLs (not empty ones)
				const activeTiles = data.tiles.filter(tile => tile.image_url);
				if (activeTiles.length > 0) {
					promoTiles = activeTiles.map(tile => ({
						position: tile.position,
						image_url: tile.image_url || '',
						title: tile.title || '',
						link_url: tile.link_url || ''
					}));
				} else {
					// No active tiles, start with one empty tile
					promoTiles = [{ position: 1, image_url: '', title: '', link_url: '' }];
				}
			}
		} catch (error) {
			console.error('Failed to load promo tiles:', error);
		}
	}

	async function savePromoTiles() {
		savingTiles = true;
		const loadingId = toast.loading({
			title: 'Saving promo tiles...',
			message: 'Updating promotional content'
		});

		try {
			// Only save tiles that have image URLs, reposition them as 1, 2, 3
			const tilesToSave = promoTiles
				.filter(tile => tile.image_url && tile.image_url.trim())
				.map((tile, index) => ({
					...tile,
					position: index + 1
				}));

			const response = await fetch('/api/dgr-admin/promo-tiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tiles: tilesToSave })
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.dismiss(loadingId);
			toast.success({
				title: 'Promo tiles saved',
				message: `${tilesToSave.length} promotional tile${tilesToSave.length !== 1 ? 's' : ''} updated`,
				duration: 3000
			});

			// Reload to refresh positions
			await loadPromoTiles();
		} catch (error) {
			toast.dismiss(loadingId);
			toast.error({
				title: 'Failed to save promo tiles',
				message: error.message,
				duration: 5000
			});
		} finally {
			savingTiles = false;
		}
	}

	function addTile() {
		if (promoTiles.length < 3) {
			promoTiles.push({
				position: promoTiles.length + 1,
				image_url: '',
				title: '',
				link_url: ''
			});
		}
	}

	function removeTile(index) {
		if (promoTiles.length > 1) {
			promoTiles.splice(index, 1);
			// Update positions
			promoTiles.forEach((tile, idx) => {
				tile.position = idx + 1;
			});
		}
	}

	async function generateSchedule() {
		const loadingId = toast.loading({
			title: 'Generating schedule...',
			message: 'Creating assignments for the next ' + generateForm.days + ' days'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'generate_schedule',
					startDate: generateForm.startDate,
					days: generateForm.days
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Schedule generated!',
				message: data.message,
				type: 'success',
				duration: 4000
			});

			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Generation failed',
				message: error.message,
				type: 'error',
				duration: 5000
			});
		}
	}

	async function updateAssignment(scheduleId, contributorId) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_assignment',
					scheduleId,
					contributorId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Assignment updated',
				message: 'Contributor assignment changed successfully',
				duration: 3000
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Update failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function approveReflection(scheduleId) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'approve_reflection',
					scheduleId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Reflection approved',
				message: 'Reflection has been approved and is ready for publishing',
				duration: 3000
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Approval failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function updateStatus(scheduleId, newStatus) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_status',
					scheduleId,
					status: newStatus
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			const statusLabels = {
				pending: 'set to Pending',
				submitted: 'marked as Needs Approval',
				approved: 'approved',
				published: 'marked as Published'
			};

			toast.success({
				title: 'Status updated',
				message: `Reflection ${statusLabels[newStatus]}`,
				duration: 3000
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Status update failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function addContributor() {
		if (!newContributor.name || !newContributor.email) {
			toast.warning({
				title: 'Missing information',
				message: 'Name and email are required',
				duration: 3000
			});
			return;
		}

		try {
			const response = await fetch('/api/dgr-admin/contributors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newContributor)
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Contributor added',
				message: `${newContributor.name} has been added successfully`,
				duration: 3000
			});

			newContributor = { name: '', email: '', preferred_days: [], day_of_month: null, notes: '' };
			await loadContributors();
		} catch (error) {
			toast.error({
				title: 'Failed to add contributor',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function saveReflection(reflectionData) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'save_reflection',
					...reflectionData
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			await loadSchedule();
			return data.schedule;
		} catch (error) {
			throw error;
		}
	}

	async function sendToWordPress(scheduleId) {
		const loadingId = toast.loading({
			title: 'Sending to WordPress...',
			message: 'Publishing reflection to WordPress'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'send_to_wordpress',
					scheduleId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Published to WordPress!',
				message: 'Reflection has been published successfully',
				type: 'success',
				duration: 4000
			});

			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Publishing failed',
				message: error.message,
				type: 'error',
				duration: 5000
			});
		}
	}

	function openReviewModal(entry) {
		selectedReflection = entry;
		reviewModalOpen = true;
	}

	function getSubmissionUrl(token) {
		return `${window.location.origin}/dgr/submit/${token}`;
	}

	function copySubmissionUrl(token) {
		const url = getSubmissionUrl(token);
		navigator.clipboard.writeText(url).then(() => {
			toast.success({
				title: 'Link copied',
				message: 'Submission link copied to clipboard',
				duration: 2000
			});
		});
	}

	function formatDate(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function togglePreferredDay(day) {
		if (newContributor.preferred_days.includes(day)) {
			newContributor.preferred_days = newContributor.preferred_days.filter((d) => d !== day);
		} else {
			newContributor.preferred_days = [...newContributor.preferred_days, day];
		}
	}

</script>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Daily Gospel Reflections</h1>
			<p class="mt-1 text-sm text-gray-600">Unified management platform with full liturgical readings integration</p>
		</div>
		<div class="text-sm text-gray-600">Admin Dashboard</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else}
		<!-- Tabs -->
		<div class="mb-6 border-b border-gray-200">
			<nav class="-mb-px flex space-x-8">
				<button
					onclick={() => (activeTab = 'schedule')}
					class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'schedule'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Schedule ({schedule.length})
				</button>
				<button
					onclick={() => (activeTab = 'contributors')}
					class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'contributors'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Contributors ({contributors.length})
				</button>
				<button
					onclick={() => (activeTab = 'promo')}
					class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'promo'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Promo Tiles
				</button>
				<a
					href="/dgr-publish"
					class="border-b-2 px-1 py-2 text-sm font-medium border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center"
				>
					<ExternalLink class="w-4 h-4 mr-1" />
					Quick Publish
				</a>
				<a
					href="/dgr-templates"
					class="border-b-2 px-1 py-2 text-sm font-medium border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center"
				>
					<ExternalLink class="w-4 h-4 mr-1" />
					Templates
				</a>
			</nav>
		</div>

		{#if activeTab === 'schedule'}
			<!-- Schedule Tab -->
			<div class="space-y-6">
				<!-- Generate Schedule Form -->
				<div class="rounded-lg bg-white p-6 shadow-sm">
					<h2 class="mb-4 text-lg font-semibold">Generate Schedule</h2>
					<div class="flex items-end gap-4">
						<div>
							<label for="start-date" class="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
							<input
								id="start-date"
								type="date"
								bind:value={generateForm.startDate}
								class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							/>
						</div>
						<div>
							<label for="num-days" class="mb-1 block text-sm font-medium text-gray-700">Number of Days</label>
							<input
								id="num-days"
								type="number"
								bind:value={generateForm.days}
								min="1"
								max="365"
								class="w-24 rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							/>
						</div>
						<button
							onclick={generateSchedule}
							class="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						>
							Generate Schedule
						</button>
					</div>
				</div>

				<!-- Schedule List -->
				<div class="overflow-hidden rounded-lg bg-white shadow-sm">
					<div class="border-b border-gray-200 px-6 py-4">
						<h2 class="text-lg font-semibold">Upcoming Schedule</h2>
					</div>

					{#if schedule.length === 0}
						<div class="px-6 py-8 text-center text-gray-500">
							No schedule entries found. Generate a schedule to get started.
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Date</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Gospel Reference</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Contributor</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Status</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Actions</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-200 bg-white">
									{#each schedule as entry (entry.id)}
										<tr>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="text-sm font-medium text-gray-900">
													{formatDate(entry.date)}
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="text-sm text-gray-700">
													{entry.gospel_reference ? decodeHtmlEntities(entry.gospel_reference) : '—'}
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<select
													value={entry.contributor_id || ''}
													onchange={(e) => updateAssignment(entry.id, e.target.value)}
													class="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
												>
													<option value="">Unassigned</option>
													{#each contributors as contributor}
														<option value={contributor.id}>
															{contributor.name}
														</option>
													{/each}
												</select>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<select
													value={entry.status}
													onchange={(e) => updateStatus(entry.id, e.target.value)}
													class="rounded border border-gray-300 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none {statusColors[
														entry.status
													]} font-medium"
												>
													{#each statusOptions as option}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select>
											</td>
											<td class="space-x-3 px-6 py-4 text-sm font-medium whitespace-nowrap">
												{#if entry.submission_token && entry.status === 'pending'}
													<button
														onclick={() => copySubmissionUrl(entry.submission_token)}
														class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900"
													>
														<Send class="h-3 w-3" />
														Copy Link
													</button>
												{/if}
												{#if entry.status === 'submitted' || entry.status === 'approved'}
													<button
														onclick={() => openReviewModal(entry)}
														class="inline-flex items-center gap-1 text-purple-600 hover:text-purple-900"
													>
														<Eye class="h-3 w-3" />
														{entry.status === 'approved' ? 'Edit' : 'Review'}
													</button>
												{/if}
												{#if entry.status === 'approved'}
													<button
														onclick={() => sendToWordPress(entry.id)}
														class="inline-flex items-center gap-1 text-green-600 hover:text-green-900"
													>
														<Send class="h-3 w-3" />
														Send to WordPress
													</button>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'contributors'}
			<!-- Contributors Tab -->
			<div class="space-y-6">
				<!-- Add Contributor Form -->
				<div class="rounded-lg bg-white p-6 shadow-sm">
					<h2 class="mb-4 text-lg font-semibold">Add New Contributor</h2>
					<div class="space-y-4">
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label for="contributor-name" class="mb-1 block text-sm font-medium text-gray-700">Name</label>
								<input
									id="contributor-name"
									type="text"
									bind:value={newContributor.name}
									class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
									placeholder="Sr. Mary Catherine"
								/>
							</div>
							<div>
								<label for="contributor-email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
								<input
									id="contributor-email"
									type="email"
									bind:value={newContributor.email}
									class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
									placeholder="contributor@example.com"
								/>
							</div>
						</div>

						<fieldset>
							<legend class="mb-2 block text-sm font-medium text-gray-700">Preferred Days</legend>
							<div class="flex flex-wrap gap-2">
								{#each dayNames as day, index}
									<button
										onclick={() => togglePreferredDay(index)}
										class="rounded px-3 py-1 text-sm {newContributor.preferred_days.includes(index)
											? 'bg-blue-600 text-white'
											: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
									>
										{day}
									</button>
								{/each}
							</div>
						</fieldset>

						<div>
							<label for="contributor-day-of-month" class="mb-1 block text-sm font-medium text-gray-700">
								Day of Month Assignment (1-31)
							</label>
							<select
								id="contributor-day-of-month"
								bind:value={newContributor.day_of_month}
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value={null}>No specific day</option>
								{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
									<option value={day}>{day}</option>
								{/each}
							</select>
							<p class="mt-1 text-xs text-gray-500">
								Assign this contributor to write on a specific day each month (e.g., always the 15th)
							</p>
						</div>

						<div>
							<label for="contributor-notes" class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
							<textarea
								id="contributor-notes"
								bind:value={newContributor.notes}
								rows="2"
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								placeholder="Any additional notes or preferences..."
							></textarea>
						</div>

						<button
							onclick={addContributor}
							class="rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
						>
							Add Contributor
						</button>
					</div>
				</div>

				<!-- Contributors List -->
				<div class="overflow-hidden rounded-lg bg-white shadow-sm">
					<div class="border-b border-gray-200 px-6 py-4">
						<h2 class="text-lg font-semibold">Contributors</h2>
					</div>

					{#if contributors.length === 0}
						<div class="px-6 py-8 text-center text-gray-500">
							No contributors found. Add some contributors to get started.
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Name</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Email</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Preferred Days</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Day of Month</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Status</th
										>
										<th
											class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
											>Notes</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-200 bg-white">
									{#each contributors as contributor (contributor.id)}
										<tr>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="text-sm font-medium text-gray-900">{contributor.name}</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="text-sm text-gray-500">{contributor.email}</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="text-sm text-gray-500">
													{contributor.preferred_days?.map((d) => dayNames[d]).join(', ') ||
														'Any day'}
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<select
													value={contributor.day_of_month || ''}
													onchange={async (e) => {
														const newDayOfMonth = e.target.value ? parseInt(e.target.value) : null;
														try {
															const response = await fetch('/api/dgr-admin/contributors', {
																method: 'PUT',
																headers: { 'Content-Type': 'application/json' },
																body: JSON.stringify({
																	id: contributor.id,
																	day_of_month: newDayOfMonth
																})
															});
															if (!response.ok) throw new Error('Update failed');
															contributor.day_of_month = newDayOfMonth;
															toast.success({
																title: 'Day updated',
																message: `${contributor.name} assigned to day ${newDayOfMonth || 'none'}`,
																duration: 2000
															});
														} catch (error) {
															toast.error({
																title: 'Update failed',
																message: error.message,
																duration: 3000
															});
														}
													}}
													class="w-16 rounded border border-gray-300 px-1 py-0.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
												>
													<option value="">—</option>
													{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
														<option value={day}>{day}</option>
													{/each}
												</select>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<span
													class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {contributor.active
														? 'bg-green-100 text-green-800'
														: 'bg-red-100 text-red-800'}"
												>
													{contributor.active ? 'Active' : 'Inactive'}
												</span>
											</td>
											<td class="px-6 py-4">
												<div class="max-w-xs truncate text-sm text-gray-500">
													{contributor.notes || '—'}
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'promo'}
			<!-- Promo Tiles Tab -->
			<div class="space-y-6">
				<div class="rounded-lg bg-white p-6 shadow">
					<h3 class="mb-4 text-lg font-medium text-gray-900">Promotional Event Tiles</h3>
					<p class="mb-6 text-sm text-gray-600">
						Manage the promotional tiles that appear at the bottom of Daily Gospel Reflections.
						Enter WordPress media URLs for each tile position.
					</p>
					
					<div class="space-y-6">
						{#each promoTiles as tile, index}
							<div class="border rounded-lg p-4 bg-gray-50">
								<div class="flex items-center justify-between mb-3">
									<h4 class="font-medium text-gray-900">Tile {index + 1}</h4>
									{#if promoTiles.length > 1}
										<button
											onclick={() => removeTile(index)}
											class="text-red-600 hover:text-red-800 text-sm font-medium"
										>
											Remove
										</button>
									{/if}
								</div>
								
								<div class="grid grid-cols-1 gap-4">
									<div>
										<label for="tile-{tile.position}-image" class="block text-sm font-medium text-gray-700">
											Image URL
										</label>
										<input
											id="tile-{tile.position}-image"
											type="text"
											bind:value={tile.image_url}
											placeholder="https://archdiocesanministries.org.au/wp-content/uploads/..."
											class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
										/>
									</div>
									
									<div class="grid grid-cols-2 gap-4">
										<div>
											<label for="tile-{tile.position}-title" class="block text-sm font-medium text-gray-700">
												Title (optional)
											</label>
											<input
												id="tile-{tile.position}-title"
												type="text"
												bind:value={tile.title}
												placeholder="Event name"
												class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
											/>
										</div>
										
										<div>
											<label for="tile-{tile.position}-link" class="block text-sm font-medium text-gray-700">
												Link URL (optional)
											</label>
											<input
												id="tile-{tile.position}-link"
												type="text"
												bind:value={tile.link_url}
												placeholder="https://..."
												class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
											/>
										</div>
									</div>
									
									{#if tile.image_url}
										<div class="mt-3">
											<p class="text-sm font-medium text-gray-700 mb-2">Preview:</p>
											<img 
												src={tile.image_url} 
												alt={tile.title || 'Promo tile ' + tile.position}
												class="h-32 w-32 object-cover rounded-lg border border-gray-300"
												onerror={(e) => e.target.style.display = 'none'}
											/>
										</div>
									{/if}
								</div>
							</div>
						{/each}
						
						{#if promoTiles.length < 3}
							<div class="text-center">
								<button
									onclick={addTile}
									class="inline-flex items-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
								>
									+ Add Another Tile
								</button>
							</div>
						{/if}
						
						<div class="flex justify-between items-center mt-6">
							<div class="text-sm text-gray-500">
								{promoTiles.length} of 3 tiles
							</div>
							<button
								onclick={savePromoTiles}
								disabled={savingTiles}
								class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{savingTiles ? 'Saving...' : 'Save Promo Tiles'}
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Review Modal -->
<DGRReviewModal
	bind:isOpen={reviewModalOpen}
	bind:reflection={selectedReflection}
	onSave={saveReflection}
	onApprove={approveReflection}
	onSendToWordPress={sendToWordPress}
/>

<ToastContainer />
