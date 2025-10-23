<script>
	import { goto } from '$app/navigation';
	import { Edit, Wrench, GraduationCap, Users, LayoutDashboard, Settings, BookOpen } from 'lucide-svelte';
	import AppNavigation from '$lib/components/AppNavigation.svelte';

	export let data;
	$: ({ session, userRole } = data);

	const routes = [
		{
			name: 'Daily Readings',
			path: '/readings',
			description: 'Public daily Mass readings and liturgical calendar',
			color: 'bg-emerald-600 hover:bg-emerald-700',
			icon: BookOpen
		},
		{
			name: 'Editor',
			path: '/editor',
			description: 'Main content editor with versioning and database storage',
			color: 'bg-blue-600 hover:bg-blue-700',
			icon: Edit
		},
		{
			name: 'DGR',
			path: '/dgr',
			description: 'DGR tools and utilities',
			color: 'bg-indigo-600 hover:bg-indigo-700',
			icon: Wrench
		},
		{
			name: 'ACCF Admin',
			path: '/admin',
			description: 'ACCF course administration and student management',
			color: 'bg-purple-600 hover:bg-purple-700',
			icon: GraduationCap
		},
		{
			name: 'ACCF Student Login',
			path: '/login',
			description: 'Student platform preview (login page)',
			color: 'bg-teal-600 hover:bg-teal-700',
			icon: Users
		},
		{
			name: 'ACCF Dashboard',
			path: '/dashboard',
			description: 'Student dashboard with course progress',
			color: 'bg-cyan-600 hover:bg-cyan-700',
			icon: LayoutDashboard
		},
		{
			name: 'ACCF Setup',
			path: '/admin/setup',
			description: 'Setup ACCF platform (admin permissions)',
			color: 'bg-slate-600 hover:bg-slate-700',
			icon: Settings
		}
	];
</script>

<svelte:head>
	<title>Archdiocesan Ministry Tools</title>
</svelte:head>

{#if session}
	<AppNavigation {session} {userRole} />
{/if}

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each routes as route}
			<button
				onclick={() => goto(route.path)}
				class="group rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md border border-gray-200"
			>
				<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg {route.color} text-white">
					<svelte:component this={route.icon} class="h-5 w-5" />
				</div>
				<h3 class="mb-2 text-base font-semibold text-gray-900">{route.name}</h3>
				<p class="text-sm text-gray-600">{route.description}</p>
			</button>
		{/each}
	</div>
</div>
