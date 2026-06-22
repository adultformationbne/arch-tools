import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		setupFiles: ['tests/setup.ts'],
		// These are integration tests against a single shared Supabase database, and
		// each file's cleanup() deletes all `test-%` rows. Running files in parallel
		// lets one file wipe another's in-flight data, so force serial execution.
		fileParallelism: false
	}
});
