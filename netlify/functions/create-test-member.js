// netlify/functions/create-test-member.js
// TEMPORARY FUNCTION FOR TESTING - DELETE AFTER TESTING
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  try {
    console.log('👤 Creating test member for magic link testing');

    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get existing applications
    let applications = [];
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      if (applicationsList && Array.isArray(applicationsList)) {
        applications = applicationsList;
      }
    } catch (error) {
      console.log('📝 No existing applications list found');
      applications = [];
    }

    // Use your own email for testing
    const testEmail = 'your-email@example.com'; // CHANGE THIS TO YOUR EMAIL
    
    // Check if test member already exists
    const existingMember = applications.find(app => 
      app.email.toLowerCase() === testEmail.toLowerCase()
    );

    if (existingMember) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          message: 'Test member already exists',
          member: existingMember
        })
      };
    }

    // Create test member application (pre-approved)
    const timestamp = new Date().toISOString();
    const testMember = {
      id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      firstName: 'Test',
      lastName: 'Member',
      fullName: 'Test Member',
      email: testEmail,
      company: 'Test Company',
      position: 'Test Position',
      phone: '+44123456789',
      message: 'Test member for magic link authentication',
      status: 'approved',
      submittedAt: timestamp,
      reviewedAt: timestamp,
      reviewedBy: 'System (Test)',
      approveToken: crypto.randomBytes(16).toString('hex'),
      rejectToken: crypto.randomBytes(16).toString('hex'),
      testMember: true
    };

    // Store individual application
    await applicationsStore.setJSON(testMember.id, testMember);
    
    // Add to applications list
    applications.push(testMember);
    await applicationsStore.setJSON('_list', applications);

    console.log(`✅ Test member created: ${testMember.fullName} (${testMember.email})`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Test member created successfully',
        member: testMember
      })
    };

  } catch (error) {
    console.error('💥 Error creating test member:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};