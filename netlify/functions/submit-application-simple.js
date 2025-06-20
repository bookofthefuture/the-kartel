// netlify/functions/submit-application-simple.js
// Simplified version that stores each application as a separate blob
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('📝 Simple form submission started');
    
    const data = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    
    const requiredFields = ['name', 'email', 'phone'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing required field: ${field}` })
        };
      }
    }

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

    console.log('📋 Application created:', application.id);

    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    try {
      // Store each application as a separate blob
      const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
      const applicationBlobUrl = `${blobsBaseUrl}/application-${application.id}`;
      
      console.log('💾 Saving individual application blob...');
      
      const putResponse = await fetch(applicationBlobUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(application, null, 2)
      });
      
      console.log('📡 PUT response status:', putResponse.status);
      
      if (!putResponse.ok) {
        const errorText = await putResponse.text();
        console.error('❌ PUT failed:', errorText);
        throw new Error(`Failed to save application: ${putResponse.status}`);
      }
      
      console.log('✅ Application saved as individual blob');

      // Also try to update the applications list (best effort)
      try {
        await updateApplicationsList(application);
        console.log('✅ Applications list updated');
      } catch (listError) {
        console.log('⚠️ Failed to update applications list:', listError.message);
        // Don't fail the request if the list update fails
      }

    } catch (blobError) {
      console.error('❌ Blob storage error:', blobError.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Database error: ${blobError.message}` })
      };
    }

    // Send admin notification
    try {
      await sendAdminNotification(application);
      console.log('✅ Admin notification sent');
    } catch (emailError) {
      console.error('❌ Email failed:', emailError.message);
    }

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

async function updateApplicationsList(newApplication) {
  const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
  const listBlobUrl = `${blobsBaseUrl}/applications-list`;
  
  let applications = [];
  
  // Try to get existing list
  try {
    const getResponse = await fetch(listBlobUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (getResponse.ok) {
      const responseData = await getResponse.json();
      
      if (responseData.url) {
        const dataResponse = await fetch(responseData.url);
        if (dataResponse.ok) {
          const existingData = await dataResponse.text();
          if (existingData) {
            applications = JSON.parse(existingData);
          }
        }
      } else if (Array.isArray(responseData)) {
        applications = responseData;
      }
    }
  } catch (error) {
    console.log('Starting fresh applications list');
  }
  
  // Add new application
  applications.push(newApplication);
  
  // Save updated list
  const putResponse = await fetch(listBlobUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(applications, null, 2)
  });
  
  if (!putResponse.ok) {
    throw new Error(`Failed to update applications list: ${putResponse.status}`);
  }
}

async function sendAdminNotification(application) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const baseUrl = process.env.SITE_URL;
  const subject = `New Kartel Application - ${application.name}`;
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2c3e50; color: white; padding: 20px; text-align: center;">
        <h1>The Kartel - New Application</h1>
      </div>
      <div style="padding: 20px;">
        <h2>Application from ${application.name}</h2>
        <p><strong>Email:</strong> ${application.email}</p>
        <p><strong>Phone:</strong> ${application.phone}</p>
        <p><strong>Company:</strong> ${application.company || 'Not provided'}</p>
        <p><strong>Message:</strong> ${application.message || 'None'}</p>
        <p><strong>Application ID:</strong> ${application.id}</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${baseUrl}/admin.html" style="background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;">
            View in Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.send({
      to: adminEmail,
      from: process.env.FROM_EMAIL,
      subject: subject,
      html: htmlBody,
    });
  } catch (emailError) {
    console.error('SendGrid error:', emailError);
    throw emailError;
  }
}