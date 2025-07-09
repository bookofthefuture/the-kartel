const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const { hashPassword } = require('./password-utils');

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, resetToken, newPassword } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
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

    const tokensStore = getStore({
      name: 'reset-tokens',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Load applications
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
    console.log(`🔍 Searching for member with email: ${email}`);
    console.log(`📋 Total applications found: ${applications.length}`);
    
    const memberApplication = applications.find(
      app => app.email.toLowerCase() === email.toLowerCase() && app.status === 'approved'
    );

    if (!memberApplication) {
      console.log(`❌ Password reset requested for non-existent member: ${email}`);
      console.log(`📧 Available emails:`, applications.map(app => `${app.email} (${app.status})`));
      // Always return success to prevent email enumeration
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'If this email is associated with a member account, a password reset link has been sent.'
        })
      };
    }

    // Handle password reset request (no token provided)
    if (!resetToken && !newPassword) {
      console.log(`🔑 Password reset requested for: ${email}`);
      
      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + (30 * 60 * 1000); // 30 minutes
      
      // Store reset token
      await tokensStore.setJSON(token, {
        email: email,
        memberId: memberApplication.id,
        expiry: expiry,
        used: false
      });
      
      console.log(`💾 Reset token stored: ${token.substring(0, 8)}...`);

      // Send reset email
      if (process.env.SENDGRID_API_KEY) {
        const resetLink = `${process.env.URL || 'https://thekartel.co.uk'}/members.html?reset=${token}`;
        
        const msg = {
          to: email,
          from: process.env.FROM_EMAIL || 'noreply@thekartel.co.uk',
          subject: 'The Kartel - Password Reset Request',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2c3e50; font-size: 2rem; margin-bottom: 10px;">The Kartel</h1>
                <p style="color: #7f8c8d; font-size: 1.1rem;">Password Reset Request</p>
              </div>
              
              <div style="background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0;">
                <h2 style="color: #2c3e50; margin-bottom: 20px;">Reset Your Password</h2>
                <p style="color: #2c3e50; margin-bottom: 20px;">
                  You requested to reset your password for your Kartel Members account.
                </p>
                <p style="color: #2c3e50; margin-bottom: 25px;">
                  Click the button below to set a new password:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Reset Password
                  </a>
                </div>
                <p style="color: #7f8c8d; font-size: 0.9rem; margin-top: 20px;">
                  This link will expire in 30 minutes for security reasons.
                </p>
                <p style="color: #7f8c8d; font-size: 0.9rem;">
                  If you didn't request this reset, please ignore this email.
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 0.85rem;">
                <p>The Kartel - Exclusive Manchester Business Networking</p>
              </div>
            </div>
          `
        };

        await sgMail.send(msg);
        console.log(`✅ Password reset email sent to: ${email}`);
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'If this email is associated with a member account, a password reset link has been sent.'
        })
      };
    }

    // Handle password reset completion (token and new password provided)
    if (resetToken && newPassword) {
      console.log(`🔑 Password reset completion for: ${email}`);
      
      // Verify reset token
      let tokenData;
      try {
        console.log(`🔍 Looking up reset token: ${resetToken.substring(0, 8)}...`);
        tokenData = await tokensStore.get(resetToken, { type: 'json' });
        console.log(`✅ Token data found:`, tokenData ? 'exists' : 'null');
      } catch (error) {
        console.log(`❌ Invalid reset token: ${resetToken}`, error.message);
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Invalid or expired reset token' })
        };
      }

      if (!tokenData || tokenData.used || Date.now() > tokenData.expiry || tokenData.email !== email) {
        console.log(`❌ Invalid/expired reset token for: ${email}`, {
          tokenData: tokenData ? 'exists' : 'missing',
          used: tokenData?.used,
          expired: tokenData ? Date.now() > tokenData.expiry : 'unknown',
          emailMatch: tokenData ? tokenData.email === email : 'unknown',
          providedEmail: email,
          storedEmail: tokenData?.email
        });
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Invalid or expired reset token' })
        };
      }

      // Hash new password
      const { salt, hash } = hashPassword(newPassword);

      // Update member with new password
      const updatedMember = {
        ...memberApplication,
        memberPasswordHash: hash,
        memberPasswordSalt: salt,
        passwordSetAt: new Date().toISOString()
      };

      // Update applications array
      const updatedApplications = applications.map(app => 
        app.id === memberApplication.id ? updatedMember : app
      );

      // Save updated applications
      await applicationsStore.setJSON('_list', updatedApplications);

      // Mark token as used
      await tokensStore.setJSON(resetToken, { ...tokenData, used: true });

      console.log(`✅ Password reset completed for: ${email}`);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Password reset successful. You can now log in with your new password.'
        })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request parameters' })
    };

  } catch (error) {
    console.error('💥 Error during password reset:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};