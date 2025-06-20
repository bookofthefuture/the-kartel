// netlify/functions/debug-blobs-deep.js
exports.handler = async (event, context) => {
  try {
    console.log('🔬 Deep debugging Netlify Blobs...');
    
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing environment variables' })
      };
    }

    const results = {
      siteId: process.env.NETLIFY_SITE_ID,
      tokenLength: process.env.NETLIFY_ACCESS_TOKEN.length,
      tokenPrefix: process.env.NETLIFY_ACCESS_TOKEN.substring(0, 10) + '...',
      tests: {}
    };

    const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
    console.log('🌐 Base URL:', blobsBaseUrl);

    // Test 1: Simple blob creation and immediate read
    const testKey = `test-${Date.now()}`;
    const testData = { 
      message: 'Hello World',
      timestamp: new Date().toISOString(),
      random: Math.random()
    };

    try {
      console.log(`🧪 Test 1: Creating blob with key "${testKey}"`);
      
      // CREATE
      const createResponse = await fetch(`${blobsBaseUrl}/${testKey}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      console.log('📤 CREATE response status:', createResponse.status);
      console.log('📤 CREATE response headers:', Object.fromEntries(createResponse.headers.entries()));
      
      const createResult = {
        status: createResponse.status,
        ok: createResponse.ok,
        headers: Object.fromEntries(createResponse.headers.entries())
      };

      if (createResponse.ok) {
        console.log('✅ Blob created successfully');
        
        // Wait a moment
        console.log('⏱️ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // READ IMMEDIATELY
        console.log('📥 Attempting to read blob immediately...');
        const readResponse = await fetch(`${blobsBaseUrl}/${testKey}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('📥 READ response status:', readResponse.status);
        console.log('📥 READ response headers:', Object.fromEntries(readResponse.headers.entries()));

        if (readResponse.ok) {
          const readData = await readResponse.json();
          console.log('📄 Read data type:', typeof readData);
          console.log('📄 Read data keys:', Object.keys(readData));
          console.log('📄 Read data content:', readData);

          if (readData.url) {
            console.log('🔗 Found redirect URL:', readData.url);
            
            // Follow the redirect with different approaches
            const redirectTests = {};
            
            // Test A: Simple fetch
            try {
              console.log('🔗 Test A: Simple redirect fetch');
              const redirectResponse = await fetch(readData.url);
              console.log('📡 Redirect response status:', redirectResponse.status);
              console.log('📡 Redirect response headers:', Object.fromEntries(redirectResponse.headers.entries()));
              
              redirectTests.simple = {
                status: redirectResponse.status,
                ok: redirectResponse.ok,
                headers: Object.fromEntries(redirectResponse.headers.entries())
              };

              if (redirectResponse.ok) {
                const redirectContent = await redirectResponse.text();
                console.log('📄 Redirect content:', redirectContent);
                redirectTests.simple.content = redirectContent;
                redirectTests.simple.contentLength = redirectContent.length;
              } else {
                const errorText = await redirectResponse.text();
                console.log('❌ Redirect error content:', errorText);
                redirectTests.simple.error = errorText;
              }
            } catch (redirectError) {
              console.log('❌ Simple redirect error:', redirectError.message);
              redirectTests.simple = { error: redirectError.message };
            }

            // Test B: Fetch with no-cors
            try {
              console.log('🔗 Test B: No-cors redirect fetch');
              const noCorsResponse = await fetch(readData.url, { mode: 'no-cors' });
              redirectTests.noCors = {
                status: noCorsResponse.status,
                ok: noCorsResponse.ok,
                type: noCorsResponse.type
              };
            } catch (error) {
              redirectTests.noCors = { error: error.message };
            }

            // Test C: Fetch with different headers
            try {
              console.log('🔗 Test C: Redirect with auth headers');
              const authResponse = await fetch(readData.url, {
                headers: {
                  'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`
                }
              });
              redirectTests.withAuth = {
                status: authResponse.status,
                ok: authResponse.ok
              };
              
              if (authResponse.ok) {
                const authContent = await authResponse.text();
                redirectTests.withAuth.content = authContent;
              }
            } catch (error) {
              redirectTests.withAuth = { error: error.message };
            }

            results.tests[testKey] = {
              create: createResult,
              read: {
                status: readResponse.status,
                ok: readResponse.ok,
                hasRedirectUrl: !!readData.url,
                redirectUrl: readData.url,
                redirectTests: redirectTests
              }
            };

          } else if (readData.message) {
            // Direct data return
            console.log('📄 Direct data returned (no redirect)');
            results.tests[testKey] = {
              create: createResult,
              read: {
                status: readResponse.status,
                ok: readResponse.ok,
                method: 'direct',
                data: readData
              }
            };
          }
        } else {
          console.log('❌ Read failed:', readResponse.status);
          const errorText = await readResponse.text();
          console.log('❌ Read error:', errorText);
          
          results.tests[testKey] = {
            create: createResult,
            read: {
              status: readResponse.status,
              ok: false,
              error: errorText
            }
          };
        }
      } else {
        console.log('❌ Create failed:', createResponse.status);
        const errorText = await createResponse.text();
        console.log('❌ Create error:', errorText);
        
        results.tests[testKey] = {
          create: {
            status: createResponse.status,
            ok: false,
            error: errorText
          }
        };
      }

    } catch (testError) {
      console.error('❌ Test 1 failed:', testError.message);
      results.tests[testKey] = {
        error: testError.message,
        stack: testError.stack
      };
    }

    // Test 2: List all blobs
    try {
      console.log('🧪 Test 2: Listing all blobs');
      
      const listResponse = await fetch(`${blobsBaseUrl}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📋 List response status:', listResponse.status);
      
      if (listResponse.ok) {
        const listData = await listResponse.json();
        console.log('📋 List data:', listData);
        
        results.blobsList = {
          status: listResponse.status,
          totalBlobs: listData.blobs ? listData.blobs.length : 0,
          blobs: listData.blobs || [],
          hasTestBlob: listData.blobs ? listData.blobs.some(b => b.key === testKey) : false
        };
      } else {
        const errorText = await listResponse.text();
        results.blobsList = {
          status: listResponse.status,
          error: errorText
        };
      }
    } catch (listError) {
      console.error('❌ List test failed:', listError.message);
      results.blobsList = { error: listError.message };
    }

    // Test 3: Check API permissions
    try {
      console.log('🧪 Test 3: Testing API permissions');
      
      const permissionResponse = await fetch(`https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      results.permissions = {
        siteAccess: permissionResponse.status,
        canAccessSite: permissionResponse.ok
      };

      if (permissionResponse.ok) {
        const siteData = await permissionResponse.json();
        results.permissions.siteName = siteData.name;
        results.permissions.siteUrl = siteData.url;
      }

    } catch (permError) {
      results.permissions = { error: permError.message };
    }

    console.log('🎯 Final debug results:', results);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(results, null, 2)
    };

  } catch (error) {
    console.error('💥 Debug error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Debug failed',
        details: error.message,
        stack: error.stack
      })
    };
  }
};