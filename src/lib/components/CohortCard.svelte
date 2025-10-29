<script>
	let { cohort, isActive = false, onClick = () => {} } = $props();

	const getStatusInfo = (status) => {
		switch (status) {
			case 'draft': return { color: '#6B7280', label: 'DRAFT' };
			case 'scheduled': return { color: '#D97706', label: 'SCHEDULED' };
			case 'active': return { color: '#059669', label: 'ACTIVE' };
			case 'completed': return { color: '#2563EB', label: 'COMPLETED' };
			default: return { color: '#6B7280', label: 'UNKNOWN' };
		}
	};

	const statusInfo = $derived(getStatusInfo(cohort.status));

	// Format date for compact display
	const formatDate = (dateString) => {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	};

	// Truncate long names
	const truncate = (str, maxLen) => {
		if (!str) return '';
		return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
	};
</script>

<button
	onclick={onClick}
	class="cohort-pill"
	class:active={isActive}
>
	<div class="row">
		<div class="cohort-name">{truncate(cohort.name, 30)}</div>
		<div class="status-badge">
			<div class="status-dot" style="--status-color: {statusInfo.color};"></div>
			<span class="status-label">{statusInfo.label}</span>
		</div>
	</div>
	<div class="row">
		<div class="module-name">{truncate(cohort.module, 30)}</div>
		<div class="meta-text">
			{#if cohort.status === 'completed'}
				{formatDate(cohort.end_date || cohort.endDate)}
			{:else if cohort.status === 'active'}
				Session {cohort.current_session || cohort.currentSession || 1}/8
			{:else}
				{formatDate(cohort.start_date || cohort.startDate)}
			{/if}
		</div>
	</div>
</button>

<style>
	.cohort-pill {
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(12px);
		border: 2px solid rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		padding: 14px 18px;
		min-width: 280px;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}

	.cohort-pill:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(197, 154, 107, 0.4);
		transform: translateY(-2px);
	}

	.cohort-pill.active {
		background: rgba(255, 255, 255, 0.95);
		border-color: var(--course-accent-light);
		box-shadow: 0 4px 12px rgba(197, 154, 107, 0.3);
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.cohort-name {
		font-size: 1rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.95);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.2s ease;
	}

	.cohort-pill.active .cohort-name {
		color: var(--course-accent-darkest);
	}

	.status-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--status-color);
		flex-shrink: 0;
	}

	.status-label {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.5px;
		color: rgba(255, 255, 255, 0.9);
		white-space: nowrap;
		transition: color 0.2s ease;
	}

	.cohort-pill.active .status-label {
		color: var(--course-accent-dark);
	}

	.module-name {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.7);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.2s ease;
	}

	.cohort-pill.active .module-name {
		color: var(--course-accent-dark);
	}

	.meta-text {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.7);
		white-space: nowrap;
		flex-shrink: 0;
		transition: color 0.2s ease;
	}

	.cohort-pill.active .meta-text {
		color: var(--course-accent-dark);
	}
</style>