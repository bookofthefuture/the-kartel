// netlify/functions/update-application.js - Fixed to handle redirects
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

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
    const { applicationId, status, notes, sendEmail: shouldSendEmail } = JSON.parse(event.body);
    
    console.log(`🔄 Updating application ${applicationId} to ${status}`);

    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing required Netlify environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const blobsBaseUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/blobs`;
    const blobUrl = `${blobsBaseUrl}/applications:applications.json`;
    
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
          console.log('🔗 Following redirect to get data for update...');
          const dataResponse = await fetch(responseData.url);
          
          if (dataResponse.ok) {
            const existingData = await dataResponse.text();
            if (existingData && existingData.trim()) {
              try {
                const parsedData = JSON.parse(existingData);
                if (Array.isArray(parsedData)) {
                  applications = parsedData;
                  console.log(`📊 Loaded ${applications.length} applications for update`);
                }
              } catch (parseError) {
                console.log('⚠️ Could not parse existing data for update');
              }
            }
          }
        } else if (Array.isArray(responseData)) {
          applications = responseData;
          console.log(`📊 Direct data for update: ${applications.length} applications`);
        }
      }
    } catch (fetchError) {
      console.error('❌ Error fetching applications for update:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not load applications' })
      };
    }

    // Find and update application
    const appIndex = applications.findIndex(app => app.id === applicationId);
    if (appIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Application not found' })
      };
    }

    const application = applications[appIndex];
    applications[appIndex].status = status;
    applications[appIndex].reviewedAt = new Date().toISOString();
    applications[appIndex].reviewedBy = 'Admin';
    if (notes) {
      applications[appIndex].notes = notes;
    }

    // Save updated applications
    try {
      const putResponse = await fetch(blobUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(applications, null, 2)
      });
      
      if (!putResponse.ok) {
        throw new Error(`Failed to save updated applications: ${putResponse.status}`);
      }
      
      console.log('✅ Applications updated successfully');
    } catch (saveError) {
      console.error('❌ Error saving updated applications:', saveError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to save updated application' })
      };
    }

    // Send email to applicant if requested
    if (shouldSendEmail) {
      try {
        await sendApplicantEmail(application, status);
        console.log('✅ Applicant email sent');
      } catch (emailError) {
        console.error('❌ Failed to send applicant email:', emailError);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Application updated successfully' 
      })
    };

  } catch (error) {
    console.error('💥 Error updating application:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Email functions (same as before)
async function sendAdminNotification(application) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log('📧 No admin email configured, skipping notification');
    return;
  }

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
    </div>
  `;

  await sendEmail(adminEmail, subject, htmlBody);
}

async function sendApplicantEmail(application, status) {
  if (status === 'approved') {
    await sendApprovalEmail(application);
  } else if (status === 'rejected') {
    await sendRejectionEmail(application);
  }
}

async function sendApprovalEmail(application) {
  const subject = `Welcome to The Kartel - Application Approved!`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 50%, #27ae60 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Welcome to The Kartel!</h1>
        <p style="margin: 15px 0 0 0; font-size: 18px;">Your application has been approved</p>
      </div>
      
      <div style="padding: 40px; background: #f8f9fa;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Congratulations, ${application.name}!</h2>
        <p style="color: #2c3e50;">We're thrilled to welcome you to The Kartel - Manchester's most exclusive business networking collective!</p>
      </div>
    </div>
  `;

  await sendEmail(application.email, subject, htmlBody);
}

async function sendRejectionEmail(application) {
  const subject = `Thank you for your interest in The Kartel`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">The Kartel</h1>
      </div>
      
      <div style="padding: 40px; background: #f8f9fa;">
        <h2 style="color: #2c3e50;">Dear ${application.name},</h2>
        <p style="color: #2c3e50;">Thank you for your interest in The Kartel. After careful consideration, we've decided not to move forward with your application at this time.</p>
      </div>
    </div>
  `;

  await sendEmail(application.email, subject, htmlBody);
}

async function sendEmail(to, subject, htmlBody) {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: to,
      from: process.env.FROM_EMAIL,
      subject: subject,
      html: htmlBody,
    };

    await sgMail.send(msg);
  } catch (emailError) {
    console.error('SendGrid error:', emailError);
    throw emailError;
  }
}