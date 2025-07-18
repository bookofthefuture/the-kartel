// netlify/functions/super-admin-login.js
const crypto = require('crypto');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { sanitizeEmail, sanitizeText } = require('./input-sanitization');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const rawData = JSON.parse(event.body);
    const email = sanitizeEmail(rawData.email);
    const password = sanitizeText(rawData.password, { maxLength: 200 });
    
    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and password are required' })
      };
    }

    console.log(`🔐 Super admin login attempt: ${email}`);

    // Check against super admin credentials from environment variables
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    
    if (!superAdminEmail || !superAdminPassword) {
      console.error('❌ Super admin credentials not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Super admin not configured' })
      };
    }

    // Verify credentials
    if (email.toLowerCase() !== superAdminEmail.toLowerCase() || password !== superAdminPassword) {
      console.log('❌ Invalid super admin credentials');
      return {
        statusCode: 401,
        body: JSON.stringify({ 
          error: 'Invalid credentials',
          success: false 
        })
      };
    }

    // Generate super admin token
    const tokenData = {
      email: superAdminEmail,
      role: 'super-admin',
      timestamp: Date.now()
    };
    
    const token = crypto.createHash('sha256')
      .update(`${JSON.stringify(tokenData)}:${process.env.NETLIFY_ACCESS_TOKEN}`)
      .digest('hex');

    console.log('✅ Super admin authenticated successfully');

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        success: true,
        token: token,
        memberId: 'super-admin',
        memberEmail: superAdminEmail,
        memberFullName: 'Super Administrator',
        memberProfile: {
          firstName: 'Super',
          lastName: 'Administrator',
          company: 'The Kartel Franchise',
          position: 'Super Administrator',
          hasPassword: true
        },
        isAdmin: true,
        isSuperAdmin: true
      })
    };

  } catch (error) {
    console.error('💥 Super admin login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        success: false 
      })
    };
  }
};