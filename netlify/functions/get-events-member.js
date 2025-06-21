// netlify/functions/get-events-member.js
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
  // For this project's simplified authentication, we only check for its presence and length,
  // assuming it was issued by member-login.js.
  if (!token || token.length < 32) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid token format' })
    };
  }

  try {
    console.log('📖 Member accessing events list');

    // Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
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
      // Try to get the events list (master list)
      const eventsList = await eventsStore.get('_list', { type: 'json' });

      if (eventsList && Array.isArray(eventsList)) {
        events = eventsList;
        console.log(`✅ Retrieved ${events.length} events from list for member view`);
      } else {
        console.log('📝 No events list found, attempting to list individual entries.');
        // Fallback: list all entries and filter
        const allEntries = await eventsStore.list();
        for (const entry of allEntries.blobs) {
          if (entry.key !== '_list' && entry.key.startsWith('evt_')) {
            try {
              const eventData = await eventsStore.get(entry.key, { type: 'json' });
              if (eventData && eventData.id) {
                events.push(eventData);
              }
            } catch (error) {
              console.log(`⚠️ Failed to load individual event ${entry.key}:`, error.message);
            }
          }
        }
        console.log(`📊 Retrieved ${events.length} individual events for member view`);
      }
    } catch (error) {
      console.error('❌ Error retrieving events from Blob storage:', error.message);
      events = []; // Ensure events is an empty array on error
    }

    // Sort by date (upcoming first, then by time if available)
    events.sort((a, b) => {
        const dateA = new Date(a.date + (a.time ? `T${a.time}` : ''));
        const dateB = new Date(b.date + (b.time ? `T${b.time}` : ''));
        return dateA - dateB; // Ascending order for upcoming events
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ events })
    };

  } catch (error) {
    console.error('💥 Error in get-events-member function:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
