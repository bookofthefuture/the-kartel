// netlify/functions/get-events.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
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
    console.log('📖 Getting events');

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Create events store
    const eventsStore = getStore({
      name: 'events',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    let events = [];

    try {
      // Try to get the events list
      const eventsList = await eventsStore.get('_list', { type: 'json' });
      
      if (eventsList && Array.isArray(eventsList)) {
        events = eventsList;
        console.log(`✅ Retrieved ${events.length} events from list`);
      } else {
        console.log('📝 No events list found, checking individual entries...');
        
        // Fallback: list all entries and filter
        const allEntries = await eventsStore.list();
        console.log(`📋 Found ${allEntries.blobs.length} total entries`);
        
        for (const entry of allEntries.blobs) {
          if (entry.key !== '_list' && entry.key.startsWith('evt_')) {
            try {
              const eventData = await eventsStore.get(entry.key, { type: 'json' });
              if (eventData && eventData.id) {
                events.push(eventData);
              }
            } catch (error) {
              console.log(`⚠️ Failed to load ${entry.key}:`, error.message);
            }
          }
        }
        
        console.log(`📊 Retrieved ${events.length} individual events`);
      }
    } catch (error) {
      console.error('❌ Error retrieving events:', error.message);
      events = [];
    }

    // --- NEW: Ensure attendees and photos arrays exist for each event ---
    events = events.map(event => {
        // Ensure attendees is an array
        if (!Array.isArray(event.attendees)) {
            event.attendees = [];
        }
        // Ensure photos is an array
        if (!Array.isArray(event.photos)) {
            event.photos = [];
        }
        return event;
    });
    // --- END NEW ---

    // Sort by date (newest first)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ events })
    };

  } catch (error) {
    console.error('💥 Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
