const { getStore } = require('@netlify/blobs');
const { hashPassword } = require('./password-utils');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { memberId, password } = JSON.parse(event.body);
    const authToken = event.headers.authorization?.replace('Bearer ', '');

    if (!memberId || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Member ID and password are required' })
      };
    }

    if (!authToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    // Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Load applications
    let applications = [];
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      if (applicationsList && Array.isArray(applicationsList)) {
        applications = applicationsList;
      }
    } catch (error) {
      console.log('📝 No applications list found');
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Member not found' })
      };
    }

    // Find member
    const memberApplication = applications.find(
      app => app.id === memberId && app.status === 'approved'
    );

    if (!memberApplication) {
      console.log(`❌ Member not found: ${memberId}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Member not found' })
      };
    }

    console.log(`🔑 Setting password for member: ${memberApplication.email}`);

    // Hash password
    const { salt, hash } = hashPassword(password);

    // Update member with password
    const updatedMember = {
      ...memberApplication,
      memberPasswordHash: hash,
      memberPasswordSalt: salt,
      passwordSetAt: new Date().toISOString()
    };

    // Update applications array
    const updatedApplications = applications.map(app => 
      app.id === memberId ? updatedMember : app
    );

    // Save updated applications
    await applicationsStore.set('_list', updatedApplications);

    console.log(`✅ Password set successfully for member: ${memberApplication.email}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Password set successfully. You can now use password login.'
      })
    };

  } catch (error) {
    console.error('💥 Error setting member password:', error);
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