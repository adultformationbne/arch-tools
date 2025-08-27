export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'content-bg': '#fafafa',
				'sidebar-bg': '#f8f9fa',
				'card-border': '#e5e7eb'
			},
			typography: {
				DEFAULT: {
					css: {
						maxWidth: 'none'
					}
				}
			}
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
