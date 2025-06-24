const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
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
        
        let faqData;
        try {
            faqData = await store.get('faqs', { type: 'json' });
        } catch (error) {
            faqData = { faqs: [] };
        }
        
        // Sort FAQs by order
        if (faqData.faqs && Array.isArray(faqData.faqs)) {
            faqData.faqs.sort((a, b) => (a.order || 999) - (b.order || 999));
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(faqData)
        };
    } catch (error) {
        console.error('Error in get-faqs:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};