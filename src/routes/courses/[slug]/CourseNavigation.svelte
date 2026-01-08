<script>
	import { User, Home, BookOpen, MessageSquare, Menu, X } from 'lucide-svelte';
	import { page } from '$app/stores';

	let { courseSlug, userName = 'User', userRole = 'student', courseBranding = {} } = $props();

	let mobileMenuOpen = $state(false);

	const toggleMobileMenu = () => {
		mobileMenuOpen = !mobileMenuOpen;
	};

	const closeMobileMenu = () => {
		mobileMenuOpen = false;
	};

	// Get current page from URL
	const currentPage = $derived(() => {
		const path = $page.url.pathname;
		if (path.endsWith('/materials')) return 'materials';
		if (path.endsWith('/reflections')) return 'reflections';
		if (path.endsWith('/profile')) return 'profile';
		return 'dashboard';
	});

	const logoUrl = $derived(courseBranding?.logoUrl || '/accf-logo.png');
	const showLogo = $derived(courseBranding?.showLogo !== false);
</script>

<!-- Ultra Glassy Header -->
<nav class="glass-nav backdrop-blur-xl border-b border-white/20 relative overflow-hidden">
	<!-- Clean Background -->
	<div class="absolute inset-0" style="background-color: rgba(52, 70, 66, 0.8);"></div>

	<div class="relative flex items-center justify-between px-4 sm:px-6 lg:px-16 py-1.5">
		<!-- Simple Logo Section -->
		<div class="flex items-center">
			{#if showLogo}
				<img src={logoUrl} alt="Course Logo" class="h-7 sm:h-8 w-auto drop-shadow-lg" />
			{/if}
		</div>

		<!-- Desktop Navigation Pills -->
		<div class="hidden lg:flex items-center space-x-2">
			<!-- Student Navigation -->
			<a
				href="/courses/{courseSlug}"
				class="glass-link group"
				class:active-glass={currentPage() === 'dashboard'}
			>
				<Home class="transition-transform group-hover:scale-110" size="14" />
				<span>Dashboard</span>
				<div class="glass-shine"></div>
			</a>
			<a
				href="/courses/{courseSlug}/materials"
				class="glass-link group"
				class:active-glass={currentPage() === 'materials'}
			>
				<BookOpen class="transition-transform group-hover:scale-110" size="14" />
				<span>Materials</span>
				<div class="glass-shine"></div>
			</a>
			<a
				href="/courses/{courseSlug}/reflections"
				class="glass-link group"
				class:active-glass={currentPage() === 'reflections'}
			>
				<MessageSquare class="transition-transform group-hover:scale-110" size="14" />
				<span>Reflections</span>
				<div class="glass-shine"></div>
			</a>
		</div>

		<!-- Mobile Menu Button -->
		<div class="lg:hidden flex items-center gap-2">
			<button
				onclick={toggleMobileMenu}
				class="glass-mobile-btn flex items-center justify-center w-8 h-8 rounded-full"
				aria-label="Toggle menu"
			>
				{#if mobileMenuOpen}
					<X size="16" class="text-white/90" />
				{:else}
					<Menu size="16" class="text-white/90" />
				{/if}
			</button>
			<a
				href="/courses/{courseSlug}/profile"
				class="flex items-center justify-center w-8 h-8 glass-avatar rounded-full"
				class:profile-active={currentPage() === 'profile'}
			>
				<User size="16" class="text-white/90" />
			</a>
		</div>

		<!-- Desktop User Profile -->
		<div class="hidden lg:flex items-center">
			<a
				href="/courses/{courseSlug}/profile"
				class="flex items-center gap-1.5 px-3 py-1 glass-profile rounded-full transition-all cursor-pointer"
				class:profile-active={currentPage() === 'profile'}
			>
				<span class="text-white/90 font-medium text-xs">Hi, {userName}</span>
				<User size="14" class="text-white/90" />
			</a>
		</div>
	</div>
</nav>

<!-- Mobile Menu Overlay -->
{#if mobileMenuOpen}
	<div class="mobile-menu-overlay lg:hidden fixed top-[44px] left-0 right-0 z-50">
		<div class="mobile-menu-content">
			<!-- Mobile Navigation Links -->
			<div class="space-y-1 p-4">
				<!-- Student Mobile Navigation -->
				<a
					href="/courses/{courseSlug}"
					class="mobile-link"
					class:mobile-active={currentPage() === 'dashboard'}
					onclick={closeMobileMenu}
				>
					<Home size="20" />
					<span>Dashboard</span>
				</a>
				<a
					href="/courses/{courseSlug}/materials"
					class="mobile-link"
					class:mobile-active={currentPage() === 'materials'}
					onclick={closeMobileMenu}
				>
					<BookOpen size="20" />
					<span>Materials</span>
				</a>
				<a
					href="/courses/{courseSlug}/reflections"
					class="mobile-link"
					class:mobile-active={currentPage() === 'reflections'}
					onclick={closeMobileMenu}
				>
					<MessageSquare size="20" />
					<span>Reflections</span>
				</a>
			</div>

			<!-- Mobile User Section -->
			<div class="border-t border-white/20 p-4 space-y-3">
				<div class="flex items-center gap-3 px-4 py-2">
					<div class="w-8 h-8 glass-avatar rounded-full flex items-center justify-center">
						<User size="16" class="text-white/90" />
					</div>
					<span class="text-white/90 font-semibold text-sm">Hi, {userName}</span>
				</div>
				<a
					href="/courses/{courseSlug}/profile"
					class="mobile-logout-btn w-full flex items-center gap-3 px-4 py-3 rounded-lg"
					onclick={closeMobileMenu}
				>
					<User size="18" class="text-white/90" />
					<span class="text-white/90 font-semibold text-sm">My Profile</span>
				</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.glass-nav {
		background: rgba(52, 70, 66, 0.3);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
	}

	.glass-link {
		display: flex;
		align-items: center;
		padding: 0.375rem 0.875rem;
		border-radius: 2rem;
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: white;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.75rem;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
		gap: 0.375rem;
	}

	.glass-link:hover {
		background: rgba(255, 255, 255, 0.15);
		transform: translateY(-2px);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.glass-link.active-glass {
		background: rgba(197, 154, 107, 0.3);
		border-color: rgba(197, 154, 107, 0.5);
		color: #c59a6b;
		box-shadow: 0 0 20px rgba(197, 154, 107, 0.3);
	}

	.glass-shine {
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transition: left 0.5s;
	}

	.glass-link:hover .glass-shine {
		left: 100%;
	}

	.glass-profile {
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.glass-profile:hover {
		background: rgba(255, 255, 255, 0.15);
		transform: translateY(-2px);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.glass-profile.profile-active {
		background: rgba(197, 154, 107, 0.3);
		border-color: rgba(197, 154, 107, 0.5);
		color: #c59a6b;
		box-shadow: 0 0 20px rgba(197, 154, 107, 0.3);
	}

	.glass-avatar {
		background: rgba(255, 255, 255, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	/* Mobile Styles */
	.glass-mobile-btn {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.glass-mobile-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.mobile-menu-overlay {
		background: rgba(52, 70, 66, 0.95);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
	}

	.mobile-menu-content {
		background: transparent;
	}

	.mobile-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: white;
		text-decoration: none;
		font-weight: 500;
		transition: all 0.2s ease;
		margin-bottom: 0.25rem;
	}

	.mobile-link:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.mobile-link.mobile-active {
		background: rgba(197, 154, 107, 0.2);
		border-color: rgba(197, 154, 107, 0.4);
		color: #c59a6b;
	}

	.mobile-logout-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.2s ease;
		text-decoration: none;
		display: flex;
	}

	.mobile-logout-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
</style>
