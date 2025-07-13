// netlify/functions/get-events.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');

exports.handler = async (event, context) => {
  // Validate JWT token
  const authResult = validateAuthHeader(event.headers.authorization);
  if (!authResult.success) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error })
    };
  }

  // Require member role (includes admins)
  const roleCheck = requireRole(['member', 'admin', 'super-admin'])(authResult.payload);
  if (!roleCheck.success) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: roleCheck.error })
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

    // --- ENRICH ATTENDEES WITH CURRENT LINKEDIN DATA ---
    try {
      // Get applications store to access member profiles
      const applicationsStore = getStore({
        name: 'applications',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_ACCESS_TOKEN,
        consistency: 'strong'
      });

      // Get all member applications to lookup LinkedIn data
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      
      if (applicationsList && Array.isArray(applicationsList)) {
        // Create a lookup map of memberId -> LinkedIn profile
        const memberLinkedInMap = {};
        applicationsList.forEach(member => {
          if (member.id && member.linkedin) {
            memberLinkedInMap[member.id] = member.linkedin;
          }
        });

        // Enrich each event's attendees with current LinkedIn data
        events = events.map(event => {
          if (event.attendees && Array.isArray(event.attendees)) {
            event.attendees = event.attendees.map(attendee => {
              // Add current LinkedIn data if available
              if (attendee.memberId && memberLinkedInMap[attendee.memberId]) {
                attendee.linkedin = memberLinkedInMap[attendee.memberId];
              }
              return attendee;
            });
          }
          return event;
        });
        
        console.log('✅ Enriched attendees with LinkedIn data');
      }
    } catch (linkedinError) {
      console.log('⚠️ Failed to enrich LinkedIn data:', linkedinError.message);
      // Continue without LinkedIn enrichment
    }
    // --- END LINKEDIN ENRICHMENT ---

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
