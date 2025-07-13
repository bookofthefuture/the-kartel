// netlify/functions/get-applications.js - Updated for new field structure
const { getStore } = require('@netlify/blobs');
const { validateAuthHeader, requireRole } = require('./jwt-auth');

exports.handler = async (event, context) => {
  // Check authorization
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
    console.log('📖 Getting applications with configured SDK...');
    
    // Check environment variables first
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables:');
      console.error('NETLIFY_SITE_ID:', !!process.env.NETLIFY_SITE_ID);
      console.error('NETLIFY_ACCESS_TOKEN:', !!process.env.NETLIFY_ACCESS_TOKEN);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Server configuration error - missing credentials',
          debug: {
            hasSiteId: !!process.env.NETLIFY_SITE_ID,
            hasToken: !!process.env.NETLIFY_ACCESS_TOKEN
          }
        })
      };
    }
    
    console.log('✅ Environment variables present');
    console.log('🔧 Site ID prefix:', process.env.NETLIFY_SITE_ID.substring(0, 8) + '...');
    console.log('🔧 Token length:', process.env.NETLIFY_ACCESS_TOKEN.length);
    
    // Manual configuration with explicit credentials
    const storeConfig = {
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    };
    
    console.log('🏗️ Creating store with config:', {
      name: storeConfig.name,
      siteID: storeConfig.siteID.substring(0, 8) + '...',
      tokenLength: storeConfig.token.length,
      consistency: storeConfig.consistency
    });
    
    const applicationsStore = getStore(storeConfig);
    
    let applications = [];
    
    try {
      // Try to get the applications list
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      
      if (applicationsList && Array.isArray(applicationsList)) {
        applications = applicationsList;
        console.log(`✅ Retrieved ${applications.length} applications from list`);
      } else {
        console.log('📝 No applications list found, checking individual entries...');
        
        // Fallback: list all entries and filter
        const allEntries = await applicationsStore.list();
        console.log(`📋 Found ${allEntries.blobs.length} total entries`);
        
        for (const entry of allEntries.blobs) {
          if (entry.key !== '_list' && entry.key.startsWith('app_')) {
            try {
              const application = await applicationsStore.get(entry.key, { type: 'json' });
              if (application && application.id) {
                applications.push(application);
              }
            } catch (error) {
              console.log(`⚠️ Failed to load ${entry.key}:`, error.message);
            }
          }
        }
        
        console.log(`📊 Retrieved ${applications.length} individual applications`);
      }
    } catch (error) {
      console.error('❌ Error retrieving applications:', error.message);
      applications = [];
    }
    
    // Sort: admins first, then alphabetically by name
    applications.sort((a, b) => {
      // First, sort by admin status (admins first)
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      
      // Then sort alphabetically by full name
      const nameA = (a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '').toLowerCase();
      const nameB = (b.fullName || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ applications })
    };

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('💥 Stack:', error.stack);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};