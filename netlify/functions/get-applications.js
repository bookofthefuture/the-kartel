// netlify/functions/get-applications.js - Fixed to handle redirects
exports.handler = async (event, context) => {
  console.log('🔐 Admin function called - get-applications');
  
  // Check for authorization header
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No authorization header found');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Simple token validation
  const token = authHeader.split(' ')[1];
  if (!token || token.length < 32) {
    console.log('❌ Invalid token length');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  console.log('✅ Authorization passed');

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
    const blobUrl = `${blobsBaseUrl}/applications:applications.json`;
    console.log('🌐 Blob URL:', blobUrl);
    
    let applications = [];
    
    try {
      console.log('📡 Making GET request to Netlify Blobs...');
      const getResponse = await fetch(blobUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Response status:', getResponse.status);
      
      if (getResponse.ok) {
        const responseData = await getResponse.json();
        console.log('📄 Response type:', typeof responseData);
        console.log('📄 Response keys:', Object.keys(responseData));
        
        // Check if we got a redirect URL
        if (responseData.url) {
          console.log('🔗 Got redirect URL, fetching actual data...');
          
          const dataResponse = await fetch(responseData.url);
          console.log('📡 Data response status:', dataResponse.status);
          
          if (dataResponse.ok) {
            const actualData = await dataResponse.text();
            console.log('📄 Actual data length:', actualData ? actualData.length : 0);
            
            if (actualData && actualData.trim()) {
              try {
                const parsedData = JSON.parse(actualData);
                if (Array.isArray(parsedData)) {
                  applications = parsedData;
                  console.log(`📊 Successfully loaded ${applications.length} applications`);
                } else {
                  console.log('⚠️ Data is not an array');
                  applications = [];
                }
              } catch (parseError) {
                console.log('⚠️ Could not parse data as JSON:', parseError.message);
                applications = [];
              }
            } else {
              console.log('📝 No actual data found');
              applications = [];
            }
          } else {
            console.log('❌ Failed to fetch actual data:', dataResponse.status);
            applications = [];
          }
        } else {
          // Direct data response (fallback)
          console.log('📄 Direct data response');
          if (Array.isArray(responseData)) {
            applications = responseData;
            console.log(`📊 Direct data: ${applications.length} applications`);
          } else {
            applications = [];
          }
        }
      } else if (getResponse.status === 404) {
        console.log('📝 No applications file found (404)');
        applications = [];
      } else {
        console.log(`❓ Unexpected response: ${getResponse.status}`);
        applications = [];
      }
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError.message);
      applications = [];
    }

    console.log(`🎯 Final result: Returning ${applications.length} applications`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ applications })
    };

  } catch (error) {
    console.error('💥 Error fetching applications:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};