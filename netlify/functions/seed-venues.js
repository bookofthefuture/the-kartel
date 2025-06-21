
// /.netlify/functions/seed-venues.js (Optional - for initial setup)
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
    const venueStore = getStore("venues");
    const existingVenues = await venueStore.get("all-venues", { type: "json" });

    // Only seed if no venues exist
    if (existingVenues && existingVenues.length > 0) {
      return new Response(JSON.stringify({ 
        success: false,
        message: 'Venues already exist. Seeding skipped.',
        existingCount: existingVenues.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const seedVenues = [
      {
        id: `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'TeamSport Victoria',
        address: 'Great Ducie Street, Manchester M3 1PR',
        phone: '0161 637 0637',
        website: 'https://www.team-sport.co.uk/go-karting/manchester-city-centre/',
        notes: 'Our primary venue. Indoor karting, excellent facilities. Use code GET10 for 10% off.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `venue_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'TeamSport Stretford',
        address: 'Barton Dock Road, Stretford, Manchester M32 0ZH',
        phone: '0161 865 0070',
        website: 'https://www.team-sport.co.uk/go-karting/manchester-trafford/',
        notes: 'Alternative venue with outdoor track. Good for larger groups.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    await venueStore.set("all-venues", seedVenues);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Default venues created successfully',
      venues: seedVenues
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error seeding venues:', error);
    return new Response(JSON.stringify({ error: 'Failed to seed venues' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};