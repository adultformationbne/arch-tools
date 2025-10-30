<script>
	import { page } from '$app/stores';
	import {
		LayoutDashboard,
		BookOpen,
		FileText,
		Users,
		Calendar,
		Settings,
		GraduationCap,
		ArrowLeft,
		MapPin,
		PenSquare
	} from 'lucide-svelte';

	let { courseSlug, onSettingsClick } = $props();

	// Navigation items for course admin
	const navItems = [
		{
			label: 'Dashboard',
			href: `/courses/${courseSlug}/admin`,
			icon: LayoutDashboard,
			description: 'Cohort overview'
		},
		{
			label: 'Modules',
			href: `/courses/${courseSlug}/admin/modules`,
			icon: BookOpen,
			description: 'Manage modules'
		},
		{
			label: 'Sessions',
			href: `/courses/${courseSlug}/admin/sessions`,
			icon: FileText,
			description: 'Edit session content'
		},
		{
			label: 'Reflections',
			href: `/courses/${courseSlug}/admin/reflections`,
			icon: PenSquare,
			description: 'Review submissions'
		},
		{
			label: 'Participants',
			href: `/courses/${courseSlug}/admin/users`,
			icon: Users,
			description: 'Manage students'
		},
		{
			label: 'Enrollments',
			href: `/courses/${courseSlug}/admin/enrollments`,
			icon: GraduationCap,
			description: 'Enrollment management'
		},
		{
			label: 'Attendance',
			href: `/courses/${courseSlug}/admin/attendance`,
			icon: Calendar,
			description: 'Track attendance'
		},
		{
			label: 'Hubs',
			href: `/courses/${courseSlug}/admin/hubs`,
			icon: MapPin,
			description: 'Hub management'
		}
	];

	// Check if a nav item is active
	function isActive(href) {
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}
</script>

<aside class="course-admin-sidebar">
	<nav class="nav-container">
		<div class="nav-section">
			<h3 class="nav-section-title">Course Management</h3>
			<ul class="nav-list">
				{#each navItems as item}
					<li>
						<a
							href={item.href}
							class="nav-item"
							class:active={isActive(item.href)}
							title={item.description}
						>
							<item.icon size={20} class="nav-icon" />
							<span class="nav-label">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</nav>

	<!-- Footer Actions -->
	<div class="sidebar-footer">
		<a href="/(internal)/courses" class="footer-link">
			<ArrowLeft size={18} />
			<span>Back to Courses</span>
		</a>

		{#if onSettingsClick}
			<button onclick={onSettingsClick} class="footer-link" type="button">
				<Settings size={18} />
				<span>Course Settings</span>
			</button>
		{/if}
	</div>
</aside>

<style>
	.course-admin-sidebar {
		width: 260px;
		min-height: 100vh;
		background: rgba(0, 0, 0, 0.2);
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		position: sticky;
		top: 0;
		left: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.nav-container {
		padding: 24px 0;
		flex: 1;
	}

	.nav-section {
		margin-bottom: 32px;
	}

	.nav-section-title {
		padding: 0 20px;
		margin: 0 0 12px 0;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgba(255, 255, 255, 0.5);
	}

	.nav-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		margin: 2px 12px;
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.8);
		text-decoration: none;
		font-size: 0.9375rem;
		font-weight: 500;
		transition: all 0.15s ease;
		cursor: pointer;
	}

	.nav-item:hover {
		background: rgba(255, 255, 255, 0.1);
		color: white;
	}

	.nav-item.active {
		background: var(--course-accent-light);
		color: var(--course-accent-darkest);
		font-weight: 600;
	}

	.nav-item.active :global(.nav-icon) {
		color: var(--course-accent-darkest);
	}

	:global(.nav-icon) {
		flex-shrink: 0;
		color: inherit;
	}

	.nav-label {
		flex: 1;
	}

	/* Scrollbar styling */
	.course-admin-sidebar::-webkit-scrollbar {
		width: 6px;
	}

	.course-admin-sidebar::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.2);
	}

	.course-admin-sidebar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.course-admin-sidebar::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	/* Footer */
	.sidebar-footer {
		padding: 16px 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.footer-link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 6px;
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.15s ease;
		cursor: pointer;
		background: transparent;
		border: none;
		width: 100%;
		text-align: left;
		font-family: inherit;
	}

	.footer-link:hover {
		background: rgba(255, 255, 255, 0.08);
		color: white;
	}
</style>
