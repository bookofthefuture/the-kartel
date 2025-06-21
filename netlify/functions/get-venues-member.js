// netlify/functions/get-venues-member.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // Authentication check: Requires a valid member token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: No token provided' })
    };
  }

  const token = authHeader.split(' ')[1];
  // A real application would validate this token against a secret or a session store.
  // For this project's simplified authentication, we only check for its presence and length.
  if (!token || token.length < 32) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid token format' })
    };
  }

  try {
    console.log('🏁 Member accessing venues list');

    // Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
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

    let venues = [];
    try {
      // Get venues from blob storage (master list)
      const venuesData = await venuesStore.get('_list', { type: 'json' });
      if (venuesData && Array.isArray(venuesData)) {
        venues = venuesData;
        console.log(`✅ Retrieved ${venues.length} venues for member view`);
      }
    } catch (error) {
      console.log('📝 No existing venues found, returning empty list.');
      venues = []; // Ensure venues is an empty array on error
    }

    // Sort venues by name
    venues.sort((a, b) => a.name.localeCompare(b.name));

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
    console.error('💥 Error fetching venues for member:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
