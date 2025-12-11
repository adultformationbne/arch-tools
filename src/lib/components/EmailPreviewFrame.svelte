<script>
	/**
	 * Shared email preview frame with branded header/footer
	 * Used by both SendEmailView and EmailTemplateEditor
	 *
	 * @prop {boolean} withContainer - Wrap in gray background container (default: true)
	 * @prop {string} headerPadding - Header padding class (default: 'py-10 px-6')
	 * @prop {string} footerText - Custom footer text (default: context-appropriate message)
	 */
	let {
		brandName = 'Course Name',
		logoUrl = null,
		accentDark = '#334642',
		withContainer = true,
		headerPadding = 'py-10 px-6',
		footerText = "You're receiving this because you're enrolled in this course.",
		children,
		// Backwards compatibility
		courseName = null
	} = $props();

	// Use courseName if provided (backwards compatibility)
	const displayName = $derived(courseName || brandName);
</script>

{#if withContainer}
	<div class="bg-gray-100 rounded-xl p-6 flex justify-center">
		<div class="w-full max-w-[600px] border border-gray-300 rounded-lg overflow-hidden bg-white shadow-lg">
			<!-- Email Header -->
			<div class="text-center {headerPadding} flex items-center justify-center" style="background-color: {accentDark};">
				{#if logoUrl}
					<img src={logoUrl} alt="{displayName} logo" class="h-20 w-auto object-contain mx-auto max-w-[240px]" />
				{:else}
					<h1 class="text-2xl font-bold text-white">{displayName}</h1>
				{/if}
			</div>

			<!-- Email Body (slot) -->
			<div class="bg-white">
				{@render children()}
			</div>

			<!-- Email Footer -->
			<div class="text-center py-5 px-6" style="background-color: {accentDark};">
				<p class="text-white text-sm font-medium">{displayName}</p>
				<p class="text-white/70 text-xs mt-1">{footerText}</p>
			</div>
		</div>
	</div>
{:else}
	<div class="w-full max-w-[600px] border border-gray-300 rounded-lg overflow-hidden bg-white shadow-xl">
		<!-- Email Header -->
		<div class="text-center {headerPadding} flex items-center justify-center" style="background-color: {accentDark};">
			{#if logoUrl}
				<img src={logoUrl} alt="{displayName} logo" class="h-24 w-auto object-contain max-w-[280px]" />
			{:else}
				<h1 class="text-3xl font-bold text-white tracking-tight">{displayName}</h1>
			{/if}
		</div>

		<!-- Email Body (slot) -->
		<div class="bg-white">
			{@render children()}
		</div>

		<!-- Email Footer -->
		<div class="text-center py-6 px-6" style="background-color: {accentDark};">
			<p class="text-white text-sm font-medium">{displayName}</p>
			<p class="text-white/70 text-xs mt-1">{footerText}</p>
		</div>
	</div>
{/if}
