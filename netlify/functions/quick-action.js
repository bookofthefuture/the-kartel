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

  try {
    const { action, applicationId, actionToken } = JSON.parse(event.body);

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

    // Verify action token
    const expectedToken = action === 'approve' ? application.approveToken : application.rejectToken;
    if (actionToken !== expectedToken) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid action token' })
      };
    }

    // Check if already processed
    if (application.status !== 'pending') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Application already processed' })
      };
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    applications[appIndex].status = newStatus;
    applications[appIndex].reviewedAt = new Date().toISOString();
    applications[appIndex].reviewedBy = 'Admin (Quick Action)';

    await blobs.set('applications', 'applications.json', JSON.stringify(applications, null, 2));

    // Send email to applicant
    try {
      if (newStatus === 'approved') {
        await sendApprovalEmail(application);
      } else {
        await sendRejectionEmail(application);
      }
    } catch (emailError) {
      console.error('Failed to send applicant email:', emailError);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: `Application ${newStatus} successfully via quick action` 
      })
    };

  } catch (error) {
    console.error('Error processing quick action:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};