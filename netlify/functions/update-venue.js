// /.netlify/functions/update-venue.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { sanitizeVenue, sanitizeText, validateRequiredFields } = require('./input-sanitization');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check authentication
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
    const rawData = JSON.parse(event.body);
    const venueId = sanitizeText(rawData.venueId, { maxLength: 100 });
    const venueData = sanitizeVenue(rawData);
    const trackMap = rawData.trackMap; // Handle file upload separately
    const vimeoId = sanitizeText(rawData.vimeoId, { maxLength: 50 });
    const drivingTips = sanitizeText(rawData.drivingTips, { maxLength: 1000, allowNewlines: true });

    if (!venueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Venue ID is required' })
      };
    }

    // Validate required fields using sanitized data
    const validation = validateRequiredFields(venueData, ['name', 'address']);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Missing required fields: ${validation.missing.join(', ')}` })
      };
    }

    console.log(`🔄 Updating venue ${venueId}`);

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

    // Get the specific venue
    const venueData = await venuesStore.get(venueId, { type: 'json' });
    
    if (!venueData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Venue not found' })
      };
    }

    // Get venues list to check for duplicate names
    let venues = [];
    try {
      const venuesList = await venuesStore.get('_list', { type: 'json' });
      if (venuesList && Array.isArray(venuesList)) {
        venues = venuesList;
      }
    } catch (error) {
      console.log('📝 No existing venues list found');
      venues = [];
    }

    // Check for duplicate names (excluding current venue)
    const existingVenue = venues.find(v => v.id !== venueId && v.name.toLowerCase() === venueData.name.toLowerCase());
    if (existingVenue) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A venue with this name already exists' })
      };
    }

    // Handle track map upload if provided
    let trackMapPath = venueData.trackMapPath; // Keep existing path
    if (trackMap && trackMap.data) {
      try {
        // Extract base64 data
        const base64Data = trackMap.data.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Generate unique filename
        const extension = trackMap.fileName.split('.').pop().toLowerCase();
        trackMapPath = `venues/${venueId}/track-map.${extension}`;
        
        // Store the track map
        await venuesStore.set(trackMapPath, buffer, {
          metadata: {
            contentType: trackMap.fileType,
            originalName: trackMap.fileName,
            uploadedAt: new Date().toISOString()
          }
        });
        
        console.log('✅ Track map updated:', trackMapPath);
      } catch (uploadError) {
        console.error('⚠️ Track map upload failed:', uploadError);
        // Keep existing track map if upload fails
      }
    }

    // Update venue with provided data
    const updatedVenue = {
      ...venueData,
      name: venueData.name,
      address: venueData.address,
      city: venueData.city,
      postcode: venueData.postcode,
      phone: venueData.phone,
      website: venueData.website,
      description: venueData.description,
      drivingTips: drivingTips,
      vimeoId: vimeoId,
      trackMapPath: trackMapPath,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin'
    };

    // Save updated venue
    await venuesStore.setJSON(venueId, updatedVenue);
    console.log('✅ Venue updated');

    // Update the venues list
    try {
      const venueIndex = venues.findIndex(v => v.id === venueId);
      if (venueIndex !== -1) {
        venues[venueIndex] = updatedVenue;
        // Sort venues by date (newest first)
        venues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        await venuesStore.setJSON('_list', venues);
        console.log('✅ Venues list updated');
      }
    } catch (listError) {
      console.log('⚠️ Failed to update venues list:', listError.message);
    }

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        success: true, 
        venue: updatedVenue,
        message: 'Venue updated successfully'
      })
    };

  } catch (error) {
    console.error('💥 Error updating venue:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};