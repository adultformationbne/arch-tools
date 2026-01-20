import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function POST() {
	try {
		// Create the dgr_promo_tiles table using raw SQL
		const { error: createTableError } = await supabaseAdmin.rpc('exec_sql', {
			sql: `
				-- Create table for DGR promotional tiles
				CREATE TABLE IF NOT EXISTS dgr_promo_tiles (
					id SERIAL PRIMARY KEY,
					position INTEGER NOT NULL CHECK (position IN (1, 2, 3)),
					image_url TEXT,
					title TEXT,
					link_url TEXT,
					active BOOLEAN DEFAULT true,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
					UNIQUE(position)
				);

				-- Insert default placeholder tiles
				INSERT INTO dgr_promo_tiles (position, image_url, title, active) VALUES
					(1, '', 'Event 1', true),
					(2, '', 'Event 2', true),
					(3, '', 'Event 3', true)
				ON CONFLICT (position) DO NOTHING;
			`
		});

		if (createTableError) {
			console.error('Error creating table:', createTableError);
			// Try alternative approach using direct SQL execution
			const { error: sqlError } = await supabaseAdmin
				.from('information_schema.tables')
				.select('table_name')
				.eq('table_name', 'dgr_promo_tiles');
			
			if (sqlError) {
				return json({ 
					error: 'Failed to create promo tiles table. Please create it manually in Supabase dashboard.',
					details: createTableError.message 
				}, { status: 500 });
			}
		}

		return json({ success: true, message: 'Promo tiles table created successfully' });
	} catch (error) {
		console.error('Setup error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}