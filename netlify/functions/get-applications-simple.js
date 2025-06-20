// netlify/functions/get-applications-simple.js
exports.handler = async (event, context) => {
  // Check authorization
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.length < 32) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  try {
    console.log('📖 Getting applications (simple method)...');
    
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
    
    let applications = [];
    
    // First, try to get the applications list
    try {
      const listUrl = `${blobsBaseUrl}/applications-list`;
      console.log('🔍 Checking applications list...');
      
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 List response status:', listResponse.status);
      
      if (listResponse.ok) {
        const responseData = await listResponse.json();
        console.log('📄 List response type:', typeof responseData);
        
        if (responseData.url) {
          console.log('🔗 Following list redirect...');
          const dataResponse = await fetch(responseData.url);
          
          if (dataResponse.ok) {
            const listData = await dataResponse.text();
            if (listData && listData.trim()) {
              try {
                applications = JSON.parse(listData);
                console.log(`✅ Found ${applications.length} applications in list`);
              } catch (parseError) {
                console.log('⚠️ Could not parse list data');
              }
            }
          } else {
            console.log('❌ List redirect failed:', dataResponse.status);
          }
        } else if (Array.isArray(responseData)) {
          applications = responseData;
          console.log(`✅ Direct list data: ${applications.length} applications`);
        }
      } else {
        console.log('📝 No applications list found');
      }
    } catch (listError) {
      console.log('⚠️ Error getting applications list:', listError.message);
    }
    
    // If we don't have applications from the list, try to find individual blobs
    if (applications.length === 0) {
      console.log('🔍 Trying to find individual application blobs...');
      
      // Try to list all blobs and find application ones
      try {
        const listBlobsResponse = await fetch(`${blobsBaseUrl}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📡 Blobs list response:', listBlobsResponse.status);
        
        if (listBlobsResponse.ok) {
          const blobsList = await listBlobsResponse.json();
          console.log('📄 Blobs list type:', typeof blobsList);
          console.log('📄 Blobs list keys:', Object.keys(blobsList));
          
          // Look for application blobs
          if (blobsList.blobs && Array.isArray(blobsList.blobs)) {
            console.log(`📊 Found ${blobsList.blobs.length} total blobs`);
            
            const applicationBlobs = blobsList.blobs.filter(blob => 
              blob.key && blob.key.startsWith('application-')
            );
            
            console.log(`📋 Found ${applicationBlobs.length} application blobs`);
            
            // Fetch each application blob
            for (const blob of applicationBlobs) {
              try {
                const appResponse = await fetch(`${blobsBaseUrl}/${blob.key}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                  }
                });
                
                if (appResponse.ok) {
                  const appData = await appResponse.json();
                  
                  if (appData.url) {
                    const appDataResponse = await fetch(appData.url);
                    if (appDataResponse.ok) {
                      const appContent = await appDataResponse.text();
                      try {
                        const application = JSON.parse(appContent);
                        applications.push(application);
                        console.log(`✅ Loaded application: ${application.id}`);
                      } catch (parseError) {
                        console.log(`⚠️ Could not parse application ${blob.key}`);
                      }
                    }
                  } else if (appData.id) {
                    applications.push(appData);
                    console.log(`✅ Direct application data: ${appData.id}`);
                  }
                }
              } catch (appError) {
                console.log(`⚠️ Error loading application ${blob.key}:`, appError.message);
              }
            }
          }
        }
      } catch (listError) {
        console.log('⚠️ Error listing blobs:', listError.message);
      }
    }
    
    console.log(`🎯 Final result: ${applications.length} applications`);
    
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
          method: applications.length > 0 ? 'individual-blobs' : 'none',
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('💥 Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};