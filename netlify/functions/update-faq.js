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

        const faqData = JSON.parse(event.body);
        
        if (!faqData.question || !faqData.answer) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Question and answer are required' }) 
            };
        }

        const store = getStore('kartel-content');
        
        // Get existing FAQs
        let existingData;
        try {
            existingData = await store.get('faqs', { type: 'json' });
        } catch (error) {
            existingData = { faqs: [] };
        }
        
        let faqs = existingData.faqs || [];
        
        // Check if updating existing FAQ
        const existingIndex = faqs.findIndex(f => f.id === faqData.id);
        
        const faq = {
            id: faqData.id,
            question: faqData.question,
            answer: faqData.answer,
            order: faqData.order || (faqs.length + 1),
            lastUpdated: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
            faqs[existingIndex] = faq;
        } else {
            faqs.push(faq);
        }
        
        const updatedData = {
            faqs,
            lastUpdated: new Date().toISOString()
        };
        
        await store.set('faqs', JSON.stringify(updatedData));
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'FAQ saved successfully' })
        };
    } catch (error) {
        console.error('Error in update-faq:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};