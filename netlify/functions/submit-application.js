const { createClient } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    
    // Validate required fields
    const requiredFields = ['name', 'email', 'phone'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Missing required field: ${field}` })
        };
      }
    }

    // Create application record
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
      reviewedBy: null
    };

    // Store in Netlify Blobs
    const blobs = createClient({
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN
    });

    // Get existing applications
    let applications = [];
    try {
      const existingData = await blobs.get('applications', 'applications.json');
      if (existingData) {
        applications = JSON.parse(existingData);
      }
    } catch (error) {
      console.log('No existing applications found, creating new file');
    }

    // Add new application
    applications.push(application);

    // Save back to blob storage
    await blobs.set('applications', 'applications.json', JSON.stringify(applications, null, 2));

    // Send email notification (don't let email failure block the application)
    try {
      await sendEmailNotification(application);
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
      // Continue anyway - the application was saved successfully
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
    console.error('Error processing application:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function sendEmailNotification(application) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const emailService = process.env.EMAIL_SERVICE || 'netlify'; // 'netlify' or 'sendgrid'
  
  if (!adminEmail) {
    console.log('No admin email configured, skipping notification');
    return;
  }

  const subject = `New Kartel Membership Application - ${application.name}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">The Kartel</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">New Membership Application</p>
      </div>
      
      <div style="padding: 30px; background: #f8f9fa;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Application Details</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px 0; font-weight: bold; color: #2c3e50; width: 30%;">Name:</td>
              <td style="padding: 10px 0; color: #5d6d7e;">${application.name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px 0; font-weight: bold; color: #2c3e50;">Email:</td>
              <td style="padding: 10px 0; color: #5d6d7e;">${application.email}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px 0; font-weight: bold; color: #2c3e50;">Phone:</td>
              <td style="padding: 10px 0; color: #5d6d7e;">${application.phone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px 0; font-weight: bold; color: #2c3e50;">Company:</td>
              <td style="padding: 10px 0; color: #5d6d7e;">${application.company || 'Not provided'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px 0; font-weight: bold; color: #2c3e50;">Industry:</td>
              <td style="padding: 10px 0; color: #5d6d7e;">${application.industry || 'Not provided'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ecf0f1;">
              <td style="padding: 10px 0; font-weight: bold; color: #2c3e50;">Submitted:</td>
              <td style="padding: 10px 0; color: #5d6d7e;">${new Date(application.submittedAt).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #2c3e50; vertical-align: top;">Message:</td>
              <td style="padding: 10px 0; color: #5d6d7e;">${application.message || 'No message provided'}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.URL}/admin.html" 
             style="background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            Review Application
          </a>
        </div>
      </div>
      
      <div style="background: #2c3e50; color: #bdc3c7; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">This is an automated notification from The Kartel membership system.</p>
      </div>
    </div>
  `;

  const textBody = `
New Kartel Membership Application

Name: ${application.name}
Email: ${application.email}
Phone: ${application.phone}
Company: ${application.company || 'Not provided'}
Industry: ${application.industry || 'Not provided'}
Submitted: ${new Date(application.submittedAt).toLocaleString()}

Message: ${application.message || 'No message provided'}

Review this application at: ${process.env.URL}/admin.html

Application ID: ${application.id}
  `;

  if (emailService === 'sendgrid') {
    await sendViaSendGrid(adminEmail, subject, htmlBody, textBody);
  } else {
    await sendViaNetlify(adminEmail, subject, htmlBody, textBody);
  }
}

async function sendViaNetlify(to, subject, htmlBody, textBody) {
  // Use Netlify's built-in form submission to trigger email
  const formData = new FormData();
  formData.append('form-name', 'admin-notifications');
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html-body', htmlBody);
  formData.append('text-body', textBody);

  const response = await fetch(`${process.env.URL}/`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to send Netlify notification');
  }
}

async function sendViaSendGrid(to, subject, htmlBody, textBody) {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: to,
    from: process.env.FROM_EMAIL || 'noreply@the-kartel.com',
    subject: subject,
    text: textBody,
    html: htmlBody,
  };

  await sgMail.send(msg);
}