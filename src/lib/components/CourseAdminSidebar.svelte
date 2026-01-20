<script>
import { page } from '$app/stores';
import { preloadData } from '$app/navigation';
import {
    LayoutDashboard,
    BookOpen,
    FileText,
    Users,
    Calendar,
    Settings,
    ArrowLeft,
    MapPin,
    PenSquare,
    Plus,
    ChevronDown,
    ChevronUp,
    Mail
} from '$lib/icons';

let {
    courseSlug,
    onSettingsClick,
    onNewCohort,
    cohorts = [],
    selectedCohortId = null,
    onSelectCohort,
    modules = [],
    enrollmentRole = null,
    isCourseAdmin = false,
    courseBranding = {}
} = $props();

// Sidebar expansion state - defaults to collapsed (icons only)
let isExpanded = $state(false);

function handleMouseEnterSidebar() {
    isExpanded = true;
}

function handleMouseLeaveSidebar() {
    isExpanded = false;
}

// Cohort list expansion state
let showAllCohorts = $state(false);
const INITIAL_COHORT_LIMIT = 5;

// Nav visibility helpers
const moduleSet = $derived(new Set(modules));

function hasModule(module) {
    return moduleSet.has(module);
}

const canManageAllCourses = $derived(hasModule('platform.admin') || hasModule('courses.admin'));
// Course managers can fully manage courses they're enrolled in as admin
const canManageCourse = $derived(isCourseAdmin || hasModule('courses.manager'));
const canViewHubs = $derived(canManageCourse);
const canManageAttendance = $derived(canManageCourse);

// Determine which cohorts to display
const displayedCohorts = $derived(
    showAllCohorts ? cohorts : cohorts.slice(0, INITIAL_COHORT_LIMIT)
);
const hasMoreCohorts = $derived(cohorts.length > INITIAL_COHORT_LIMIT);

function toggleShowAllCohorts() {
    showAllCohorts = !showAllCohorts;
}

// Helper to append cohort param to URLs
function withCohort(basePath) {
    if (selectedCohortId) {
        return `${basePath}?cohort=${selectedCohortId}`;
    }
    return basePath;
}

const navItems = $derived([
    {
        label: 'Dashboard',
        href: withCohort(`/admin/courses/${courseSlug}`),
        icon: LayoutDashboard,
        description: 'Cohort overview',
        visible: true
    },
    {
        label: 'Modules',
        href: withCohort(`/admin/courses/${courseSlug}/modules`),
        icon: BookOpen,
        description: 'Manage modules',
        visible: canManageCourse
    },
    {
        label: 'Sessions',
        href: withCohort(`/admin/courses/${courseSlug}/sessions`),
        icon: FileText,
        description: 'Edit session content',
        visible: canManageCourse
    },
    {
        label: 'Reflections',
        href: withCohort(`/admin/courses/${courseSlug}/reflections`),
        icon: PenSquare,
        description: 'Review submissions',
        visible: canManageCourse
    },
    {
        label: 'Emails',
        href: `/admin/courses/${courseSlug}/emails`,
        icon: Mail,
        description: 'Email templates',
        visible: canManageCourse
    },
    {
        label: 'Participants',
        href: withCohort(`/admin/courses/${courseSlug}/participants`),
        icon: Users,
        description: 'All course participants',
        visible: canManageCourse
    },
    {
        label: 'Hubs',
        href: withCohort(`/admin/courses/${courseSlug}/hubs`),
        icon: MapPin,
        description: 'Hub management',
        visible: canViewHubs
    },
    {
        label: 'Attendance',
        href: withCohort(`/admin/courses/${courseSlug}/attendance`),
        icon: Calendar,
        description: 'Track attendance',
        visible: canManageAttendance
    }
].filter((item) => item.visible));

function isActive(href) {
    // Extract just the pathname from href (strip query params)
    const hrefPath = href.split('?')[0];
    // Only match exact pathname (not prefixes)
    return $page.url.pathname === hrefPath;
}

// Preload data on hover for instant navigation
function handleMouseEnter(href) {
    preloadData(href);
}
</script>

<aside
	class="course-admin-sidebar"
	class:expanded={isExpanded}
	onmouseenter={handleMouseEnterSidebar}
	onmouseleave={handleMouseLeaveSidebar}
