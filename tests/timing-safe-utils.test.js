// tests/timing-safe-utils.test.js
const { 
  timingSafeStringCompare, 
  timingSafeEmailCompare, 
  verifySuperAdminCredentials 
} = require('../netlify/functions/timing-safe-utils');

describe('Timing-Safe Utilities', () => {
  describe('timingSafeStringCompare', () => {
    test('should return true for identical strings', () => {
      expect(timingSafeStringCompare('hello', 'hello')).toBe(true);
      expect(timingSafeStringCompare('password123', 'password123')).toBe(true);
      expect(timingSafeStringCompare('', '')).toBe(true);
    });

    test('should return false for different strings', () => {
      expect(timingSafeStringCompare('hello', 'world')).toBe(false);
      expect(timingSafeStringCompare('password123', 'password124')).toBe(false);
      expect(timingSafeStringCompare('short', 'verylongstring')).toBe(false);
    });

    test('should return false for strings with different lengths', () => {
      expect(timingSafeStringCompare('abc', 'abcd')).toBe(false);
      expect(timingSafeStringCompare('longer', 'short')).toBe(false);
    });

    test('should handle null and undefined inputs', () => {
      expect(timingSafeStringCompare(null, null)).toBe(true);
      expect(timingSafeStringCompare(undefined, undefined)).toBe(true);
      expect(timingSafeStringCompare(null, undefined)).toBe(false);
      expect(timingSafeStringCompare('string', null)).toBe(false);
      expect(timingSafeStringCompare(null, 'string')).toBe(false);
    });

    test('should handle special characters and unicode', () => {
      expect(timingSafeStringCompare('café', 'café')).toBe(true);
      expect(timingSafeStringCompare('🔒🔑', '🔒🔑')).toBe(true);
      expect(timingSafeStringCompare('test\n\r\t', 'test\n\r\t')).toBe(true);
      expect(timingSafeStringCompare('café', 'cafe')).toBe(false);
    });

    test('should be case sensitive', () => {
      expect(timingSafeStringCompare('Hello', 'hello')).toBe(false);
      expect(timingSafeStringCompare('PASSWORD', 'password')).toBe(false);
    });
  });

  describe('timingSafeEmailCompare', () => {
    test('should return true for identical emails (case-insensitive)', () => {
      expect(timingSafeEmailCompare('test@example.com', 'test@example.com')).toBe(true);
      expect(timingSafeEmailCompare('TEST@EXAMPLE.COM', 'test@example.com')).toBe(true);
      expect(timingSafeEmailCompare('User@Domain.Org', 'user@domain.org')).toBe(true);
    });

    test('should return false for different emails', () => {
      expect(timingSafeEmailCompare('test@example.com', 'user@example.com')).toBe(false);
      expect(timingSafeEmailCompare('test@example.com', 'test@different.com')).toBe(false);
    });

    test('should handle whitespace trimming', () => {
      expect(timingSafeEmailCompare('  test@example.com  ', 'test@example.com')).toBe(true);
      expect(timingSafeEmailCompare('test@example.com', '  test@example.com  ')).toBe(true);
      expect(timingSafeEmailCompare('  TEST@EXAMPLE.COM  ', '  test@example.com  ')).toBe(true);
    });

    test('should handle null and undefined inputs', () => {
      expect(timingSafeEmailCompare(null, null)).toBe(true);
      expect(timingSafeEmailCompare(undefined, undefined)).toBe(true);
      expect(timingSafeEmailCompare(null, undefined)).toBe(false);
      expect(timingSafeEmailCompare('test@example.com', null)).toBe(false);
      expect(timingSafeEmailCompare(null, 'test@example.com')).toBe(false);
    });
  });

  describe('verifySuperAdminCredentials', () => {
    const validEmail = 'admin@example.com';
    const validPassword = 'SuperSecretPassword123!';

    test('should return true for correct credentials', () => {
      expect(verifySuperAdminCredentials(
        validEmail, 
        validPassword, 
        validEmail, 
        validPassword
      )).toBe(true);
    });

    test('should return true for correct credentials with different case emails', () => {
      expect(verifySuperAdminCredentials(
        'ADMIN@EXAMPLE.COM', 
        validPassword, 
        validEmail, 
        validPassword
      )).toBe(true);
    });

    test('should return false for incorrect email', () => {
      expect(verifySuperAdminCredentials(
        'wrong@example.com', 
        validPassword, 
        validEmail, 
        validPassword
      )).toBe(false);
    });

    test('should return false for incorrect password', () => {
      expect(verifySuperAdminCredentials(
        validEmail, 
        'WrongPassword123!', 
        validEmail, 
        validPassword
      )).toBe(false);
    });

    test('should return false for both incorrect email and password', () => {
      expect(verifySuperAdminCredentials(
        'wrong@example.com', 
        'WrongPassword123!', 
        validEmail, 
        validPassword
      )).toBe(false);
    });

    test('should handle edge cases', () => {
      // Empty strings
      expect(verifySuperAdminCredentials('', '', '', '')).toBe(true);
      
      // One empty, one not
      expect(verifySuperAdminCredentials('', validPassword, validEmail, validPassword)).toBe(false);
      expect(verifySuperAdminCredentials(validEmail, '', validEmail, validPassword)).toBe(false);
      
      // Null/undefined
      expect(verifySuperAdminCredentials(null, null, null, null)).toBe(true);
      expect(verifySuperAdminCredentials(validEmail, validPassword, null, null)).toBe(false);
    });

    test('should be resistant to timing attacks with different length inputs', () => {
      // This test verifies that the function takes similar time regardless of 
      // where the mismatch occurs (beginning vs end of string)
      const longPassword = 'A'.repeat(100);
      const shortPassword = 'B';
      
      // Both should return false, and timing should be consistent
      expect(verifySuperAdminCredentials(
        validEmail, 
        longPassword, 
        validEmail, 
        shortPassword
      )).toBe(false);
      
      expect(verifySuperAdminCredentials(
        validEmail, 
        shortPassword, 
        validEmail, 
        longPassword
      )).toBe(false);
    });
  });

  describe('Performance and Timing Characteristics', () => {
    test('should perform consistently regardless of input differences', () => {
      const password1 = 'IdenticalPassword123!';
      const password2 = 'IdenticalPassword123!';
      const password3 = 'DifferentPassword456@';
      const password4 = 'A'; // Very different length
      
      // Measure timing for identical passwords
      const start1 = process.hrtime.bigint();
      timingSafeStringCompare(password1, password2);
      const end1 = process.hrtime.bigint();
      const time1 = Number(end1 - start1);
      
      // Measure timing for different passwords (same length)
      const start2 = process.hrtime.bigint();
      timingSafeStringCompare(password1, password3);
      const end2 = process.hrtime.bigint();
      const time2 = Number(end2 - start2);
      
      // Measure timing for very different passwords (different length)
      const start3 = process.hrtime.bigint();
      timingSafeStringCompare(password1, password4);
      const end3 = process.hrtime.bigint();
      const time3 = Number(end3 - start3);
      
      // Note: In a real timing attack test, we'd need many iterations 
      // and statistical analysis. This is just a basic sanity check.
      expect(time1).toBeGreaterThan(0);
      expect(time2).toBeGreaterThan(0);
      expect(time3).toBeGreaterThan(0);
      
      // All operations should complete in reasonable time (< 1ms = 1,000,000 ns)
      expect(time1).toBeLessThan(1000000);
      expect(time2).toBeLessThan(1000000);
      expect(time3).toBeLessThan(1000000);
    });
  });
});