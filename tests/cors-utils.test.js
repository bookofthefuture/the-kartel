const {
  getAllowedOrigins,
  isOriginAllowed,
  isValidNetlifyPreviewDomain,
  getSecureCorsHeaders,
  createSecureHeaders,
  handleCorsPreflightRequest
} = require('../netlify/functions/cors-utils');

describe('CORS Security Utilities', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env;
    // Reset environment for each test
    process.env = { ...originalEnv };
    delete process.env.PRODUCTION_DOMAIN;
    delete process.env.PREVIEW_DOMAIN;
    delete process.env.NODE_ENV;
    delete process.env.NETLIFY_DEV;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getAllowedOrigins', () => {
    test('should return production domain when configured', () => {
      process.env.PRODUCTION_DOMAIN = 'thekartel.com';
      
      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://thekartel.com');
    });

    test('should return preview domain when configured', () => {
      process.env.PREVIEW_DOMAIN = 'preview.thekartel.com';
      
      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://preview.thekartel.com');
    });

    test('should include development origins in development mode', () => {
      process.env.NODE_ENV = 'development';
      
      const origins = getAllowedOrigins();
      
      expect(origins).toContain('http://localhost:8888');
      expect(origins).toContain('http://127.0.0.1:8888');
      expect(origins).toContain('http://localhost:3000');
      expect(origins).toContain('http://127.0.0.1:3000');
    });

    test('should include development origins when NETLIFY_DEV is set', () => {
      process.env.NETLIFY_DEV = 'true';
      
      const origins = getAllowedOrigins();
      
      expect(origins).toContain('http://localhost:8888');
    });

    test('should return secure default when no domains configured', () => {
      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://the-kartel.com');
      expect(origins).toHaveLength(1);
    });

    test('should combine production, preview, and development origins', () => {
      process.env.PRODUCTION_DOMAIN = 'thekartel.com';
      process.env.PREVIEW_DOMAIN = 'preview.thekartel.com';
      process.env.NODE_ENV = 'development';
      
      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://thekartel.com');
      expect(origins).toContain('https://preview.thekartel.com');
      expect(origins).toContain('http://localhost:8888');
      expect(origins.length).toBeGreaterThan(3);
    });
  });

  describe('isValidNetlifyPreviewDomain', () => {
    test('should allow valid Netlify deploy preview domains', () => {
      expect(isValidNetlifyPreviewDomain('https://deploy-preview-123--effortless-crumble-9e3c92.netlify.app')).toBe(true);
      expect(isValidNetlifyPreviewDomain('https://deploy-preview-1--effortless-crumble-9e3c92.netlify.app')).toBe(true);
      expect(isValidNetlifyPreviewDomain('https://deploy-preview-999--effortless-crumble-9e3c92.netlify.app')).toBe(true);
    });

    test('should allow valid Netlify branch preview domains', () => {
      expect(isValidNetlifyPreviewDomain('https://feature-branch--effortless-crumble-9e3c92.netlify.app')).toBe(true);
      expect(isValidNetlifyPreviewDomain('https://development--effortless-crumble-9e3c92.netlify.app')).toBe(true);
      expect(isValidNetlifyPreviewDomain('https://fix-bug-123--effortless-crumble-9e3c92.netlify.app')).toBe(true);
    });

    test('should allow main Netlify site domain', () => {
      expect(isValidNetlifyPreviewDomain('https://effortless-crumble-9e3c92.netlify.app')).toBe(true);
    });

    test('should reject invalid Netlify domain patterns', () => {
      expect(isValidNetlifyPreviewDomain('https://deploy-preview-123--wrong-site.netlify.app')).toBe(false);
      expect(isValidNetlifyPreviewDomain('https://evil--effortless-crumble-9e3c92.netlify.com')).toBe(false);
      expect(isValidNetlifyPreviewDomain('http://deploy-preview-123--effortless-crumble-9e3c92.netlify.app')).toBe(false);
      expect(isValidNetlifyPreviewDomain('https://deploy-preview--effortless-crumble-9e3c92.netlify.app')).toBe(false); // Missing number
    });

    test('should reject malicious domain spoofing attempts', () => {
      expect(isValidNetlifyPreviewDomain('https://deploy-preview-123--effortless-crumble-9e3c92.netlify.app.evil.com')).toBe(false);
      expect(isValidNetlifyPreviewDomain('https://evil.deploy-preview-123--effortless-crumble-9e3c92.netlify.app')).toBe(false);
      expect(isValidNetlifyPreviewDomain('https://deploy-preview-123--effortless-crumble-9e3c92.evil.app')).toBe(false);
    });

    test('should handle null/undefined gracefully', () => {
      expect(isValidNetlifyPreviewDomain(null)).toBe(false);
      expect(isValidNetlifyPreviewDomain(undefined)).toBe(false);
      expect(isValidNetlifyPreviewDomain('')).toBe(false);
    });
  });

  describe('isOriginAllowed', () => {
    beforeEach(() => {
      process.env.PRODUCTION_DOMAIN = 'thekartel.com';
      process.env.PREVIEW_DOMAIN = 'preview.thekartel.com';
    });

    test('should allow configured production origin', () => {
      expect(isOriginAllowed('https://thekartel.com')).toBe(true);
    });

    test('should allow configured preview origin', () => {
      expect(isOriginAllowed('https://preview.thekartel.com')).toBe(true);
    });

    test('should allow valid Netlify preview domains', () => {
      expect(isOriginAllowed('https://deploy-preview-123--effortless-crumble-9e3c92.netlify.app')).toBe(true);
      expect(isOriginAllowed('https://feature-branch--effortless-crumble-9e3c92.netlify.app')).toBe(true);
      expect(isOriginAllowed('https://effortless-crumble-9e3c92.netlify.app')).toBe(true);
    });

    test('should reject unauthorized origins', () => {
      expect(isOriginAllowed('https://malicious-site.com')).toBe(false);
      expect(isOriginAllowed('http://thekartel.com')).toBe(false); // Wrong protocol
      expect(isOriginAllowed('https://evil.thekartel.com')).toBe(false); // Subdomain attack
      expect(isOriginAllowed('https://deploy-preview-123--wrong-site.netlify.app')).toBe(false); // Wrong Netlify site
    });

    test('should reject null or undefined origins', () => {
      expect(isOriginAllowed(null)).toBe(false);
      expect(isOriginAllowed(undefined)).toBe(false);
      expect(isOriginAllowed('')).toBe(false);
    });

    test('should allow development origins in development mode', () => {
      process.env.NODE_ENV = 'development';
      
      expect(isOriginAllowed('http://localhost:8888')).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:8888')).toBe(true);
    });
  });

  describe('getSecureCorsHeaders', () => {
    beforeEach(() => {
      process.env.PRODUCTION_DOMAIN = 'thekartel.com';
    });

    test('should return allowed origin for valid requests', () => {
      const event = {
        headers: {
          origin: 'https://thekartel.com'
        }
      };
      
      const headers = getSecureCorsHeaders(event);
      
      expect(headers['Access-Control-Allow-Origin']).toBe('https://thekartel.com');
      expect(headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(headers['Access-Control-Allow-Headers']).toBeDefined();
      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });

    test('should use default origin for invalid requests', () => {
      const event = {
        headers: {
          origin: 'https://malicious-site.com'
        }
      };
      
      const headers = getSecureCorsHeaders(event);
      
      expect(headers['Access-Control-Allow-Origin']).toBe('https://thekartel.com');
    });

    test('should handle missing origin header', () => {
      const event = {
        headers: {}
      };
      
      const headers = getSecureCorsHeaders(event);
      
      expect(headers['Access-Control-Allow-Origin']).toBe('https://thekartel.com');
    });

    test('should handle case-insensitive origin header', () => {
      const event = {
        headers: {
          Origin: 'https://thekartel.com' // Capital O
        }
      };
      
      const headers = getSecureCorsHeaders(event);
      
      expect(headers['Access-Control-Allow-Origin']).toBe('https://thekartel.com');
    });
  });

  describe('createSecureHeaders', () => {
    beforeEach(() => {
      process.env.PRODUCTION_DOMAIN = 'thekartel.com';
    });

    test('should include Content-Type and CORS headers', () => {
      const event = {
        headers: {
          origin: 'https://thekartel.com'
        }
      };
      
      const headers = createSecureHeaders(event);
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://thekartel.com');
      expect(headers['Access-Control-Allow-Methods']).toBeDefined();
    });

    test('should merge additional headers', () => {
      const event = {
        headers: {
          origin: 'https://thekartel.com'
        }
      };
      
      const additionalHeaders = {
        'X-Custom-Header': 'test-value',
        'Cache-Control': 'no-cache'
      };
      
      const headers = createSecureHeaders(event, additionalHeaders);
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://thekartel.com');
      expect(headers['X-Custom-Header']).toBe('test-value');
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    test('should allow additional headers to override defaults', () => {
      const event = {
        headers: {
          origin: 'https://thekartel.com'
        }
      };
      
      const additionalHeaders = {
        'Content-Type': 'text/plain'
      };
      
      const headers = createSecureHeaders(event, additionalHeaders);
      
      expect(headers['Content-Type']).toBe('text/plain');
    });
  });

  describe('handleCorsPreflightRequest', () => {
    beforeEach(() => {
      process.env.PRODUCTION_DOMAIN = 'thekartel.com';
    });

    test('should handle OPTIONS requests with CORS headers', () => {
      const event = {
        httpMethod: 'OPTIONS',
        headers: {
          origin: 'https://thekartel.com'
        }
      };
      
      const response = handleCorsPreflightRequest(event);
      
      expect(response).not.toBeNull();
      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://thekartel.com');
      expect(response.body).toBe('');
    });

    test('should return null for non-OPTIONS requests', () => {
      const event = {
        httpMethod: 'POST',
        headers: {
          origin: 'https://thekartel.com'
        }
      };
      
      const response = handleCorsPreflightRequest(event);
      
      expect(response).toBeNull();
    });

    test('should handle OPTIONS from unauthorized origins', () => {
      const event = {
        httpMethod: 'OPTIONS',
        headers: {
          origin: 'https://malicious-site.com'
        }
      };
      
      const response = handleCorsPreflightRequest(event);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://thekartel.com');
    });
  });

  describe('Security Edge Cases', () => {
    test('should prevent subdomain attacks', () => {
      process.env.PRODUCTION_DOMAIN = 'thekartel.com';
      
      const maliciousOrigins = [
        'https://evil.thekartel.com',
        'https://thekartel.com.evil.com',
        'https://fakethekartel.com',
        'https://thekartel.com:8080'
      ];
      
      maliciousOrigins.forEach(origin => {
        expect(isOriginAllowed(origin)).toBe(false);
      });
    });

    test('should prevent protocol downgrade attacks', () => {
      process.env.PRODUCTION_DOMAIN = 'thekartel.com';
      
      expect(isOriginAllowed('http://thekartel.com')).toBe(false);
      expect(isOriginAllowed('ftp://thekartel.com')).toBe(false);
    });

    test('should handle edge case headers gracefully', () => {
      const event = {
        headers: {
          origin: null,
          Origin: undefined
        }
      };
      
      const headers = getSecureCorsHeaders(event);
      expect(headers['Access-Control-Allow-Origin']).toBeTruthy();
    });
  });
});