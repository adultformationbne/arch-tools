<script>
	import { Play, FileText, Book, Download, Edit3 } from 'lucide-svelte';
	import SessionNavigationTabs from './SessionNavigationTabs.svelte';

	let {
		currentSession = $bindable(),
		availableSessions,
		courseData,
		materials,
		currentSessionData,
		onSessionChange,
		onOpenReflectionWriter,
		onOpenMaterial
	} = $props();

	// Icon mapping for materials
	const getIcon = (type) => {
		switch(type) {
			case 'video': return Play;
			case 'document': return FileText;
			case 'native': return Book;
			case 'link': return FileText;
			default: return FileText;
		}
	};
</script>

<div class="pb-16">
	<div class="max-w-7xl mx-auto">
		<SessionNavigationTabs
			bind:currentSession={currentSession}
			totalSessions={8}
			{availableSessions}
			{onSessionChange}
		>
			<div class="p-12">
				<div class="grid grid-cols-2 gap-12">
					<!-- Left Column - Course Info and Materials -->
					<div>
						<!-- Course Header -->
						<div class="mb-10">
							<p class="text-sm font-medium text-gray-600 mb-2">{courseData.title}</p>
							<h1 class="text-5xl font-bold text-gray-800 mb-4">
								{currentSessionData.sessionTitle}
							</h1>
							<div class="flex items-center gap-4">
								<h2 class="text-3xl font-semibold" style="color: #c59a6b;">Session {currentSession}</h2>
								<div class="h-1 w-20 rounded" style="background-color: #c59a6b;"></div>
							</div>
						</div>

						<!-- This Session's Materials -->
						<div>
							<h3 class="text-2xl font-bold text-gray-800 mb-8">This session's materials</h3>
							<div class="space-y-4">
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<div
										class="flex items-center justify-between p-5 rounded-2xl transition-colors cursor-pointer group"
										class:primary={index === 0}
										class:hover:opacity-90={material.viewable}
										class:cursor-not-allowed={!material.viewable}
										style={index === 0 ? "background-color: #c59a6b;" : "background-color: #f5f0e8;"}
										onclick={() => onOpenMaterial(material)}
									>
										<div class="flex items-center gap-4">
											<IconComponent size="24" class={index === 0 ? "text-white" : "text-gray-700"} />
											<span class="font-semibold text-lg" class:text-white={index === 0} class:text-gray-800={index !== 0}>
												{material.title}
											</span>
										</div>

										<!-- Hover Download Icon (for non-viewable materials) -->
										{#if !material.viewable}
											<div class="opacity-0 group-hover:opacity-100 transition-opacity">
												<Download size="20" class="text-gray-600" />
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- Right Column - Session Overview and Reflection -->
					<div class="flex flex-col justify-between h-full">
						<!-- Session Overview -->
						<div>
							<p class="text-lg font-semibold text-gray-800 leading-relaxed">
								<span class="font-bold">Session overview:</span> {currentSessionData.sessionOverview}
							</p>
						</div>

						<!-- Reflection Question -->
						<div class="bg-white rounded-3xl p-8 shadow-sm">
							<div class="text-lg font-semibold mb-4" style="color: #c59a6b;">Question:</div>
							<h4 class="text-2xl font-bold text-gray-800 mb-8 leading-tight">
								{currentSessionData.reflectionQuestion?.text || currentSessionData.reflectionQuestion}
							</h4>

							<!-- Status and Button -->
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<span class="text-gray-700 font-semibold text-lg">
										{currentSessionData.reflectionStatus === 'not_started' ? 'Not started' :
										 currentSessionData.reflectionStatus === 'completed' ? 'Completed' : 'In progress'}
									</span>
									<div
										class="w-3 h-3 rounded-full"
										class:bg-orange-400={currentSessionData.reflectionStatus === 'not_started'}
										class:bg-green-500={currentSessionData.reflectionStatus === 'completed'}
										class:bg-blue-400={currentSessionData.reflectionStatus === 'in_progress'}
									></div>
								</div>
								<button
									onclick={onOpenReflectionWriter}
									class="flex items-center gap-3 px-8 py-4 text-white font-semibold text-lg rounded-3xl transition-colors hover:opacity-90"
									style="background-color: #334642;"
								>
									<Edit3 size="20" />
									Write Reflection
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</SessionNavigationTabs>
	</div>
</div>
