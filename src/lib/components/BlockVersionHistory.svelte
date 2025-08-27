<script>
	import { createEventDispatcher } from 'svelte';
	import RichTextDisplay from './RichTextDisplay.svelte';
	import { History, RotateCcw, User, Calendar, X } from 'lucide-svelte';

	const dispatch = createEventDispatcher();

	let { isOpen = false, blockId = null, currentContent = '' } = $props();

	let versions = $state([]);
	let loading = $state(false);
	let error = $state('');
	let selectedVersionId = $state(null);
	let showDiffs = $state(true);

	// Load version history when modal opens
	$effect(() => {
		if (isOpen && blockId) {
			loadVersionHistory();
		}
	});

	async function loadVersionHistory() {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/editor/blocks/versions?block_id=${blockId}`);
			if (!response.ok) {
				throw new Error(`Failed to load versions: ${response.statusText}`);
			}

			const data = await response.json();
			versions = data.versions || [];
		} catch (err) {
			error = err.message;
			console.error('Error loading version history:', err);
		} finally {
			loading = false;
		}
	}

	function closeModal(e) {
		console.log('Close modal clicked');
		if (e) e.stopPropagation();
		dispatch('close');
	}

	function restoreVersion(version) {
		dispatch('restore', {
			blockId,
			content: version.content,
			tag: version.tag,
			metadata: version.metadata,
			versionId: version.id
		});
		closeModal();
	}

	function formatDate(isoString) {
		const date = new Date(isoString);
		return date.toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function getContentPreview(content, maxLength = 100) {
		// Strip HTML tags for preview
		const stripped = content.replace(/<[^>]*>/g, '');
		return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
	}

	function scrollToVersion(versionId) {
		selectedVersionId = versionId;
		const element = document.getElementById(`version-${versionId}`);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function scrollToCurrent() {
		selectedVersionId = 'current';
		const element = document.getElementById('current-version');
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function simpleDiff(current, previous) {
		// Strip HTML tags for comparison
		const currentText = current.replace(/<[^>]*>/g, '');
		const previousText = previous.replace(/<[^>]*>/g, '');

		// Split into words for comparison
		const currentWords = currentText.split(/\s+/);
		const previousWords = previousText.split(/\s+/);

		let result = '';
		let currentIndex = 0;
		let previousIndex = 0;

		while (currentIndex < currentWords.length || previousIndex < previousWords.length) {
			const currentWord = currentWords[currentIndex] || '';
			const previousWord = previousWords[previousIndex] || '';

			if (currentWord === previousWord) {
				// Words match
				result += currentWord + ' ';
				currentIndex++;
				previousIndex++;
			} else {
				// Find if current word exists later in previous
				const foundInPrevious = previousWords.indexOf(currentWord, previousIndex);
				const foundInCurrent = currentWords.indexOf(previousWord, currentIndex);

				if (
					foundInPrevious !== -1 &&
					(foundInCurrent === -1 ||
						foundInPrevious - previousIndex <= foundInCurrent - currentIndex)
				) {
					// Current word found later in previous - deletion in between
					while (previousIndex < foundInPrevious) {
						result += `<span class="bg-red-100 text-red-800 line-through">${previousWords[previousIndex]}</span> `;
						previousIndex++;
					}
				} else if (foundInCurrent !== -1) {
					// Previous word found later in current - addition
					result += `<span class="bg-green-100 text-green-800">${currentWord}</span> `;
					currentIndex++;
				} else {
					// Words different - replacement
					if (previousWord) {
						result += `<span class="bg-red-100 text-red-800 line-through">${previousWord}</span> `;
						previousIndex++;
					}
					if (currentWord) {
						result += `<span class="bg-green-100 text-green-800">${currentWord}</span> `;
						currentIndex++;
					}
				}
			}
		}

		return result.trim();
	}
</script>

{#if isOpen}
	<!-- Modal backdrop -->
	<div
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
		onclick={closeModal}
	>
		<!-- Modal content -->
		<div
			class="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b p-6">
				<div class="flex items-center gap-3">
					<History class="h-6 w-6 text-indigo-600" />
					<div>
						<h2 class="text-xl font-semibold text-gray-800">Version History</h2>
						<p class="text-sm text-gray-600">Block ID: {blockId}</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<label class="flex items-center gap-2 text-sm text-gray-600">
						<input
							type="checkbox"
							bind:checked={showDiffs}
							class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
						/>
						Show differences
					</label>
					<button
						onclick={(e) => closeModal(e)}
						class="rounded-lg p-2 transition-colors hover:bg-gray-100"
					>
						<X class="h-5 w-5 text-gray-500" />
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex h-[calc(90vh-120px)]">
				<!-- Version list sidebar -->
				<div class="w-1/4 overflow-y-auto border-r bg-gray-50">
					{#if loading}
						<div class="p-6 text-center">
							<div
								class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"
							></div>
							<p class="mt-2 text-sm text-gray-600">Loading versions...</p>
						</div>
					{:else if error}
						<div class="p-6 text-center">
							<p class="text-sm text-red-600">Error: {error}</p>
							<button
								onclick={loadVersionHistory}
								class="mt-2 rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
							>
								Retry
							</button>
						</div>
					{:else if versions.length === 0}
						<div class="p-6 text-center text-gray-500">
							<p class="text-sm">No version history available</p>
						</div>
					{:else}
						<div class="space-y-3 p-4">
							<!-- Current version header -->
							<div class="px-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
								Current Version
							</div>

							<!-- Current version card -->
							<div class="rounded-lg border border-green-200 bg-green-50 p-3">
								<div class="flex items-start gap-2">
									<div class="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-500"></div>
									<div class="min-w-0 flex-1">
										<p class="text-xs font-medium text-green-700">Current</p>
										<p class="truncate text-xs text-gray-600">
											{getContentPreview(currentContent)}
										</p>
									</div>
								</div>
							</div>

							<!-- Previous versions header -->
							{#if versions.length > 1}
								<div class="px-2 pt-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
									Previous Versions ({versions.length - 1})
								</div>
							{/if}

							<!-- Version cards -->
							{#each versions.slice(1) as version, index}
								<div
									class="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50"
								>
									<div class="flex items-start gap-2">
										<div class="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-gray-400"></div>
										<div class="min-w-0 flex-1">
											<div class="mb-1 flex items-center gap-2">
												<Calendar class="h-3 w-3 text-gray-400" />
												<p class="text-xs text-gray-600">
													{formatDate(version.created_at)}
												</p>
											</div>
											{#if version.created_by}
												<div class="mb-2 flex items-center gap-2">
													<User class="h-3 w-3 text-gray-400" />
													<p class="text-xs text-gray-500">
														{version.created_by.email || 'Unknown user'}
													</p>
												</div>
											{/if}
											<p class="truncate text-xs text-gray-700">
												{getContentPreview(version.content)}
											</p>

											<button
												onclick={() => restoreVersion(version)}
												class="mt-2 flex items-center gap-1 rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 transition-colors hover:bg-indigo-200"
											>
												<RotateCcw class="h-3 w-3" />
												Restore
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- All versions as rendered blocks -->
				<div class="flex-1 overflow-y-auto">
					{#if versions.length > 0}
						<div class="space-y-6 p-6">
							<!-- Current version -->
							<div class="border-l-4 border-green-500 pl-4">
								<div class="mb-3 flex items-center justify-between">
									<h3 class="text-lg font-medium text-green-700">Current Version</h3>
									<span class="rounded-full bg-green-100 px-2 py-1 text-xs text-green-600">
										Latest
									</span>
								</div>
								<div class="rounded-lg border border-green-200 bg-green-50 p-4">
									<RichTextDisplay content={currentContent} />
								</div>
							</div>

							<!-- Previous versions -->
							{#if versions.length > 1}
								<div class="border-t pt-6">
									<h3 class="mb-4 text-lg font-medium text-gray-700">Previous Versions</h3>
									<div class="space-y-6">
										{#each versions.slice(1) as version, index}
											<div class="border-l-4 border-gray-300 pl-4">
												<div class="mb-3 flex items-center justify-between">
													<div class="flex items-center gap-3">
														<span class="text-sm font-medium text-gray-600">
															Version {versions.length - index - 1}
														</span>
														<div class="flex items-center gap-2 text-xs text-gray-500">
															<Calendar class="h-3 w-3" />
															{formatDate(version.created_at)}
														</div>
														{#if version.created_by}
															<div class="flex items-center gap-2 text-xs text-gray-500">
																<User class="h-3 w-3" />
																{version.created_by}
															</div>
														{/if}
													</div>
													<button
														onclick={() => restoreVersion(version)}
														class="flex items-center gap-1 rounded-md bg-indigo-100 px-3 py-1 text-xs text-indigo-700 transition-colors hover:bg-indigo-200"
													>
														<RotateCcw class="h-3 w-3" />
														Restore
													</button>
												</div>
												<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
													{#if showDiffs && index === 0}
														<!-- Compare with current content for first previous version -->
														<div class="prose prose-sm max-w-none">
															{@html simpleDiff(currentContent, version.content)}
														</div>
													{:else if showDiffs && index > 0}
														<!-- Compare with next newer version -->
														<div class="prose prose-sm max-w-none">
															{@html simpleDiff(versions[index].content, version.content)}
														</div>
													{:else}
														<RichTextDisplay content={version.content} />
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{:else}
						<div class="flex h-full items-center justify-center text-gray-500">
							<p class="text-sm">No version history available</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 border-t bg-gray-50 p-6">
				<button
					onclick={closeModal}
					class="px-4 py-2 text-gray-600 transition-colors hover:text-gray-800"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
