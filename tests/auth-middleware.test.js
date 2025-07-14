/**
 * Tests for auth-middleware.js utility
 */

const {
    HttpErrors,
    createErrorResponse,
    createSuccessResponse,
    withAuth,
    withHttpMethod,
    createAdminHandler,
    createMemberHandler,
    createPublicHandler
} = require('../netlify/functions/auth-middleware');

// Mock dependencies
jest.mock('../netlify/functions/jwt-auth', () => ({
    validateAuthHeader: jest.fn(),
    requireRole: jest.fn()
}));

jest.mock('../netlify/functions/cors-utils', () => ({
    handleCorsPreflightRequest: jest.fn(),
    createSecureHeaders: jest.fn(() => ({ 'Content-Type': 'application/json' }))
}));

const { validateAuthHeader, requireRole } = require('../netlify/functions/jwt-auth');
const { handleCorsPreflightRequest } = require('../netlify/functions/cors-utils');

describe('Auth Middleware', () => {
    const mockEvent = {
        httpMethod: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: '{"test": true}'
    };

    const mockContext = {};

    beforeEach(() => {
        jest.clearAllMocks();
        handleCorsPreflightRequest.mockReturnValue(null);
    });

    describe('createErrorResponse', () => {
        test('should create standard error response', () => {
            const result = createErrorResponse(mockEvent, HttpErrors.UNAUTHORIZED);

            expect(result).toEqual({
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unauthorized' })
            });
        });

        test('should include error details when provided', () => {
            const result = createErrorResponse(mockEvent, HttpErrors.INTERNAL_SERVER_ERROR, 'Something went wrong');

            expect(result).toEqual({
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Internal server error',
                    details: 'Something went wrong'
                })
            });
        });
    });

    describe('createSuccessResponse', () => {
        test('should create standard success response', () => {
            const data = { success: true, message: 'Operation completed' };
            const result = createSuccessResponse(mockEvent, data);

            expect(result).toEqual({
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        });

        test('should support custom status codes', () => {
            const data = { created: true };
            const result = createSuccessResponse(mockEvent, data, 201);

            expect(result).toEqual({
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        });
    });

    describe('withAuth', () => {
        const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: '{"success": true}' });

        beforeEach(() => {
            mockHandler.mockClear();
        });

        test('should allow request with valid auth and matching role', async () => {
            validateAuthHeader.mockReturnValue({
                success: true,
                payload: { email: 'admin@test.com', role: 'admin' }
            });
            requireRole.mockReturnValue(() => ({ success: true }));

            const wrappedHandler = withAuth(['admin'])(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(validateAuthHeader).toHaveBeenCalledWith('Bearer valid-token');
            expect(mockHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    user: { email: 'admin@test.com', role: 'admin' },
                    isAdmin: true,
                    isSuperAdmin: false
                }),
                mockContext
            );
            expect(result).toEqual({ statusCode: 200, body: '{"success": true}' });
        });

        test('should reject request with invalid auth', async () => {
            validateAuthHeader.mockReturnValue({
                success: false,
                error: 'Invalid token'
            });

            const wrappedHandler = withAuth(['admin'])(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(mockHandler).not.toHaveBeenCalled();
            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Unauthorized',
                details: 'Invalid token'
            });
        });

        test('should reject request with insufficient role', async () => {
            validateAuthHeader.mockReturnValue({
                success: true,
                payload: { email: 'member@test.com', role: 'member' }
            });
            requireRole.mockReturnValue(() => ({
                success: false,
                error: 'Insufficient permissions'
            }));

            const wrappedHandler = withAuth(['admin'])(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(mockHandler).not.toHaveBeenCalled();
            expect(result.statusCode).toBe(403);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Forbidden',
                details: 'Insufficient permissions'
            });
        });

        test('should handle CORS preflight requests', async () => {
            const corsResponse = { statusCode: 200, headers: {} };
            handleCorsPreflightRequest.mockReturnValue(corsResponse);

            const wrappedHandler = withAuth(['admin'])(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(result).toBe(corsResponse);
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('should handle handler errors', async () => {
            validateAuthHeader.mockReturnValue({
                success: true,
                payload: { email: 'admin@test.com', role: 'admin' }
            });
            requireRole.mockReturnValue(() => ({ success: true }));
            mockHandler.mockRejectedValue(new Error('Handler failed'));

            const wrappedHandler = withAuth(['admin'])(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Internal server error',
                details: 'Handler failed'
            });
        });

        test('should set super admin flag correctly', async () => {
            validateAuthHeader.mockReturnValue({
                success: true,
                payload: { email: 'superadmin@test.com', role: 'super-admin' }
            });
            requireRole.mockReturnValue(() => ({ success: true }));

            const wrappedHandler = withAuth(['admin'])(mockHandler);
            await wrappedHandler(mockEvent, mockContext);

            expect(mockHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    user: { email: 'superadmin@test.com', role: 'super-admin' },
                    isAdmin: true,
                    isSuperAdmin: true
                }),
                mockContext
            );
        });
    });

    describe('withHttpMethod', () => {
        const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: '{"success": true}' });

        beforeEach(() => {
            mockHandler.mockClear();
        });

        test('should allow request with correct HTTP method', async () => {
            const wrappedHandler = withHttpMethod(['POST'])(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext);
            expect(result).toEqual({ statusCode: 200, body: '{"success": true}' });
        });

        test('should reject request with incorrect HTTP method', async () => {
            const getEvent = { ...mockEvent, httpMethod: 'GET' };
            const wrappedHandler = withHttpMethod(['POST'])(mockHandler);
            const result = await wrappedHandler(getEvent, mockContext);

            expect(mockHandler).not.toHaveBeenCalled();
            expect(result.statusCode).toBe(405);
            expect(JSON.parse(result.body)).toEqual({
                error: 'Method not allowed'
            });
        });

        test('should allow multiple HTTP methods', async () => {
            const getEvent = { ...mockEvent, httpMethod: 'GET' };
            const wrappedHandler = withHttpMethod(['GET', 'POST'])(mockHandler);
            const result = await wrappedHandler(getEvent, mockContext);

            expect(mockHandler).toHaveBeenCalledWith(getEvent, mockContext);
            expect(result).toEqual({ statusCode: 200, body: '{"success": true}' });
        });
    });

    describe('createAdminHandler', () => {
        const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: '{"success": true}' });

        beforeEach(() => {
            mockHandler.mockClear();
        });

        test('should create complete admin handler stack', async () => {
            validateAuthHeader.mockReturnValue({
                success: true,
                payload: { email: 'admin@test.com', role: 'admin' }
            });
            requireRole.mockReturnValue(() => ({ success: true }));

            const handler = createAdminHandler(mockHandler);
            const result = await handler(mockEvent, mockContext);

            expect(validateAuthHeader).toHaveBeenCalled();
            expect(mockHandler).toHaveBeenCalled();
            expect(result).toEqual({ statusCode: 200, body: '{"success": true}' });
        });

        test('should reject non-admin users', async () => {
            validateAuthHeader.mockReturnValue({
                success: true,
                payload: { email: 'member@test.com', role: 'member' }
            });
            requireRole.mockReturnValue(() => ({
                success: false,
                error: 'Admin access required'
            }));

            const handler = createAdminHandler(mockHandler);
            const result = await handler(mockEvent, mockContext);

            expect(mockHandler).not.toHaveBeenCalled();
            expect(result.statusCode).toBe(403);
        });
    });

    describe('createMemberHandler', () => {
        const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: '{"success": true}' });

        beforeEach(() => {
            mockHandler.mockClear();
        });

        test('should allow members and admins', async () => {
            validateAuthHeader.mockReturnValue({
                success: true,
                payload: { email: 'member@test.com', role: 'member' }
            });
            requireRole.mockReturnValue(() => ({ success: true }));

            const handler = createMemberHandler(mockHandler);
            const result = await handler(mockEvent, mockContext);

            expect(mockHandler).toHaveBeenCalled();
            expect(result).toEqual({ statusCode: 200, body: '{"success": true}' });
        });
    });

    describe('createPublicHandler', () => {
        const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: '{"success": true}' });

        beforeEach(() => {
            mockHandler.mockClear();
        });

        test('should allow requests without authentication', async () => {
            const handler = createPublicHandler(mockHandler);
            const result = await handler(mockEvent, mockContext);

            expect(validateAuthHeader).not.toHaveBeenCalled();
            expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext);
            expect(result).toEqual({ statusCode: 200, body: '{"success": true}' });
        });

        test('should still validate HTTP methods', async () => {
            const getEvent = { ...mockEvent, httpMethod: 'GET' };
            const handler = createPublicHandler(mockHandler, ['POST']);
            const result = await handler(getEvent, mockContext);

            expect(mockHandler).not.toHaveBeenCalled();
            expect(result.statusCode).toBe(405);
        });
    });
});