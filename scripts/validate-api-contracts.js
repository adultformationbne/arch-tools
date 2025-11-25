#!/usr/bin/env node

/**
 * API Contract Validator
 *
 * Compares API endpoint definitions with frontend API calls to detect mismatches:
 * - Query parameter names
 * - Body parameter names
 * - HTTP methods
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	bold: '\x1b[1m'
};

const issues = [];
let filesScanned = 0;

/**
 * Parse API endpoint definitions from +server.ts files
 */
function parseApiEndpoints(filePath, content) {
	const endpoints = [];
	const relativePath = path.relative(projectRoot, filePath);

	// Extract URL pattern from file path
	// e.g., src/routes/api/courses/[slug]/emails/+server.ts -> /api/courses/:slug/emails
	const urlMatch = filePath.match(/src\/routes(\/api\/.*?)\/\+server\.ts$/);
	if (!urlMatch) return endpoints;

	const urlPattern = urlMatch[1].replace(/\[(\w+)\]/g, ':$1');

	// Find all HTTP method handlers (GET, POST, PUT, DELETE, PATCH)
	const methodRegex = /export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*:\s*RequestHandler\s*=\s*async\s*\(event\)\s*=>\s*\{([\s\S]*?)(?=export\s+const\s+(?:GET|POST|PUT|DELETE|PATCH)|$)/g;

	let match;
	while ((match = methodRegex.exec(content)) !== null) {
		const method = match[1];
		const handlerBody = match[2];

		const endpoint = {
			method,
			url: urlPattern,
			file: relativePath,
			queryParams: [],
			bodyParams: []
		};

		// Extract query parameters
		// Pattern: url.searchParams.get('param_name')
		const queryParamRegex = /(?:url\.searchParams|searchParams)\.get\(['"](\w+)['"]\)/g;
		let queryMatch;
		while ((queryMatch = queryParamRegex.exec(handlerBody)) !== null) {
			endpoint.queryParams.push(queryMatch[1]);
		}

		// Extract body parameters (destructured from request body)
		// Pattern: const { param1, param2 } = await event.request.json()
		const bodyDestructureRegex = /const\s*\{\s*([^}]+)\}\s*=\s*(?:await\s+)?(?:event\.request\.json\(\)|body)/g;
		let bodyMatch;
		while ((bodyMatch = bodyDestructureRegex.exec(handlerBody)) !== null) {
			const params = bodyMatch[1]
				.split(',')
				.map(p => p.trim().split(':')[0].trim())
				.filter(p => p && !p.startsWith('//'));
			endpoint.bodyParams.push(...params);
		}

		endpoints.push(endpoint);
	}

	return endpoints;
}

/**
 * Parse frontend API calls
 */
function parseFrontendCalls(filePath, content) {
	const calls = [];
	const relativePath = path.relative(projectRoot, filePath);

	// Match apiGet, apiPost, apiPut, apiDelete, apiPatch
	const apiCallRegex = /(?:await\s+)?api(Get|Post|Put|Delete|Patch)\s*\(\s*[`'"]([^`'"]+)[`'"]\s*(?:,\s*(\{[\s\S]*?\}))?\s*(?:,\s*\{[^}]*\})?\s*\)/g;

	let match;
	while ((match = apiCallRegex.exec(content)) !== null) {
		const method = match[1].toUpperCase();
		const urlTemplate = match[2];
		const bodyStr = match[3];

		// Extract URL pattern (convert template literals)
		// /api/courses/${slug}/emails?id=${id} -> /api/courses/:slug/emails
		const urlPattern = urlTemplate
			.replace(/\$\{[^}]+\}/g, ':param')
			.split('?')[0]; // Remove query string for pattern matching

		// Extract query parameters from URL
		const queryParams = [];
		const queryMatch = urlTemplate.match(/\?(.+)$/);
		if (queryMatch) {
			const queryStr = queryMatch[1];
			// Extract param names: id=${var}, template_id=${var}
			const paramRegex = /(\w+)=/g;
			let paramMatch;
			while ((paramMatch = paramRegex.exec(queryStr)) !== null) {
				queryParams.push(paramMatch[1]);
			}
		}

		// Extract body parameters
		const bodyParams = [];
		if (bodyStr) {
			// Simple key extraction from object literal
			const keyRegex = /(\w+)\s*:/g;
			let keyMatch;
			while ((keyMatch = keyRegex.exec(bodyStr)) !== null) {
				bodyParams.push(keyMatch[1]);
			}
		}

		// Get line number
		const lineNumber = content.substring(0, match.index).split('\n').length;

		calls.push({
			method,
			url: urlPattern,
			urlTemplate,
			queryParams,
			bodyParams,
			file: relativePath,
			line: lineNumber
		});
	}

	// Also match direct fetch calls
	const fetchRegex = /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]\s*,\s*\{[^}]*method\s*:\s*['"](\w+)['"][^}]*body\s*:\s*JSON\.stringify\s*\(([^)]+)\)/g;

	while ((match = fetchRegex.exec(content)) !== null) {
		const urlTemplate = match[1];
		const method = match[2].toUpperCase();
		const bodyContent = match[3];

		const urlPattern = urlTemplate
			.replace(/\$\{[^}]+\}/g, ':param')
			.split('?')[0];

		const lineNumber = content.substring(0, match.index).split('\n').length;

		calls.push({
			method,
			url: urlPattern,
			urlTemplate,
			queryParams: [],
			bodyParams: [], // Would need more complex parsing for fetch bodies
			file: relativePath,
			line: lineNumber
		});
	}

	return calls;
}

/**
 * Normalize URL patterns for comparison
 */
function normalizeUrl(url) {
	return url
		.replace(/\/\[(\w+)\]/g, '/:$1')
		.replace(/\$\{[^}]+\}/g, ':param')
		.replace(/:(\w+)/g, ':param'); // Normalize all params to :param for matching
}

/**
 * Compare endpoints and calls to find mismatches
 */
function compareContracts(endpoints, calls) {
	for (const call of calls) {
		const normalizedCallUrl = normalizeUrl(call.url);

		// Find matching endpoint
		const matchingEndpoints = endpoints.filter(
			ep => normalizeUrl(ep.url) === normalizedCallUrl && ep.method === call.method
		);

		if (matchingEndpoints.length === 0) {
			// Endpoint not found - might be a different pattern
			continue;
		}

		const endpoint = matchingEndpoints[0];

		// Check query parameters
		for (const queryParam of call.queryParams) {
			if (!endpoint.queryParams.includes(queryParam)) {
				issues.push({
					type: 'query_param_mismatch',
					severity: 'error',
					message: `Query parameter '${queryParam}' sent but not expected by endpoint`,
					frontend: `${call.file}:${call.line}`,
					backend: endpoint.file,
					method: call.method,
					url: call.urlTemplate,
					expected: endpoint.queryParams,
					actual: call.queryParams
				});
			}
		}

		// Check if endpoint expects params that aren't sent
		for (const queryParam of endpoint.queryParams) {
			if (!call.queryParams.includes(queryParam)) {
				issues.push({
					type: 'query_param_missing',
					severity: 'error',
					message: `Query parameter '${queryParam}' expected but not sent`,
					frontend: `${call.file}:${call.line}`,
					backend: endpoint.file,
					method: call.method,
					url: call.urlTemplate,
					expected: endpoint.queryParams,
					actual: call.queryParams
				});
			}
		}

		// Check body parameters (only for POST, PUT, PATCH)
		if (['POST', 'PUT', 'PATCH'].includes(call.method)) {
			for (const bodyParam of call.bodyParams) {
				if (!endpoint.bodyParams.includes(bodyParam) && bodyParam !== 'action') {
					issues.push({
						type: 'body_param_mismatch',
						severity: 'warning',
						message: `Body parameter '${bodyParam}' sent but not explicitly expected`,
						frontend: `${call.file}:${call.line}`,
						backend: endpoint.file,
						method: call.method,
						url: call.urlTemplate
					});
				}
			}
		}
	}
}

/**
 * Recursively find files matching pattern
 */
function findFiles(dir, pattern, results = []) {
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			// Skip node_modules, .svelte-kit, etc.
			if (!file.startsWith('.') && file !== 'node_modules' && file !== 'build') {
				findFiles(filePath, pattern, results);
			}
		} else if (pattern.test(file)) {
			results.push(filePath);
		}
	}

	return results;
}

