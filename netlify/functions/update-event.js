// netlify/functions/update-event.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate JWT token and require admin role
  const authResult = validateAuthHeader(event.headers.authorization);
  if (!authResult.success) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error })
    };
  }

  // Check if user has admin role
  const roleCheck = requireRole(['admin', 'super-admin'])(authResult.payload);
  if (!roleCheck.success) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }

  try {
    const { eventId, updates } = JSON.parse(event.body);
    
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing eventId' })
      };
    }

    console.log(`🔄 Updating event ${eventId}`);

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

    // Get the specific event
    const eventData = await eventsStore.get(eventId, { type: 'json' });
    
    if (!eventData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Event not found' })
      };
    }

    // Update event with provided data
    const updatedEvent = {
      ...eventData,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin'
    };

    // Save updated event
    await eventsStore.setJSON(eventId, updatedEvent);
    console.log('✅ Event updated');

    // Update the events list
    try {
      const eventsList = await eventsStore.get('_list', { type: 'json' });
      
      if (eventsList && Array.isArray(eventsList)) {
        const eventIndex = eventsList.findIndex(evt => evt.id === eventId);
        if (eventIndex !== -1) {
          eventsList[eventIndex] = updatedEvent;
          // Sort events by date (newest first)
          eventsList.sort((a, b) => new Date(b.date) - new Date(a.date));
          await eventsStore.setJSON('_list', eventsList);
          console.log('✅ Events list updated');
        }
      }
    } catch (listError) {
      console.log('⚠️ Failed to update events list:', listError.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Event updated successfully',
        event: updatedEvent
      })
    };

  } catch (error) {
    console.error('💥 Error updating event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};