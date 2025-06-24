const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.log('Update gallery request received');
        
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('Unauthorized: Missing or invalid auth header');
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const token = authHeader.split(' ')[1];
        if (!token || token.length < 16) {
            console.log('Unauthorized: Invalid token format');
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        const body = JSON.parse(event.body);
        console.log('Request body:', body);
        
        const { photos } = body;
        
        if (!Array.isArray(photos)) {
            console.log('Invalid photos array:', photos);
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Photos must be an array' }) 
            };
        }
        
        if (photos.length > 12) {
            console.log('Too many photos:', photos.length);
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Maximum 12 photos allowed' }) 
            };
        }

        console.log(`Saving ${photos.length} photos to gallery`);

        // Check environment variables
        if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
            console.log('Missing environment variables');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        const store = getStore({
            name: 'kartel-content',
            siteID: process.env.NETLIFY_SITE_ID,
            token: process.env.NETLIFY_ACCESS_TOKEN,
            consistency: 'strong'
        });
        
        const galleryData = {
            photos,
            lastUpdated: new Date().toISOString()
        };
        
        await store.set('gallery', JSON.stringify(galleryData));
        console.log('Gallery saved successfully');
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'Gallery updated successfully' })
        };
    } catch (error) {
        console.error('Error in update-gallery:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
        };
    }
};