// /.netlify/functions/create-venue.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check authentication
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { name, address, phone, website, notes } = body;

    // Validate required fields
    if (!name || !address) {
      return new Response(JSON.stringify({ error: 'Name and address are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const venueStore = getStore("venues");
    const venues = await venueStore.get("all-venues", { type: "json" }) || [];

    // Check for duplicate venue names
    const existingVenue = venues.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (existingVenue) {
      return new Response(JSON.stringify({ error: 'A venue with this name already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create new venue
    const newVenue = {
      id: `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      address: address.trim(),
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      notes: notes?.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    venues.push(newVenue);
    await venueStore.set("all-venues", venues);

    return new Response(JSON.stringify({ 
      success: true, 
      venue: newVenue,
      message: 'Venue created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating venue:', error);
    return new Response(JSON.stringify({ error: 'Failed to create venue' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};