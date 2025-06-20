// netlify/functions/get-gallery.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  try {
    console.log('🖼️ Getting gallery photos');

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const galleryStore = getStore({
      name: 'gallery',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    let photos = [];

    try {
      // Get the gallery photos list
      const galleryPhotos = await galleryStore.get('_list', { type: 'json' });
      
      if (galleryPhotos && Array.isArray(galleryPhotos)) {
        photos = galleryPhotos;
        console.log(`✅ Retrieved ${photos.length} photos from gallery`);
      } else {
        console.log('📝 No gallery photos found');
      }
    } catch (error) {
      console.error('❌ Error retrieving gallery photos:', error.message);
      photos = [];
    }

    // Sort by upload date (newest first)
    photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ photos })
    };

  } catch (error) {
    console.error('💥 Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};