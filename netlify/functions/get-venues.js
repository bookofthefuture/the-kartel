// /.netlify/functions/get-venues.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // Check authentication
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const venueStore = getStore("venues");
    const venues = await venueStore.get("all-venues", { type: "json" }) || [];
    
    return new Response(JSON.stringify({ 
      success: true, 
      venues: venues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching venues:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch venues' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

