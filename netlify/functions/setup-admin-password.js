// netlify/functions/setup-admin-password.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { token, password } = JSON.parse(event.body);
    
    console.log(`🔑 Setting up admin password for token: ${token?.substring(0, 8)}...`);

    // Validate required fields
    if (!token || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Token and password are required' })
      };
    }

    // Validate password strength
    if (password.length < 8) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password must be at least 8 characters long' })
      };
    }

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
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or expired setup token' })
      };
    }

    // Check if token is expired
    if (new Date() > new Date(tokenData.expiresAt)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Setup token has expired' })
      };
    }

    // Check if token has already been used
    if (tokenData.used) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Setup token has already been used' })
      };
    }

    // Hash the password
    const { salt, hash } = hashPassword(password);

    // Get the applicant's data
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const application = await applicationsStore.get(tokenData.applicationId, { type: 'json' });
    
    if (!application) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Application not found' })
      };
    }

    // Update application with admin credentials
    const updatedApplication = {
      ...application,
      isAdmin: true,
      adminPasswordSalt: salt,
      adminPasswordHash: hash,
      adminSetupCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'System'
    };

    // Save updated application
    await applicationsStore.setJSON(tokenData.applicationId, updatedApplication);

    // Update applications list
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      
      if (applicationsList && Array.isArray(applicationsList)) {
        const appIndex = applicationsList.findIndex(app => app.id === tokenData.applicationId);
        if (appIndex !== -1) {
          applicationsList[appIndex] = updatedApplication;
          await applicationsStore.setJSON('_list', applicationsList);
          console.log('✅ Applications list updated with admin credentials');
        }
      }
    } catch (listError) {
      console.log('⚠️ Failed to update applications list:', listError.message);
    }

    // Mark token as used
    const usedTokenData = {
      ...tokenData,
      used: true,
      usedAt: new Date().toISOString()
    };
    await tokensStore.setJSON(token, usedTokenData);

    console.log(`✅ Admin password setup completed for ${tokenData.email}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Admin password setup completed successfully',
        redirectUrl: '/admin.html'
      })
    };

  } catch (error) {
    console.error('💥 Error setting up admin password:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to setup admin password',
        details: error.message
      })
    };
  }
};