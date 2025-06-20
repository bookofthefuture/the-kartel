// netlify/functions/submit-application.js
// Fixed version with correct Netlify Blobs import
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('📝 Function started');
    
    const data = JSON.parse(event.body);
    console.log('📊 Received data:', data);
    
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

    console.log('📋 Application object created:', application.id);

    // Check environment variables
    console.log('🔧 Checking environment variables:');
    console.log('  NETLIFY_SITE_ID:', process.env.NETLIFY_SITE_ID ? 'SET' : 'MISSING');
    console.log('  NETLIFY_ACCESS_TOKEN:', process.env.NETLIFY_ACCESS_TOKEN ? 'SET' : 'MISSING');

    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing required Netlify environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error - missing Netlify credentials' })
      };
    }

    try {
      console.log('💾 Importing Netlify Blobs...');
      
      // Try different import methods for Netlify Blobs
      let createClient;
      try {
        // Method 1: Try named import
        const blobs = await import('@netlify/blobs');
        createClient = blobs.createClient;
        console.log('✅ Netlify Blobs imported via named import');
      } catch (importError1) {
        try {
          // Method 2: Try require
          const blobs = require('@netlify/blobs');
          createClient = blobs.createClient;
          console.log('✅ Netlify Blobs imported via require');
        } catch (importError2) {
          console.error('❌ Failed to import Netlify Blobs:', importError1, importError2);
          throw new Error('Failed to import Netlify Blobs library');
        }
      }

      if (!createClient) {
        throw new Error('createClient function not found in @netlify/blobs');
      }

      console.log('💾 Creating Netlify Blobs client...');
      const blobsClient = createClient({
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_ACCESS_TOKEN
      });
      console.log('✅ Blobs client created');

      console.log('📖 Fetching existing applications...');
      let applications = [];
      try {
        const existingData = await blobsClient.get('applications', 'applications.json');
        if (existingData) {
          applications = JSON.parse(existingData);
          console.log(`📊 Found ${applications.length} existing applications`);
        }
      } catch (error) {
        console.log('📝 No existing applications found, creating new file');
      }

      applications.push(application);
      console.log(`💾 Saving ${applications.length} applications...`);
      
      await blobsClient.set('applications', 'applications.json', JSON.stringify(applications, null, 2));
      console.log('✅ Applications saved successfully');

    } catch (blobError) {
      console.error('❌ Blob storage error:', blobError);
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
      console.error('❌ Email notification failed:', emailError);
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
        applicationId: application.id
      })
    };

  } catch (error) {
    console.error('💥 Function error:', error);
    console.error('Error stack:', error.stack);
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
    console.error('❌ SendGrid error:', emailError);
    throw emailError;
  }
}