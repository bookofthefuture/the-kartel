// netlify/functions/update-applicant-details.js
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
    const { applicationId, firstName, lastName, email, company, position, phone, status } = JSON.parse(event.body);
    
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
      status: status || application.status,
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
          status: updatedApplication.status
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