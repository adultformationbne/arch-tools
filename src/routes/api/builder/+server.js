import { json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const MASTER_FILE_PATH = path.join(process.cwd(), 'static', 'AHWGP_master.json');

export async function POST({ request }) {
	try {
		const data = await request.json();
		
		// Add metadata
		const fileData = {
			...data,
			lastSaved: new Date().toISOString(),
			version: '1.0'
		};
		
		// Write to file with pretty formatting
		await fs.writeFile(MASTER_FILE_PATH, JSON.stringify(fileData, null, 2));
		
		return json({ success: true, message: 'File saved successfully' });
	} catch (error) {
		console.error('Error saving file:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}

export async function GET() {
	try {
		// Check if file exists
		const fileExists = await fs.access(MASTER_FILE_PATH).then(() => true).catch(() => false);
		
		if (!fileExists) {
			// Return empty structure if file doesn't exist
			return json({
				documentTitle: 'Untitled Document',
				blocks: [],
				customTags: [],
				lastSaved: null
			});
		}
		
		const fileContent = await fs.readFile(MASTER_FILE_PATH, 'utf-8');
		const data = JSON.parse(fileContent);
		
		return json(data);
	} catch (error) {
		console.error('Error reading file:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}