/**
 * Input Sanitization and Validation Utilities
 * 
 * This module provides comprehensive input sanitization to prevent XSS attacks
 * and ensure data integrity. All user-provided input should be processed
 * through these utilities before storage or use.
 * 
 * Security Features:
 * - HTML entity encoding to prevent XSS
 * - Script tag removal and neutralization
 * - URL validation and sanitization
 * - Email format validation
 * - Phone number sanitization
 * - LinkedIn profile URL cleaning
 * - Length limits and content validation
 */

/**
 * HTML entities that need to be escaped for XSS prevention
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Escape HTML entities to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML context
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str.replace(/[&<>"'`=\/]/g, function(match) {
    return HTML_ENTITIES[match];
  });
}

/**
 * Remove or neutralize potentially dangerous script content
 * @param {string} str - String to clean
 * @returns {string} String with scripts removed/neutralized
 */
function removeScripts(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  // Remove script tags and their content
  str = str.replace(/<script[^>]*>.*?<\/script>/gis, '');
  
  // Remove event handlers (onclick, onload, etc.)
  str = str.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: URLs
  str = str.replace(/javascript\s*:[^"'\s,;)]*/gi, '');
  
  // Remove data: URLs (can contain scripts)
  str = str.replace(/data\s*:[^"'\s,;]*[^"'\s,;]*/gi, '');
  
  // Remove null bytes and control characters
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return str;
}

/**
 * Sanitize a basic text string (names, descriptions, etc.)
 * @param {string} str - String to sanitize
 * @param {Object} options - Sanitization options
 * @param {number} options.maxLength - Maximum allowed length
 * @param {boolean} options.allowNewlines - Whether to allow newline characters
 * @param {boolean} options.trim - Whether to trim whitespace
 * @returns {string} Sanitized string
 */
function sanitizeText(str, options = {}) {
  const {
    maxLength = 1000,
    allowNewlines = false,
    trim = true
  } = options;
  
  if (typeof str !== 'string') {
    return '';
  }
  
  // Remove scripts first
  str = removeScripts(str);
  
  // Escape HTML entities
  str = escapeHtml(str);
  
  // Remove newlines if not allowed, otherwise preserve them
  if (!allowNewlines) {
    str = str.replace(/[\r\n\t]/g, ' ');
    // Normalize whitespace for non-newline text
    str = str.replace(/\s+/g, ' ');
  } else {
    // For newline-allowed text, only normalize consecutive spaces and tabs (not newlines)
    str = str.replace(/[ \t]+/g, ' ').replace(/\t/g, ' ');
  }
  
  // Trim if requested
  if (trim) {
    str = str.trim();
  }
  
  // Enforce length limit
  if (str.length > maxLength) {
    str = str.substring(0, maxLength);
  }
  
  return str;
}

/**
 * Sanitize and validate an email address
 * @param {string} email - Email to sanitize and validate
 * @returns {string} Sanitized email or empty string if invalid
 */
function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }
  
  // Basic sanitization
  email = sanitizeText(email, { maxLength: 254, trim: true });
  
  // Email format validation (RFC 5322 simplified, stricter)
  const emailRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return '';
  }
  
  return email.toLowerCase();
}

/**
 * Sanitize a phone number
 * @param {string} phone - Phone number to sanitize
 * @returns {string} Sanitized phone number
 */
function sanitizePhone(phone) {
  if (typeof phone !== 'string') {
    return '';
  }
  
  // Remove scripts and HTML
  phone = removeScripts(phone);
  phone = escapeHtml(phone);
  
  // Remove all non-digit, non-space, non-dash, non-parentheses, non-plus characters
  phone = phone.replace(/[^\d\s\-\(\)\+]/g, '');
  
  // Normalize whitespace
  phone = phone.replace(/\s+/g, ' ').trim();
  
  // Length limit for phone numbers
  if (phone.length > 20) {
    phone = phone.substring(0, 20);
  }
  
  return phone;
}

/**
 * Sanitize and validate a URL
 * @param {string} url - URL to sanitize
 * @param {Object} options - Validation options
 * @param {string[]} options.allowedProtocols - Allowed URL protocols
 * @param {number} options.maxLength - Maximum URL length
 * @returns {string} Sanitized URL or empty string if invalid
 */
function sanitizeUrl(url, options = {}) {
  const {
    allowedProtocols = ['http:', 'https:'],
    maxLength = 2048
  } = options;
  
  if (typeof url !== 'string') {
    return '';
  }
  
  // Basic sanitization (remove scripts, but don't escape HTML yet)
  url = removeScripts(url);
  url = url.trim();
  
  // Length check
  if (url.length > maxLength) {
    return '';
  }
  
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return '';
    }
    
    // Additional security checks
    if (!urlObj.hostname || urlObj.hostname === '' || urlObj.hostname === '.') {
      return '';
    }
    
    // Return the normalized URL
    return urlObj.toString();
  } catch (error) {
    // Invalid URL format
    return '';
  }
}

/**
 * Sanitize a LinkedIn profile URL
 * @param {string} linkedinUrl - LinkedIn URL to sanitize
 * @returns {string} Sanitized LinkedIn URL or empty string if invalid
 */
