// netlify/functions/verify-login-token.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { token } = JSON.parse(event.body);

    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Token is required' })
      };
    }

    console.log(`🔍 Verifying login token`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const tokenStore = getStore({
      name: 'login-tokens',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get token data
    const tokenData = await tokenStore.get(token, { type: 'json' });

    if (!tokenData) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired login link' })
      };
    }

    // Check if token is expired
    if (new Date() > new Date(tokenData.expiresAt)) {
      await tokenStore.delete(token); // Clean up expired token
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Login link has expired' })
      };
    }

    // Check if token was already used
    if (tokenData.used) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Login link has already been used' })
      };
    }

    // Get member data
    const member = await applicationsStore.get(tokenData.memberId, { type: 'json' });

    if (!member || member.status !== 'approved') {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Member account not found or not active' })
      };
    }

    // Mark token as used
    tokenData.used = true;
    tokenData.usedAt = new Date().toISOString();
    await tokenStore.setJSON(token, tokenData);

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    console.log(`✅ Login successful for: ${member.email}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        token: sessionToken,
        memberId: member.id,
        memberEmail: member.email,
        memberFullName: member.fullName || `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
        isAdmin: !!member.isAdmin,
        // Complete member profile data (consistent with member-login.js)
        memberProfile: {
          firstName: member.firstName,
          lastName: member.lastName,
          company: member.company,
          position: member.position,
          phone: member.phone,
          linkedin: member.linkedin,
          hasPassword: !!(member.memberPasswordHash && member.memberPasswordSalt)
        },
        message: 'Login successful'
      })
    };

  } catch (error) {
    console.error('💥 Error verifying login token:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};