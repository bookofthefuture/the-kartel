const { getStore } = require('@netlify/blobs');
const sgMail = require('@sendgrid/mail');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Allow quick actions without authentication for direct email link access
  // The security comes from the unique action tokens

  try {
    const { action, applicationId, actionToken } = JSON.parse(event.body);
    
    console.log(`🚀 Processing quick action: ${action} for ${applicationId}`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Get applications store
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get the specific application
    const application = await applicationsStore.get(applicationId, { type: 'json' });
    
    if (!application) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Application not found' })
      };
    }

    // Verify action token
    const expectedToken = action === 'approve' ? application.approveToken : application.rejectToken;
    if (actionToken !== expectedToken) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid action token' })
      };
    }

    // Check if already processed
    if (application.status !== 'pending') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Application already processed' })
      };
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    // Update application
    const updatedApplication = {
      ...application,
      status: newStatus,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Admin (Quick Action)',
      updatedAt: new Date().toISOString()
    };

    // Save updated application
    await applicationsStore.setJSON(applicationId, updatedApplication);

    // Update applications list
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      
      if (applicationsList && Array.isArray(applicationsList)) {
        const appIndex = applicationsList.findIndex(app => app.id === applicationId);
        if (appIndex !== -1) {
          applicationsList[appIndex] = updatedApplication;
          await applicationsStore.setJSON('_list', applicationsList);
          console.log('✅ Applications list updated');
        }
      }
    } catch (listError) {
      console.log('⚠️ Failed to update applications list:', listError.message);
    }

    // Send email to applicant
    try {
      if (newStatus === 'approved') {
        await sendApprovalEmail(updatedApplication);
      } else {
        await sendRejectionEmail(updatedApplication);
      }
    } catch (emailError) {
      console.error('Failed to send applicant email:', emailError);
    }

    console.log(`✅ Application ${applicationId} ${newStatus} via quick action`);

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        success: true, 
        message: `Application ${newStatus} successfully`,
        application: {
          id: updatedApplication.id,
          status: updatedApplication.status,
          name: `${updatedApplication.firstName} ${updatedApplication.lastName}`
        }
      })
    };

  } catch (error) {
    console.error('💥 Error processing quick action:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

async function sendApprovalEmail(application) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured, skipping approval email');
    return;
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: application.email,
    from: process.env.FROM_EMAIL,
    subject: 'Welcome to The Kartel - Application Approved!',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">The Kartel</h1>
          <p style="color: #ecf0f1; margin: 10px 0 0 0; font-size: 16px;">Exclusive Business Networking</p>
        </div>
        
        <div style="padding: 40px 20px; background: white;">
          <h2 style="color: #27ae60; margin-top: 0;">🎉 Congratulations!</h2>
          
          <p>Dear ${application.firstName},</p>
          
          <p>We're excited to inform you that your application to join The Kartel has been <strong style="color: #27ae60;">APPROVED</strong>!</p>
          
          <p>Welcome to Manchester's most exclusive business networking group. You'll receive additional information about upcoming events and membership details shortly.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">What's Next?</h3>
            <ul style="color: #555;">
              <li>Look out for event invitations in your inbox</li>
              <li>Follow us on social media for updates</li>
              <li>Get ready for high-octane networking!</li>
            </ul>
          </div>
          
          <p>We look forward to meeting you at our next karting event.</p>
          
          <p>Best regards,<br><strong>The Kartel Team</strong></p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #7f8c8d; font-size: 12px;">
          <p>© 2024 The Kartel. All rights reserved.</p>
        </div>
      </div>
    `
  };

  await sgMail.send(msg);
  console.log(`✅ Approval email sent to ${application.email}`);
}

async function sendRejectionEmail(application) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured, skipping rejection email');
    return;
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: application.email,
    from: process.env.FROM_EMAIL,
    subject: 'The Kartel - Application Update',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">The Kartel</h1>
          <p style="color: #ecf0f1; margin: 10px 0 0 0; font-size: 16px;">Exclusive Business Networking</p>
        </div>
        
        <div style="padding: 40px 20px; background: white;">
          <h2 style="color: #2c3e50; margin-top: 0;">Application Update</h2>
          
          <p>Dear ${application.firstName},</p>
          
          <p>Thank you for your interest in joining The Kartel. After careful consideration, we're unable to approve your application at this time.</p>
          
          <p>This decision is based on our current membership capacity and specific criteria for our exclusive networking group.</p>
          
          <p>We encourage you to reapply in the future as our membership requirements may change.</p>
          
          <p>Thank you for your understanding.</p>
          
          <p>Best regards,<br><strong>The Kartel Team</strong></p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #7f8c8d; font-size: 12px;">
          <p>© 2024 The Kartel. All rights reserved.</p>
        </div>
      </div>
    `
  };

  await sgMail.send(msg);
  console.log(`✅ Rejection email sent to ${application.email}`);
}