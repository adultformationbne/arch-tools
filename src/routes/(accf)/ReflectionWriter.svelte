<script>
	import { Save, Settings, Eye, EyeOff, X, CheckCircle } from 'lucide-svelte';

	let {
		question = '',
		isVisible = $bindable(false),
		onClose = () => {}
	} = $props();

	// Writing state
	let content = $state('');
	let isPrivate = $state(false);
	let autoSaveStatus = $state('saved'); // 'saving', 'saved', 'error'
	let wordCount = $derived(content.trim().split(/\s+/).filter(word => word.length > 0).length);
	let lastSaved = $state(new Date());

	// Auto-save simulation
	let autoSaveTimer;
	const simulateAutoSave = () => {
		if (autoSaveTimer) clearTimeout(autoSaveTimer);
		autoSaveStatus = 'saving';

		autoSaveTimer = setTimeout(() => {
			autoSaveStatus = 'saved';
			lastSaved = new Date();
		}, 1500);
	};

	// Watch for content changes
	$effect(() => {
		if (content.length > 0) {
			simulateAutoSave();
		}
	});

	const handleClose = () => {
		isVisible = false;
		onClose();
	};

	const handleSubmit = () => {
		console.log('Submitting reflection:', { content, isPrivate });
		// Here you would submit to database
		handleClose();
	};

	const formatTime = (date) => {
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});
	};
</script>

{#if isVisible}
	<!-- Writing Component Overlay -->
	<div class="relative z-10">
		<div class="max-w-7xl mx-auto">
			<div class="bg-white rounded-3xl shadow-2xl overflow-hidden" style="background-color: #f8f4f0;">
				<!-- Header -->
				<div class="flex items-center justify-between p-8 border-b border-gray-200">
					<div class="flex-1">
						<h3 class="text-2xl font-bold text-gray-800 mb-2">Write Your Reflection</h3>
						<p class="text-gray-600 leading-relaxed">{question}</p>
					</div>

					<!-- Settings and Close -->
					<div class="flex items-center gap-4">
						<!-- Privacy Toggle -->
						<div class="flex items-center gap-2">
							<button
								class="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors"
								class:bg-green-100={!isPrivate}
								class:bg-red-100={isPrivate}
								on:click={() => isPrivate = !isPrivate}
							>
								{#if isPrivate}
									<EyeOff size="16" class="text-red-600" />
									<span class="text-red-600 font-medium text-sm">Private</span>
								{:else}
									<Eye size="16" class="text-green-600" />
									<span class="text-green-600 font-medium text-sm">Public</span>
								{/if}
							</button>
						</div>

						<!-- Close Button -->
						<button
							on:click={handleClose}
							class="p-3 rounded-xl hover:bg-gray-100 transition-colors"
						>
							<X size="20" class="text-gray-600" />
						</button>
					</div>
				</div>

				<!-- Writing Area -->
				<div class="p-8">
					<textarea
						bind:value={content}
						placeholder="Begin writing your reflection here..."
						class="w-full h-64 p-6 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-opacity-20 text-gray-800 text-lg leading-relaxed"
						style="focus:ring-color: #c59a6b; background-color: #ffffff;"
					></textarea>

					<!-- Writing Stats and Auto-save Status -->
					<div class="flex items-center justify-between mt-6">
						<!-- Left: Stats -->
						<div class="flex items-center gap-6 text-sm text-gray-600">
							<div class="flex items-center gap-2">
								<span>Words:</span>
								<span class="font-semibold">{wordCount}</span>
							</div>
							<div class="flex items-center gap-2">
								<span>Characters:</span>
								<span class="font-semibold">{content.length}</span>
							</div>
						</div>

						<!-- Right: Auto-save Status -->
						<div class="flex items-center gap-4">
							{#if autoSaveStatus === 'saving'}
								<div class="flex items-center gap-2 text-blue-600">
									<div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
									<span class="text-sm font-medium">Saving...</span>
								</div>
							{:else if autoSaveStatus === 'saved'}
								<div class="flex items-center gap-2 text-green-600">
									<CheckCircle size="16" />
									<span class="text-sm font-medium">Saved at {formatTime(lastSaved)}</span>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Footer Actions -->
				<div class="flex items-center justify-between p-8 bg-gray-50 border-t border-gray-200">
					<!-- Left: Additional Options -->
					<div class="flex items-center gap-4">
						<button class="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
							<Settings size="16" />
							<span class="text-sm font-medium">Settings</span>
						</button>
					</div>

					<!-- Right: Action Buttons -->
					<div class="flex items-center gap-4">
						<button
							on:click={handleClose}
							class="px-6 py-3 text-gray-600 hover:text-gray-800 font-semibold transition-colors"
						>
							Save as Draft
						</button>
						<button
							on:click={handleSubmit}
							class="flex items-center gap-2 px-8 py-3 text-white font-semibold rounded-2xl transition-colors hover:opacity-90"
							style="background-color: #334642;"
							disabled={content.trim().length === 0}
						>
							<Save size="16" />
							Submit Reflection
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}