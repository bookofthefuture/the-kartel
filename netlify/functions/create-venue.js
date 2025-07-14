// /.netlify/functions/create-venue.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { sanitizeVenue, sanitizeText, validateRequiredFields } = require('./input-sanitization');
const { getVenuesList, setItem } = require('./blob-list-utils');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
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
    console.log('🏁 Creating new venue');
    
    const rawData = JSON.parse(event.body);
    const venueData = sanitizeVenue(rawData);
    const trackMap = rawData.trackMap; // Handle file upload separately
    const vimeoId = sanitizeText(rawData.vimeoId, { maxLength: 50 });
    const drivingTips = sanitizeText(rawData.drivingTips, { maxLength: 1000, allowNewlines: true });

    // Validate required fields using sanitized data
    const validation = validateRequiredFields(venueData, ['name', 'address']);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Missing required fields: ${validation.missing.join(', ')}` })
      };
    }

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Store configuration for efficient operations
    const storeConfig = {
      name: 'venues',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    };

    // Get existing venues to check for duplicates using efficient utilities
    const venues = await getVenuesList(storeConfig);

    // Check for duplicate venue names
    const existingVenue = venues.find(v => v.name.toLowerCase() === venueData.name.toLowerCase());
    if (existingVenue) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A venue with this name already exists' })
      };
    }

    // Generate venue ID with ven_ prefix for blob-list-utils compatibility
    const venueId = `ven_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Handle track map upload if provided
    let trackMapPath = null;
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
        
        console.log('✅ Track map uploaded:', trackMapPath);
      } catch (uploadError) {
        console.error('⚠️ Track map upload failed:', uploadError);
        // Continue without track map if upload fails
      }
    }

    // Create venue object
    const newVenue = {
      id: venueId,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'Admin'
    };

    console.log('📋 Venue created:', newVenue.id);

    // Store venue using efficient utilities (no list management needed)
    const success = await setItem(storeConfig, newVenue.id, newVenue);
    if (!success) {
      return {
        statusCode: 500,
        headers: createSecureHeaders(event),
        body: JSON.stringify({ error: 'Failed to store venue' })
      };
    }

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        success: true, 
        venue: newVenue,
        message: 'Venue created successfully'
      })
    };

  } catch (error) {
    console.error('💥 Error creating venue:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};