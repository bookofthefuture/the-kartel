// Temporary function to promote tom@bookofthefuture.co.uk to super admin
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  try {
    // Create store
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get all applications
    const applicationsList = await applicationsStore.get('_list', { type: 'json' });
    
    if (!applicationsList || !Array.isArray(applicationsList)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Applications list not found' })
      };
    }

    // Find Tom's record
    const tomIndex = applicationsList.findIndex(app => 
      app.email && app.email.toLowerCase() === 'tom@bookofthefuture.co.uk'
    );

    if (tomIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Tom\'s member record not found' })
      };
    }

    // Update Tom's record to be super admin
    applicationsList[tomIndex].isSuperAdmin = true;
    applicationsList[tomIndex].isAdmin = true; // Ensure admin status too

    // Save the updated list
    await applicationsStore.set('_list', JSON.stringify(applicationsList));

    // Also update the individual record
    const tomRecord = applicationsList[tomIndex];
    await applicationsStore.set(tomRecord.id, JSON.stringify(tomRecord));

    console.log('✅ Tom promoted to super admin successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Tom has been promoted to super admin',
        memberData: {
          email: tomRecord.email,
          name: tomRecord.firstName + ' ' + tomRecord.lastName,
          isAdmin: tomRecord.isAdmin,
          isSuperAdmin: tomRecord.isSuperAdmin
        }
      })
    };

  } catch (error) {
    console.error('❌ Error promoting to super admin:', error);
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