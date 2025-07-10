// Test setup file for The Kartel tests
// Global mocks and test configuration

// Mock environment variables for tests
process.env.NETLIFY_SITE_ID = 'test-site-id';
process.env.NETLIFY_ACCESS_TOKEN = 'test-access-token';
process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.TEST_FROM_EMAIL = 'test@kartel.com';
process.env.TEST_ADMIN_EMAIL = 'admin@kartel.com';
process.env.SITE_URL = 'https://test-kartel.netlify.app';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};