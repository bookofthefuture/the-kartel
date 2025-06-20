// netlify/functions/get-photo.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
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

    const photosStore = getStore({
      name: 'photos',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get the photo
    const photoData = await photosStore.get(path, { type: 'arrayBuffer' });
    
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
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*'
      },
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