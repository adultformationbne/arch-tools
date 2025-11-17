<script>
import { goto } from '$app/navigation';
import { onMount } from 'svelte';
import {
	Edit,
	Wrench,
	GraduationCap,
	Users,
	BookOpen,
	Settings
} from 'lucide-svelte';

export let data;
$: ({ session, userModules = [] } = data);

// Redirect participants to /my-courses ONLY if that's their only module
onMount(() => {
	if (userModules?.length === 1 && userModules[0] === 'courses.participant') {
		goto('/my-courses');
	}
});

// Module-based route configuration
const moduleRoutes = [
	{
		module: 'editor',
		name: 'Content Editor',
		path: '/editor',
		description: 'Create and manage content with versioning and database storage',
		color: 'bg-gradient-to-br from-blue-500 to-blue-600',
		icon: Edit
	},
	{
		module: 'dgr',
		name: 'Daily Gospel Readings',
		path: '/dgr',
		description: 'Manage DGR templates, publishing, and content workflows',
		color: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
		icon: Wrench
	},
	{
		module: 'users',
		name: 'User Management',
		path: '/admin/users',
		description: 'Manage users, invitations, and platform permissions',
		color: 'bg-gradient-to-br from-purple-500 to-purple-600',
		icon: Users
	},
	{
		module: 'courses.admin',
		name: 'Course Administration',
		path: '/admin/courses',
		description: 'Manage all courses, modules, enrollments, and platform-wide settings',
		color: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
		icon: GraduationCap
	},
	{
		module: 'courses.manager',
		name: 'My Courses',
		path: '/admin/courses',
		description: 'Manage courses where you are enrolled as an administrator',
		color: 'bg-gradient-to-br from-teal-500 to-teal-600',
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
	color: 'bg-gradient-to-br from-amber-500 to-amber-600',
	icon: BookOpen
};

$: allRoutes = [publicReadingsRoute, ...availableRoutes];
</script>

<svelte:head>
	<title>Archdiocesan Ministry Tools</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
	<div class="mb-12">
		<h1 class="text-4xl font-bold text-gray-900">Ministry Tools</h1>
		<p class="mt-2 text-lg text-gray-600">Select a tool to get started</p>
	</div>

	<div class="space-y-4">
		{#each allRoutes as route}
			<button
				onclick={() => goto(route.path)}
				class="group flex w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-gray-300"
			>
				<!-- Left icon section -->
				<div class="flex w-24 flex-shrink-0 items-center justify-center {route.color}">
					<svelte:component this={route.icon} class="h-10 w-10 text-white" />
				</div>

				<!-- Right content section -->
				<div class="flex flex-1 flex-col items-start justify-center px-6 py-6 text-left">
					<h3 class="text-xl font-semibold text-gray-900 group-hover:text-gray-700">
						{route.name}
					</h3>
					<p class="mt-1 text-sm text-gray-600">{route.description}</p>
				</div>

				<!-- Right arrow indicator -->
				<div class="flex items-center justify-center px-6 text-gray-400 group-hover:text-gray-600">
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</div>
			</button>
		{/each}
	</div>

	{#if allRoutes.length === 1}
		<div class="mt-8 rounded-lg bg-blue-50 border border-blue-200 p-6">
			<div class="flex items-start">
				<Settings class="h-6 w-6 text-blue-600 mr-3 flex-shrink-0" />
				<div>
					<h3 class="text-sm font-semibold text-blue-900">Need access to more tools?</h3>
					<p class="mt-1 text-sm text-blue-700">
						Contact your administrator to request additional module permissions.
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
