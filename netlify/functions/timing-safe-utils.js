// netlify/functions/timing-safe-utils.js
const crypto = require('crypto');

/**
 * Performs a timing-safe string comparison to prevent timing attacks.
 * Both strings are converted to buffers to ensure consistent comparison.
 * 
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} - True if strings are equal, false otherwise
 */
function timingSafeStringCompare(a, b) {
  // Handle null/undefined inputs
  if (a == null || b == null) {
    return a === b;
  }
  
  // Convert strings to buffers with consistent encoding
  const bufferA = Buffer.from(String(a), 'utf8');
  const bufferB = Buffer.from(String(b), 'utf8');
  
  // If lengths differ, still do comparison to prevent length-based timing attacks
  // Use the longer length and pad the shorter buffer with zeros
  const maxLength = Math.max(bufferA.length, bufferB.length);
  const paddedA = Buffer.alloc(maxLength);
  const paddedB = Buffer.alloc(maxLength);
  
  bufferA.copy(paddedA);
  bufferB.copy(paddedB);
  
  // Use crypto.timingSafeEqual for constant-time comparison
  // Note: This will return false if lengths were different (due to zero padding)
  const buffersEqual = crypto.timingSafeEqual(paddedA, paddedB);
  
  // Also check if original lengths were equal
  const lengthsEqual = bufferA.length === bufferB.length;
  
  return buffersEqual && lengthsEqual;
}

/**
 * Performs a timing-safe email comparison (case-insensitive).
 * Converts both emails to lowercase before comparison.
 * 
 * @param {string} emailA - First email to compare
 * @param {string} emailB - Second email to compare  
 * @returns {boolean} - True if emails are equal (case-insensitive), false otherwise
 */
function timingSafeEmailCompare(emailA, emailB) {
  if (emailA == null || emailB == null) {
    return emailA === emailB;
  }
  
  const normalizedA = String(emailA).toLowerCase().trim();
  const normalizedB = String(emailB).toLowerCase().trim();
  
  return timingSafeStringCompare(normalizedA, normalizedB);
}

/**
 * Verifies super admin credentials using timing-safe comparison.
 * 
 * @param {string} inputEmail - Email provided by user
 * @param {string} inputPassword - Password provided by user
 * @param {string} expectedEmail - Expected super admin email from environment
 * @param {string} expectedPassword - Expected super admin password from environment
 * @returns {boolean} - True if credentials match, false otherwise
 */
function verifySuperAdminCredentials(inputEmail, inputPassword, expectedEmail, expectedPassword) {
  // Always perform both comparisons to prevent timing attacks
  // even if one fails early
  const emailMatches = timingSafeEmailCompare(inputEmail, expectedEmail);
  const passwordMatches = timingSafeStringCompare(inputPassword, expectedPassword);
  
  return emailMatches && passwordMatches;
}

module.exports = {
  timingSafeStringCompare,
  timingSafeEmailCompare,
  verifySuperAdminCredentials
};