<script>
	import { ExternalLink, Shield, LogOut } from 'lucide-svelte';

	const handleLogout = () => {
		// Will implement proper logout later
		console.log('Logout clicked');
		// For now, redirect to login
		window.location.href = '/login';
	};
</script>

<footer class="mt-16 border-t" style="background-color: #334642; border-color: rgba(234, 226, 217, 0.2);">
	<div class="px-16 py-8">
		<div class="max-w-7xl mx-auto">
			<div class="flex items-center justify-between">
				<!-- Left: Organization Link -->
				<div class="flex items-center gap-6">
					<a
						href="https://archdiocesanministries.org.au/"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
					>
						<ExternalLink size="16" />
						<span class="font-medium">Archdiocesan Ministries</span>
					</a>
					<div class="h-4 w-px" style="background-color: rgba(234, 226, 217, 0.3);"></div>
					<a
						href="/privacy-policy"
						class="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
					>
						<Shield size="16" />
						<span class="font-medium">Privacy Policy</span>
					</a>
				</div>

				<!-- Right: Logout -->
				<button
					onclick={handleLogout}
					class="flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-colors"
				>
					<LogOut size="16" />
					<span class="font-medium">Log Out</span>
				</button>
			</div>

			<!-- Bottom: Copyright -->
			<div class="mt-6 pt-6 border-t" style="border-color: rgba(234, 226, 217, 0.2);">
				<div class="text-center text-white opacity-60 text-sm">
					© {new Date().getFullYear()} Archdiocesan Center for Catholic Formation. All rights reserved.
				</div>
			</div>
		</div>
	</div>
</footer>