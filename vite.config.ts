import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			'lucide-svelte': path.resolve('./src/lib/icons')
		}
	},
	build: {
		rollupOptions: {
			external: ['jsdom', 'dompurify']
		}
	}
});
