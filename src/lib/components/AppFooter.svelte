<script>
	import { Scale } from 'lucide-svelte';

	const currentYear = new Date().getFullYear();
</script>

<footer class="bg-white border-t border-gray-200 mt-auto">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
		<div class="flex flex-col md:flex-row items-center justify-between gap-4">
			<!-- Copyright -->
			<div class="text-sm text-gray-600">
				&copy; {currentYear} Archdiocesan Ministries. All rights reserved.
			</div>

			<!-- Links -->
			<div class="flex items-center gap-6">
				<a
					href="/data-policy"
					class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
				>
					<Scale class="h-4 w-4 mr-1.5" />
					Data Policy
				</a>
			</div>
		</div>
	</div>
</footer>
