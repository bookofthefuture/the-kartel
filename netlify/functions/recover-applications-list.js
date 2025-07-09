const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // Only allow POST method
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check for admin authorization
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    console.log('🔄 Starting applications list recovery...');

    // Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Get applications store
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    console.log('🔍 Scanning for individual member records...');

    // Get all keys from the applications store
    const { blobs } = await applicationsStore.list();
    console.log(`📋 Found ${blobs.length} blob records`);

    // Filter out the _list record and process individual member records
    const memberRecords = [];
    let recoveredCount = 0;

    for (const blob of blobs) {
      // Skip the corrupted _list record
      if (blob.key === '_list') {
        console.log('⚠️ Skipping corrupted _list record');
        continue;
      }

      try {
        // Try to load individual member record
        const memberData = await applicationsStore.get(blob.key, { type: 'json' });
        
        if (memberData && memberData.email) {
          console.log(`✅ Recovered member: ${memberData.email} (${memberData.status || 'unknown status'})`);
          memberRecords.push(memberData);
          recoveredCount++;
        } else {
          console.log(`⚠️ Invalid member record for key: ${blob.key}`);
        }
      } catch (error) {
        console.log(`❌ Failed to load member record ${blob.key}: ${error.message}`);
      }
    }

    console.log(`🎯 Successfully recovered ${recoveredCount} member records`);

    // Sort by creation date if available
    memberRecords.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.submissionDate || '2020-01-01');
      const dateB = new Date(b.createdAt || b.submissionDate || '2020-01-01');
      return dateB - dateA; // Newest first
    });

    // Save the recovered applications list
    await applicationsStore.setJSON('_list', memberRecords);
    console.log('✅ Applications list restored successfully!');

    // Return recovery summary
    const statusSummary = memberRecords.reduce((acc, member) => {
      const status = member.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Applications list recovered successfully',
        recovered: recoveredCount,
        statusBreakdown: statusSummary,
        totalBlobs: blobs.length
      })
    };

  } catch (error) {
    console.error('💥 Recovery error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Recovery failed',
        details: error.message
      })
    };
  }
};