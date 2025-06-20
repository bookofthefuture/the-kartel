// netlify/functions/get-applications.js - CORRECT IMPLEMENTATION
import { getStore } from '@netlify/blobs';

exports.handler = async (event, context) => {
  // Check authorization
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
    console.log('📖 Getting applications with official SDK...');
    
    // Use strong consistency for admin reads
    const applicationsStore = getStore({
      name: 'applications',
      consistency: 'strong'
    });
    
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
    
    // Sort by submission date (newest first)
    applications.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    
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
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
