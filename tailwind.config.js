export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'content-bg': '#fafafa',
				'sidebar-bg': '#f8f9fa',
				'card-border': '#e5e7eb',
				// ACCF color system
				'accf': {
					'darkest': '#1e2322',
					'dark': '#334642',
					'accent': '#c59a6b',
					'light': '#eae2d9',
					'lightest': '#ffffff'
				}
			},
			fontFamily: {
				'bebas': ['Bebas Neue', 'cursive']
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
