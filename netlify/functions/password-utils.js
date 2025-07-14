const crypto = require('crypto');
const { hash: argon2Hash, verify: argon2Verify } = require('@node-rs/argon2');
const { timingSafeStringCompare } = require('./timing-safe-utils');

// OWASP recommended Argon2id parameters for 2025
const ARGON2_CONFIG = {
  memoryCost: 19456,     // 19 MiB
  timeCost: 2,           // 2 iterations
  parallelism: 1,        // 1 degree of parallelism
  variant: 'id'          // Argon2id variant
};

/**
 * Hash password using Argon2id (preferred) or PBKDF2 (legacy)
 * @param {string} password - Plain text password
 * @param {boolean} useLegacy - Force use of legacy PBKDF2 (for testing)
 * @returns {Object} - { hash, algorithm, salt? }
 */
async function hashPasswordAsync(password, useLegacy = false) {
  if (useLegacy) {
    // Legacy PBKDF2 implementation for backward compatibility
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { 
      hash, 
      salt, 
      algorithm: 'pbkdf2' 
    };
  }

  // Modern Argon2id implementation
  try {
    const hash = await argon2Hash(password, ARGON2_CONFIG);
    return { 
      hash, 
      algorithm: 'argon2id' 
    };
  } catch (error) {
    console.error('Argon2 hashing failed, falling back to PBKDF2:', error);
    // Fallback to PBKDF2 if Argon2 fails
    return hashPasswordAsync(password, true);
  }
}

/**
 * Verify password against stored hash (supports both Argon2id and PBKDF2)
 * @param {string} password - Plain text password
 * @param {string} storedHash - Stored hash
 * @param {string} salt - Salt (only for PBKDF2)
 * @param {string} algorithm - Hash algorithm ('argon2id' or 'pbkdf2')
 * @returns {Promise<boolean>} - Verification result
 */
async function verifyPasswordAsync(password, storedHash, salt = null, algorithm = null) {
  // Validate inputs
  if (!password || !storedHash) {
    console.error('Password and stored hash are required for verification');
    return false;
  }

  // Auto-detect algorithm if not specified
  if (!algorithm) {
    // Argon2 hashes start with $argon2id$
    if (storedHash.startsWith('$argon2id$')) {
      algorithm = 'argon2id';
    } else {
      algorithm = 'pbkdf2';
    }
  }

  if (algorithm === 'argon2id') {
    try {
      return await argon2Verify(storedHash, password);
    } catch (error) {
      console.error('Argon2 verification failed:', error);
      return false;
    }
  } else {
    // Legacy PBKDF2 verification
    if (!salt) {
      console.error('Salt required for PBKDF2 verification');
      return false;
    }
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return timingSafeStringCompare(storedHash, verifyHash);
  }
}

/**
 * Check if a hash needs to be upgraded to Argon2id
 * @param {string} algorithm - Current hash algorithm
 * @returns {boolean} - True if upgrade is recommended
 */
function shouldUpgradeHash(algorithm) {
  return algorithm === 'pbkdf2';
}

/**
 * Legacy sync version for backward compatibility (deprecated)
 * @deprecated Use hashPassword() instead
 */
function hashPasswordSync(password) {
  console.warn('hashPasswordSync is deprecated, use async hashPassword() instead');
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash, algorithm: 'pbkdf2' };
}

/**
 * Legacy sync version for backward compatibility (deprecated)
 * @deprecated Use verifyPassword() instead
 */
function verifyPasswordSync(password, salt, hash) {
  console.warn('verifyPasswordSync is deprecated, use async verifyPassword() instead');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return timingSafeStringCompare(hash, verifyHash);
}

/**
 * Wrapper function to maintain backward compatibility
 * Detects sync vs async usage and delegates appropriately
 */
function hashPasswordWrapper(password, useLegacy = false) {
  // For backward compatibility, if this is called without await, use sync version
  const result = hashPasswordSync(password);
  return result;
}

/**
 * Wrapper function to maintain backward compatibility 
 * Old API: verifyPassword(password, salt, hash)
 * New API: verifyPassword(password, hash, salt, algorithm)
 */
function verifyPasswordWrapper(password, saltOrHash, hashOrSalt, algorithm = null) {
  // Detect call pattern - if 3rd param exists, it's old API: (password, salt, hash)
  if (arguments.length >= 3 && hashOrSalt) {
    // Old API: verifyPassword(password, salt, hash)
    return verifyPasswordSync(password, saltOrHash, hashOrSalt);
  } else {
    // New API: verifyPassword(password, hash, salt, algorithm) - return promise for async
    return verifyPasswordAsync(password, saltOrHash, hashOrSalt, algorithm);
  }
}

module.exports = {
  // Backward compatible exports (these will work with existing code)
  hashPassword: hashPasswordWrapper,
  verifyPassword: verifyPasswordWrapper,
  
  // Modern async functions (preferred for new code)
  hashPasswordAsync,
  verifyPasswordAsync,
  shouldUpgradeHash,
  ARGON2_CONFIG,
  
  // Legacy sync functions for explicit use
  hashPasswordSync,
  verifyPasswordSync
};