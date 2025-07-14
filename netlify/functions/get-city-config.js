// netlify/functions/get-city-config.js
// Get current city configuration including home venue
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // For now, return hardcoded Manchester configuration
    // TODO: This will be replaced with dynamic city management when implemented
    const cityConfig = {
      id: 'manchester',
      name: 'Manchester',
      region: 'Greater Manchester',
      homeVenue: null, // Will be set based on actual home venue configuration
      description: 'An exclusive networking collective for ambitious professionals in Greater Manchester'
    };

    // Check for TeamSport Victoria as default home venue (legacy support)
    // This allows the system to work until proper city management is implemented
    const teamSportId = 'teamsport-victoria'; // This would be the actual venue ID
    
    // For now, we'll rely on the name-based fallback in getVenuesList
    // When city management is fully implemented, this will fetch the actual homeVenue ID
    
    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        success: true,
        city: cityConfig
      })
    };

  } catch (error) {
    console.error('💥 Error fetching city config:', error);
    return {
      statusCode: 500,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};