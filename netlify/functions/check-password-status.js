const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const applicationsList = await applicationsStore.get('_list', { type: 'json' });
    
    if (!applicationsList || !Array.isArray(applicationsList)) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Applications list not found' })
      };
    }

    const tomRecord = applicationsList.find(app => 
      app.email && app.email.toLowerCase() === 'tom@bookofthefuture.co.uk'
    );

    if (!tomRecord) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Tom record not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        email: tomRecord.email,
        hasAdminPasswordHash: !!tomRecord.adminPasswordHash,
        hasAdminPasswordSalt: !!tomRecord.adminPasswordSalt,
        hasMemberPasswordHash: !!tomRecord.memberPasswordHash,
        hasMemberPasswordSalt: !!tomRecord.memberPasswordSalt,
        isAdmin: !!tomRecord.isAdmin,
        passwordFields: Object.keys(tomRecord).filter(key => key.toLowerCase().includes('password'))
      })
    };

  } catch (error) {
    console.error('💥 Error checking password status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};