// netlify/functions/send-admin-invitation.js
const sgMail = require('@sendgrid/mail');
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate JWT token and require admin role
  const authResult = validateAuthHeader(event.headers.authorization);
  if (!authResult.success) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error })
    };
  }

  // Check if user has admin role
  const roleCheck = requireRole(['admin', 'super-admin'])(authResult.payload);
  if (!roleCheck.success) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: roleCheck.error })
    };
  }

  try {
    const { applicationId, firstName, lastName, email } = JSON.parse(event.body);
    
    console.log(`📧 Sending admin invitation to ${email}`);

    // Validate required fields
    if (!applicationId || !firstName || !lastName || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Application ID, first name, last name, and email are required' })
      };
    }

    // Check environment variables
    if (!process.env.SENDGRID_API_KEY || !process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Set up SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Generate secure setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Store the setup token
    const tokensStore = getStore({
      name: 'admin-tokens',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    await tokensStore.setJSON(setupToken, {
      applicationId,
      email,
      firstName,
      lastName,
      type: 'admin-setup',
      createdAt: new Date().toISOString(),
      expiresAt: setupExpiry.toISOString(),
      used: false
    });

    // Create setup URL
    const setupUrl = `https://the-kartel.com/admin-setup.html?token=${setupToken}`;

    // Email content
    const msg = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: 'Welcome to The Kartel - Admin Access Setup',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">The Kartel</h1>
            <p style="color: #ecf0f1; margin: 10px 0 0 0; font-size: 16px;">Exclusive Business Networking</p>
          </div>
          
          <div style="padding: 40px 20px; background: white;">
            <h2 style="color: #2c3e50; margin-top: 0;">Administrator Access Granted</h2>
            
            <p>Hello ${firstName},</p>
            
            <p>Congratulations! You've been granted administrator access to The Kartel platform. As an administrator, you'll have access to:</p>
            
            <ul style="color: #555; margin: 20px 0;">
              <li>Member application management</li>
              <li>Event creation and management</li>
              <li>Venue management</li>
              <li>Photo gallery administration</li>
              <li>FAQ management</li>
            </ul>
            
            <p>To complete your administrator setup, please click the button below to create your admin password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${setupUrl}" style="display: inline-block; background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Set Up Admin Access</a>
            </div>
            
            <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px;">
              <strong>Important:</strong> This invitation link will expire in 24 hours. If you need a new invitation, please contact your system administrator.
            </p>
            
            <p style="color: #7f8c8d; font-size: 12px; margin-top: 40px;">
              If you're having trouble with the button above, copy and paste this URL into your browser:<br>
              <span style="word-break: break-all;">${setupUrl}</span>
            </p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #7f8c8d; font-size: 12px;">
            <p>© 2024 The Kartel. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    // Send email
    await sgMail.send(msg);

    console.log(`✅ Admin invitation sent successfully to ${email}`);

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        success: true, 
        message: `Admin invitation sent to ${email}`,
        setupToken: setupToken // Return for testing purposes
      })
    };

  } catch (error) {
    console.error('💥 Error sending admin invitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to send admin invitation',
        details: error.message
      })
    };
  }
};