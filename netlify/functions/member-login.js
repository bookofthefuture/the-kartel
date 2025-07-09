// netlify/functions/member-login.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto'); // Used for generating a simple token
const { verifyPassword } = require('./password-utils');

exports.handler = async (event, context) => {
  // 1. HTTP method validation
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Determine authentication method based on password presence
    const isPasswordAuth = password !== undefined;

    // 2. Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // 3. Create store with consistent config
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // 4. Business logic: Check for approved member
    console.log(`🔒 Attempting member login for: ${email} (method: ${isPasswordAuth ? 'password' : 'magic link only'})`);

    let applications = [];
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      if (applicationsList && Array.isArray(applicationsList)) {
        applications = applicationsList;
      }
    } catch (error) {
      console.log('📝 No applications list found, treating as empty for login check.');
      applications = [];
    }

    const memberApplication = applications.find(
      app => app.email.toLowerCase() === email.toLowerCase() && app.status === 'approved'
    );

    if (!memberApplication) {
      console.log(`❌ Failed login attempt for: ${email} (Not found or not approved)`);
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid credentials or application not approved' })
      };
    }

    // Handle password authentication
    if (isPasswordAuth) {
      // Check if member has password set
      if (!memberApplication.memberPasswordHash || !memberApplication.memberPasswordSalt) {
        console.log(`❌ Password login attempted for ${email} but no password set`);
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Password not set. Please use magic link login or contact admin.' })
        };
      }

      // Verify password
      if (!verifyPassword(password, memberApplication.memberPasswordSalt, memberApplication.memberPasswordHash)) {
        console.log(`❌ Invalid password for member: ${email}`);
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Invalid credentials' })
        };
      }

      console.log(`✅ Member password login successful for: ${email}`);
    } else {
      // Magic link only authentication (existing behavior)
      console.log(`✅ Member magic link login successful for: ${email}`);
    }

    // Generate a simple token (similar to admin-login for consistency)
    const token = crypto.randomBytes(32).toString('hex');

    // 5. Standard success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        token: token,
        memberId: memberApplication.id, // Return member ID
        memberEmail: memberApplication.email,
        memberFullName: memberApplication.fullName || `${memberApplication.firstName || ''} ${memberApplication.lastName || ''}`.trim() || memberApplication.email,
        message: 'Login successful'
      })
    };

  } catch (error) {
    // 6. Standard error response
    console.error('💥 Error during member login:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
