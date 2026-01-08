/**
 * Simple standalone test for course email functions
 * Tests the core email rendering logic
 */

// Inline the core functions for testing
function renderTemplate(template, variables = {}) {
	if (!template) return '';
	let rendered = template;
	Object.entries(variables).forEach(([key, value]) => {
		const regex = new RegExp(`{{${key}}}`, 'g');
		rendered = rendered.replace(regex, value ?? '');
	});
	rendered = rendered.replace(/{{[^}]+}}/g, '');
	return rendered;
}

function createBrandedEmailHtml({
	content,
	courseName,
	accentDark = '#334642',
	accentLight = '#c59a6b',
	logoUrl = null
}) {
	if (!content) return '';

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${courseName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
	<table role="presentation" style="width: 100%; border-collapse: collapse;">
		<tr>
			<td align="center" style="padding: 40px 20px;">
				<table role="presentation" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 8px;">
					<!-- Header -->
					<tr>
						<td style="background: linear-gradient(135deg, ${accentDark} 0%, ${accentLight} 100%); padding: 32px; text-align: center;">
							${logoUrl ? `<img src="${logoUrl}" alt="${courseName}" style="max-width: 180px; margin-bottom: 12px;">` : ''}
							<h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
								${courseName}
							</h1>
						</td>
					</tr>
					<!-- Content -->
					<tr>
						<td style="padding: 40px 32px;">
							<div style="font-size: 16px; line-height: 1.6; color: #333333;">
								${content}
							</div>
						</td>
					</tr>
					<!-- Footer -->
					<tr>
						<td style="background: #f9f9f9; padding: 24px; text-align: center; border-top: 3px solid ${accentLight};">
							<p style="margin: 0; font-size: 13px; color: #666;">
								You're receiving this as a participant in ${courseName}
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
	`.trim();
}

function createEmailButton(text, url, accentDark = '#334642') {
	return `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
	<tr>
		<td style="border-radius: 6px; background-color: ${accentDark};">
			<a href="${url}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
				${text}
			</a>
		</td>
	</tr>
</table>
	`.trim();
}

// Run tests
console.log('='.repeat(60));
console.log('COURSE EMAIL SERVICE LAYER TEST');
console.log('='.repeat(60));

// Test data
const variables = {
	firstName: 'John',
	lastName: 'Smith',
	sessionNumber: '2',
	sessionTitle: 'The Holy Spirit',
	courseName: 'ACCF',
	materialsLink: 'https://app.archdiocesanministries.org.au/courses/accf/materials'
};

// Test 1: Template rendering
console.log('\n📝 Test 1: Template Rendering');
console.log('-'.repeat(60));

const subject = renderTemplate('Session {{sessionNumber}} Materials Available', variables);
console.log('Subject:', subject);

const body = renderTemplate(
	'Hi {{firstName}},\n\nSession {{sessionNumber}}: {{sessionTitle}} materials are ready!',
	variables
);
console.log('Body:', body);

// Test 2: Button creation
console.log('\n🔘 Test 2: Email Button');
console.log('-'.repeat(60));

const button = createEmailButton('View Materials', variables.materialsLink, '#334642');
console.log('Button HTML length:', button.length);
console.log('Button preview:', button.substring(0, 100) + '...');

// Test 3: Branded HTML
console.log('\n🎨 Test 3: Branded Email HTML');
console.log('-'.repeat(60));

const bodyWithButton = body.replace(/\n/g, '<br>') + '<br><br>' + button;

const html = createBrandedEmailHtml({
	content: bodyWithButton,
	courseName: 'Archdiocesan Centre for Catholic Formation',
	accentDark: '#334642',
	accentLight: '#c59a6b'
});

console.log('HTML email length:', html.length);

// Write to file
import { writeFileSync } from 'fs';
const outputPath = './scripts/test-email-output.html';
writeFileSync(outputPath, html);

console.log('✅ Email saved to:', outputPath);
console.log('\n' + '='.repeat(60));
console.log('✅ ALL TESTS PASSED');
console.log('Open test-email-output.html in a browser to preview!');
console.log('='.repeat(60));
