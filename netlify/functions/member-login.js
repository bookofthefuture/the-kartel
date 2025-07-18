// netlify/functions/member-login.js
const { getStore } = require('@netlify/blobs');
const { verifyPasswordAsync, shouldUpgradeHash, hashPasswordAsync } = require('./password-utils');
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
    const { email, password, token } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Determine authentication method based on password/token presence
    const isPasswordAuth = password !== undefined;
    const isMagicLinkAuth = token !== undefined;

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

    // Validate authentication method
    if (!isPasswordAuth && !isMagicLinkAuth) {
      console.log(`❌ Login attempt without password or token for: ${email.split('@')[1]} domain`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password or magic link token required' })
      };
    }

    // Handle magic link authentication first
    if (isMagicLinkAuth) {
      console.log(`🔗 Magic link authentication attempt for: ${email.split('@')[1]} domain`);
      
      // Validate magic link token
      const tokenStore = getStore({
        name: 'login-tokens',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_ACCESS_TOKEN,
        consistency: 'strong'
      });

      let tokenData;
      try {
        tokenData = await tokenStore.get(token, { type: 'json' });
      } catch (error) {
        console.log(`❌ Token not found for: ${email.split('@')[1]} domain`);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Invalid or expired magic link' })
        };
      }

      if (!tokenData) {
        console.log(`❌ Invalid token for: ${email.split('@')[1]} domain`);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Invalid or expired magic link' })
        };
      }

      // Check if token has expired
      const now = new Date();
      const expiresAt = new Date(tokenData.expiresAt);
      if (now > expiresAt) {
        console.log(`❌ Expired token for: ${email.split('@')[1]} domain`);
        // Clean up expired token
        await tokenStore.delete(token);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Magic link has expired. Please request a new one.' })
        };
      }

      // Check if token has been used
      if (tokenData.used) {
        console.log(`❌ Token already used for: ${email.split('@')[1]} domain`);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Magic link has already been used. Please request a new one.' })
        };
      }

      // Check if token email matches request email
      if (tokenData.email.toLowerCase() !== email.toLowerCase()) {
        console.log(`❌ Token email mismatch for: ${email.split('@')[1]} domain`);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Invalid magic link' })
        };
      }

      // Mark token as used
      await tokenStore.setJSON(token, {
        ...tokenData,
        used: true,
        usedAt: new Date().toISOString()
      });

      console.log(`✅ Magic link token validated for: ${email.split('@')[1]} domain`);
      
      // Fetch the complete member data from applications store
      const applicationsStore = getStore(storeConfig);
      const memberKey = `member_${tokenData.memberId}`;
      
      let memberApplication;
      try {
        memberApplication = await applicationsStore.get(memberKey, { type: 'json' });
        console.log(`✅ Retrieved full member data for: ${email.split('@')[1]} domain`);
      } catch (error) {
        console.error(`❌ Failed to retrieve member data for ${email.split('@')[1]} domain:`, error);
        return {
          statusCode: 500,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Failed to retrieve member data' })
        };
      }

      if (!memberApplication || memberApplication.status !== 'approved') {
        console.log(`❌ Member not found or not approved for: ${email.split('@')[1]} domain`);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Member account not found or not active' })
        };
      }

      // Generate JWT token with proper roles
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
      
      const jwtToken = generateToken(tokenPayload);

      return {
        statusCode: 200,
        headers: createSecureHeaders(event),
        body: JSON.stringify({
          success: true,
          token: jwtToken,
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
          message: 'Magic link login successful'
        })
      };
    }

    // 4. Business logic: Check for approved member using efficient search (for password auth)
    console.log(`🔒 Attempting member login for: ${email.split('@')[1]} domain (method: password)`);

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

      // Verify password with auto-detection of algorithm
      const algorithm = memberApplication.memberPasswordAlgorithm || 'pbkdf2';
      const isValid = await verifyPasswordAsync(
        password, 
        memberApplication.memberPasswordHash, 
        memberApplication.memberPasswordSalt, 
        algorithm
      );

      if (!isValid) {
        console.log(`❌ Invalid password for member: ${email.split('@')[1]} domain`);
        return {
          statusCode: 401,
          headers: createSecureHeaders(event),
          body: JSON.stringify({ error: 'Invalid credentials' })
        };
      }

      // Check if password hash should be upgraded to Argon2id
      let shouldUpgrade = false;
      if (shouldUpgradeHash(algorithm)) {
        console.log(`🔄 Password hash upgrade recommended for: ${email.split('@')[1]} domain (${algorithm} -> argon2id)`);
        
        try {
          // Upgrade password hash to Argon2id
          const { hash: newHash, algorithm: newAlgorithm } = await hashPasswordAsync(password);
          
          // Update member record with new hash
          const applicationsStore = getStore(storeConfig);
          const memberKey = `member_${memberApplication.id}`;
          const updatedMember = {
            ...memberApplication,
            memberPasswordHash: newHash,
            memberPasswordAlgorithm: newAlgorithm,
            // Remove salt for Argon2id (not needed)
            memberPasswordSalt: newAlgorithm === 'argon2id' ? undefined : memberApplication.memberPasswordSalt,
            passwordUpgradedAt: new Date().toISOString()
          };
          
          await applicationsStore.set(memberKey, JSON.stringify(updatedMember));
          console.log(`✅ Password hash upgraded successfully for: ${email.split('@')[1]} domain`);
          shouldUpgrade = true;
        } catch (upgradeError) {
          console.error(`❌ Failed to upgrade password hash for ${email.split('@')[1]} domain:`, upgradeError);
          // Continue with login even if upgrade fails
        }
      }

      console.log(`✅ Member password login successful for: ${email.split('@')[1]} domain${shouldUpgrade ? ' (hash upgraded)' : ''}`);
      
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
