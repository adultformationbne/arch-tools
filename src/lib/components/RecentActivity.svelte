<script>
	import { MessageSquare, Mail, ArrowRight, UserPlus, UserMinus } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let { cohort, courseSlug } = $props();

	let recentActivity = $state([]);
	let loading = $state(false);

	// Auto-load activity when component mounts
	onMount(() => {
		loadActivity();
	});

	// Reload when cohort changes
	$effect(() => {
		if (cohort?.id) {
			loadActivity();
		}
	});

	async function loadActivity() {
		if (!cohort?.id) return;

		loading = true;
		try {
			const response = await fetch(`/courses/${courseSlug}/admin/api?endpoint=recent_activity&cohort_id=${cohort.id}`);
			if (response.ok) {
				const data = await response.json();
				recentActivity = data.data || [];
			}
		} catch (err) {
			console.error('Error loading activity:', err);
		} finally {
			loading = false;
		}
	}

	function formatRelativeTime(dateString) {
		const date = new Date(dateString);
		const now = new Date();
		const diffInSeconds = Math.floor((now - date) / 1000);

		if (diffInSeconds < 60) return 'Just now';
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
		if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

		return date.toLocaleDateString();
	}

	function getActivityIcon(type) {
		switch (type) {
			case 'reflection':
				return MessageSquare;
			case 'email':
				return Mail;
			case 'advancement':
				return ArrowRight;
			case 'enrollment':
				return UserPlus;
			case 'removal':
				return UserMinus;
			default:
				return MessageSquare;
		}
	}
</script>

<div class="activity-section">
	<div class="activity-header">
		<h3>Recent Activity</h3>
	</div>

	<div class="activity-feed">
		{#if loading}
			<p class="loading-message">Loading activity...</p>
		{:else if recentActivity.length === 0}
			<p class="empty-activity">No recent activity in the last 7 days</p>
		{:else}
			{#each recentActivity as activity}
				{@const IconComponent = getActivityIcon(activity.type)}
				<div class="activity-item">
					<div class="activity-icon">
						<IconComponent size={16} />
					</div>
					<div class="activity-content">
						<p class="activity-text">{activity.description}</p>
						<span class="activity-time">{formatRelativeTime(activity.created_at)}</span>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.activity-section {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.activity-header {
		padding: 1rem 1.5rem;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
	}

	.activity-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--course-accent-darkest, #1e2322);
		margin: 0;
	}

	.activity-feed {
		padding: 1rem;
		overflow-y: auto;
		flex: 1;
	}

	.activity-item {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 8px;
		transition: background 0.2s;
	}

	.activity-item:hover {
		background: #f9fafb;
	}

	.activity-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: rgba(197, 154, 107, 0.1);
		color: var(--course-accent-light, #c59a6b);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.activity-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.activity-text {
		font-size: 0.9375rem;
		color: var(--course-accent-darkest, #1e2322);
		margin: 0;
	}

	.activity-time {
		font-size: 0.8125rem;
		color: #9ca3af;
	}

	.empty-activity,
	.loading-message {
		padding: 2rem;
		text-align: center;
		color: #9ca3af;
		font-style: italic;
	}
</style>