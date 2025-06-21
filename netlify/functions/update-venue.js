// /.netlify/functions/update-venue.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check authentication
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
    const { venueId, name, address, phone, website, notes, drivingTips, vimeoId, trackMap } = JSON.parse(event.body);

    if (!venueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Venue ID is required' })
      };
    }

    // Validate required fields
    if (!name || !address) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name and address are required' })
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
    const existingVenue = venues.find(v => v.id !== venueId && v.name.toLowerCase() === name.toLowerCase());
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
      name: name.trim(),
      address: address.trim(),
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      notes: notes?.trim() || null,
      drivingTips: drivingTips?.trim() || null,
      vimeoId: vimeoId?.trim() || null,
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
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