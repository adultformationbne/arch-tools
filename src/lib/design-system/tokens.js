// Design system tokens for consistent styling across the application

export const colors = {
	// Primary brand colors
	primary: {
		50: '#eff6ff',
		100: '#dbeafe',
		500: '#3b82f6',
		600: '#2563eb',
		700: '#1d4ed8',
		900: '#1e3a8a'
	},

	// Semantic colors
	success: {
		50: '#f0fdf4',
		100: '#dcfce7',
		600: '#16a34a',
		700: '#15803d'
	},

	danger: {
		50: '#fef2f2',
		100: '#fee2e2',
		600: '#dc2626',
		700: '#b91c1c'
	},

	warning: {
		50: '#fffbeb',
		100: '#fef3c7',
		600: '#d97706',
		700: '#b45309'
	},

	// Neutral grays
	gray: {
		50: '#f9fafb',
		100: '#f3f4f6',
		200: '#e5e7eb',
		300: '#d1d5db',
		400: '#9ca3af',
		500: '#6b7280',
		600: '#4b5563',
		700: '#374151',
		800: '#1f2937',
		900: '#111827'
	}
};

// Tag color system for content blocks
export const tagColors = {
	// Headers
	h1: 'bg-red-100 text-red-700 border-red-200',
	h2: 'bg-orange-100 text-orange-700 border-orange-200',
	h3: 'bg-amber-100 text-amber-700 border-amber-200',
	chapter: 'bg-indigo-100 text-indigo-700 border-indigo-200',
	title: 'bg-purple-100 text-purple-700 border-purple-200',

	// Content types
	paragraph: 'bg-gray-100 text-gray-700 border-gray-200',
	quote: 'bg-blue-100 text-blue-700 border-blue-200',
	scripture: 'bg-teal-100 text-teal-700 border-teal-200',
	prayer: 'bg-green-100 text-green-700 border-green-200',
	callout: 'bg-sky-100 text-sky-700 border-sky-200',

	// Lists
	ul: 'bg-lime-100 text-lime-700 border-lime-200',
	ol: 'bg-emerald-100 text-emerald-700 border-emerald-200',

	// Meta
	author: 'bg-pink-100 text-pink-700 border-pink-200',
	date: 'bg-slate-100 text-slate-700 border-slate-200',
	note: 'bg-yellow-100 text-yellow-700 border-yellow-200',

	// Default fallback
	default: 'bg-violet-100 text-violet-700 border-violet-200'
};

export const spacing = {
	xs: '0.5rem', // 8px
	sm: '0.75rem', // 12px
	md: '1rem', // 16px
	lg: '1.5rem', // 24px
	xl: '2rem', // 32px
	'2xl': '3rem', // 48px
	'3xl': '4rem' // 64px
};

export const borderRadius = {
	sm: '0.375rem', // 6px
	md: '0.5rem', // 8px
	lg: '0.75rem', // 12px
	xl: '1rem' // 16px
};

export const shadows = {
	sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
	md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
	lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
	xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
};

// Helper function to get tag colors
export function getTagColorClass(tag) {
	return tagColors[tag] || tagColors.default;
}
