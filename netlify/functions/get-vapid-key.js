exports.handler = async (event, context) => {
  console.log('VAPID public key request received');
  
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Return the public VAPID key (safe to expose to clients)
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    
    if (!publicKey) {
      console.error('VAPID_PUBLIC_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'VAPID key not configured' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: JSON.stringify({ 
        publicKey: publicKey
      })
    };

  } catch (error) {
    console.error('Error getting VAPID key:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get VAPID key' })
    };
  }
};