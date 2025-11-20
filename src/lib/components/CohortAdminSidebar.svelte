<script>
	import { ArrowUp, Mail, FileDown, UserPlus, ChevronRight, Edit, Send, CheckCircle } from 'lucide-svelte';

	let {
		cohort = null,
		stats = { participantCount: 0, avgAttendance: 0, pendingReflections: 0 },
		onAdvanceSession = () => {},
		onEmailAll = () => {},
		onExport = () => {},
		onAddParticipant = () => {},
		recentActivity = []
	} = $props();

	// Format dates
	function formatDate(dateStr) {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	// Format activity time
	function formatActivityTime(dateStr) {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now - date;
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (hours < 1) return 'Just now';
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return formatDate(dateStr);
	}

	// Get activity icon component
	function getActivityIcon(type) {
		const icons = {
			reflection: Edit,
			advancement: ArrowUp,
			email: Send,
			attendance: CheckCircle
		};
		return icons[type] || Edit;
	}
</script>

<div class="h-full flex flex-col" style="background-color: var(--course-accent-dark);">
	<!-- Sidebar Header -->
	<div class="p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
		<h2 class="text-sm font-bold text-white/90 uppercase tracking-wide">Cohort Admin</h2>
	</div>

	<div class="flex-1 overflow-y-auto">
		{#if cohort}
			<!-- Cohort Info -->
			<div class="p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
				<h3 class="text-lg font-bold text-white mb-1">{cohort.name}</h3>
				<p class="text-sm text-white/70 mb-2">{cohort.module?.name || 'Module'}</p>
				<p class="text-xs text-white/50 mb-3">
					{formatDate(cohort.start_date)} - {formatDate(cohort.end_date)}
				</p>

				<!-- Big Session Indicator -->
				<div class="rounded-lg p-4 text-center mb-3" style="background-color: rgba(255,255,255,0.1);">
					<div class="text-xs text-white/70 uppercase tracking-wide mb-1">Current Session</div>
					<div class="text-4xl font-bold text-white">
						{cohort.current_session}<span class="text-2xl text-white/50">/{cohort.module?.total_sessions || 8}</span>
					</div>
				</div>

				<!-- Quick Stats -->
				<div class="space-y-1 text-xs text-white/70">
					<div class="flex justify-between">
						<span>Participants:</span>
						<span class="text-white/90 font-medium">{stats.participantCount}</span>
					</div>
					<div class="flex justify-between">
						<span>Avg Attendance:</span>
						<span class="text-white/90 font-medium">{stats.avgAttendance}%</span>
					</div>
					<div class="flex justify-between">
						<span>Pending Reflections:</span>
						<span class="text-white/90 font-medium">{stats.pendingReflections}</span>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
				<h4 class="text-xs font-bold text-white/70 uppercase tracking-wide mb-3">Actions</h4>
				<div class="space-y-2">
					<button
						onclick={onAdvanceSession}
						class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-white/90 hover:bg-white/10"
					>
						<ArrowUp size={18} />
						<div class="flex-1">
							<div class="text-sm font-medium">Advance Session</div>
							<div class="text-xs text-white/60">Move to Session {cohort.current_session + 1}</div>
						</div>
					</button>

					<button
						onclick={onEmailAll}
						class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-white/90 hover:bg-white/10"
					>
						<Mail size={18} />
						<div class="flex-1">
							<div class="text-sm font-medium">Email Cohort</div>
							<div class="text-xs text-white/60">Send to all students</div>
						</div>
					</button>

					<button
						onclick={onExport}
						class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-white/90 hover:bg-white/10"
					>
						<FileDown size={18} />
						<div class="flex-1">
							<div class="text-sm font-medium">Export Report</div>
							<div class="text-xs text-white/60">Download CSV</div>
						</div>
					</button>

					<button
						onclick={onAddParticipant}
						class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-white/90 hover:bg-white/10"
					>
						<UserPlus size={18} />
						<div class="flex-1">
							<div class="text-sm font-medium">Add Participant</div>
							<div class="text-xs text-white/60">Enroll new participant</div>
						</div>
					</button>
				</div>
			</div>

			<!-- Recent Activity -->
			<div class="p-4">
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-xs font-bold text-white/70 uppercase tracking-wide">Activity</h4>
					{#if recentActivity.length > 3}
						<button class="text-xs text-white/50 hover:text-white/70 flex items-center gap-1">
							View All
							<ChevronRight size={12} />
						</button>
					{/if}
				</div>
				<div class="space-y-2">
					{#if recentActivity.length === 0}
						<p class="text-xs text-white/50 italic">No recent activity</p>
					{:else}
						{#each recentActivity.slice(0, 3) as activity}
							{@const IconComponent = getActivityIcon(activity.type)}
							<div class="text-xs text-white/70">
								<div class="flex items-start gap-2">
									<IconComponent size={14} class="flex-shrink-0 mt-0.5" />
									<div class="flex-1 min-w-0">
										<div class="truncate">{activity.description}</div>
										<div class="text-white/50 mt-0.5">{formatActivityTime(activity.created_at)}</div>
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{:else}
			<!-- No Cohort Selected -->
			<div class="p-4 text-center">
				<p class="text-sm text-white/50">Select a cohort to view details</p>
			</div>
		{/if}
	</div>
</div>
