// netlify/functions/jwt-auth.js
const jwt = require('jsonwebtoken');

const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return secret;
}

function generateToken(payload) {
  const JWT_SECRET = getJwtSecret();
  
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRY,
    issuer: 'the-kartel',
    audience: 'the-kartel-users'
  });
}

function verifyToken(token) {
  const JWT_SECRET = getJwtSecret();
  
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'the-kartel',
      audience: 'the-kartel-users'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

function validateAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return { success: false, error: 'No token provided' };
  }

  try {
    const decoded = verifyToken(token);
    return { success: true, payload: decoded };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function requireRole(allowedRoles) {
  return function(payload) {
    if (!payload.roles || !Array.isArray(payload.roles)) {
      return { success: false, error: 'No roles found in token' };
    }
    
    const hasRole = allowedRoles.some(role => payload.roles.includes(role));
    if (!hasRole) {
      return { success: false, error: 'Insufficient permissions' };
    }
    
    return { success: true };
  };
}

module.exports = {
  generateToken,
  verifyToken,
  validateAuthHeader,
  requireRole
};