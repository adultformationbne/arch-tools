import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Standalone branded email HTML generator
function createBrandedEmailHtml({
	content,
	courseName,
	accentDark = '#334642',
	accentLight = '#eae2d9',
	accentDarkest = '#1e2322',
	logoUrl = null,
	siteUrl = 'https://archdiocesanministries.org.au'
}) {
	if (!content) return '';

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${courseName}</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			background-color: ${accentDark};
			-webkit-font-smoothing: antialiased;
		}
		.email-wrapper {
			width: 100%;
			background-color: ${accentDark};
			padding: 20px 0;
		}
		.email-container {
			max-width: 600px;
			margin: 0 auto;
		}
		.email-header {
			background-color: ${accentDarkest};
			padding: 30px 40px;
			text-align: center;
		}
		.email-logo {
			max-width: 200px;
			height: auto;
			filter: brightness(0) invert(1);
		}
		.email-body {
			background-color: #ffffff;
			padding: 40px;
		}
		.email-body h1 {
			color: ${accentDarkest};
			font-size: 24px;
			font-weight: 700;
			margin: 0 0 20px 0;
			line-height: 1.3;
		}
		.email-body h2 {
			color: ${accentDark};
			font-size: 20px;
			font-weight: 600;
			margin: 30px 0 15px 0;
			line-height: 1.3;
		}
		.email-body h3 {
			color: ${accentDark};
			font-size: 16px;
			font-weight: 600;
			margin: 20px 0 10px 0;
			line-height: 1.3;
		}
		.email-body p {
			color: #000000;
			font-size: 15px;
			line-height: 1.6;
			margin: 0 0 15px 0;
		}
		.email-body a {
			color: ${accentDark};
			text-decoration: underline;
		}
		.email-body ul, .email-body ol {
			color: #000000;
			font-size: 15px;
			line-height: 1.6;
			margin: 0 0 15px 0;
			padding-left: 25px;
		}
		.email-body li {
			margin-bottom: 8px;
		}
		hr {
			height: 1px;
			background-color: ${accentLight};
			border: none;
			margin: 30px 0;
		}
		.email-footer {
			background-color: ${accentDark};
			padding: 30px 40px;
			text-align: center;
		}
		.email-footer p {
			color: rgba(255, 255, 255, 0.7);
			font-size: 13px;
			line-height: 1.5;
			margin: 0 0 10px 0;
		}
		.email-footer a {
			color: ${accentLight};
			text-decoration: none;
		}

		@media only screen and (max-width: 600px) {
			.email-header, .email-body, .email-footer {
				padding: 25px 20px !important;
			}
			.email-body h1 { font-size: 22px; }
			.email-body h2 { font-size: 18px; }
		}
	</style>
</head>
<body>
	<div class="email-wrapper">
		<div class="email-container">
			<!-- Header -->
			<div class="email-header">
				${
					logoUrl
						? `<img src="${logoUrl}" alt="${courseName}" class="email-logo" />`
						: `<h1 style="color: white; margin: 0; font-size: 24px;">${courseName}</h1>`
				}
			</div>

			<!-- Body -->
			<div class="email-body">
				${content}
			</div>

			<!-- Footer -->
			<div class="email-footer">
				<p><strong style="color: white;">${courseName}</strong></p>
				<p><a href="${siteUrl}">${siteUrl}</a></p>
				<p style="margin-top: 20px; font-size: 12px;">
					You're receiving this email because you're enrolled in this course.
				</p>
			</div>
		</div>
	</div>
</body>
</html>
	`.trim();
}

// Sample email content (what a user would write in the WYSIWYG editor)
const content = `
<h1>Welcome to the Course!</h1>

<p>Dear John Smith,</p>

<p>We're excited to have you join <strong>Introduction to Catholic Formation</strong>. This email will help you get started with your learning journey.</p>

<hr />

<h2>Getting Started</h2>

<p>Here are your next steps:</p>

<ul>
	<li>Review the course materials for Week 1</li>
	<li>Complete your first reflection assignment</li>
	<li>Join your cohort discussion</li>
</ul>

<h3>Important Dates</h3>

<p>Your course begins on <strong>February 1, 2025</strong> and runs for 8 weeks.</p>

<hr />

<p>If you have any questions, please don't hesitate to reach out to our support team.</p>

<p>Blessings,<br />
The Formation Team</p>
`;

// Course branding (typical course colors)
const courseBranding = {
	content,
	courseName: 'Archdiocesan Centre for Catholic Formation',
	accentDark: '#334642', // Dark green
	accentLight: '#eae2d9', // Tan/beige
	accentDarkest: '#1e2322', // Almost black
	logoUrl: null, // No logo for this test
	siteUrl: 'https://archdiocesanministries.org.au'
};

// Generate the branded HTML
const brandedHtml = createBrandedEmailHtml(courseBranding);

console.log('📧 Sending test branded email...\n');
console.log('Course Colors:');
console.log('  - Dark Background:', courseBranding.accentDark);
console.log('  - Light Accent:', courseBranding.accentLight);
console.log('  - Darkest (Header):', courseBranding.accentDarkest);
console.log('');

// Send the email
try {
	const result = await resend.emails.send({
		from: 'Formation Team <formation@archdiocesanministries.org.au>',
		to: 'me@liamdesic.co',
		subject: 'Welcome to Introduction to Catholic Formation',
		html: brandedHtml
	});

	console.log('✅ Email sent successfully!');
	console.log('Email ID:', result.id);
	console.log('\nCheck your inbox at: me@liamdesic.co');
	console.log(
		'\nEmail should have:\n  - Dark background\n  - White body\n  - Dark green/black titles\n  - Black body text\n  - Tan/beige dividers'
	);
} catch (error) {
	console.error('❌ Error sending email:', error);
}