>
	<!-- Logo Section - space always reserved, content only visible when expanded -->
	{#if courseBranding?.logoUrl && courseBranding?.showLogo}
		<div class="logo-section">
			{#if isExpanded}
				<img src={courseBranding.logoUrl} alt="Course logo" class="course-logo" />
			{/if}
		</div>
	{/if}

	<nav class="nav-container">
		<div class="nav-section">
			<h3 class="nav-section-title">
				<span class="section-title-text">Course Management</span>
			</h3>
			<ul class="nav-list">
				{#each navItems as item}
					<li>
						<a
							href={item.href}
							class="nav-item"
							class:active={isActive(item.href)}
							title={isExpanded ? '' : item.label}
							onmouseenter={() => handleMouseEnter(item.href)}
							data-sveltekit-preload-data="tap"
						>
							<item.icon size={16} class="nav-icon" />
							<span class="nav-label">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>

		{#if (cohorts.length > 0 || onNewCohort) && isExpanded}
			<div class="nav-section cohorts-section">
				<div class="section-header">
					<h3 class="nav-section-title">
						<span class="section-title-text">Active Cohorts</span>
					</h3>
					{#if onNewCohort}
						<button onclick={onNewCohort} class="btn-new-cohort-small" title="Create New Cohort">
							<Plus size={14} />
						</button>
					{/if}
				</div>
				<ul class="nav-list cohort-list">
					{#each displayedCohorts as cohort}
						<li>
							<button
								onclick={() => onSelectCohort?.(cohort.id)}
								class="nav-item cohort-item"
								class:active={selectedCohortId === cohort.id}
								title="{cohort.name}"
							>
								<div class="cohort-info">
									<span class="cohort-name">{cohort.name}</span>
									<span class="cohort-session">Session {cohort.current_session}</span>
								</div>
							</button>
						</li>
					{/each}
				</ul>

				{#if hasMoreCohorts}
					<button onclick={toggleShowAllCohorts} class="btn-show-more">
						{#if showAllCohorts}
							<ChevronUp size={12} />
							<span>Show Less</span>
						{:else}
							<ChevronDown size={12} />
							<span>+{cohorts.length - INITIAL_COHORT_LIMIT} More</span>
						{/if}
					</button>
				{/if}
			</div>
		{/if}
	</nav>

	<!-- Footer Actions -->
	<div class="sidebar-footer">
		<a
			href="/admin/courses?from=course"
			class="footer-link"
			title={isExpanded ? '' : 'Back to Courses'}
			data-sveltekit-preload-data="tap"
		>
			<ArrowLeft size={14} />
			<span class="footer-label">Back to Courses</span>
		</a>

		{#if onSettingsClick}
			<button
				onclick={onSettingsClick}
				class="footer-link"
				type="button"
				title={isExpanded ? '' : 'Course Settings'}
			>
				<Settings size={14} />
				<span class="footer-label">Settings</span>
			</button>
		{/if}
	</div>
</aside>

<style>
	.course-admin-sidebar {
		width: 52px;
		height: 100vh;
		background: rgba(0, 0, 0, 0.2);
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		position: sticky;
		top: 0;
		left: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 40;
	}

	.course-admin-sidebar.expanded {
		width: 200px;
	}

	.logo-section {
		flex-shrink: 0;
		height: 48px;
		padding: 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
	}

	.course-logo {
		max-width: 100px;
		max-height: 32px;
		width: auto;
		height: auto;
		object-fit: contain;
		animation: fadeIn 0.15s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}

	.nav-container {
		padding: 8px 0;
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}

	/* Scrollbar styling for nav container */
	.nav-container::-webkit-scrollbar {
		width: 4px;
	}

	.nav-container::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.2);
	}

	.nav-container::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.nav-container::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.nav-section {
		margin-bottom: 16px;
	}

	.nav-section-title {
		padding: 0 12px;
		margin: 0 0 4px 0;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgba(255, 255, 255, 0.5);
		height: 14px;
		overflow: hidden;
	}

	.section-title-text {
		display: block;
		opacity: 0;
		transform: translateX(-8px);
		transition: opacity 0.2s ease, transform 0.2s ease;
		white-space: nowrap;
	}

	.course-admin-sidebar.expanded .section-title-text {
		opacity: 1;
		transform: translateX(0);
	}

	.nav-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		margin: 1px 6px;
		border-radius: 6px;
		color: rgba(255, 255, 255, 0.8);
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 500;
		transition: all 0.15s ease;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
	}

	.course-admin-sidebar.expanded .nav-item {
		padding: 8px 12px;
		margin: 1px 8px;
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
		opacity: 0;
		transform: translateX(-8px);
		transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
	}

	.course-admin-sidebar.expanded .nav-label {
		opacity: 1;
		transform: translateX(0);
	}

	/* Footer - stays fixed at bottom */
	.sidebar-footer {
		flex-shrink: 0;
		padding: 8px 6px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.course-admin-sidebar.expanded .sidebar-footer {
		padding: 10px 8px;
		gap: 4px;
	}

	.footer-link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 6px;
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 500;
		transition: all 0.15s ease;
		cursor: pointer;
		background: transparent;
		border: none;
		width: 100%;
		text-align: left;
		font-family: inherit;
		overflow: hidden;
	}

	.course-admin-sidebar.expanded .footer-link {
		justify-content: flex-start;
	}

	.footer-link:hover {
		background: rgba(255, 255, 255, 0.08);
		color: white;
	}

	.footer-label {
		opacity: 0;
		transform: translateX(-8px);
		transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
		white-space: nowrap;
	}

	.course-admin-sidebar.expanded .footer-label {
		opacity: 1;
		transform: translateX(0);
	}

	/* Cohort Section - only shows when expanded */
	.cohorts-section {
		animation: fadeSlideIn 0.2s ease forwards;
	}

	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 12px;
		margin-bottom: 6px;
	}

	.section-header .nav-section-title {
		padding: 0;
		margin: 0;
	}

	.btn-new-cohort-small {
		padding: 4px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-new-cohort-small:hover {
		background: var(--course-accent-light);
		color: var(--course-accent-darkest);
		border-color: var(--course-accent-light);
	}

	.cohort-list {
		/* No max-height since we're handling expansion with show more/less */
	}

	/* Scrollbar styling for cohort list */
	.cohort-list::-webkit-scrollbar {
		width: 4px;
	}

	.cohort-list::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.1);
	}

	.cohort-list::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
	}

	.cohort-list::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.cohort-item {
		display: block;
		width: 100%;
		text-align: left;
		border: none;
		background: transparent;
		font-family: inherit;
		min-width: 0;
	}

	.cohort-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		width: 100%;
		min-width: 0;
	}

	.cohort-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: inherit;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cohort-session {
		font-size: 0.6875rem;
		color: rgba(255, 255, 255, 0.6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cohort-item.active .cohort-session {
		color: var(--course-accent-dark);
	}

	/* Show More/Less Button */
	.btn-show-more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: calc(100% - 16px);
		margin: 6px 8px 0 8px;
		padding: 6px 8px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: inherit;
	}

	.btn-show-more:hover {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.9);
		border-color: rgba(255, 255, 255, 0.2);
	}
</style>
