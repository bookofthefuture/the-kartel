// /.netlify/functions/create-venue.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');

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
    
    const data = JSON.parse(event.body);
    const { name, address, phone, website, notes, drivingTips, vimeoId, trackMap } = data;

    // Validate required fields
    if (!name || !address) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name and address are required' })
      };
    }

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

    // Get existing venues to check for duplicates
    let venues = [];
    try {
      const existingVenues = await venuesStore.get('_list', { type: 'json' });
      if (existingVenues && Array.isArray(existingVenues)) {
        venues = existingVenues;
      }
    } catch (error) {
      console.log('📝 No existing venues found, starting fresh');
      venues = [];
    }

    // Check for duplicate venue names
    const existingVenue = venues.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (existingVenue) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A venue with this name already exists' })
      };
    }

    // Generate venue ID first
    const venueId = `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      name: name.trim(),
      address: address.trim(),
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      notes: notes?.trim() || null,
      drivingTips: drivingTips?.trim() || null,
      vimeoId: vimeoId?.trim() || null,
      trackMapPath: trackMapPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'Admin'
    };

    console.log('📋 Venue created:', newVenue.id);

    // Store individual venue
    await venuesStore.setJSON(newVenue.id, newVenue);
    console.log('✅ Individual venue stored');

    // Add new venue to list
    venues.push(newVenue);

    // Sort venues by date (newest first)
    venues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Store updated list
    await venuesStore.setJSON('_list', venues);
    console.log(`✅ Venues list updated (${venues.length} total)`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
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