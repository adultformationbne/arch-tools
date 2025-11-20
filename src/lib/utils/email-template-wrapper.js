/**
 * Email Template Wrapper
 *
 * Wraps email content with branded course styling:
 * - Dark background with course accent colors
 * - White body area with dark titles and black text
 * - Light accent for dividers and borders
 * - Dark header with single-color logo
 */

/**
 * Wraps email content with course branding
 * @param {Object} options
 * @param {string} options.content - HTML content to wrap
 * @param {Object} options.course - Course object with branding
 * @param {string} options.logoUrl - URL to course logo (optional)
 * @param {string} options.siteUrl - Base site URL
 * @returns {string} Complete HTML email
 */
export function wrapEmailContent({ content, course, logoUrl = null, siteUrl }) {
	// Get course colors or use defaults
	const accentDark = course?.accent_dark || '#334642';
	const accentLight = course?.accent_light || '#eae2d9';
	const accentDarkest = course?.accent_darkest || '#1e2322';
	const courseName = course?.name || 'Course';

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
			-moz-osx-font-smoothing: grayscale;
		}
		.email-wrapper {
			width: 100%;
			background-color: ${accentDark};
			padding: 20px 0;
		}
		.email-container {
			max-width: 600px;
			margin: 0 auto;
			background-color: ${accentDark};
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
		.email-body a:hover {
			color: ${accentDarkest};
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
		.email-divider {
			height: 1px;
			background-color: ${accentLight};
			border: none;
			margin: 30px 0;
		}
		.email-button {
			display: inline-block;
			padding: 14px 28px;
			background-color: ${accentDark};
			color: #ffffff !important;
			text-decoration: none;
			border-radius: 6px;
			font-weight: 600;
			font-size: 15px;
			margin: 10px 0;
		}
		.email-button:hover {
			background-color: ${accentDarkest};
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
		.email-footer a:hover {
			text-decoration: underline;
		}

		/* Mobile responsive */
		@media only screen and (max-width: 600px) {
			.email-header, .email-body, .email-footer {
				padding: 25px 20px !important;
			}
			.email-body h1 {
				font-size: 22px;
			}
			.email-body h2 {
				font-size: 18px;
			}
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
				<p>
					<strong style="color: white;">${courseName}</strong>
				</p>
				<p>
					<a href="${siteUrl}">${siteUrl}</a>
				</p>
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

/**
 * Strips existing HTML/body tags from content if present
 * (in case user added their own)
 */
export function sanitizeEmailContent(content) {
	// Remove DOCTYPE, html, head, body tags if present
	let cleaned = content
		.replace(/<!DOCTYPE[^>]*>/gi, '')
		.replace(/<\/?html[^>]*>/gi, '')
		.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
		.replace(/<\/?body[^>]*>/gi, '')
		.trim();

	return cleaned;
}
