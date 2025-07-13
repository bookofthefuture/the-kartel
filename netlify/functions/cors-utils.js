const crypto = require('crypto');

/**
 * CORS Security Utility
 * 
 * This module provides secure CORS (Cross-Origin Resource Sharing) handling
 * by validating request origins against a whitelist of allowed domains.
 * 
 * Security Features:
 * - Domain validation against environment variable whitelist
 * - Development mode support with localhost origins
 * - Fallback to secure defaults when environment variables are missing
 * - Protection against origin spoofing attacks
 */

/**
 * Get allowed origins from environment variables
 * @returns {string[]} Array of allowed origin URLs
 */
function getAllowedOrigins() {
  const allowedOrigins = [];
  
  // Production domain
  if (process.env.PRODUCTION_DOMAIN) {
    allowedOrigins.push(`https://${process.env.PRODUCTION_DOMAIN}`);
  }
  
  // Specific preview/staging domain (if configured)
  if (process.env.PREVIEW_DOMAIN) {
    allowedOrigins.push(`https://${process.env.PREVIEW_DOMAIN}`);
  }
  
  // Development domains
  if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV) {
    allowedOrigins.push('http://localhost:8888');
    allowedOrigins.push('http://127.0.0.1:8888');
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://127.0.0.1:3000');
  }
  
  // Fallback to secure default if no domains configured
  if (allowedOrigins.length === 0) {
    console.warn('⚠️ No CORS origins configured. Using restrictive default.');
    allowedOrigins.push('https://the-kartel.com');
  }
  
  return allowedOrigins;
}

/**
 * Check if origin is a valid Netlify preview domain for this site
 * @param {string} origin - The origin to validate
 * @returns {boolean} True if it's a valid Netlify preview domain
 */
function isValidNetlifyPreviewDomain(origin) {
  if (!origin) {
    return false;
  }
  
  // Expected site name from Netlify
  const siteName = 'effortless-crumble-9e3c92';
  
  // Netlify preview domain patterns:
  // - Deploy previews: https://deploy-preview-123--effortless-crumble-9e3c92.netlify.app
  // - Branch previews: https://branch-name--effortless-crumble-9e3c92.netlify.app
  // - Main site: https://effortless-crumble-9e3c92.netlify.app
  
  const netlifyPatterns = [
    // Deploy previews (must have number after deploy-preview-)
    new RegExp(`^https:\\/\\/deploy-preview-\\d+--${siteName}\\.netlify\\.app$`),
    // Branch previews (not starting with deploy-preview-, must have valid branch name)
    new RegExp(`^https:\\/\\/(?!deploy-preview-)[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]--${siteName}\\.netlify\\.app$`),
    // Single character branch names
    new RegExp(`^https:\\/\\/(?!deploy-preview-)[a-zA-Z0-9]--${siteName}\\.netlify\\.app$`),
    // Main site
    new RegExp(`^https:\\/\\/${siteName}\\.netlify\\.app$`)
  ];
  
  return netlifyPatterns.some(pattern => pattern.test(origin));
}

/**
 * Validate if an origin is allowed
 * @param {string} origin - The origin to validate
 * @returns {boolean} True if origin is allowed
 */
function isOriginAllowed(origin) {
  if (!origin) {
    return false;
  }
  
  // Check against explicitly allowed origins
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // Check if it's a valid Netlify preview domain
  return isValidNetlifyPreviewDomain(origin);
}

/**
 * Get secure CORS headers for a request
 * @param {Object} event - Netlify function event object
 * @returns {Object} CORS headers object
 */
function getSecureCorsHeaders(event) {
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = getAllowedOrigins();
  
  // Base CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
  
  // Validate origin and set appropriate Access-Control-Allow-Origin
  if (origin && isOriginAllowed(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    console.log(`✅ CORS: Allowed origin ${origin}`);
  } else {
    // For requests without origin (server-to-server) or invalid origins,
    // we set to the first allowed origin as a secure default
    corsHeaders['Access-Control-Allow-Origin'] = allowedOrigins[0];
    if (origin) {
      console.warn(`⚠️ CORS: Rejected origin ${origin}. Using default: ${allowedOrigins[0]}`);
    }
  }
  
  return corsHeaders;
}

/**
 * Create standardized response headers with secure CORS
 * @param {Object} event - Netlify function event object  
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Complete headers object with CORS
 */
function createSecureHeaders(event, additionalHeaders = {}) {
  return {
    'Content-Type': 'application/json',
    ...getSecureCorsHeaders(event),
    ...additionalHeaders
  };
}

/**
 * Handle CORS preflight requests
 * @param {Object} event - Netlify function event object
 * @returns {Object|null} Response for OPTIONS request, or null for other methods
 */
function handleCorsPreflightRequest(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getSecureCorsHeaders(event),
      body: ''
    };
  }
  return null;
}

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  isValidNetlifyPreviewDomain,
  getSecureCorsHeaders,
  createSecureHeaders,
  handleCorsPreflightRequest
};