// netlify/functions/get-applications.js
exports.handler = async (event, context) => {
  // Check for authorization header
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Simple token validation
  const token = authHeader.split(' ')[1];
  if (!token || token.length < 32) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  try {
    console.log('📖 Getting applications from Netlify Blobs...');
    
    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing required Netlify environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
    
    let applications = [];
    
    try {
      const getResponse = await fetch(`${blobsBaseUrl}/applications:applications.json`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (getResponse.ok) {
        const existingData = await getResponse.text();
        console.log('📄 Raw data length:', existingData ? existingData.length : 0);
        
        if (existingData && existingData.trim()) {
          try {
            const parsedData = JSON.parse(existingData);
            if (Array.isArray(parsedData)) {
              applications = parsedData;
              console.log(`📊 Successfully loaded ${applications.length} applications`);
            } else {
              console.log('⚠️ Data is not an array, returning empty');
              applications = [];
            }
          } catch (parseError) {
            console.log('⚠️ Could not parse data as JSON:', parseError.message);
            applications = [];
          }
        } else {
          console.log('📝 No data found, returning empty array');
          applications = [];
        }
      } else if (getResponse.status === 404) {
        console.log('📝 No applications file found (404)');
        applications = [];
      } else {
        console.log(`❓ Unexpected response: ${getResponse.status}`);
        const errorText = await getResponse.text();
        console.log('Error response:', errorText);
        applications = [];
      }
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      applications = [];
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ applications })
    };

  } catch (error) {
    console.error('💥 Error fetching applications:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