/**
 * Main validation
 */
function validateApiContracts() {
	console.log(`${colors.cyan}${colors.bold}API Contract Validator${colors.reset}\n`);

	// Find all API endpoint files
	console.log(`${colors.blue}Scanning API endpoints...${colors.reset}`);
	const apiFiles = findFiles(path.join(projectRoot, 'src/routes/api'), /\+server\.ts$/);

	const allEndpoints = [];
	for (const file of apiFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const endpoints = parseApiEndpoints(file, content);
		allEndpoints.push(...endpoints);
		filesScanned++;
	}

	console.log(`  Found ${allEndpoints.length} endpoints in ${apiFiles.length} files\n`);

	// Find all frontend files that make API calls
	console.log(`${colors.blue}Scanning frontend API calls...${colors.reset}`);
	const frontendFiles = [
		...findFiles(path.join(projectRoot, 'src/routes'), /\+page\.svelte$/),
		...findFiles(path.join(projectRoot, 'src/routes'), /\+page\.ts$/),
		...findFiles(path.join(projectRoot, 'src/routes'), /\+page\.server\.ts$/),
		...findFiles(path.join(projectRoot, 'src/lib/components'), /\.svelte$/)
	];

	const allCalls = [];
	for (const file of frontendFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const calls = parseFrontendCalls(file, content);
		allCalls.push(...calls);
		filesScanned++;
	}

	console.log(`  Found ${allCalls.length} API calls in ${frontendFiles.length} files\n`);

	// Compare contracts
	console.log(`${colors.blue}Comparing contracts...${colors.reset}\n`);
	compareContracts(allEndpoints, allCalls);

	// Report results
	if (issues.length === 0) {
		console.log(`${colors.green}${colors.bold}✓ No API contract mismatches found!${colors.reset}\n`);
		console.log(`Scanned ${filesScanned} files\n`);
		return 0;
	}

	// Group by severity
	const errors = issues.filter(i => i.severity === 'error');
	const warnings = issues.filter(i => i.severity === 'warning');

	console.log(`${colors.red}${colors.bold}✗ Found ${issues.length} issue(s):${colors.reset}\n`);

	// Display errors
	if (errors.length > 0) {
		console.log(`${colors.red}${colors.bold}ERRORS (${errors.length}):${colors.reset}\n`);
		for (const issue of errors) {
			console.log(`${colors.red}●${colors.reset} ${colors.bold}${issue.message}${colors.reset}`);
			console.log(`  Method: ${colors.cyan}${issue.method}${colors.reset}`);
			console.log(`  URL: ${colors.yellow}${issue.url}${colors.reset}`);
			console.log(`  Frontend: ${issue.frontend}`);
			console.log(`  Backend: ${issue.backend}`);
			if (issue.expected || issue.actual) {
				console.log(`  Expected: [${colors.green}${issue.expected?.join(', ')}${colors.reset}]`);
				console.log(`  Actual: [${colors.red}${issue.actual?.join(', ')}${colors.reset}]`);
			}
			console.log();
		}
	}

	// Display warnings
	if (warnings.length > 0) {
		console.log(`${colors.yellow}${colors.bold}WARNINGS (${warnings.length}):${colors.reset}\n`);
		for (const issue of warnings) {
			console.log(`${colors.yellow}●${colors.reset} ${issue.message}`);
			console.log(`  Method: ${colors.cyan}${issue.method}${colors.reset}`);
			console.log(`  URL: ${colors.yellow}${issue.url}${colors.reset}`);
			console.log(`  Frontend: ${issue.frontend}`);
			console.log(`  Backend: ${issue.backend}`);
			console.log();
		}
	}

	console.log(`Scanned ${filesScanned} files\n`);

	return errors.length > 0 ? 1 : 0;
}

// Run validation
const exitCode = validateApiContracts();
process.exit(exitCode);
