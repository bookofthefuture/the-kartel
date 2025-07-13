// netlify/functions/update-applicant-details.js
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');

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
    const { applicationId, firstName, lastName, email, company, position, phone, linkedin, status, isAdmin } = JSON.parse(event.body);
    
    console.log(`🔄 Updating applicant details for ${applicationId}`);

    // Validate required fields
    if (!applicationId || !firstName || !lastName || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Application ID, first name, last name, and email are required' })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

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
    
    // Check if email is changing and if it already exists for another application
    if (email !== application.email) {
      try {
        const applicationsList = await applicationsStore.get('_list', { type: 'json' });
        if (applicationsList && Array.isArray(applicationsList)) {
          const emailExists = applicationsList.find(app => 
            app.email.toLowerCase() === email.toLowerCase() && app.id !== applicationId
          );
          if (emailExists) {
            return {
              statusCode: 400,
              body: JSON.stringify({ error: 'Email address is already used by another application' })
            };
          }
        }
      } catch (listError) {
        console.log('⚠️ Could not check for duplicate emails:', listError.message);
      }
    }
    
    // Update application with new details
    const updatedApplication = {
      ...application,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || '',
      position: position?.trim() || '',
      phone: phone?.trim() || '',
      linkedin: linkedin?.trim() || '',
      status: status || application.status,
      isAdmin: isAdmin || false,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin'
    };
    
    // Save updated application
    await applicationsStore.setJSON(applicationId, updatedApplication);
    
    // Update the applications list
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      
      if (applicationsList && Array.isArray(applicationsList)) {
        const appIndex = applicationsList.findIndex(app => app.id === applicationId);
        if (appIndex !== -1) {
          applicationsList[appIndex] = updatedApplication;
          await applicationsStore.setJSON('_list', applicationsList);
          console.log('✅ Applications list updated with new details');
        }
      }
    } catch (listError) {
      console.log('⚠️ Failed to update applications list:', listError.message);
    }

    // Check if user was just promoted to admin and needs invitation
    const wasPromotedToAdmin = !application.isAdmin && updatedApplication.isAdmin;
    const needsAdminSetup = wasPromotedToAdmin && !updatedApplication.adminPasswordHash;
    
    if (needsAdminSetup) {
      console.log(`📧 Sending admin invitation to newly promoted admin: ${updatedApplication.email}`);
      
      try {
        // Call the send-admin-invitation function
        const invitationResponse = await fetch(`${process.env.URL || 'https://the-kartel.com'}/.netlify/functions/send-admin-invitation`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            applicationId: updatedApplication.id,
            firstName: updatedApplication.firstName,
            lastName: updatedApplication.lastName,
            email: updatedApplication.email
          })
        });

        if (invitationResponse.ok) {
          console.log('✅ Admin invitation sent successfully');
        } else {
          console.log('⚠️ Failed to send admin invitation:', await invitationResponse.text());
        }
      } catch (inviteError) {
        console.log('⚠️ Error sending admin invitation:', inviteError.message);
        // Don't fail the main operation if invitation fails
      }
    }

    console.log(`✅ Applicant details updated successfully for ${applicationId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Applicant details updated successfully',
        application: {
          id: updatedApplication.id,
          firstName: updatedApplication.firstName,
          lastName: updatedApplication.lastName,
          email: updatedApplication.email,
          company: updatedApplication.company,
          position: updatedApplication.position,
          phone: updatedApplication.phone,
          linkedin: updatedApplication.linkedin,
          status: updatedApplication.status,
          isAdmin: updatedApplication.isAdmin
        }
      })
    };

  } catch (error) {
    console.error('💥 Error updating applicant details:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};