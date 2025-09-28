<script>
	import { goto } from '$app/navigation';

	const routes = [
		{
			name: 'Editor',
			path: '/editor',
			description: 'Main content editor with versioning and database storage',
			color: 'bg-green-600 hover:bg-green-700',
			icon: '✏️'
		},
		{
			name: 'DGR',
			path: '/dgr',
			description: 'DGR tools and utilities',
			color: 'bg-blue-600 hover:bg-blue-700',
			icon: '🔧'
		},
		{
			name: 'ACCF Admin',
			path: '/admin/cohorts',
			description: 'ACCF course administration and student management',
			color: 'bg-amber-700 hover:bg-amber-800',
			icon: '🎓'
		},
		{
			name: 'ACCF Student Login',
			path: '/login',
			description: 'Student platform preview (login page)',
			color: 'bg-orange-600 hover:bg-orange-700',
			icon: '👨‍🎓'
		},
		{
			name: 'ACCF Dashboard',
			path: '/dashboard',
			description: 'Student dashboard with course progress',
			color: 'bg-teal-600 hover:bg-teal-700',
			icon: '📊'
		},
		{
			name: 'ACCF Setup',
			path: '/admin/setup',
			description: 'Setup ACCF platform (admin permissions)',
			color: 'bg-purple-600 hover:bg-purple-700',
			icon: '⚙️'
		}
	];
</script>

<svelte:head>
	<title>Archdiocesan Ministry Tools</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
		<div class="mb-12 text-center">
			<h1 class="mb-4 text-4xl font-bold text-gray-800">Archdiocesan Ministry Tools</h1>
			<p class="mb-2 text-xl text-gray-600">Internal Management Platform</p>
			<p class="mx-auto max-w-2xl text-gray-500">
				Comprehensive tools for content management and administrative tasks across archdiocesan
				ministries and parishes.
			</p>
		</div>

		<div class="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			{#each routes as route}
				<div class="rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
					<div class="text-center">
						<div class="mb-3 text-3xl">{route.icon}</div>
						<h3 class="mb-2 text-lg font-semibold text-gray-800">{route.name}</h3>
						<p class="mb-4 text-sm text-gray-600">{route.description}</p>
						<button
							onclick={() => goto(route.path)}
							class="w-full {route.color} rounded-lg px-4 py-2 font-medium text-white transition-colors"
						>
							Open {route.name}
						</button>
					</div>
				</div>
			{/each}
		</div>

		<div class="rounded-lg bg-white p-8 shadow-sm">
			<h2 class="mb-6 text-center text-2xl font-bold text-gray-800">Content Statistics</h2>
			<div class="grid grid-cols-1 gap-6 text-center md:grid-cols-3">
				<div class="rounded-lg bg-blue-50 p-6">
					<div class="mb-2 text-3xl font-bold text-blue-600">56</div>
					<div class="text-gray-600">Chapters</div>
				</div>
				<div class="rounded-lg bg-green-50 p-6">
					<div class="mb-2 text-3xl font-bold text-green-600">3,052</div>
					<div class="text-gray-600">Content Blocks</div>
				</div>
				<div class="rounded-lg bg-purple-50 p-6">
					<div class="mb-2 text-3xl font-bold text-purple-600">3,708</div>
					<div class="text-gray-600">XML Lines</div>
				</div>
			</div>
		</div>
	</div>
</div>
