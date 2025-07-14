// netlify/functions/member-login.js
const { getStore } = require('@netlify/blobs');
const { verifyPassword } = require('./password-utils');
const { generateToken } = require('./jwt-auth');
const { verifySuperAdminCredentials } = require('./timing-safe-utils');
const { createSecureHeaders, handleCorsPreflightRequest } = require('./cors-utils');
const { getApplicationsList, findItemByField } = require('./blob-list-utils');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(event);
  if (corsResponse) {
    return corsResponse;
  }

  // 1. HTTP method validation
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Determine authentication method based on password presence
    const isPasswordAuth = password !== undefined;

    // Check for super admin credentials first using timing-safe comparison
    if (isPasswordAuth && process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
      if (verifySuperAdminCredentials(email, password, process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_PASSWORD)) {
        console.log('✅ Super admin authenticated successfully');
        
        // Generate JWT for super admin
        const tokenPayload = {
          userId: 'super-admin',
          email: process.env.SUPER_ADMIN_EMAIL,
          roles: ['super-admin', 'admin'],
          type: 'super-admin'
        };
        
        const token = generateToken(tokenPayload);

        return {
          statusCode: 200,
          headers: createSecureHeaders(event),
          body: JSON.stringify({
            success: true,
            token: token,
            memberId: 'super-admin',
            memberEmail: process.env.SUPER_ADMIN_EMAIL,
            memberFullName: 'Super Administrator',
            memberProfile: {
              firstName: 'Super',
              lastName: 'Administrator',
              company: 'The Kartel Franchise',
              position: 'Super Administrator',
              hasPassword: true
            },
            isAdmin: true,
            isSuperAdmin: true
          })
        };
      }
    }

    // 2. Environment variable check
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_ACCESS_TOKEN) {
      console.error('❌ Missing environment variables for Blob storage.');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    console.log('🔧 Environment check - Site ID:', process.env.NETLIFY_SITE_ID ? 'exists' : 'missing');
    console.log('🔧 Environment check - Access Token:', process.env.NETLIFY_ACCESS_TOKEN ? 'exists' : 'missing');

    // 3. Store configuration for efficient operations
    const storeConfig = {
      name: 'applications',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_ACCESS_TOKEN,
      consistency: 'strong'
    };

    // 4. Business logic: Check for approved member using efficient search
    console.log(`🔒 Attempting member login for: ${email.split('@')[1]} domain (method: ${isPasswordAuth ? 'password' : 'magic link only'})`);

    // Use efficient field search to find member by email and approved status
    let applications = await getApplicationsList(storeConfig);
    console.log(`📋 Loaded ${applications.length} applications efficiently`);
    
    // Fallback to legacy method if new method returns empty results
    if (applications.length === 0) {
      console.log(`🔄 Fallback: Trying legacy applications list method...`);
      try {
        const applicationsStore = getStore(storeConfig);
        const applicationsList = await applicationsStore.get('_list', { type: 'json' });
        if (applicationsList && Array.isArray(applicationsList)) {
          applications = applicationsList;
          console.log(`✅ Fallback successful: Loaded ${applications.length} applications from legacy list`);
        }
      } catch (fallbackError) {
        console.error(`❌ Fallback failed:`, fallbackError.message);
      }
    }
    
    // Debug: Log some application details (without sensitive info)
    if (applications.length > 0) {
      console.log(`📊 Sample applications:`, applications.slice(0, 3).map(app => ({
        emailDomain: app.email ? app.email.split('@')[1] : 'unknown',
        status: app.status,
        hasPasswordHash: !!app.memberPasswordHash
      })));
    } else {
      console.warn(`⚠️ Still no applications found after fallback! This indicates a serious blob storage issue.`);
    }
    
    const memberApplication = applications.find(
      app => app.email.toLowerCase() === email.toLowerCase() && app.status === 'approved'
    );

    if (!memberApplication) {
      console.log(`❌ Failed login attempt for: ${email.split('@')[1]} domain (Not found or not approved)`);
      console.log(`📧 Available domains:`, applications.slice(0, 5).map(app => `${app.email?.split('@')[1] || 'unknown'} (${app.status})`));
      return {
        statusCode: 401,
        headers: createSecureHeaders(event),
        body: JSON.stringify({ error: 'Invalid credentials or application not approved' })
      };
    }

    // Handle password authentication
    if (isPasswordAuth) {
      console.log(`🔑 Password auth for ${email.split('@')[1]} domain, has hash: ${!!memberApplication.memberPasswordHash}, has salt: ${!!memberApplication.memberPasswordSalt}`);
      
      // Check if member has password set
      if (!memberApplication.memberPasswordHash || !memberApplication.memberPasswordSalt) {
        console.log(`❌ Password login attempted for ${email.split('@')[1]} domain but no password set`);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Password not set. Please use magic link login or contact admin.' })
        };
      }

      // Verify password
      if (!verifyPassword(password, memberApplication.memberPasswordSalt, memberApplication.memberPasswordHash)) {
        console.log(`❌ Invalid password for member: ${email.split('@')[1]} domain`);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Invalid credentials' })
        };
      }

      console.log(`✅ Member password login successful for: ${email.split('@')[1]} domain`);
    } else {
      // Magic link only authentication (existing behavior)
      console.log(`✅ Member magic link login successful for: ${email.split('@')[1]} domain`);
    }

    // Generate JWT token
    const roles = [];
    if (memberApplication.isAdmin) roles.push('admin');
    if (memberApplication.isSuperAdmin) roles.push('super-admin');
    roles.push('member');

    const tokenPayload = {
      userId: memberApplication.id,
      email: memberApplication.email,
      roles: roles,
      type: 'member'
    };
    
    const token = generateToken(tokenPayload);

    // 5. Enhanced success response with complete member profile
    const response = {
      success: true,
      token: token,
      memberId: memberApplication.id,
      memberEmail: memberApplication.email,
      memberFullName: memberApplication.fullName || `${memberApplication.firstName || ''} ${memberApplication.lastName || ''}`.trim() || memberApplication.email,
      isAdmin: !!memberApplication.isAdmin,
      isSuperAdmin: !!memberApplication.isSuperAdmin,
      // Complete member profile data
      memberProfile: {
        firstName: memberApplication.firstName,
        lastName: memberApplication.lastName,
        company: memberApplication.company,
        position: memberApplication.position,
        phone: memberApplication.phone,
        linkedin: memberApplication.linkedin,
        hasPassword: !!(memberApplication.memberPasswordHash && memberApplication.memberPasswordSalt)
      },
      message: 'Login successful'
    };

    // Add admin-specific data if user is an admin
    if (memberApplication.isAdmin) {
      console.log(`👑 Admin login detected for: ${memberApplication.email.split('@')[1]} domain`);
      response.adminUser = {
        id: memberApplication.id,
        email: memberApplication.email,
        name: response.memberFullName,
        firstName: memberApplication.firstName,
        lastName: memberApplication.lastName
      };
    }

    return {
      statusCode: 200,
      headers: createSecureHeaders(event),
      body: JSON.stringify(response)
    };

  } catch (error) {
    // 6. Standard error response
    console.error('💥 Error during member login:', error);
    return {
      statusCode: 500,
      headers: createSecureHeaders(event),
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
