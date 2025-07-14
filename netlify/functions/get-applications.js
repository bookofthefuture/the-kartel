// netlify/functions/get-applications.js - Updated for efficient list management
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { getApplicationsList } = require('./blob-list-utils');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  // Check authorization
  // Validate JWT token and require admin role
  const authResult = validateAuthHeader(event.headers.authorization);
  if (!authResult.success) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error })
    };
  }

  // Check if user has admin role
  const roleCheck = requireRole(['admin', 'super-admin'])(authResult.payload);
  if (!roleCheck.success) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }

  try {
    console.log('📖 Getting applications with efficient list management...');
    
    // Check environment variables first
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables:');
      console.error('NETLIFY_SITE_ID:', !!process.env.NETLIFY_SITE_ID);
      console.error('NETLIFY_ACCESS_TOKEN:', !!process.env.NETLIFY_ACCESS_TOKEN);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Server configuration error - missing credentials',
          debug: {
            hasSiteId: !!process.env.NETLIFY_SITE_ID,
            hasToken: !!process.env.NETLIFY_ACCESS_TOKEN
          }
        })
      };
    }
    
    console.log('✅ Environment variables present');
    
    // Store configuration for efficient list operations
    const storeConfig = {
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    };
    
    // Use efficient list utility
    const applications = await getApplicationsList(storeConfig);
    
    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ applications })
    };

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('💥 Stack:', error.stack);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};