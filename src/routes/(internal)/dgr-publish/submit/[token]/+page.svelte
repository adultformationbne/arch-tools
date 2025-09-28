<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import OnboardingGuide from '$lib/components/OnboardingGuide.svelte';
	import { onMount } from 'svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	import {
		CheckCircle,
		Edit3,
		Info,
		Loader2,
		Heart,
		BookOpen,
		PenTool,
		Send,
		ArrowRight
	} from 'lucide-svelte';

	const { data } = $props();
	const token = data.token;

	let scheduleData = $state(null);
	let loading = $state(true);
	let submitting = $state(false);
	let submitted = $state(false);

	let formData = $state({
		reflectionTitle: '',
		reflectionContent: ''
	});

	let onboardingSteps = [
		{
			target: '#gospel-section',
			title: "Read Today's Gospel",
			description:
				"Start here! Read through today's Gospel passage carefully. Let it speak to your heart and mind."
		},
		{
			target: '#reflection-section',
			title: 'Write Your Reflection',
			description:
				'Now share your thoughts! Write what this Gospel means to you personally and how it applies to your life.'
		},
		{
			target: '#submit-button',
			title: 'Submit for Review',
			description:
				"When you're finished writing, click here to submit. We'll review your reflection before publishing it."
		}
	];

	onMount(async () => {
		await loadScheduleData();
	});

	async function loadScheduleData() {
		try {
			// We'll need to add an endpoint to get schedule data by token
			const response = await fetch(`/api/dgr/schedule/${token}`);
			const data = await response.json();

			if (data.error) {
				throw new Error(data.error);
			}

			scheduleData = data.schedule;

			// Check if already submitted
			if (scheduleData.status === 'submitted' || scheduleData.status === 'approved') {
				submitted = true;
			}
		} catch (error) {
			toast.error({
				title: 'Invalid Link',
				message: 'This submission link is invalid or has expired.',
				duration: 0 // Don't auto-dismiss
			});
		} finally {
			loading = false;
		}
	}

	async function submitReflection() {
		if (!formData.reflectionContent.trim()) {
			toast.warning({
				title: 'Missing Content',
				message: 'Please enter your reflection before submitting.',
				duration: 4000
			});
			return;
		}

		submitting = true;

		const toastId = toast.multiStep({
			steps: [
				{ title: 'Validating...', message: 'Checking your reflection', type: 'info' },
				{ title: 'Submitting...', message: 'Sending your reflection', type: 'loading' },
				{ title: 'Success!', message: 'Reflection submitted successfully', type: 'success' }
			],
			closeable: false
		});

		try {
			// Step 1: Validation
			await new Promise((resolve) => setTimeout(resolve, 500));
			toast.nextStep(toastId);

			// Step 2: Submission
			const response = await fetch('/api/dgr/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token,
					reflectionTitle: formData.reflectionTitle.trim() || null,
					reflectionContent: formData.reflectionContent.trim()
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			// Step 3: Success
			toast.nextStep(toastId);

			submitted = true;
			scheduleData = data.schedule;

			setTimeout(() => toast.dismiss(toastId), 3000);
		} catch (error) {
			toast.updateToast(toastId, {
				title: 'Submission Failed',
				message: error.message,
				type: 'error',
				closeable: true,
				duration: 5000
			});
		} finally {
			submitting = false;
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
</script>

<svelte:head>
	<title>Submit Daily Gospel Reflection</title>
	<meta name="description" content="Submit your daily gospel reflection" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12">
	<!-- Wide container to allow guide tags to escape bounds -->
	<div class="mx-auto max-w-7xl overflow-visible px-4">
		<div class="mx-auto max-w-4xl overflow-visible">
			{#if loading}
				<div class="flex justify-center py-12">
					<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
				</div>
			{:else if !scheduleData}
				<!-- Invalid token -->
				<div class="rounded-lg bg-white p-8 text-center shadow-sm">
					<div class="mx-auto mb-4 h-12 w-12 text-red-600">
						<svg fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<h1 class="mb-2 text-2xl font-bold text-gray-900">Invalid Submission Link</h1>
					<p class="text-gray-600">
						This reflection submission link is invalid or has expired. Please contact the
						administrator for a new link.
					</p>
				</div>
			{:else if submitted}
				<!-- Already submitted -->
				<div class="rounded-lg bg-white p-8 text-center shadow-sm">
					<div class="mx-auto mb-4 h-12 w-12 text-green-600">
						<svg fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<h1 class="mb-2 text-2xl font-bold text-gray-900">Thank You!</h1>
					<p class="mb-4 text-gray-600">
						Your reflection for <strong>{formatDate(scheduleData.date)}</strong> has been submitted successfully.
					</p>
					<div class="text-sm text-gray-500">
						Status: <span
							class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
						>
							{scheduleData.status}
						</span>
					</div>
				</div>
			{:else}
				<!-- Submission form -->
				<div class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
					<!-- Header -->
					<div class="bg-gradient-to-r from-[#009199] to-[#007580] px-8 py-6 text-white">
						<h1 class="mb-2 text-3xl font-bold" id="main-title">Daily Gospel Reflection</h1>
						<p class="text-lg font-medium text-teal-100">
							{formatDate(scheduleData.date)}
						</p>
					</div>

					<!-- Gospel Reading (stored in database) -->
					{#if scheduleData.gospel_text || scheduleData.gospel_reference || scheduleData.liturgical_date}
						<div class="bg-gradient-to-r from-amber-50 to-orange-50 px-8 py-6">
							<div class="mb-4 flex items-center gap-3" id="gospel-section">
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
									<CheckCircle class="h-4 w-4 text-amber-600" />
								</div>
								<h2 class="text-xl font-bold text-gray-800">Today's Gospel Reading</h2>
							</div>

							<!-- Liturgical Date -->
							{#if scheduleData.liturgical_date}
								<div class="mb-4">
									<div
										class="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-800"
									>
										{scheduleData.liturgical_date}
									</div>
								</div>
							{/if}

							<!-- Gospel Text -->
							{#if scheduleData.gospel_text}
								<div class="rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
									{#if scheduleData.gospel_reference}
										<h3 class="mb-4 text-left text-lg font-bold text-gray-800">
											{decodeHtmlEntities(scheduleData.gospel_reference)}
										</h3>
									{/if}
									<div class="text-lg leading-relaxed text-gray-700">
										{@html scheduleData.gospel_text}
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Form -->
					<form
						onsubmit={(e) => {
							e.preventDefault();
							submitReflection();
						}}
						class="space-y-8 bg-gray-50 p-8"
					>
						<div class="mb-6 flex items-center gap-3" id="reflection-section">
							<div class="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
								<Edit3 class="h-4 w-4 text-green-600" />
							</div>
							<h2 class="text-xl font-bold text-gray-800">Your Reflection</h2>
						</div>

						<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
							<label
								for="reflectionTitle"
								class="mb-3 block text-base font-semibold text-gray-700"
								id="title-label"
							>
								Reflection Title
							</label>
							<input
								id="reflectionTitle"
								type="text"
								bind:value={formData.reflectionTitle}
								class="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg text-gray-800 focus:border-transparent focus:ring-2 focus:ring-[#009199] focus:outline-none"
								placeholder="Enter a title for your reflection..."
							/>
						</div>

						<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
							<label
								for="reflectionContent"
								class="mb-3 block text-base font-semibold text-gray-700"
								id="content-label"
							>
								Your Reflection <span class="text-red-500">*</span>
							</label>
							<textarea
								id="reflectionContent"
								bind:value={formData.reflectionContent}
								required
								rows="14"
								class="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-lg leading-relaxed text-gray-800 focus:border-transparent focus:ring-2 focus:ring-[#009199] focus:outline-none"
								placeholder="Share your thoughts on today's Gospel reading..."
							></textarea>
							<p
								class="mt-3 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-gray-600"
							>
								<Info class="h-4 w-4 text-[#009199]" />
								Write your reflection on today's Gospel reading. This will be reviewed before publishing.
							</p>
						</div>

						<div class="flex justify-center pt-4">
							<button
								id="submit-button"
								type="submit"
								disabled={submitting}
								class="transform rounded-xl bg-gradient-to-r from-[#009199] to-[#007580] px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:from-[#007580] hover:to-[#006570] focus:ring-2 focus:ring-[#009199] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if submitting}
									<Loader2 class="mr-3 -ml-1 h-5 w-5 animate-spin text-white" />
									Submitting...
								{:else}
									<Send class="mr-2 h-4 w-4" />
									Submit Reflection
								{/if}
							</button>
						</div>
					</form>
				</div>

				<!-- Instructions -->
				<div
					class="mt-8 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 shadow-sm"
				>
					<div class="mb-4 flex items-center gap-3" id="guidelines-section">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
							<Info class="h-4 w-4 text-indigo-600" />
						</div>
						<h3 class="text-lg font-bold text-indigo-800">Submission Guidelines</h3>
					</div>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-3">
							<div class="flex items-start gap-2">
								<div class="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-400"></div>
								<p class="text-indigo-700">
									Write your personal reflection on today's Gospel reading
								</p>
							</div>
							<div class="flex items-start gap-2">
								<div class="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-400"></div>
								<p class="text-indigo-700">Your submission will be reviewed before publishing</p>
							</div>
						</div>
						<div class="space-y-3">
							<div class="flex items-start gap-2">
								<div class="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-400"></div>
								<p class="text-indigo-700">You can only submit once per assigned date</p>
							</div>
							<div class="flex items-start gap-2">
								<div class="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-400"></div>
								<p class="text-indigo-700">Contact the administrator if you have any questions</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Thank You Message & Blessing -->
				<div
					class="mt-8 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 p-8 text-center shadow-sm"
				>
					<div class="mb-4">
						<div
							class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100"
						>
							<Heart class="h-6 w-6 fill-current text-amber-600" />
						</div>
						<h3 class="mb-3 text-2xl font-bold text-amber-800">Thank You for Your Service</h3>
						<p class="mx-auto max-w-2xl text-lg leading-relaxed text-amber-700">
							Your willingness to share God's word through reflection is a beautiful gift to our
							community. May your words touch hearts and draw others closer to Christ.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<ToastContainer />

<OnboardingGuide steps={onboardingSteps} autoStart={true} />
