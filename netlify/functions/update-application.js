// netlify/functions/update-application.js - Updated for new field structure
const { getStore } = require('@netlify/blobs');

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

    // Manual configuration with explicit credentials
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
    
    // Update application
    application.status = status;
    application.reviewedAt = new Date().toISOString();
    application.reviewedBy = 'Admin';
    if (notes) {
      application.notes = notes;
    }
    
    // Save updated application
    await applicationsStore.setJSON(applicationId, application);
    
    // Update the applications list
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      
      if (applicationsList && Array.isArray(applicationsList)) {
        const appIndex = applicationsList.findIndex(app => app.id === applicationId);
        if (appIndex !== -1) {
          applicationsList[appIndex] = application;
          await applicationsStore.setJSON('_list', applicationsList);
          console.log('✅ Applications list updated');
        }
      }
    } catch (listError) {
      console.log('⚠️ Failed to update applications list:', listError.message);
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
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

async function sendApplicantEmail(application, status) {
  if (status === 'approved') {
    await sendApprovalEmail(application);
  } else if (status === 'rejected') {
    await sendRejectionEmail(application);
  }
}

async function sendApprovalEmail(application) {
  const applicantName = application.firstName || application.email;
  const subject = `Welcome to The Kartel - Application Approved!`;
  const htmlBody = `
    <div style="font-family: 'League Spartan', 'Arial', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 50%, #27ae60 100%); color: white; padding: 40px; text-align: center;">
        <img src="${process.env.SITE_URL || 'https://the-kartel.com'}/assets/the-kartel-logo.png" alt="The Kartel Logo" style="height: 60px; width: auto; margin-bottom: 15px; filter: brightness(0) invert(1);">
        <h1 style="margin: 0; font-size: 28px; font-family: 'League Spartan', 'Arial', sans-serif;">Welcome to The Kartel!</h1>
        <p style="margin: 15px 0 0 0; font-size: 18px; font-family: 'League Spartan', 'Arial', sans-serif;">Your application has been approved</p>
      </div>
      
      <div style="padding: 40px; background: #f8f9fa;">
        <h2 style="color: #2c3e50; margin-bottom: 20px; font-family: 'League Spartan', 'Arial', sans-serif;">Congratulations, ${applicantName}!</h2>
        <p style="color: #2c3e50; margin-bottom: 20px; font-family: 'League Spartan', 'Arial', sans-serif;">We're thrilled to welcome you to The Kartel - Manchester's most exclusive business networking collective!</p>
        
        <div style="background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #3498db; margin: 25px 0;">
          <h3 style="color: #2c3e50; margin-bottom: 15px; font-family: 'League Spartan', 'Arial', sans-serif;">🏁 Access Your Members Area</h3>
          <p style="color: #2c3e50; margin-bottom: 15px; font-family: 'League Spartan', 'Arial', sans-serif;">Log in to your exclusive members area to view upcoming events, see who's attending, and register for karting sessions:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.SITE_URL || 'https://the-kartel.com'}/members.html" style="display: inline-block; background: linear-gradient(45deg, #3498db, #2980b9); color: white; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-weight: bold; font-size: 16px; font-family: 'League Spartan', 'Arial', sans-serif;">Access Members Area</a>
          </div>
          <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 0;">Simply enter your email address to receive a secure login link.</p>
        </div>
        
        <div style="background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #e67e22; margin: 25px 0;">
          <h3 style="color: #2c3e50; margin-bottom: 15px; font-family: 'League Spartan', 'Arial', sans-serif;">📅 What's Next?</h3>
          <ul style="color: #2c3e50; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Browse upcoming karting events and register</li>
            <li style="margin-bottom: 8px;">See which members are attending each event</li>
            <li style="margin-bottom: 8px;">Access track maps and driving tips for venues</li>
            <li style="margin-bottom: 8px;">Join our private WhatsApp community (invite coming soon)</li>
          </ul>
        </div>
        
        <p style="color: #2c3e50; margin-top: 30px;">Get ready to accelerate your business network while racing around Manchester's finest karting tracks!</p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1;">
          <p style="color: #7f8c8d; font-size: 14px; margin: 0;">Questions? Reply to this email or contact us through the website.</p>
        </div>
      </div>
    </div>
  `;

  await sendEmail(application.email, subject, htmlBody);
}

async function sendRejectionEmail(application) {
  const applicantName = application.firstName || application.email;
  const subject = `Thank you for your interest in The Kartel`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">The Kartel</h1>
      </div>
      
      <div style="padding: 40px; background: #f8f9fa;">
        <h2 style="color: #2c3e50;">Dear ${applicantName},</h2>
        <p style="color: #2c3e50;">Thank you for your interest in The Kartel. After careful consideration, we've decided not to move forward with your application at this time.</p>
        <p style="color: #2c3e50;">We appreciate your interest and wish you well in your professional endeavors.</p>
      </div>
    </div>
  `;

  await sendEmail(application.email, subject, htmlBody);
}

async function sendEmail(to, subject, htmlBody) {
  if (!process.env.SENDGRID_API_KEY || !process.env.FROM_EMAIL) {
    console.log('SendGrid not configured, skipping email');
    return;
  }

  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.send({
      to: to,
      from: process.env.FROM_EMAIL,
      subject: subject,
      html: htmlBody,
    });
  } catch (emailError) {
    console.error('SendGrid error:', emailError);
    throw emailError;
  }
}