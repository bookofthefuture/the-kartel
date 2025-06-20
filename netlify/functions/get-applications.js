// netlify/functions/get-applications.js - Debug Version
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
    console.log('🔧 Environment check:');
    console.log('  NETLIFY_SITE_ID:', process.env.NETLIFY_SITE_ID ? 'SET' : 'MISSING');
    console.log('  NETLIFY_ACCESS_TOKEN:', process.env.NETLIFY_ACCESS_TOKEN ? 'SET (length: ' + process.env.NETLIFY_ACCESS_TOKEN.length + ')' : 'MISSING');
    
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
      console.log('📡 Response headers:', Object.fromEntries(getResponse.headers.entries()));
      
      if (getResponse.ok) {
        const existingData = await getResponse.text();
        console.log('📄 Raw data received:');
        console.log('  Length:', existingData ? existingData.length : 0);
        console.log('  First 200 chars:', existingData ? existingData.substring(0, 200) : 'N/A');
        console.log('  Last 100 chars:', existingData && existingData.length > 100 ? existingData.substring(existingData.length - 100) : 'N/A');
        
        if (existingData && existingData.trim()) {
          try {
            const parsedData = JSON.parse(existingData);
            console.log('📊 Parsed data type:', typeof parsedData);
            console.log('📊 Is array:', Array.isArray(parsedData));
            
            if (Array.isArray(parsedData)) {
              applications = parsedData;
              console.log(`📊 Successfully loaded ${applications.length} applications`);
              
              // Log first application for debugging
              if (applications.length > 0) {
                console.log('📋 First application sample:', {
                  id: applications[0].id,
                  name: applications[0].name,
                  email: applications[0].email,
                  status: applications[0].status,
                  submittedAt: applications[0].submittedAt
                });
              }
            } else {
              console.log('⚠️ Data is not an array, type:', typeof parsedData);
              console.log('⚠️ Data content:', parsedData);
              applications = [];
            }
          } catch (parseError) {
            console.log('⚠️ Could not parse data as JSON:', parseError.message);
            console.log('⚠️ Raw data that failed to parse:', existingData.substring(0, 500));
            applications = [];
          }
        } else {
          console.log('📝 No data found or empty data');
          applications = [];
        }
      } else if (getResponse.status === 404) {
        console.log('📝 No applications file found (404) - this is normal for first time');
        applications = [];
      } else {
        console.log(`❓ Unexpected response: ${getResponse.status} ${getResponse.statusText}`);
        const errorText = await getResponse.text();
        console.log('Error response body:', errorText);
        applications = [];
      }
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError.message);
      console.error('❌ Fetch stack:', fetchError.stack);
      applications = [];
    }

    console.log(`🎯 Final result: Returning ${applications.length} applications`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        applications,
        debug: {
          count: applications.length,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('💥 Error fetching applications:', error.message);
    console.error('💥 Error stack:', error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};