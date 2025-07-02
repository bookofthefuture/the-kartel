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
    const { firstName, lastName, company, position, phone, linkedin, memberId, memberEmail } = JSON.parse(event.body);

    if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'First name and last name are required' })
      };
    }

    if (!memberId || !memberEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Member identification required' })
      };
    }

    console.log(`👤 Updating profile for member ${memberId}`);

    // Check environment variables
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
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
        body: JSON.stringify({ error: 'Member email does not match' })
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
      linkedin: linkedin?.trim() || '',
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
          phone: updatedMember.phone,
          linkedin: updatedMember.linkedin
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