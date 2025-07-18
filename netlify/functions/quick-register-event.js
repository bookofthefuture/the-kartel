// netlify/functions/quick-register-event.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { sanitizeText, sanitizeEmail } = require('./input-sanitization');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    let eventId, memberEmail, token;
    
    // Handle both JSON and form data
    if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
      // JSON data (from JavaScript)
      const data = JSON.parse(event.body);
      eventId = sanitizeText(data.eventId, { maxLength: 100 });
      memberEmail = sanitizeEmail(data.memberEmail);
      token = sanitizeText(data.token, { maxLength: 64 });
    } else {
      // Form data (from email forms)
      const params = new URLSearchParams(event.body);
      eventId = sanitizeText(params.get('eventId'), { maxLength: 100 });
      memberEmail = sanitizeEmail(params.get('memberEmail'));
      token = sanitizeText(params.get('token'), { maxLength: 64 });
    }
    
    // Validate required fields
    if (!eventId || !memberEmail || !token) {
      return {
        statusCode: 400,
        headers: createSecureHeaders(event),
        body: JSON.stringify({
          error: 'Missing required fields',
          success: false
        })
      };
    }

    console.log(`🎫 Quick registration: ${memberEmail} for event ${eventId}`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Get stores
    const eventsStore = getStore({
      name: 'events',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Verify event exists
    const eventDetails = await eventsStore.get(eventId, { type: 'json' });
    if (!eventDetails) {
      return {
        statusCode: 404,
        headers: createSecureHeaders(event),
        body: JSON.stringify({
          error: 'Event not found',
          success: false
        })
      };
    }

    // For test events, create a mock member. For real events, verify member exists and is approved
    let member;
    
    if (eventId.startsWith('test-')) {
      console.log('🧪 Test event detected, creating mock member for admin test');
      member = {
        id: 'admin-test',
        email: memberEmail,
        firstName: 'Admin',
        lastName: 'Test',
        fullName: 'Admin Test',
        company: 'The Kartel Admin',
        position: 'Administrator',
        linkedin: 'admin-test',
        status: 'approved'
      };
    } else {
      // Verify member exists and is approved for real events
      const applications = await applicationsStore.get('_list', { type: 'json' }) || [];
      member = applications.find(app => 
        app.email.toLowerCase() === memberEmail.toLowerCase() && 
        app.status === 'approved'
      );

      if (!member) {
        return {
          statusCode: 404,
          headers: createSecureHeaders(event),
          body: JSON.stringify({
            error: 'Member not found or not approved',
            success: false
          })
        };
      }
    }

    // Verify token (simple token validation - in production you'd want more robust validation)
    const expectedToken = crypto.createHash('sha256')
      .update(`${eventId}:${memberEmail}:${process.env.NETLIFY_ACCESS_TOKEN}`)
      .digest('hex')
      .substring(0, 32);

    if (token !== expectedToken) {
      return {
        statusCode: 401,
        headers: createSecureHeaders(event),
        body: JSON.stringify({
          error: 'Invalid registration token',
          success: false
        })
      };
    }

    // Check if member is already registered
    const existingAttendee = eventDetails.attendees.find(a => a.email === memberEmail);
    if (existingAttendee) {
      return {
        statusCode: 400,
        headers: createSecureHeaders(event),
        body: JSON.stringify({
          error: 'Already registered',
          message: `You are already registered for ${eventDetails.name}`,
          success: false
        })
      };
    }

    // Check if event is full
    if (eventDetails.maxAttendees && eventDetails.attendees.length >= eventDetails.maxAttendees) {
      return {
        statusCode: 400,
        headers: createSecureHeaders(event),
        body: JSON.stringify({
          error: 'Event is full',
          message: `${eventDetails.name} is already full`,
          success: false
        })
      };
    }

    // Add member to event attendees
    const attendee = {
      memberId: member.id,  // Use memberId for consistency with sign-up-event
      id: member.id,        // Keep id for backward compatibility
      name: member.fullName || `${member.firstName} ${member.lastName}`,
      email: member.email,
      company: member.company,
      position: member.position,
      linkedin: member.linkedin,
      registeredAt: new Date().toISOString(),
      registrationType: 'quick_email'
    };

    eventDetails.attendees.push(attendee);
    
    // Update event
    await eventsStore.setJSON(eventId, eventDetails);

    // Update events list
    const eventsList = await eventsStore.get('_list', { type: 'json' }) || [];
    const eventIndex = eventsList.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
      eventsList[eventIndex] = eventDetails;
      await eventsStore.setJSON('_list', eventsList);
    }

    console.log(`✅ ${memberEmail} registered for event ${eventDetails.name}`);
    
    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        success: true,
        eventName: eventDetails.name,
        eventId: eventDetails.id,
        message: `Successfully registered for ${eventDetails.name}`
      })
    };

  } catch (error) {
    console.error('💥 Error in quick registration:', error);
    
    return {
      statusCode: 500,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        error: 'Registration failed. Please try again.',
        success: false
      })
    };
  }
};