<script>
	import '../../app.css';
	import CoursesHeader from './CoursesHeader.svelte';
	import CoursesFooter from './CoursesFooter.svelte';
	import DevUserSwitcher from './DevUserSwitcher.svelte';

	// Get current page from URL for header navigation
	import { page } from '$app/stores';

	// Define children as a snippet prop and get layout data
	let { children, data } = $props();

	let currentPage = $derived(() => {
		const pathname = $page.url.pathname;
		if (pathname.includes('/admin/modules')) return 'modules';
		if (pathname.includes('/admin/reflections')) return 'reflections';
		if (pathname.includes('/admin/attendance')) return 'attendance';
		if (pathname.includes('/admin')) return 'admin';
		if (pathname.includes('/dashboard')) return 'dashboard';
		if (pathname.includes('/materials')) return 'materials';
		if (pathname.includes('/reflections')) return 'reflections';
		if (pathname.includes('/courses-profile')) return 'profile';
		return 'dashboard'; // default
	});

	// Use processed user info from layout server
	let userName = data?.userName || 'User';
	let userRole = data?.userRole === 'courses_admin' ? 'admin' :
	               data?.userRole === 'courses_student' ? 'student' :
	               data?.userRole === 'hub_coordinator' ? 'coordinator' : 'student';
</script>

<!-- Development User Switcher (localhost only) -->
<DevUserSwitcher />

<div class="min-h-screen" style="background-color: #334642;">
	<CoursesHeader currentPage={currentPage()} {userName} {userRole} />
	<!-- Main content area - pages handle their own margins for flexibility -->
	<main>
		{@render children()}
	</main>
	<CoursesFooter />
</div>

<style>
	/* Custom ACCF styles that complement Tailwind */
	.accf-card {
		@apply bg-white border rounded-lg shadow-sm p-6;
		border-color: #eae2d9;
	}

	.accf-button-primary {
		@apply font-semibold px-6 py-2 rounded-lg hover:bg-opacity-90 transition-colors duration-200;
		background-color: #c59a6b;
		color: #1e2322;
	}

	.accf-button-secondary {
		@apply font-semibold px-6 py-2 rounded-lg transition-colors duration-200 border;
		background-color: #eae2d9;
		color: #334642;
		border-color: #c59a6b;
	}

	.accf-button-secondary:hover {
		background-color: #c59a6b;
		color: #1e2322;
	}

	.accf-heading {
		@apply tracking-wide;
		font-weight: 700;
		color: #334642;
	}

	.accf-text {
		color: #1e2322;
	}

	.accf-input {
		@apply bg-white border rounded-lg px-4 py-2;
		border-color: #eae2d9;
	}

	.accf-input:focus {
		border-color: #c59a6b;
		ring-color: #c59a6b;
		ring-opacity: 0.2;
	}
</style>