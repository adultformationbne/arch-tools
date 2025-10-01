<script>
	import { Users, Globe, Heart, MessageCircle, ChevronRight } from 'lucide-svelte';

	let {
		reflections = [],
		onReadReflection = () => {}
	} = $props();

	// Use real reflections data
	const publicReflections = reflections || [];
</script>

<div>
	<!-- Section Header -->
	<div class="flex items-center justify-between mb-8">
		<div class="flex items-center gap-4">
			<h2 class="text-4xl font-bold text-white">Community Reflections</h2>
			<div class="flex items-center gap-2 px-3 py-1 rounded-full" style="background-color: rgba(197, 154, 107, 0.2);">
				<Globe size="16" style="color: #c59a6b;" />
				<span class="text-sm font-medium" style="color: #c59a6b;">Public Feed</span>
			</div>
		</div>
		<div class="text-white text-lg opacity-75">
			Shared reflections from all ACCF cohorts
		</div>
	</div>

	<!-- Public Reflections Grid -->
	{#if publicReflections.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each publicReflections as reflection}
				<button
					onclick={() => onReadReflection(reflection)}
					class="text-left rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer group"
					style="background-color: #eae2d9;"
				>
				<!-- Header with Student Info -->
				<div class="flex items-start justify-between mb-4">
					<div class="flex items-center gap-3">
						<!-- Avatar -->
						<div
							class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
							style="background-color: #334642;"
						>
							{reflection.studentInitials}
						</div>
						<div>
							<h3 class="font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
								{reflection.studentName}
							</h3>
							<div class="flex items-center gap-2 text-xs text-gray-600">
								<span>{reflection.cohortName}</span>
								<span>•</span>
								<span>Session {reflection.sessionNumber}</span>
							</div>
						</div>
					</div>
					<ChevronRight size="16" class="text-gray-400 group-hover:text-gray-600 transition-colors mt-2" />
				</div>

				<!-- Reflection Excerpt -->
				<div class="mb-4">
					<p class="text-gray-700 text-sm leading-relaxed line-clamp-4">
						{reflection.reflectionExcerpt}
					</p>
				</div>

				<!-- Footer with Engagement Stats -->
				<div class="flex items-center justify-between pt-4 border-t border-gray-300">
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-1 text-gray-600">
							<Heart size="14" />
							<span class="text-xs font-medium">{reflection.likes}</span>
						</div>
						<div class="flex items-center gap-1 text-gray-600">
							<MessageCircle size="14" />
							<span class="text-xs font-medium">{reflection.comments}</span>
						</div>
					</div>
					<span class="text-xs text-gray-500">{reflection.submittedAt}</span>
				</div>
				</button>
			{/each}
		</div>

		<!-- Load More Button (only show if there are many reflections) -->
		{#if publicReflections.length >= 6}
			<div class="flex justify-center mt-8">
				<button
					class="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all hover:scale-105"
					style="background-color: rgba(234, 226, 217, 0.2); color: #eae2d9; border: 1px solid rgba(234, 226, 217, 0.3);"
				>
					<Users size="18" />
					Load More Reflections
				</button>
			</div>
		{/if}
	{:else}
		<!-- Empty state when no public reflections -->
		<div class="text-center py-16">
			<div class="mb-4">
				<Globe size="48" class="mx-auto opacity-50" style="color: #eae2d9;" />
			</div>
			<h3 class="text-xl font-semibold text-white mb-2">No public reflections yet</h3>
			<p class="text-white opacity-75 max-w-md mx-auto">
				When students choose to make their reflections public, they'll appear here for the whole community to read and be inspired by.
			</p>
		</div>
	{/if}
</div>

<style>
	/* Tailwind line-clamp utility backup */
	.line-clamp-4 {
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
	}
</style>