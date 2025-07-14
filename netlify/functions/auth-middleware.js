/**
 * Authentication Middleware Utility
 * 
 * Provides higher-order functions to eliminate code duplication in
 * authentication and authorization checks across serverless functions.
 */

const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { handleCorsPreflightRequest, createSecureHeaders } = require('./cors-utils');

/**
 * Standard HTTP error responses
 */
const HttpErrors = {
    UNAUTHORIZED: {
        statusCode: 401,
        error: 'Unauthorized'
    },
    FORBIDDEN: {
        statusCode: 403, 
        error: 'Forbidden'
    },
    METHOD_NOT_ALLOWED: {
        statusCode: 405,
        error: 'Method not allowed'
    },
    INTERNAL_SERVER_ERROR: {
        statusCode: 500,
        error: 'Internal server error'
    }
};

/**
 * Creates a standardized error response
 * @param {object} event - Netlify function event
 * @param {object} errorConfig - Error configuration
 * @param {string} details - Optional error details
 * @returns {object} Standard error response
 */
function createErrorResponse(event, errorConfig, details = null) {
    const body = { error: errorConfig.error };
    if (details) {
        body.details = details;
    }

    return {
        statusCode: errorConfig.statusCode,
        headers: createSecureHeaders(event),
        body: JSON.stringify(body)
    };
}

/**
 * Creates a standardized success response
 * @param {object} event - Netlify function event
 * @param {object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {object} Standard success response
 */
function createSuccessResponse(event, data, statusCode = 200) {
    return {
        statusCode,
        headers: createSecureHeaders(event),
        body: JSON.stringify(data)
    };
}

/**
 * Validates HTTP method
 * @param {string[]} allowedMethods - Array of allowed HTTP methods
 * @returns {function} Middleware function
 */
function validateHttpMethod(allowedMethods) {
    return function(event) {
        if (!allowedMethods.includes(event.httpMethod)) {
            return createErrorResponse(event, HttpErrors.METHOD_NOT_ALLOWED);
        }
        return null; // Continue processing
    };
}

/**
 * Authentication middleware that validates JWT tokens and role permissions
 * @param {string[]} requiredRoles - Array of required roles (e.g., ['admin', 'member'])
 * @param {object} options - Optional configuration
 * @returns {function} Higher-order function that wraps handlers
 */
function withAuth(requiredRoles = [], options = {}) {
    return function(handler) {
        return async function(event, context) {
            try {
                // Handle CORS preflight
                const corsResponse = handleCorsPreflightRequest(event);
                if (corsResponse) {
                    return corsResponse;
                }

                // Validate JWT token
                const authResult = validateAuthHeader(event.headers.authorization);
                if (!authResult.success) {
                    console.log('🔒 Authentication failed:', authResult.error);
                    return createErrorResponse(event, HttpErrors.UNAUTHORIZED, authResult.error);
                }

                // Check role permissions if required
                if (requiredRoles.length > 0) {
                    const roleCheck = requireRole(requiredRoles)(authResult.payload);
                    if (!roleCheck.success) {
                        console.log('🚫 Authorization failed:', roleCheck.error);
                        return createErrorResponse(event, HttpErrors.FORBIDDEN, roleCheck.error);
                    }
                }

                // Add authenticated user to event context
                event.user = authResult.payload;
                event.isAdmin = authResult.payload.role === 'admin' || authResult.payload.role === 'super-admin';
                event.isSuperAdmin = authResult.payload.role === 'super-admin';

                // Call the original handler
                return await handler(event, context);

            } catch (error) {
                console.error('💥 Auth middleware error:', error.message);
                return createErrorResponse(event, HttpErrors.INTERNAL_SERVER_ERROR, error.message);
            }
        };
    };
}

/**
 * HTTP method validation middleware
 * @param {string[]} allowedMethods - Array of allowed HTTP methods
 * @returns {function} Higher-order function that wraps handlers
 */
function withHttpMethod(allowedMethods) {
    return function(handler) {
        return async function(event, context) {
            // Handle CORS preflight
            const corsResponse = handleCorsPreflightRequest(event);
            if (corsResponse) {
                return corsResponse;
            }

            // Validate HTTP method
            const methodError = validateHttpMethod(allowedMethods)(event);
            if (methodError) {
                return methodError;
            }

            // Call the original handler
            return await handler(event, context);
        };
    };
}

/**
 * Combined middleware for common admin function patterns
 * @param {string[]} allowedMethods - Array of allowed HTTP methods
 * @param {object} options - Optional configuration
 * @returns {function} Higher-order function that wraps handlers
 */
function withAdminAuth(allowedMethods = ['POST'], options = {}) {
    return function(handler) {
        return withAuth(['admin', 'super-admin'], options)(
            withHttpMethod(allowedMethods)(handler)
        );
    };
}

/**
 * Combined middleware for common member function patterns
 * @param {string[]} allowedMethods - Array of allowed HTTP methods
 * @param {object} options - Optional configuration
 * @returns {function} Higher-order function that wraps handlers
 */
function withMemberAuth(allowedMethods = ['POST'], options = {}) {
    return function(handler) {
        return withAuth(['member', 'admin', 'super-admin'], options)(
            withHttpMethod(allowedMethods)(handler)
        );
    };
}

/**
 * Error handling wrapper for standardized error responses
 * @param {function} handler - The handler function to wrap
 * @returns {function} Wrapped handler with error handling
 */
function withErrorHandling(handler) {
    return async function(event, context) {
        try {
            return await handler(event, context);
        } catch (error) {
            console.error('💥 Handler error:', error.message, error.stack);
            return createErrorResponse(event, HttpErrors.INTERNAL_SERVER_ERROR, error.message);
        }
    };
}

/**
 * Complete middleware stack for admin functions
 * Combines method validation, admin authentication, and error handling
 */
function createAdminHandler(handler, allowedMethods = ['POST']) {
    return withErrorHandling(
        withAdminAuth(allowedMethods)(handler)
    );
}

/**
 * Complete middleware stack for member functions
 * Combines method validation, member authentication, and error handling
 */
function createMemberHandler(handler, allowedMethods = ['POST']) {
    return withErrorHandling(
        withMemberAuth(allowedMethods)(handler)
    );
}

/**
 * Complete middleware stack for public functions (no auth required)
 * Combines method validation and error handling
 */
function createPublicHandler(handler, allowedMethods = ['POST']) {
    return withErrorHandling(
        withHttpMethod(allowedMethods)(handler)
    );
}

module.exports = {
    // Error responses
    HttpErrors,
    createErrorResponse,
    createSuccessResponse,
    
    // Individual middleware
    withAuth,
    withHttpMethod,
    withAdminAuth,
    withMemberAuth,
    withErrorHandling,
    
    // Complete handler creators
    createAdminHandler,
    createMemberHandler,
    createPublicHandler,
    
    // Utilities
    validateHttpMethod
};