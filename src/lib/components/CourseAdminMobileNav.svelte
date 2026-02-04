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
	Mail,
	Menu,
	X,
	Link,
	Tag
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

// Mobile menu state
let mobileMenuOpen = $state(false);

function toggleMobileMenu() {
	mobileMenuOpen = !mobileMenuOpen;
}

function closeMobileMenu() {
	mobileMenuOpen = false;
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
		label: 'Enrollment Links',
		href: `/admin/courses/${courseSlug}/enrollment-links`,
		icon: Link,
		description: 'Public sign-up links',
		visible: canManageCourse
	},
	{
		label: 'Discounts',
		href: `/admin/courses/${courseSlug}/discounts`,
		icon: Tag,
		description: 'Discount codes',
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
	const hrefPath = href.split('?')[0];
	return $page.url.pathname === hrefPath;
}

function handleMouseEnter(href) {
	preloadData(href);
}

function handleNavClick() {
	closeMobileMenu();
}

function handleCohortSelect(cohortId) {
	onSelectCohort?.(cohortId);
	closeMobileMenu();
}

function handleSettingsClickInternal() {
	onSettingsClick?.();
	closeMobileMenu();
}

function handleNewCohortClick() {
	onNewCohort?.();
	closeMobileMenu();
}

// Get current page title
const currentPageTitle = $derived(() => {
	const path = $page.url.pathname;
	const item = navItems.find(i => isActive(i.href));
	return item?.label || 'Admin';
});

// Get selected cohort name
const selectedCohortName = $derived(() => {
	const cohort = cohorts.find(c => c.id === selectedCohortId);
	return cohort?.name || null;
});
</script>

