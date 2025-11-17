<script>
	let {
		type = 'card', // 'card', 'table', 'list', 'text'
		count = 1,
		height = 'auto'
	} = $props();
</script>

{#if type === 'card'}
	{#each Array(count) as _, i}
		<div class="skeleton-card" style="height: {height}">
			<div class="skeleton-header"></div>
			<div class="skeleton-line"></div>
			<div class="skeleton-line short"></div>
		</div>
	{/each}
{:else if type === 'table'}
	<div class="skeleton-table">
		<div class="skeleton-table-header"></div>
		{#each Array(count) as _, i}
			<div class="skeleton-table-row">
				<div class="skeleton-cell"></div>
				<div class="skeleton-cell"></div>
				<div class="skeleton-cell"></div>
			</div>
		{/each}
	</div>
{:else if type === 'list'}
	{#each Array(count) as _, i}
		<div class="skeleton-list-item">
			<div class="skeleton-circle"></div>
			<div class="skeleton-line"></div>
		</div>
	{/each}
{:else}
	{#each Array(count) as _, i}
		<div class="skeleton-line" style="height: {height}"></div>
	{/each}
{/if}

<style>
	.skeleton-card {
		background: white;
		border: 1px solid var(--course-surface, #e5e7eb);
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 16px;
	}

	.skeleton-header {
		height: 32px;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 8px;
		margin-bottom: 16px;
		width: 60%;
	}

	.skeleton-line {
		height: 16px;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
		margin-bottom: 12px;
		width: 100%;
	}

	.skeleton-line.short {
		width: 40%;
	}

	.skeleton-table {
		background: white;
		border: 1px solid var(--course-surface, #e5e7eb);
		border-radius: 12px;
		overflow: hidden;
	}

	.skeleton-table-header {
		height: 48px;
		background: linear-gradient(90deg, #f8f8f8 25%, #e8e8e8 50%, #f8f8f8 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-bottom: 2px solid var(--course-surface, #e5e7eb);
	}

	.skeleton-table-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		padding: 16px 24px;
		border-bottom: 1px solid var(--course-surface, #e5e7eb);
	}

	.skeleton-cell {
		height: 20px;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}

	.skeleton-list-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px;
		margin-bottom: 8px;
	}

	.skeleton-circle {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		flex-shrink: 0;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
