  // netlify/functions/sign-up-event.js
  const { getStore } = require('@netlify/blobs');

  exports.handler = async (event, context) => {
    // 1. HTTP method validation
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // 2. Authentication check: Requires a valid member token
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized: No token provided' })
      };
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.length < 32) { // Simplified token validation
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized: Invalid token format' })
      };
    }

    try {
      const requestBody = JSON.parse(event.body);
      console.log('📝 Received request body:', JSON.stringify(requestBody, null, 2));
      
      const { eventId, memberId, memberName, memberEmail, memberCompany } = requestBody;
      
      console.log('📋 Extracted fields:', { eventId, memberId, memberName, memberEmail, memberCompany });

      if (!eventId || !memberId || !memberName || !memberEmail) {
        console.log('❌ Missing required fields check:', {
          eventId: !!eventId,
          memberId: !!memberId, 
          memberName: !!memberName,
          memberEmail: !!memberEmail
        });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing required attendee details' })
        };
      }

      console.log(`📝 Member ${memberId} attempting to sign up for event ${eventId}`);

      // 3. Environment variable check
      if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
        console.error('❌ Missing environment variables for Blob storage.');
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Server configuration error' })
        };
      }

      // 4. Create events store
      const eventsStore = getStore({
        name: 'events',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_ACCESS_TOKEN,
        consistency: 'strong'
      });

      // Get the specific event
      const eventData = await eventsStore.get(eventId, { type: 'json' });

      if (!eventData) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Event not found' })
        };
      }

      // Initialize attendees array if it doesn't exist
      if (!eventData.attendees) {
        eventData.attendees = [];
      }

      // Check if member is already signed up
      const isAlreadySignedUp = eventData.attendees.some(attendee => attendee.memberId === memberId);
      if (isAlreadySignedUp) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'You are already signed up for this event.' })
        };
      }

      // Create new attendee object
      const newAttendee = {
        memberId: memberId,
        name: memberName,
        email: memberEmail,
        company: memberCompany || '', // Include company if provided
        registeredAt: new Date().toISOString(),
        attended: false // Default to false, can be updated by admin later
      };

      // Add new attendee
      eventData.attendees.push(newAttendee);

      // Update event in Blob storage
      await eventsStore.setJSON(eventId, eventData);
      console.log(`✅ Member ${memberId} signed up for event ${eventId}`);

      // Update the master events list to reflect the change
      try {
          let eventsList = await eventsStore.get('_list', { type: 'json' });
          if (eventsList && Array.isArray(eventsList)) {
              const eventIndex = eventsList.findIndex(e => e.id === eventId);
              if (eventIndex !== -1) {
                  eventsList[eventIndex] = eventData; // Update the event in the list
                  await eventsStore.setJSON('_list', eventsList);
                  console.log('✅ Master events list updated with new attendee.');
              } else {
                  console.warn('⚠️ Event not found in master list during sign-up update.');
              }
          }
      } catch (listError) {
          console.error('❌ Error updating master events list during sign-up:', listError.message);
      }


      // 5. Standard success response
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Successfully signed up for the event!',
          attendee: newAttendee
        })
      };

    } catch (error) {
      // 6. Standard error response
      console.error('💥 Error during event sign-up:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Internal server error',
          details: error.message
        })
      };
    }
  };
