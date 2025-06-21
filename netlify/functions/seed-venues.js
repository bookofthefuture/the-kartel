// /.netlify/functions/seed-venues.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

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
    console.log('🌱 Seeding default venues');

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
    
    // Check for existing venues
    let existingVenues = [];
    try {
      const venuesData = await venuesStore.get('_list', { type: 'json' });
      if (venuesData && Array.isArray(venuesData)) {
        existingVenues = venuesData;
      }
    } catch (error) {
      console.log('📝 No existing venues found');
      existingVenues = [];
    }

    // Only seed if no venues exist
    if (existingVenues.length > 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Venues already exist. Seeding skipped.',
          existingCount: existingVenues.length
        })
      };
    }

    const timestamp = new Date().toISOString();
    const seedVenues = [
      {
        id: `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'TeamSport Victoria',
        address: 'Great Ducie Street, Manchester M3 1PR',
        phone: '0161 637 0637',
        website: 'https://www.team-sport.co.uk/go-karting/manchester-city-centre/',
        notes: 'Our primary venue. Indoor karting, excellent facilities. Use code GET10 for 10% off.',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'System'
      },
      {
        id: `venue_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'TeamSport Stretford',
        address: 'Barton Dock Road, Stretford, Manchester M32 0ZH',
        phone: '0161 865 0070',
        website: 'https://www.team-sport.co.uk/go-karting/manchester-trafford/',
        notes: 'Alternative venue with outdoor track. Good for larger groups.',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'System'
      }
    ];

    // Store individual venues
    for (const venue of seedVenues) {
      await venuesStore.setJSON(venue.id, venue);
      console.log(`✅ Stored venue: ${venue.name}`);
    }

    // Store venues list
    await venuesStore.setJSON('_list', seedVenues);
    console.log(`✅ Venues list created with ${seedVenues.length} venues`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true,
        message: 'Default venues created successfully',
        venues: seedVenues
      })
    };
  } catch (error) {
    console.error('💥 Error seeding venues:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};