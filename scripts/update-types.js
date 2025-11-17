#!/usr/bin/env node
import fs from 'fs';

// Get types from stdin (will be piped from mcp tool)
let types = '';
process.stdin.on('data', chunk => types += chunk);
process.stdin.on('end', () => {
  fs.writeFileSync('src/lib/database.types.ts', types);
  console.log('✅ Types written to src/lib/database.types.ts');
});
