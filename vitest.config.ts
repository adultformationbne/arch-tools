import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		setupFiles: ['tests/setup.ts']
	}
});
