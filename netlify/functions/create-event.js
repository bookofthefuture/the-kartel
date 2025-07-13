// netlify/functions/create-event.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { sanitizeEvent, sanitizeText, validateRequiredFields } = require('./input-sanitization');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate JWT token and require admin role
  const authResult = validateAuthHeader(event.headers.authorization);
  if (!authResult.success) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error })
    };
  }

  // Check if user has admin role
  const roleCheck = requireRole(['admin', 'super-admin'])(authResult.payload);
  if (!roleCheck.success) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }

  try {
    console.log('📅 Creating new event');
    
    const rawData = JSON.parse(event.body);
    const eventData = sanitizeEvent(rawData);
    const sendAnnouncement = !!rawData.sendAnnouncement;
    const timestamp = new Date().toISOString();
    
    // Validate required fields based on sanitized data
    const validation = validateRequiredFields(eventData, ['title', 'date', 'venue']);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Missing required fields: ${validation.missing.join(', ')}` })
      };
    }

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Create events store
    const eventsStore = getStore({
      name: 'events',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Create event object
    const newEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: eventData.title,
      title: eventData.title,
      description: eventData.description,
      date: eventData.date,
      time: eventData.time,
      venue: eventData.venue,
      venueAddress: sanitizeText(rawData.venueAddress, { maxLength: 200 }),
      maxAttendees: eventData.maxAttendees,
      cost: eventData.cost,
      attendees: rawData.attendees || [],
      photos: [],
      status: 'upcoming', // upcoming, completed, cancelled
      createdAt: timestamp,
      createdBy: 'Admin'
    };

    console.log('📋 Event created:', newEvent.id);

    // Store individual event
    await eventsStore.setJSON(newEvent.id, newEvent);
    console.log('✅ Individual event stored');

    // Get current events list and update it
    let events = [];
    try {
      const existingEvents = await eventsStore.get('_list', { type: 'json' });
      if (existingEvents && Array.isArray(existingEvents)) {
        events = existingEvents;
      }
    } catch (error) {
      console.log('📝 No existing events list, starting fresh');
      events = [];
    }

    // Add new event to list
    events.push(newEvent);

    // Sort events by date (newest first)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Store updated list
    await eventsStore.setJSON('_list', events);
    console.log(`✅ Events list updated (${events.length} total)`);

    // Send announcement email if requested
    if (sendAnnouncement) {
      try {
        console.log('📧 Sending event announcement emails...');
        await sendEventAnnouncement(newEvent.id, authResult.payload.token);
        console.log('✅ Event announcement emails sent');
      } catch (emailError) {
        console.error('❌ Failed to send event announcements:', emailError);
        // Don't fail event creation if email fails
      }
    }

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        success: true, 
        message: 'Event created successfully',
        event: newEvent,
        announcementSent: sendAnnouncement
      })
    };

  } catch (error) {
    console.error('💥 Error creating event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};