// netlify/functions/delete-application.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'DELETE') {
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

  const token = authHeader.split(' ')[1];
  if (!token || token.length < 32) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  try {
    const { applicationId } = JSON.parse(event.body);
    
    if (!applicationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing applicationId' })
      };
    }

    console.log(`🗑️ Deleting application ${applicationId}`);

    // Check environment variables first
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Manual configuration with explicit credentials
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });
    
    // Check if the application exists
    const application = await applicationsStore.get(applicationId, { type: 'json' });
    
    if (!application) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Application not found' })
      };
    }
    
    // Delete the individual application
    await applicationsStore.delete(applicationId);
    console.log('✅ Individual application deleted');
    
    // Update the applications list
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      
      if (applicationsList && Array.isArray(applicationsList)) {
        const updatedList = applicationsList.filter(app => app.id !== applicationId);
        await applicationsStore.setJSON('_list', updatedList);
        console.log('✅ Applications list updated');
      }
    } catch (listError) {
      console.log('⚠️ Failed to update applications list:', listError.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Application deleted successfully' 
      })
    };

  } catch (error) {
    console.error('💥 Error deleting application:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};