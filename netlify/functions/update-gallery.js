const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const { photos } = JSON.parse(event.body);
        
        if (!Array.isArray(photos) || photos.length > 12) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Invalid photos array or exceeds maximum of 12 photos' }) 
            };
        }

        const store = getStore('kartel-content');
        
        const galleryData = {
            photos,
            lastUpdated: new Date().toISOString()
        };
        
        await store.set('gallery', JSON.stringify(galleryData));
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'Gallery updated successfully' })
        };
    } catch (error) {
        console.error('Error in update-gallery:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};