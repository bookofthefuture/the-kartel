const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'DELETE') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const { id } = JSON.parse(event.body);
        
        if (!id) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'FAQ ID is required' }) 
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
        
        // Get existing FAQs
        let existingData;
        try {
            existingData = await store.get('faqs', { type: 'json' });
        } catch (error) {
            return { 
                statusCode: 404, 
                body: JSON.stringify({ error: 'FAQ not found' }) 
            };
        }
        
        let faqs = existingData.faqs || [];
        
        // Remove FAQ with matching ID
        const initialLength = faqs.length;
        faqs = faqs.filter(f => f.id !== id);
        
        if (faqs.length === initialLength) {
            return { 
                statusCode: 404, 
                body: JSON.stringify({ error: 'FAQ not found' }) 
            };
        }
        
        const updatedData = {
            faqs,
            lastUpdated: new Date().toISOString()
        };
        
        await store.set('faqs', JSON.stringify(updatedData));
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'FAQ deleted successfully' })
        };
    } catch (error) {
        console.error('Error in delete-faq:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};