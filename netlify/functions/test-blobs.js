// netlify/functions/test-blobs.js
// Create this file to test blob storage directly
exports.handler = async (event, context) => {
  try {
    console.log('🧪 Testing Netlify Blobs functionality...');
    
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing environment variables' })
      };
    }

    const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
    
    // Test different blob key formats
    const testKeys = [
      'applications:applications.json',
      'applications/applications.json', 
      'applications',
      'test-data'
    ];
    
    const results = {};
    
    for (const key of testKeys) {
      console.log(`🔍 Testing key: ${key}`);
      
      try {
        // First, try to create a simple test blob
        const testData = { test: true, timestamp: new Date().toISOString() };
        
        const putUrl = `${blobsBaseUrl}/${key}`;
        console.log(`📤 PUT URL: ${putUrl}`);
        
        const putResponse = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testData)
        });
        
        console.log(`📤 PUT ${key}: ${putResponse.status}`);
        
        if (putResponse.ok) {
          // Now try to read it back
          const getResponse = await fetch(putUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`📥 GET ${key}: ${getResponse.status}`);
          
          if (getResponse.ok) {
            const responseData = await getResponse.json();
            console.log(`📄 ${key} response type:`, typeof responseData);
            console.log(`📄 ${key} keys:`, Object.keys(responseData));
            
            if (responseData.url) {
              console.log(`🔗 ${key} has redirect URL`);
              
              const dataResponse = await fetch(responseData.url);
              console.log(`📡 ${key} redirect status:`, dataResponse.status);
              
              if (dataResponse.ok) {
                const actualData = await dataResponse.text();
                console.log(`✅ ${key} data retrieved:`, actualData.substring(0, 100));
                
                results[key] = {
                  success: true,
                  method: 'redirect',
                  data: actualData
                };
              } else {
                console.log(`❌ ${key} redirect failed:`, dataResponse.status);
                results[key] = {
                  success: false,
                  error: `Redirect failed: ${dataResponse.status}`
                };
              }
            } else {
              console.log(`📄 ${key} direct data:`, responseData);
              results[key] = {
                success: true,
                method: 'direct',
                data: responseData
              };
            }
          } else {
            results[key] = {
              success: false,
              error: `GET failed: ${getResponse.status}`
            };
          }
        } else {
          results[key] = {
            success: false,
            error: `PUT failed: ${putResponse.status}`
          };
        }
        
      } catch (error) {
        console.error(`❌ Error testing ${key}:`, error.message);
        results[key] = {
          success: false,
          error: error.message
        };
      }
    }
    
    console.log('🎯 Test results:', results);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Blob test completed',
        results: results,
        siteId: process.env.NETLIFY_SITE_ID,
        hasToken: !!process.env.NETLIFY_ACCESS_TOKEN
      })
    };
    
  } catch (error) {
    console.error('💥 Test error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Test failed',
        details: error.message
      })
    };
  }
};