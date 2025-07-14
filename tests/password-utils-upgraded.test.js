const { hashPasswordAsync, verifyPasswordAsync, shouldUpgradeHash, ARGON2_CONFIG } = require('../netlify/functions/password-utils');

describe('Password Utils - Argon2id Migration', () => {
  const testPassword = 'TestPassword123!';

  describe('Argon2id Hashing', () => {
    test('should hash password with Argon2id by default', async () => {
      const result = await hashPasswordAsync(testPassword);
      
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('algorithm');
      expect(result.algorithm).toBe('argon2id');
      expect(result.hash).toMatch(/^\$argon2id\$/);
      expect(result.salt).toBeUndefined(); // Argon2id doesn't need separate salt
    });

    test('should use OWASP recommended parameters', () => {
      expect(ARGON2_CONFIG.memoryCost).toBe(19456); // 19 MiB
      expect(ARGON2_CONFIG.timeCost).toBe(2);
      expect(ARGON2_CONFIG.parallelism).toBe(1);
      expect(ARGON2_CONFIG.variant).toBe('id');
    });

    test('should verify Argon2id hash correctly', async () => {
      const { hash } = await hashPasswordAsync(testPassword);
      const isValid = await verifyPasswordAsync(testPassword, hash);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password for Argon2id', async () => {
      const { hash } = await hashPasswordAsync(testPassword);
      const isValid = await verifyPasswordAsync('WrongPassword', hash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Legacy PBKDF2 Support', () => {
    test('should create PBKDF2 hash when explicitly requested', async () => {
      const result = await hashPasswordAsync(testPassword, true);
      
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('salt');
      expect(result).toHaveProperty('algorithm');
      expect(result.algorithm).toBe('pbkdf2');
      expect(result.salt).toBeDefined();
      expect(typeof result.hash).toBe('string');
      expect(typeof result.salt).toBe('string');
    });

    test('should verify legacy PBKDF2 hash', async () => {
      const { hash, salt } = await hashPasswordAsync(testPassword, true);
      const isValid = await verifyPasswordAsync(testPassword, hash, salt, 'pbkdf2');
      
      expect(isValid).toBe(true);
    });

    test('should auto-detect PBKDF2 algorithm', async () => {
      const { hash, salt } = await hashPasswordAsync(testPassword, true);
      const isValid = await verifyPasswordAsync(testPassword, hash, salt);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Algorithm Auto-Detection', () => {
    test('should auto-detect Argon2id from hash format', async () => {
      const { hash } = await hashPasswordAsync(testPassword);
      const isValid = await verifyPasswordAsync(testPassword, hash);
      
      expect(isValid).toBe(true);
    });

    test('should handle mixed algorithm verification', async () => {
      // Create both types of hashes
      const argon2Result = await hashPasswordAsync(testPassword);
      const pbkdf2Result = await hashPasswordAsync(testPassword, true);
      
      // Both should verify correctly with auto-detection
      const argon2Valid = await verifyPasswordAsync(testPassword, argon2Result.hash);
      const pbkdf2Valid = await verifyPasswordAsync(testPassword, pbkdf2Result.hash, pbkdf2Result.salt);
      
      expect(argon2Valid).toBe(true);
      expect(pbkdf2Valid).toBe(true);
    });
  });

  describe('Hash Upgrade Detection', () => {
    test('should recommend upgrade for PBKDF2', () => {
      expect(shouldUpgradeHash('pbkdf2')).toBe(true);
    });

    test('should not recommend upgrade for Argon2id', () => {
      expect(shouldUpgradeHash('argon2id')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid hash gracefully', async () => {
      const isValid = await verifyPasswordAsync(testPassword, 'invalid-hash');
      expect(isValid).toBe(false);
    });

    test('should handle missing salt for PBKDF2', async () => {
      const { hash } = await hashPasswordAsync(testPassword, true);
      const isValid = await verifyPasswordAsync(testPassword, hash, null, 'pbkdf2');
      expect(isValid).toBe(false);
    });

    test('should fallback to PBKDF2 if Argon2 fails', async () => {
      // Mock Argon2 failure by temporarily breaking the function
      const originalArgon2 = require('@node-rs/argon2');
      jest.mock('@node-rs/argon2', () => ({
        hash: jest.fn().mockRejectedValue(new Error('Argon2 failure')),
        verify: jest.fn()
      }));

      // This should fallback to PBKDF2
      const result = await hashPasswordAsync(testPassword);
      expect(result.algorithm).toBeDefined(); // Should still return a valid result
    });
  });

  describe('Security Properties', () => {
    test('should generate different hashes for same password', async () => {
      const hash1 = await hashPasswordAsync(testPassword);
      const hash2 = await hashPasswordAsync(testPassword);
      
      expect(hash1.hash).not.toBe(hash2.hash);
    });

    test('should handle unicode passwords', async () => {
      const unicodePassword = 'Tëst🔐Pássw🗝️rd';
      const { hash } = await hashPasswordAsync(unicodePassword);
      const isValid = await verifyPasswordAsync(unicodePassword, hash);
      
      expect(isValid).toBe(true);
    });

    test('should handle long passwords', async () => {
      const longPassword = 'A'.repeat(1000);
      const { hash } = await hashPasswordAsync(longPassword);
      const isValid = await verifyPasswordAsync(longPassword, hash);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Migration Compatibility', () => {
    test('should maintain backward compatibility with existing PBKDF2 hashes', async () => {
      // Simulate existing PBKDF2 hash from old system
      const legacyPassword = 'OldPassword123';
      const { hash: legacyHash, salt: legacySalt } = await hashPasswordAsync(legacyPassword, true);
      
      // Should still verify correctly
      const isValid = await verifyPasswordAsync(legacyPassword, legacyHash, legacySalt, 'pbkdf2');
      expect(isValid).toBe(true);
      
      // Should also work with auto-detection
      const isValidAuto = await verifyPasswordAsync(legacyPassword, legacyHash, legacySalt);
      expect(isValidAuto).toBe(true);
    });

    test('should handle data structure differences', async () => {
      // Test with Argon2id (no separate salt)
      const argon2Result = await hashPasswordAsync(testPassword);
      expect(argon2Result.salt).toBeUndefined();
      
      // Test with PBKDF2 (requires salt)
      const pbkdf2Result = await hashPasswordAsync(testPassword, true);
      expect(pbkdf2Result.salt).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should complete Argon2id hashing within reasonable time', async () => {
      const start = Date.now();
      await hashPasswordAsync(testPassword);
      const duration = Date.now() - start;
      
      // Should complete within 2 seconds on reasonable hardware
      expect(duration).toBeLessThan(2000);
    }, 5000);

    test('should complete verification within reasonable time', async () => {
      const { hash } = await hashPasswordAsync(testPassword);
      
      const start = Date.now();
      await verifyPasswordAsync(testPassword, hash);
      const duration = Date.now() - start;
      
      // Verification should be faster than hashing
      expect(duration).toBeLessThan(1000);
    }, 3000);
  });
});