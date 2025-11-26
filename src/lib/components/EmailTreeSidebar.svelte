<script>
	import { ChevronDown, ChevronRight, Mail, Lock, FileText, Plus, List, Send } from 'lucide-svelte';

	let {
		systemTemplates = [],
		customTemplates = [],
		selectedView = 'send', // 'send', 'logs', or template id
		onViewChange = () => {}
	} = $props();

	// Use object instead of Set for proper Svelte 5 reactivity
	let expandedSections = $state({ system: true, custom: false });

	const toggleSection = (sectionId) => {
		expandedSections[sectionId] = !expandedSections[sectionId];
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
		<!-- Send Email (Primary Action) -->
		<div class="mb-1">
			<button
				onclick={() => handleViewChange('send')}
				class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors font-semibold {selectedView === 'send' ? 'text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'}"
				style={selectedView === 'send' ? 'background-color: var(--course-accent-light); color: var(--course-accent-darkest);' : ''}
			>
				<Send size={16} class="flex-shrink-0" />
				<span class="text-sm">Send Email</span>
			</button>
		</div>

		<!-- Email Logs -->
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
					{#if expandedSections.system}
						<ChevronDown size={16} />
					{:else}
						<ChevronRight size={16} />
					{/if}
				</div>
				<Lock size={16} class="flex-shrink-0" />
				<span class="text-sm font-medium">System Templates</span>
				<span class="ml-auto text-xs text-white/50">({systemTemplates.length})</span>
			</button>

			{#if expandedSections.system}
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
					{#if expandedSections.custom}
						<ChevronDown size={16} />
					{:else}
						<ChevronRight size={16} />
					{/if}
				</div>
				<FileText size={16} class="flex-shrink-0" />
				<span class="text-sm font-medium">Custom Templates</span>
				<span class="ml-auto text-xs text-white/50">({customTemplates.length})</span>
			</button>

			{#if expandedSections.custom}
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
