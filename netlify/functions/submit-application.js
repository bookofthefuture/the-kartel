// netlify/functions/submit-application.js - FIXED IMPLEMENTATION
import { getStore } from '@netlify/blobs';
const crypto = require('crypto');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('📝 Form submission started');
    
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

    try {
      // Provide credentials manually since environment isn't auto-configured
      console.log('💾 Storing with official Netlify Blobs SDK...');
      
      const applicationsStore = getStore({
        name: 'applications',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_ACCESS_TOKEN,
        consistency: 'strong'  // Ensures immediate availability
      });
      
      // Store individual application
      await applicationsStore.setJSON(application.id, application);
      console.log('✅ Individual application stored');
      
      // Get current applications list
      let applications = [];
      try {
        const existingApplications = await applicationsStore.get('_list', { type: 'json' });
        if (existingApplications && Array.isArray(existingApplications)) {
          applications = existingApplications;
        }
      } catch (error) {
        console.log('📝 No existing applications list, starting fresh');
        applications = [];
      }
      
      // Add new application to list
      applications.push(application);
      
      // Store updated list
      await applicationsStore.setJSON('_list', applications);
      console.log(`✅ Applications list updated (${applications.length} total)`);
      
    } catch (storageError) {
      console.error('❌ Storage error:', storageError.message);
      // Log as fallback
      console.log('📄 FALLBACK - APPLICATION DATA:');
      console.log(JSON.stringify(application, null, 2));
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

async function sendAdminNotification(application) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

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
          <p><strong>Name:</strong> ${application.name}</p>
          <p><strong>Email:</strong> ${application.email}</p>
          <p><strong>Phone:</strong> ${application.phone}</p>
          <p><strong>Company:</strong> ${application.company || 'Not provided'}</p>
          <p><strong>Industry:</strong> ${application.industry || 'Not provided'}</p>
          <p><strong>Message:</strong> ${application.message || 'No message provided'}</p>
          <p><strong>ID:</strong> ${application.id}</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${baseUrl}/admin.html" 
             style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Open Admin Dashboard
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