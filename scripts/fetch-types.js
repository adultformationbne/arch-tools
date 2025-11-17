#!/usr/bin/env node
/**
 * Fetch TypeScript types from Supabase
 * 
 * Usage: npm run update-types
 * 
 * Note: For now, use Claude to run: mcp__supabase__generate_typescript_types
 * Then save the output to src/lib/database.types.ts
 */

console.log('📝 To update types:');
console.log('1. Ask Claude to run: mcp__supabase__generate_typescript_types');
console.log('2. Save the output to src/lib/database.types.ts');
console.log('');
console.log('Or use Supabase CLI:');
console.log('  npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts');
