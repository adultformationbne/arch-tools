<script>
	import { User } from 'lucide-svelte';

	export let currentPage = 'dashboard';
	export let userName = 'Sarah';
</script>

<nav class="flex items-center justify-between px-12 py-8" style="background-color: #334642;">
	<!-- Logo -->
	<div class="flex items-center">
		<img src="/accf-logo.png" alt="ACCF Logo" class="h-16 w-auto" />
	</div>

	<!-- Navigation Links -->
	<div class="flex items-center gap-12">
		<button
			class="px-8 py-3 rounded-full font-semibold transition-colors"
			class:active={currentPage === 'dashboard'}
		>
			Dashboard
		</button>
		<button
			class="px-8 py-3 rounded-full font-semibold transition-colors"
			class:active={currentPage === 'cohort'}
		>
			Cohort
		</button>
		<button
			class="px-8 py-3 rounded-full font-semibold transition-colors"
			class:active={currentPage === 'reflections'}
		>
			Reflections
		</button>
	</div>

	<!-- User Profile -->
	<div class="flex items-center gap-3 px-6 py-3 bg-white bg-opacity-90 rounded-full">
		<span class="text-gray-800 font-semibold">Hi, {userName}</span>
		<div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
			<User size="20" class="text-gray-600" />
		</div>
	</div>
</nav>

<style>
	button {
		color: white;
	}

	button:hover {
		color: #f59e0b;
	}

	button.active {
		background-color: #c59a6b;
		color: #1e2322;
	}
</style>