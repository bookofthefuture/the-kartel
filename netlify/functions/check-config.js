// netlify/functions/check-config.js
exports.handler = async (event, context) => {
  try {
    console.log('🔧 Checking Netlify configuration...');
    
    const results = {
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        region: process.env.AWS_REGION || 'unknown',
        netlifyContext: {
          siteId: process.env.NETLIFY_SITE_ID,
          deployId: process.env.DEPLOY_ID || 'unknown',
          context: process.env.CONTEXT || 'unknown',
          branch: process.env.BRANCH || 'unknown',
          commitRef: process.env.COMMIT_REF || 'unknown'
        }
      },
      envVars: {},
      apiTests: {}
    };

    // Check environment variables
    const requiredVars = [
      'NETLIFY_SITE_ID',
      'NETLIFY_ACCESS_TOKEN',
      'ADMIN_EMAIL',
      'SENDGRID_API_KEY',
      'FROM_EMAIL',
      'SITE_URL'
    ];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      results.envVars[varName] = {
        exists: !!value,
        length: value ? value.length : 0,
        prefix: value ? value.substring(0, 8) + '...' : null
      };
    }

    // Test basic Netlify API access
    if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_ACCESS_TOKEN) {
      try {
        console.log('🌐 Testing basic Netlify API access...');
        
        const apiResponse = await fetch(`https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        results.apiTests.siteAccess = {
          status: apiResponse.status,
          ok: apiResponse.ok
        };

        if (apiResponse.ok) {
          const siteData = await apiResponse.json();
          results.apiTests.siteInfo = {
            name: siteData.name,
            url: siteData.url,
            plan: siteData.plan,
            capabilities: siteData.capabilities || []
          };
          
          console.log('✅ Site access successful');
          console.log('📊 Site plan:', siteData.plan);
          console.log('🎯 Site capabilities:', siteData.capabilities);
        } else {
          const errorData = await apiResponse.text();
          results.apiTests.siteAccess.error = errorData;
          console.log('❌ Site access failed:', errorData);
        }

      } catch (apiError) {
        results.apiTests.siteAccess = { error: apiError.message };
        console.log('❌ API test error:', apiError.message);
      }

      // Test Netlify Blobs API endpoints
      try {
        console.log('🧪 Testing Netlify Blobs API endpoints...');
        
        const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
        
        // Test 1: List blobs
        const listResponse = await fetch(blobsBaseUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        results.apiTests.blobsList = {
          status: listResponse.status,
          ok: listResponse.ok,
          url: blobsBaseUrl
        };

        if (listResponse.ok) {
          const listData = await listResponse.json();
          results.apiTests.blobsList.totalBlobs = listData.blobs ? listData.blobs.length : 0;
          results.apiTests.blobsList.blobKeys = listData.blobs ? listData.blobs.map(b => b.key).slice(0, 10) : [];
          console.log(`📋 Found ${listData.blobs ? listData.blobs.length : 0} existing blobs`);
        } else {
          const errorData = await listResponse.text();
          results.apiTests.blobsList.error = errorData;
          console.log('❌ Blobs list failed:', errorData);
        }

        // Test 2: Check if we can access blob metadata endpoint
        try {
          const metaResponse = await fetch(`${blobsBaseUrl}?metadata=true`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          results.apiTests.blobsMetadata = {
            status: metaResponse.status,
            ok: metaResponse.ok
          };

          if (metaResponse.ok) {
            const metaData = await metaResponse.json();
            results.apiTests.blobsMetadata.data = metaData;
          }
        } catch (metaError) {
          results.apiTests.blobsMetadata = { error: metaError.message };
        }

      } catch (blobsError) {
        results.apiTests.blobs = { error: blobsError.message };
        console.log('❌ Blobs API test error:', blobsError.message);
      }
    }

    // Test SendGrid configuration
    if (process.env.SENDGRID_API_KEY && process.env.FROM_EMAIL && process.env.ADMIN_EMAIL) {
      try {
        console.log('📧 Testing SendGrid configuration...');
        
        // We won't actually send an email, just validate the setup
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        results.apiTests.sendgrid = {
          configured: true,
          fromEmail: process.env.FROM_EMAIL,
          adminEmail: process.env.ADMIN_EMAIL
        };

      } catch (sgError) {
        results.apiTests.sendgrid = { 
          configured: false, 
          error: sgError.message 
        };
      }
    } else {
      results.apiTests.sendgrid = { 
        configured: false, 
        reason: 'Missing environment variables' 
      };
    }

    console.log('🎯 Configuration check complete:', results);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(results, null, 2)
    };

  } catch (error) {
    console.error('💥 Configuration check error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Configuration check failed',
        details: error.message,
        stack: error.stack
      })
    };
  }
};