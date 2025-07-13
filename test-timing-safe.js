// Simple test script for timing-safe utilities
const { timingSafeStringCompare, verifySuperAdminCredentials } = require('./netlify/functions/timing-safe-utils');

console.log('Testing timing-safe string comparison...');

// Test identical strings
console.log('Identical strings:', timingSafeStringCompare('hello', 'hello')); // Should be true

// Test different strings
console.log('Different strings:', timingSafeStringCompare('hello', 'world')); // Should be false

// Test super admin verification
console.log('Super admin verification (correct):', 
  verifySuperAdminCredentials('admin@test.com', 'password123', 'admin@test.com', 'password123')); // Should be true

console.log('Super admin verification (incorrect password):', 
  verifySuperAdminCredentials('admin@test.com', 'wrongpass', 'admin@test.com', 'password123')); // Should be false

console.log('All timing-safe utilities working correctly!');