<script>
	import { Send, Eye, Trash2, FileText, Copy, MoreVertical, Download, CheckCircle, PlusCircle, Mail, Check, BookOpen, Monitor } from 'lucide-svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	import { createDropdown } from '$lib/utils/dropdown.js';
	import { formatContributorName, formatReading } from '$lib/utils/dgr-helpers';

	let {
		schedule = [],
		contributors = [],
		statusColors = {},
		statusOptions = [],
		onUpdateAssignment = () => {},
		onUpdateStatus = () => {},
		onOpenReviewModal = () => {},
		onSendToWordPress = () => {},
		onClearReflection = () => {},
		onCopySubmissionUrl = () => {},
		onGetReadings = () => {},
		onEditReadings = () => {},
		onApproveReflection = () => {},
		onQuickAddReflection = () => {},
		onSendReminder = () => {},
		onPreview = () => {}
	} = $props();

	let hoveredReminderId = $state(null);
	let dropdownRefs = $state(new Map());
	let dropdownControllers = $state(new Map());

	// Svelte action to register dropdown elements
	function dropdownAction(node, params) {
		const { entryKey, type } = params;

		if (!dropdownRefs.has(entryKey)) {
			dropdownRefs.set(entryKey, {});
		}
		const refs = dropdownRefs.get(entryKey);
		refs[type] = node;

		if (refs.button && refs.menu) {
			const controller = createDropdown(refs.button, refs.menu, {
				placement: 'bottom-end',
				offset: 4
			});
			dropdownControllers.set(entryKey, controller);
		}

		return {
			destroy() {}
		};
	}

	// Cleanup all dropdowns when component unmounts
	$effect(() => {
		return () => {
			dropdownControllers.forEach(controller => controller.destroy());
		};
	});

	function formatDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		const options = {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		};
		return date.toLocaleDateString('en-AU', options);
	}

	// Liturgical season colors for left border bar
	const seasonBarColors = {
		'Advent': 'bg-purple-500',
		'Christmas': 'bg-yellow-500',
		'Lent': 'bg-violet-500',
		'Holy Week': 'bg-red-600',
		'Easter': 'bg-amber-500',
		'Ordinary Time': 'bg-green-600'
	};

	function getSeasonBarColor(season) {
		return seasonBarColors[season] || 'bg-gray-400';
	}

	// Format readings for title attribute
	function formatReadingsTitle(readings) {
		if (!readings) return '';
		const parts = [];
		if (readings.first_reading) parts.push(`1st: ${formatReading(readings.first_reading)}`);
		if (readings.psalm) parts.push(`Ps: ${formatReading(readings.psalm)}`);
		if (readings.second_reading) parts.push(`2nd: ${formatReading(readings.second_reading)}`);
		if (readings.gospel) parts.push(`Gospel: ${formatReading(readings.gospel)}`);
		return parts.join('\n');
	}

	// State for readings popover
	let readingsPopover = $state({ show: false, readings: null, x: 0, y: 0 });

	function showReadings(event, readings) {
		const rect = event.currentTarget.getBoundingClientRect();
		readingsPopover = {
			show: true,
			readings,
			x: rect.right + 8,
			y: rect.top
		};
	}

	function hideReadings() {
		readingsPopover = { show: false, readings: null, x: 0, y: 0 };
	}

	// Check if entry date is within 14 days of today
	function isWithin14Days(dateStr) {
		const entryDate = new Date(dateStr + 'T00:00:00');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const diffTime = entryDate - today;
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays >= 0 && diffDays <= 14;
	}

	// Get days until entry
	function getDaysUntil(dateStr) {
		const entryDate = new Date(dateStr + 'T00:00:00');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const diffTime = entryDate - today;
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	}
</script>

