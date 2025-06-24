// netlify/functions/update-member-profile.js
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
    const { firstName, lastName, company, position, phone } = JSON.parse(event.body);

    if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'First name and last name are required' })
      };
    }

    console.log('👤 Updating member profile');

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Get member info from token store first to validate the token and get member ID
    const tokenStore = getStore({
      name: 'login-tokens',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    let memberEmail = null;
    let memberId = null;

    // Check if this is a valid login token
    try {
      const tokenData = await tokenStore.get(token, { type: 'json' });
      if (tokenData && !tokenData.used && new Date() < new Date(tokenData.expiresAt)) {
        memberEmail = tokenData.email;
        memberId = tokenData.memberId;
      }
    } catch (tokenError) {
      console.log('Token not found in login-tokens, checking member tokens...');
    }

    if (!memberEmail || !memberId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }

    // Get applications store to update member data
    const applicationsStore = getStore({
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    });

    // Get the member's application record
    const member = await applicationsStore.get(memberId, { type: 'json' });
    
    if (!member) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Member not found' })
      };
    }

    if (member.email !== memberEmail) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Token does not match member' })
      };
    }

    // Update member profile
    const updatedMember = {
      ...member,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company?.trim() || '',
      position: position?.trim() || '',
      phone: phone?.trim() || '',
      updatedAt: new Date().toISOString()
    };

    // Save updated member
    await applicationsStore.setJSON(memberId, updatedMember);

    // Update the applications list
    try {
      const applicationsList = await applicationsStore.get('_list', { type: 'json' });
      
      if (applicationsList && Array.isArray(applicationsList)) {
        const memberIndex = applicationsList.findIndex(app => app.id === memberId);
        if (memberIndex !== -1) {
          applicationsList[memberIndex] = updatedMember;
          await applicationsStore.setJSON('_list', applicationsList);
          console.log('✅ Applications list updated with new profile data');
        }
      }
    } catch (listError) {
      console.log('⚠️ Failed to update applications list:', listError.message);
    }

    console.log(`✅ Profile updated for ${memberEmail}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Profile updated successfully',
        member: {
          firstName: updatedMember.firstName,
          lastName: updatedMember.lastName,
          company: updatedMember.company,
          position: updatedMember.position,
          phone: updatedMember.phone
        }
      })
    };

  } catch (error) {
    console.error('💥 Error updating member profile:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};