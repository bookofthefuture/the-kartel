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

        const store = getStore('kartel-content');

        // Check if FAQs already exist
        let existingData;
        try {
            existingData = await store.get('faqs', { type: 'json' });
            if (existingData && existingData.faqs && existingData.faqs.length > 0) {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: true, message: 'FAQs already exist, skipping seed' })
                };
            }
        } catch (error) {
            // FAQs don't exist, proceed with seeding
        }

        // Seed data from existing static FAQs
        const seedFaqs = [
            {
                id: '1',
                question: 'How much does membership cost?',
                answer: 'Membership is free right now. You just pay for your karting session and any food or drinks afterwards.\n\nYou can choose to pay for membership of TeamSport to reduce the cost of each karting session (see below).',
                order: 1
            },
            {
                id: '2',
                question: 'How much does a karting session cost?',
                answer: 'This depends on which track we go to, and which type of race we do. But most often we will be going to TeamSport Victoria.\n\nHeadline costs for the Ultimate Race Experience here, including 2x15 minute sessions, is around £45, but you can reduce this cost in a number of ways:\n\n1. Use the code GET10 at checkout to take 10% of the cost.\n2. Join TeamSport as a member. The basic membership tier (\'Social\') costs £7.99 a year and reduces the cost of each session by 20%.\n3. The middle (\'Club\') and upper (\'Elite\') tiers cost £24.99 and £34.99 per year respectively and save you 25% on each booking, along with other benefits.\n4. Make sure you buy a Race Again voucher every time you go. This secures your next session at just £17.99. You can buy these at the track, or if you are a member, by clicking through the email you receive following the event titled "GRID Loyalty Update."\n5. Every booking with TeamSport as a member accumulates 100 loyalty points. You get a free session every time you collect 600 points.\n6. Members also receive a free booking on their birthdays.\n\nFollow these tips and go regularly, and the average cost per session can be under £25.',
                order: 2
            },
            {
                id: '3',
                question: 'Where do you operate?',
                answer: 'Right now we only operate in Manchester, UK, but we are open to franchising the idea out to other cities around the UK, and internationally. Fill out the form to join and tell us about your interest in franchising in the message box, if this is something you would like to discuss.',
                order: 3
            },
            {
                id: '4',
                question: 'How can I apply for membership?',
                answer: 'You can apply for membership by submitting the application form on our website. Membership is selective, and all applications are personally reviewed to ensure a high-quality, engaged community. Successful applicants gain access to our private WhatsApp community.',
                order: 4
            }
        ];

        const faqData = {
            faqs: seedFaqs,
            lastUpdated: new Date().toISOString()
        };

        await store.set('faqs', JSON.stringify(faqData));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                message: `Successfully seeded ${seedFaqs.length} FAQs` 
            })
        };
    } catch (error) {
        console.error('Error in seed-faqs:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};