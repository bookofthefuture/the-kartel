// /.netlify/functions/update-venue.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== 'PUT') {
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
    const { venueId, name, address, phone, website, notes } = body;

    if (!venueId) {
      return new Response(JSON.stringify({ error: 'Venue ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate required fields
    if (!name || !address) {
      return new Response(JSON.stringify({ error: 'Name and address are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const venueStore = getStore("venues");
    const venues = await venueStore.get("all-venues", { type: "json" }) || [];

    const venueIndex = venues.findIndex(v => v.id === venueId);
    if (venueIndex === -1) {
      return new Response(JSON.stringify({ error: 'Venue not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for duplicate names (excluding current venue)
    const existingVenue = venues.find(v => v.id !== venueId && v.name.toLowerCase() === name.toLowerCase());
    if (existingVenue) {
      return new Response(JSON.stringify({ error: 'A venue with this name already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update venue
    venues[venueIndex] = {
      ...venues[venueIndex],
      name: name.trim(),
      address: address.trim(),
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      notes: notes?.trim() || null,
      updatedAt: new Date().toISOString()
    };

    await venueStore.set("all-venues", venues);

    return new Response(JSON.stringify({ 
      success: true, 
      venue: venues[venueIndex],
      message: 'Venue updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating venue:', error);
    return new Response(JSON.stringify({ error: 'Failed to update venue' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
