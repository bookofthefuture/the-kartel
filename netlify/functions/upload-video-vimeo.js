// netlify/functions/upload-video-vimeo.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { Vimeo } = require('@vimeo/vimeo');

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
    const { eventId, videoData, fileName, title, description } = JSON.parse(event.body);

    if (!eventId || !videoData || !fileName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Event ID, video data, and file name are required' })
      };
    }

    console.log(`🎥 Uploading video to Vimeo for event ${eventId}: ${fileName}`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Check Vimeo API credentials
    if (!process.env.VIMEO_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Vimeo API not configured' })
      };
    }

    // Initialize Vimeo client
    const vimeoClient = new Vimeo(null, null, process.env.VIMEO_ACCESS_TOKEN);

    // Convert base64 video data to buffer
    const base64Data = videoData.split(',')[1]; // Remove data:video/mp4;base64, prefix
    const videoBuffer = Buffer.from(base64Data, 'base64');

    // Create a temporary file-like object for the upload
    const tempFilePath = `/tmp/${fileName}`;
    require('fs').writeFileSync(tempFilePath, videoBuffer);

    // Upload video to Vimeo
    const uploadResponse = await new Promise((resolve, reject) => {
      vimeoClient.upload(
        tempFilePath,
        {
          name: title || fileName,
          description: description || `Video from ${fileName}`,
          privacy: {
            view: 'unlisted' // Set as unlisted by default for security
          }
        },
        function(uri) {
          // Success callback - uri is the Vimeo video URI like /videos/123456789
          console.log(`✅ Video uploaded successfully: ${uri}`);
          resolve({ uri, videoId: uri.split('/videos/')[1] });
        },
        function(bytesUploaded, bytesTotal) {
          // Progress callback
          const percent = (bytesUploaded / bytesTotal * 100).toFixed(2);
          console.log(`📈 Upload progress: ${percent}%`);
        },
        function(error) {
          // Error callback
          console.error('❌ Vimeo upload error:', error);
          reject(error);
        }
      );
    });

    // Clean up temporary file
    try {
      require('fs').unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.log('⚠️ Could not clean up temp file:', cleanupError.message);
    }

    // Get events store to save video reference
    const eventsStore = getStore({
      name: 'events',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get current event data
    const event = await eventsStore.get(eventId, { type: 'json' });
    if (!event) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Event not found' })
      };
    }

    // Add video information to event
    if (!event.videos) {
      event.videos = [];
    }

    const videoInfo = {
      id: Date.now().toString(),
      vimeoUri: uploadResponse.uri,
      vimeoId: uploadResponse.videoId,
      title: title || fileName,
      description: description || '',
      fileName: fileName,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Admin'
    };

    event.videos.push(videoInfo);

    // Save updated event
    await eventsStore.setJSON(eventId, event);

    // Update events list
    try {
      const eventsList = await eventsStore.get('_list', { type: 'json' });
      if (eventsList && Array.isArray(eventsList)) {
        const eventIndex = eventsList.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
          eventsList[eventIndex] = event;
          await eventsStore.setJSON('_list', eventsList);
          console.log('✅ Events list updated with new video');
        }
      }
    } catch (listError) {
      console.log('⚠️ Failed to update events list:', listError.message);
    }

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        success: true,
        message: 'Video uploaded to Vimeo successfully',
        video: videoInfo,
        vimeoUrl: `https://vimeo.com/${uploadResponse.videoId}`
      })
    };

  } catch (error) {
    console.error('💥 Error uploading video to Vimeo:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};