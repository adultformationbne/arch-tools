# Course Platform Testing Suite

## Overview

This test suite provides **two levels of testing** for comprehensive coverage:

1. **Database Tests** (`courses.test.ts`) - Test CRUD operations at the database level
2. **API Tests** (`api.test.ts`) - Document and validate API endpoint contracts

Both types work together to ensure your app works correctly from database to API layer.

### Key Benefits

✅ **Two-Layer Testing** - Database tests + API contract tests
✅ **Future-proof** - Resilient to UI refactoring
✅ **Fast** - No browser needed, direct testing
✅ **Catches Mismatches** - API tests document the correct field names your app should use
✅ **Complete** - Covers all major workflows from COURSES.md
✅ **Auto-Cleanup** - Test data is automatically cleaned up after each test

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI dashboard
npm run test:ui

# Clean up test data from database
npm run test:cleanup
```

## What's Tested

### Database Tests (`courses.test.ts`)

Tests all core CRUD operations at the database level:

### Course Management
- ✅ Create course with theme settings
- ✅ Retrieve course by slug
- ✅ Update course settings (theme, branding)
- ✅ Delete course (cascade deletes modules)

### Module Operations
- ✅ Create module for a course
- ✅ Retrieve modules in order
- ✅ Update module details
- ✅ Cascade delete verification

### Session Management
- ✅ Create sessions for a module
- ✅ Retrieve sessions for a module

### Material Management
- ✅ Add materials to sessions (video, link, native)
- ✅ Retrieve materials in display order
- ✅ Delete materials

### Reflection Questions
- ✅ Create reflection questions
- ✅ Update reflection questions

### Cohort Management
- ✅ Create cohorts for modules
- ✅ Advance cohort sessions
- ✅ Update cohort status

### Enrollment Workflow
- ✅ Enroll students in cohorts
- ✅ Retrieve enrollments
- ✅ Update enrollment status
- ✅ Delete enrollments (unenroll)

### Reflection Submission & Grading
- ✅ Submit reflection responses
- ✅ Mark reflections (pass/fail with feedback)

### API Tests (`api.test.ts`)

Documents and validates the correct API contracts:

- ✅ **Reflection API** - Documents that API uses `content` (not `response_text`), `reflection_question_id` (not `question_id`)
- ✅ **Reflection Status Enum** - Valid values: `draft`, `submitted`, `under_review`, `passed`, `needs_revision`, `resubmitted`
- ✅ **Material Types** - Valid values: `video`, `link`, `native`
- ✅ **Enrollment Statuses** - Valid values: `pending`, `invited`, `accepted`, `active`, `completed`, `withdrawn`
- ✅ **Cohort Statuses** - Valid values: `upcoming`, `active`, `completed`
- ✅ **Course Theme Structure** - Documents expected theme settings format

**Why API Tests Matter:**
These tests catch mismatches between your database schema and your API layer. For example, if your API uses `content` but the database expects `response_text`, these tests document the correct field names to use.

## Test Architecture

### Test Files

```
tests/
├── setup.ts                # Test environment setup
├── helpers.ts              # Database test utilities
├── courses.test.ts         # Database CRUD tests (23 tests)
├── api.test.ts             # API contract tests (11 tests)
└── README.md               # This file
```

### Test Helpers (`helpers.ts`)

The `testHelpers` object provides convenient methods for creating test data:

```typescript
// Create test course
const course = await testHelpers.createCourse({
  name: 'Test Course',
  slug: 'test-my-course'
});

// Create test module
const module = await testHelpers.createModule(course.id, {
  name: 'Test Module'
});

// Create test sessions
const sessions = await testHelpers.createSessions(module.id, 8);

// Create test cohort
const cohort = await testHelpers.createCohort(module.id, {
  name: 'Spring 2025',
  current_session: 1
});

// Create test user
const user = await testHelpers.createUser({
  email: 'test-student@example.com',
  modules: ['courses.participant']
});

// Enroll student
const enrollment = await testHelpers.createEnrollment(user.id, cohort.id);

// Clean up after tests
await testHelpers.cleanup();
```

## Important Notes

### Test Data Naming

All test data uses prefixes for easy identification and cleanup:

- **Courses**: `slug` starts with `test-` (e.g., `test-course-1234567890`)
- **Users**: `email` starts with `test-` (e.g., `test-user-1234567890@example.com`)

### UI Filtering

Test courses are automatically hidden from the admin UI. The `/admin/courses` page filters out any course with a slug starting with `test-`, so test courses won't appear in the UI even while tests are running.

### Cleanup

**IMPORTANT**: Always run cleanup after testing to avoid cluttering the database:

```bash
npm run test:cleanup
```

This script will delete:
- All courses with slugs starting with `test-`
- All users with emails starting with `test-@example.com`
- All related data (modules, cohorts, enrollments, materials, etc.)

### Database Schema

Tests use the actual database schema as defined in `src/lib/database.types.ts`. When the schema changes:

1. Update `src/lib/database.types.ts` (run `npm run update-types`)
2. Update test helpers in `tests/helpers.ts` if needed
3. Update test assertions in `tests/courses.test.ts` if needed

## Why Integration Tests?

Unlike UI tests (Playwright, Testing Library), these integration tests:

1. **Don't break when you refactor components** - Test the database layer, not Svelte components
2. **Are faster** - No browser, no rendering, just database operations
3. **Test what matters** - Verify data integrity, not button colors
4. **Are easier to maintain** - Change UI all you want, tests still pass

## Example: Adding a New Test

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { testHelpers } from './helpers.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

describe('My New Feature', () => {
  afterEach(async () => {
    await testHelpers.cleanup();
  });

  it('should do something awesome', async () => {
    // Arrange - create test data
    const course = await testHelpers.createCourse();
    const module = await testHelpers.createModule(course.id);

    // Act - perform the operation
    const { data, error } = await supabaseAdmin
      .from('courses_modules')
      .select('*')
      .eq('id', module.id)
      .single();

    // Assert - verify the result
    expect(error).toBeNull();
    expect(data.name).toBe('Test Module');
  });
});
```

## Troubleshooting

### Tests are failing with "Missing required environment variables"

Ensure your `.env` file has:
```
PUBLIC_SUPABASE_URL=your-url-here
SUPABASE_SERVICE_ROLE_KEY=your-key-here
```

### Tests are creating too much data

Run cleanup regularly:
```bash
npm run test:cleanup
```

### Need to debug a test?

Use watch mode and console.log:
```bash
npm run test:watch
```

Or use the UI dashboard:
```bash
npm run test:ui
```

## Contributing

When adding new features to the courses platform:

1. Write integration tests for the database operations
2. Use `testHelpers` to create test data
3. Clean up with `afterEach(() => testHelpers.cleanup())`
4. Test the API/database layer, not the UI
5. Run `npm run test:cleanup` after testing

This ensures your new features are tested at the right level and remain stable through UI refactoring.
