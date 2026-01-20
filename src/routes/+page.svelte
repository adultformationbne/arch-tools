<script>
import { goto } from '$app/navigation';
import {
	Wrench,
	GraduationCap,
	Users,
	BookOpen,
	Settings
} from '$lib/icons';

export let data;
$: ({ session, userModules = [], platform } = data);

// Note: courses.participant-only users are redirected server-side in +page.server.ts

// Module-based route configuration
const moduleRoutes = [
	{
		module: 'dgr',
		name: 'Daily Gospel Readings',
		path: '/dgr',
		description: 'Manage DGR templates, publishing, and content workflows',
		icon: Wrench
	},
	{
		module: 'platform.admin',
		name: 'Platform Admin',
		path: '/settings',
		description: 'Manage users, invitations, and platform settings',
		icon: Users
	},
	{
		module: 'courses.admin',
		name: 'Course Administration',
		path: '/admin/courses',
		description: 'Manage all courses, modules, enrollments, and platform-wide settings',
		icon: GraduationCap
	},
	{
		module: 'courses.manager',
		name: 'My Courses',
		path: '/admin/courses',
		description: 'Manage courses where you are enrolled as an administrator',
		icon: GraduationCap
	}
];

// Filter routes based on user's modules
$: availableRoutes = moduleRoutes.filter((route) => userModules?.includes?.(route.module));

// Always show public readings (available to everyone)
const publicReadingsRoute = {
	name: 'Daily Readings',
	path: '/readings',
	description: 'View today\'s Mass readings and liturgical calendar',
	icon: BookOpen
};

$: allRoutes = [publicReadingsRoute, ...availableRoutes];
</script>

<svelte:head>
	<title>{platform.name}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
		<div class="mb-12">
			<h1 class="text-4xl font-bold text-gray-900">Ministry Tools</h1>
			<p class="mt-2 text-lg text-gray-600">Select a tool to get started</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			{#each allRoutes as route}
				<button
					onclick={() => goto(route.path)}
					class="group relative overflow-hidden rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:shadow-md hover:border-gray-900"
				>
					<!-- Icon -->
					<div class="mb-4 inline-flex rounded-full bg-gray-900 p-3 transition-transform group-hover:scale-110">
						<svelte:component this={route.icon} class="h-6 w-6 text-white" />
					</div>

					<!-- Content -->
					<div>
						<h3 class="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
							{route.name}
						</h3>
						<p class="mt-2 text-sm text-gray-600">{route.description}</p>
					</div>

					<!-- Arrow indicator -->
					<div class="absolute right-4 top-4 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-gray-900">
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</div>
				</button>
			{/each}
		</div>

		{#if allRoutes.length === 1}
			<div class="mt-8 rounded-lg bg-gray-100 border border-gray-200 p-6">
				<div class="flex items-start">
					<div class="flex-shrink-0 rounded-full bg-gray-900 p-2">
						<Settings class="h-5 w-5 text-white" />
					</div>
					<div class="ml-4">
						<h3 class="text-sm font-semibold text-gray-900">Need access to more tools?</h3>
						<p class="mt-1 text-sm text-gray-600">
							Contact your administrator to request additional module permissions.
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
