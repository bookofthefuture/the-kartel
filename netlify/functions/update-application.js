// netlify/functions/update-application.js - CORRECT IMPLEMENTATION  
import { getStore } from '@netlify/blobs';

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

    // Use strong consistency for updates
    const applicationsStore = getStore({
      name: 'applications',
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