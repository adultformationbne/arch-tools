<script>
	import { ArrowUp, Mail, UserPlus, ChevronRight, Edit, Send, CheckCircle, Settings } from '$lib/icons';

	let {
		cohort = null,
		stats = { participantCount: 0, avgAttendance: 0, pendingReflections: 0 },
		onAdvanceSession = () => {},
		onEmailAll = () => {},
		onAddParticipant = () => {},
		onCohortSettings = () => {},
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
	<div class="px-3 py-2 border-b" style="border-color: rgba(255,255,255,0.1);">
		<h2 class="text-xs font-bold text-white/90 uppercase tracking-wide">Cohort Admin</h2>
	</div>

	<div class="flex-1 overflow-y-auto">
		{#if cohort}
			<!-- Cohort Info -->
			<div class="px-3 py-3 border-b" style="border-color: rgba(255,255,255,0.1);">
				<h3 class="text-sm font-bold text-white truncate">{cohort.name}</h3>
				<p class="text-xs text-white/70 truncate">{cohort.module?.name || 'Module'}</p>
				<p class="text-xs text-white/50 mt-0.5">
					{formatDate(cohort.start_date)} - {formatDate(cohort.end_date)}
				</p>

				<!-- Session Indicator -->
				<div class="rounded-lg p-2.5 text-center mt-3" style="background-color: rgba(255,255,255,0.1);">
					<div class="text-xs text-white/70 uppercase tracking-wide mb-0.5">Current Session</div>
					<div class="text-2xl font-bold text-white">
						{cohort.current_session}<span class="text-base text-white/50">/{cohort.module?.total_sessions || 8}</span>
					</div>
				</div>

				<!-- Quick Stats -->
				<div class="mt-2 text-xs text-white/70">
					{stats.participantCount} participants
				</div>
			</div>

			<!-- Actions -->
			<div class="px-3 py-3 border-b" style="border-color: rgba(255,255,255,0.1);">
				<div class="space-y-1">
					<button
						onclick={onAdvanceSession}
						class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors text-white/90 hover:bg-white/10 text-xs"
					>
						<ArrowUp size={14} />
						<span>Advance Session</span>
					</button>

					<button
						onclick={onEmailAll}
						class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors text-white/90 hover:bg-white/10 text-xs"
					>
						<Mail size={14} />
						<span>Email Cohort</span>
					</button>

					<button
						onclick={onAddParticipant}
						class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors text-white/90 hover:bg-white/10 text-xs"
					>
						<UserPlus size={14} />
						<span>Add Participant</span>
					</button>

					<button
						onclick={onCohortSettings}
						class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors text-white/90 hover:bg-white/10 text-xs"
					>
						<Settings size={14} />
						<span>Cohort Settings</span>
					</button>
				</div>
			</div>

			<!-- Recent Activity -->
			<div class="px-3 py-3">
				<div class="flex items-center justify-between mb-2">
					<h4 class="text-xs font-bold text-white/70 uppercase tracking-wide">Activity</h4>
					{#if recentActivity.length > 3}
						<button class="text-xs text-white/50 hover:text-white/70 flex items-center gap-0.5">
							All
							<ChevronRight size={12} />
						</button>
					{/if}
				</div>
				<div class="space-y-1.5">
					{#if recentActivity.length === 0}
						<p class="text-xs text-white/50 italic">No recent activity</p>
					{:else}
						{#each recentActivity.slice(0, 3) as activity}
							{@const IconComponent = getActivityIcon(activity.type)}
							<div class="text-xs text-white/70 flex items-center gap-1.5">
								<IconComponent size={12} class="flex-shrink-0" />
								<span class="truncate flex-1">{activity.description}</span>
								<span class="text-white/50 flex-shrink-0">{formatActivityTime(activity.created_at)}</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{:else}
			<!-- No Cohort Selected -->
			<div class="p-3 text-center">
				<p class="text-sm text-white/50">Select a cohort to view details</p>
			</div>
		{/if}
	</div>
</div>
