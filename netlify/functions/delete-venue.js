// /.netlify/functions/delete-venue.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'DELETE') {
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
    const { venueId } = JSON.parse(event.body);
    
    if (!venueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Venue ID is required' })
      };
    }

    console.log(`🗑️ Deleting venue ${venueId}`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Create stores
    const venuesStore = getStore({
      name: 'venues',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const eventsStore = getStore({
      name: 'events',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get the venue first to check if it exists
    const venueData = await venuesStore.get(venueId, { type: 'json' });
    
    if (!venueData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Venue not found' })
      };
    }

    // Check if venue is being used by any events
    let events = [];
    try {
      const eventsList = await eventsStore.get('_list', { type: 'json' });
      if (eventsList && Array.isArray(eventsList)) {
        events = eventsList;
      }
    } catch (error) {
      console.log('📝 No existing events found');
      events = [];
    }

    const eventsUsingVenue = events.filter(e => e.venueId === venueId);
    if (eventsUsingVenue.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: `Cannot delete venue. It is being used by ${eventsUsingVenue.length} event(s). Please update or delete those events first.`,
          eventsUsing: eventsUsingVenue.map(e => ({ id: e.id, name: e.name, date: e.date }))
        })
      };
    }

    // Delete the individual venue
    await venuesStore.delete(venueId);
    console.log('✅ Individual venue deleted');

    // Update the venues list
    try {
      const venuesList = await venuesStore.get('_list', { type: 'json' });
      
      if (venuesList && Array.isArray(venuesList)) {
        const updatedList = venuesList.filter(venue => venue.id !== venueId);
        await venuesStore.setJSON('_list', updatedList);
        console.log('✅ Venues list updated');
      }
    } catch (listError) {
      console.log('⚠️ Failed to update venues list:', listError.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: `Venue "${venueData.name}" deleted successfully`
      })
    };

  } catch (error) {
    console.error('💥 Error deleting venue:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};