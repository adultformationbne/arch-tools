<script>
import { page } from '$app/stores';
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
    ChevronUp
} from 'lucide-svelte';

let {
    courseSlug,
    onSettingsClick,
    onNewCohort,
    cohorts = [],
    selectedCohortId = null,
    onSelectCohort,
    modules = [],
    enrollmentRole = null,
    isCourseAdmin = false
} = $props();

// Cohort list expansion state
let showAllCohorts = $state(false);
const INITIAL_COHORT_LIMIT = 5;

// Nav visibility helpers
const moduleSet = $derived(new Set(modules));

function hasModule(module) {
    return moduleSet.has(module);
}

const canManageAllCourses = $derived(hasModule('users') || hasModule('courses.admin'));
const canManageParticipants = $derived(isCourseAdmin || hasModule('courses.manager'));
const canViewHubs = $derived(canManageParticipants);
const canManageAttendance = $derived(canManageParticipants);

// Determine which cohorts to display
const displayedCohorts = $derived(
    showAllCohorts ? cohorts : cohorts.slice(0, INITIAL_COHORT_LIMIT)
);
const hasMoreCohorts = $derived(cohorts.length > INITIAL_COHORT_LIMIT);

function toggleShowAllCohorts() {
    showAllCohorts = !showAllCohorts;
}

const navItems = $derived([
    {
        label: 'Dashboard',
        href: `/admin/courses/${courseSlug}`,
        icon: LayoutDashboard,
        description: 'Cohort overview',
        visible: true
    },
    {
        label: 'Modules',
        href: `/admin/courses/${courseSlug}/modules`,
        icon: BookOpen,
        description: 'Manage modules',
        visible: isCourseAdmin
    },
    {
        label: 'Sessions',
        href: `/admin/courses/${courseSlug}/sessions`,
        icon: FileText,
        description: 'Edit session content',
        visible: isCourseAdmin
    },
    {
        label: 'Reflections',
        href: `/admin/courses/${courseSlug}/reflections`,
        icon: PenSquare,
        description: 'Review submissions',
        visible: canManageParticipants || isCourseAdmin
    },
    {
        label: 'Participants',
        href: `/admin/courses/${courseSlug}/participants`,
        icon: Users,
        description: 'All course participants',
        visible: canManageParticipants
    },
    {
        label: 'Hubs',
        href: `/admin/courses/${courseSlug}/hubs`,
        icon: MapPin,
        description: 'Hub management',
        visible: canViewHubs
    },
    {
        label: 'Attendance',
        href: `/admin/courses/${courseSlug}/attendance`,
        icon: Calendar,
        description: 'Track attendance',
        visible: canManageAttendance
    }
].filter((item) => item.visible));

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

		{#if cohorts.length > 0 || onNewCohort}
			<div class="nav-section">
				<div class="section-header">
					<h3 class="nav-section-title">Active Cohorts</h3>
					{#if onNewCohort}
						<button onclick={onNewCohort} class="btn-new-cohort-small" title="Create New Cohort">
							<Plus size={16} />
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
							<ChevronUp size={16} />
							<span>Show Less</span>
						{:else}
							<ChevronDown size={16} />
							<span>Show {cohorts.length - INITIAL_COHORT_LIMIT} More</span>
						{/if}
					</button>
				{/if}
			</div>
		{/if}
	</nav>

	<!-- Footer Actions -->
	<div class="sidebar-footer">
		<a href="/courses" class="footer-link">
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

	/* Cohort Section */
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 20px;
		margin-bottom: 12px;
	}

	.btn-new-cohort-small {
		padding: 6px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
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
	}

	.cohort-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
	}

	.cohort-name {
		font-size: 0.9375rem;
		font-weight: 500;
		color: inherit;
	}

	.cohort-session {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.cohort-item.active .cohort-session {
		color: var(--course-accent-dark);
	}

	/* Show More/Less Button */
	.btn-show-more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: calc(100% - 24px);
		margin: 8px 12px 0 12px;
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.8125rem;
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
