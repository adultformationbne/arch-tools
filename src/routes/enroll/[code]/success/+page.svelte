<script lang="ts">
	import { CheckCircle, Loader2, ArrowRight, FileText, Mail } from '$lib/icons';

	let { data } = $props();

	let accentDark = $derived(data.course?.settings?.theme?.accentDark || '#2563eb');
</script>

<svelte:head>
	<title>You're Enrolled | {data.course.name}</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-gray-50 px-4 py-8 sm:py-12">
	<div class="mx-auto w-full max-w-md flex-1 flex flex-col items-stretch sm:items-center sm:justify-center">
		<div class="w-full rounded-2xl bg-white p-8 shadow-xl">
			<!-- Success indicator -->
			<div class="mb-6 text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
				>
					<CheckCircle class="h-10 w-10 text-green-600" />
				</div>
				<h1 class="text-2xl font-bold text-gray-900">
					{#if data.type === 'paid'}
						Order complete
					{:else}
						You're enrolled!
					{/if}
				</h1>
				<p class="mt-2 text-gray-600">
					{#if data.organizerConfirmation}
						Your group is enrolled in <span class="font-medium">{data.module.name}</span>
					{:else}
						You're enrolled in <span class="font-medium">{data.module.name}</span>
					{/if}
				</p>
			</div>

			<!-- Enrollment details -->
			<div class="mb-6 rounded-lg bg-gray-50 p-4">
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-500">Course</span>
						<span class="font-medium">{data.course.name}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500">Module</span>
						<span class="font-medium">{data.module.name}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500">Cohort</span>
						<span class="font-medium">{data.cohort.name}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500">Email</span>
						<span class="font-medium">{data.email}</span>
					</div>
				</div>
			</div>

			<!-- "Everyone has been emailed" — only when there are other participants -->
			{#if data.invitedCount > 0}
				<div class="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
					<Mail class="mt-0.5 h-4 w-4 flex-shrink-0" />
					<span>
						We've emailed a sign-in link to
						{data.invitedCount === 1 ? 'the other participant' : `all ${data.invitedCount} other participants`}.
						They can sign in or set up their account from that link.
					</span>
				</div>
			{/if}

			<!-- Invoice link (paid only) -->
			{#if data.invoiceUrl}
				<a
					href={data.invoiceUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="mb-4 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
				>
					<FileText class="h-4 w-4" />
					View invoice / receipt
				</a>
			{/if}

			{#if data.organizerConfirmation}
				<!-- Non-attending organiser paid for the group: no course to continue to -->
				<div class="border-t pt-4 text-center text-sm text-gray-500">
					A receipt has been sent to <span class="font-medium">{data.email}</span>.
				</div>
			{:else if data.orderComplete}
				<!-- Attending billing participant: continue into their course -->
				<a
					href="/courses/{data.courseSlug}"
					class="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90"
					style="background-color: {accentDark}"
				>
					Continue to Course
					<ArrowRight class="h-5 w-5" />
				</a>
			{:else}
				<!-- Fallback interstitial (sign-in being established) -->
				<div class="border-t pt-6 text-center">
					<div class="flex items-center justify-center gap-2 text-gray-600">
						<Loader2 class="h-5 w-5 animate-spin" style="color: {accentDark}" />
						<span>Signing you in…</span>
					</div>
					<p class="mt-3 text-sm text-gray-500">
						Taking you to your course dashboard.
					</p>
				</div>
			{/if}
		</div>

		<!-- Help text -->
		<p class="mt-6 text-center text-sm text-gray-500">
			Having trouble? Contact us at
			<a href="mailto:support@archmin.org" class="text-blue-600 hover:underline">
				support@archmin.org
			</a>
		</p>
	</div>
</div>
