<script>
	import { X, Save, CheckCircle, FileText, Calendar, User, Send } from 'lucide-svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import { toast } from '$lib/stores/toast.svelte.js';
	import { decodeHtmlEntities } from '$lib/utils/html.js';

	let {
		isOpen = $bindable(false),
		reflection = $bindable(null),
		onSave = () => {},
		onApprove = () => {},
		onSendToWordPress = () => {}
	} = $props();

	let editedTitle = $state('');
	let editedContent = $state('');
	let isSaving = $state(false);

	$effect(() => {
		if (reflection) {
			editedTitle = reflection.reflection_title || '';
			editedContent = reflection.reflection_content || '';
		}
	});

	async function handleSave() {
		isSaving = true;
		try {
			await onSave({
				id: reflection.id,
				reflection_title: editedTitle,
				reflection_content: editedContent
			});

			toast.success({
				title: 'Changes saved',
				message: 'Reflection has been updated',
				duration: 3000
			});
		} catch (error) {
			toast.error({
				title: 'Save failed',
				message: error.message,
				duration: 5000
			});
		} finally {
			isSaving = false;
		}
	}

	async function handleApprove() {
		isSaving = true;
		try {
			// Just approve directly - this will change status to approved
			await onApprove(reflection.id);

			toast.success({
				title: 'Reflection approved',
				message: 'This reflection is now ready for publishing',
				duration: 3000
			});

			isOpen = false;
		} catch (error) {
			toast.error({
				title: 'Approval failed',
				message: error.message,
				duration: 5000
			});
		} finally {
			isSaving = false;
		}
	}

	async function handleSendToWordPress() {
		isSaving = true;
		try {
			await onSendToWordPress(reflection.id);
			isOpen = false;
		} catch (error) {
			toast.error({
				title: 'WordPress publishing failed',
				message: error.message,
				duration: 5000
			});
		} finally {
			isSaving = false;
		}
	}

	function formatDate(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function handleClose() {
		if (!isSaving) {
			isOpen = false;
		}
	}
</script>

{#if isOpen && reflection}
	<!-- Modal backdrop -->
	<div class="bg-opacity-50 fixed inset-0 z-40 bg-black" onclick={handleClose}></div>

	<!-- Modal content -->
	<div
		class="fixed inset-4 z-50 mx-auto flex max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl md:inset-x-8 md:inset-y-4"
	>
		<!-- Header -->
		<div class="bg-gradient-to-r from-[#009199] to-[#007580] px-6 py-4 text-white">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="mb-2 text-2xl font-bold">Review Reflection</h2>
					<div class="flex items-center gap-4 text-teal-100">
						<span class="flex items-center gap-1">
							<Calendar class="h-4 w-4" />
							{formatDate(reflection.date)}
						</span>
						{#if reflection.contributor}
							<span class="flex items-center gap-1">
								<User class="h-4 w-4" />
								{reflection.contributor.name}
							</span>
						{/if}
					</div>
				</div>
				<button
					onclick={handleClose}
					disabled={isSaving}
					class="text-white hover:text-teal-200 disabled:opacity-50"
				>
					<X class="h-6 w-6" />
				</button>
			</div>
		</div>

		<!-- Content area -->
		<div class="flex-1 overflow-y-auto p-6">
			<!-- Gospel Reading Display -->
			{#if reflection.liturgical_date || reflection.gospel_reference}
				<div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
					<h3 class="mb-2 font-semibold text-gray-800">Gospel Context</h3>
					{#if reflection.liturgical_date}
						<p class="text-sm font-medium text-purple-700">{reflection.liturgical_date}</p>
					{/if}
					{#if reflection.gospel_reference}
						<p class="mt-1 text-sm text-gray-700">
							{decodeHtmlEntities(reflection.gospel_reference)}
						</p>
					{/if}
				</div>
			{/if}

			<!-- Title field -->
			<div class="mb-6">
				<label class="mb-2 block text-sm font-medium text-gray-700"> Reflection Title </label>
				<input
					type="text"
					bind:value={editedTitle}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-[#009199] focus:outline-none"
					placeholder="Enter a title for the reflection..."
				/>
			</div>

			<!-- Content editor -->
			<div class="mb-6">
				<label class="mb-2 block text-sm font-medium text-gray-700"> Reflection Content </label>
				<textarea
					bind:value={editedContent}
					placeholder="Edit the reflection content..."
					class="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 leading-relaxed text-gray-800 focus:border-transparent focus:ring-2 focus:ring-[#009199] focus:outline-none"
					rows="15"
					style="height: auto; min-height: 300px;"
					oninput={(e) => {
						e.target.style.height = 'auto';
						e.target.style.height = Math.max(300, e.target.scrollHeight) + 'px';
					}}
				></textarea>
			</div>

			<!-- Submission info -->
			{#if reflection.submitted_at}
				<div class="flex items-center gap-1 text-sm text-gray-500">
					<FileText class="h-4 w-4" />
					Submitted on {new Date(reflection.submitted_at).toLocaleString()}
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="border-t border-gray-200 bg-gray-50 px-6 py-4">
			<div class="flex justify-between">
				<button
					onclick={handleClose}
					disabled={isSaving}
					class="px-4 py-2 font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
				>
					Cancel
				</button>

				<div class="flex gap-3">
					<!-- Debug info (remove later) -->
					<span class="text-xs text-gray-500">Status: {reflection.status}</span>
					
					{#if reflection.status === 'approved' || reflection.status === 'Approved'}
						<!-- Approved reflections can be edited and sent to WordPress -->
						<button
							onclick={handleSave}
							disabled={isSaving}
							class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
						>
							<Save class="h-4 w-4" />
							Save Changes
						</button>

						<button
							onclick={handleSendToWordPress}
							disabled={isSaving}
							class="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none disabled:opacity-50"
						>
							<Send class="h-4 w-4" />
							Send to WordPress
						</button>
					{:else}
						<!-- Submitted reflections need approval -->
						<button
							onclick={handleSave}
							disabled={isSaving}
							class="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:opacity-50"
						>
							<Save class="h-4 w-4" />
							Save Changes
						</button>

						<button
							onclick={handleApprove}
							disabled={isSaving}
							class="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none disabled:opacity-50"
						>
							<CheckCircle class="h-4 w-4" />
							Approve
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
