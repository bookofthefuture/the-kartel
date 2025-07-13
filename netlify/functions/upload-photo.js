// netlify/functions/upload-photo.js
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
    console.log('📸 Uploading event photo');
    
    const { eventId, photoData, fileName, caption } = JSON.parse(event.body);
    
    if (!eventId || !photoData || !fileName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

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

    // Get the event
    const eventData = await eventsStore.get(eventId, { type: 'json' });
    if (!eventData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Event not found' })
      };
    }

    // Convert base64 to buffer
    const base64Data = photoData.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Generate unique photo ID and path
    const photoId = `photo_${eventId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const photoPath = `events/${eventId}/${photoId}.jpg`;

    // Store the image
    await photosStore.set(photoPath, imageBuffer, {
      metadata: {
        eventId: eventId,
        fileName: fileName,
        caption: caption || '',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Admin',
        contentType: 'image/jpeg'
      }
    });

    console.log('✅ Photo stored:', photoPath);

    // Create photo object
    const photo = {
      id: photoId,
      eventId: eventId,
      fileName: fileName,
      path: photoPath,
      caption: caption || '',
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Admin'
    };

    // Update event with photo reference
    const updatedEvent = {
      ...eventData,
      photos: [...(eventData.photos || []), photo],
      updatedAt: new Date().toISOString()
    };

    await eventsStore.setJSON(eventId, updatedEvent);

    // Update events list
    try {
      const eventsList = await eventsStore.get('_list', { type: 'json' });
      if (eventsList && Array.isArray(eventsList)) {
        const eventIndex = eventsList.findIndex(evt => evt.id === eventId);
        if (eventIndex !== -1) {
          eventsList[eventIndex] = updatedEvent;
          await eventsStore.setJSON('_list', eventsList);
          console.log('✅ Events list updated');
        }
      }
    } catch (listError) {
      console.log('⚠️ Failed to update events list:', listError.message);
    }

    // Update gallery photos list for the main site
    try {
      const galleryStore = getStore({
        name: 'gallery',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_ACCESS_TOKEN,
        consistency: 'strong'
      });

      let galleryPhotos = [];
      try {
        const existingGallery = await galleryStore.get('_list', { type: 'json' });
        if (existingGallery && Array.isArray(existingGallery)) {
          galleryPhotos = existingGallery;
        }
      } catch (error) {
        console.log('📝 No existing gallery, starting fresh');
      }

      // Add photo to gallery
      const galleryPhoto = {
        ...photo,
        eventName: eventData.name,
        eventDate: eventData.date,
        alt: caption || `Photo from ${eventData.name}`,
        src: `/.netlify/functions/get-photo?path=${encodeURIComponent(photoPath)}`
      };

      galleryPhotos.push(galleryPhoto);
      
      // Sort by upload date (newest first)
      galleryPhotos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      await galleryStore.setJSON('_list', galleryPhotos);
      console.log('✅ Gallery updated');

    } catch (galleryError) {
      console.log('⚠️ Failed to update gallery:', galleryError.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Photo uploaded successfully',
        photo: photo
      })
    };

  } catch (error) {
    console.error('💥 Error uploading photo:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};