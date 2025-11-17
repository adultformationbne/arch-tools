<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Home, ArrowLeft, Search, AlertCircle, Lock } from 'lucide-svelte';

	$: status = $page.status;
	$: message = $page.error?.message || 'Something went wrong';

	const errorConfig = {
		404: {
			title: 'Page Not Found',
			description: 'The page you\'re looking for doesn\'t exist or has been moved.',
			icon: Search
		},
		403: {
			title: 'Access Denied',
			description: 'You don\'t have permission to access this page.',
			icon: Lock
		},
		500: {
			title: 'Server Error',
			description: 'Something went wrong on our end. We\'re working to fix it.',
			icon: AlertCircle
		},
		default: {
			title: 'Error',
			description: 'An unexpected error occurred.',
			icon: AlertCircle
		}
	};

	$: config = errorConfig[status] || errorConfig.default;

	function goBack() {
		window.history.back();
	}

	function goHome() {
		goto('/');
	}
</script>

<svelte:head>
	<title>{config.title} - {status}</title>
</svelte:head>

<div class="min-h-screen bg-white flex items-center justify-center px-4 py-12">
	<div class="max-w-2xl w-full">
		<!-- Error Card -->
		<div class="border-2 border-black">
			<!-- Header -->
			<div class="border-b-2 border-black bg-black px-12 py-16 text-center">
				<div class="inline-flex items-center justify-center mb-8">
					<svelte:component this={config.icon} class="w-16 h-16 text-white" />
				</div>
				<h1 class="text-8xl font-bold text-white mb-4 tracking-tight">{status}</h1>
				<p class="text-2xl text-white font-semibold uppercase tracking-wider">{config.title}</p>
			</div>

			<!-- Description -->
			<div class="border-b-2 border-black px-12 py-12 bg-white text-center">
				<p class="text-gray-900 text-lg font-medium">
					{config.description}
				</p>
			</div>

			{#if message && status >= 500}
				<div class="border-b-2 border-black px-12 py-8 bg-gray-50">
					<p class="text-sm text-gray-900 font-mono text-center">{message}</p>
				</div>
			{/if}

			<!-- Go Back Button -->
			<button
				onclick={goBack}
				class="w-full border-b-2 border-black px-12 py-6 bg-white hover:bg-gray-50 transition-colors text-center"
			>
				<div class="flex items-center justify-center gap-2">
					<ArrowLeft class="w-5 h-5" />
					<span class="font-bold uppercase tracking-wide text-sm">Go Back</span>
				</div>
			</button>

			<!-- Home Page Button -->
			<button
				onclick={goHome}
				class="w-full border-b-2 border-black px-12 py-6 bg-black hover:bg-gray-900 transition-colors text-center text-white"
			>
				<div class="flex items-center justify-center gap-2">
					<Home class="w-5 h-5" />
					<span class="font-bold uppercase tracking-wide text-sm">Home Page</span>
				</div>
			</button>

			<!-- Helpful Links -->
			{#if status === 404}
				<div class="px-12 py-12 bg-white">
					<p class="text-xs uppercase tracking-widest text-gray-500 text-center mb-6 font-semibold">
						Looking for something specific?
					</p>
					<div class="flex flex-wrap justify-center gap-6">
						<a
							href="/readings"
							class="text-sm text-black font-bold hover:underline uppercase tracking-wide"
						>
							Daily Readings
						</a>
						<span class="text-gray-300">|</span>
						<a
							href="/my-courses"
							class="text-sm text-black font-bold hover:underline uppercase tracking-wide"
						>
							My Courses
						</a>
						<span class="text-gray-300">|</span>
						<a
							href="/profile"
							class="text-sm text-black font-bold hover:underline uppercase tracking-wide"
						>
							Profile
						</a>
					</div>
				</div>
			{/if}

			{#if status === 403}
				<div class="px-12 py-12 bg-white text-center">
					<p class="text-sm text-gray-700 font-medium">
						Need access? Contact your administrator to request permissions.
					</p>
				</div>
			{/if}
		</div>

		<!-- Footer Note -->
		<div class="mt-8 text-center">
			<p class="text-xs uppercase tracking-widest text-gray-400 font-semibold">
				If this problem persists, please contact support
			</p>
		</div>
	</div>
</div>