<!-- Mobile Header - Only visible on mobile -->
<header class="mobile-admin-header lg:hidden">
	<div class="flex items-center justify-between px-3 py-2">
		<!-- Left: Menu button + Logo/Title -->
		<div class="flex items-center gap-2">
			<button
				onclick={toggleMobileMenu}
				class="mobile-menu-btn"
				aria-label="Toggle menu"
			>
				{#if mobileMenuOpen}
					<X size="20" class="text-white" />
				{:else}
					<Menu size="20" class="text-white" />
				{/if}
			</button>

			<div class="flex items-center gap-2 min-w-0">
				{#if courseBranding?.logoUrl && courseBranding?.showLogo}
					<img src={courseBranding.logoUrl} alt="Course logo" class="h-6 w-auto flex-shrink-0" />
				{/if}
				<div class="flex flex-col min-w-0">
					<span class="text-white font-semibold text-sm truncate">{currentPageTitle()}</span>
					{#if selectedCohortName()}
						<span class="text-white/60 text-xs truncate">{selectedCohortName()}</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Right: Quick actions -->
		<div class="flex items-center gap-1">
			{#if onSettingsClick}
				<button
					onclick={handleSettingsClickInternal}
					class="mobile-action-btn"
					aria-label="Course Settings"
				>
					<Settings size="18" class="text-white/80" />
				</button>
			{/if}
			<a
				href="/admin/courses?from=course"
				class="mobile-action-btn"
				aria-label="Back to Courses"
			>
				<ArrowLeft size="18" class="text-white/80" />
			</a>
		</div>
	</div>
</header>

<!-- Mobile Menu Overlay -->
{#if mobileMenuOpen}
	<!-- Backdrop -->
	<button
		class="mobile-menu-backdrop lg:hidden"
		onclick={closeMobileMenu}
		aria-label="Close menu"
	></button>

	<!-- Menu Panel -->
	<div class="mobile-menu-panel lg:hidden">
		<!-- Navigation Section -->
		<div class="nav-section">
			<h3 class="section-title">Course Management</h3>
			<nav class="nav-list">
				{#each navItems as item}
					<a
						href={item.href}
						class="nav-item"
						class:active={isActive(item.href)}
						onclick={handleNavClick}
						onmouseenter={() => handleMouseEnter(item.href)}
					>
						<item.icon size={18} class="nav-icon flex-shrink-0" />
						<div class="nav-text min-w-0">
							<span class="nav-label">{item.label}</span>
							<span class="nav-description">{item.description}</span>
						</div>
					</a>
				{/each}
			</nav>
		</div>

		<!-- Cohorts Section -->
		{#if cohorts.length > 0 || onNewCohort}
			<div class="nav-section cohorts-section">
				<div class="section-header">
					<h3 class="section-title">Active Cohorts</h3>
					{#if onNewCohort}
						<button onclick={handleNewCohortClick} class="btn-new-cohort" title="Create New Cohort">
							<Plus size={16} />
						</button>
					{/if}
				</div>

				{#if cohorts.length > 0}
					<div class="cohort-list">
						{#each displayedCohorts as cohort}
							<button
								onclick={() => handleCohortSelect(cohort.id)}
								class="cohort-item"
								class:active={selectedCohortId === cohort.id}
							>
								<span class="cohort-name">{cohort.name}</span>
								<span class="cohort-session">Session {cohort.current_session}</span>
							</button>
						{/each}
					</div>

					{#if hasMoreCohorts}
						<button onclick={toggleShowAllCohorts} class="btn-show-more">
							{#if showAllCohorts}
								<ChevronUp size={14} />
								<span>Show Less</span>
							{:else}
								<ChevronDown size={14} />
								<span>+{cohorts.length - INITIAL_COHORT_LIMIT} More</span>
							{/if}
						</button>
					{/if}
				{:else}
					<p class="text-white/50 text-sm px-4 py-2">No cohorts yet</p>
				{/if}
			</div>
		{/if}

		<!-- Footer Actions -->
		<div class="nav-footer">
			<a
				href="/admin/courses?from=course"
				class="footer-link"
				onclick={closeMobileMenu}
			>
				<ArrowLeft size={16} />
				<span>Back to Courses</span>
			</a>
			{#if onSettingsClick}
				<button
					onclick={handleSettingsClickInternal}
					class="footer-link"
					type="button"
				>
					<Settings size={16} />
					<span>Course Settings</span>
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.mobile-admin-header {
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		position: sticky;
		top: 0;
		z-index: 40;
	}

	.mobile-menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.2s ease;
	}

	.mobile-menu-btn:hover,
	.mobile-menu-btn:active {
		background: rgba(255, 255, 255, 0.15);
	}

	.mobile-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: transparent;
		transition: all 0.2s ease;
	}

	.mobile-action-btn:hover,
	.mobile-action-btn:active {
		background: rgba(255, 255, 255, 0.1);
	}

	.mobile-menu-backdrop {
		position: fixed;
		inset: 0;
		top: 52px;
		background: rgba(0, 0, 0, 0.6);
		z-index: 45;
		animation: fadeIn 0.2s ease;
		border: none;
		cursor: default;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.mobile-menu-panel {
		position: fixed;
		top: 52px;
		left: 0;
		bottom: 0;
		width: 85%;
		max-width: 320px;
		background: var(--course-accent-dark, #334642);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		z-index: 50;
		animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
	}

	@keyframes slideIn {
		from { transform: translateX(-100%); }
		to { transform: translateX(0); }
	}

	.nav-section {
		padding: 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.section-title {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 12px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.section-header .section-title {
		margin-bottom: 0;
	}

	.nav-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.05);
		color: rgba(255, 255, 255, 0.9);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.nav-item:hover,
	.nav-item:active {
		background: rgba(255, 255, 255, 0.1);
	}

	.nav-item.active {
		background: var(--course-accent-light, #c59a6b);
		color: var(--course-accent-darkest, #1a2320);
	}

	.nav-item.active :global(.nav-icon) {
		color: var(--course-accent-darkest, #1a2320);
	}

	:global(.nav-icon) {
		color: inherit;
	}

	.nav-text {
		display: flex;
		flex-direction: column;
	}

	.nav-label {
		font-size: 14px;
		font-weight: 500;
	}

	.nav-description {
		font-size: 11px;
		opacity: 0.6;
	}

	.cohort-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.cohort-item {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 100%;
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid transparent;
		color: rgba(255, 255, 255, 0.9);
		text-align: left;
		transition: all 0.15s ease;
		cursor: pointer;
	}

	.cohort-item:hover,
	.cohort-item:active {
		background: rgba(255, 255, 255, 0.1);
	}

	.cohort-item.active {
		background: rgba(197, 154, 107, 0.2);
		border-color: var(--course-accent-light, #c59a6b);
	}

	.cohort-name {
		font-size: 13px;
		font-weight: 500;
	}

	.cohort-session {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
	}

	.cohort-item.active .cohort-session {
		color: var(--course-accent-light, #c59a6b);
	}

	.btn-new-cohort {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: rgba(255, 255, 255, 0.8);
		transition: all 0.15s ease;
		cursor: pointer;
	}

	.btn-new-cohort:hover,
	.btn-new-cohort:active {
		background: var(--course-accent-light, #c59a6b);
		color: var(--course-accent-darkest, #1a2320);
		border-color: var(--course-accent-light, #c59a6b);
	}

	.btn-show-more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		margin-top: 8px;
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: rgba(255, 255, 255, 0.7);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-show-more:hover,
	.btn-show-more:active {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.9);
	}

	.nav-footer {
		margin-top: auto;
		padding: 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.footer-link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px;
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.15s ease;
		background: transparent;
		border: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
	}

	.footer-link:hover,
	.footer-link:active {
		background: rgba(255, 255, 255, 0.08);
		color: white;
	}
</style>
