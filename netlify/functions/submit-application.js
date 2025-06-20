// netlify/functions/submit-application.js - Enhanced Debug Version
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
    console.log('📊 Form data received:', {
      name: data.name,
      email: data.email,
      hasPhone: !!data.phone,
      hasCompany: !!data.company
    });
    
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

    // Check environment variables
    console.log('🔧 Environment check:');
    console.log('  NETLIFY_SITE_ID:', process.env.NETLIFY_SITE_ID ? 'SET' : 'MISSING');
    console.log('  NETLIFY_ACCESS_TOKEN:', process.env.NETLIFY_ACCESS_TOKEN ? 'SET (length: ' + process.env.NETLIFY_ACCESS_TOKEN.length + ')' : 'MISSING');

    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing required Netlify environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error - missing Netlify credentials' })
      };
    }

    try {
      console.log('💾 Setting up Netlify Blobs storage...');
      
      const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
      const blobUrl = `${blobsBaseUrl}/applications:applications.json`;
      console.log('🌐 Using blob URL:', blobUrl);
      
      console.log('📖 Fetching existing applications...');
      let applications = [];
      
      // Try to get existing applications
      try {
        const getResponse = await fetch(blobUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📡 GET response status:', getResponse.status);
        
        if (getResponse.ok) {
          const existingData = await getResponse.text();
          console.log('📄 Existing data length:', existingData ? existingData.length : 0);
          
          if (existingData && existingData.trim()) {
            try {
              const parsedData = JSON.parse(existingData);
              if (Array.isArray(parsedData)) {
                applications = parsedData;
                console.log(`📊 Found ${applications.length} existing applications`);
              } else {
                console.log('⚠️ Existing data is not an array, starting fresh');
                applications = [];
              }
            } catch (parseError) {
              console.log('⚠️ Could not parse existing data as JSON, starting fresh:', parseError.message);
              applications = [];
            }
          } else {
            console.log('📝 Empty data from blobs, starting fresh');
            applications = [];
          }
        } else if (getResponse.status === 404) {
          console.log('📝 No existing applications found (404), will create new file');
          applications = [];
        } else {
          console.log(`❓ Unexpected response when fetching: ${getResponse.status}`);
          applications = [];
        }
      } catch (fetchError) {
        console.log('📝 Could not fetch existing applications, starting fresh:', fetchError.message);
        applications = [];
      }

      // Double-check that applications is an array before pushing
      if (!Array.isArray(applications)) {
        console.log('⚠️ Applications is not an array, resetting to empty array');
        applications = [];
      }

      // Add new application
      applications.push(application);
      console.log(`💾 Now have ${applications.length} applications total`);
      
      // Save applications to blobs
      console.log('💾 Saving to Netlify Blobs...');
      const applicationData = JSON.stringify(applications, null, 2);
      console.log('📄 Data to save length:', applicationData.length);
      console.log('📄 First application in array:', applications[0] ? applications[0].id : 'N/A');
      console.log('📄 Last application in array:', applications[applications.length - 1] ? applications[applications.length - 1].id : 'N/A');
      
      const putResponse = await fetch(blobUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: applicationData
      });
      
      console.log('📡 PUT response status:', putResponse.status);
      console.log('📡 PUT response headers:', Object.fromEntries(putResponse.headers.entries()));
      
      if (!putResponse.ok) {
        const errorText = await putResponse.text();
        console.error('❌ PUT failed with body:', errorText);
        throw new Error(`Failed to save to blobs: ${putResponse.status} - ${errorText}`);
      }
      
      console.log('✅ Applications saved successfully to Netlify Blobs');

      // Verify the save by reading it back
      console.log('🔍 Verifying save by reading back...');
      try {
        const verifyResponse = await fetch(blobUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.text();
          const verifyParsed = JSON.parse(verifyData);
          console.log('✅ Verification successful - found', verifyParsed.length, 'applications');
        } else {
          console.log('⚠️ Verification failed with status:', verifyResponse.status);
        }
      } catch (verifyError) {
        console.log('⚠️ Verification error:', verifyError.message);
      }

    } catch (blobError) {
      console.error('❌ Blob storage error:', blobError.message);
      console.error('❌ Blob error stack:', blobError.stack);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Database error: ${blobError.message}` })
      };
    }

    // Send admin notification email
    try {
      console.log('📧 Attempting to send admin notification...');
      await sendAdminNotification(application);
      console.log('✅ Admin notification sent');
    } catch (emailError) {
      console.error('❌ Email notification failed:', emailError.message);
      // Don't fail the whole request if email fails
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
        applicationId: application.id,
        debug: {
          saved: true,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('💥 Function error:', error.message);
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

async function sendAdminNotification(application) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log('📧 No admin email configured, skipping notification');
    return;
  }

  console.log('📧 Preparing admin notification email...');

  const baseUrl = process.env.SITE_URL;
  const approveUrl = `${baseUrl}/admin.html?action=approve&id=${application.id}&token=${application.approveToken}`;
  const rejectUrl = `${baseUrl}/admin.html?action=reject&id=${application.id}&token=${application.rejectToken}`;

  const subject = `New Kartel Application - ${application.name}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">The Kartel</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">New Membership Application</p>
      </div>
      
      <div style="padding: 30px; background: #f8f9fa;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Quick Actions</h2>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${approveUrl}" 
             style="background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 15px; display: inline-block;">
            APPROVE APPLICATION
          </a>
          <a href="${rejectUrl}" 
             style="background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            REJECT APPLICATION
          </a>
        </div>
        
        <h3 style="color: #2c3e50; margin-bottom: 15px;">Application Details</h3>
        
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 12px 0; font-weight: bold; color: #2c3e50; width: 30%;">Name:</td>
              <td style="padding: 12px 0; color: #5d6d7e;">${application.name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 12px 0; font-weight: bold; color: #2c3e50;">Email:</td>
              <td style="padding: 12px 0; color: #5d6d7e;">${application.email}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 12px 0; font-weight: bold; color: #2c3e50;">Phone:</td>
              <td style="padding: 12px 0; color: #5d6d7e;">${application.phone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 12px 0; font-weight: bold; color: #2c3e50;">Company:</td>
              <td style="padding: 12px 0; color: #5d6d7e;">${application.company || 'Not provided'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 12px 0; font-weight: bold; color: #2c3e50;">Industry:</td>
              <td style="padding: 12px 0; color: #5d6d7e;">${application.industry || 'Not provided'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 12px 0; font-weight: bold; color: #2c3e50;">Submitted:</td>
              <td style="padding: 12px 0; color: #5d6d7e;">${new Date(application.submittedAt).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-weight: bold; color: #2c3e50; vertical-align: top;">Message:</td>
              <td style="padding: 12px 0; color: #5d6d7e;">${application.message || 'No message provided'}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${process.env.SITE_URL}/admin.html" 
             style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Open Admin Dashboard
          </a>
        </div>
      </div>
      
      <div style="background: #2c3e50; color: #bdc3c7; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">This is an automated notification from The Kartel membership system.</p>
      </div>
    </div>
  `;

  await sendEmail(adminEmail, subject, htmlBody);
}

async function sendEmail(to, subject, htmlBody) {
  try {
    console.log('📧 Importing SendGrid...');
    const sgMail = require('@sendgrid/mail');
    
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }
    
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: to,
      from: process.env.FROM_EMAIL,
      subject: subject,
      html: htmlBody,
    };

    console.log('📤 Sending email via SendGrid...');
    await sgMail.send(msg);
    console.log('✅ Email sent successfully');
  } catch (emailError) {
    console.error('❌ SendGrid error:', emailError.message);
    throw emailError;
  }
}