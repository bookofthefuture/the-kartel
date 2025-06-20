
// netlify/functions/get-applications.js
const { createClient } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // Check if user is authenticated and is admin
  const { user } = context.clientContext || {};
  
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Check if user has admin role
  const userRoles = user.app_metadata?.roles || [];
  if (!userRoles.includes('admin')) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Forbidden - Admin access required' })
    };
  }

  try {
    const blobs = createClient({
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN
    });

    // Get applications
    let applications = [];
    try {
      const data = await blobs.get('applications', 'applications.json');
      if (data) {
        applications = JSON.parse(data);
      }
    } catch (error) {
      console.log('No applications found');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ applications })
    };

  } catch (error) {
    console.error('Error fetching applications:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};