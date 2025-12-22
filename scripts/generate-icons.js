#!/usr/bin/env node
/**
 * Icon Generator Script
 *
 * Scans the codebase for lucide-svelte imports and generates local icon wrappers.
 * This removes the dependency on lucide-svelte while keeping the same import syntax.
 *
 * Usage: node scripts/generate-icons.js
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'src/lib/icons');
const SRC_DIR = join(ROOT, 'src');

// Recursively find all .svelte and .ts files
function findFiles(dir, extensions = ['.svelte', '.ts']) {
	const files = [];
	const entries = readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
			files.push(...findFiles(fullPath, extensions));
		} else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
			files.push(fullPath);
		}
	}
	return files;
}

// Extract icon names from a file's content
function extractIconsFromFile(content) {
	const icons = new Set();
	const aliases = [];

	// Match import blocks from lucide-svelte (handles multiline)
	const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-svelte['"]/g;
	let match;

	while ((match = importRegex.exec(content)) !== null) {
		const importBlock = match[1];

		// Split by comma and process each import
		const parts = importBlock.split(',');
		for (const part of parts) {
			const trimmed = part.trim();
			if (!trimmed) continue;

			// Check for aliased import: "Settings as SettingsIcon"
			const aliasMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/);
			if (aliasMatch) {
				icons.add(aliasMatch[1]); // Add original icon
				aliases.push({ original: aliasMatch[1], alias: aliasMatch[2] });
			} else if (/^[A-Z][a-zA-Z0-9]*$/.test(trimmed)) {
				icons.add(trimmed);
			}
		}
	}

	return { icons: Array.from(icons), aliases };
}

// Extract all icon names from the codebase
function getUsedIcons() {
	const allIcons = new Set();
	const allAliases = [];

	const files = findFiles(SRC_DIR);
	console.log(`Scanning ${files.length} files...`);

	for (const file of files) {
		try {
			const content = readFileSync(file, 'utf-8');
			const { icons, aliases } = extractIconsFromFile(content);
			icons.forEach(icon => allIcons.add(icon));
			allAliases.push(...aliases);
		} catch (e) {
			// Skip files that can't be read
		}
	}

	return {
		icons: Array.from(allIcons).sort(),
		aliases: allAliases
	};
}

// Generate a wrapper component for an icon
function generateIconWrapper(iconName) {
	return `<script>
	import Icon from './Icon.svelte';
	let { ...props } = $props();
</script>

<Icon name="${iconName}" {...props} />
`;
}

// Generate the index.js that exports everything
function generateIndex(icons, aliases) {
	const exports = icons.map(name => `export { default as ${name} } from './${name}.svelte';`);

	// Add aliased exports
	for (const { original, alias } of aliases) {
		if (!exports.some(e => e.includes(`as ${alias}`))) {
			exports.push(`export { default as ${alias} } from './${original}.svelte';`);
		}
	}

	// Also export the base Icon component for direct use
	exports.unshift("export { default as Icon } from './Icon.svelte';");

	return exports.join('\n') + '\n';
}

// Main
function main() {
	console.log('Scanning codebase for lucide icons...');

	const { icons, aliases } = getUsedIcons();

	console.log(`Found ${icons.length} icons and ${aliases.length} aliases`);

	if (icons.length === 0) {
		console.log('No icons found. Exiting.');
		return;
	}

	// Ensure icons directory exists
	if (!existsSync(ICONS_DIR)) {
		mkdirSync(ICONS_DIR, { recursive: true });
	}

	// Generate wrapper components
	console.log('Generating icon wrappers...');
	for (const icon of icons) {
		const filePath = join(ICONS_DIR, `${icon}.svelte`);
		writeFileSync(filePath, generateIconWrapper(icon));
	}

	// Generate index.js
	console.log('Generating index.js...');
	const indexPath = join(ICONS_DIR, 'index.js');
	writeFileSync(indexPath, generateIndex(icons, aliases));

	console.log(`\nGenerated ${icons.length} icon components in src/lib/icons/`);
	console.log('\nIcons:', icons.join(', '));
	console.log('\nNext steps:');
	console.log('1. The vite.config.ts alias redirects lucide-svelte to $lib/icons');
	console.log('2. Run "npm run generate-icons" if you add new icons to the codebase');
}

main();
