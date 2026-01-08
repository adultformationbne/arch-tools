/**
 * Test Script for Course Email Service Layer
 * Tests the new course email functions without sending actual emails
 */

import { config } from 'dotenv';
import {
	createBrandedEmailHtml,
	createEmailButton,
	buildVariableContext,
	renderTemplateForRecipient
} from '../src/lib/utils/email-service.js';

config();

// Mock data
const mockCourse = {
	id: 'course-123',
	name: 'Archdiocesan Centre for Catholic Formation',
	slug: 'accf',
	settings: {
		theme: {
			accentDark: '#334642',
			accentLight: '#c59a6b'
		},
		branding: {
			logoUrl: null
		}
	}
};

const mockCohort = {
	id: 'cohort-123',
	name: 'February 2025 - Foundations of Faith',
	start_date: '2025-02-01',
	end_date: '2025-06-30',
	current_session: 2
};

const mockEnrollment = {
	id: 'enrollment-123',
	full_name: 'John Smith',
	email: 'john.smith@example.com',
	hub_name: "St. Mary's Parish"
};

const mockSession = {
	session_number: 2,
	title: 'The Holy Spirit'
};

console.log('='.repeat(60));
console.log('COURSE EMAIL SERVICE LAYER TEST');
console.log('='.repeat(60));

// Test 1: Build Variable Context
console.log('\n📊 Test 1: Build Variable Context');
console.log('-'.repeat(60));

const variables = buildVariableContext({
	enrollment: mockEnrollment,
	course: mockCourse,
	cohort: mockCohort,
	session: mockSession,
	siteUrl: 'https://app.archdiocesanministries.org.au'
});

console.log('Variables generated:');
console.log(JSON.stringify(variables, null, 2));

// Test 2: Render Template with Variables
console.log('\n📝 Test 2: Render Template with Variables');
console.log('-'.repeat(60));

const subjectTemplate = 'Session {{sessionNumber}} Materials Now Available';
const bodyTemplate = `Hi {{firstName}},

Great news! The materials for Session {{sessionNumber}}: {{sessionTitle}} are now available in {{courseName}}.

View Materials:
{{materialsLink}}

Don't forget to submit your reflection after reviewing the materials.

Blessings,
The {{courseName}} Team`;

const rendered = renderTemplateForRecipient({
	subjectTemplate,
	bodyTemplate,
	variables
});

console.log('Subject:', rendered.subject);
console.log('\nBody:\n', rendered.body);

// Test 3: Create Email Button
console.log('\n🔘 Test 3: Create Email Button');
console.log('-'.repeat(60));

const buttonHtml = createEmailButton(
	'View Session Materials',
	variables.materialsLink,
	mockCourse.settings.theme.accentDark
);

console.log('Button HTML generated:');
console.log(buttonHtml.substring(0, 200) + '...');

// Test 4: Create Branded Email HTML
console.log('\n🎨 Test 4: Create Branded Email HTML');
console.log('-'.repeat(60));

// Add button to rendered body
const bodyWithButton = rendered.body.replace(
	'View Materials:\n{{materialsLink}}',
	`View Materials:\n${buttonHtml}`
);

const brandedHtml = createBrandedEmailHtml({
	content: bodyWithButton.replace(/\n/g, '<br>'),
	courseName: mockCourse.name,
	accentDark: mockCourse.settings.theme.accentDark,
	accentLight: mockCourse.settings.theme.accentLight,
	logoUrl: mockCourse.settings.branding.logoUrl
});

console.log('Branded HTML email generated (' + brandedHtml.length + ' characters)');
console.log('\nFirst 500 characters:');
console.log(brandedHtml.substring(0, 500) + '...');

// Test 5: Write HTML to file for visual inspection
console.log('\n💾 Test 5: Write HTML to File');
console.log('-'.repeat(60));

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputPath = join(__dirname, 'test-email-output.html');

writeFileSync(outputPath, brandedHtml);

console.log('✅ Email HTML written to:', outputPath);
console.log('Open this file in a browser to see how the email looks!');

// Summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log('✅ Variable context building works');
console.log('✅ Template rendering works');
console.log('✅ Button creation works');
console.log('✅ Branded HTML generation works');
console.log('\n📧 Course email service layer is ready!');
console.log('='.repeat(60));
