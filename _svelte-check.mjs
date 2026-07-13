import { compile } from 'svelte/compiler';
import { readFileSync } from 'fs';

const files = process.argv.slice(2);
let ok = true;
for (const f of files) {
	try {
		const src = readFileSync(f, 'utf8');
		compile(src, { filename: f, generate: 'server' });
		console.log('✅', f);
	} catch (e) {
		ok = false;
		console.log('❌', f, '\n   ', e.message);
	}
}
process.exit(ok ? 0 : 1);
