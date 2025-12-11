/**
 * Inlined MJML Template
 *
 * This template is inlined as a string to ensure it works in serverless
 * environments (Vercel) where filesystem reads may not work correctly.
 */

export const courseEmailTemplate = `<mjml>
  <mj-head>
    <mj-title>{{courseName}}</mj-title>
    <mj-preview>{{previewText}}</mj-preview>

    <mj-attributes>
      <mj-all font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" />
      <mj-text font-size="15px" line-height="1.6" color="#000000" />
      <mj-section padding="0" />
    </mj-attributes>

    <mj-style>
      /* Variable pills styling */
      .variable-pill {
        display: inline-block;
        padding: 2px 8px;
        margin: 0 2px;
        background-color: #e5e7eb;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-family: 'SF Mono', Monaco, 'Inconsolata', 'Courier New', monospace;
        font-size: 13px;
        font-weight: 500;
        text-transform: lowercase;
      }

      /* Headings */
      h1 {
        color: {{accentDarkest}};
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 20px 0;
        line-height: 1.3;
      }

      h2 {
        color: {{accentDark}};
        font-size: 20px;
        font-weight: 600;
        margin: 30px 0 15px 0;
        line-height: 1.3;
      }

      h3 {
        color: {{accentDark}};
        font-size: 16px;
        font-weight: 600;
        margin: 20px 0 10px 0;
        line-height: 1.3;
      }

      /* Lists */
      ul, ol {
        margin: 0 0 15px 0;
        padding-left: 25px;
      }

      li {
        margin-bottom: 8px;
      }

      /* Links */
      a {
        color: {{accentDark}};
        text-decoration: underline;
      }

      /* Strong */
      strong {
        font-weight: 600;
        color: #000000;
      }
    </mj-style>
  </mj-head>

  <mj-body background-color="#f3f4f6">
    <!-- Email Container -->
    <mj-wrapper padding="40px 20px">

      <!-- Header with Course Branding -->
      <mj-section background-color="{{accentDark}}" padding="32px 24px">
        <mj-column>
          <!-- Logo (if provided) -->
          {{#if logoUrl}}
          <mj-image
            src="{{logoUrl}}"
            alt="{{courseName}} logo"
            width="200px"
            padding="0 0 12px 0"
            align="center"
          />
          {{/if}}

          <!-- Course Name -->
          <mj-text
            align="center"
            color="#ffffff"
            font-size="24px"
            font-weight="700"
            padding="0"
          >
            {{courseName}}
          </mj-text>
        </mj-column>
      </mj-section>

      <!-- Body Content Area -->
      <mj-section background-color="#ffffff" padding="40px 32px">
        <mj-column>
          <!-- Dynamic body content inserted here -->
          <mj-text padding="0">
            {{bodyContent}}
          </mj-text>
        </mj-column>
      </mj-section>

      <!-- Footer -->
      <mj-section background-color="{{accentDark}}" padding="24px">
        <mj-column>
          <mj-text
            align="center"
            color="#ffffff"
            font-size="14px"
            font-weight="500"
            padding="0 0 8px 0"
          >
            {{courseName}}
          </mj-text>

          <mj-text
            align="center"
            color="rgba(255, 255, 255, 0.7)"
            font-size="12px"
            padding="0"
          >
            You're receiving this email because you're enrolled in this course.
          </mj-text>
        </mj-column>
      </mj-section>

    </mj-wrapper>
  </mj-body>
</mjml>`;

/**
 * Map of available templates
 */
export const templates = {
	'course-email': courseEmailTemplate
};

/**
 * Get template by name
 * @param {string} templateName - Template name
 * @returns {string} Template content
 */
export function getTemplate(templateName) {
	const template = templates[templateName];
	if (!template) {
		throw new Error(`Template "${templateName}" not found`);
	}
	return template;
}
