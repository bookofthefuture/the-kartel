// /.netlify/functions/get-venues.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // Check authentication
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
    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Create venues store
    const venuesStore = getStore({
      name: 'venues',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });
    
    // Get venues from blob storage
    let venues = [];
    try {
      const venuesData = await venuesStore.get('_list', { type: 'json' });
      if (venuesData && Array.isArray(venuesData)) {
        venues = venuesData;
      }
    } catch (error) {
      console.log('📝 No existing venues found, starting fresh');
      venues = [];
    }
    
    // Sort venues by creation date (newest first)
    venues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        venues: venues
      })
    };
  } catch (error) {
    console.error('💥 Error fetching venues:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};