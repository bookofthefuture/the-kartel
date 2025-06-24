# The Kartel Testing Suite

This directory contains unit tests for The Kartel project to ensure functionality remains intact during development.

## Test Structure

- `validation.test.js` - Core validation logic tests (form validation, authentication, data processing)
- `frontend.test.js` - Frontend JavaScript functionality tests
- `setup.js` - Test configuration and global mocks

## Key Test Coverage

### Form Validation
- Required field validation for membership applications
- Email format validation
- UK phone number format validation

### Authentication & Authorization
- Bearer token format validation
- Admin credential validation
- Environment variable checks

### Data Processing
- Application ID generation
- Name combination logic
- Date-based sorting

### Frontend Logic
- Form data collection
- API call handling
- Error message formatting
- Gallery photo processing
- FAQ accordion state management

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Pre-commit Hooks

Tests automatically run before each commit via Husky. This prevents commits that break existing functionality.

## CI/CD Integration

Tests also run automatically on GitHub Actions for:
- All pushes to main and develop branches
- All pull requests to main branch
- Multiple Node.js versions (18.x, 20.x)

## Writing New Tests

When adding new features:

1. Add validation logic tests in `validation.test.js`
2. Add frontend interaction tests in `frontend.test.js`  
3. Focus on business logic rather than implementation details
4. Mock external dependencies appropriately

## Test Philosophy

These tests focus on:
- ✅ Core business logic validation
- ✅ Input/output validation
- ✅ Error handling
- ✅ Data transformation logic

Rather than:
- ❌ Complex mocking of external services
- ❌ Implementation-specific details
- ❌ UI rendering (handled by browser testing)

This approach ensures tests remain stable and valuable while preventing regressions in critical functionality.