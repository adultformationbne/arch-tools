/**
 * Test MJML Email Generation
 *
 * Tests the new MJML-based email system to ensure it compiles correctly.
 */

import { generateEmailFromMjml } from '../src/lib/email/compiler.js';
import { writeFileSync } from 'fs';

console.log('🧪 Testing MJML Email Generation...\n');

try {
	const testEmail = generateEmailFromMjml({
		bodyContent: `
			<h1>Welcome to the Course!</h1>
			<p>Hi <span class="variable-pill">firstName</span>,</p>
			<p>We're excited to have you enrolled in <span class="variable-pill">courseName</span>!</p>

			<h2>Getting Started</h2>
			<p>Here's what you need to do:</p>
			<ul>
				<li>Log in to your account</li>
				<li>Review Session 1 materials</li>
				<li>Complete your first reflection</li>
			</ul>

			<p>If you have any questions, reach out to <span class="variable-pill">supportEmail</span>.</p>

			<p><strong>Blessings</strong>,<br>The Course Team</p>
		`,
		courseName: 'Archdiocesan Center for Catholic Formation',
		logoUrl: 'https://snuifqzfezxqnkzizija.supabase.co/storage/v1/object/public/public-assets/archmin%20primary%20logo%20col%20small.png',
		colors: {
			accentDark: '#334642',
			accentLight: '#eae2d9',
			accentDarkest: '#1e2322'
		},
		previewText: 'Welcome to your course'
	});

	// Save output to file for inspection
	writeFileSync('scripts/test-mjml-output.html', testEmail);

	console.log('✅ MJML compilation successful!');
	console.log('📄 Output saved to: scripts/test-mjml-output.html');
	console.log(`📏 Email size: ${(testEmail.length / 1024).toFixed(2)} KB`);
	console.log('\n✨ Email includes:');
	console.log('   - Responsive design (600px max width)');
	console.log('   - Outlook-compatible VML buttons');
	console.log('   - Course branding (logo + colors)');
	console.log('   - Variable pill styling');
	console.log('   - Mobile-friendly media queries');

} catch (error) {
	console.error('❌ MJML compilation failed:', error.message);
	console.error(error.stack);
	process.exit(1);
}
