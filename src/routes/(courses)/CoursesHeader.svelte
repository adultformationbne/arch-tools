<script>
	import { User, LogOut, Home, BookOpen, MessageSquare, Menu, X, Users, Calendar } from 'lucide-svelte';

	let { currentPage = 'dashboard', userName = 'Sarah', userRole = 'student' } = $props();

	let mobileMenuOpen = $state(false);

	const handleLogout = () => {
		// TODO: Implement actual logout logic
		console.log('Logging out...');
		// For now, redirect to login
		window.location.href = '/login';
	};

	const toggleMobileMenu = () => {
		mobileMenuOpen = !mobileMenuOpen;
	};

	const closeMobileMenu = () => {
		mobileMenuOpen = false;
	};
</script>

<!-- Ultra Glassy Header -->
<nav class="glass-nav backdrop-blur-xl border-b border-white/20 relative overflow-hidden">
	<!-- Clean Background -->
	<div class="absolute inset-0" style="background-color: rgba(52, 70, 66, 0.8);"></div>

	<div class="relative flex items-center justify-between px-4 sm:px-6 lg:px-24 py-3">
		<!-- Simple Logo Section -->
		<div class="flex items-center">
			<img src="/accf-logo.png" alt="ACCF Logo" class="h-9 sm:h-10 w-auto drop-shadow-lg" />
		</div>

		<!-- Desktop Navigation Pills -->
		<div class="hidden lg:flex items-center space-x-4">
			{#if userRole === 'admin'}
				<!-- Admin Navigation -->
				<a
					href="/admin/courses"
					class="glass-link group"
					class:active-glass={currentPage === 'courses'}
				>
					<BookOpen class="transition-transform group-hover:scale-110" size="18" />
					<span>Courses</span>
					<div class="glass-shine"></div>
				</a>
				<a
					href="/admin"
					class="glass-link group"
					class:active-glass={currentPage === 'admin'}
				>
					<Users class="transition-transform group-hover:scale-110" size="18" />
					<span>Cohorts</span>
					<div class="glass-shine"></div>
				</a>
				<a
					href="/admin/modules"
					class="glass-link group"
					class:active-glass={currentPage === 'modules'}
				>
					<BookOpen class="transition-transform group-hover:scale-110" size="18" />
					<span>Modules</span>
					<div class="glass-shine"></div>
				</a>
				<a
					href="/admin/reflections"
					class="glass-link group"
					class:active-glass={currentPage === 'reflections'}
				>
					<MessageSquare class="transition-transform group-hover:scale-110" size="18" />
					<span>Reflections</span>
					<div class="glass-shine"></div>
				</a>
				<a
					href="/admin/attendance"
					class="glass-link group"
					class:active-glass={currentPage === 'attendance'}
				>
					<Calendar class="transition-transform group-hover:scale-110" size="18" />
					<span>Attendance</span>
					<div class="glass-shine"></div>
				</a>
			{:else}
				<!-- Student Navigation -->
				<a
					href="/dashboard"
					class="glass-link group"
					class:active-glass={currentPage === 'dashboard'}
				>
					<Home class="transition-transform group-hover:scale-110" size="18" />
					<span>Dashboard</span>
					<div class="glass-shine"></div>
				</a>
				<a
					href="/materials"
					class="glass-link group"
					class:active-glass={currentPage === 'materials'}
				>
					<BookOpen class="transition-transform group-hover:scale-110" size="18" />
					<span>Materials</span>
					<div class="glass-shine"></div>
				</a>
				<a
					href="/reflections"
					class="glass-link group"
					class:active-glass={currentPage === 'reflections'}
				>
					<MessageSquare class="transition-transform group-hover:scale-110" size="18" />
					<span>Reflections</span>
					<div class="glass-shine"></div>
				</a>
			{/if}
		</div>

		<!-- Mobile Menu Button -->
		<div class="lg:hidden flex items-center gap-3">
			<button
				onclick={toggleMobileMenu}
				class="glass-mobile-btn flex items-center justify-center w-10 h-10 rounded-full"
				aria-label="Toggle menu"
			>
				{#if mobileMenuOpen}
					<X size="18" class="text-white/90" />
				{:else}
					<Menu size="18" class="text-white/90" />
				{/if}
			</button>
			<a
				href="/courses-profile"
				class="flex items-center justify-center w-10 h-10 glass-avatar rounded-full"
				class:profile-active={currentPage === 'profile'}
			>
				<User size="18" class="text-white/90" />
			</a>
		</div>

		<!-- Desktop User Profile -->
		<div class="hidden lg:flex items-center">
			<a
				href="/courses-profile"
				class="flex items-center gap-2 px-4 py-2 glass-profile rounded-full transition-all cursor-pointer"
				class:profile-active={currentPage === 'profile'}
			>
				<span class="text-white/90 font-medium text-sm">Hi, {userName}</span>
				<User size="18" class="text-white/90" />
			</a>
		</div>
	</div>
</nav>

<!-- Mobile Menu Overlay -->
{#if mobileMenuOpen}
	<div class="mobile-menu-overlay lg:hidden fixed top-[73px] left-0 right-0 z-50">
		<div class="mobile-menu-content">
			<!-- Mobile Navigation Links -->
			<div class="space-y-1 p-4">
				{#if userRole === 'admin'}
					<!-- Admin Mobile Navigation -->
					<a
						href="/admin"
						class="mobile-link"
						class:mobile-active={currentPage === 'admin'}
						onclick={closeMobileMenu}
					>
						<Users size="20" />
						<span>Cohorts</span>
					</a>
					<a
						href="/admin/modules"
						class="mobile-link"
						class:mobile-active={currentPage === 'modules'}
						onclick={closeMobileMenu}
					>
						<BookOpen size="20" />
						<span>Modules</span>
					</a>
					<a
						href="/admin/reflections"
						class="mobile-link"
						class:mobile-active={currentPage === 'reflections'}
						onclick={closeMobileMenu}
					>
						<MessageSquare size="20" />
						<span>Reflections</span>
					</a>
					<a
						href="/admin/attendance"
						class="mobile-link"
						class:mobile-active={currentPage === 'attendance'}
						onclick={closeMobileMenu}
					>
						<Calendar size="20" />
						<span>Attendance</span>
					</a>
				{:else}
					<!-- Student Mobile Navigation -->
					<a
						href="/dashboard"
						class="mobile-link"
						class:mobile-active={currentPage === 'dashboard'}
						onclick={closeMobileMenu}
					>
						<Home size="20" />
						<span>Dashboard</span>
					</a>
					<a
						href="/materials"
						class="mobile-link"
						class:mobile-active={currentPage === 'materials'}
						onclick={closeMobileMenu}
					>
						<BookOpen size="20" />
						<span>Materials</span>
					</a>
					<a
						href="/reflections"
						class="mobile-link"
						class:mobile-active={currentPage === 'reflections'}
						onclick={closeMobileMenu}
					>
						<MessageSquare size="20" />
						<span>Reflections</span>
					</a>
				{/if}
			</div>

			<!-- Mobile User Section -->
			<div class="border-t border-white/20 p-4 space-y-3">
				<div class="flex items-center gap-3 px-4 py-2">
					<div class="w-8 h-8 glass-avatar rounded-full flex items-center justify-center">
						<User size="16" class="text-white/90" />
					</div>
					<span class="text-white/90 font-semibold text-sm">Hi, {userName}</span>
				</div>
				<button
					onclick={handleLogout}
					class="mobile-logout-btn w-full flex items-center gap-3 px-4 py-3 rounded-lg"
				>
					<LogOut size="18" class="text-white/90" />
					<span class="text-white/90 font-semibold text-sm">Log out</span>
				</button>
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
		space-x: 0.5rem;
		padding: 0.5rem 1.25rem;
		border-radius: 2rem;
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: white;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.875rem;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
		gap: 0.5rem;
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
	}

	.mobile-logout-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

</style>