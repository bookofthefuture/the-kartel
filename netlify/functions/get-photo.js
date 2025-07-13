// netlify/functions/get-photo.js
const { getStore } = require('@netlify/blobs');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    const { path } = event.queryStringParameters || {};
    
    if (!path) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing path parameter' })
      };
    }

    console.log('📸 Getting photo:', path);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Determine which store to use based on path
    const isVenueTrackMap = path.startsWith('venues/');
    const storeName = isVenueTrackMap ? 'venues' : 'photos';
    
    const store = getStore({
      name: storeName,
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get the photo
    const photoData = await store.get(path, { type: 'arrayBuffer' });
    
    if (!photoData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Photo not found' })
      };
    }

    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(photoData);

    return {
      statusCode: 200,
      headers: createSecureHeaders(event, {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
      }),
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('💥 Error getting photo:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};