const { createClient } = require('@netlify/blobs');

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

    const blobs = createClient({
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN
    });

    let applications = [];
    try {
      const data = await blobs.get('applications', 'applications.json');
      if (data) {
        applications = JSON.parse(data);
      }
    } catch (error) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Applications not found' })
      };
    }

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

    await blobs.set('applications', 'applications.json', JSON.stringify(applications, null, 2));

    // Send email to applicant if requested
    if (shouldSendEmail) {
      try {
        await sendApplicantEmail(application, status);
      } catch (emailError) {
        console.error('Failed to send applicant email:', emailError);
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
    console.error('Error updating application:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
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
  const subject = `🎉 Welcome to The Kartel - Application Approved!`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 50%, #27ae60 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">🏁 Welcome to The Kartel!</h1>
        <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Your application has been approved</p>
      </div>
      
      <div style="padding: 40px; background: #f8f9fa;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Congratulations, ${application.name}! 🎊</h2>
        
        <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 25px;">
          <p style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px; line-height: 1.6;">
            We're thrilled to welcome you to <strong>The Kartel</strong> - Manchester's most exclusive business networking collective where deals are made at 40mph!
          </p>
          
          <p style="margin: 0; color: #5d6d7e; font-size: 14px; line-height: 1.6;">
            You're now part of an elite community of ambitious professionals who believe that the best connections are forged through shared adrenaline and authentic competition.
          </p>
        </div>
        
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #27ae60; margin-bottom: 25px;">
          <h3 style="margin: 0 0 10px 0; color: #27ae60;">🎯 What Happens Next?</h3>
          <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
            <li style="margin-bottom: 8px;">You'll receive an invitation to our private WhatsApp group within 24 hours</li>
            <li style="margin-bottom: 8px;">Get exclusive access to upcoming karting events and networking sessions</li>
            <li style="margin-bottom: 8px;">Connect with fellow members before the next track day</li>
            <li>Start building relationships that accelerate your business</li>
          </ul>
        </div>
        
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #f39c12; margin-bottom: 25px;">
          <h3 style="margin: 0 0 10px 0; color: #f39c12;">⚡ Pro Tips for Your First Event:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
            <li style="margin-bottom: 8px;">Arrive 15 minutes early to network before racing</li>
            <li style="margin-bottom: 8px;">Don't be afraid to be competitive - it reveals character!</li>
            <li style="margin-bottom: 8px;">The real magic happens in the post-race conversations</li>
            <li>Bring business cards - deals happen in the pit lane</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="margin: 0 0 20px 0; color: #7f8c8d; font-style: italic;">
            "The fastest way to build trust is to race wheel-to-wheel"
          </p>
          <p style="margin: 0; color: #2c3e50; font-weight: bold;">
            Welcome to the fast lane of business networking! 🏎️
          </p>
        </div>
      </div>
      
      <div style="background: #2c3e50; color: #bdc3c7; padding: 20px; text-align: center;">
        <p style="margin: 0 0 10px 0; font-weight: bold;">The Kartel Team</p>
        <p style="margin: 0; font-size: 12px;">Where Business Meets the Track</p>
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
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">🏁 The Kartel</h1>
        <p style="margin: 15px 0 0 0; opacity: 0.9;">Thank you for your application</p>
      </div>
      
      <div style="padding: 40px; background: #f8f9fa;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Dear ${application.name},</h2>
        
        <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 25px;">
          <p style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Thank you for your interest in joining <strong>The Kartel</strong>. We appreciate the time you took to apply to our exclusive networking collective.
          </p>
          
          <p style="margin: 0 0 15px 0; color: #5d6d7e; font-size: 14px; line-height: 1.6;">
            After careful consideration, we've decided not to move forward with your application at this time. This decision reflects our current membership composition and the specific expertise we're seeking to balance our community.
          </p>
          
          <p style="margin: 0; color: #5d6d7e; font-size: 14px; line-height: 1.6;">
            We encourage you to reapply in the future as our membership needs evolve. We wish you all the best in your professional endeavors.
          </p>
        </div>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db;">
          <p style="margin: 0; color: #2c3e50; font-size: 14px; line-height: 1.6;">
            <strong>Stay Connected:</strong> Follow our journey on social media and consider applying again as we expand our community.
          </p>
        </div>
      </div>
      
      <div style="background: #2c3e50; color: #bdc3c7; padding: 20px; text-align: center;">
        <p style="margin: 0 0 10px 0; font-weight: bold;">The Kartel Team</p>
        <p style="margin: 0; font-size: 12px;">Where Business Meets the Track</p>
      </div>
    </div>
  `;

  await sendEmail(application.email, subject, htmlBody);
}

async function sendEmail(to, subject, htmlBody) {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: to,
    from: process.env.FROM_EMAIL,
    subject: subject,
    html: htmlBody,
  };

  await sgMail.send(msg);
}