<div class="overflow-hidden rounded-lg bg-white shadow-sm">
	<div class="border-b border-gray-200 px-6 py-4">
		<h2 class="text-lg font-semibold">Upcoming Schedule</h2>
	</div>

	{#if schedule.length === 0}
		<div class="px-6 py-8 text-center text-gray-500">
			No dates found. Check your liturgical calendar data.
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="w-8"></th>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Date
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Liturgical Day
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Contributor
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Status
						</th>
						<th class="px-6 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each schedule as entry (entry.id || entry.date)}
						<tr class:bg-gray-50={!entry.id && !entry.from_pattern}>
							<!-- Liturgical Season Color Bar -->
							<td class="relative p-0">
								{#if entry.liturgical_season}
									<div
										class="absolute inset-y-0 left-0 w-1 {getSeasonBarColor(entry.liturgical_season)}"
										title={entry.liturgical_season}
									></div>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900">
									{formatDate(entry.date)}
								</div>
							</td>
							<td class="px-6 py-4">
								<div class="text-sm text-gray-700 flex items-center gap-2">
									<div class="flex-1 min-w-0">
										{#if entry.liturgical_name}
											<div class="max-w-xs truncate" title={entry.liturgical_name}>
												{decodeHtmlEntities(entry.liturgical_name)}
											</div>
											{#if entry.liturgical_rank && entry.liturgical_rank !== 'Feria'}
												<span class="text-xs text-gray-500">({entry.liturgical_rank})</span>
											{/if}
										{:else}
											—
										{/if}
									</div>
									{#if entry.readings}
										<button
											onmouseenter={(e) => showReadings(e, entry.readings)}
											onmouseleave={hideReadings}
											class="flex-shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
											type="button"
											title={formatReadingsTitle(entry.readings)}
										>
											<BookOpen class="h-4 w-4" />
										</button>
									{/if}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if entry.from_pattern}
									<!-- Pattern-based assignment (no schedule row yet) -->
									<select
										value={entry.contributor_id || ''}
										onchange={(e) => onUpdateAssignment(entry, e.target.value)}
										class="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
									>
										<option value="">Unassigned</option>
										{#each contributors as contributor}
											<option value={contributor.id}>
												{formatContributorName(contributor)}
											</option>
										{/each}
									</select>
								{:else if entry.id}
									<!-- Actual schedule entry -->
									<select
										value={entry.contributor_id || ''}
										onchange={(e) => onUpdateAssignment(entry, e.target.value)}
										class="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
									>
										<option value="">Unassigned</option>
										{#each contributors as contributor}
											<option value={contributor.id}>
												{formatContributorName(contributor)}
											</option>
										{/each}
									</select>
								{:else}
									<!-- Unassigned date (no schedule row, no pattern) -->
									<select
										value=""
										onchange={(e) => onUpdateAssignment(entry, e.target.value)}
										class="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
									>
										<option value="">Unassigned</option>
										{#each contributors as contributor}
											<option value={contributor.id}>
												{formatContributorName(contributor)}
											</option>
										{/each}
									</select>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if entry.id || entry.from_pattern}
									{@const status = entry.status || 'pending'}
									{@const statusLabel = statusOptions.find(o => o.value === status)?.label || 'Pending'}
									<span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium {statusColors[status]}">
										{statusLabel}
									</span>
								{:else}
									<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
										—
									</span>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if true}
									{@const entryKey = entry.id || entry.date}
									<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2">
										<!-- Send Reminder Button (for entries within 14 days - includes pattern entries) -->
										{#if entry.contributor_id && (entry.status === 'pending' || entry.from_pattern) && isWithin14Days(entry.date)}
											{@const daysUntil = getDaysUntil(entry.date)}
											{@const reminderCount = entry.reminder_history?.length || 0}
											{@const isHovered = hoveredReminderId === entryKey}
											{#if reminderCount > 0}
												<!-- Reminder Already Sent - Show Green Check, changes to "Resend" on hover -->
												<button
													onclick={() => onSendReminder(entry)}
													onmouseenter={() => hoveredReminderId = entryKey}
													onmouseleave={() => hoveredReminderId = null}
													class="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
												>
													{#if isHovered}
														<Mail class="h-3.5 w-3.5" />
														Resend Reminder
													{:else}
														<Check class="h-3.5 w-3.5" />
														Reminder Sent
													{/if}
												</button>
											{:else}
												<!-- No Reminder Sent Yet - Show Orange Mail Icon -->
												<button
													onclick={() => onSendReminder(entry)}
													class="inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
													title={daysUntil === 0 ? 'Due today - send reminder' : daysUntil === 1 ? 'Due tomorrow - send reminder' : `Due in ${daysUntil} days - send reminder`}
												>
													<Mail class="h-3.5 w-3.5" />
													Remind ({daysUntil}d)
												</button>
											{/if}
										{/if}

										<!-- Key Action Buttons (Non-pattern entries) -->
										{#if !entry.from_pattern}
											{#if entry.status === 'submitted' || entry.status === 'approved'}
												<button
													onclick={() => onOpenReviewModal(entry)}
													class="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
												>
													<Eye class="h-3.5 w-3.5" />
													{entry.status === 'approved' ? 'Edit' : 'Review'}
												</button>
											{/if}
											{#if entry.status === 'submitted'}
												<button
													onclick={() => onApproveReflection(entry.id)}
													class="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
													title="Quick approve without opening review modal"
												>
													<CheckCircle class="h-3.5 w-3.5" />
													Approve
												</button>
											{/if}
											{#if entry.status === 'approved'}
												<button
													onclick={() => onSendToWordPress(entry.id)}
													class="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
												>
													<Send class="h-3.5 w-3.5" />
													Publish
												</button>
											{/if}
										{/if}
									</div>

									<!-- Three-dots Menu (Always on far right) -->
									<div class="relative ml-auto">
										<button
											use:dropdownAction={{ entryKey, type: 'button' }}
											onclick={() => {
												const controller = dropdownControllers.get(entryKey);
												if (controller) controller.toggle();
											}}
											class="rounded p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
											title="More actions"
										>
											<MoreVertical class="h-4 w-4" />
										</button>

										<div
											use:dropdownAction={{ entryKey, type: 'menu' }}
											style="display: none;"
											class="min-w-[200px] rounded-lg bg-white shadow-lg ring-1 ring-black/5 py-1"
										>
												<div class="py-1">
													<!-- Copy Contributor Link -->
													{#if entry.contributor?.access_token}
														<button
															onclick={() => {
																onCopySubmissionUrl(entry.contributor.access_token);
																const controller = dropdownControllers.get(entryKey);
																if (controller) controller.hide();
															}}
															class="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-blue-700 hover:bg-blue-50"
														>
															<Copy class="h-4 w-4" />
															Copy Contributor Link
														</button>
													{/if}

													<!-- Get Readings -->
													{#if !entry.readings_data || entry.from_pattern}
														<button
															onclick={() => {
																onGetReadings(entry);
																const controller = dropdownControllers.get(entryKey);
																if (controller) controller.hide();
															}}
															class="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-indigo-700 hover:bg-indigo-50"
														>
															<Download class="h-4 w-4" />
															Get Readings
														</button>
													{/if}

													<!-- Quick Add (Always available) -->
													<button
														onclick={() => {
															onQuickAddReflection(entry);
															const controller = dropdownControllers.get(entryKey);
															if (controller) controller.hide();
														}}
														class="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-teal-700 hover:bg-teal-50"
													>
														<PlusCircle class="h-4 w-4" />
														Quick Add Reflection
													</button>

													<!-- Preview (Only for entries with reflection content) -->
													{#if entry.reflection_content && entry.reflection_title}
														<button
															onclick={() => {
																onPreview(entry);
																const controller = dropdownControllers.get(entryKey);
																if (controller) controller.hide();
															}}
															class="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-purple-700 hover:bg-purple-50"
														>
															<Monitor class="h-4 w-4" />
															Preview Output
														</button>
													{/if}

													<!-- Republish (Only for published entries) -->
													{#if entry.status === 'published' && entry.reflection_content}
														<button
															onclick={() => {
																onSendToWordPress(entry.id);
																const controller = dropdownControllers.get(entryKey);
																if (controller) controller.hide();
															}}
															class="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-green-700 hover:bg-green-50"
														>
															<Send class="h-4 w-4" />
															Republish
														</button>
													{/if}

													<!-- Edit Readings (Only if entry has ID) -->
													{#if entry.id}
														<button
															onclick={() => {
																onEditReadings(entry);
																const controller = dropdownControllers.get(entryKey);
																if (controller) controller.hide();
															}}
															class="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
														>
															<FileText class="h-4 w-4" />
															Edit Readings
														</button>
													{/if}

													<!-- Clear Reflection (Only if entry has reflection content) -->
													{#if entry.id && entry.reflection_content}
														<button
															onclick={() => {
																onClearReflection(entry);
																const controller = dropdownControllers.get(entryKey);
																if (controller) controller.hide();
															}}
															class="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50"
														>
															<Trash2 class="h-4 w-4" />
															Clear Reflection
														</button>
													{/if}
												</div>
											</div>
									</div>
								</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Readings Popover -->
{#if readingsPopover.show && readingsPopover.readings}
	<div
		class="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm max-w-xs"
		style="left: {readingsPopover.x}px; top: {readingsPopover.y}px;"
		onmouseenter={() => readingsPopover.show = true}
		onmouseleave={hideReadings}
	>
		<div class="space-y-1.5">
			{#if readingsPopover.readings.first_reading}
				<div><span class="font-semibold text-gray-500">1st:</span> {formatReading(readingsPopover.readings.first_reading)}</div>
			{/if}
			{#if readingsPopover.readings.psalm}
				<div><span class="font-semibold text-gray-500">Ps:</span> {formatReading(readingsPopover.readings.psalm)}</div>
			{/if}
			{#if readingsPopover.readings.second_reading}
				<div><span class="font-semibold text-gray-500">2nd:</span> {formatReading(readingsPopover.readings.second_reading)}</div>
			{/if}
			{#if readingsPopover.readings.gospel}
				<div><span class="font-semibold text-gray-500">Gospel:</span> {formatReading(readingsPopover.readings.gospel)}</div>
			{/if}
		</div>
	</div>
{/if}
