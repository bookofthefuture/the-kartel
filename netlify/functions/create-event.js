// netlify/functions/create-event.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.length < 32) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  try {
    console.log('📅 Creating new event');
    
    const data = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    
    // Validate required fields
    const requiredFields = ['name', 'date', 'venue'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing required field: ${field}` })
        };
      }
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
      name: data.name,
      description: data.description || '',
      date: data.date,
      time: data.time || '',
      venue: data.venue,
      venueAddress: data.venueAddress || '',
      maxAttendees: parseInt(data.maxAttendees) || null,
      attendees: data.attendees || [],
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Event created successfully',
        event: newEvent
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