function sanitizeLinkedinUrl(linkedinUrl) {
  if (typeof linkedinUrl !== 'string') {
    return '';
  }
  
  // Handle empty or whitespace-only input
  linkedinUrl = linkedinUrl.trim();
  if (!linkedinUrl) {
    return '';
  }
  
  // If it doesn't start with http, assume it's a username/path
  if (!linkedinUrl.startsWith('http')) {
    // Remove leading slash or 'in/' if present
    linkedinUrl = linkedinUrl.replace(/^(\/|in\/)?/, '');
    
    // Construct full LinkedIn URL
    linkedinUrl = `https://www.linkedin.com/in/${linkedinUrl}`;
  }
  
  // Sanitize as URL
  const sanitized = sanitizeUrl(linkedinUrl);
  
  // Validate it's actually a LinkedIn URL and extract hostname to ensure it's legitimate
  if (sanitized) {
    try {
      const urlObj = new URL(sanitized);
      if ((urlObj.hostname === 'www.linkedin.com' || urlObj.hostname === 'linkedin.com') && 
          (urlObj.pathname.startsWith('/in/') || urlObj.pathname.startsWith('/pub/'))) {
        return sanitized;
      }
    } catch (error) {
      // Invalid URL structure
    }
  }
  
  return '';
}

/**
 * Sanitize a complete user application object
 * @param {Object} application - Application data to sanitize
 * @returns {Object} Sanitized application data
 */
function sanitizeApplication(application) {
  if (!application || typeof application !== 'object') {
    return {};
  }
  
  return {
    firstName: sanitizeText(application.firstName, { maxLength: 50 }),
    lastName: sanitizeText(application.lastName, { maxLength: 50 }),
    email: sanitizeEmail(application.email),
    company: sanitizeText(application.company, { maxLength: 100 }),
    position: sanitizeText(application.position, { maxLength: 100 }),
    phone: sanitizePhone(application.phone),
    linkedin: sanitizeLinkedinUrl(application.linkedin),
    experience: sanitizeText(application.experience, { maxLength: 500, allowNewlines: true }),
    interests: sanitizeText(application.interests, { maxLength: 500, allowNewlines: true }),
    referral: sanitizeText(application.referral, { maxLength: 200 })
  };
}

/**
 * Sanitize member profile data
 * @param {Object} profile - Profile data to sanitize
 * @returns {Object} Sanitized profile data
 */
function sanitizeMemberProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return {};
  }
  
  return {
    firstName: sanitizeText(profile.firstName, { maxLength: 50 }),
    lastName: sanitizeText(profile.lastName, { maxLength: 50 }),
    company: sanitizeText(profile.company, { maxLength: 100 }),
    position: sanitizeText(profile.position, { maxLength: 100 }),
    phone: sanitizePhone(profile.phone),
    linkedin: sanitizeLinkedinUrl(profile.linkedin)
  };
}

/**
 * Sanitize event data
 * @param {Object} eventData - Event data to sanitize
 * @returns {Object} Sanitized event data
 */
function sanitizeEvent(eventData) {
  if (!eventData || typeof eventData !== 'object') {
    return {};
  }
  
  return {
    title: sanitizeText(eventData.title, { maxLength: 100 }),
    description: sanitizeText(eventData.description, { maxLength: 1000, allowNewlines: true }),
    venue: sanitizeText(eventData.venue, { maxLength: 100 }),
    date: sanitizeText(eventData.date, { maxLength: 20 }),
    time: sanitizeText(eventData.time, { maxLength: 20 }),
    maxAttendees: typeof eventData.maxAttendees === 'number' ? Math.max(1, Math.min(100, Math.floor(eventData.maxAttendees))) : 0,
    cost: typeof eventData.cost === 'number' ? Math.max(0, Math.min(10000, eventData.cost)) : 0
  };
}

/**
 * Sanitize venue data
 * @param {Object} venueData - Venue data to sanitize
 * @returns {Object} Sanitized venue data
 */
function sanitizeVenue(venueData) {
  if (!venueData || typeof venueData !== 'object') {
    return {};
  }
  
  return {
    name: sanitizeText(venueData.name, { maxLength: 100 }),
    address: sanitizeText(venueData.address, { maxLength: 200 }),
    city: sanitizeText(venueData.city, { maxLength: 50 }),
    postcode: sanitizeText(venueData.postcode, { maxLength: 10 }),
    phone: sanitizePhone(venueData.phone),
    website: sanitizeUrl(venueData.website),
    description: sanitizeText(venueData.description, { maxLength: 500, allowNewlines: true })
  };
}

/**
 * Validate that required fields are present and not empty after sanitization
 * @param {Object} data - Data object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Object} Validation result with isValid boolean and missing fields array
 */
function validateRequiredFields(data, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      missing.push(field);
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing: missing
  };
}

/**
 * Create a sanitized error message (to prevent XSS in error responses)
 * @param {string} message - Error message to sanitize
 * @returns {string} Sanitized error message
 */
function sanitizeErrorMessage(message) {
  return sanitizeText(message, { maxLength: 200 });
}

module.exports = {
  escapeHtml,
  removeScripts,
  sanitizeText,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeLinkedinUrl,
  sanitizeApplication,
  sanitizeMemberProfile,
  sanitizeEvent,
  sanitizeVenue,
  validateRequiredFields,
  sanitizeErrorMessage
};