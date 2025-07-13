// netlify/functions/update-member-profile.js
const { getStore } = require('@netlify/blobs');
const { hashPassword } = require('./password-utils');
const { validateAuthHeader, requireRole } = require('./jwt-auth');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate JWT token
  const authResult = validateAuthHeader(event.headers.authorization);
  if (!authResult.success) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error })
    };
  }

  // Members can update their own profile, admins can update any profile
  const userRoles = authResult.payload.roles || [];
  const isAdmin = userRoles.includes('admin') || userRoles.includes('super-admin');

  try {
    const { firstName, lastName, company, position, phone, linkedin, memberId, memberEmail, newPassword } = JSON.parse(event.body);

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

    // Authorization check: members can only update their own profile unless they're admin
    if (!isAdmin && authResult.payload.userId !== memberId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You can only update your own profile' })
      };
    }

    // Handle password update if provided
    let passwordFields = {};
    if (newPassword) {
      console.log(`🔑 Setting password for member ${memberId}`);
      const { salt, hash } = hashPassword(newPassword);
      passwordFields = {
        memberPasswordHash: hash,
        memberPasswordSalt: salt,
        passwordSetAt: new Date().toISOString()
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
      ...passwordFields,
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
        message: newPassword ? 'Profile and password updated successfully' : 'Profile updated successfully',
        passwordSet: !!newPassword,
        hasPassword: !!(updatedMember.memberPasswordHash && updatedMember.memberPasswordSalt),
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