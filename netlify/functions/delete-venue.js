
// /.netlify/functions/delete-venue.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== 'DELETE') {
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
    const { venueId } = body;

    if (!venueId) {
      return new Response(JSON.stringify({ error: 'Venue ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const venueStore = getStore("venues");
    const eventStore = getStore("events");
    
    const venues = await venueStore.get("all-venues", { type: "json" }) || [];
    const events = await eventStore.get("all-events", { type: "json" }) || [];

    const venue = venues.find(v => v.id === venueId);
    if (!venue) {
      return new Response(JSON.stringify({ error: 'Venue not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if venue is being used by any events
    const eventsUsingVenue = events.filter(e => e.venueId === venueId);
    if (eventsUsingVenue.length > 0) {
      return new Response(JSON.stringify({ 
        error: `Cannot delete venue. It is being used by ${eventsUsingVenue.length} event(s). Please update or delete those events first.`,
        eventsUsing: eventsUsingVenue.map(e => ({ id: e.id, name: e.name, date: e.date }))
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove venue
    const updatedVenues = venues.filter(v => v.id !== venueId);
    await venueStore.set("all-venues", updatedVenues);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Venue "${venue.name}" deleted successfully`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting venue:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete venue' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
