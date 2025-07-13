// netlify/functions/validate-setup-token.js
const { getStore } = require('@netlify/blobs');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const token = event.queryStringParameters?.token;
    
    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Token parameter is required' })
      };
    }

    console.log(`🔍 Validating setup token: ${token.substring(0, 8)}...`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Get the setup token
    const tokensStore = getStore({
      name: 'admin-tokens',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const tokenData = await tokensStore.get(token, { type: 'json' });
    
    if (!tokenData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Invalid setup token' 
        })
      };
    }

    // Check if token is expired
    if (new Date() > new Date(tokenData.expiresAt)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Setup token has expired' 
        })
      };
    }

    // Check if token has already been used
    if (tokenData.used) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Setup token has already been used' 
        })
      };
    }

    console.log(`✅ Setup token is valid for: ${tokenData.email}`);

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        valid: true,
        user: {
          firstName: tokenData.firstName,
          lastName: tokenData.lastName,
          email: tokenData.email
        }
      })
    };

  } catch (error) {
    console.error('💥 Error validating setup token:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        valid: false,
        error: 'Internal server error'
      })
    };
  }
};