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

        const { vimeoId } = JSON.parse(event.body);
        
        if (!vimeoId || typeof vimeoId !== 'string') {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Valid Vimeo ID is required' }) 
            };
        }

        // Basic validation for Vimeo ID (should be numeric)
        if (!/^\d+$/.test(vimeoId.trim())) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Vimeo ID should be numeric' }) 
            };
        }

        // Check environment variables
        if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
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
        
        const videoData = {
            vimeoId: vimeoId.trim(),
            lastUpdated: new Date().toISOString()
        };
        
        await store.set('experience-video', JSON.stringify(videoData));
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'Experience video updated successfully' })
        };
    } catch (error) {
        console.error('Error in update-experience-video:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};