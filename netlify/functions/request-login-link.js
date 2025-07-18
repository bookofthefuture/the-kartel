// netlify/functions/request-login-link.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const { sanitizeEmail } = require('./input-sanitization');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const rawData = JSON.parse(event.body);
    const email = sanitizeEmail(rawData.email);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required or invalid' })
      };
    }

    console.log(`🔗 Magic link requested for: ${email}`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get applications list
    let applications = [];
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      if (applicationsList && Array.isArray(applicationsList)) {
        applications = applicationsList;
      }
    } catch (error) {
      console.log('📝 No applications list found');
      applications = [];
    }

    // Find approved member
    const member = applications.find(
      app => app.email.toLowerCase() === email.toLowerCase() && app.status === 'approved'
    );

    // Always return success to prevent email enumeration
    const successResponse = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        message: 'If your email is registered, you will receive a login link shortly.'
      })
    };

    if (!member) {
      console.log(`❌ No approved member found for: ${email}`);
      return successResponse;
    }

    // Generate secure login token
    const loginToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store login token temporarily
    const tokenStore = getStore({
      name: 'login-tokens',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    await tokenStore.setJSON(loginToken, {
      memberId: member.id,
      email: member.email,
      createdAt: new Date().toISOString(),
      expiresAt: expiry.toISOString(),
      used: false
    });

    // Send magic link email
    try {
      await sendMagicLinkEmail(member, loginToken);
      console.log(`✅ Magic link sent to: ${email}`);
    } catch (emailError) {
      console.error('📧 Failed to send email:', emailError);
      // Still return success to prevent email enumeration
    }

    return successResponse;

  } catch (error) {
    console.error('💥 Error sending magic link:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};

async function sendMagicLinkEmail(member, loginToken) {
  if (!process.env.SENDGRID_API_KEY || !process.env.FROM_EMAIL) {
    console.log('SendGrid not configured, skipping email');
    return;
  }

  // Use deploy prime URL for preview environments, otherwise use configured site URL
  const baseUrl = process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || 'https://the-kartel.com';
  const loginUrl = `${baseUrl}/members.html?token=${loginToken}`;
  const memberName = member.firstName || member.email;

  const subject = 'Your Secure Kartel Login Link';
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">The Kartel</h1>
        <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Secure Members Area Access</p>
      </div>
      
      <div style="padding: 40px; background: #f8f9fa;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Hello ${memberName},</h2>
        <p style="color: #2c3e50; margin-bottom: 25px;">Click the button below to securely access your Kartel members area:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 1px;">
            Access Members Area
          </a>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 25px 0;">
          <h4 style="margin: 0 0 10px 0; color: #856404;">🔒 Security Information</h4>
          <ul style="margin: 0; padding-left: 20px; color: #856404; font-size: 14px;">
            <li>This link expires in <strong>30 minutes</strong></li>
            <li>It can only be used <strong>once</strong></li>
            <li>If you didn't request this, please ignore this email</li>
            <li>Never share this link with anyone</li>
          </ul>
        </div>
        
        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; border-top: 1px solid #ecf0f1; padding-top: 20px;">
          <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br>
          <span style="word-break: break-all; background: #f8f9fa; padding: 5px; border-radius: 3px;">${loginUrl}</span>
        </p>
      </div>
    </div>
  `;

  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.send({
      to: member.email,
      from: {
        email: process.env.FROM_EMAIL,
        name: 'The Kartel'
      },
      subject: subject,
      html: htmlBody
    });
  } catch (emailError) {
    console.error('SendGrid error:', emailError);
    throw emailError;
  }
}