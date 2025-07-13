// netlify/functions/cancel-sign-up.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  // 1. HTTP method validation
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // 2. Authentication check: Requires a valid member token
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
    const { eventId, memberId } = JSON.parse(event.body);

    if (!eventId || !memberId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing eventId or memberId' })
      };
    }

    console.log(`📝 Member ${memberId} attempting to cancel sign-up for event ${eventId}`);

    // 3. Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // 4. Create events store
    const eventsStore = getStore({
      name: 'events',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get the specific event
    const eventData = await eventsStore.get(eventId, { type: 'json' });

    if (!eventData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Event not found' })
      };
    }

    // Ensure attendees array exists
    if (!eventData.attendees) {
      eventData.attendees = [];
    }

    // Find and remove the attendee (check both id and memberId for compatibility)
    const initialAttendeesCount = eventData.attendees.length;
    eventData.attendees = eventData.attendees.filter(attendee => 
      attendee.memberId !== memberId && attendee.id !== memberId
    );

    if (eventData.attendees.length === initialAttendeesCount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'You are not signed up for this event.' })
      };
    }

    // Update event in Blob storage
    await eventsStore.setJSON(eventId, eventData);
    console.log(`✅ Member ${memberId} cancelled sign-up for event ${eventId}`);

    // Update the master events list to reflect the change
    try {
        let eventsList = await eventsStore.get('_list', { type: 'json' });
        if (eventsList && Array.isArray(eventsList)) {
            const eventIndex = eventsList.findIndex(e => e.id === eventId);
            if (eventIndex !== -1) {
                eventsList[eventIndex] = eventData; // Update the event in the list
                await eventsStore.setJSON('_list', eventsList);
                console.log('✅ Master events list updated after sign-up cancellation.');
            } else {
                console.warn('⚠️ Event not found in master list during sign-up cancellation update.');
            }
        }
    } catch (listError) {
        console.error('❌ Error updating master events list during sign-up cancellation:', listError.message);
    }

    // 5. Standard success response
    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        success: true,
        message: 'Successfully cancelled sign-up for the event.'
      })
    };

  } catch (error) {
    // 6. Standard error response
    console.error('💥 Error during event sign-up cancellation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
