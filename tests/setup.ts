import { config } from 'dotenv';

// Load environment variables for tests
config();

// Ensure we have required env vars
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error('Missing required environment variables for testing. Need PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}
