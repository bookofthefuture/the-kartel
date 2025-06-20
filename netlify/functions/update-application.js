const { createClient } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check for authorization header
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Simple token validation
  const token = authHeader.split(' ')[1];
  if (!token || token.length < 32) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  try {
    const { applicationId, status, notes } = JSON.parse(event.body);

    const blobs = createClient({
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN
    });

    // Get existing applications
    let applications = [];
    try {
      const data = await blobs.get('applications', 'applications.json');
      if (data) {
        applications = JSON.parse(data);
      }
    } catch (error) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Applications not found' })
      };
    }

    // Find and update application
    const appIndex = applications.findIndex(app => app.id === applicationId);
    if (appIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Application not found' })
      };
    }

    applications[appIndex].status = status;
    applications[appIndex].reviewedAt = new Date().toISOString();
    applications[appIndex].reviewedBy = 'Admin';
    if (notes) {
      applications[appIndex].notes = notes;
    }

    // Save updated applications
    await blobs.set('applications', 'applications.json', JSON.stringify(applications, null, 2));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Application updated successfully' 
      })
    };

  } catch (error) {
    console.error('Error updating application:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
