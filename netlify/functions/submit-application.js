// netlify/functions/submit-application.js - Fixed to handle redirects
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('📝 Form submission started');
    
    const data = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    
    const requiredFields = ['name', 'email', 'phone'];
    for (const field of requiredFields) {
      if (!data[field]) {
        console.log(`❌ Missing field: ${field}`);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing required field: ${field}` })
        };
      }
    }

    console.log('✅ All required fields present');

    // Generate unique action tokens for quick actions
    const approveToken = crypto.randomBytes(16).toString('hex');
    const rejectToken = crypto.randomBytes(16).toString('hex');

    const application = {
      id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: data.name,
      email: data.email,
      company: data.company || '',
      phone: data.phone,
      industry: data.industry || '',
      message: data.message || '',
      status: 'pending',
      submittedAt: timestamp,
      reviewedAt: null,
      reviewedBy: null,
      approveToken,
      rejectToken
    };

    console.log('📋 Application created with ID:', application.id);

    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing required Netlify environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    try {
      const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
      const blobUrl = `${blobsBaseUrl}/applications:applications.json`;
      
      console.log('📖 Fetching existing applications...');
      let applications = [];
      
      // Get existing applications (handle redirect)
      try {
        const getResponse = await fetch(blobUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (getResponse.ok) {
          const responseData = await getResponse.json();
          
          if (responseData.url) {
            console.log('🔗 Following redirect to get existing data...');
            const dataResponse = await fetch(responseData.url);
            
            if (dataResponse.ok) {
              const existingData = await dataResponse.text();
              if (existingData && existingData.trim()) {
                try {
                  const parsedData = JSON.parse(existingData);
                  if (Array.isArray(parsedData)) {
                    applications = parsedData;
                    console.log(`📊 Found ${applications.length} existing applications`);
                  }
                } catch (parseError) {
                  console.log('⚠️ Could not parse existing data, starting fresh');
                  applications = [];
                }
              }
            }
          } else if (Array.isArray(responseData)) {
            applications = responseData;
            console.log(`📊 Direct data: ${applications.length} existing applications`);
          }
        } else if (getResponse.status === 404) {
          console.log('📝 No existing applications found, starting fresh');
          applications = [];
        }
      } catch (fetchError) {
        console.log('📝 Could not fetch existing applications, starting fresh');
        applications = [];
      }

      // Add new application
      applications.push(application);
      console.log(`💾 Now have ${applications.length} applications total`);
      
      // Save applications to blobs
      console.log('💾 Saving to Netlify Blobs...');
      const putResponse = await fetch(blobUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(applications, null, 2)
      });
      
      console.log('📡 PUT response status:', putResponse.status);
      
      if (!putResponse.ok) {
        const errorText = await putResponse.text();
        console.error('❌ PUT failed:', errorText);
        throw new Error(`Failed to save to blobs: ${putResponse.status}`);
      }
      
      console.log('✅ Applications saved successfully');

    } catch (blobError) {
      console.error('❌ Blob storage error:', blobError.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Database error: ${blobError.message}` })
      };
    }

    // Send admin notification email
    try {
      console.log('📧 Sending admin notification...');
      await sendAdminNotification(application);
      console.log('✅ Admin notification sent');
    } catch (emailError) {
      console.error('❌ Email notification failed:', emailError.message);
    }

    console.log('🎉 Application submitted successfully');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Application submitted successfully',
        applicationId: application.id
      })
    };

  } catch (error) {
    console.error('💥 Function error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};