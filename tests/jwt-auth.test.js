// tests/jwt-auth.test.js
const { generateToken, verifyToken, validateAuthHeader, requireRole } = require('../netlify/functions/jwt-auth');

// Mock environment variable for testing
process.env.JWT_SECRET = 'test-secret-key-for-jwt-authentication-minimum-32-chars';

describe('JWT Authentication', () => {
  describe('generateToken', () => {
    test('should generate a valid JWT token', () => {
      const payload = {
        userId: 'test-user',
        email: 'test@example.com',
        roles: ['member']
      };

      const token = generateToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    test('should throw error if JWT_SECRET is missing', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => {
        generateToken({ userId: 'test' });
      }).toThrow('JWT_SECRET not configured');

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('verifyToken', () => {
    test('should verify a valid token', () => {
      const payload = {
        userId: 'test-user',
        email: 'test@example.com',
        roles: ['member']
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.roles).toEqual(payload.roles);
    });

    test('should throw error for invalid token', () => {
      expect(() => {
        verifyToken('invalid-token');
      }).toThrow('Invalid token');
    });

    test('should throw error for expired token', () => {
      // Create token with immediate expiry
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'test' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      // Wait a moment to ensure expiry
      setTimeout(() => {
        expect(() => {
          verifyToken(expiredToken);
        }).toThrow('Token expired');
      }, 100);
    });
  });

  describe('validateAuthHeader', () => {
    test('should validate valid authorization header', () => {
      const token = generateToken({ userId: 'test', roles: ['member'] });
      const authHeader = `Bearer ${token}`;

      const result = validateAuthHeader(authHeader);
      expect(result.success).toBe(true);
      expect(result.payload.userId).toBe('test');
    });

    test('should reject missing authorization header', () => {
      const result = validateAuthHeader(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid');
    });

    test('should reject invalid authorization header format', () => {
      const result = validateAuthHeader('Invalid header');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid');
    });

    test('should reject invalid token', () => {
      const result = validateAuthHeader('Bearer invalid-token');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid token');
    });
  });

  describe('requireRole', () => {
    test('should allow access with correct role', () => {
      const payload = { roles: ['admin', 'member'] };
      const roleCheck = requireRole(['admin']);

      const result = roleCheck(payload);
      expect(result.success).toBe(true);
    });

    test('should deny access without required role', () => {
      const payload = { roles: ['member'] };
      const roleCheck = requireRole(['admin']);

      const result = roleCheck(payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
    });

    test('should deny access when no roles in payload', () => {
      const payload = {};
      const roleCheck = requireRole(['admin']);

      const result = roleCheck(payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No roles found');
    });

    test('should allow access with any of multiple allowed roles', () => {
      const payload = { roles: ['member'] };
      const roleCheck = requireRole(['admin', 'member']);

      const result = roleCheck(payload);
      expect(result.success).toBe(true);
    });
  });
});