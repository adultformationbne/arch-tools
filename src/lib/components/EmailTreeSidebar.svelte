<script>
	import { ChevronDown, ChevronRight, Mail, Lock, FileText, Plus, List } from 'lucide-svelte';

	let {
		systemTemplates = [],
		customTemplates = [],
		selectedView = 'logs', // 'logs' or template id
		onViewChange = () => {}
	} = $props();

	let expandedSections = $state(new Set(['system']));

	const toggleSection = (sectionId) => {
		if (expandedSections.has(sectionId)) {
			expandedSections.delete(sectionId);
		} else {
			expandedSections.add(sectionId);
		}
		expandedSections = new Set(expandedSections);
	};

	const handleViewChange = (view) => {
		onViewChange(view);
	};
</script>

<div class="h-full flex flex-col" style="background-color: var(--course-accent-dark);">
	<!-- Sidebar Header -->
	<div class="p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
		<h2 class="text-sm font-bold text-white/90 uppercase tracking-wide">Email Management</h2>
	</div>

	<!-- Tree Navigation -->
	<div class="flex-1 overflow-y-auto p-2">
		<!-- Email Logs (Default) -->
		<div class="mb-1">
			<button
				onclick={() => handleViewChange('logs')}
				class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors {selectedView === 'logs' ? 'text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}"
				style={selectedView === 'logs' ? 'background-color: var(--course-accent-light); color: var(--course-accent-darkest);' : ''}
			>
				<List size={16} class="flex-shrink-0" />
				<span class="text-sm font-medium">Email Logs</span>
			</button>
		</div>

		<!-- Divider -->
		<div class="my-3 border-t" style="border-color: rgba(255,255,255,0.1);"></div>

		<!-- System Templates Section -->
		<div class="mb-1">
			<button
				onclick={() => toggleSection('system')}
				class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-white/70 hover:bg-white/5 hover:text-white"
			>
				<div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
					{#if expandedSections.has('system')}
						<ChevronDown size={16} />
					{:else}
						<ChevronRight size={16} />
					{/if}
				</div>
				<Lock size={16} class="flex-shrink-0" />
				<span class="text-sm font-medium">System Templates</span>
				<span class="ml-auto text-xs text-white/50">({systemTemplates.length})</span>
			</button>

			{#if expandedSections.has('system')}
				<div class="ml-6 mt-1 space-y-0.5">
					{#each systemTemplates as template}
						<button
							onclick={() => handleViewChange(template.id)}
							class="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors text-sm {selectedView === template.id ? 'text-white font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white/80'}"
							style={selectedView === template.id ? 'background-color: var(--course-accent-light); color: var(--course-accent-darkest);' : ''}
						>
							<Lock size={12} class="flex-shrink-0" />
							<span class="truncate">{template.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Custom Templates Section -->
		<div class="mb-1">
			<button
				onclick={() => toggleSection('custom')}
				class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-white/70 hover:bg-white/5 hover:text-white"
			>
				<div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
					{#if expandedSections.has('custom')}
						<ChevronDown size={16} />
					{:else}
						<ChevronRight size={16} />
					{/if}
				</div>
				<FileText size={16} class="flex-shrink-0" />
				<span class="text-sm font-medium">Custom Templates</span>
				<span class="ml-auto text-xs text-white/50">({customTemplates.length})</span>
			</button>

			{#if expandedSections.has('custom')}
				<div class="ml-6 mt-1 space-y-0.5">
					{#each customTemplates as template}
						<button
							onclick={() => handleViewChange(template.id)}
							class="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors text-sm {selectedView === template.id ? 'text-white font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white/80'}"
							style={selectedView === template.id ? 'background-color: var(--course-accent-light); color: var(--course-accent-darkest);' : ''}
						>
							<FileText size={12} class="flex-shrink-0" />
							<span class="truncate">{template.name}</span>
						</button>
					{/each}

					<!-- Add Template Button -->
					<button
						onclick={() => handleViewChange('new')}
						class="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors text-sm text-white/60 hover:bg-white/5 hover:text-white/80 border border-dashed border-white/20 mt-2"
					>
						<Plus size={12} class="flex-shrink-0" />
						<span>Add Template</span>
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Scrollbar styling */
	.overflow-y-auto::-webkit-scrollbar {
		width: 6px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.2);
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>
