const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

function verifyPassword(password, salt, hash) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { username, password } = JSON.parse(event.body);
    
    console.log(`🔐 Admin login attempt for: ${username}`);
    
    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // First check legacy admin credentials for backwards compatibility
    const legacyAdminUsername = process.env.ADMIN_USERNAME;
    const legacyAdminPassword = process.env.ADMIN_PASSWORD;
    
    if (legacyAdminUsername && legacyAdminPassword && 
        username === legacyAdminUsername && password === legacyAdminPassword) {
      console.log('✅ Legacy admin login successful');
      const token = crypto.randomBytes(32).toString('hex');
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          token: token,
          user: {
            email: legacyAdminUsername,
            name: 'Admin',
            isLegacyAdmin: true
          }
        })
      };
    }

    // Check database for admin users
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    let applications = [];
    
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      if (applicationsList && Array.isArray(applicationsList)) {
        applications = applicationsList;
      }
    } catch (error) {
      console.log('⚠️ Could not load applications list:', error.message);
    }

    // Find admin user by email (username)
    const adminUser = applications.find(app => 
      app.isAdmin && 
      app.email && 
      app.email.toLowerCase() === username.toLowerCase() &&
      app.adminPasswordHash &&
      app.adminPasswordSalt
    );

    if (!adminUser) {
      console.log(`❌ No admin user found for: ${username}`);
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Verify password
    if (!verifyPassword(password, adminUser.adminPasswordSalt, adminUser.adminPasswordHash)) {
      console.log(`❌ Invalid password for admin: ${username}`);
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    
    console.log(`✅ Admin login successful for: ${username}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        token: token,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: `${adminUser.firstName} ${adminUser.lastName}`,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          isLegacyAdmin: false
        }
      })
    };
    
  } catch (error) {
    console.error('💥 Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
