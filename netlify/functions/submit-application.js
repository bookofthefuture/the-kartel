// netlify/functions/submit-application.js - Updated for new field structure
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const webpush = require('web-push');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { sanitizeApplication, validateRequiredFields } = require('./input-sanitization');

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  `mailto:${process.env.ADMIN_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('📝 Form submission started');
    
    const rawData = JSON.parse(event.body);
    const data = sanitizeApplication(rawData);
    const timestamp = new Date().toISOString();
    
    const validation = validateRequiredFields(data, ['firstName', 'lastName', 'email', 'company', 'position', 'phone']);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Missing required fields: ${validation.missing.join(', ')}` })
      };
    }

    const approveToken = crypto.randomBytes(16).toString('hex');
    const rejectToken = crypto.randomBytes(16).toString('hex');

    const application = {
      id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`, // Combined name for backward compatibility
      email: data.email,
      company: data.company,
      position: data.position,
      phone: data.phone,
      linkedin: data.linkedin,
      experience: data.experience,
      interests: data.interests,
      referral: data.referral,
      status: 'pending',
      submittedAt: timestamp,
      reviewedAt: null,
      reviewedBy: null,
      approveToken,
      rejectToken
    };

    console.log('📋 Application created:', application.id);

    try {
      // Manual configuration with explicit credentials
      const applicationsStore = getStore({
        name: 'applications',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_ACCESS_TOKEN,
        consistency: 'strong'
      });
      
      console.log('💾 Storing with configured SDK...');
      
      // Store individual application
      await applicationsStore.setJSON(application.id, application);
      console.log('✅ Individual application stored');
      
      // Get current applications list and update it
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
      console.error('❌ Storage stack:', storageError.stack);
      
      // Log as fallback for debugging
      console.log('📄 FALLBACK - APPLICATION DATA:');
      console.log(JSON.stringify(application, null, 2));
      
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: `Database error: ${storageError.message}`,
          applicationId: application.id
        })
      };
    }

    // Send admin notification
    try {
      await sendAdminNotification(application);
      console.log('✅ Admin notification sent');
    } catch (emailError) {
      console.error('❌ Email failed:', emailError.message);
    }

    // Send push notification to admins
    try {
      await sendAdminPushNotification(application);
      console.log('📱 Admin push notification sent');
    } catch (pushError) {
      console.error('📱 Admin push notification failed:', pushError.message);
    }

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify({ 
        success: true, 
        message: 'Application submitted successfully',
        applicationId: application.id
      })
    };

  } catch (error) {
    console.error('💥 Function error:', error.message);
    console.error('💥 Function stack:', error.stack);
    
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
  if (!adminEmail) {
    console.log('No admin email configured, skipping notification');
    return;
  }

  // Use deploy prime URL for preview environments, otherwise use configured site URL
  const baseUrl = process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || 'https://the-kartel.com';
  const approveUrl = `${baseUrl}/admin.html?action=approve&id=${application.id}&token=${application.approveToken}`;
  const rejectUrl = `${baseUrl}/admin.html?action=reject&id=${application.id}&token=${application.rejectToken}`;

  const subject = `New Kartel Application - ${application.name}`;
  const htmlBody = `
    <div style="font-family: 'League Spartan', 'Arial', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%); color: white; padding: 30px; text-align: center;">
        <img src="${baseUrl}/assets/the-kartel-logo.png" alt="The Kartel Logo" style="height: 60px; width: auto; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; font-family: 'League Spartan', 'Arial', sans-serif;">The Kartel</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-family: 'League Spartan', 'Arial', sans-serif;">New Membership Application</p>
      </div>
      
      <div style="padding: 30px; background: #f8f9fa;">
        <h2 style="color: #2c3e50; margin-bottom: 20px; font-family: 'League Spartan', 'Arial', sans-serif;">Quick Actions</h2>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${approveUrl}" 
             style="background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 15px; display: inline-block; font-family: 'League Spartan', 'Arial', sans-serif;">
            APPROVE APPLICATION
          </a>
          <a href="${rejectUrl}" 
             style="background: #e67e22; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'League Spartan', 'Arial', sans-serif;">
            REJECT APPLICATION
          </a>
        </div>
        
        <h3 style="color: #2c3e50; margin-bottom: 15px; font-family: 'League Spartan', 'Arial', sans-serif;">Application Details</h3>
        
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p><strong>Name:</strong> ${application.firstName} ${application.lastName}</p>
          <p><strong>Email:</strong> ${application.email}</p>
          <p><strong>Phone:</strong> ${application.phone}</p>
          <p><strong>Company:</strong> ${application.company}</p>
          <p><strong>Position:</strong> ${application.position}</p>
          ${application.linkedin ? `<p><strong>LinkedIn:</strong> <a href="${application.linkedin}" target="_blank">${application.linkedin}</a></p>` : ''}
          ${application.experience ? `<p><strong>Experience:</strong> ${application.experience}</p>` : ''}
          ${application.interests ? `<p><strong>Interests:</strong> ${application.interests}</p>` : ''}
          ${application.referral ? `<p><strong>Referral:</strong> ${application.referral}</p>` : ''}
          <p><strong>ID:</strong> ${application.id}</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${baseUrl}/admin.html" 
             style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-family: 'League Spartan', 'Arial', sans-serif;">
            Open Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    if (!process.env.SENDGRID_API_KEY || !process.env.FROM_EMAIL) {
      console.log('SendGrid not configured, skipping email');
      return;
    }

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

// Function to send push notifications to admins for new applications
async function sendAdminPushNotification(application) {
  try {
    // Skip if VAPID keys not configured
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.log('📱 VAPID keys not configured, skipping admin push notifications');
      return;
    }

    const subscriptionsStore = getStore('push-subscriptions');
    let adminSubscriptions = [];
    
    try {
      const allSubscriptions = await subscriptionsStore.get('all-subscriptions');
      if (allSubscriptions) {
        const parsed = JSON.parse(allSubscriptions);
        adminSubscriptions = parsed.filter(sub => sub.userType === 'admin' && sub.active);
      }
    } catch (error) {
      console.log('📱 No admin push subscriptions found');
      return;
    }

    if (adminSubscriptions.length === 0) {
      console.log('📱 No admin push subscriptions found');
      return;
    }

    // Prepare notification payload
    const notificationPayload = {
      title: '📋 New Membership Application',
      body: `${application.firstName} ${application.lastName} from ${application.company}`,
      icon: '/icons/admin-icon-192x192.svg',
      badge: '/icons/admin-icon-96x96.svg',
      data: {
        applicationId: application.id,
        url: '/admin.html#applications',
        timestamp: Date.now(),
        isAdmin: true
      },
      requireInteraction: true,
      actions: [
        { action: 'review', title: 'Review Application' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    // Send notifications to all admin subscriptions
    const notificationPromises = adminSubscriptions.map(async (subscriptionData) => {
      try {
        await webpush.sendNotification(
          subscriptionData.subscription,
          JSON.stringify(notificationPayload)
        );
        console.log(`📱 Admin push notification sent: ${subscriptionData.id}`);
        return { success: true, id: subscriptionData.id };
      } catch (error) {
        console.error(`📱 Failed to send admin push notification to ${subscriptionData.id}:`, error);
        
        // If subscription is invalid (410 Gone), remove it
        if (error.statusCode === 410) {
          console.log(`📱 Removing invalid admin subscription: ${subscriptionData.id}`);
          try {
            await subscriptionsStore.delete(subscriptionData.id);
            // Update the all-subscriptions list
            const allSubscriptions = await subscriptionsStore.get('all-subscriptions');
            if (allSubscriptions) {
              const parsed = JSON.parse(allSubscriptions);
              const updatedSubscriptions = parsed.filter(
                sub => sub.id !== subscriptionData.id
              );
              await subscriptionsStore.set('all-subscriptions', JSON.stringify(updatedSubscriptions));
            }
          } catch (cleanupError) {
            console.error('Error cleaning up invalid admin subscription:', cleanupError);
          }
        }
        
        return { success: false, id: subscriptionData.id, error: error.message };
      }
    });

    const results = await Promise.allSettled(notificationPromises);
    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    const failed = results.length - successful;

    console.log(`📱 Admin push notifications: ${successful} sent, ${failed} failed`);

  } catch (error) {
    console.error('📱 Error sending admin push notifications:', error);
    // Don't throw - continue with submission even if push notifications fail
  }
}