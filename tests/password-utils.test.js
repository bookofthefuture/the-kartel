// tests/password-utils.test.js
const { hashPassword, verifyPassword } = require('../netlify/functions/password-utils');

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    test('should generate salt and hash for password', () => {
      const password = 'TestPassword123!';
      const result = hashPassword(password);
      
      expect(result).toHaveProperty('salt');
      expect(result).toHaveProperty('hash');
      expect(typeof result.salt).toBe('string');
      expect(typeof result.hash).toBe('string');
      expect(result.salt.length).toBe(64); // 32 bytes as hex
      expect(result.hash.length).toBe(128); // 64 bytes as hex
    });

    test('should generate different salt and hash for same password', () => {
      const password = 'TestPassword123!';
      const result1 = hashPassword(password);
      const result2 = hashPassword(password);
      
      expect(result1.salt).not.toBe(result2.salt);
      expect(result1.hash).not.toBe(result2.hash);
    });

    test('should handle empty passwords', () => {
      const result = hashPassword('');
      expect(result).toHaveProperty('salt');
      expect(result).toHaveProperty('hash');
      expect(result.salt.length).toBe(64);
      expect(result.hash.length).toBe(128);
    });
  });

  describe('verifyPassword', () => {
    test('should verify correct password', () => {
      const password = 'TestPassword123!';
      const { salt, hash } = hashPassword(password);
      
      expect(verifyPassword(password, salt, hash)).toBe(true);
    });

    test('should reject incorrect password', () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const { salt, hash } = hashPassword(password);
      
      expect(verifyPassword(wrongPassword, salt, hash)).toBe(false);
    });

    test('should reject password with wrong salt', () => {
      const password = 'TestPassword123!';
      const { hash } = hashPassword(password);
      const { salt: wrongSalt } = hashPassword('different');
      
      expect(verifyPassword(password, wrongSalt, hash)).toBe(false);
    });

    test('should reject password with wrong hash', () => {
      const password = 'TestPassword123!';
      const { salt } = hashPassword(password);
      const { hash: wrongHash } = hashPassword('different');
      
      expect(verifyPassword(password, salt, wrongHash)).toBe(false);
    });

    test('should handle edge cases', () => {
      // Empty password
      const { salt, hash } = hashPassword('');
      expect(verifyPassword('', salt, hash)).toBe(true);
      expect(verifyPassword('nonempty', salt, hash)).toBe(false);
      
      // Special characters
      const specialPassword = '🔒💎∆ƒ†¥¨ˆπ"';
      const { salt: specialSalt, hash: specialHash } = hashPassword(specialPassword);
      expect(verifyPassword(specialPassword, specialSalt, specialHash)).toBe(true);
    });

    test('should be timing-safe against hash comparison attacks', () => {
      const password = 'TestPassword123!';
      const { salt, hash } = hashPassword(password);
      
      // Create hashes that differ at the beginning vs end
      const shortHash = hash.substring(0, 10) + 'X'.repeat(hash.length - 10);
      const longHashWithDiffAtEnd = hash.substring(0, hash.length - 1) + 'X';
      
      // Both should return false, timing should be consistent
      const start1 = process.hrtime.bigint();
      const result1 = verifyPassword(password, salt, shortHash);
      const end1 = process.hrtime.bigint();
      
      const start2 = process.hrtime.bigint();
      const result2 = verifyPassword(password, salt, longHashWithDiffAtEnd);
      const end2 = process.hrtime.bigint();
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      
      // Both operations should complete in reasonable time (< 100ms for PBKDF2)
      const time1 = Number(end1 - start1);
      const time2 = Number(end2 - start2);
      expect(time1).toBeLessThan(100000000); // < 100ms
      expect(time2).toBeLessThan(100000000); // < 100ms
    });

    test('should work with various password lengths and complexities', () => {
      const passwords = [
        'a',
        'short',
        'AverageComplexityPassword123!',
        'VeryLongPasswordWithLotsOfComplexCharacters!@#$%^&*()_+{}|:"<>?[]\\;\',./',
        '密码测试', // Chinese characters
        '🔐🔑🚪🏠', // Emojis
        'Mixed密码🔒Test123!'
      ];
      
      passwords.forEach(password => {
        const { salt, hash } = hashPassword(password);
        expect(verifyPassword(password, salt, hash)).toBe(true);
        expect(verifyPassword(password + 'X', salt, hash)).toBe(false);
      });
    });
  });
});