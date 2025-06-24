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

        const store = getStore('kartel-content');
        
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