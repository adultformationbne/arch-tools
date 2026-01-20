<script>
	import { Scale } from '$lib/icons';

	const currentYear = new Date().getFullYear();
</script>

<footer class="bg-white border-t border-gray-200 mt-auto">
	<div class="max-w-7xl mx-auto px-4 py-2">
		<div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
			<!-- Copyright -->
			<div>
				&copy; {currentYear} Archdiocesan Ministries
			</div>

			<!-- Links -->
			<a
				href="/data-policy"
				class="inline-flex items-center hover:text-gray-700 transition-colors"
			>
				<Scale class="h-3 w-3 mr-1" />
				Data Policy
			</a>
		</div>
	</div>
</footer>
