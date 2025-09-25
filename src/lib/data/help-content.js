// Contextual help content for different pages in the application

export const helpContent = {
	// DGR Admin Dashboard
	'/dgr': [
		{
			title: 'Schedule Management',
			content: `
				<p>The <strong>Schedule</strong> tab helps you manage Daily Gospel Reflection assignments:</p>
				<ul>
					<li><strong>Generate Schedule:</strong> Create new schedule entries for any date range</li>
					<li><strong>Assign Contributors:</strong> Use the dropdown to assign contributors to specific dates</li>
					<li><strong>Track Status:</strong> Monitor reflection progress (Pending → Submitted → Approved → Published)</li>
					<li><strong>Copy Links:</strong> Click "Copy Link" to get submission URLs for contributors</li>
				</ul>
				<p><code>Tip:</code> Generate schedules in advance to give contributors enough notice.</p>
			`
		},
		{
			title: 'Contributors',
			content: `
				<p>Manage your reflection contributors and their preferences:</p>
				<ul>
					<li><strong>Add Contributors:</strong> Include name, email, and preferred writing days</li>
					<li><strong>Day of Month:</strong> Assign specific contributors to write on certain days (e.g., always the 15th)</li>
					<li><strong>Preferred Days:</strong> Set which days of the week each contributor prefers</li>
				</ul>
				<p><strong>Smart Assignment:</strong> The system considers preferences when generating schedules.</p>
			`
		},
		{
			title: 'Promotional Tiles',
			content: `
				<p>Configure promotional content that appears on the public DGR page:</p>
				<ul>
					<li><strong>Image URLs:</strong> Use WordPress media library URLs for images</li>
					<li><strong>Multiple Tiles:</strong> Add up to 3 promotional tiles</li>
					<li><strong>Optional Links:</strong> Add clickable links to events or pages</li>
				</ul>
				<p><code>Format:</code> https://archdiocesanministries.org.au/wp-content/uploads/...</p>
			`
		}
	],

	// Content Editor
	'/editor': [
		{
			title: 'Block-Based Editing',
			content: `
				<p>The editor uses an <strong>immutable block system</strong> where content is organized into blocks:</p>
				<ul>
					<li><strong>Block Types:</strong> paragraphs, headings (h1-h3), quotes, prayers, callouts</li>
					<li><strong>Never Overwrites:</strong> Every edit creates a new version, preserving history</li>
					<li><strong>Metadata:</strong> Tag blocks with categories like 'prayer page', 'activity', etc.</li>
				</ul>
				<p><code>Pro Tip:</code> Use the chapter sidebar to navigate large documents quickly.</p>
			`
		},
		{
			title: 'Document Organization',
			content: `
				<p>Organize your content effectively:</p>
				<ul>
					<li><strong>Chapters:</strong> Use chapter blocks to create document sections</li>
					<li><strong>Filtering:</strong> Filter by tag, metadata, or search content</li>
					<li><strong>Visibility:</strong> Hide blocks from export without deleting them</li>
				</ul>
				<p>The <strong>Document Preview</strong> shows how your content will appear in the final output.</p>
			`
		},
		{
			title: 'Version Control',
			content: `
				<p>Every block maintains complete version history:</p>
				<ul>
					<li><strong>View History:</strong> Click the history icon to see all versions</li>
					<li><strong>Restore Versions:</strong> Roll back to any previous version</li>
					<li><strong>Audit Trail:</strong> See who made changes and when</li>
				</ul>
				<p><strong>Safe Editing:</strong> Never worry about losing content - everything is preserved.</p>
			`
		}
	],

	// Scripture Reader
	'/scripture': [
		{
			title: 'Daily Readings',
			content: `
				<p>Access the liturgical readings for each day:</p>
				<ul>
					<li><strong>Brisbane Calendar:</strong> Readings follow the Brisbane Catholic liturgical calendar</li>
					<li><strong>Gospel Focus:</strong> Primary focus on Gospel readings for reflection</li>
					<li><strong>Date Navigation:</strong> Use the date picker to view readings for any day</li>
				</ul>
			`
		},
		{
			title: 'Bible Verse Lookup',
			content: `
				<p>Search for specific Bible passages:</p>
				<ul>
					<li><strong>Book References:</strong> Enter references like "John 3:16" or "Matthew 5:1-12"</li>
					<li><strong>Multiple Versions:</strong> Access different Bible translations</li>
					<li><strong>Context:</strong> View surrounding verses for better understanding</li>
				</ul>
			`
		}
	],

	// DGR Templates
	'/dgr-templates': [
		{
			title: 'Template Management',
			content: `
				<p>Manage reflection templates for contributors:</p>
				<ul>
					<li><strong>Standard Templates:</strong> Provide consistent structure for reflections</li>
					<li><strong>Custom Fields:</strong> Include prompts and guidance for writers</li>
					<li><strong>Preview:</strong> See how templates will appear to contributors</li>
				</ul>
			`
		}
	],

	// Quick Publish
	'/dgr-publish': [
		{
			title: 'Quick Publishing',
			content: `
				<p>Rapidly create and publish reflections:</p>
				<ul>
					<li><strong>Direct Input:</strong> Write reflections directly in the interface</li>
					<li><strong>WordPress Integration:</strong> Publish directly to the website</li>
					<li><strong>Preview:</strong> See exactly how content will appear</li>
				</ul>
			`
		}
	]
};

// Helper function to get help content for current page
export function getHelpForPage(pathname) {
	// Remove query parameters and normalize path
	const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';

	// Try exact match first
	if (helpContent[cleanPath]) {
		return helpContent[cleanPath];
	}

	// Try partial matches for sub-routes
	const pathSegments = cleanPath.split('/').filter(Boolean);
	for (let i = pathSegments.length; i > 0; i--) {
		const testPath = '/' + pathSegments.slice(0, i).join('/');
		if (helpContent[testPath]) {
			return helpContent[testPath];
		}
	}

	return [];
}

// Get page title for help context
export function getPageTitle(pathname) {
	const titles = {
		'/dgr': 'DGR Admin Dashboard',
		'/editor': 'Content Editor',
		'/scripture': 'Scripture Reader',
		'/dgr-templates': 'DGR Templates',
		'/dgr-publish': 'Quick Publish'
	};

	const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';

	// Try exact match
	if (titles[cleanPath]) {
		return titles[cleanPath];
	}

	// Try partial matches
	const pathSegments = cleanPath.split('/').filter(Boolean);
	for (let i = pathSegments.length; i > 0; i--) {
		const testPath = '/' + pathSegments.slice(0, i).join('/');
		if (titles[testPath]) {
			return titles[testPath];
		}
	}

	return 'Page Guide';
}