// netlify/functions/delete-event.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  if (event.httpMethod !== 'DELETE') {
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
    const { eventId } = JSON.parse(event.body);
    
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing eventId' })
      };
    }

    console.log(`🗑️ Deleting event ${eventId}`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Create stores
    const eventsStore = getStore({
      name: 'events',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const photosStore = getStore({
      name: 'photos',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const galleryStore = getStore({
      name: 'gallery',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get the event first to check if it exists and get photo info
    const eventData = await eventsStore.get(eventId, { type: 'json' });
    
    if (!eventData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Event not found' })
      };
    }

    // Delete associated photos first
    if (eventData.photos && eventData.photos.length > 0) {
      console.log(`🗑️ Deleting ${eventData.photos.length} photos`);
      
      for (const photo of eventData.photos) {
        try {
          // Delete photo from photos store
          await photosStore.delete(photo.path);
          console.log(`✅ Deleted photo: ${photo.path}`);
        } catch (photoError) {
          console.log(`⚠️ Failed to delete photo ${photo.path}:`, photoError.message);
        }
      }

      // Remove photos from gallery
      try {
        const galleryPhotos = await galleryStore.get('_list', { type: 'json' });
        if (galleryPhotos && Array.isArray(galleryPhotos)) {
          const updatedGallery = galleryPhotos.filter(photo => photo.eventId !== eventId);
          await galleryStore.setJSON('_list', updatedGallery);
          console.log('✅ Gallery updated');
        }
      } catch (galleryError) {
        console.log('⚠️ Failed to update gallery:', galleryError.message);
      }
    }

    // Delete the individual event
    await eventsStore.delete(eventId);
    console.log('✅ Individual event deleted');

    // Update the events list
    try {
      const eventsList = await eventsStore.get('_list', { type: 'json' });
      
      if (eventsList && Array.isArray(eventsList)) {
        const updatedList = eventsList.filter(evt => evt.id !== eventId);
        await eventsStore.setJSON('_list', updatedList);
        console.log('✅ Events list updated');
      }
    } catch (listError) {
      console.log('⚠️ Failed to update events list:', listError.message);
    }

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        success: true, 
        message: 'Event and associated photos deleted successfully' 
      })
    };

  } catch (error) {
    console.error('💥 Error deleting event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};